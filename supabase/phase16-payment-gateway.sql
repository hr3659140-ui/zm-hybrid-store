-- Phase 16: Payment gateway-ready / manual payment infrastructure.
-- This does NOT activate a live JazzCash/Easypaisa API. It stores references securely
-- and exposes customer-facing instructions through existing site_settings.

alter table public.payments
  add column if not exists paid_at timestamptz;

create index if not exists idx_payments_provider_reference on public.payments(provider_reference);

insert into public.site_settings(key,value)
values
 ('payment.bank_instructions',to_jsonb('Bank transfer details will be provided after order placement.'::text)),
 ('payment.jazzcash_instructions',to_jsonb('JazzCash payment instructions will be provided after order placement.'::text)),
 ('payment.easypaisa_instructions',to_jsonb('Easypaisa payment instructions will be provided after order placement.'::text))
on conflict (key) do nothing;

-- Allow the public storefront to read payment instructions only through the
-- already-public site_settings table. Do not put merchant secrets here.
drop policy if exists v16_site_settings_public_select on public.site_settings;
create policy v16_site_settings_public_select on public.site_settings for select using (true);

-- Replace the secure checkout function so the optional prepaid reference is
-- recorded server-side; price, stock, shipping and totals remain authoritative.
create or replace function public.create_order_secure(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_customer_id uuid := auth.uid();
  v_name text; v_phone text; v_address text; v_city text; v_postal text; v_notes text;
  v_payment_method text; v_payment_reference text; v_shipping_method text; v_coupon_code text; v_affiliate_code text;
  v_items jsonb; v_item jsonb; v_product_id uuid; v_variant_id uuid; v_qty integer;
  v_product public.products%rowtype; v_variant public.product_variants%rowtype;
  v_unit_price numeric(12,2); v_subtotal numeric(12,2):=0; v_discount numeric(12,2):=0;
  v_shipping numeric(12,2):=0; v_total numeric(12,2); v_coupon public.coupons%rowtype;
  v_coupon_discount numeric(12,2):=0; v_address_json jsonb; v_ship_method public.shipping_methods%rowtype;
  v_ship_rule public.shipping_rules%rowtype; v_free_threshold numeric(12,2);
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid order payload'; end if;
  v_name:=left(btrim(coalesce(p_payload->>'name','')),160); v_phone:=left(btrim(coalesce(p_payload->>'phone','')),40);
  v_address:=left(btrim(coalesce(p_payload->>'address','')),500); v_city:=left(btrim(coalesce(p_payload->>'city','')),120);
  v_postal:=left(btrim(coalesce(p_payload->>'postal','')),30); v_notes:=left(btrim(coalesce(p_payload->>'notes','')),1000);
  v_payment_method:=btrim(coalesce(p_payload->>'payment_method','Cash on delivery'));
  v_payment_reference:=left(btrim(coalesce(p_payload->>'payment_reference','')),120);
  v_shipping_method:=lower(btrim(coalesce(p_payload->>'shipping_method','standard')));
  v_coupon_code:=upper(btrim(coalesce(p_payload->>'coupon_code',''))); v_affiliate_code:=upper(left(btrim(coalesce(p_payload->>'affiliate_code','')),40)); v_items:=p_payload->'items';
  if v_name='' or v_phone='' or v_address='' or v_city='' then raise exception 'Please complete your name, phone, address and city'; end if;
  if v_payment_method not in ('Cash on delivery','Bank transfer','JazzCash','Easypaisa') then raise exception 'Unsupported payment method'; end if;
  if v_items is null or jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'Cart is empty'; end if;

  select * into v_ship_method from public.shipping_methods where code=v_shipping_method and active=true limit 1;
  if not found then select * into v_ship_method from public.shipping_methods where code='standard' and active=true limit 1; end if;
  if not found then raise exception 'No active shipping method'; end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_product_id:=(v_item->>'product_id')::uuid; v_variant_id:=nullif(v_item->>'variant_id','')::uuid; v_qty:=(v_item->>'quantity')::integer;
    if v_qty is null or v_qty<1 or v_qty>100 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id=v_product_id and status='active' for update;
    if not found then raise exception 'Product unavailable'; end if;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and active=true for update;
      if not found or v_variant.stock<v_qty then raise exception 'Insufficient stock for selected variant'; end if;
      v_unit_price:=coalesce(v_variant.price,v_product.sale_price,v_product.regular_price);
    else
      if v_product.stock<v_qty then raise exception 'Insufficient product stock'; end if;
      v_unit_price:=coalesce(v_product.sale_price,v_product.regular_price);
    end if;
    if v_unit_price is null or v_unit_price<0 then raise exception 'Invalid product price'; end if;
    v_subtotal:=v_subtotal+round(v_unit_price*v_qty,2);
  end loop;

  if v_coupon_code<>'' then
    select * into v_coupon from public.coupons where upper(code)=v_coupon_code and active=true for update;
    if not found then raise exception 'Invalid coupon'; end if;
    if v_coupon.starts_at is not null and now()<v_coupon.starts_at then raise exception 'Coupon is not active yet'; end if;
    if v_coupon.ends_at is not null and now()>v_coupon.ends_at then raise exception 'Coupon has expired'; end if;
    if v_coupon.usage_limit is not null and coalesce(v_coupon.used_count,0)>=v_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
    if v_coupon.minimum_order is not null and v_subtotal<v_coupon.minimum_order then
      raise exception using message = 'Minimum order for this coupon is Rs. ' || v_coupon.minimum_order::text;
    end if;
    if v_coupon.type='percentage' then v_coupon_discount:=round(v_subtotal*coalesce(v_coupon.value,0)/100,2); else v_coupon_discount:=least(v_subtotal,coalesce(v_coupon.value,0)); end if;
    v_discount:=greatest(least(v_coupon_discount,v_subtotal),0);
  end if;

  select * into v_ship_rule from public.shipping_rules where shipping_method_id=v_ship_method.id and active=true and lower(btrim(city))=lower(btrim(v_city)) limit 1;
  v_shipping:=coalesce(v_ship_rule.cost,v_ship_method.base_cost,0); v_free_threshold:=coalesce(v_ship_rule.free_threshold,v_ship_method.free_threshold);
  if v_free_threshold is not null and v_subtotal>=v_free_threshold then v_shipping:=0; end if;
  v_total:=greatest(round(v_subtotal+v_shipping-v_discount,2),0);
  v_order_number:='ZM-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(v_order_id::text,'-',''),1,8));
  v_address_json:=jsonb_build_object('full_name',v_name,'phone',v_phone,'line1',v_address,'city',v_city,'postal_code',nullif(v_postal,''),'country','Pakistan');

  insert into public.orders(id,order_number,customer_id,status,payment_method,subtotal,shipping_cost,discount,total_amount,shipping_name,shipping_phone,shipping_address,notes,payment_status,currency,coupon_code,shipping_method,shipping_address_json,affiliate_code)
  values(v_order_id,v_order_number,v_customer_id,'pending',v_payment_method,v_subtotal,v_shipping,v_discount,v_total,v_name,v_phone,v_address||case when v_city<>'' then ', '||v_city else '' end,v_notes,'pending','PKR',nullif(v_coupon_code,''),v_ship_method.code,v_address_json,nullif(v_affiliate_code,''));

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_product_id:=(v_item->>'product_id')::uuid; v_variant_id:=nullif(v_item->>'variant_id','')::uuid; v_qty:=(v_item->>'quantity')::integer;
    select * into v_product from public.products where id=v_product_id and status='active' for update;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and active=true for update;
      v_unit_price:=coalesce(v_variant.price,v_product.sale_price,v_product.regular_price);
      insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total,variant_id,sku,discount,product_snapshot)
      values(v_order_id,v_product_id,v_product.name,v_unit_price,v_qty,round(v_unit_price*v_qty,2),v_variant_id,v_variant.sku,0,jsonb_build_object('name',v_product.name,'sku',v_variant.sku,'variant_name',v_variant.name,'attributes',v_variant.attributes,'price',v_unit_price));
      update public.product_variants set stock=stock-v_qty where id=v_variant_id;
      insert into public.inventory_transactions(product_id,variant_id,quantity_change,reason,reference_id,note,created_by) values(v_product_id,v_variant_id,-v_qty,'order',v_order_id,'Stock reserved by checkout',v_customer_id);
    else
      v_unit_price:=coalesce(v_product.sale_price,v_product.regular_price);
      insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total,sku,discount,product_snapshot) values(v_order_id,v_product_id,v_product.name,v_unit_price,v_qty,round(v_unit_price*v_qty,2),v_product.sku,0,jsonb_build_object('name',v_product.name,'sku',v_product.sku,'price',v_unit_price));
      update public.products set stock=stock-v_qty where id=v_product_id;
      insert into public.inventory_transactions(product_id,quantity_change,reason,reference_id,note,created_by) values(v_product_id,-v_qty,'order',v_order_id,'Stock reserved by checkout',v_customer_id);
    end if;
  end loop;
  if v_coupon_code<>'' then update public.coupons set used_count=coalesce(used_count,0)+1 where id=v_coupon.id; insert into public.coupon_usage(coupon_id,user_id,order_id) values(v_coupon.id,v_customer_id,v_order_id); end if;
  insert into public.payments(order_id,provider,provider_reference,amount,currency,status,metadata) values(v_order_id,lower(replace(v_payment_method,' ','_')),nullif(v_payment_reference,''),v_total,'PKR','pending',jsonb_build_object('checkout','secure-v2','payment_method',v_payment_method));
  insert into public.order_status_history(order_id,status,note,changed_by) values(v_order_id,'pending','Order created through secure checkout',v_customer_id);
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'shipping',v_shipping,'total',v_total,'currency','PKR','payment_status','pending');
end; $$;

revoke all on function public.create_order_secure(jsonb) from public;
grant execute on function public.create_order_secure(jsonb) to anon, authenticated;
notify pgrst,'reload schema';

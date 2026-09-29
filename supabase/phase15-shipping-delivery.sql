-- ZM Hybrid Store V11 Phase 15 — Shipping & Delivery Pro
-- Run once in Supabase SQL Editor.
create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  base_cost numeric(12,2) not null default 0 check (base_cost >= 0),
  free_threshold numeric(12,2) check (free_threshold is null or free_threshold >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shipping_rules (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  shipping_method_id uuid not null references public.shipping_methods(id) on delete cascade,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  free_threshold numeric(12,2) check (free_threshold is null or free_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shipping_rules_city on public.shipping_rules(lower(city));
create index if not exists idx_shipping_rules_method on public.shipping_rules(shipping_method_id);
alter table public.shipping_methods enable row level security;
alter table public.shipping_rules enable row level security;
drop policy if exists shipping_methods_public_select on public.shipping_methods;
create policy shipping_methods_public_select on public.shipping_methods for select using (active=true);
drop policy if exists shipping_rules_public_select on public.shipping_rules;
create policy shipping_rules_public_select on public.shipping_rules for select using (active=true);
drop policy if exists shipping_methods_admin_all on public.shipping_methods;
create policy shipping_methods_admin_all on public.shipping_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists shipping_rules_admin_all on public.shipping_rules;
create policy shipping_rules_admin_all on public.shipping_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.shipping_methods (name,code,description,base_cost,free_threshold,active,sort_order)
values
 ('Standard Delivery','standard','Delivered in 2–5 business days.',250,5000,true,1),
 ('Express Delivery','express','Priority delivery where available.',450,8000,true,2)
on conflict (code) do update set name=excluded.name,description=excluded.description,base_cost=excluded.base_cost,free_threshold=excluded.free_threshold,active=excluded.active,sort_order=excluded.sort_order;
notify pgrst, 'reload schema';

-- ZM Hybrid Store V11 Phase 5 — Secure server-side order creation
-- Run once in Supabase SQL Editor after schema-v11.sql.
-- This function is intentionally safe for guest COD checkout:
-- prices/stock are read from the database, never trusted from the browser.
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
  v_name text;
  v_phone text;
  v_address text;
  v_city text;
  v_postal text;
  v_notes text;
  v_payment_method text;
  v_shipping_method text;
  v_coupon_code text;
  v_items jsonb;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_unit_price numeric(12,2);
  v_regular_price numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2);
  v_coupon public.coupons%rowtype;
  v_coupon_discount numeric(12,2) := 0;
  v_address_json jsonb;
  v_item_count integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid order payload';
  end if;

  v_name := btrim(coalesce(p_payload->>'name',''));
  v_phone := btrim(coalesce(p_payload->>'phone',''));
  v_address := btrim(coalesce(p_payload->>'address',''));
  v_city := btrim(coalesce(p_payload->>'city',''));
  v_postal := btrim(coalesce(p_payload->>'postal',''));
  v_notes := left(btrim(coalesce(p_payload->>'notes','')), 1000);
  v_payment_method := btrim(coalesce(p_payload->>'payment_method','Cash on delivery'));
  v_shipping_method := lower(btrim(coalesce(p_payload->>'shipping_method','standard')));
  v_coupon_code := upper(btrim(coalesce(p_payload->>'coupon_code','')));
  v_items := p_payload->'items';

  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Please enter a valid name'; end if;
  if length(v_phone) < 7 or length(v_phone) > 30 then raise exception 'Please enter a valid phone number'; end if;
  if length(v_address) < 5 or length(v_address) > 500 then raise exception 'Please enter a valid address'; end if;
  if length(v_city) < 2 or length(v_city) > 80 then raise exception 'Please enter a valid city'; end if;
  if v_payment_method not in ('Cash on delivery','Bank transfer','JazzCash / Easypaisa') then
    raise exception 'Unsupported payment method';
  end if;
  if v_shipping_method = '' then v_shipping_method := 'standard'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Your cart is empty';
  end if;
  v_item_count := jsonb_array_length(v_items);
  if v_item_count > 50 then raise exception 'Too many cart items'; end if;

  -- Lock and validate every SKU. Never trust browser price/stock.
  for v_item in select value from jsonb_array_elements(v_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid product';
    end;
    v_variant_id := null;
    if nullif(v_item->>'variant_id','') is not null then
      begin
        v_variant_id := (v_item->>'variant_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid product variant';
      end;
    end if;
    v_qty := coalesce((v_item->>'quantity')::integer,0);
    if v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity'; end if;

    select * into v_product from public.products
      where id=v_product_id and status='active'
      for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;

    if v_variant_id is not null then
      select * into v_variant from public.product_variants
        where id=v_variant_id and product_id=v_product_id and active=true
        for update;
      if not found then raise exception 'A selected variant is no longer available'; end if;
      if v_variant.stock < v_qty then
        raise exception 'Insufficient stock for %', v_product.name;
      end if;
      v_unit_price := coalesce(v_variant.price, v_product.sale_price, v_product.regular_price);
      v_regular_price := coalesce(v_variant.compare_at_price, v_product.regular_price, v_unit_price);
    else
      if v_product.stock < v_qty then
        raise exception 'Insufficient stock for %', v_product.name;
      end if;
      v_unit_price := coalesce(v_product.sale_price, v_product.regular_price);
      v_regular_price := coalesce(v_product.regular_price, v_unit_price);
    end if;

    if v_unit_price is null or v_unit_price < 0 then raise exception 'Invalid product price'; end if;
    v_line_total := round(v_unit_price * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- Coupon is optional and is validated server-side under a row lock.
  if v_coupon_code <> '' then
    select * into v_coupon from public.coupons
      where upper(code)=v_coupon_code and active=true
      for update;
    if not found then raise exception 'Invalid or inactive coupon'; end if;
    if v_coupon.starts_at is not null and now() < v_coupon.starts_at then raise exception 'Coupon is not active yet'; end if;
    if v_coupon.expires_at is not null and now() > v_coupon.expires_at then raise exception 'Coupon has expired'; end if;
    if v_coupon.minimum_order is not null and v_subtotal < v_coupon.minimum_order then
      raise exception 'Minimum order for this coupon is %', v_coupon.minimum_order;
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'Coupon usage limit reached';
    end if;
    if v_coupon.discount_type='percentage' then
      v_coupon_discount := round(v_subtotal * least(greatest(v_coupon.discount_value,0),100) / 100,2);
    else
      v_coupon_discount := least(greatest(v_coupon.discount_value,0), v_subtotal);
    end if;
    v_discount := v_coupon_discount;
  end if;

  -- Calculate shipping only from trusted database configuration.
  declare
    v_ship_method public.shipping_methods%rowtype;
    v_ship_rule public.shipping_rules%rowtype;
    v_free_threshold numeric(12,2);
  begin
    select * into v_ship_method from public.shipping_methods where code=v_shipping_method and active=true limit 1;
    if not found then raise exception 'Selected shipping method is unavailable'; end if;
    select * into v_ship_rule from public.shipping_rules where shipping_method_id=v_ship_method.id and active=true and lower(btrim(city))=lower(btrim(v_city)) limit 1;
    v_shipping := coalesce(v_ship_rule.cost, v_ship_method.base_cost, 0);
    v_free_threshold := coalesce(v_ship_rule.free_threshold, v_ship_method.free_threshold);
    if v_free_threshold is not null and v_subtotal >= v_free_threshold then v_shipping := 0; end if;
    v_shipping_method := v_ship_method.code;
  end;
  v_total := greatest(round(v_subtotal + v_shipping - v_discount,2),0);
  v_order_number := 'ZM-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(v_order_id::text,'-',''),1,8));

  v_address_json := jsonb_build_object(
    'full_name',v_name,'phone',v_phone,'line1',v_address,
    'city',v_city,'postal_code',nullif(v_postal,''),
    'country','Pakistan'
  );

  insert into public.orders (
    id, order_number, customer_id, status, payment_method,
    subtotal, shipping_cost, discount, total_amount,
    shipping_name, shipping_phone, shipping_address, notes,
    payment_status, currency, coupon_code, shipping_method, shipping_address_json
  ) values (
    v_order_id, v_order_number, v_customer_id, 'pending', v_payment_method,
    v_subtotal, v_shipping, v_discount, v_total,
    v_name, v_phone, v_address || case when v_city<>'' then ', '||v_city else '' end, v_notes,
    'pending','PKR',nullif(v_coupon_code,''),v_shipping_method,v_address_json
  );

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select * into v_product from public.products where id=v_product_id and status='active' for update;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants
        where id=v_variant_id and product_id=v_product_id and active=true for update;
      v_unit_price := coalesce(v_variant.price,v_product.sale_price,v_product.regular_price);
      insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total,variant_id,sku,discount,product_snapshot)
      values(v_order_id,v_product_id,v_product.name,v_unit_price,v_qty,round(v_unit_price*v_qty,2),v_variant_id,v_variant.sku,0,
        jsonb_build_object('name',v_product.name,'sku',v_variant.sku,'variant_name',v_variant.name,'attributes',v_variant.attributes,'price',v_unit_price));
      update public.product_variants set stock=stock-v_qty where id=v_variant_id;
      insert into public.inventory_transactions(product_id,variant_id,quantity_change,reason,reference_id,note,created_by)
      values(v_product_id,v_variant_id,-v_qty,'order',v_order_id,'Stock reserved by checkout',v_customer_id);
    else
      v_unit_price := coalesce(v_product.sale_price,v_product.regular_price);
      insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total,sku,discount,product_snapshot)
      values(v_order_id,v_product_id,v_product.name,v_unit_price,v_qty,round(v_unit_price*v_qty,2),v_product.sku,0,
        jsonb_build_object('name',v_product.name,'sku',v_product.sku,'price',v_unit_price));
      update public.products set stock=stock-v_qty where id=v_product_id;
      insert into public.inventory_transactions(product_id,quantity_change,reason,reference_id,note,created_by)
      values(v_product_id,-v_qty,'order',v_order_id,'Stock reserved by checkout',v_customer_id);
    end if;
  end loop;

  if v_coupon_code <> '' then
    update public.coupons set used_count=coalesce(used_count,0)+1 where id=v_coupon.id;
    insert into public.coupon_usage(coupon_id,user_id,order_id) values(v_coupon.id,v_customer_id,v_order_id);
  end if;

  insert into public.payments(order_id,provider,amount,currency,status,metadata)
  values(v_order_id,lower(replace(v_payment_method,' ', '_')),v_total,'PKR','pending',jsonb_build_object('checkout','secure-v1'));

  insert into public.order_status_history(order_id,status,note,changed_by)
  values(v_order_id,'pending','Order created through secure checkout',v_customer_id);

  return jsonb_build_object(
    'order_id',v_order_id,
    'order_number',v_order_number,
    'subtotal',v_subtotal,
    'discount',v_discount,
    'shipping',v_shipping,
    'total',v_total,
    'currency','PKR'
  );
end;
$$;

revoke all on function public.create_order_secure(jsonb) from public;
grant execute on function public.create_order_secure(jsonb) to anon, authenticated;

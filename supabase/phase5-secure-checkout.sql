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
  v_coupon_code := upper(btrim(coalesce(p_payload->>'coupon_code','')));
  v_items := p_payload->'items';

  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Please enter a valid name'; end if;
  if length(v_phone) < 7 or length(v_phone) > 30 then raise exception 'Please enter a valid phone number'; end if;
  if length(v_address) < 5 or length(v_address) > 500 then raise exception 'Please enter a valid address'; end if;
  if length(v_city) < 2 or length(v_city) > 80 then raise exception 'Please enter a valid city'; end if;
  if v_payment_method not in ('Cash on delivery','Bank transfer','JazzCash / Easypaisa') then
    raise exception 'Unsupported payment method';
  end if;
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
    'pending','PKR',nullif(v_coupon_code,''),'standard',v_address_json
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

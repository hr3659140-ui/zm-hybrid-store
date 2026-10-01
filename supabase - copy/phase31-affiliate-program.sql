-- ZM Hybrid Store V11 Phase 31 — Affiliate Program Pro
-- Run AFTER the existing Phase 30/29/28 SQL. Safe to re-run.

alter table public.orders add column if not exists affiliate_code text;
alter table public.products add column if not exists affiliate_commission_rate numeric(5,2);
alter table public.products alter column affiliate_commission_rate set default 0;
update public.products set affiliate_commission_rate=0 where affiliate_commission_rate is null;

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  affiliate_code text not null unique,
  display_name text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  total_clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  affiliate_code text not null,
  product_id uuid references public.products(id) on delete set null,
  landing_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  affiliate_code text not null,
  commission_rate numeric(5,2) not null default 0,
  sale_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected','reversed')),
  payout_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_item_id, affiliate_id)
);

create index if not exists idx_affiliates_code on public.affiliates(upper(affiliate_code));
create index if not exists idx_affiliate_clicks_affiliate on public.affiliate_clicks(affiliate_id, created_at desc);
create index if not exists idx_affiliate_commissions_affiliate on public.affiliate_commissions(affiliate_id, status, created_at desc);
create index if not exists idx_orders_affiliate_code on public.orders(upper(affiliate_code));

alter table public.affiliates enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_commissions enable row level security;

drop policy if exists affiliates_self_select on public.affiliates;
create policy affiliates_self_select on public.affiliates for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists affiliates_admin_all on public.affiliates;
create policy affiliates_admin_all on public.affiliates for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists affiliate_clicks_self_select on public.affiliate_clicks;
create policy affiliate_clicks_self_select on public.affiliate_clicks for select to authenticated using (exists(select 1 from public.affiliates a where a.id=affiliate_id and (a.user_id=auth.uid() or public.is_admin())));
drop policy if exists affiliate_clicks_admin_all on public.affiliate_clicks;
create policy affiliate_clicks_admin_all on public.affiliate_clicks for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists affiliate_commissions_self_select on public.affiliate_commissions;
create policy affiliate_commissions_self_select on public.affiliate_commissions for select to authenticated using (exists(select 1 from public.affiliates a where a.id=affiliate_id and (a.user_id=auth.uid() or public.is_admin())));
drop policy if exists affiliate_commissions_admin_all on public.affiliate_commissions;
create policy affiliate_commissions_admin_all on public.affiliate_commissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Affiliate application / code creation. A user may create only their own affiliate profile.
create or replace function public.affiliate_apply(p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_existing public.affiliates%rowtype;
  v_code text;
  v_name text:=left(btrim(coalesce(p_display_name,'')),100);
begin
  if v_uid is null then raise exception 'Please sign in first'; end if;
  select * into v_existing from public.affiliates where user_id=v_uid limit 1;
  if found then return jsonb_build_object('ok',true,'affiliate',to_jsonb(v_existing)); end if;
  v_code:='ZM'||upper(substr(replace(v_uid::text,'-',''),1,8));
  while exists(select 1 from public.affiliates where affiliate_code=v_code) loop
    v_code:='ZM'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  end loop;
  insert into public.affiliates(user_id,affiliate_code,display_name,status) values(v_uid,v_code,nullif(v_name,''),'active') returning * into v_existing;
  return jsonb_build_object('ok',true,'affiliate',to_jsonb(v_existing));
end; $$;
revoke all on function public.affiliate_apply(text) from public;
grant execute on function public.affiliate_apply(text) to authenticated;

-- Public referral click recorder. It reveals no private affiliate data.
create or replace function public.record_affiliate_click(p_code text,p_product_id uuid default null,p_landing_path text default null)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_aff public.affiliates%rowtype; v_code text:=upper(left(btrim(coalesce(p_code,'')),40));
begin
  if v_code='' then return false; end if;
  select * into v_aff from public.affiliates where upper(affiliate_code)=v_code and status='active' limit 1;
  if not found then return false; end if;
  insert into public.affiliate_clicks(affiliate_id,affiliate_code,product_id,landing_path) values(v_aff.id,v_aff.affiliate_code,p_product_id,left(coalesce(p_landing_path,''),300));
  update public.affiliates set total_clicks=total_clicks+1,updated_at=now() where id=v_aff.id;
  return true;
end; $$;
revoke all on function public.record_affiliate_click(text,uuid,text) from public;
grant execute on function public.record_affiliate_click(text,uuid,text) to anon,authenticated;

-- Replace the current secure checkout function with the same server-authoritative logic
-- plus affiliate attribution. The browser may send only the affiliate code; the server
-- validates the affiliate and stores it on the order.
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

-- Create commission rows after order items exist. One commission per order item.
create or replace function public.create_affiliate_commission_for_item()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_aff public.affiliates%rowtype;
  v_product public.products%rowtype;
  v_rate numeric(5,2);
  v_amount numeric(12,2);
begin
  select * into v_order from public.orders where id=new.order_id;
  if not found or nullif(btrim(coalesce(v_order.affiliate_code,'')),'') is null then return new; end if;
  select * into v_aff from public.affiliates where upper(affiliate_code)=upper(v_order.affiliate_code) and status='active' limit 1;
  if not found then return new; end if;
  select * into v_product from public.products where id=new.product_id;
  v_rate:=coalesce(v_product.affiliate_commission_rate,0);
  v_amount:=round(coalesce(new.line_total,0)*greatest(least(v_rate,100),0)/100,2);
  insert into public.affiliate_commissions(affiliate_id,order_id,order_item_id,product_id,affiliate_code,commission_rate,sale_amount,commission_amount,status)
  values(v_aff.id,new.order_id,new.id,new.product_id,v_aff.affiliate_code,v_rate,coalesce(new.line_total,0),v_amount,'pending')
  on conflict (order_item_id,affiliate_id) do nothing;
  return new;
end; $$;

drop trigger if exists trg_create_affiliate_commission on public.order_items;
create trigger trg_create_affiliate_commission after insert on public.order_items for each row execute function public.create_affiliate_commission_for_item();

-- Commission lifecycle follows the order lifecycle.
create or replace function public.sync_affiliate_commission_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='delivered' and coalesce(old.status,'')<>new.status then
    update public.affiliate_commissions set status='approved',updated_at=now() where order_id=new.id and status='pending';
  elsif new.status in ('cancelled','refunded','returned') and coalesce(old.status,'')<>new.status then
    update public.affiliate_commissions set status='reversed',updated_at=now() where order_id=new.id and status in ('pending','approved');
  end if;
  return new;
end; $$;

drop trigger if exists trg_sync_affiliate_commission_status on public.orders;
create trigger trg_sync_affiliate_commission_status after update of status on public.orders for each row execute function public.sync_affiliate_commission_status();

notify pgrst,'reload schema';

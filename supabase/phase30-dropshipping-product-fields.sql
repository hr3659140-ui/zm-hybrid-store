-- Phase 30 / 30.3: Dropshipping product sourcing fields + target market metadata
-- Safe to run on an existing Phase 28/29/30 database.

alter table public.products
  add column if not exists supplier_name text,
  add column if not exists supplier_url text,
  add column if not exists supplier_sku text,
  add column if not exists supplier_cost numeric(12,2),
  add column if not exists supplier_shipping_cost numeric(12,2),
  add column if not exists target_market text,
  add column if not exists fulfillment_method text,
  add column if not exists estimated_delivery text,
  add column if not exists product_source text,
  add column if not exists product_status text not null default 'research',
  add column if not exists estimated_ad_cost numeric(12,2);

-- Keep values clean without breaking existing rows.
update public.products
set product_status='research'
where product_status is null or btrim(product_status)='';

alter table public.products drop constraint if exists products_product_status_check;
alter table public.products
  add constraint products_product_status_check
  check (product_status in ('research','testing','winning','paused'));

create index if not exists idx_products_target_market on public.products(target_market);
create index if not exists idx_products_product_status on public.products(product_status);

notify pgrst, 'reload schema';

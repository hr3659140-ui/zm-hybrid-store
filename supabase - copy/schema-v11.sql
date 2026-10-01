-- ZM Hybrid Store V11 — production foundation migration
-- Run in Supabase SQL Editor AFTER backing up the existing database.
-- This migration is designed to preserve existing V10 tables/data where possible.

create extension if not exists pgcrypto;

-- =========================
-- Profiles / roles
-- =========================
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','manager','admin'));

-- =========================
-- Catalog
-- =========================
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists cost_price numeric(12,2);
alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists low_stock_threshold integer not null default 5;
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists weight_grams integer;
alter table public.products add column if not exists updated_at timestamptz not null default now();

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  name text not null,
  attributes jsonb not null default '{}'::jsonb,
  price numeric(12,2),
  compare_at_price numeric(12,2),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_product_variants_product on public.product_variants(product_id);

-- =========================
-- Addresses
-- =========================
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'Pakistan',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_addresses_user on public.addresses(user_id);

-- =========================
-- Persistent cart / wishlist
-- =========================
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  session_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, product_id, variant_id)
);
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(wishlist_id, product_id)
);

-- =========================
-- Coupons
-- =========================
create table if not exists public.coupon_usage (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid,
  used_at timestamptz not null default now()
);
create index if not exists idx_coupon_usage_coupon on public.coupon_usage(coupon_id);

-- =========================
-- Orders / payments
-- =========================
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','confirmed','processing','packed','shipped','delivered','cancelled','returned','refunded'));
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists currency text not null default 'PKR';
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists shipping_method text;
alter table public.orders add column if not exists shipping_address_json jsonb;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_history_order on public.order_status_history(order_id, created_at desc);

alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.order_items add column if not exists sku text;
alter table public.order_items add column if not exists discount numeric(12,2) not null default 0;
alter table public.order_items add column if not exists product_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PKR',
  status text not null default 'pending' check (status in ('pending','authorized','paid','failed','refunded','partially_refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_order on public.payments(order_id);

-- =========================
-- Reviews
-- =========================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, user_id, order_id)
);
create index if not exists idx_reviews_product_status on public.reviews(product_id, status);

-- =========================
-- Inventory ledger
-- =========================
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity_change integer not null,
  reason text not null,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_inventory_product on public.inventory_transactions(product_id, created_at desc);

-- =========================
-- Admin helper functions
-- =========================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','manager')); $$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- =========================
-- Auth profile trigger
-- =========================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles (id,email,role)
  values (new.id,new.email,'customer')
  on conflict (id) do update set email=excluded.email, updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =========================
-- updated_at trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;

do $$
declare r record;
begin
  for r in select table_name from information_schema.columns where table_schema='public' and column_name='updated_at' loop
    execute format('drop trigger if exists trg_updated_at on public.%I',r.table_name);
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at()',r.table_name);
  end loop;
end $$;

-- =========================
-- RLS reset for new/critical tables
-- =========================
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.coupon_usage enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.product_variants enable row level security;

-- Drop only policies with names used by this migration, making re-runs safe.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname='public' and policyname like 'v11_%' loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

-- Public catalog reads
create policy v11_products_public_select on public.products for select using(status='active' or public.is_admin());
create policy v11_categories_public_select on public.categories for select using(true);
create policy v11_brands_public_select on public.brands for select using(true);
create policy v11_product_images_public_select on public.product_images for select using(true);
create policy v11_variants_public_select on public.product_variants for select using(active=true or public.is_admin());
create policy v11_banners_public_select on public.banners for select using(active=true or public.is_admin());

-- Customer-owned data
create policy v11_profile_select on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy v11_profile_update on public.profiles for update using(id=auth.uid() or public.is_super_admin()) with check(id=auth.uid() or public.is_super_admin());

create policy v11_addresses_select on public.addresses for select using(user_id=auth.uid() or public.is_admin());
create policy v11_addresses_insert on public.addresses for insert with check(user_id=auth.uid());
create policy v11_addresses_update on public.addresses for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy v11_addresses_delete on public.addresses for delete using(user_id=auth.uid() or public.is_admin());

create policy v11_carts_owner on public.carts for all using(user_id=auth.uid() or (user_id is null and session_id is not null)) with check(user_id=auth.uid() or (user_id is null and session_id is not null));
create policy v11_cart_items_owner on public.cart_items for all using(exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid())) with check(exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid()));

create policy v11_wishlist_owner on public.wishlists for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy v11_wishlist_items_owner on public.wishlist_items for all using(exists(select 1 from public.wishlists w where w.id=wishlist_id and w.user_id=auth.uid())) with check(exists(select 1 from public.wishlists w where w.id=wishlist_id and w.user_id=auth.uid()));

create policy v11_orders_customer_select on public.orders for select using(customer_id=auth.uid() or public.is_admin());
create policy v11_order_items_customer_select on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_admin())));
create policy v11_order_history_customer_select on public.order_status_history for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_admin())));
create policy v11_payments_customer_select on public.payments for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_admin())));

create policy v11_reviews_public_select on public.reviews for select using(status='approved' or user_id=auth.uid() or public.is_admin());
create policy v11_reviews_insert on public.reviews for insert with check(user_id=auth.uid());
create policy v11_reviews_update on public.reviews for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy v11_reviews_delete on public.reviews for delete using(user_id=auth.uid() or public.is_admin());

-- Admin write access for management tables
create policy v11_admin_products on public.products for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_categories on public.categories for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_brands on public.brands for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_images on public.product_images for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_variants on public.product_variants for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_orders on public.orders for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_order_items on public.order_items for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_history on public.order_status_history for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_payments on public.payments for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_coupons on public.coupons for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_coupon_usage on public.coupon_usage for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_banners on public.banners for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_settings on public.site_settings for all using(public.is_admin()) with check(public.is_admin());
create policy v11_admin_inventory on public.inventory_transactions for all using(public.is_admin()) with check(public.is_admin());

-- Helpful indexes
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_products_status_featured on public.products(status, featured);
create index if not exists idx_orders_customer_created on public.orders(customer_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders(status, created_at desc);
create index if not exists idx_product_images_product_sort on public.product_images(product_id, sort_order);

-- Role-safe function for the logged-in user
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() limit 1; $$;
grant execute on function public.get_my_role() to authenticated;

-- NOTE: Do NOT put a service-role key in frontend code.
-- The first admin must be promoted manually after creating the Auth account:
-- update public.profiles set role='admin' where email='YOUR-ADMIN-EMAIL';

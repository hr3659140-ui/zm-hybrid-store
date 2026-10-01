-- ZM Hybrid Store database schema
create extension if not exists "pgcrypto";
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade, email text, full_name text, phone text, role text not null default 'customer' check(role in ('customer','admin')), created_at timestamptz default now());
create table if not exists public.categories(id uuid primary key default gen_random_uuid(), name text unique not null, slug text unique not null, created_at timestamptz default now());
create table if not exists public.brands(id uuid primary key default gen_random_uuid(), name text unique not null, slug text unique not null, created_at timestamptz default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text, regular_price numeric(12,2) not null, sale_price numeric(12,2), stock integer not null default 0, sku text unique, category_id uuid references public.categories(id) on delete set null, brand_id uuid references public.brands(id) on delete set null, featured boolean default false, status text not null default 'draft' check(status in ('active','draft')), seo_title text, seo_description text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.product_images(id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, image_url text not null, storage_path text, sort_order integer default 0, created_at timestamptz default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(), order_number text unique, customer_id uuid references public.profiles(id) on delete set null, status text not null default 'new' check(status in ('new','processing','shipped','delivered','cancelled')), payment_method text, subtotal numeric(12,2) default 0, shipping_cost numeric(12,2) default 0, discount numeric(12,2) default 0, total_amount numeric(12,2) default 0, shipping_name text, shipping_phone text, shipping_address text, notes text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id) on delete set null, product_name text not null, unit_price numeric(12,2) not null, quantity integer not null check(quantity>0), line_total numeric(12,2) not null);
create table if not exists public.coupons(id uuid primary key default gen_random_uuid(), code text unique not null, discount_type text not null check(discount_type in ('percentage','fixed')), discount_value numeric(12,2) not null, minimum_order numeric(12,2) default 0, usage_limit integer, used_count integer default 0, starts_at timestamptz, expires_at timestamptz, active boolean default true, created_at timestamptz default now());
create table if not exists public.banners(id uuid primary key default gen_random_uuid(), title text, subtitle text, image_url text, button_text text, button_url text, active boolean default true, sort_order integer default 0);
create table if not exists public.site_settings(key text primary key, value jsonb not null, updated_at timestamptz default now());

alter table public.profiles enable row level security; alter table public.categories enable row level security; alter table public.brands enable row level security; alter table public.products enable row level security; alter table public.product_images enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.coupons enable row level security; alter table public.banners enable row level security; alter table public.site_settings enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create policy "public read active products" on public.products for select using(status='active' or public.is_admin());
create policy "public read categories" on public.categories for select using(true); create policy "public read brands" on public.brands for select using(true); create policy "public read images" on public.product_images for select using(true); create policy "public read banners" on public.banners for select using(active=true or public.is_admin()); create policy "admin all products" on public.products for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all categories" on public.categories for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all brands" on public.brands for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all images" on public.product_images for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all orders" on public.orders for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all items" on public.order_items for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all coupons" on public.coupons for all using(public.is_admin()) with check(public.is_admin()); create policy "admin all settings" on public.site_settings for all using(public.is_admin()) with check(public.is_admin()); create policy "users own profile" on public.profiles for select using(id=auth.uid() or public.is_admin()); create policy "users update own profile" on public.profiles for update using(id=auth.uid() or public.is_admin());

-- After creating your first Auth user, run this manually:
-- insert into public.profiles(id,email,role) values ('AUTH-USER-UUID','admin@example.com','admin');

-- Automatically create a customer profile whenever a new Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'customer')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Optional helper for authenticated clients to read their own role safely.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

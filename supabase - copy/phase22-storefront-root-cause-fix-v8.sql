-- ZM Hybrid Store — Phase 22 V8 storefront public-read fix
-- Run once in Supabase SQL Editor. Safe to rerun.

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.banners enable row level security;
alter table public.site_settings enable row level security;

-- Explicit grants for the public storefront roles.
grant select on public.products to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.brands to anon, authenticated;
grant select on public.banners to anon, authenticated;
grant select on public.site_settings to anon, authenticated;

-- Public policies contain no auth-dependent helper calls.
drop policy if exists v11_products_public_select on public.products;
create policy v11_products_public_select on public.products
  for select to anon, authenticated using (status = 'active');

drop policy if exists v11_product_images_public_select on public.product_images;
create policy v11_product_images_public_select on public.product_images
  for select to anon, authenticated using (true);

drop policy if exists v11_variants_public_select on public.product_variants;
create policy v11_variants_public_select on public.product_variants
  for select to anon, authenticated using (active = true);

drop policy if exists v11_categories_public_select on public.categories;
create policy v11_categories_public_select on public.categories
  for select to anon, authenticated using (true);

drop policy if exists v11_brands_public_select on public.brands;
create policy v11_brands_public_select on public.brands
  for select to anon, authenticated using (true);

drop policy if exists v11_banners_public_select on public.banners;
create policy v11_banners_public_select on public.banners
  for select to anon, authenticated using (active = true);

drop policy if exists v11_site_settings_public_select on public.site_settings;
create policy v11_site_settings_public_select on public.site_settings
  for select to anon, authenticated using (true);

notify pgrst, 'reload schema';

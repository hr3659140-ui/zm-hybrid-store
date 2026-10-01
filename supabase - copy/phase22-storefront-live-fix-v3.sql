-- Phase 22 storefront public-read hardening
-- Run once in Supabase SQL Editor. Safe to run repeatedly.

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.banners enable row level security;

-- Public storefront policies contain no auth-dependent helper calls.
drop policy if exists v11_products_public_select on public.products;
create policy v11_products_public_select on public.products for select using (status = 'active');

drop policy if exists v11_product_images_public_select on public.product_images;
create policy v11_product_images_public_select on public.product_images for select using (true);

drop policy if exists v11_variants_public_select on public.product_variants;
create policy v11_variants_public_select on public.product_variants for select using (active = true);

drop policy if exists v11_categories_public_select on public.categories;
create policy v11_categories_public_select on public.categories for select using (true);

drop policy if exists v11_brands_public_select on public.brands;
create policy v11_brands_public_select on public.brands for select using (true);

drop policy if exists v11_banners_public_select on public.banners;
create policy v11_banners_public_select on public.banners for select using (active = true);

-- Admin policies remain separate and continue to grant admin/manager access through the existing helpers.
notify pgrst, 'reload schema';

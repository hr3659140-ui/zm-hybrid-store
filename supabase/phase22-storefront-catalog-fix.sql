-- Phase 22 storefront catalog/banner visibility fix
-- Safe to run more than once.

alter table public.banners enable row level security;

drop policy if exists v11_banners_public_select on public.banners;
create policy v11_banners_public_select
on public.banners
for select
using (active = true or public.is_admin());

-- Ensure public storefront reads remain available for active catalog records.
drop policy if exists v11_products_public_select on public.products;
create policy v11_products_public_select
on public.products
for select
using (status = 'active' or public.is_admin());

drop policy if exists v11_product_images_public_select on public.product_images;
create policy v11_product_images_public_select
on public.product_images
for select
using (true);

drop policy if exists v11_variants_public_select on public.product_variants;
create policy v11_variants_public_select
on public.product_variants
for select
using (active = true or public.is_admin());

notify pgrst, 'reload schema';

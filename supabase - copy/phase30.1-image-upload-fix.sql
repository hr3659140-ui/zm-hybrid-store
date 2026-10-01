-- ZM Hybrid Store — Phase 30.1 image upload repair
-- Run in Supabase SQL Editor if Storage upload still reports a policy/bucket error.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "v11_product_images_public_read" on storage.objects;
drop policy if exists "v11_product_images_admin_insert" on storage.objects;
drop policy if exists "v11_product_images_admin_update" on storage.objects;
drop policy if exists "v11_product_images_admin_delete" on storage.objects;

drop policy if exists "v11_product_images_public_select" on storage.objects;
drop policy if exists "v11_product_images_authenticated_insert" on storage.objects;
drop policy if exists "v11_product_images_authenticated_update" on storage.objects;
drop policy if exists "v11_product_images_authenticated_delete" on storage.objects;

create policy "v11_product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "v11_product_images_admin_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

create policy "v11_product_images_admin_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

create policy "v11_product_images_admin_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_admin());

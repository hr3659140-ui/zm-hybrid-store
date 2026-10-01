-- ZM Hybrid Store V11 Phase 2 — product image storage
-- Run once in Supabase SQL Editor after schema-v11.sql.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

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

# ZM Hybrid Store — Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication, create your admin email/password user.
4. In SQL Editor insert/update that user's `profiles.role` to `admin`.
5. Copy Project URL and anon public key into:
   - `script.js` → `SUPABASE_CONFIG`
   - `admin/admin.js` → `SUPABASE_URL` and `SUPABASE_ANON_KEY`
6. Deploy the updated repository to GitHub/Netlify.
7. Login at `/admin/` and add products.

For product images, create a Supabase Storage bucket named `product-images`, upload files, then save the public URL into `product_images`. The included admin dashboard is ready for product CRUD; image upload UI can be connected to the bucket in the next iteration.


## Admin login emergency fix
The admin page now uses the deployed `admin-gateway` Edge Function instead of the slow Supabase password-token endpoint. Admin login now authenticates the configured Supabase Auth user and verifies the `admin` role in `public.profiles`.

# ZM Hybrid Store V11 — Phase 2

## What changed
- Admin authentication now checks the Supabase `profiles.role` instead of a hard-coded email.
- Supports `admin` and `manager` roles.
- Product CRUD is connected to Supabase.
- Product editor supports pricing, stock, SEO, tags, featured state and category/brand.
- Product variants can be created, edited and removed.
- Product images can be uploaded to Supabase Storage and linked to `product_images`.
- Inventory stock adjustments create ledger records.
- Categories can be managed.
- Orders can be viewed and their status changed; status history is recorded.
- Customer list is database-backed.

## Required Supabase step
Run `supabase/phase2-storage.sql` once in SQL Editor. It creates the public `product-images` bucket and admin-only write/delete policies.

## First admin
The Auth user must have `profiles.role = 'admin'` or `manager`. Example (replace the email):

update public.profiles set role='admin' where email='YOUR-ADMIN-EMAIL';

Do not put service-role keys in the frontend.

## Test checklist
1. Login with a profile whose role is `admin` or `manager`.
2. Open Products.
3. Add a product.
4. Edit it and add variants.
5. Upload one JPG/PNG/WebP image.
6. Change stock and confirm an `inventory_transactions` row exists.
7. Delete an image and verify it disappears.
8. Open Orders and change an order status; verify `order_status_history`.
9. Confirm changes are visible in the storefront after its database integration is updated.

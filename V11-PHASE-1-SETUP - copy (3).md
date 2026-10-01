# V11 Phase 1 — Foundation Setup

## Do this now
1. Back up the existing Supabase database.
2. Open Supabase → SQL Editor.
3. Run `supabase/schema-v11.sql`.
4. Create/login the intended admin Auth user.
5. Promote that user with:
   `update public.profiles set role='admin' where email='YOUR-ADMIN-EMAIL';`
6. Verify the profile role before testing `/admin/`.

## Do NOT do
- Do not paste the service-role key into `script.js` or `admin.js`.
- Do not delete the existing V10 tables before migration is verified.
- Do not enter payment secrets into source files.

## Phase 1 acceptance test
- New customer registration creates `profiles` row with role `customer`.
- Admin profile has role `admin`.
- Customer cannot read another customer's addresses/orders.
- Public visitors can read active products/categories/brands/images.
- Admin can manage catalog tables.
- Product variants, carts, wishlists, reviews, payments, inventory ledger and order history tables exist.

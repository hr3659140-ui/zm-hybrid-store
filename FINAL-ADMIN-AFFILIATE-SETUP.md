# ZM Hybrid Store — Final Admin + Affiliate Repair

This build keeps the V12 storefront/redesign and existing ecommerce functionality, while repairing the Admin and Affiliate layers.

## 1. Supabase — one SQL file

Open **Supabase → SQL Editor → New query** and run:

`supabase/FINAL-ADMIN-AFFILIATE-REPAIR.sql`

This repair:
- repairs the Auth → profiles trigger;
- adds `ensure_my_profile()` for safe profile recovery;
- restores `admin` / `manager` role checks;
- promotes the project-configured admin email to `admin`;
- installs/repairs affiliate accounts, clicks, commissions;
- installs/repairs affiliate payout currencies, methods and withdrawal requests;
- reloads the PostgREST schema cache.

If your real admin email is different from the project-configured one, change the marked email line in the SQL before running it.

## 2. Cloudflare

Deploy the ZIP to **Cloudflare Pages → Production**. Do not use Preview.

## 3. Admin test

Open `/admin/` and sign in with the same Supabase Auth account whose email is configured as the admin account. The panel should load the Dashboard instead of returning a role/authorization failure.

## 4. Affiliate test

Open `/affiliate/` → Join Affiliate Program → sign in → the portal creates an active affiliate profile.

Then:
1. Browse products.
2. Click **Get Affiliate Link**.
3. The generated URL uses the real static product route: `/product/<slug>/?ref=AFFILIATE_CODE`.
4. Open that link and place a test order.
5. The order stores the affiliate code and delivered orders create commission rows.
6. Affiliate dashboard can request a payout after the configured minimum.
7. Admin → Affiliates can activate/suspend affiliates, review commissions and process payouts.

## 5. Important

Do not put a Supabase service-role key in frontend files. The frontend uses only the publishable key.

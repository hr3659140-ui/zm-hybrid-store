# ZM Hybrid Store — Phase 31 Affiliate Program Pro

## What this adds
- Dedicated `/affiliate/` Affiliate Portal.
- Affiliate signup/login using Supabase Auth.
- Automatic unique Affiliate ID.
- Product marketplace inside the portal.
- Every product has its own **Get Affiliate Link** button.
- Generated link format: `/product/<slug>?ref=<AFFILIATE_CODE>`.
- 30-day referral attribution stored in the browser.
- Referral clicks recorded in Supabase.
- Checkout sends the affiliate code to the secure order function.
- Server validates the affiliate and stores attribution on the order.
- Commission rows are generated per order item.
- Default affiliate commission is 10%; admin can override a product with its own commission rate.
- Pending → approved when order becomes Delivered.
- Cancelled/refunded/returned orders reverse pending/approved commissions.
- Admin → Affiliates management and manual payout marking.
- Existing storefront, products, dropshipping fields, currency system, checkout and admin features are preserved.

## Supabase
Run `supabase/phase31-affiliate-program.sql` in the Supabase SQL Editor after the existing project SQL. It is designed to be re-runnable.

## Cloudflare
Deploy this package directly to **Production**. Do not use Preview.

## Affiliate workflow
Affiliate Portal → Join → Affiliate ID → Products → Get Affiliate Link → share → customer visits product → referral stored → customer orders → commission pending → Delivered → commission approved → Admin marks Paid.

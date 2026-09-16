# Phase 31.2 — Affiliate Product Link / Direct Open Fix

Fixes affiliate product links so they open the real storefront product route using the existing `/product?id=<PRODUCT_ID>&ref=<AFFILIATE_CODE>` route.

Changes:
- Product-specific affiliate links no longer depend on `/product/<slug>/` direct-route handling.
- Referral code is preserved in the URL and stored for checkout attribution.
- Affiliate click recording now includes the product UUID when the link contains `id` or `product_id`.
- Existing Phase 31.1 Affiliate Portal, currency selector, dropshipping fields, image upload fix, and slug fix are preserved.

Deploy this ZIP to Cloudflare Pages **Production**.
No new Supabase SQL is required for this code-only routing/attribution fix if Phase 31 SQL is already installed.

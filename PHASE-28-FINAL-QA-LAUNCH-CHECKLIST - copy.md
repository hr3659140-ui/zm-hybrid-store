# ZM Hybrid Store — Phase 28 Final Production QA & Launch Hardening

## Deployment
- Deploy this ZIP directly to Cloudflare Pages Production.
- Confirm the production hostname is `https://zm-hybrid-store.pages.dev`.
- Do not use a preview deployment for the final launch.
- Confirm the deployed commit/version is the intended Phase 28 build.

## Storefront smoke test
1. Home loads after a hard refresh.
2. Hero/CMS content loads.
3. Product slider loads using real Supabase products/images when enabled.
4. Catalog/search/category/brand filters work.
5. Product detail loads images, variants, price and stock.
6. Add-to-cart validates available stock.
7. Cart quantity updates correctly.
8. Coupon validation rejects invalid/minimum-order failures without stale discounts.
9. Shipping method and shipping cost calculate correctly.
10. COD checkout places an order successfully.
11. Bank Transfer/JazzCash/Easypaisa reference flow stores the reference.
12. Order confirmation/order detail does not become blank after placement.
13. Guest Track Order works with order number + phone.
14. Customer login/register/account/orders/wishlist work.
15. Reviews only allow the intended delivered-order flow.
16. Return request flow works for eligible orders.
17. In-app customer notifications appear and can be marked read.
18. AI storefront assistant responds when its Edge Function/OpenAI configuration is healthy.

## Admin smoke test
1. Admin login works after refresh/session expiry.
2. Manager permissions are restricted appropriately.
3. Dashboard metrics load.
4. Products CRUD, variants, images and inventory adjustments work.
5. Orders/status history work through delivered/cancelled/returned/refunded states.
6. Payment status and paid_at update correctly.
7. Coupons CRUD and validation work.
8. Shipping methods/rules work.
9. CMS/banner/product slider settings work.
10. Reviews moderation works.
11. Returns & Refunds works.
12. Customer Notifications works.
13. Analytics/export works.
14. Customer Communication/WhatsApp-ready messaging works.
15. SEO & Marketing settings work.
16. Admin Settings/Security/Audit Log works.

## Security checks
- Never place Supabase service-role, OpenAI, Meta/WhatsApp or other private secrets in frontend files.
- Confirm Edge Function secrets exist only in Supabase secrets.
- Confirm public catalog data is readable only as intended by RLS/public policies.
- Confirm customers cannot read another customer's orders, addresses, payments, returns or notifications.
- Confirm admin/manager-only operations remain protected by role checks.
- Confirm no test credentials, tokens, PINs or payment-card data are committed to the site.
- Confirm `_headers` is deployed and security headers are present.

## SEO/launch checks
- `robots.txt` is reachable.
- `sitemap.xml` is reachable and uses the production hostname.
- Canonical/OG metadata uses production URLs.
- No admin/account/checkout/order pages are intended for indexing.
- Test one product URL and one category/search URL for metadata.

## Performance/mobile
- Test Chrome desktop and a mobile viewport.
- Check console for unexpected red errors.
- Check Network for failed JS/CSS/API requests.
- Confirm images are lazy-loaded where appropriate.
- Confirm no route renders a permanently blank `#app`.

## Launch acceptance
A release is accepted only when the complete smoke test passes on the production hostname and there are no blocking console/network errors.

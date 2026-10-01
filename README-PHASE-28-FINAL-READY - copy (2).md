# ZM Hybrid Store — Phase 28 Final Ready

This package combines the production QA/launch hardening with the latest Hero V5 work and a stronger poster-guard cutout pass.

## Production deployment
- Deploy the ZIP root directly to Cloudflare Pages Production.
- Do not use Preview.
- Existing Supabase SQL is unchanged in this package.

## Final QA
- Mobile responsive storefront
- Login/Register
- Product/catalog/PDP
- Cart/secure checkout
- Orders/status/payment status
- Coupons
- Shipping/delivery
- Returns/refunds
- Notifications
- SEO/robots/sitemap
- Admin session/security/audit
- Hero carousel and mobile hero

## Hero
Hero slides can be managed from Admin → Website CMS → Hero Product Carousel.
Use a transparent PNG/WebP product image URL override when a source image is a complex advertisement/poster. The browser cutout pass now removes light backgrounds and suppresses disconnected poster fragments where possible.

## Payments
COD, Bank Transfer, JazzCash and Easypaisa remain available in manual/reference mode. Live JazzCash/Easypaisa API processing must be enabled only after merchant onboarding and provider credentials/API configuration are available; no payment secret belongs in frontend code.

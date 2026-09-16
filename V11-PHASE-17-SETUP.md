# V11 Phase 17 — Production Hardening & Reliability

This phase is built from the Phase 16 V3 production project.

## Included
- Cloudflare `_headers` security policy and browser hardening headers.
- Admin session refresh using the Supabase refresh token instead of forcing a logout every hour.
- Automatic admin token refresh every 10 minutes while a refresh token exists.
- Admin REST requests retry once after a 401 using a refreshed session.
- Admin JS cache-bust for the Phase 17 build.
- Removed the unused preview HTML artifact from the production root.

## Deployment
Upload the ZIP root directly to the existing Cloudflare Pages project `zm-hybrid-store` as a **Production** deployment. Do not use Preview.

## Supabase
No new SQL is required for Phase 17.

## Important
The live JazzCash/Easypaisa gateway is still not connected. Payment references remain manual verification fields until merchant API credentials/documentation are available.

# Admin + Affiliate Routing Fix

This build fixes the Cloudflare Pages entry-point problem where `/admin/` and `/affiliate/` could resolve to the storefront instead of their own applications.

Changes:
- Explicit Cloudflare Pages redirects for `/admin`, `/admin/`, `/affiliate`, `/affiliate/`.
- Admin and Affiliate CSS/JS use absolute paths.
- Existing Supabase/Admin/Affiliate code is preserved.

Deploy this ZIP as a new **Production** deployment.
After deployment test:
- `/admin/`
- `/affiliate/`
- `/admin/index.html`
- `/affiliate/index.html`

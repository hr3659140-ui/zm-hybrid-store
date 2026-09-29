# ZM Hybrid Store — Admin/Affiliate Routing Final Fix V2

## Root cause
The storefront SPA can become the fallback document for `/admin/` and `/affiliate/` on a static Pages deployment. That made the storefront render instead of the dedicated applications.

## Fix
- Added an early route guard in the root storefront document that immediately redirects `/admin` to `/admin/index.html` and `/affiliate` to `/affiliate/index.html`.
- Added explicit Cloudflare Pages `_redirects` rules for the two application entry points and their child paths.
- Existing dedicated admin and affiliate documents/assets remain intact.

## Deployment
Deploy the ZIP to Cloudflare Pages Production. After deployment, test:
- `/admin/`
- `/admin/index.html`
- `/affiliate/`
- `/affiliate/index.html`

If a deployment-specific URL is being used, use the URL belonging to the newly created Production deployment.

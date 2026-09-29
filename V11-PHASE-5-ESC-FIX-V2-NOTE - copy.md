# Phase 5 ESC Fix V2

This build fixes the checkout success-screen `esc is not defined` issue defensively:
- `esc()` is explicitly exposed as `window.esc`.
- Checkout success rendering uses `window.esc(...)`.
- All storefront `script.js` references use a cache-busting query string so Cloudflare/browser caches cannot keep the older script.

Deploy this ZIP as a new Cloudflare Pages production deployment.
Do not place the ZIP inside an outer project folder; its `index.html` is already at the ZIP root.

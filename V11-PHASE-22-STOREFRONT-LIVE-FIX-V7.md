# Phase 22 V7 — Storefront Root Cause Fix

This release fixes the storefront failures caused by two production issues:
1. Cloudflare CSP blocked the Supabase JS CDN (`cdn.jsdelivr.net`), so `window.supabase` never loaded.
2. The SPA root index used relative `style.css`/`script.js` paths, which break on `/checkout/`, `/cart/`, `/product/.../`, etc.

Changes:
- Allow `https://cdn.jsdelivr.net` in `script-src`.
- Use absolute `/style.css` and `/script.js` asset paths.
- Cache-bust assets with `20260908-v7`.
- Preserve V6 public Supabase/catalog/CMS fixes.

No new SQL is required if Phase 22 V4 SQL was already run.

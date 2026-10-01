# Phase 22 Storefront Live Fix V3

1. Run `supabase/phase22-storefront-live-fix-v3.sql` in Supabase SQL Editor.
2. Deploy this ZIP directly to Cloudflare Production.
3. Hard refresh with Ctrl+Shift+R.

This version isolates products/images/variants/categories/brands queries, removes auth-dependent public RLS helper calls, and renders CMS banners as a carousel immediately after the hero.

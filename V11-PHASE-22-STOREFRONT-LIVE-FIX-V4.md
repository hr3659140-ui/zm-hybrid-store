# Phase 22 V4 — Storefront Live Catalog/CMS Fix

1. Run `supabase/phase22-storefront-live-fix-v4.sql` in Supabase SQL Editor.
2. Deploy this ZIP directly to Cloudflare Pages **Production**.
3. Hard refresh the storefront with Ctrl+Shift+R.

This version uses a separate anonymous Supabase client for public catalog/CMS/shipping reads so an existing stale/future auth JWT cannot break storefront data. It also removes embedded category/brand relationship queries and never silently presents the bundled demo catalog as live inventory.

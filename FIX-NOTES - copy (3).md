# ZM Hybrid Store V12 — Admin + Affiliate Fix

## Verified (against your live Supabase project iqgoclijgicgzncrjqqt)
- All 25 RPC functions used by the site exist in the DB.
- All tables, RLS policies and edge functions (create-order, ai-store-agent, admin-gateway) are present.
- Admin (hr3659140@gmail.com, role=admin) passes RLS on every table the admin panel reads.
- Affiliate signup / balance / payout methods work for a normal customer.
- Admin panel: all 20 tabs load without JS errors.

## Changes in this zip
1. admin/index.html, admin/update-password/index.html, affiliate/index.html copied exactly from V11 (zip 1).
2. GA4 restored (was removed in V12): tag on all pages, GA_MEASUREMENT_ID, add_to_cart, begin_checkout, full purchase items.
3. Cache-busting (?v=) on admin.js/css, importer and affiliate.js/css.
4. _headers: no-cache for /admin/* and /affiliate/* so an old cached copy is never served.
Velora fashion design untouched.

## After deploying
Hard refresh (Ctrl+Shift+R) on /admin/ and /affiliate/, or open in an Incognito window.

## /admin/ showing the store home page (broken giant icons)
That means the admin/ and affiliate/ folders were NOT uploaded to Cloudflare Pages (it falls back to index.html).
Check: open https://YOUR-SITE/admin/admin.js — if you see JavaScript code the files exist; if you see store HTML they are missing.
Fix: re-deploy the whole folder (drag & drop the extracted folder, or push all files to GitHub — the GitHub web uploader is limited to 100 files per upload).

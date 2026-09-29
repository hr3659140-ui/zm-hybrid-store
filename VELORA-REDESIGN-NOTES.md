# ZM Hybrid Store redesign (reference clone)

Changed files: index.html (top bar, header, newsletter, footer), script.js (viewHome, productCard, nav selectors),
new velora.css, new assets/velora/*.jpg.
Untouched: Supabase, cart, checkout, admin, affiliate, SQL.

Edit later:
- Hero / banner photos: replace assets/velora/hero.jpg, banner-*.jpg, quote-model.jpg with high-res photos (same file names).
- Footer address / phone / email: index.html, section "FOOTER".
- Men / Women menu links search products by keyword until you create those categories in admin.
- Brand name text "ZM Hybrid Store": index.html and viewHome() in script.js.
Deploy: upload this whole folder to Cloudflare Pages as before.

## V12.1 fixes
- Footer/header "Affiliate Portal" link opened the store's "Page not found" (SPA router). Now a normal link to /affiliate/.
- Footer "Track Order" pointed to /track/ (404). Now /track-order/.
- Admin (/admin/) and Affiliate (/affiliate/) code is unchanged from your original and tested: all 19 admin tabs and the affiliate login / link generation work with a mocked Supabase.
- If login still fails, the cause is on the Supabase side (see checklist in chat): admin role in `profiles`, SQL phases run, email confirmation.

## V12.2
- supabase-js is now bundled locally (/vendor/supabase.js) instead of loading from cdn.jsdelivr.net (blocked on some networks/ISPs). Used by the store and the affiliate portal.
- New /check.html: opens a plain page that tests CSS/JS files and Supabase reachability.

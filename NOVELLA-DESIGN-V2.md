# Design V2 (Novella-style) — what changed
- index.html + all subpages: new top bar, header, nav ("Categories, New Arrivals, Top Deals…"), footer
- design-v2.css (NEW): all new styling, loaded after style.css
- script.js: viewHome() and productCard() rewritten (Supabase / cart / wishlist / checkout logic untouched)
- assets/novella/*.jpg (NEW): hero/promo/category images cropped from the mockup — replace with your own product photos
- Brand name/logo: edit "ZM HYBRID" in index.html (.brand__name) if you want a different name
Deploy: upload the ZIP root to Cloudflare Pages Production as before. No SQL changes.

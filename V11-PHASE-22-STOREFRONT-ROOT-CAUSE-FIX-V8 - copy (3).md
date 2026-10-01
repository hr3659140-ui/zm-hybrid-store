# ZM Hybrid Store — Phase 22 V8 Storefront Root-Cause Fix

## What this fixes
- Real Supabase products no longer disappear if images, variants, categories or brands have a separate read problem.
- Active products are loaded first; related data is optional.
- Product images are loaded from `product_images` and used on real product cards.
- CMS banners are loaded independently and displayed after the hero.
- CMS product slider uses the same real Supabase products and supports left/right scrolling.
- A stale authenticated/future JWT cannot break public storefront reads because public reads use direct anonymous REST requests.
- Shipping/CMS failures no longer block the catalog.

## Required order
1. Run `supabase/phase22-storefront-root-cause-fix-v8.sql` in Supabase SQL Editor.
2. Deploy this ZIP directly to Cloudflare Pages **Production**.
3. Open the main production URL in an Incognito window and hard refresh.
4. Verify: Hero → CMS Banner Slider → Product Slider → Trending Categories → products.

No service-role key is included in the browser.

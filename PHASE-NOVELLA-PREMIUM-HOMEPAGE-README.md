# ZM Hybrid Store — Premium Novella-Inspired Homepage Build

This production build keeps the existing ZM Hybrid Store storefront, cart, wishlist, account, checkout, Supabase catalog, admin, AliExpress importer files, GA4 configuration and existing routes intact while replacing the homepage presentation with a premium marketplace layout inspired by the supplied reference.

## Homepage sections
- Black announcement bar
- Premium ZM header with search, account, wishlist and cart
- Category navigation
- Large lifestyle hero banner
- Shop by Category circular image tiles
- Three promotional cards
- Trending Now product rail
- Service/benefits strip
- Recommended for You product rail
- Newsletter / Stay in the Loop section
- Dark multi-column footer

## SEO carried forward/fixed
- 29 public indexable URLs in `sitemap.xml`
- `robots.txt` advertises the XML sitemap
- Public HTML canonical URLs point to their own absolute URL
- `og:url` added/updated on public pages
- Private customer/admin routes remain excluded from the sitemap and robots crawl

## Deployment
Deploy this ZIP to **Cloudflare Pages → Production**. Do not use Preview for the production deployment.

After deployment, open:
`https://zm-hybrid-store.pages.dev/sitemap.xml`

Then submit `sitemap.xml` in Google Search Console if needed.

# ZM Hybrid Store — SEO Fix Pack

Updated 2026-09-29.

## Fixed
- Correct page-specific canonical URLs instead of every page canonicalizing to `/`.
- Added page-specific meta descriptions, keywords, Open Graph URL/title/description, Twitter metadata.
- Added a crawlable homepage H1 and supporting SEO copy.
- Added supporting semantic content to product/category/support pages.
- Added static JSON-LD Organization + WebSite schema to the homepage.
- Added Product JSON-LD to product pages and CollectionPage JSON-LD to category pages.
- Kept clean SEO URLs (`/product/.../`, `/category/.../`, `/policy/.../`).
- Updated robots.txt to reference the XML sitemap.
- Added sitemap crawl hints (change frequency and priority).
- Added readable fallback SEO content for pages when JavaScript is unavailable.

## Deployment
Upload/deploy the full ZIP contents, including all folders. After deployment, purge the CDN/cache if applicable and test:
- `/`
- `/catalog/`
- `/category/watches/`
- `/product/chrono-classic-steel-watch-men/`
- `/sitemap.xml`
- `/robots.txt`

The canonical base remains `https://zm-hybrid-store.pages.dev/`, matching the SEO audit host used for this project. If you later attach a custom domain, update the canonical/sitemap base to that production domain.

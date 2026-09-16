# ZM Hybrid Store — Launch Setup (Pakistan)

This package is prepared for a Pakistan-first dropshipping/COD launch.

## Already configured in this package
- Store WhatsApp: **+92 307 3659140**
- Pakistan as checkout country in the secure order function
- PKR as the checkout currency
- COD + Bank Transfer + JazzCash/Easypaisa manual payment options
- Standard delivery: Rs. 250, free from Rs. 5,000
- Express delivery: Rs. 450, free from Rs. 8,000
- Supplier/dropshipping fields and AliExpress importer are included
- GA4 Measurement ID already present: `G-94TKM8BY1X`
- Secure server-side order function URL is already referenced by the storefront

## What cannot be completed from the ZIP alone
These require access to your own accounts and/or secrets and must be done by you:
1. Supabase SQL migrations must be run in your Supabase project.
2. Required Supabase Edge Functions must be deployed.
3. Your Supabase Auth admin user must be created and given the admin role.
4. GitHub/Cloudflare authorization must be approved in your own accounts.
5. A real courier account and supplier account must be connected/used.
6. JazzCash/Easypaisa online gateway APIs require merchant credentials; the current store supports manual payment/reference confirmation.
7. A Google Sheets webhook is optional and intentionally left blank until you provide/create one.

## Cloudflare Pages
Recommended deployment method: connect this repository to GitHub, then connect GitHub to Cloudflare Pages.
- Production branch: `main`
- For a plain static site, leave Build command blank (or use `exit 0`)
- Build output directory: the repository root (`/`)
- Make sure the deployed root contains `index.html`

## Supabase migration order
Run the SQL files in the order required by their phase numbers. At minimum for a fresh project, start with:
1. `supabase/schema.sql` or the project's documented base schema
2. `supabase/schema-v11.sql`
3. Phase SQL files referenced by `LAUNCH-READINESS.md`
4. `supabase/phase15-shipping-delivery.sql`
5. `supabase/phase30-dropshipping-product-fields.sql`
6. Payment/order Edge Functions referenced by the setup docs

Do not paste a Supabase **service-role/secret** key into `script.js` or any browser file. Only a publishable/anon key belongs in the browser.

## Admin
Create the owner account in Supabase Authentication, then assign the `admin` role as described in `SUPABASE-SETUP.md`.

## Supplier workflow
1. Research a product on AliExpress.
2. Use the included ZM AliExpress importer/extension to create a draft.
3. In Admin, fill supplier cost, shipping cost, supplier URL/SKU, target market, fulfillment method and delivery estimate.
4. Set the retail price only after calculating supplier cost + shipping + expected returns/ads + desired margin.
5. Publish only after checking images, claims, delivery time and stock.
6. When an order arrives, place the supplier order using the customer's delivery details and then save the courier/tracking information in Admin.

## Important before advertising
- Replace demo/category artwork with genuine product photos.
- Verify every product's supplier stock and delivery estimate.
- Do not claim "original" or "100% genuine" unless you can substantiate it.
- Test one real COD order end-to-end before spending on ads.
- Test checkout on mobile and desktop.

## Current package status
**Code/configuration:** prepared for Pakistan + WhatsApp support.
**Account integrations:** require your authorization/credentials.
**Supplier fulfillment:** not automatically placed by the ZIP; supplier account/API integration is a separate credentialed step.

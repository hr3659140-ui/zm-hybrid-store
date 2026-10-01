# Phase 30.3 — Dropshipping Fields Restored + Multi-Market Currency Display

## Admin → Products
Restores the dropshipping/product-research fields:
- Supplier
- Supplier URL
- Supplier SKU
- Supplier Cost
- Shipping Cost
- Target Country
- Fulfillment Method
- Estimated Delivery
- Product Source
- Product Status: Research / Testing / Winning / Paused
- Estimated Ad Cost
- Live estimated-profit calculator

## Storefront currency
Adds a market selector to the storefront header. The customer can choose:
- Pakistan — PKR
- United Arab Emirates — AED
- Saudi Arabia — SAR
- United Kingdom — GBP
- United States — USD
- European Union — EUR
- Qatar — QAR
- Kuwait — KWD

Product, cart, shipping, coupon and checkout display values use the selected market currency while the database's existing product prices remain PKR base prices.

The built-in conversion table is intentionally separated in `script.js` so rates can later be replaced with a live FX service without changing product prices.

## Required Supabase step
Run:
`supabase/phase30-dropshipping-product-fields.sql`

Then deploy the ZIP to Cloudflare **Production**.

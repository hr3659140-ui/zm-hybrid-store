# ZM Hybrid Store V11 — Phase 3

## What changed
- Customer storefront now reads active products, categories, brands, images and active variants from Supabase.
- Product cards/detail views can use real Supabase product images.
- Stock is checked before adding items to cart.
- Nested product/category pages now load the root CSS/JS correctly in Cloudflare static hosting.
- Existing local cart/wishlist fallback remains for guest browsing.

## No new SQL
Phase 1 and Phase 2 SQL already created the required tables and storage bucket. No additional SQL is required for this phase.

## Test
1. Deploy this package to the same Cloudflare site (replace the old static files).
2. Open the storefront.
3. In Admin > Products, create or edit an ACTIVE product with stock and an image.
4. Refresh the storefront and open Catalog. The product should appear from Supabase.
5. Open the product and verify its image/price/stock.
6. Try Add to Cart with stock=0; it must refuse.

## Important
Checkout is not yet converted to a secure server-side order transaction in Phase 3. The current checkout remains the existing WhatsApp/manual flow. Phase 4 will implement authenticated checkout, server-side price/stock validation, order creation, inventory deduction and payment/webhook architecture.

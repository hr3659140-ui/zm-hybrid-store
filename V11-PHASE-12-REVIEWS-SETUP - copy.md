# V11 Phase 12 — Verified Reviews

## Supabase
Run `supabase/phase12-reviews.sql` once in the Supabase SQL Editor.

This phase adds secure review submission for signed-in customers who have a delivered order containing the product. New reviews start as `pending` and must be approved in Admin → Reviews before appearing publicly.

## Cloudflare Pages
Upload the root contents of this ZIP directly as the production deployment. No preview deployment is required.

## Test
1. Deploy production.
2. Open a product page and confirm the Customer reviews section appears.
3. A customer without a delivered order should receive the verified-purchase restriction.
4. For a delivered customer account, submit a review.
5. In Admin → Reviews, approve it.
6. Refresh the product page and confirm it appears publicly.

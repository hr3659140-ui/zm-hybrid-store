# V11 Phase 9 — Orders + Payments Pro

## 1. Supabase SQL
Run `supabase/phase9-orders-payments.sql` once in Supabase SQL Editor.

This migration is non-destructive and adds courier/tracking fields plus a secure guest order lookup RPC.

## 2. Cloudflare
Upload this ZIP as a new deployment to the existing `zm-hybrid-store` Pages project. No build command is required.

## 3. Test
- Customer: `/account/` — create/sign in, then view My Orders.
- Guest: `/track-order/` — order number + phone.
- Order detail: verify status timeline, payment status, items and tracking.
- Admin: Orders → update status/payment → View → save courier/tracking.

## 4. Payment note
This phase improves payment/order workflow and tracking. It does NOT claim live JazzCash, Easypaisa, card or bank API processing. Manual/COD payment methods remain until merchant gateway credentials and provider APIs are configured.

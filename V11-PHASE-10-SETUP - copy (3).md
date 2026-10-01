# ZM Hybrid Store — Phase 10 Setup

## What changed
- Coupon code UI added to Cart and Checkout.
- Server-side coupon validation endpoint added through Supabase RPC.
- Checkout summary now shows coupon discount and final total.
- Variant-aware item pricing is shown in checkout.
- Final order creation remains authoritative through the existing secure checkout Edge Function/RPC.
- No service-role key is exposed in the storefront.

## Supabase SQL — run once
Open Supabase → SQL Editor and run:

`supabase/phase10-coupon-validation.sql`

Expected result: `Success. No rows returned`.

## Cloudflare
Upload the Phase 10 ZIP directly to the `zm-hybrid-store` Pages project as a **Production** deployment. Do not use Preview for the live test.

## Test plan
1. Open Cart with subtotal below Rs. 1,000 and apply `WELCOME10` → it should reject with the minimum-order message.
2. Increase cart subtotal to Rs. 1,000 or more and apply `WELCOME10` → it should show 10% discount.
3. Proceed to Checkout → coupon and discounted total should remain visible.
4. Place a test order → the existing secure checkout server re-validates the coupon before creating the order.
5. In Supabase, verify the order has `coupon_code`, `discount`, and the coupon `used_count` increases by 1.

## Important
The coupon UI is convenience/preview validation only. The secure checkout RPC remains the source of truth for price, stock, coupon validity, discount, and final total.

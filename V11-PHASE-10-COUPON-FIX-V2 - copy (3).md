# ZM Hybrid Store — Phase 10 Coupon Fix V2

Production fix for coupon minimum-order handling.

## Fixed
- If a coupon minimum order is not met, the coupon is removed from the active checkout state and the totals immediately re-render.
- Cart quantity changes now clear the coupon and immediately refresh totals.
- Coupon discount calculation also refuses to calculate a discount when the current subtotal is below the coupon minimum, preventing stale UI/state discounts.
- Existing server-side `validate_coupon_public` and secure order validation remain authoritative.

## Deploy
Upload this ZIP directly to the Cloudflare Pages **Production** deployment. Do not use Preview.

## Test
1. Cart subtotal below Rs. 1,000.
2. Enter `WELCOME10` and Apply.
3. Expected: error "Minimum order for this coupon is Rs. 1,000.00." and **no discount**; total remains the subtotal.
4. Raise subtotal to Rs. 1,000+ and apply again.
5. Expected: 10% discount.

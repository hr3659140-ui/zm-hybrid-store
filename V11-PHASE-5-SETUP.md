# ZM Hybrid Store V11 — Phase 5 Secure Checkout

## What this phase adds
- Secure server-side order creation for Cash on Delivery / manual payment methods.
- Browser no longer decides product price, stock, subtotal or total.
- Server validates active products and variants.
- Stock is decremented inside one database transaction.
- Inventory ledger entry is created for each sold SKU/variant.
- Order, order items, payment record and order-status history are created.
- Optional coupon validation and usage counting are server-side.
- Existing WhatsApp confirmation remains optional after the database order is created.

## 1. Run SQL in Supabase
Open SQL Editor and run:
`supabase/phase5-secure-checkout.sql`

Do not drop or recreate existing tables.

## 2. Deploy the Edge Function
The function is:
`supabase/functions/create-order/index.ts`

Supabase CLI example:
```bash
supabase functions deploy create-order --project-ref iqgoclijgicgzncrjqqt
```

The hosted function receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through Supabase's server environment. Never paste the service-role key into `script.js`, Cloudflare, HTML, or browser devtools.

## 3. Cloudflare
Deploy the Phase 5 ZIP as the new Pages deployment. `script.js` already points to:
`https://iqgoclijgicgzncrjqqt.supabase.co/functions/v1/create-order`

## 4. Test
Use a real active product with stock >= 1.
1. Add one item.
2. Open checkout.
3. Enter test customer details.
4. Select Cash on delivery.
5. Place order.
6. Verify one new row in `orders`.
7. Verify matching `order_items`, `payments`, `order_status_history`.
8. Verify product/variant stock decreased by the ordered quantity.
9. Verify `inventory_transactions` has a negative quantity change.

## Important
This phase is secure order creation, not an online card-payment gateway. JazzCash/Easypaisa/bank transfer are still manual confirmation methods. Real gateway integration/webhooks should be Phase 6.

# V11 Phase 9 — Payment Status Fix

This patch fixes the admin payment status error:
`Could not find the 'paid_at' column of 'payments' in the schema cache`

## Supabase
Run `supabase/phase9-payment-status-fix.sql` once in SQL Editor as a NEW query.
It adds `payments.paid_at` if missing and reloads the PostgREST schema.

## Cloudflare
Deploy this ZIP to the **Production** environment. Do not use Preview.

## Test
Admin → Orders → change payment status on an existing order from pending → paid.
Expected: no error, payment status becomes paid, and `paid_at` is recorded.

Order status workflow is already working and is unchanged by this patch.

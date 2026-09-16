# Phase 23 — Returns & Refunds Pro

1. Run `supabase/phase23-returns-refunds.sql` in Supabase SQL Editor.
2. Deploy this ZIP directly to Cloudflare Production.
3. Admin → Returns will show return requests and allow status/refund processing.

Statuses: requested → approved → received → refunded; rejected/cancelled are terminal.

Refunds remain operational/manual unless a payment provider API is connected.

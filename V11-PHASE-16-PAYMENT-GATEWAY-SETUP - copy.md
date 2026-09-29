# V11 Phase 16 — Payment Gateway Pro
1. Run `supabase/phase16-payment-gateway.sql` in Supabase SQL Editor.
2. Deploy this ZIP directly to Cloudflare Pages Production.
3. Admin → Payment Settings: enter your bank/JazzCash/Easypaisa receiving instructions.
4. Checkout: select a prepaid method and optionally enter the transaction/reference ID.
5. Admin → Orders → View: verify/save payment reference and use existing payment status controls.
6. A live JazzCash/Easypaisa API is NOT activated by this phase; merchant credentials must be configured in a server-side Edge Function when the provider integration is supplied.

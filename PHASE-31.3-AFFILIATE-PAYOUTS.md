# Phase 31.3 — Affiliate Payouts & Withdrawals

## What was added
- Affiliate dashboard shows approved balance and country/currency equivalent.
- Country-specific payout method selection.
- Withdrawal request flow: Pending → Approved → Processing → Paid (or Rejected).
- Minimum withdrawal per payout currency.
- Admin Affiliate section includes withdrawal request management.
- Payout request stores the selected currency, amount, base PKR amount, and admin payout reference.
- Exchange rates are stored/configurable in `affiliate_payout_currencies`; the seeded rates are display/processing defaults and should be updated by the store operator when live payouts are made.

## Default countries/methods
Pakistan (PKR): Bank Transfer, Easypaisa, JazzCash
UAE (AED): Bank Transfer, PayPal
Saudi Arabia (SAR): Bank Transfer, PayPal
United Kingdom (GBP): Bank Transfer, PayPal
United States (USD): Bank Transfer, PayPal
European Union (EUR): Bank Transfer, PayPal
Qatar (QAR): Bank Transfer, PayPal
Kuwait (KWD): Bank Transfer, PayPal

These are configurable defaults, not a claim that every payout provider is available to every recipient. Provider/country eligibility must be confirmed before enabling a method for live payouts.

## Deployment
1. Run `supabase/phase31.3-affiliate-payouts.sql` in Supabase SQL Editor after Phase 31 SQL.
2. Deploy the Phase 31.3 ZIP to Cloudflare **Production**.
3. Affiliate: Dashboard → Withdraw Earnings → choose country/method → enter amount → enter payout details → Request Withdrawal.
4. Admin: Admin → Affiliates → Withdrawal Requests → Approve/Reject → Processing → Mark Paid with reference.

No automatic payment-provider payout API is enabled by this phase. The workflow is manual/admin-controlled until a real payout provider account and credentials are connected.

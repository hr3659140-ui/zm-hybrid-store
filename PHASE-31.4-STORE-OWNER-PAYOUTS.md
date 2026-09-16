# Phase 31.4 — Store Owner Finance & Withdrawals

Adds an Admin **Finance & Withdrawals** section for ZM Hybrid Store.

Features:
- Available store balance in PKR
- Gross collected paid-order amount
- Refund reserve
- Affiliate commission reserve
- Owner withdrawal reserve
- Country/currency selection
- Country-specific payout methods
- Owner withdrawal request history
- Processing / Paid / Rejected states and payout reference

Important: this is an internal finance and payout-recording layer. It does not automatically move money from a bank, PayPal, JazzCash, Easypaisa, Stripe, etc. Actual transfer is completed through the configured payment provider.

Run `supabase/phase31.4-store-owner-payouts.sql` after Phase 31.3 SQL, then deploy the package to Cloudflare **Production**.

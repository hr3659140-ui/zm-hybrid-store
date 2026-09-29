# Phase 28 Launch Readiness

This release is the final QA/hardening package. It does not intentionally introduce a new database migration.

Before launch:
- Verify all previously run Phase SQL migrations are present in Supabase.
- Verify Edge Functions used by the store are deployed.
- Verify required Edge Function secrets are configured in Supabase.
- Verify Cloudflare Production is serving the intended build.
- Run `PHASE-28-FINAL-QA-LAUNCH-CHECKLIST.md` end-to-end.

Payment note: COD, Bank Transfer, JazzCash and Easypaisa are supported by the current order/payment infrastructure. JazzCash/Easypaisa are still manual/reference-based unless a merchant's live gateway API integration has separately been connected.

WhatsApp AI two-way messaging remains a separate final integration step because it depends on the Meta WhatsApp Cloud API webhook/token configuration.

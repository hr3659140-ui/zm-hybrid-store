# Phase 29 — Payment Gateway Pro

This phase adds the secure payment-gateway foundation for ZM Hybrid Store.

## What is included
- Payment gateway attempt ledger.
- Gateway/transaction fields on `payments`.
- Secure Supabase Edge Function for gateway initialization.
- JazzCash hosted-payment field generation using server-side secrets.
- Payment return/status handler.
- Easypaisa adapter guard that refuses to guess undocumented merchant fields.
- No merchant secret is placed in Cloudflare/browser code.

## Supabase SQL
Run:
`supabase/phase29-payment-gateway.sql`

## Edge Function secrets
Set these in Supabase Edge Function Secrets — never in browser code:

### JazzCash
- `JAZZCASH_ENABLED=true`
- `JAZZCASH_MODE=sandbox` or `production`
- `JAZZCASH_MERCHANT_ID`
- `JAZZCASH_PASSWORD`
- `JAZZCASH_INTEGRITY_SALT`
- `JAZZCASH_ENDPOINT`
- `JAZZCASH_RETURN_URL`

### Easypaisa
- `EASYPAISA_ENABLED=true` only after the exact merchant integration guide is mapped
- `EASYPAISA_MODE=sandbox` or `production`
- `EASYPAISA_MERCHANT_ID`
- `EASYPAISA_STORE_ID` if supplied by merchant docs
- `EASYPAISA_ENDPOINT`

## Important
The JazzCash merchant guide documents merchant registration, merchant ID/access credentials and gateway integration. The Easypaisa portal provides merchant signup and integration guides. Exact live credentials/endpoints/fields are merchant-account specific.

Do not paste passwords, OTPs, PINs, integrity salts, API keys or other secrets into ChatGPT. Enter them directly into Supabase Edge Function Secrets.

## Current status
- COD: existing
- Bank Transfer: existing
- JazzCash manual: existing; live adapter prepared, not activated until merchant secrets are configured
- Easypaisa manual: existing; live adapter intentionally blocked until exact merchant integration guide is available

Official references:
- JazzCash Payment Gateway Integration Guide: https://payments.jazzcash.com.pk/SandboxDocumentation/Content/documentation/Payment%20Gateway%20Integration%20Guide%20for%20Merchants-v4.2.pdf
- Easypaisa Merchant Portal: https://merchantportal.easypaisa.com.pk/
- Easypaisa Integration Guides: https://easypay.easypaisa.com.pk/easypay-merchant/faces/pg/site/IntegrationGuides.jsf

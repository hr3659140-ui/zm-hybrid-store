# Phase 21 — AI Store Agent + WhatsApp-ready architecture

## What is included
- Admin → AI Agent chat
- Storefront floating AI assistant
- Supabase Edge Function `ai-store-agent`
- The agent reads live products, storefront settings and active shipping methods.
- No AI key is exposed in browser code.

## Required secrets
In Supabase Edge Function secrets configure:
- `OPENAI_API_KEY` = your OpenAI API key
- optional `OPENAI_MODEL` = a model available to your account

The function already has SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in the Supabase Edge Function environment.

## WhatsApp
The current Communications page already opens WhatsApp with a customer-ready message.
For a true 24/7 two-way AI WhatsApp agent, Meta WhatsApp Cloud API must be connected separately. Required values are:
- WHATSAPP_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_VERIFY_TOKEN
- a public webhook endpoint

Do NOT put the WhatsApp token in Cloudflare/browser JavaScript. It belongs in a Supabase Edge Function secret.

## Important
Until `OPENAI_API_KEY` is configured and the Edge Function is deployed, the AI buttons are intentionally unavailable. This is safer than putting a secret in the storefront.

# Phase 30.2 — Product Slug Collision Fix

## Problem fixed
Product creation could fail with:
`duplicate key value violates unique constraint "products_slug_key"`

## Fix
The Admin Product form now automatically generates a unique slug before saving:
- `watch` → `watch`
- second `watch` → `watch-2`
- third `watch` → `watch-3`

The code also retries a create if a simultaneous insert causes a slug race-condition.
Existing products keep their own slug when it is unique.

## Deployment
Upload this ZIP to **Cloudflare Pages → Production**. Do not use Preview.

No Supabase SQL migration is required for this fix because the existing unique constraint is intentionally kept.

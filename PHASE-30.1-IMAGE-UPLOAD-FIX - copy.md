# Phase 30.1 — Product Image Upload Fix

## What changed
- After creating a new product, Admin now automatically re-opens that product in Edit mode.
- The **Upload images** control becomes available immediately after product creation.
- Upload errors now expose the Storage error returned by Supabase instead of the generic "Upload failed" message.
- The file picker resets after upload so the same file can be selected again.

## Deployment order
1. If Storage policies are already working, no SQL is required for the frontend fix.
2. If the upload still shows a Storage policy/bucket error, run `supabase/phase30.1-image-upload-fix.sql` once in Supabase SQL Editor.
3. Deploy this ZIP to Cloudflare **Production**, not Preview.
4. Admin → Products → Add Product → fill required fields → Create product.
5. The editor will reopen automatically; click **+ Upload images**.

Supabase Storage requires the bucket to exist and the authenticated user to have object insert permission for browser uploads.

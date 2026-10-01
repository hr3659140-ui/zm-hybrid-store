-- Phase 9 Payment Status Fix
-- Adds the payment timestamp column used by the admin payment-status control.
-- Non-destructive migration.

alter table public.payments
  add column if not exists paid_at timestamptz;

create index if not exists idx_payments_paid_at on public.payments(paid_at);

notify pgrst, 'reload schema';

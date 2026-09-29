-- ZM Hybrid Store — Phase 27 Admin Settings + Security Pro
-- Run once in Supabase SQL Editor.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null default auth.uid(),
  action text not null,
  entity_type text,
  entity_id uuid,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

drop policy if exists phase27_admin_audit_select on public.admin_audit_logs;
create policy phase27_admin_audit_select on public.admin_audit_logs
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id=auth.uid() and p.role in ('admin','manager')
));

drop policy if exists phase27_admin_audit_insert on public.admin_audit_logs;
create policy phase27_admin_audit_insert on public.admin_audit_logs
for insert to authenticated
with check (
  actor_id=auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role in ('admin','manager')
  )
);

create index if not exists idx_admin_audit_created_at
  on public.admin_audit_logs(created_at desc);

create index if not exists idx_admin_audit_actor
  on public.admin_audit_logs(actor_id,created_at desc);

-- Useful production defaults; JSONB is used by site_settings.value.
insert into public.site_settings(key,value)
values
 ('store.name', to_jsonb('ZM Hybrid Store'::text)),
 ('store.currency', to_jsonb('PKR'::text)),
 ('store.country', to_jsonb('Pakistan'::text)),
 ('support.email', to_jsonb(''::text)),
 ('support.phone', to_jsonb(''::text)),
 ('policy.returns', to_jsonb('Returns are accepted according to the store return policy. Contact support with your order number for assistance.'::text)),
 ('policy.privacy', to_jsonb('We use customer information only to process orders, provide support and improve the store experience.'::text)),
 ('policy.terms', to_jsonb('Orders are subject to product availability, pricing, delivery and payment verification.'::text))
on conflict (key) do nothing;

notify pgrst, 'reload schema';

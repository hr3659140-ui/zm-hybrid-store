-- Phase 29 — Payment Gateway Pro Foundation
-- Safe/non-destructive migration. Live provider credentials stay in Edge Function secrets.

alter table public.payments
  add column if not exists gateway text,
  add column if not exists gateway_transaction_id text,
  add column if not exists gateway_status text,
  add column if not exists paid_at timestamptz;

create index if not exists idx_payments_gateway_tx on public.payments(gateway, gateway_transaction_id);

create table if not exists public.payment_gateway_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  transaction_id text,
  status text not null default 'initiated' check (status in ('initiated','redirected','authorized','paid','failed','cancelled','refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PKR',
  response_code text,
  response_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_attempts_order on public.payment_gateway_attempts(order_id, created_at desc);
create index if not exists idx_payment_attempts_provider_tx on public.payment_gateway_attempts(provider, transaction_id);

alter table public.payment_gateway_attempts enable row level security;
drop policy if exists payment_gateway_attempts_admin_select on public.payment_gateway_attempts;
create policy payment_gateway_attempts_admin_select on public.payment_gateway_attempts
for select using (public.is_admin());
drop policy if exists payment_gateway_attempts_admin_insert on public.payment_gateway_attempts;
create policy payment_gateway_attempts_admin_insert on public.payment_gateway_attempts
for insert with check (public.is_admin());

create or replace function public.payment_gateway_update(
  p_order_id uuid,
  p_provider text,
  p_status text,
  p_transaction_id text default null,
  p_gateway_status text default null,
  p_response_code text default null,
  p_response_message text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_order orders%rowtype;
  v_payment payments%rowtype;
  v_paid_at timestamptz;
begin
  if p_status not in ('initiated','redirected','authorized','paid','failed','cancelled','refunded') then
    raise exception 'Invalid payment gateway status';
  end if;
  select * into v_order from orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into v_payment from payments where order_id=p_order_id order by created_at desc limit 1 for update;
  v_paid_at := case when p_status='paid' then now() else null end;

  if found then
    update payments set
      gateway=p_provider,
      gateway_transaction_id=coalesce(p_transaction_id,gateway_transaction_id),
      gateway_status=p_gateway_status,
      provider_reference=coalesce(p_transaction_id,provider_reference),
      status=case when p_status='authorized' then 'authorized' when p_status='paid' then 'paid' when p_status='refunded' then 'refunded' when p_status in ('failed','cancelled') then 'failed' else status end,
      paid_at=coalesce(v_paid_at, paid_at),
      metadata=coalesce(metadata,'{}'::jsonb) || coalesce(p_metadata,'{}'::jsonb),
      updated_at=now()
    where id=v_payment.id;
  else
    insert into payments(order_id,provider,provider_reference,amount,currency,status,gateway,gateway_transaction_id,gateway_status,paid_at,metadata)
    values(p_order_id,p_provider,p_transaction_id,v_order.total_amount,coalesce(v_order.currency,'PKR'),case when p_status='paid' then 'paid' when p_status='failed' or p_status='cancelled' then 'failed' else 'pending' end,p_provider,p_transaction_id,p_gateway_status,v_paid_at,coalesce(p_metadata,'{}'::jsonb));
  end if;

  update orders set payment_status=case when p_status='paid' then 'paid' when p_status in ('failed','cancelled') then 'failed' when p_status='refunded' then 'refunded' else payment_status end, updated_at=now() where id=p_order_id;

  return jsonb_build_object('ok',true,'order_id',p_order_id,'provider',p_provider,'status',p_status,'transaction_id',p_transaction_id,'response_code',p_response_code,'response_message',p_response_message);
end;
$$;

grant execute on function public.payment_gateway_update(uuid,text,text,text,text,text,text,jsonb) to service_role;

notify pgrst, 'reload schema';

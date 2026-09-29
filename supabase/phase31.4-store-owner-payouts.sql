-- ZM Hybrid Store V11 Phase 31.4 — Store Owner Finance & Withdrawals
-- Run AFTER Phase 31.3 Affiliate Payouts SQL.

create table if not exists public.store_payout_currencies (
  country_code text primary key,
  country_name text not null,
  currency_code text not null unique,
  rate_from_pkr numeric(18,8) not null check (rate_from_pkr > 0),
  minimum_amount numeric(12,2) not null default 10,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_payout_methods (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  currency_code text not null,
  method_code text not null,
  method_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(country_code, method_code)
);

create table if not exists public.store_payout_requests (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  currency_code text not null,
  method_code text not null,
  method_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  base_amount_pkr numeric(12,2) not null default 0,
  fx_rate_from_pkr numeric(18,8) not null default 1,
  payout_details text not null,
  admin_note text,
  status text not null default 'pending' check (status in ('pending','processing','paid','rejected','cancelled')),
  payout_reference text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_store_payout_requests_status on public.store_payout_requests(status, requested_at desc);
create index if not exists idx_store_payout_requests_requested_by on public.store_payout_requests(requested_by, requested_at desc);

insert into public.store_payout_currencies(country_code,country_name,currency_code,rate_from_pkr,minimum_amount)
values
('PK','Pakistan','PKR',1,1000),
('AE','UAE','AED',0.0130,50),
('SA','Saudi Arabia','SAR',0.0134,50),
('GB','United Kingdom','GBP',0.00278,20),
('US','United States','USD',0.00358,20),
('EU','European Union','EUR',0.00305,20),
('QA','Qatar','QAR',0.0130,50),
('KW','Kuwait','KWD',0.00110,5)
on conflict (country_code) do nothing;

insert into public.store_payout_methods(country_code,currency_code,method_code,method_name)
values
('PK','PKR','bank_transfer','Bank Transfer'),('PK','PKR','easypaisa','Easypaisa'),('PK','PKR','jazzcash','JazzCash'),
('AE','AED','bank_transfer','Bank Transfer'),('AE','AED','paypal','PayPal'),
('SA','SAR','bank_transfer','Bank Transfer'),('SA','SAR','paypal','PayPal'),
('GB','GBP','bank_transfer','Bank Transfer'),('GB','GBP','paypal','PayPal'),
('US','USD','bank_transfer','Bank Transfer'),('US','USD','paypal','PayPal'),
('EU','EUR','bank_transfer','Bank Transfer'),('EU','EUR','paypal','PayPal'),
('QA','QAR','bank_transfer','Bank Transfer'),('QA','QAR','paypal','PayPal'),
('KW','KWD','bank_transfer','Bank Transfer'),('KW','KWD','paypal','PayPal')
on conflict (country_code,method_code) do nothing;

alter table public.store_payout_currencies enable row level security;
alter table public.store_payout_methods enable row level security;
alter table public.store_payout_requests enable row level security;

drop policy if exists store_payout_currencies_admin on public.store_payout_currencies;
create policy store_payout_currencies_admin on public.store_payout_currencies for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists store_payout_methods_admin on public.store_payout_methods;
create policy store_payout_methods_admin on public.store_payout_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists store_payout_requests_admin on public.store_payout_requests;
create policy store_payout_requests_admin on public.store_payout_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.store_finance_summary()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_gross numeric := 0;
  v_refunds numeric := 0;
  v_affiliate numeric := 0;
  v_withdrawals numeric := 0;
  v_available numeric := 0;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admin access required'; end if;

  select coalesce(sum(total_amount),0) into v_gross
  from public.orders
  where payment_status='paid'
    and status not in ('cancelled','refunded');

  select coalesce(sum(refund_amount),0) into v_refunds
  from public.returns
  where status='refunded';

  select coalesce(sum(commission_amount),0) into v_affiliate
  from public.affiliate_commissions
  where status in ('pending','approved','paid');

  select coalesce(sum(base_amount_pkr),0) into v_withdrawals
  from public.store_payout_requests
  where status in ('pending','processing','paid');

  v_available := greatest(v_gross - v_refunds - v_affiliate - v_withdrawals,0);

  return jsonb_build_object(
    'gross_collected_pkr',round(v_gross,2),
    'refunds_pkr',round(v_refunds,2),
    'affiliate_commissions_reserved_pkr',round(v_affiliate,2),
    'owner_withdrawals_pkr',round(v_withdrawals,2),
    'available_balance_pkr',round(v_available,2)
  );
end;
$$;
revoke all on function public.store_finance_summary() from public;
grant execute on function public.store_finance_summary() to authenticated;

create or replace function public.request_store_payout(
  p_country_code text,
  p_currency_code text,
  p_method_code text,
  p_payout_details text,
  p_amount numeric,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_method public.store_payout_methods%rowtype;
  v_currency public.store_payout_currencies%rowtype;
  v_summary jsonb;
  v_available numeric;
  v_min numeric;
  v_base numeric;
  v_req public.store_payout_requests%rowtype;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_method from public.store_payout_methods
   where country_code=upper(btrim(p_country_code))
     and currency_code=upper(btrim(p_currency_code))
     and method_code=lower(btrim(p_method_code))
     and active=true limit 1;
  if not found then raise exception 'Payout method is not available for this country'; end if;

  select * into v_currency from public.store_payout_currencies
   where country_code=v_method.country_code and currency_code=v_method.currency_code and active=true limit 1;
  if not found then raise exception 'Payout currency is not configured'; end if;

  if p_amount is null or p_amount<=0 then raise exception 'Invalid withdrawal amount'; end if;
  v_min:=coalesce(v_currency.minimum_amount,10);
  if p_amount < v_min then
    raise exception using message=format('Minimum withdrawal is %s %s',v_min::text,v_currency.currency_code);
  end if;
  if length(btrim(coalesce(p_payout_details,'')))<3 then raise exception 'Please enter payout details'; end if;

  v_summary:=public.store_finance_summary();
  v_available:=coalesce((v_summary->>'available_balance_pkr')::numeric,0);
  v_base:=round(p_amount / v_currency.rate_from_pkr,2);
  if v_base > v_available then
    raise exception using message=format('Withdrawal exceeds available store balance (%s PKR available)',round(v_available,2)::text);
  end if;

  insert into public.store_payout_requests(country_code,currency_code,method_code,method_name,amount,base_amount_pkr,fx_rate_from_pkr,payout_details,admin_note,requested_by)
  values(v_method.country_code,v_method.currency_code,v_method.method_code,v_method.method_name,round(p_amount,2),v_base,v_currency.rate_from_pkr,left(btrim(p_payout_details),1000),nullif(left(btrim(coalesce(p_admin_note,'')),1000),''),v_uid)
  returning * into v_req;

  return jsonb_build_object('ok',true,'request',to_jsonb(v_req),'available_balance_pkr',greatest(v_available-v_base,0));
end;
$$;
revoke all on function public.request_store_payout(text,text,text,text,numeric,text) from public;
grant execute on function public.request_store_payout(text,text,text,text,numeric,text) to authenticated;

notify pgrst,'reload schema';

-- ZM Hybrid Store V11 Phase 31.3 — Affiliate Payouts & Withdrawals
-- Run AFTER Phase 31 affiliate SQL.

alter table public.affiliates add column if not exists payout_country text default 'PK';
alter table public.affiliates add column if not exists payout_currency text default 'PKR';
alter table public.affiliates add column if not exists payout_method text;
alter table public.affiliates add column if not exists payout_minimum numeric(12,2) default 1000;

create table if not exists public.affiliate_payout_currencies (
  country_code text primary key,
  country_name text not null,
  currency_code text not null unique,
  rate_from_pkr numeric(18,8) not null check (rate_from_pkr > 0),
  minimum_amount numeric(12,2) not null default 10,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_payout_methods (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  country_name text not null,
  currency_code text not null,
  method_code text not null,
  method_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(country_code, method_code)
);

create table if not exists public.affiliate_payout_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  country_code text not null,
  currency_code text not null,
  method_code text not null,
  method_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  base_amount_pkr numeric(12,2) not null default 0,
  fx_rate_from_pkr numeric(18,8) not null default 1,
  payout_details text not null,
  status text not null default 'pending' check (status in ('pending','approved','processing','paid','rejected','cancelled')),
  admin_note text,
  payout_reference text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.affiliate_payout_requests
  add column if not exists base_amount_pkr numeric(12,2) not null default 0;
alter table public.affiliate_payout_requests
  add column if not exists fx_rate_from_pkr numeric(18,8) not null default 1;

create index if not exists idx_affiliate_payout_requests_affiliate on public.affiliate_payout_requests(affiliate_id, status, requested_at desc);
create index if not exists idx_affiliate_payout_requests_status on public.affiliate_payout_requests(status, requested_at desc);


insert into public.affiliate_payout_currencies(country_code,country_name,currency_code,rate_from_pkr,minimum_amount)
values
('PK','Pakistan','PKR',1,1000),('AE','UAE','AED',0.0130,50),('SA','Saudi Arabia','SAR',0.0134,50),('GB','United Kingdom','GBP',0.00278,20),('US','United States','USD',0.00358,20),('EU','European Union','EUR',0.00305,20),('QA','Qatar','QAR',0.0130,50),('KW','Kuwait','KWD',0.00110,5)
on conflict (country_code) do nothing;

insert into public.affiliate_payout_methods(country_code,country_name,currency_code,method_code,method_name)
values
('PK','Pakistan','PKR','bank_transfer','Bank Transfer'),
('PK','Pakistan','PKR','easypaisa','Easypaisa'),
('PK','Pakistan','PKR','jazzcash','JazzCash'),
('AE','UAE','AED','bank_transfer','Bank Transfer'),
('AE','UAE','AED','paypal','PayPal'),
('SA','Saudi Arabia','SAR','bank_transfer','Bank Transfer'),
('SA','Saudi Arabia','SAR','paypal','PayPal'),
('GB','United Kingdom','GBP','bank_transfer','Bank Transfer'),
('GB','United Kingdom','GBP','paypal','PayPal'),
('US','United States','USD','bank_transfer','Bank Transfer'),
('US','United States','USD','paypal','PayPal'),
('EU','European Union','EUR','bank_transfer','Bank Transfer'),
('EU','European Union','EUR','paypal','PayPal'),
('QA','Qatar','QAR','bank_transfer','Bank Transfer'),
('QA','Qatar','QAR','paypal','PayPal'),
('KW','Kuwait','KWD','bank_transfer','Bank Transfer'),
('KW','Kuwait','KWD','paypal','PayPal')
on conflict (country_code,method_code) do nothing;

alter table public.affiliate_payout_currencies enable row level security;
alter table public.affiliate_payout_methods enable row level security;
alter table public.affiliate_payout_requests enable row level security;

drop policy if exists affiliate_payout_currencies_select on public.affiliate_payout_currencies;
create policy affiliate_payout_currencies_select on public.affiliate_payout_currencies for select to authenticated using (active=true or public.is_admin());
drop policy if exists affiliate_payout_currencies_admin on public.affiliate_payout_currencies;
create policy affiliate_payout_currencies_admin on public.affiliate_payout_currencies for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists affiliate_payout_methods_select on public.affiliate_payout_methods;
create policy affiliate_payout_methods_select on public.affiliate_payout_methods for select to authenticated using (active=true or public.is_admin());
drop policy if exists affiliate_payout_methods_admin on public.affiliate_payout_methods;
create policy affiliate_payout_methods_admin on public.affiliate_payout_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists affiliate_payout_requests_self_select on public.affiliate_payout_requests;
create policy affiliate_payout_requests_self_select on public.affiliate_payout_requests for select to authenticated using (exists(select 1 from public.affiliates a where a.id=affiliate_id and (a.user_id=auth.uid() or public.is_admin())));
drop policy if exists affiliate_payout_requests_admin on public.affiliate_payout_requests;
create policy affiliate_payout_requests_admin on public.affiliate_payout_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.affiliate_available_balance(p_affiliate_id uuid)
returns numeric
language sql
security definer
set search_path=public
as $$
  select greatest(
    coalesce((select sum(commission_amount) from public.affiliate_commissions where affiliate_id=p_affiliate_id and status='approved'),0)
    - coalesce((select sum(amount) from public.affiliate_payout_requests where affiliate_id=p_affiliate_id and status in ('pending','approved','processing','paid')),0),
    0
  );
$$;
revoke all on function public.affiliate_available_balance(uuid) from public;
grant execute on function public.affiliate_available_balance(uuid) to authenticated;

create or replace function public.request_affiliate_payout(
  p_country_code text,
  p_currency_code text,
  p_method_code text,
  p_payout_details text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_aff public.affiliates%rowtype;
  v_method public.affiliate_payout_methods%rowtype;
  v_currency public.affiliate_payout_currencies%rowtype;
  v_available numeric;
  v_min numeric;
  v_base_amount numeric;
  v_request public.affiliate_payout_requests%rowtype;
begin
  if v_uid is null then raise exception 'Please sign in first'; end if;
  select * into v_aff from public.affiliates where user_id=v_uid and status='active' limit 1;
  if not found then raise exception 'Active affiliate account required'; end if;
  select * into v_method from public.affiliate_payout_methods where country_code=upper(btrim(p_country_code)) and currency_code=upper(btrim(p_currency_code)) and method_code=lower(btrim(p_method_code)) and active=true limit 1;
  if not found then raise exception 'Payout method is not available for this country'; end if;
  select * into v_currency from public.affiliate_payout_currencies where country_code=v_method.country_code and currency_code=v_method.currency_code and active=true limit 1;
  if not found then raise exception 'Payout currency is not configured'; end if;
  v_available:=public.affiliate_available_balance(v_aff.id);
  v_min:=coalesce(v_currency.minimum_amount,10);
  if p_amount is null or p_amount<=0 then raise exception 'Invalid withdrawal amount'; end if;
  if p_amount < v_min then raise exception using message = format('Minimum withdrawal is %s %s', v_min::text, v_method.currency_code); end if;
  v_base_amount:=round(p_amount / v_currency.rate_from_pkr,2);
  if v_base_amount > v_available then raise exception using message = format('Withdrawal amount exceeds available balance (%s %s available)', round(v_available*v_currency.rate_from_pkr,2)::text, v_currency.currency_code); end if;
  if length(btrim(coalesce(p_payout_details,'')))<3 then raise exception 'Please enter payout details'; end if;
  insert into public.affiliate_payout_requests(affiliate_id,country_code,currency_code,method_code,method_name,amount,base_amount_pkr,fx_rate_from_pkr,payout_details)
  values(v_aff.id,v_method.country_code,v_method.currency_code,v_method.method_code,v_method.method_name,round(p_amount,2),v_base_amount,v_currency.rate_from_pkr,left(btrim(p_payout_details),1000)) returning * into v_request;
  update public.affiliates set payout_country=v_method.country_code,payout_currency=v_method.currency_code,payout_method=v_method.method_code,updated_at=now() where id=v_aff.id;
  return jsonb_build_object('ok',true,'request',to_jsonb(v_request),'available_balance',public.affiliate_available_balance(v_aff.id));
end; $$;
revoke all on function public.request_affiliate_payout(text,text,text,text,numeric) from public;
grant execute on function public.request_affiliate_payout(text,text,text,text,numeric) to authenticated;

notify pgrst,'reload schema';

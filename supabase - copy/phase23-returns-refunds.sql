-- ZM Hybrid Store Phase 23 — Returns & Refunds Pro
create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  return_number text unique not null default ('RET-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested' check (status in ('requested','approved','rejected','received','refunded','cancelled')),
  reason text not null,
  customer_note text,
  admin_note text,
  refund_amount numeric(12,2) not null default 0,
  refund_method text,
  refund_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_returns_order on public.returns(order_id);
create index if not exists idx_returns_customer on public.returns(customer_id);
create index if not exists idx_returns_status on public.returns(status);

alter table public.returns enable row level security;
alter table public.return_items enable row level security;

drop policy if exists v23_returns_customer_select on public.returns;
drop policy if exists v23_returns_admin_all on public.returns;
drop policy if exists v23_return_items_customer_select on public.return_items;
drop policy if exists v23_return_items_admin_all on public.return_items;

create policy v23_returns_customer_select on public.returns for select to authenticated
using (customer_id = auth.uid());
create policy v23_returns_admin_all on public.returns for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy v23_return_items_customer_select on public.return_items for select to authenticated
using (exists (select 1 from public.returns r where r.id=return_id and r.customer_id=auth.uid()));
create policy v23_return_items_admin_all on public.return_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.request_return_secure(
  p_order_id uuid,
  p_reason text,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_order orders%rowtype;
  v_return returns%rowtype;
  v_item jsonb;
  v_oi order_items%rowtype;
  v_qty int;
begin
  if v_uid is null then raise exception 'You must be signed in to request a return.'; end if;
  select * into v_order from orders where id=p_order_id and customer_id=v_uid for update;
  if not found then raise exception 'Order not found for this account.'; end if;
  if v_order.status <> 'delivered' then raise exception 'Returns can only be requested after delivery.'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'Return reason is required.'; end if;
  if exists(select 1 from returns where order_id=p_order_id and status not in ('rejected','cancelled')) then
    raise exception 'A return request already exists for this order.';
  end if;

  insert into returns(order_id,customer_id,reason,customer_note,refund_amount)
  values(p_order_id,v_uid,trim(p_reason),nullif(trim(p_note),''),0)
  returning * into v_return;

  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    select * into v_oi from order_items where id=(v_item->>'order_item_id')::uuid and order_id=p_order_id;
    if not found then raise exception 'Invalid order item in return request.'; end if;
    v_qty:=greatest(1,coalesce((v_item->>'quantity')::int,1));
    if v_qty > v_oi.quantity then raise exception 'Return quantity exceeds ordered quantity.'; end if;
    insert into return_items(return_id,order_item_id,product_id,quantity,reason)
    values(v_return.id,v_oi.id,v_oi.product_id,v_qty,nullif(trim(v_item->>'reason'),''));
  end loop;

  return jsonb_build_object('success',true,'return_id',v_return.id,'return_number',v_return.return_number,'status',v_return.status);
end;
$$;

grant execute on function public.request_return_secure(uuid,text,text,jsonb) to authenticated;
notify pgrst, 'reload schema';

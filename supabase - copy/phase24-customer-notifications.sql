-- ZM Hybrid Store Phase 24 — Customer Notifications Pro
-- In-app customer notifications triggered by order/payment/return changes.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'general' check (type in ('order','payment','shipping','return','general')),
  title text not null,
  body text not null,
  order_id uuid references public.orders(id) on delete set null,
  return_id uuid references public.returns(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_created on public.notifications(user_id,created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id,read_at);

alter table public.notifications enable row level security;
drop policy if exists v24_notifications_customer_select on public.notifications;
drop policy if exists v24_notifications_customer_update on public.notifications;
drop policy if exists v24_notifications_admin_all on public.notifications;
create policy v24_notifications_customer_select on public.notifications for select to authenticated using (user_id=auth.uid());
create policy v24_notifications_customer_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy v24_notifications_admin_all on public.notifications for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.create_customer_notification(
  p_user_id uuid, p_type text, p_title text, p_body text,
  p_order_id uuid default null, p_return_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_user_id is null then return null; end if;
  insert into notifications(user_id,type,title,body,order_id,return_id)
  values(p_user_id,coalesce(p_type,'general'),trim(p_title),trim(p_body),p_order_id,p_return_id)
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.create_customer_notification(uuid,text,text,text,uuid,uuid) to authenticated;

create or replace function public.notify_order_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text; v_title text; v_body text;
begin
  if NEW.customer_id is null then return NEW; end if;
  select coalesce(full_name,'Customer') into v_name from profiles where id=NEW.customer_id;
  if TG_OP='UPDATE' and NEW.status is distinct from OLD.status then
    v_title := 'Order status updated';
    v_body := 'Your order '||NEW.order_number||' is now '||replace(NEW.status,'_',' ')||'.';
    if NEW.status='shipped' and (NEW.courier_name is not null or NEW.tracking_number is not null) then
      v_body := v_body||' '||coalesce(NEW.courier_name||' ','')||coalesce('Tracking: '||NEW.tracking_number||'.','');
    end if;
    perform create_customer_notification(NEW.customer_id,'shipping',v_title,v_body,NEW.id,null);
  end if;
  if TG_OP='UPDATE' and NEW.payment_status is distinct from OLD.payment_status then
    v_title := case when NEW.payment_status='paid' then 'Payment received' else 'Payment status updated' end;
    v_body := 'Payment for order '||NEW.order_number||' is marked '||replace(NEW.payment_status,'_',' ')||'.';
    perform create_customer_notification(NEW.customer_id,'payment',v_title,v_body,NEW.id,null);
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_v24_order_notifications on public.orders;
create trigger trg_v24_order_notifications after update of status,payment_status,courier_name,tracking_number on public.orders for each row execute function public.notify_order_change();

create or replace function public.notify_return_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_body text;
begin
  if NEW.customer_id is null then return NEW; end if;
  if TG_OP='UPDATE' and NEW.status is distinct from OLD.status then
    v_body := 'Return request '||NEW.return_number||' is now '||replace(NEW.status,'_',' ')||'.';
    if NEW.status='refunded' and NEW.refund_amount>0 then v_body := v_body||' Refund amount: Rs. '||to_char(NEW.refund_amount,'FM999,999,990.00')||'.'; end if;
    perform create_customer_notification(NEW.customer_id,'return','Return request updated',v_body,NEW.order_id,NEW.id);
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_v24_return_notifications on public.returns;
create trigger trg_v24_return_notifications after update of status,refund_amount,refund_reference on public.returns for each row execute function public.notify_return_change();

create or replace function public.mark_notification_read(p_notification_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
  update notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid();
  return found;
end; $$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read() returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  update notifications set read_at=now() where user_id=auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.mark_all_notifications_read() to authenticated;
notify pgrst,'reload schema';

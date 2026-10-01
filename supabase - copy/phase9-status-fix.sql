-- Phase 9 Status Fix: secure admin order-status RPC
create or replace function public.admin_update_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_role text; v_old text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if v_role not in ('admin','manager') then raise exception 'Not authorized'; end if;
  if p_status not in ('pending','confirmed','processing','packed','shipped','delivered','cancelled','returned','refunded') then raise exception 'Invalid order status'; end if;
  select status into v_old from public.orders where id=p_order_id for update;
  if v_old is null then raise exception 'Order not found'; end if;
  update public.orders set status=p_status, updated_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,status,changed_by,note)
  values(p_order_id,p_status,auth.uid(),nullif(p_note,''));
  return jsonb_build_object('ok',true,'order_id',p_order_id,'old_status',v_old,'status',p_status);
end;
$$;
grant execute on function public.admin_update_order_status(uuid,text,text) to authenticated;

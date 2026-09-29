-- ZM Hybrid Store V11 Phase 9 — Orders + Payments Pro
-- Non-destructive migration. Run once in Supabase SQL Editor.

alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists customer_note text;
create index if not exists idx_orders_tracking on public.orders(tracking_number);

-- Secure guest order lookup: requires BOTH order number and phone number.
-- Returns only customer-safe tracking/order information.
create or replace function public.track_order_secure(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_history jsonb;
begin
  if coalesce(trim(p_order_number),'') = '' or coalesce(trim(p_phone),'') = '' then
    raise exception 'Order number and phone are required';
  end if;

  select * into v_order
  from public.orders
  where upper(order_number) = upper(trim(p_order_number))
    and regexp_replace(coalesce(shipping_phone,''),'[^0-9]','','g') = regexp_replace(trim(p_phone),'[^0-9]','','g')
  limit 1;

  if not found then
    raise exception 'Order not found. Check the order number and phone number.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', product_name,
    'sku', sku,
    'variant_id', variant_id,
    'quantity', quantity,
    'unit_price', unit_price,
    'line_total', line_total
  ) order by created_at), '[]'::jsonb)
  into v_items
  from public.order_items
  where order_id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'status', status,
    'note', note,
    'created_at', created_at
  ) order by created_at), '[]'::jsonb)
  into v_history
  from public.order_status_history
  where order_id = v_order.id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'payment_method', v_order.payment_method,
      'payment_status', v_order.payment_status,
      'subtotal', v_order.subtotal,
      'shipping_cost', v_order.shipping_cost,
      'discount', v_order.discount,
      'total_amount', v_order.total_amount,
      'currency', v_order.currency,
      'shipping_name', v_order.shipping_name,
      'shipping_city', split_part(coalesce(v_order.shipping_address,''), ', ', 2),
      'shipping_address', v_order.shipping_address,
      'courier_name', v_order.courier_name,
      'tracking_number', v_order.tracking_number,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    ),
    'items', v_items,
    'history', v_history
  );
end;
$$;

grant execute on function public.track_order_secure(text,text) to anon, authenticated;

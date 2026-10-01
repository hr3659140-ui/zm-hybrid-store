-- Phase 22: secure inventory adjustments
create or replace function public.adjust_inventory_secure(
  p_product_id uuid,
  p_variant_id uuid default null,
  p_quantity_change integer default 0,
  p_reason text default 'admin_adjustment',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_stock integer;
  v_new_stock integer;
  v_name text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('admin','manager') then
    raise exception 'Not authorized';
  end if;
  if p_quantity_change = 0 then
    raise exception 'Quantity change cannot be zero';
  end if;

  if p_variant_id is not null then
    select stock, name into v_stock, v_name
    from public.product_variants
    where id = p_variant_id and product_id = p_product_id and active = true
    for update;
    if not found then raise exception 'Active product variant not found'; end if;

    v_new_stock := v_stock + p_quantity_change;
    if v_new_stock < 0 then raise exception 'Insufficient stock'; end if;

    update public.product_variants set stock = v_new_stock, updated_at = now() where id = p_variant_id;
  else
    select stock, name into v_stock, v_name
    from public.products
    where id = p_product_id
    for update;
    if not found then raise exception 'Product not found'; end if;

    v_new_stock := v_stock + p_quantity_change;
    if v_new_stock < 0 then raise exception 'Insufficient stock'; end if;

    update public.products set stock = v_new_stock, updated_at = now() where id = p_product_id;
  end if;

  insert into public.inventory_transactions(
    product_id, variant_id, quantity_change, reason, note, created_by
  ) values (
    p_product_id, p_variant_id, p_quantity_change, coalesce(nullif(trim(p_reason),''),'admin_adjustment'), p_note, auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'previous_stock', v_stock,
    'stock', v_new_stock,
    'quantity_change', p_quantity_change
  );
end;
$$;

grant execute on function public.adjust_inventory_secure(uuid, uuid, integer, text, text) to authenticated;
notify pgrst, 'reload schema';

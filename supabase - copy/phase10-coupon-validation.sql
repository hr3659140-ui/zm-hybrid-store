-- ZM Hybrid Store — Phase 10 coupon validation
-- Safe additive migration. The browser receives only validation results,
-- while final coupon/price validation remains authoritative in create_order_secure().

create or replace function public.validate_coupon_public(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code,'')));
  v_subtotal numeric := greatest(coalesce(p_subtotal,0),0);
  v_coupon public.coupons%rowtype;
  v_discount numeric := 0;
begin
  if v_code = '' then
    return jsonb_build_object('ok',false,'error','Please enter a coupon code.');
  end if;

  select * into v_coupon
  from public.coupons
  where upper(code)=v_code
  limit 1;

  if not found or coalesce(v_coupon.active,false) = false then
    return jsonb_build_object('ok',false,'error','Invalid or inactive coupon.');
  end if;
  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    return jsonb_build_object('ok',false,'error','Coupon is not active yet.');
  end if;
  if v_coupon.expires_at is not null and now() > v_coupon.expires_at then
    return jsonb_build_object('ok',false,'error','Coupon has expired.');
  end if;
  if v_coupon.minimum_order is not null and v_subtotal < v_coupon.minimum_order then
    return jsonb_build_object('ok',false,'error',format('Minimum order for this coupon is Rs. %s.', to_char(v_coupon.minimum_order,'FM999G999G999G990D00')));
  end if;
  if v_coupon.usage_limit is not null and coalesce(v_coupon.used_count,0) >= v_coupon.usage_limit then
    return jsonb_build_object('ok',false,'error','Coupon usage limit reached.');
  end if;

  if v_coupon.discount_type='percentage' then
    v_discount := round(v_subtotal * least(greatest(v_coupon.discount_value,0),100) / 100,2);
  else
    v_discount := least(greatest(v_coupon.discount_value,0),v_subtotal);
  end if;

  return jsonb_build_object(
    'ok',true,
    'code',v_coupon.code,
    'discount_type',v_coupon.discount_type,
    'discount_value',v_coupon.discount_value,
    'minimum_order',coalesce(v_coupon.minimum_order,0),
    'discount',v_discount
  );
end;
$$;

revoke all on function public.validate_coupon_public(text,numeric) from public;
grant execute on function public.validate_coupon_public(text,numeric) to anon, authenticated;

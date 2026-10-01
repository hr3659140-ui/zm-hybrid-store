-- ZM Hybrid Store V11 Phase 12 — Verified Customer Reviews
-- Run once in Supabase SQL Editor.

drop policy if exists v11_reviews_insert on public.reviews;

create or replace function public.submit_review_secure(
  p_product_id uuid,
  p_rating integer,
  p_title text default null,
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  delivered_order uuid;
  review_id uuid;
begin
  if uid is null then
    raise exception 'Please sign in to submit a review.';
  end if;
  if p_product_id is null then raise exception 'Product is required.'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5.'; end if;
  if length(coalesce(trim(p_body),'')) > 1200 then raise exception 'Review is too long.'; end if;
  if length(coalesce(trim(p_title),'')) > 120 then raise exception 'Review title is too long.'; end if;

  select o.id into delivered_order
  from public.orders o
  join public.order_items oi on oi.order_id=o.id
  where o.customer_id=uid
    and o.status='delivered'
    and oi.product_id=p_product_id
  order by o.created_at desc
  limit 1;

  if delivered_order is null then
    raise exception 'Only customers with a delivered order for this product can review it.';
  end if;

  if exists(select 1 from public.reviews r where r.product_id=p_product_id and r.user_id=uid and r.order_id=delivered_order) then
    raise exception 'You have already reviewed this delivered order.';
  end if;

  insert into public.reviews(product_id,user_id,order_id,rating,title,body,status)
  values(p_product_id,uid,delivered_order,p_rating,nullif(trim(p_title),''),nullif(trim(p_body),''),'pending')
  returning id into review_id;

  return jsonb_build_object('success',true,'review_id',review_id,'status','pending');
end;
$$;

revoke all on function public.submit_review_secure(uuid,integer,text,text) from public;
grant execute on function public.submit_review_secure(uuid,integer,text,text) to anon, authenticated;

notify pgrst, 'reload schema';

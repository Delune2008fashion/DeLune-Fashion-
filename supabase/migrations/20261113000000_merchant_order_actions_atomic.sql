create or replace function public.merchant_update_order_status(
  p_order_id uuid, p_actor_id uuid, p_action text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype; v_payment_status text; v_next_status text;
begin
  if p_action = 'confirm' then
    v_payment_status := 'confirmed'; v_next_status := 'confirmed';
    update public.orders set order_status=v_next_status,updated_at=now()
      where id=p_order_id and order_status in ('payment_pending','payment_not_confirmed')
      returning * into v_order;
    if not found then raise exception 'This order cannot be confirmed from its current status.'; end if;
    update public.payments set status=v_payment_status,verified_by=p_actor_id,verified_at=now() where order_id=p_order_id;
    update public.transactions set status=v_payment_status where order_id=p_order_id;
  elsif p_action = 'reject' then
    v_payment_status := 'not_confirmed'; v_next_status := 'payment_not_confirmed';
    update public.orders set order_status=v_next_status,updated_at=now()
      where id=p_order_id and order_status='payment_pending' returning * into v_order;
    if not found then raise exception 'This order is no longer awaiting payment verification.'; end if;
    update public.payments set status=v_payment_status,verified_by=p_actor_id,verified_at=now() where order_id=p_order_id;
    update public.transactions set status=v_payment_status where order_id=p_order_id;
  elsif p_action = 'mark-shipped' then
    v_next_status := 'shipped';
    update public.orders set order_status=v_next_status,updated_at=now()
      where id=p_order_id and order_status in ('confirmed','processing') returning * into v_order;
    if not found then raise exception 'Only confirmed orders can be marked as shipped.'; end if;
  else raise exception 'Unsupported order status action.';
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_actor_id,case p_action when 'confirm' then 'payment_confirm' when 'reject' then 'payment_reject' else 'order_marked_shipped' end,'order',p_order_id::text,jsonb_build_object('order_code',v_order.order_code,'source','merchant_panel'));
  return jsonb_build_object('success',true,'order_id',v_order.id,'order_code',v_order.order_code,'order_status',v_order.order_status);
end;
$$;
revoke all on function public.merchant_update_order_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.merchant_update_order_status(uuid,uuid,text) to service_role;

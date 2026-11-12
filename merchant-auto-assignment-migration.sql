-- DeLune: automatically route every new order to an active Merchant.
-- Run once in Supabase SQL Editor after delune-commerce-migration.sql.
-- Uses least-loaded active Merchant; an advisory transaction lock prevents
-- simultaneous checkouts from selecting the same least-loaded account.

create or replace function public.assign_delune_order_merchant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Preserve an explicit assignment made by a trusted workflow.
  if new.merchant_id is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('delune:merchant-auto-assignment'));

  select m.user_id
    into new.merchant_id
  from public.merchants m
  where m.is_active = true
  order by
    (select count(*) from public.orders o where o.merchant_id = m.user_id),
    m.created_at,
    m.user_id
  limit 1;

  -- If no Merchant is active, leave the order unassigned.
  return new;
end;
$$;

drop trigger if exists trg_delune_auto_assign_order_merchant on public.orders;
create trigger trg_delune_auto_assign_order_merchant
before insert on public.orders
for each row
execute function public.assign_delune_order_merchant();

-- Repair older orders that were left unassigned when multiple Merchants were active.
-- Existing explicit assignments are never changed.
do $$
declare
  v_order_id uuid;
  v_merchant_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('delune:merchant-auto-assignment'));

  for v_order_id in
    select id
    from public.orders
    where merchant_id is null
    order by created_at, id
  loop
    select m.user_id
      into v_merchant_id
    from public.merchants m
    where m.is_active = true
    order by
      (select count(*) from public.orders o where o.merchant_id = m.user_id),
      m.created_at,
      m.user_id
    limit 1;

    if v_merchant_id is null then
      exit;
    end if;

    update public.orders
       set merchant_id = v_merchant_id,
           updated_at = now()
     where id = v_order_id
       and merchant_id is null;

    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (
      null,
      'system_auto_assigned_order',
      'order',
      v_order_id::text,
      jsonb_build_object('merchant_id', v_merchant_id, 'source', 'merchant_auto_assignment_migration')
    );
  end loop;
end;
$$;

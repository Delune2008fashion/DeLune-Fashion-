-- Permanently remove an order from one Merchant's own history only.
-- The order, payment, transaction, product and audit records remain intact.
create table if not exists public.merchant_order_history_hidden (
  merchant_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (merchant_id, order_id)
);

create index if not exists merchant_order_history_hidden_order_idx
  on public.merchant_order_history_hidden (order_id);

alter table public.merchant_order_history_hidden enable row level security;

drop policy if exists "Merchants read their own hidden order history"
  on public.merchant_order_history_hidden;

create policy "Merchants read their own hidden order history"
  on public.merchant_order_history_hidden
  for select
  to authenticated
  using (merchant_id = auth.uid());

grant select on public.merchant_order_history_hidden to authenticated;

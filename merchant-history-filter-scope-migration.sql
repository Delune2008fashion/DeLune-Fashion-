-- Scope merchant history deletion to the selected list only.
-- This does not delete orders, payments, transactions, or audit history.
alter table public.orders
  add column if not exists merchant_hidden_from_all_at timestamptz,
  add column if not exists merchant_hidden_from_shipped_at timestamptz;

create index if not exists orders_merchant_all_history_visible_idx
  on public.orders (merchant_id, created_at desc)
  where merchant_hidden_from_all_at is null;

create index if not exists orders_merchant_shipped_history_visible_idx
  on public.orders (merchant_id, created_at desc)
  where merchant_hidden_from_shipped_at is null;

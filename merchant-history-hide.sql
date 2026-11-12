-- DeLune merchant-only order history hiding (soft delete).
-- Run once in Supabase SQL Editor. This does NOT delete orders, payments, or transactions.
alter table public.orders
  add column if not exists merchant_hidden_at timestamptz;

create index if not exists orders_merchant_visible_history_idx
  on public.orders (merchant_id, created_at desc)
  where merchant_hidden_at is null;

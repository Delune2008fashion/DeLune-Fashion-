-- Permanently remove an order from every Merchant's visible history.
-- This is a global history tombstone, not a financial-record deletion.
-- Orders, payments, transactions, products and audit logs remain intact.
alter table public.orders
  add column if not exists merchant_history_deleted_at timestamptz;

create index if not exists orders_visible_merchant_history_idx
  on public.orders (created_at desc)
  where merchant_history_deleted_at is null;

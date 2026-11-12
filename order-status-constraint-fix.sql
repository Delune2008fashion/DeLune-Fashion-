-- DeLune order status compatibility fix
-- Run once in Supabase Dashboard -> SQL Editor.
-- Preserves existing order records and permits the statuses used by the merchant workflow.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'pending','payment_pending','confirmed','processing','shipped',
    'delivered','completed','payment_not_confirmed','not_confirmed','cancelled'
  ));

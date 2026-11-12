-- DeLune order status compatibility fix
-- Run once in Supabase Dashboard -> SQL Editor.
-- Keep every status already present in orders, and add all workflow statuses.
DO $$
DECLARE
  allowed_statuses text;
BEGIN
  SELECT string_agg(quote_literal(status_value), ',')
    INTO allowed_statuses
  FROM (
    SELECT DISTINCT order_status AS status_value
    FROM public.orders
    WHERE order_status IS NOT NULL
    UNION
    SELECT unnest(ARRAY[
      'pending','payment_pending','confirmed','processing','shipped',
      'delivered','completed','payment_not_confirmed','not_confirmed','cancelled'
    ]::text[])
  ) AS statuses;

  ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_order_status_check;

  EXECUTE 'ALTER TABLE public.orders
    ADD CONSTRAINT orders_order_status_check
    CHECK (order_status IN (' || allowed_statuses || '))';
END $$;

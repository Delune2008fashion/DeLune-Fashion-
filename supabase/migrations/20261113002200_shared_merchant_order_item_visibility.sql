-- Keep the shared Merchant inbox consistent across both parent orders and their line items.
-- Existing policy only allowed a merchant to read order_items when orders.merchant_id
-- matched auth.uid(); shared orders can intentionally have a null/other merchant_id.
drop policy if exists "DeLune merchant reads assigned items" on public.order_items;

create policy "DeLune active merchants read shared items"
on public.order_items
for select
to authenticated
using (public.is_active_delune_merchant());

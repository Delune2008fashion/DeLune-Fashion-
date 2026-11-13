-- Enable authenticated Merchant/Site Creator subscriptions to newly inserted orders.
-- The browser receives only rows permitted by the existing orders SELECT RLS policies.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

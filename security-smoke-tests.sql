-- DeLune security smoke checks
-- Run in Supabase SQL Editor after applying supabase-schema.sql.
-- Read checks should return zero rows/counts for data outside public visibility.
-- The write checks intentionally catch RLS-denied errors and print PASS notices.

begin;

set local role anon;
select 'PASS if zero' as check_name, count(*) as hidden_products_visible
from public.products where is_available = false;
select 'PASS if zero' as check_name, count(*) as hidden_categories_visible
from public.categories where is_visible = false;
select 'PASS if zero' as check_name, count(*) as private_settings_visible
from public.site_settings where key not in ('hero_image_url','content_texts');

do $$
begin
  begin
    insert into public.products(name,description,price,category)
    values ('RLS-TEST-ANON','must be blocked',1,'test');
    raise exception 'FAIL: anon inserted a product';
  exception when insufficient_privilege then
    raise notice 'PASS: anon product insert blocked by RLS';
  end;
end $$;

rollback;

-- Moderator membership check:
-- 1. Sign in as a normal authenticated user who is NOT in public.moderators.
-- 2. In SQL Editor, replace the UUID below with that user's auth.users.id.
-- 3. Run the following separately. Reads must not expose unavailable products,
--    and writes must be denied. Then repeat with a listed moderator; writes
--    should succeed only for that account.
--
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub','REPLACE_WITH_NON_MODERATOR_UUID',true);
-- select count(*) from public.products where is_available = false; -- expected 0
-- insert into public.products(name,price,category)
-- values ('RLS-TEST-NONMOD','must be blocked',1,'test'); -- expected RLS error
-- rollback;
--
-- Storage check:
-- Try uploading as anon (must fail), as a non-moderator (must fail), and as a
-- listed moderator to a path beginning with that moderator's UUID (must pass).
-- Try an image over 5 MiB or a non-image MIME type (must fail).

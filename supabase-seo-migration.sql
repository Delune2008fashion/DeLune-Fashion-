-- DeLune product SEO fields. Safe to run once (or repeatedly).
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
update public.products
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 8)
where slug is null or slug = '';
create unique index if not exists products_slug_unique_idx on public.products(slug);
create or replace function public.set_product_slug()
returns trigger language plpgsql as $
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g')) || '-' || left(new.id::text, 8);
  end if;
  return new;
end;
$;
drop trigger if exists products_set_slug on public.products;
create trigger products_set_slug before insert or update of name, slug on public.products
for each row execute function public.set_product_slug();

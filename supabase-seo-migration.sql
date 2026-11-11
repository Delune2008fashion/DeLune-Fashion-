-- DeLune product SEO fields. Safe to run once (or repeatedly).
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
update public.products
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 8)
where slug is null or slug = '';
create unique index if not exists products_slug_unique_idx on public.products(slug);

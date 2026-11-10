-- DeLune Supabase schema
-- Run in Supabase SQL Editor. Create moderator users in Supabase Auth manually.
-- Never put the service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  category text not null,
  sizes text[] not null default '{}',
  image_urls text[] not null default '{}',
  is_available boolean not null default true,
  is_exclusive boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;

-- Public can read visible categories and available products only.
create policy "Public read visible categories" on public.categories
  for select using (is_visible = true);
create policy "Public read available products" on public.products
  for select using (is_available = true);

-- Authenticated moderator writes are allowed only to users explicitly listed below.
create table if not exists public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
create policy "Moderator can read own moderator record" on public.moderators
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_delune_moderator()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists(select 1 from public.moderators where user_id = auth.uid()); $$;

create policy "Moderators manage categories" on public.categories
  for all to authenticated
  using (public.is_delune_moderator())
  with check (public.is_delune_moderator());

create policy "Moderators manage products" on public.products
  for all to authenticated
  using (public.is_delune_moderator())
  with check (public.is_delune_moderator());

-- After creating a moderator in Authentication > Users, add their UUID:
-- insert into public.moderators(user_id) values ('AUTH_USER_UUID');

-- Create a PUBLIC storage bucket named product-images in Storage.
-- Storage object policies: allow public SELECT; allow authenticated INSERT/UPDATE/DELETE
-- only when the first folder segment is the authenticated user's UUID AND that user
-- is listed as a DeLune moderator. Apply the following policies:
create policy "Public can view DeLune product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Moderators upload DeLune product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_delune_moderator()
);

create policy "Moderators update own DeLune product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_delune_moderator()
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_delune_moderator()
);

create policy "Moderators delete own DeLune product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_delune_moderator()
);

-- Seed starter categories (safe to run once).
insert into public.categories(name,slug,image_url,sort_order) values
('Sneakers','sneakers','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',1),
('Hoodies','hoodies','https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80',2),
('Jackets','jackets','https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=900&q=80',3),
('T-shirts','t-shirts','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',4)
on conflict(slug) do nothing;

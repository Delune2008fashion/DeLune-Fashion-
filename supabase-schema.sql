-- DeLune Supabase schema
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New query.
-- Create moderator accounts in Authentication -> Users, then add their UUID
-- to public.moderators using the instruction at the bottom.
-- Never put a Supabase service_role key in browser code.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Categories: parent_id NULL = parent category; otherwise subcategory.
-- Existing category records are preserved.
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories
  add column if not exists parent_id uuid
  references public.categories(id) on delete cascade;

create index if not exists categories_parent_id_idx
  on public.categories(parent_id);

-- ---------------------------------------------------------------------------
-- Products: one row per product; image_urls stores multiple photo URLs.
-- category stores the category slug, matching the existing DeLune storefront.
-- ---------------------------------------------------------------------------
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

-- Ensure these fields exist on older installations without overwriting data.
alter table public.products add column if not exists sizes text[] not null default '{}';
alter table public.products add column if not exists image_urls text[] not null default '{}';
alter table public.products add column if not exists is_available boolean not null default true;
alter table public.products add column if not exists is_exclusive boolean not null default false;
alter table public.products add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Moderator allow-list. Add the Auth user UUID after creating the user.
-- ---------------------------------------------------------------------------
create table if not exists public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.moderators enable row level security;

create or replace function public.is_delune_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.moderators
    where user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS for catalog tables. Drop named policies first so this file can be rerun.
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;

drop policy if exists "Public read visible categories" on public.categories;
create policy "Public read visible categories"
  on public.categories for select
  using (is_visible = true);

drop policy if exists "Moderators manage categories" on public.categories;
create policy "Moderators manage categories"
  on public.categories for all to authenticated
  using (public.is_delune_moderator())
  with check (public.is_delune_moderator());

drop policy if exists "Public read available products" on public.products;
create policy "Public read available products"
  on public.products for select
  using (is_available = true);

drop policy if exists "Moderators manage products" on public.products;
create policy "Moderators manage products"
  on public.products for all to authenticated
  using (public.is_delune_moderator())
  with check (public.is_delune_moderator());

drop policy if exists "Moderator can read own moderator record" on public.moderators;
create policy "Moderator can read own moderator record"
  on public.moderators for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Product image storage.
-- In Supabase Storage, create a PUBLIC bucket named: product-images
-- Upload paths should begin with the moderator's auth user UUID.
-- ---------------------------------------------------------------------------
drop policy if exists "Public can view DeLune product images" on storage.objects;
create policy "Public can view DeLune product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Moderators upload DeLune product images" on storage.objects;
create policy "Moderators upload DeLune product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_delune_moderator()
  );

drop policy if exists "Moderators update own DeLune product images" on storage.objects;
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

drop policy if exists "Moderators delete own DeLune product images" on storage.objects;
create policy "Moderators delete own DeLune product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_delune_moderator()
  );

-- ---------------------------------------------------------------------------
-- Optional homepage/site settings, for moderator-managed banner image etc.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_settings enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
  on public.site_settings for select
  using (true);

drop policy if exists "Moderators manage site settings" on public.site_settings;
create policy "Moderators manage site settings"
  on public.site_settings for all to authenticated
  using (public.is_delune_moderator())
  with check (public.is_delune_moderator());

-- Starter parent categories. Existing rows are not overwritten.
insert into public.categories(name, slug, image_url, sort_order, parent_id)
values
  ('Sneakers', 'sneakers', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 1, null),
  ('Hoodies', 'hoodies', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80', 2, null),
  ('Jackets', 'jackets', 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=900&q=80', 3, null),
  ('T-shirts', 't-shirts', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', 4, null),
  ('Perfume', 'perfume', null, 5, null)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- IMPORTANT: after creating the moderator in Authentication -> Users,
-- copy that user's UUID and run this separately, replacing the placeholder:
--
-- insert into public.moderators(user_id)
-- values ('PASTE-AUTH-USER-UUID-HERE')
-- on conflict (user_id) do nothing;
--
-- Storage setup: Supabase Dashboard -> Storage -> New bucket
-- Name: product-images | Public bucket: ON
-- ---------------------------------------------------------------------------

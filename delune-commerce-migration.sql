-- DeLune commerce + independent merchant system.
-- Per-product delivery charge, maintained by moderators.
alter table public.products add column if not exists delivery_charge numeric(12,2) not null default 0 check (delivery_charge >= 0);

-- Run AFTER the current supabase-schema.sql. Safe to rerun by policy names.
create extension if not exists pgcrypto;

create table if not exists public.user_roles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('site_creator','moderator','merchant')),
 created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
create or replace function public.has_delune_role(r text) returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role=r)
 or (r='moderator' and exists(select 1 from public.moderators where user_id=auth.uid())); $$;
create or replace function public.is_delune_site_creator() returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$ select public.has_delune_role('site_creator'); $$;
create or replace function public.is_delune_merchant() returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$ select public.has_delune_role('merchant'); $$;
revoke all on function public.has_delune_role(text) from public,anon;
grant execute on function public.has_delune_role(text) to authenticated;
revoke all on function public.is_delune_site_creator() from public,anon;
grant execute on function public.is_delune_site_creator() to authenticated;
revoke all on function public.is_delune_merchant() from public,anon;
grant execute on function public.is_delune_merchant() to authenticated;

create table if not exists public.merchants(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 is_active boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.merchants enable row level security;
create table if not exists public.merchant_invitations(
 id uuid primary key default gen_random_uuid(),
 email text not null,
 token_hash text not null unique,
 expires_at timestamptz not null,
 used_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.merchant_invitations enable row level security;

create table if not exists public.orders(
 id uuid primary key default gen_random_uuid(),
 order_code text not null unique default ('DL-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
 customer_name text not null,
 customer_phone text not null,
 delivery_address text not null,
 merchant_id uuid references auth.users(id),
 previous_order_id uuid references public.orders(id),
 order_status text not null default 'payment_pending'
  check(order_status in ('payment_pending','payment_not_confirmed','processing','shipped','delivered','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.order_items(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 product_name text not null,
 unit_price numeric(12,2) not null check(unit_price>=0),
 quantity integer not null check(quantity between 1 and 10),
 size text not null default 'One size'
);
create table if not exists public.payments(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id) on delete cascade,
 provider text not null check(provider in ('bkash','nagad')),
 amount numeric(12,2) not null check(amount>=0),
 status text not null default 'submitted' check(status in ('submitted','confirmed','not_confirmed')),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.transactions(
 id uuid primary key default gen_random_uuid(),
 provider text not null check(provider in ('bkash','nagad')),
 transaction_id text not null,
 normalized_transaction_id text not null,
 order_id uuid not null references public.orders(id),
 submitted_at timestamptz not null default now(),
 status text not null default 'submitted' check(status in ('submitted','confirmed','not_confirmed')),
 constraint delune_unique_provider_txn unique(provider,normalized_transaction_id)
);
create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 recipient_phone text not null,
 message text not null,
 status text not null default 'queued' check(status in ('queued','opened','sent','failed')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.tracking(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id) on delete cascade,
 tracking_number text,
 carrier text,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs(
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 entity_type text not null,
 entity_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.tracking enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "DeLune creator reads roles" on public.user_roles;
create policy "DeLune creator reads roles" on public.user_roles for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune user reads own role" on public.user_roles;
create policy "DeLune user reads own role" on public.user_roles for select to authenticated using(user_id=auth.uid());
drop policy if exists "DeLune creator manages merchants" on public.merchants;
create policy "DeLune creator manages merchants" on public.merchants for all to authenticated using(public.is_delune_site_creator()) with check(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads own record" on public.merchants;
create policy "DeLune merchant reads own record" on public.merchants for select to authenticated using(user_id=auth.uid());
drop policy if exists "DeLune creator reads orders" on public.orders;
create policy "DeLune creator reads orders" on public.orders for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads assigned orders" on public.orders;
create policy "DeLune merchant reads assigned orders" on public.orders for select to authenticated using(public.is_delune_merchant() and merchant_id=auth.uid());
drop policy if exists "DeLune creator reads items" on public.order_items;
create policy "DeLune creator reads items" on public.order_items for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads assigned items" on public.order_items;
create policy "DeLune merchant reads assigned items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.merchant_id=auth.uid()));
drop policy if exists "DeLune creator reads payments" on public.payments;
create policy "DeLune creator reads payments" on public.payments for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads assigned payments" on public.payments;
create policy "DeLune merchant reads assigned payments" on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.merchant_id=auth.uid()));
drop policy if exists "DeLune creator reads transactions" on public.transactions;
create policy "DeLune creator reads transactions" on public.transactions for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads assigned transactions" on public.transactions;
create policy "DeLune merchant reads assigned transactions" on public.transactions for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.merchant_id=auth.uid()));
drop policy if exists "DeLune creator reads notifications" on public.notifications;
create policy "DeLune creator reads notifications" on public.notifications for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads assigned notifications" on public.notifications;
create policy "DeLune merchant reads assigned notifications" on public.notifications for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.merchant_id=auth.uid()));
drop policy if exists "DeLune creator reads tracking" on public.tracking;
create policy "DeLune creator reads tracking" on public.tracking for select to authenticated using(public.is_delune_site_creator());
drop policy if exists "DeLune merchant reads assigned tracking" on public.tracking;
create policy "DeLune merchant reads assigned tracking" on public.tracking for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.merchant_id=auth.uid()));
drop policy if exists "DeLune creator reads audit" on public.audit_logs;
create policy "DeLune creator reads audit" on public.audit_logs for select to authenticated using(public.is_delune_site_creator());

-- Public checkout can read only the public payment display settings.
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select
 using(key in ('hero_image_url','content_texts','delivery_charge_bdt','bkash_number','nagad_number'));
-- Moderators can still edit content/banner settings, but not merchant/payment settings.
drop policy if exists "Moderators manage site settings" on public.site_settings;
create policy "Moderators manage site settings" on public.site_settings for all to authenticated
 using(public.is_delune_moderator() and key in ('hero_image_url','content_texts'))
 with check(public.is_delune_moderator() and key in ('hero_image_url','content_texts'));
drop policy if exists "Site Creator manages all settings" on public.site_settings;
create policy "Site Creator manages all settings" on public.site_settings for all to authenticated
 using(public.is_delune_site_creator()) with check(public.is_delune_site_creator());

insert into public.site_settings(key,value) values
 ('delivery_charge_bdt',''),
 ('bkash_number','+8801875312169'),
 ('nagad_number','')
on conflict(key) do nothing;

-- Atomic order/payment/transaction insertion. A duplicate ID rolls back the entire order.
create or replace function public.create_delune_order(
 p_customer_name text,p_customer_phone text,p_delivery_address text,
 p_product_id uuid,p_quantity integer,p_size text,p_provider text,p_transaction_id text,p_delivery_charge numeric
) returns table(order_id uuid,order_code text)
language plpgsql security definer set search_path=public
as $$
declare v_product public.products%rowtype; v_order uuid; v_code text; v_merchant uuid; v_count integer; v_norm text;
begin
 if p_provider not in ('bkash','nagad') then raise exception 'Invalid payment provider'; end if;
 if p_quantity<1 or p_quantity>10 then raise exception 'Invalid quantity'; end if;
 if length(trim(p_transaction_id))<5 then raise exception 'Invalid transaction ID'; end if;
 if length(trim(p_customer_name))=0 or length(trim(p_customer_phone))=0 or length(trim(p_delivery_address))=0 then raise exception 'Customer details required'; end if;
 select * into v_product from public.products where id=p_product_id and is_published=true and is_available=true;
 if not found then raise exception 'Product unavailable'; end if;
 if cardinality(v_product.sizes)>0 and not(p_size=any(v_product.sizes)) then raise exception 'Invalid product size'; end if;
 select count(*) into v_count from public.merchants where is_active=true;
 if v_count=1 then select user_id into v_merchant from public.merchants where is_active=true limit 1; else v_merchant:=null; end if;
 insert into public.orders(customer_name,customer_phone,delivery_address,merchant_id)
 values(trim(p_customer_name),trim(p_customer_phone),trim(p_delivery_address),v_merchant)
 returning id,orders.order_code into v_order,v_code;
 insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,size)
 values(v_order,v_product.id,v_product.name,v_product.price,p_quantity,coalesce(nullif(trim(p_size),''),'One size'));
 insert into public.payments(order_id,provider,amount) values(v_order,p_provider,p_delivery_charge);
 v_norm:=upper(regexp_replace(trim(p_transaction_id),'\s+','','g'));
 insert into public.transactions(provider,transaction_id,normalized_transaction_id,order_id)
 values(p_provider,trim(p_transaction_id),v_norm,v_order);
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(null,'customer_order_submitted','order',v_order::text,jsonb_build_object('provider',p_provider));
 return query select v_order,v_code;
exception when unique_violation then raise exception 'DUPLICATE_TRANSACTION_ID';
end $$;
revoke all on function public.create_delune_order(text,text,text,uuid,integer,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.create_delune_order(text,text,text,uuid,integer,text,text,text,numeric) to service_role;

-- Bootstrap Site Creator: create your own Auth user, then run:
-- insert into public.user_roles(user_id,role) values('YOUR_AUTH_USER_UUID','site_creator')
-- on conflict(user_id) do update set role='site_creator';
-- Merchant/Moderator roles are mutually exclusive. Only this Site Creator can provision merchants.

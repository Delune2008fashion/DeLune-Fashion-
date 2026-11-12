-- DeLune guest multi-product checkout and cart order support
alter table public.orders add column if not exists district text;
alter table public.orders add column if not exists delivery_charge numeric(12,2) not null default 0;
alter table public.orders add column if not exists product_subtotal numeric(12,2) not null default 0;

create or replace function public.create_delune_cart_order(
 p_customer_name text,p_customer_phone text,p_delivery_address text,p_district text,
 p_items jsonb,p_provider text,p_transaction_id text
) returns table(order_id uuid,order_code text,delivery_charge numeric,product_subtotal numeric,total_quantity integer)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_order uuid;v_code text;v_merchant uuid;v_count integer;v_norm text;v_item jsonb;v_product public.products%rowtype;v_qty integer;v_total_qty integer:=0;v_subtotal numeric:=0;v_charge numeric;v_size text;
begin
 if p_provider not in ('bkash','nagad') then raise exception 'Invalid payment provider';end if;
 if length(trim(p_transaction_id))<5 then raise exception 'Invalid transaction ID';end if;
 if length(trim(p_customer_name))=0 or length(trim(p_customer_phone))=0 or length(trim(p_delivery_address))=0 or length(trim(p_district))=0 then raise exception 'Customer details and district are required';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then raise exception 'Cart must contain 1 to 20 items';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;v_size:=coalesce(nullif(trim(v_item->>'size'),''),'One size');
  if v_qty<1 or v_qty>10 then raise exception 'Invalid item quantity';end if;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_published=true and is_available=true;
  if not found then raise exception 'A product in this cart is unavailable';end if;
  if cardinality(v_product.sizes)>0 and not(v_size=any(v_product.sizes)) then raise exception 'Invalid product size';end if;
  v_total_qty:=v_total_qty+v_qty;v_subtotal:=v_subtotal+(v_product.price*v_qty);
 end loop;
 if v_total_qty=1 then v_charge:=case when lower(trim(p_district))='dhaka' then 80 else 140 end;
 else v_charge:=case when lower(trim(p_district))='dhaka' then 100 else 200 end;end if;
 select count(*) into v_count from public.merchants where is_active=true;
 if v_count=1 then select user_id into v_merchant from public.merchants where is_active=true limit 1;else v_merchant:=null;end if;
 insert into public.orders(customer_name,customer_phone,delivery_address,merchant_id,district,delivery_charge,product_subtotal)
 values(trim(p_customer_name),trim(p_customer_phone),trim(p_delivery_address),v_merchant,trim(p_district),v_charge,v_subtotal)
 returning id,orders.order_code into v_order,v_code;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;v_size:=coalesce(nullif(trim(v_item->>'size'),''),'One size');
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid;
  insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,size) values(v_order,v_product.id,v_product.name,v_product.price,v_qty,v_size);
 end loop;
 insert into public.payments(order_id,provider,amount) values(v_order,p_provider,v_charge);
 v_norm:=upper(regexp_replace(trim(p_transaction_id),'\s+','','g'));
 insert into public.transactions(provider,transaction_id,normalized_transaction_id,order_id) values(p_provider,trim(p_transaction_id),v_norm,v_order);
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(null,'customer_cart_order_submitted','order',v_order::text,jsonb_build_object('district',p_district,'total_quantity',v_total_qty,'product_subtotal',v_subtotal,'delivery_charge',v_charge,'source','guest_cart'));
 return query select v_order,v_code,v_charge,v_subtotal,v_total_qty;
exception when unique_violation then raise exception 'DUPLICATE_TRANSACTION_ID';
end $$;
revoke all on function public.create_delune_cart_order(text,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_delune_cart_order(text,text,text,text,jsonb,text,text) to service_role;

-- Allow merchants to inspect the immutable activity history for their own assigned orders.
drop policy if exists "DeLune merchant reads own order audit" on public.audit_logs;
create policy "DeLune merchant reads own order audit" on public.audit_logs
for select to authenticated
using(public.is_delune_merchant() and entity_type='order' and exists(
 select 1 from public.orders o where o.id::text=entity_id and o.merchant_id=auth.uid()
));

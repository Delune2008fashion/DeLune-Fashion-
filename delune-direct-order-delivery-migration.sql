-- Direct single-product checkout: calculate delivery charge from district and total quantity.
create or replace function public.create_delune_order(
 p_customer_name text,p_customer_phone text,p_delivery_address text,p_district text,
 p_product_id uuid,p_quantity integer,p_size text,p_provider text,p_transaction_id text
) returns table(order_id uuid,order_code text,delivery_charge numeric)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_product public.products%rowtype;v_order uuid;v_code text;v_merchant uuid;v_count integer;v_norm text;v_charge numeric;
begin
 if p_provider not in ('bkash','nagad') then raise exception 'Invalid payment provider';end if;
 if p_quantity<1 or p_quantity>10 then raise exception 'Invalid quantity';end if;
 if length(trim(p_transaction_id))<5 then raise exception 'Invalid transaction ID';end if;
 if length(trim(p_customer_name))=0 or length(trim(p_customer_phone))=0 or length(trim(p_delivery_address))=0 or length(trim(p_district))=0 then raise exception 'Customer details and district are required';end if;
 select * into v_product from public.products where id=p_product_id and is_published=true and is_available=true;
 if not found then raise exception 'Product unavailable';end if;
 if cardinality(v_product.sizes)>0 and not(p_size=any(v_product.sizes)) then raise exception 'Invalid product size';end if;
 if p_quantity=1 then v_charge:=case when lower(trim(p_district))='dhaka' then 80 else 140 end;
 else v_charge:=case when lower(trim(p_district))='dhaka' then 100 else 200 end;end if;
 select count(*) into v_count from public.merchants where is_active=true;
 if v_count=1 then select user_id into v_merchant from public.merchants where is_active=true limit 1;else v_merchant:=null;end if;
 insert into public.orders(customer_name,customer_phone,delivery_address,merchant_id,district,delivery_charge,product_subtotal)
 values(trim(p_customer_name),trim(p_customer_phone),trim(p_delivery_address),v_merchant,trim(p_district),v_charge,v_product.price*p_quantity)
 returning id,orders.order_code into v_order,v_code;
 insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,size)
 values(v_order,v_product.id,v_product.name,v_product.price,p_quantity,coalesce(nullif(trim(p_size),''),'One size'));
 insert into public.payments(order_id,provider,amount) values(v_order,p_provider,v_charge);
 v_norm:=upper(regexp_replace(trim(p_transaction_id),'[[:space:]]+','','g'));
 insert into public.transactions(provider,transaction_id,normalized_transaction_id,order_id)
 values(p_provider,trim(p_transaction_id),v_norm,v_order);
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(null,'customer_order_submitted','order',v_order::text,jsonb_build_object('provider',p_provider,'district',p_district,'quantity',p_quantity,'delivery_charge',v_charge,'source','direct_order'));
 return query select v_order,v_code,v_charge;
exception when unique_violation then raise exception 'DUPLICATE_TRANSACTION_ID';
end $$;
revoke all on function public.create_delune_order(text,text,text,text,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.create_delune_order(text,text,text,text,uuid,integer,text,text,text) to service_role;

-- OFFLINE ONLY. Apply after coupon validation; website project only.
begin;
create table public.order_requests (
  idempotency_key uuid primary key,
  request jsonb not null,
  response jsonb,
  created_at timestamptz not null default now()
);
alter table public.order_requests enable row level security;
alter table public.order_requests force row level security;
revoke all on public.order_requests from public, anon, authenticated;
grant select, insert, update on public.order_requests to service_role;

create function public.lookup_order_request(p_key uuid, p_request jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.order_requests%rowtype;
begin
  select * into saved from public.order_requests where idempotency_key=p_key;
  if found then
    if saved.request is distinct from p_request then
      raise exception using errcode='P0002', message='Order request conflict.';
    end if;
    if saved.response is not null then return saved.response || '{"duplicate":true}'::jsonb; end if;
  end if;
  -- Legacy orders have no trustworthy fingerprint. Do not rewrite or duplicate
  -- them, or return their details based solely on possession of an old key.
  if exists(select 1 from public.normal_orders where idempotency_key::text=p_key::text)
     or exists(select 1 from public.bulk_orders where idempotency_key::text=p_key::text) then
    raise exception using errcode='P0002', message='Order request conflict.';
  end if;
  return null;
end;
$$;

create function public.create_order_atomic(p_key uuid, p_request jsonb, p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.order_requests%rowtype;
  result jsonb;
  order_data jsonb;
  customer_id_json jsonb;
  line jsonb;
  product record;
  expected_items jsonb;
  subtotal numeric := 0;
  quantity_sum numeric := 0;
  q numeric;
  discount numeric := 0;
  quote jsonb;
  order_table text;
  item_table text;
  columns_sql text;
  kind text := p_request->>'type';
begin
  if p_key is null or kind is null or kind not in ('normal','bulk')
     or jsonb_typeof(p_request) is distinct from 'object'
     or jsonb_typeof(p_order) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode='P0001', message='Invalid order request.';
  end if;
  -- Unique key insertion waits for another transaction using this same key.
  -- A failed transaction rolls this row back together with all order writes.
  insert into public.order_requests(idempotency_key,request) values(p_key,p_request)
    on conflict(idempotency_key) do nothing;
  select * into saved from public.order_requests where idempotency_key=p_key for update;
  if saved.request is distinct from p_request then
    raise exception using errcode='P0002', message='Order request conflict.';
  end if;
  if saved.response is not null then return saved.response || '{"duplicate":true}'::jsonb; end if;
  perform public.lookup_order_request(p_key,p_request);
  if jsonb_array_length(p_items) not between 1 and 60 then
    raise exception using errcode='P0001', message='Invalid order request.';
  end if;
  -- Match the canonical request to the server-built lines, not browser prices.
  select jsonb_agg(jsonb_build_object('id',v->>'product_id','qty',(v->>'quantity')::numeric) order by (v->>'product_id') collate "C")
    into expected_items from jsonb_array_elements(p_items) v;
  if expected_items is distinct from p_request->'items' then
    raise exception using errcode='P0001', message='Invalid order request.';
  end if;
  for line in select value from jsonb_array_elements(p_items) loop
    q := (line->>'quantity')::numeric;
    if q is null or q<=0 or q<>trunc(q) then
      raise exception using errcode='P0001', message='Invalid order request.';
    end if;
    quantity_sum := quantity_sum+q;
    if quantity_sum > (case when kind='bulk' then 500 else 50 end) then
      raise exception using errcode='P0001', message='Invalid order request.';
    end if;
    -- Keep catalogue values stable through this transaction, in sorted order.
    select id, name, price into product from public.products
      where id::text=line->>'product_id' and active and order_type=kind for share;
    if not found or product.price is null or product.price<=0 or product.price>99999999.99
       or product.price::text in ('NaN','Infinity','-Infinity')
       or product.price*100<>trunc(product.price*100)
       or (line->>'unit_price')::numeric is distinct from product.price
       or (line->>'line_total')::numeric is distinct from product.price*q
       or line->>'product_name' is distinct from product.name then
      raise exception using errcode='P0001', message='Order pricing changed.';
    end if;
    subtotal := subtotal+product.price*100*q;
  end loop;
  if subtotal<=0 or subtotal>9999999999 then
    raise exception using errcode='P0001', message='Invalid order total.';
  end if;
  if nullif(p_request->>'coupon_code','') is not null then
    quote := public.quote_coupon(p_request->>'coupon_code',kind,p_request->>'phone',p_request->'items');
    discount := (quote->>'discount_paise')::numeric;
    if (quote->>'subtotal_paise')::numeric is distinct from subtotal then
      raise exception using errcode='P0001', message='Order pricing changed.';
    end if;
  end if;
  if (p_order->>'subtotal')::numeric is distinct from subtotal/100
     or (p_order->>'discount')::numeric is distinct from discount/100
     or (p_order->>'total')::numeric is distinct from (subtotal-discount)/100
     or (p_order->>'delivery_fee')::numeric is distinct from 0::numeric
     or subtotal-discount<=0 then
    raise exception using errcode='P0001', message='Order pricing changed.';
  end if;
  -- Copy identity/delivery/payment fields exclusively from normalized request.
  order_data := p_request - 'type' - 'items' || jsonb_build_object(
    'subtotal',subtotal/100,'discount',discount/100,'total',(subtotal-discount)/100,
    'delivery_fee',0,'payment_status','pending','payment_method','upi',
    'idempotency_key',p_key,'coupon_items',p_request->'items');
  insert into public.customers(phone,name) values(p_request->>'phone',p_request->>'name')
    on conflict(phone) do update set name=excluded.name returning to_jsonb(id) into customer_id_json;
  order_data := order_data || jsonb_build_object('customer_id',customer_id_json);
  order_table := case when kind='normal' then 'normal_orders' else 'bulk_orders' end;
  item_table := case when kind='normal' then 'normal_order_items' else 'bulk_order_items' end;
  columns_sql := 'customer_id,name,phone,address,notes,subtotal,coupon_code,discount,delivery_fee,total,payment_method,payment_status,idempotency_key,coupon_items,' ||
    case when kind='normal' then 'pincode,delivery_slot' else 'event_type,delivery_datetime' end;
  -- jsonb_populate_record preserves the existing UUID/bigint column types.
  -- Explicit column lists preserve defaults and never let input set an ID.
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I.*)',order_table,columns_sql,columns_sql,order_table,order_table)
    into result using order_data;
  for line in select value from jsonb_array_elements(p_items) loop
    execute format('insert into public.%I(product_id,product_name,unit_price,quantity,line_total,order_id) select product_id,product_name,unit_price,quantity,line_total,order_id from jsonb_populate_record(null::public.%I,$1)',item_table,item_table)
      using line || jsonb_build_object('order_id',result->'id');
  end loop;
  result := jsonb_build_object('success',true,'order_number',result->'order_number','total',result->'total');
  update public.order_requests set response=result where idempotency_key=p_key;
  return result;
end;
$$;
revoke all on function public.lookup_order_request(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.create_order_atomic(uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.lookup_order_request(uuid,jsonb) to service_role;
grant execute on function public.create_order_atomic(uuid,jsonb,jsonb,jsonb) to service_role;
commit;

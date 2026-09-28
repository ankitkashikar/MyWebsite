-- Development migration. No default delivery rules: checkout fails closed.
begin;
create table public.delivery_rules (
 order_type text primary key check(order_type in ('normal','bulk')),
 fee_paise bigint not null check(fee_paise between 0 and 9999999999),
 free_above_paise bigint check(free_above_paise between 0 and 9999999999),
 enabled boolean not null default false,
 deleted boolean not null default false,
 version integer not null check(version>0),
 updated_at timestamptz not null default now()
);
create table public.delivery_rule_events (
 id bigint generated always as identity primary key,
 order_type text not null, action text not null, actor uuid not null,
 before_rule jsonb, after_rule jsonb, created_at timestamptz not null default now()
);
alter table public.delivery_rules enable row level security;
alter table public.delivery_rules force row level security;
alter table public.delivery_rule_events enable row level security;
alter table public.delivery_rule_events force row level security;
revoke all on public.delivery_rules, public.delivery_rule_events from public, anon, authenticated;
grant select,insert,update on public.delivery_rules to service_role;
grant select,insert on public.delivery_rule_events to service_role;
grant usage on sequence public.delivery_rule_events_id_seq to service_role;

create function public.manage_delivery_rule(p_type text,p_action text,p_version integer,p_fee bigint,p_free bigint,p_enabled boolean,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.delivery_rules%rowtype; result public.delivery_rules%rowtype;
begin
 if p_type is null or p_type not in ('normal','bulk') or p_action is null or p_action not in ('save','delete') or p_actor is null or p_version is null then
  raise exception using errcode='P0001',message='Invalid rule.';
 end if;
 perform pg_advisory_xact_lock(hashtext('delivery-rule:'||p_type));
 select * into old from public.delivery_rules where order_type=p_type for update;
 if coalesce(old.version,0)<>p_version then raise exception using errcode='P0002',message='Rule changed. Reload settings.'; end if;
 if p_action='delete' then
  if old.order_type is null or old.deleted then raise exception using errcode='P0001',message='No rule to delete.'; end if;
  update public.delivery_rules set enabled=false,deleted=true,version=version+1,updated_at=now() where order_type=p_type returning * into result;
 else
  if p_fee is null or p_enabled is null then raise exception using errcode='P0001',message='Invalid rule.'; end if;
  insert into public.delivery_rules values(p_type,p_fee,p_free,p_enabled,false,coalesce(old.version,0)+1,now())
   on conflict(order_type) do update set fee_paise=excluded.fee_paise,free_above_paise=excluded.free_above_paise,
    enabled=excluded.enabled,deleted=false,version=excluded.version,updated_at=now() returning * into result;
 end if;
 insert into public.delivery_rule_events(order_type,action,actor,before_rule,after_rule)
 values(p_type,p_action,p_actor,case when old.order_type is null then null else to_jsonb(old) end,to_jsonb(result));
 return to_jsonb(result);
end; $$;

create function public.quote_delivery_fee(p_type text,p_net bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rule public.delivery_rules%rowtype;
begin
 select * into rule from public.delivery_rules where order_type=p_type for share;
 if not found or not rule.enabled or rule.deleted then
  raise exception using errcode='P0003',message='Delivery is not configured.';
 end if;
 if p_net is null or p_net<=0 or p_net>9999999999 then raise exception using errcode='P0001',message='Invalid subtotal.'; end if;
 return jsonb_build_object('version',rule.version,'fee_paise',case when rule.free_above_paise is not null and p_net>=rule.free_above_paise then 0 else rule.fee_paise end);
end; $$;
revoke all on function public.manage_delivery_rule(text,text,integer,bigint,bigint,boolean,uuid),public.quote_delivery_fee(text,bigint) from public,anon,authenticated;
grant execute on function public.manage_delivery_rule(text,text,integer,bigint,bigint,boolean,uuid),public.quote_delivery_fee(text,bigint) to service_role;
alter table public.normal_orders add column delivery_rule_version integer;
alter table public.bulk_orders add column delivery_rule_version integer;
create or replace function public.create_order_atomic(p_key uuid, p_request jsonb, p_order jsonb, p_items jsonb)
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
  delivery jsonb;
  fee numeric;
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
  delivery := public.quote_delivery_fee(kind,(subtotal-discount)::bigint);
  fee := (delivery->>'fee_paise')::numeric;
  if (p_request->>'delivery_version')::integer is distinct from (delivery->>'version')::integer
     or (p_request->>'expected_total_paise')::numeric is distinct from subtotal-discount+fee then
    raise exception using errcode='P0002',message='Delivery pricing changed. Review checkout.';
  end if;
  if (p_order->>'subtotal')::numeric is distinct from subtotal/100
     or (p_order->>'discount')::numeric is distinct from discount/100
     or (p_order->>'total')::numeric is distinct from (subtotal-discount+fee)/100
     or (p_order->>'delivery_fee')::numeric is distinct from fee/100
     or subtotal-discount<=0 then
    raise exception using errcode='P0001', message='Order pricing changed.';
  end if;
  -- Copy identity/delivery/payment fields exclusively from normalized request.
  order_data := p_request - 'type' - 'items' - 'delivery_version' - 'expected_total_paise' || jsonb_build_object(
    'subtotal',subtotal/100,'discount',discount/100,'total',(subtotal-discount+fee)/100,
    'delivery_fee',fee/100,'delivery_rule_version',(delivery->>'version')::integer,'payment_status','pending','payment_method','upi',
    'idempotency_key',p_key,'coupon_items',p_request->'items');
  if kind='bulk' and (order_data->>'delivery_datetime') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    order_data := order_data || jsonb_build_object('delivery_datetime',(order_data->>'delivery_datetime')||':00+05:30');
  end if;
  insert into public.customers(phone,name) values(p_request->>'phone',p_request->>'name')
    on conflict(phone) do update set name=excluded.name returning to_jsonb(id) into customer_id_json;
  order_data := order_data || jsonb_build_object('customer_id',customer_id_json);
  order_table := case when kind='normal' then 'normal_orders' else 'bulk_orders' end;
  item_table := case when kind='normal' then 'normal_order_items' else 'bulk_order_items' end;
  columns_sql := 'customer_id,name,phone,address,notes,subtotal,coupon_code,discount,delivery_fee,delivery_rule_version,total,payment_method,payment_status,idempotency_key,coupon_items,' ||
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
create or replace function public.enforce_order_coupon()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare q jsonb;
begin
  if new.coupon_code is null then return new; end if;
  q := public.quote_coupon(new.coupon_code,
       case when tg_table_name = 'normal_orders' then 'normal' else 'bulk' end,
       new.phone, new.coupon_items);
  -- Reject prices/policies changed since quote, rather than save stale totals.
  if new.subtotal is distinct from (q->>'subtotal_paise')::numeric / 100
     or new.discount is distinct from (q->>'discount_paise')::numeric / 100
     or new.total is distinct from (q->>'total_paise')::numeric / 100 + new.delivery_fee
     or new.payment_status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  return new;
end;
$$;
commit;

-- Development only. Preserves historical coupon codes and order amounts.
begin;
alter table public.coupons add column version integer not null default 1 check(version>0);
alter table public.coupons add column deleted_at timestamptz;
create table public.coupon_admin_events (
 id bigint generated always as identity primary key,
 code text not null, action text not null, actor uuid not null,
 before_coupon jsonb, after_coupon jsonb not null, created_at timestamptz not null default now()
);
alter table public.coupon_admin_events enable row level security;
alter table public.coupon_admin_events force row level security;
revoke all on public.coupon_admin_events from public,anon,authenticated;
grant select,insert on public.coupon_admin_events to service_role;
grant usage on sequence public.coupon_admin_events_id_seq to service_role;

create function public.manage_coupon(p_code text,p_action text,p_version integer,p_changes jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.coupons%rowtype; next public.coupons%rowtype; saved public.coupons%rowtype;
begin
 if p_code is null or p_code !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' or p_actor is null or p_version is null
 or p_action is null or p_action not in ('save','toggle','delete') then
  raise exception using errcode='P0001',message='Invalid coupon.';
 end if;
 perform pg_advisory_xact_lock(hashtext('coupon-admin:'||p_code));
 select * into old from public.coupons where code=p_code for update;
 if old.deleted_at is not null then raise exception using errcode='P0001',message='Deleted coupon codes cannot be reused.'; end if;
 if coalesce(old.version,0)<>p_version then raise exception using errcode='P0002',message='Coupon changed. Reload first.'; end if;
 if p_action='save' then
  if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('active','kind','value','min_subtotal_paise','order_type','max_discount_paise','usage_limit','per_phone_limit')) then
   raise exception using errcode='P0001',message='Invalid coupon fields.';
  end if;
  next := jsonb_populate_record(null::public.coupons,
   (case when old.code is null then '{"active":false,"min_subtotal_paise":0}'::jsonb else to_jsonb(old) end)
   || p_changes || jsonb_build_object('code',p_code,'version',coalesce(old.version,0)+1));
  insert into public.coupons select (next).* on conflict(code) do update set
    active=excluded.active,kind=excluded.kind,value=excluded.value,min_subtotal_paise=excluded.min_subtotal_paise,
    order_type=excluded.order_type,max_discount_paise=excluded.max_discount_paise,
    usage_limit=excluded.usage_limit,per_phone_limit=excluded.per_phone_limit,version=excluded.version
    returning * into saved;
 else
  if old.code is null then raise exception using errcode='P0001',message='Coupon not found.'; end if;
  if p_action='toggle' then
   if jsonb_typeof(p_changes->'active') is distinct from 'boolean' then raise exception using errcode='P0001',message='Invalid status.'; end if;
   update public.coupons set active=(p_changes->>'active')::boolean,version=version+1 where code=p_code returning * into saved;
  else
   update public.coupons set active=false,deleted_at=now(),version=version+1 where code=p_code returning * into saved;
  end if;
 end if;
 insert into public.coupon_admin_events(code,action,actor,before_coupon,after_coupon)
 values(p_code,p_action,p_actor,case when old.code is null then null else to_jsonb(old) end,to_jsonb(saved));
 return to_jsonb(saved);
end; $$;
revoke all on function public.manage_coupon(text,text,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.manage_coupon(text,text,integer,jsonb,uuid) to service_role;
create or replace function public.quote_coupon(p_code text, p_type text, p_phone text, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.coupons%rowtype;
  item record;
  p record;
  qty numeric;
  quantity_sum numeric := 0;
  subtotal numeric := 0;
  eligible numeric := 0;
  amount numeric;
  reduction numeric;
  uses bigint;
  phone_uses bigint;
  now_at timestamptz;
begin
  if p_code is null or p_code !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'
     or p_type is null or p_type not in ('normal','bulk')
     or p_phone is null or p_phone !~ '^[6-9][0-9]{9}$'
     or p_phone ~ '^([0-9])\1{9}$' or p_phone = '9876543210'
     or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  if jsonb_array_length(p_items) not between 1 and 60 then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  -- Locks final order attempts for this code until their transaction finishes.
  -- Preview calls release the lock without consuming a use.
  select * into c from public.coupons where code = p_code for update;
  now_at := clock_timestamp();
  if not found or c.deleted_at is not null or not c.active or (c.starts_at is not null and now_at < c.starts_at)
     or (c.ends_at is not null and now_at >= c.ends_at)
     or (c.order_type is not null and c.order_type <> p_type) then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  for item in select value as j from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item.j->'id') is distinct from 'string'
       or jsonb_typeof(item.j->'qty') is distinct from 'number' then
      raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
    end if;
    qty := (item.j->>'qty')::numeric;
    if qty <= 0 or qty <> trunc(qty) then
      raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
    end if;
    quantity_sum := quantity_sum + qty;
    if quantity_sum > (case when p_type = 'bulk' then 500 else 50 end) then
      raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
    end if;
    select id::text as id, price into p from public.products
      where id::text = item.j->>'id' and active = true and order_type = p_type;
    if not found or p.price is null or p.price <= 0 or p.price > 99999999.99
       or p.price::text in ('NaN','Infinity','-Infinity') or p.price * 100 <> trunc(p.price * 100) then
      raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
    end if;
    amount := p.price * 100 * qty;
    subtotal := subtotal + amount;
    if subtotal > 9999999999 then
      raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
    end if;
    if (c.product_ids is null or p.id = any(c.product_ids))
       and (c.categories is null or exists (
         select 1 from public.coupon_product_categories m
         where m.product_id = p.id and m.category = any(c.categories))) then
      eligible := eligible + amount;
    end if;
  end loop;
  if subtotal < c.min_subtotal_paise or eligible <= 0 then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  select count(*), count(*) filter (where phone = p_phone) into uses, phone_uses
  from (select phone from public.normal_orders where coupon_code = p_code
        union all select phone from public.bulk_orders where coupon_code = p_code) orders;
  if (c.usage_limit is not null and uses >= c.usage_limit)
     or (c.per_phone_limit is not null and phone_uses >= c.per_phone_limit) then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  -- Floor fractions of a paise; never round up a percentage discount.
  reduction := case when c.kind = 'flat' then c.value else floor(eligible * c.value / 10000) end;
  reduction := least(reduction, eligible, coalesce(c.max_discount_paise, 9999999999));
  if reduction <= 0 or subtotal - reduction <= 0 then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  return jsonb_build_object('subtotal_paise', subtotal, 'discount_paise', reduction,
                           'total_paise', subtotal - reduction);
end;
$$;
NOTIFY pgrst, 'reload schema';
commit;

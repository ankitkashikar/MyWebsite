-- OFFLINE DEVELOPMENT: website project only. No promotions are seeded.
begin;
create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  order_type text check (order_type in ('normal','bulk')),
  kind text not null check (kind in ('flat','percent')),
  -- Flat values are paise; percentages are basis points (1000 = 10%).
  value bigint not null check (value > 0 and value <= 9999999999),
  min_subtotal_paise bigint not null default 0 check (min_subtotal_paise between 0 and 9999999999),
  max_discount_paise bigint check (max_discount_paise between 1 and 9999999999),
  product_ids text[],
  categories text[],
  usage_limit integer check (usage_limit > 0),
  per_phone_limit integer check (per_phone_limit > 0),
  check (kind <> 'percent' or value <= 10000),
  check (starts_at is null or ends_at is null or starts_at < ends_at),
  check (product_ids is null or cardinality(product_ids) > 0),
  check (categories is null or cardinality(categories) > 0)
);
-- Independent mapping: no assumptions about legacy product category columns.
create table public.coupon_product_categories (
  product_id text not null,
  category text not null check (length(category) between 1 and 80),
  primary key (product_id, category)
);
alter table public.coupons enable row level security;
alter table public.coupons force row level security;
alter table public.coupon_product_categories enable row level security;
alter table public.coupon_product_categories force row level security;
revoke all on public.coupons, public.coupon_product_categories from public, anon, authenticated;
grant select, insert, update, delete on public.coupons, public.coupon_product_categories to service_role;
alter table public.normal_orders add column coupon_items jsonb;
alter table public.bulk_orders add column coupon_items jsonb;
create index normal_orders_coupon_usage_idx on public.normal_orders(coupon_code, phone);
create index bulk_orders_coupon_usage_idx on public.bulk_orders(coupon_code, phone);

-- No browser monetary values enter this service-role-only function.
create function public.quote_coupon(p_code text, p_type text, p_phone text, p_items jsonb)
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
  if not found or not c.active or (c.starts_at is not null and now_at < c.starts_at)
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
revoke all on function public.quote_coupon(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.quote_coupon(text,text,text,jsonb) to service_role;

create function public.enforce_order_coupon()
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
     or new.total is distinct from (q->>'total_paise')::numeric / 100
     or new.delivery_fee is distinct from 0::numeric
     or new.payment_status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Coupon is not available for this order.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_order_coupon() from public, anon, authenticated;
grant execute on function public.enforce_order_coupon() to service_role;
create trigger normal_order_coupon_guard before insert on public.normal_orders
  for each row execute function public.enforce_order_coupon();
create trigger bulk_order_coupon_guard before insert on public.bulk_orders
  for each row execute function public.enforce_order_coupon();
commit;

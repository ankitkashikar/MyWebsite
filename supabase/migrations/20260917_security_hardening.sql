-- The Chinese Bliss — website order-system security hardening
-- Apply AFTER 20260916_order_operations.sql on the WEBSITE Supabase project.
-- This migration intentionally blocks direct browser access to order/customer
-- tables. Browser clients must use the Edge Functions instead.

begin;

-- ---------------------------------------------------------------------
-- 1. Lock sensitive tables behind RLS and revoke Data API privileges
--    from anon/authenticated. service_role remains server-side only.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers',
    'products',
    'normal_orders',
    'normal_order_items',
    'bulk_orders',
    'bulk_order_items',
    'order_status_events'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Idempotency must also be enforced by the database, not only by a
--    client-side lookup. Abort deployment if duplicate keys already exist
--    so production data can be reviewed instead of silently modified.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.normal_orders') is not null then
    if exists (
      select 1 from public.normal_orders
      where idempotency_key is not null
      group by idempotency_key having count(*) > 1
    ) then
      raise exception 'normal_orders contains duplicate idempotency_key values; review before applying security migration';
    end if;
    execute 'create unique index if not exists normal_orders_idempotency_key_uidx on public.normal_orders (idempotency_key) where idempotency_key is not null';
  end if;

  if to_regclass('public.bulk_orders') is not null then
    if exists (
      select 1 from public.bulk_orders
      where idempotency_key is not null
      group by idempotency_key having count(*) > 1
    ) then
      raise exception 'bulk_orders contains duplicate idempotency_key values; review before applying security migration';
    end if;
    execute 'create unique index if not exists bulk_orders_idempotency_key_uidx on public.bulk_orders (idempotency_key) where idempotency_key is not null';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Server-side API rate-limit state. No browser role may access it.
-- ---------------------------------------------------------------------
create table if not exists public.api_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default clock_timestamp(),
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.api_rate_limits enable row level security;
revoke all privileges on table public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  started timestamptz;
  hits integer;
  duration interval;
begin
  if p_bucket is null or length(p_bucket) < 8 or length(p_bucket) > 220 then
    raise exception 'invalid rate-limit bucket';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate-limit limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window';
  end if;

  duration := make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits(bucket, window_started_at, hit_count, updated_at)
  values (p_bucket, now_ts, 1, now_ts)
  on conflict (bucket) do update
  set
    window_started_at = case
      when public.api_rate_limits.window_started_at + duration <= now_ts then now_ts
      else public.api_rate_limits.window_started_at
    end,
    hit_count = case
      when public.api_rate_limits.window_started_at + duration <= now_ts then 1
      else public.api_rate_limits.hit_count + 1
    end,
    updated_at = now_ts
  returning window_started_at, hit_count into started, hits;

  allowed := hits <= p_limit;
  remaining := greatest(p_limit - hits, 0);
  reset_at := started + duration;
  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

create index if not exists api_rate_limits_updated_idx on public.api_rate_limits(updated_at);

-- ---------------------------------------------------------------------
-- 4. Security/operations audit trail for privileged actions.
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_events (
  id bigint generated by default as identity primary key,
  order_type text check (order_type in ('normal', 'bulk')),
  order_id text,
  order_number text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  changed_by text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_events enable row level security;
revoke all privileges on table public.admin_audit_events from anon, authenticated;
create index if not exists admin_audit_events_order_idx
  on public.admin_audit_events(order_type, order_id, created_at desc);
create index if not exists admin_audit_events_created_idx
  on public.admin_audit_events(created_at desc);

commit;

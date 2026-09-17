-- The Chinese Bliss — production security hardening
-- Apply after the base schema/order operations migration.
-- Browser code must never have direct access to sensitive operational data.
--
-- STEP 1B NOTE:
-- This migration was reviewed against live project ncbyfovvetvmkrlzapku.
-- It preserves existing order data and does not rewrite historical payment
-- methods/statuses. The public order Edge Function remains authoritative for
-- accepting new payment methods.

begin;

-- Deny direct browser access to customer/order/product operational tables.
-- Trusted Edge Functions use the service_role and remain the only application
-- readers/writers for these tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','products','normal_orders','normal_order_items',
    'bulk_orders','bulk_order_items','order_status_events'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);
      execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Lock down the existing trigger helpers' search_path. They are SECURITY
-- INVOKER functions and use objects in pg_catalog/public only.
do $$
begin
  if to_regprocedure('public.generate_normal_order_number()') is not null then
    alter function public.generate_normal_order_number() set search_path = pg_catalog, public;
    revoke all on function public.generate_normal_order_number() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.generate_bulk_order_number()') is not null then
    alter function public.generate_bulk_order_number() set search_path = pg_catalog, public;
    revoke all on function public.generate_bulk_order_number() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.touch_updated_at()') is not null then
    alter function public.touch_updated_at() set search_path = pg_catalog, public;
    revoke all on function public.touch_updated_at() from public, anon, authenticated;
  end if;
end $$;

-- Edge Functions send only a SHA-256 key derived from endpoint + client
-- address. Raw client IP addresses are not stored here.
create table if not exists public.security_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;
alter table public.security_rate_limits force row level security;
revoke all privileges on table public.security_rate_limits from public, anon, authenticated;
grant select, insert, update on table public.security_rate_limits to service_role;

-- SECURITY INVOKER is sufficient here: only service_role can execute the RPC,
-- and service_role has the table privileges required for the atomic upsert.
create or replace function public.consume_security_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
begin
  if p_key is null or pg_catalog.length(p_key) < 16 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.security_rate_limits(key, window_started_at, request_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update set
    window_started_at = case
      when public.security_rate_limits.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds)
      then v_now else public.security_rate_limits.window_started_at end,
    request_count = case
      when public.security_rate_limits.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds)
      then 1 else public.security_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, integer, integer) to service_role;

-- Database-side payment-status invariants. Production already had constraints
-- with these names but an older value set, so replace them explicitly instead
-- of silently skipping by name. Existing production rows were preflighted and
-- are compatible with this set.
do $$
begin
  if to_regclass('public.normal_orders') is not null then
    alter table public.normal_orders drop constraint if exists normal_orders_payment_status_check;
    alter table public.normal_orders add constraint normal_orders_payment_status_check
      check (payment_status in ('pending','paid','failed','refund_pending','refunded','partially_refunded'));
  end if;

  if to_regclass('public.bulk_orders') is not null then
    alter table public.bulk_orders drop constraint if exists bulk_orders_payment_status_check;
    alter table public.bulk_orders add constraint bulk_orders_payment_status_check
      check (payment_status in ('pending','paid','failed','refund_pending','refunded','partially_refunded'));
  end if;
end $$;

create index if not exists security_rate_limits_updated_idx
  on public.security_rate_limits(updated_at);

commit;

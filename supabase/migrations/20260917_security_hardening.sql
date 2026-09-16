-- The Chinese Bliss — production security hardening
-- Apply after the base schema/order operations migration.
-- Browser code must never have direct access to sensitive operational data.

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
revoke all privileges on table public.security_rate_limits from anon, authenticated;

create or replace function public.consume_security_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_key is null or length(p_key) < 16 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.security_rate_limits(key, window_started_at, request_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update set
    window_started_at = case
      when public.security_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then v_now else public.security_rate_limits.window_started_at end,
    request_count = case
      when public.security_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then 1 else public.security_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, integer, integer) to service_role;

-- Database-side invariants provide another layer behind the Edge Functions.
do $$
begin
  if to_regclass('public.normal_orders') is not null and not exists (
    select 1 from pg_constraint where conname = 'normal_orders_payment_status_check'
  ) then
    alter table public.normal_orders add constraint normal_orders_payment_status_check
      check (payment_status in ('pending','paid','failed','refund_pending','refunded','partially_refunded'));
  end if;

  if to_regclass('public.bulk_orders') is not null and not exists (
    select 1 from pg_constraint where conname = 'bulk_orders_payment_status_check'
  ) then
    alter table public.bulk_orders add constraint bulk_orders_payment_status_check
      check (payment_status in ('pending','paid','failed','refund_pending','refunded','partially_refunded'));
  end if;
end $$;

create index if not exists security_rate_limits_updated_idx
  on public.security_rate_limits(updated_at);

commit;

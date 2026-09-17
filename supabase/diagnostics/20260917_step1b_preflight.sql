-- The Chinese Bliss — Step 1B website Supabase preflight
-- EXPECTED WEBSITE PROJECT REF: ncbyfovvetvmkrlzapku
--
-- READ-ONLY DIAGNOSTIC. This file must not mutate schema or data.
-- Run it against the website Supabase project BEFORE applying either:
--   supabase/migrations/20260916_order_operations.sql
--   supabase/migrations/20260917_security_hardening.sql
--
-- This script intentionally uses catalog/information-schema reads only so it
-- still runs if an expected table/column is absent. Exact production row-value
-- checks (payment/order statuses and duplicate idempotency keys) are performed
-- only after this metadata pass proves those columns exist.

-- 1) Database identity / server context.
select
  current_database() as database_name,
  current_user as current_user,
  current_setting('server_version') as server_version;

-- 2) Which expected application tables actually exist.
with expected(table_name) as (
  values
    ('customers'),
    ('products'),
    ('normal_orders'),
    ('normal_order_items'),
    ('bulk_orders'),
    ('bulk_order_items'),
    ('order_status_events'),
    ('security_rate_limits')
)
select
  e.table_name,
  to_regclass(format('public.%I', e.table_name)) is not null as exists
from expected e
order by e.table_name;

-- 3) Column inventory for tables used by the order system.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'customers','products','normal_orders','normal_order_items',
    'bulk_orders','bulk_order_items','order_status_events','security_rate_limits'
  )
order by table_name, ordinal_position;

-- 4) RLS state. Operational/customer tables should ultimately be RLS-enabled;
-- the hardening migration additionally forces RLS and removes browser grants.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'customers','products','normal_orders','normal_order_items',
    'bulk_orders','bulk_order_items','order_status_events','security_rate_limits'
  )
order by c.relname;

-- 5) Existing RLS policies. Review every permissive policy before revoking
-- browser table privileges; do not assume a policy name implies safety.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'customers','products','normal_orders','normal_order_items',
    'bulk_orders','bulk_order_items','order_status_events','security_rate_limits'
  )
order by tablename, policyname;

-- 6) Direct table grants to browser/server roles.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'customers','products','normal_orders','normal_order_items',
    'bulk_orders','bulk_order_items','order_status_events','security_rate_limits'
  )
  and grantee in ('anon','authenticated','service_role')
order by table_name, grantee, privilege_type;

-- 7) Existing constraints and their exact definitions.
select
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'customers','products','normal_orders','normal_order_items',
    'bulk_orders','bulk_order_items','order_status_events','security_rate_limits'
  )
order by c.relname, con.conname;

-- 8) Index inventory. A database-level uniqueness guarantee for non-null
-- idempotency keys is strongly preferred; application lookup alone can race.
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('normal_orders','bulk_orders')
order by tablename, indexname;

-- 9) Preflight blocker summary for columns required by the hardened order API.
with required(table_name, column_name) as (
  values
    ('customers','id'), ('customers','phone'), ('customers','name'),
    ('products','id'), ('products','name'), ('products','price'),
    ('products','active'), ('products','order_type'),
    ('normal_orders','id'), ('normal_orders','order_number'),
    ('normal_orders','customer_id'), ('normal_orders','name'),
    ('normal_orders','phone'), ('normal_orders','address'),
    ('normal_orders','subtotal'), ('normal_orders','discount'),
    ('normal_orders','total'), ('normal_orders','payment_method'),
    ('normal_orders','payment_status'), ('normal_orders','idempotency_key'),
    ('normal_order_items','order_id'), ('normal_order_items','product_id'),
    ('normal_order_items','product_name'), ('normal_order_items','unit_price'),
    ('normal_order_items','quantity'), ('normal_order_items','line_total'),
    ('bulk_orders','id'), ('bulk_orders','order_number'),
    ('bulk_orders','customer_id'), ('bulk_orders','name'),
    ('bulk_orders','phone'), ('bulk_orders','address'),
    ('bulk_orders','subtotal'), ('bulk_orders','discount'),
    ('bulk_orders','total'), ('bulk_orders','payment_method'),
    ('bulk_orders','payment_status'), ('bulk_orders','idempotency_key'),
    ('bulk_order_items','order_id'), ('bulk_order_items','product_id'),
    ('bulk_order_items','product_name'), ('bulk_order_items','unit_price'),
    ('bulk_order_items','quantity'), ('bulk_order_items','line_total')
), actual as (
  select table_name, column_name
  from information_schema.columns
  where table_schema='public'
)
select r.table_name, r.column_name, 'MISSING_REQUIRED_COLUMN' as blocker
from required r
left join actual a using (table_name, column_name)
where a.column_name is null
order by r.table_name, r.column_name;

-- 10) Columns that gate the two staged migrations. This does not read order
-- rows; after these columns are proven present, run exact value checks live.
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('normal_orders','bulk_orders')
  and column_name in (
    'payment_status','order_status','idempotency_key','delivery_fee',
    'created_at','updated_at'
  )
order by table_name, column_name;

-- 11) Planner statistics can reveal obvious unexpected status values without
-- touching customer rows. They are advisory only, not sufficient to approve
-- a CHECK constraint; exact live value queries are still required afterward.
select
  tablename,
  attname as column_name,
  null_frac,
  n_distinct,
  most_common_vals
from pg_stats
where schemaname = 'public'
  and tablename in ('normal_orders','bulk_orders')
  and attname in ('payment_status','order_status')
order by tablename, attname;

-- 12) Rate-limit RPC state/privileges if a prior attempt already created it.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'consume_security_rate_limit';

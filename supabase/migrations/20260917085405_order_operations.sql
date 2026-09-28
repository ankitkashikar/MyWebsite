-- The Chinese Bliss — order operations workflow
-- Adds restaurant lifecycle fields without changing existing order/payment data.
-- Apply to Supabase before deploying the admin-orders Edge Function.

begin;

-- ---------------------------------------------------------------------
-- Normal orders
-- ---------------------------------------------------------------------
alter table if exists public.normal_orders add column if not exists created_at timestamptz not null default now();
alter table if exists public.normal_orders add column if not exists pincode text;
alter table if exists public.normal_orders add column if not exists order_status text;
alter table if exists public.normal_orders add column if not exists acknowledged_at timestamptz;
alter table if exists public.normal_orders add column if not exists accepted_at timestamptz;
alter table if exists public.normal_orders add column if not exists rejected_at timestamptz;
alter table if exists public.normal_orders add column if not exists rejection_reason text;
alter table if exists public.normal_orders add column if not exists preparing_at timestamptz;
alter table if exists public.normal_orders add column if not exists ready_at timestamptz;
alter table if exists public.normal_orders add column if not exists rider_assigned_at timestamptz;
alter table if exists public.normal_orders add column if not exists dispatched_at timestamptz;
alter table if exists public.normal_orders add column if not exists delivered_at timestamptz;
alter table if exists public.normal_orders add column if not exists cancelled_at timestamptz;
alter table if exists public.normal_orders add column if not exists cancellation_reason text;

-- delivery_fee is the CUSTOMER-FACING delivery charge and must be known
-- before final payment/confirmation. delivery_partner_cost is the actual
-- logistics cost paid/quoted by Porter/Borzo/etc and may be recorded later.
alter table if exists public.normal_orders add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table if exists public.normal_orders add column if not exists delivery_partner_cost numeric(10,2);
alter table if exists public.normal_orders add column if not exists delivery_provider text;
alter table if exists public.normal_orders add column if not exists delivery_booking_id text;
alter table if exists public.normal_orders add column if not exists tracking_url text;
alter table if exists public.normal_orders add column if not exists rider_name text;
alter table if exists public.normal_orders add column if not exists rider_phone text;
alter table if exists public.normal_orders add column if not exists estimated_delivery_from timestamptz;
alter table if exists public.normal_orders add column if not exists estimated_delivery_to timestamptz;
alter table if exists public.normal_orders add column if not exists payment_reference text;
alter table if exists public.normal_orders add column if not exists paid_at timestamptz;
alter table if exists public.normal_orders add column if not exists updated_at timestamptz not null default now();

update public.normal_orders
set order_status = 'new'
where order_status is null;

alter table if exists public.normal_orders alter column order_status set default 'new';
alter table if exists public.normal_orders alter column order_status set not null;

-- ---------------------------------------------------------------------
-- Bulk orders: same lifecycle fields so the console can support them
-- later without another structural migration.
-- ---------------------------------------------------------------------
alter table if exists public.bulk_orders add column if not exists created_at timestamptz not null default now();
alter table if exists public.bulk_orders add column if not exists order_status text;
alter table if exists public.bulk_orders add column if not exists acknowledged_at timestamptz;
alter table if exists public.bulk_orders add column if not exists accepted_at timestamptz;
alter table if exists public.bulk_orders add column if not exists rejected_at timestamptz;
alter table if exists public.bulk_orders add column if not exists rejection_reason text;
alter table if exists public.bulk_orders add column if not exists preparing_at timestamptz;
alter table if exists public.bulk_orders add column if not exists ready_at timestamptz;
alter table if exists public.bulk_orders add column if not exists rider_assigned_at timestamptz;
alter table if exists public.bulk_orders add column if not exists dispatched_at timestamptz;
alter table if exists public.bulk_orders add column if not exists delivered_at timestamptz;
alter table if exists public.bulk_orders add column if not exists cancelled_at timestamptz;
alter table if exists public.bulk_orders add column if not exists cancellation_reason text;
alter table if exists public.bulk_orders add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table if exists public.bulk_orders add column if not exists delivery_partner_cost numeric(10,2);
alter table if exists public.bulk_orders add column if not exists delivery_provider text;
alter table if exists public.bulk_orders add column if not exists delivery_booking_id text;
alter table if exists public.bulk_orders add column if not exists tracking_url text;
alter table if exists public.bulk_orders add column if not exists rider_name text;
alter table if exists public.bulk_orders add column if not exists rider_phone text;
alter table if exists public.bulk_orders add column if not exists estimated_delivery_from timestamptz;
alter table if exists public.bulk_orders add column if not exists estimated_delivery_to timestamptz;
alter table if exists public.bulk_orders add column if not exists payment_reference text;
alter table if exists public.bulk_orders add column if not exists paid_at timestamptz;
alter table if exists public.bulk_orders add column if not exists updated_at timestamptz not null default now();

update public.bulk_orders
set order_status = 'new'
where order_status is null;

alter table if exists public.bulk_orders alter column order_status set default 'new';
alter table if exists public.bulk_orders alter column order_status set not null;

-- ---------------------------------------------------------------------
-- Status history. order_id is text intentionally: it supports the current
-- order primary-key type without assuming UUID vs bigint before production
-- schema inspection. Only server-side code writes this table.
-- ---------------------------------------------------------------------
create table if not exists public.order_status_events (
  id bigint generated by default as identity primary key,
  order_type text not null check (order_type in ('normal', 'bulk')),
  order_id text not null,
  order_number text,
  previous_status text,
  new_status text not null,
  reason text,
  changed_by text,
  created_at timestamptz not null default now()
);

alter table public.order_status_events enable row level security;

create index if not exists normal_orders_status_created_idx
  on public.normal_orders (order_status, created_at desc);
create index if not exists bulk_orders_status_created_idx
  on public.bulk_orders (order_status, created_at desc);
create index if not exists order_status_events_order_idx
  on public.order_status_events (order_type, order_id, created_at desc);

-- Restrict lifecycle values while remaining tolerant if the migration is
-- re-applied. Existing unknown legacy values are converted to 'new' first.
update public.normal_orders
set order_status = 'new'
where order_status not in ('new','accepted','rejected','preparing','ready_for_pickup','rider_assigned','dispatched','delivered','cancelled');

update public.bulk_orders
set order_status = 'new'
where order_status not in ('new','accepted','rejected','preparing','ready_for_pickup','rider_assigned','dispatched','delivered','cancelled');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'normal_orders_order_status_check'
  ) then
    alter table public.normal_orders
      add constraint normal_orders_order_status_check
      check (order_status in ('new','accepted','rejected','preparing','ready_for_pickup','rider_assigned','dispatched','delivered','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bulk_orders_order_status_check'
  ) then
    alter table public.bulk_orders
      add constraint bulk_orders_order_status_check
      check (order_status in ('new','accepted','rejected','preparing','ready_for_pickup','rider_assigned','dispatched','delivered','cancelled'));
  end if;
end $$;

commit;

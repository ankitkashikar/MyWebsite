-- The Chinese Bliss standalone QR counter menu.
-- Public visitors may read active rows only.
-- No browser role may insert, update or delete menu rows.

create table if not exists public.qr_menu_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(trim(category)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 1 and 160),
  price numeric(10,2) not null check (price >= 0),
  category_sort integer not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qr_menu_items enable row level security;

revoke all on table public.qr_menu_items from anon, authenticated;
grant select on table public.qr_menu_items to anon, authenticated;

drop policy if exists qr_menu_public_read_active on public.qr_menu_items;
create policy qr_menu_public_read_active
on public.qr_menu_items
for select
to anon, authenticated
using (active = true);

create index if not exists qr_menu_items_public_order_idx
on public.qr_menu_items (active, category_sort, sort_order, name);

comment on table public.qr_menu_items is
'Public read-only catalogue for the standalone QR counter menu. Keep independent from checkout pricing.';
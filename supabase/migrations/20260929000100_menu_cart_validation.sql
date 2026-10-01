-- Website only. Apply with matching frontend/function deployment after local acceptance.
-- Preserve historical order snapshots. Existing dish prices are inherited from products.
begin;
create table if not exists public.menu_addon_parents (
 product_id text primary key references public.products(id),
 parent_ids text[] not null check (cardinality(parent_ids)>0)
);
alter table public.menu_addon_parents enable row level security;
alter table public.menu_addon_parents force row level security;
revoke all on public.menu_addon_parents from public, anon, authenticated;
grant select,insert,update,delete on public.menu_addon_parents to service_role;
create or replace function public.validate_menu_cart(p_type text,p_items jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare item record; mapping record; parent_qty numeric; total_qty numeric:=0;
begin
 if p_type is null or p_type not in ('normal','bulk') or jsonb_typeof(p_items) is distinct from 'array' then
  raise exception using errcode='P0001',message='Invalid menu selection.';
 end if;
 if jsonb_array_length(p_items) not between 1 and 60 then
  raise exception using errcode='P0001',message='Invalid menu selection.';
 end if;
 for item in select value j from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item.j->'id') is distinct from 'string' or jsonb_typeof(item.j->'qty') is distinct from 'number' then
   raise exception using errcode='P0001',message='Invalid menu selection.';
  end if;
  if (item.j->>'qty')::numeric<=0 or (item.j->>'qty')::numeric<>trunc((item.j->>'qty')::numeric) then
   raise exception using errcode='P0001',message='Invalid menu selection.';
  end if;
  total_qty:=total_qty+(item.j->>'qty')::numeric;
 end loop;
 if total_qty > (case when p_type='bulk' then 500 else 50 end) then
  raise exception using errcode='P0001',message='Order quantity is too large.';
 end if;
 -- Lock product rows in stable order through final order transaction.
 for item in select j->>'id' id,sum((j->>'qty')::numeric) qty
   from jsonb_array_elements(p_items) j group by j->>'id' order by j->>'id' loop
  perform 1 from public.products where id=item.id and active and order_type=p_type for share;
  if not found then raise exception using errcode='P0001',message='One or more menu choices are unavailable.'; end if;
  select * into mapping from public.menu_addon_parents where product_id=item.id for share;
  if found then
   select coalesce(sum((j->>'qty')::numeric),0) into parent_qty
     from jsonb_array_elements(p_items) j where j->>'id'=any(mapping.parent_ids);
   if item.qty>parent_qty then
    raise exception using errcode='P0001',message='Select an eligible dish for each add-on.';
   end if;
  end if;
 end loop;
 return true;
end;
$$;
revoke all on function public.validate_menu_cart(text,jsonb) from public,anon,authenticated;
grant execute on function public.validate_menu_cart(text,jsonb) to service_role;

-- Preserve existing function versions while adding transaction-bound validation.
do $patch$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.create_order_atomic(uuid,jsonb,jsonb,jsonb)'::regprocedure);
 anchor:='  perform public.lookup_order_request(p_key,p_request);';
 if position('perform public.validate_menu_cart' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Atomic order function changed; review menu validation insertion.'; end if;
  execute replace(definition,anchor,anchor||E'\n  perform public.validate_menu_cart(kind,p_request->''items'');');
 end if;
 definition:=pg_get_functiondef('public.quote_coupon(text,text,text,jsonb)'::regprocedure);
 anchor:='  -- Locks final order attempts';
 if position('perform public.validate_menu_cart' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Coupon function changed; review menu validation insertion.'; end if;
  execute replace(definition,anchor,E'  perform public.validate_menu_cart(p_type,p_items);\n'||anchor);
 end if;
end;
$patch$;
commit;

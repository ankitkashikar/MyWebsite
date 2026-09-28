-- Read-only customer reporting. Only authenticated admin Edge code calls these RPCs.
begin;
create function public.admin_customer_orders(p_customer uuid)
returns table(id uuid,order_type text,order_number text,name text,phone text,address text,created_at timestamptz,order_status text,payment_status text,total numeric)
language sql stable security invoker set search_path='' as $$
 select id,'normal',order_number,name,phone,address,created_at,order_status,payment_status,total from public.normal_orders where customer_id=p_customer
 union all
 select id,'bulk',order_number,name,phone,address,created_at,order_status,payment_status,total from public.bulk_orders where customer_id=p_customer;
$$;
create function public.admin_customers_list(p_search text default '',p_after uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_search is null or length(p_search)>100 then raise exception using errcode='22023',message='Invalid search.'; end if;
 with candidates as (
  select c.id,c.name,c.phone from public.customers c
  where (p_after is null or c.id>p_after) and
   (p_search='' or strpos(lower(c.name),lower(p_search))>0 or strpos(c.phone,p_search)>0)
  order by c.id limit 21
 ), page as (select * from candidates order by id limit 20), counts as (
  select p.*,s.normal_orders,s.bulk_orders,s.last_order_at from page p cross join lateral
   (select count(*) filter(where order_type='normal') normal_orders,count(*) filter(where order_type='bulk') bulk_orders,max(created_at) last_order_at
    from public.admin_customer_orders(p.id)) s
 )
 select jsonb_build_object('customers',coalesce((select jsonb_agg(to_jsonb(c) order by id) from counts c),'[]'::jsonb),
 'next_id',case when (select count(*) from candidates)>20 then (select id from page order by id desc limit 1) else null end) into result;
 return result;
end; $$;
create function public.admin_customer_detail(p_customer uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_customer is null or p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid customer page.'; end if;
 if not exists(select 1 from public.customers where id=p_customer) then return null; end if;
 with orders as materialized (select * from public.admin_customer_orders(p_customer)),
 eligible as (select * from orders where order_status not in ('cancelled','rejected')),
 lines as (
  select o.id,o.order_type,o.created_at,i.product_id,i.product_name,i.quantity from eligible o join public.normal_order_items i on o.order_type='normal' and i.order_id=o.id
  union all
  select o.id,o.order_type,o.created_at,i.product_id,i.product_name,i.quantity from eligible o join public.bulk_order_items i on o.order_type='bulk' and i.order_id=o.id
 ), favourites as (
  select order_type,product_id,(array_agg(product_name order by created_at desc,id desc))[1] product_name,sum(quantity) quantity
  from lines group by order_type,product_id order by sum(quantity) desc,order_type,product_id limit 10
 ), hours as (
  select extract(hour from created_at at time zone 'Asia/Kolkata')::integer "hour",count(*) orders
  from eligible group by 1 order by 2 desc,1 limit 5
 ), addresses as (
  select address,max(created_at) last_used from orders where nullif(btrim(address),'') is not null
  group by address order by max(created_at) desc,address limit 10
 ), page as (select * from orders order by created_at desc,order_type,id desc limit 21 offset p_offset),
 shown as (select * from page order by created_at desc,order_type,id desc limit 20),
 detailed as (
  select o.*,case when o.order_type='normal' then
   (select coalesce(jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity) order by i.id),'[]') from public.normal_order_items i where i.order_id=o.id)
  else
   (select coalesce(jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity) order by i.id),'[]') from public.bulk_order_items i where i.order_id=o.id)
  end items from shown o
 )
 select jsonb_build_object(
  'customer',(select jsonb_build_object('id',id,'name',name,'phone',phone) from public.customers where id=p_customer),
  'summary',(select jsonb_build_object('total_orders',count(*),'normal_orders',count(*) filter(where order_type='normal'),'bulk_orders',count(*) filter(where order_type='bulk'),
   'cancelled_or_rejected',count(*) filter(where order_status in ('cancelled','rejected')),'preference_orders',(select count(*) from eligible)) from orders),
  'addresses',coalesce((select jsonb_agg(to_jsonb(a) order by last_used desc,address) from addresses a),'[]'),
  'favourites',coalesce((select jsonb_agg(to_jsonb(f) order by quantity desc,order_type,product_id) from favourites f),'[]'),
  'hours',coalesce((select jsonb_agg(to_jsonb(h) order by orders desc,"hour") from hours h),'[]'),
  'orders',coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc,order_type,id desc) from detailed d),'[]'),
  'next_offset',case when (select count(*) from page)>20 then p_offset+20 else null end
 ) into result;
 return result;
end; $$;
revoke all on function public.admin_customer_orders(uuid),public.admin_customers_list(text,uuid),public.admin_customer_detail(uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_customer_orders(uuid),public.admin_customers_list(text,uuid),public.admin_customer_detail(uuid,integer) to service_role;
NOTIFY pgrst, 'reload schema';
commit;

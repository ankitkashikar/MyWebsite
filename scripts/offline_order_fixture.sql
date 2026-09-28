-- Disposable test database only; never apply to production.
create role anon; create role authenticated; create role service_role bypassrls;
 create table products(id text primary key, name text, price numeric, active boolean, order_type text);
 create table customers(id bigint generated always as identity primary key, phone text unique, name text);
 create table normal_orders(id bigint generated always as identity primary key,
 order_number text default 'TEST-ORDER', customer_id bigint, name text, phone text, address text, notes text,
 subtotal numeric(10,2), coupon_code text, discount numeric(10,2), delivery_fee numeric(10,2),
 total numeric(10,2), payment_method text, payment_status text, idempotency_key uuid unique,
 pincode text, delivery_slot text);
 create table bulk_orders(like normal_orders including all);
 alter table bulk_orders add column event_type text;
 alter table bulk_orders add column delivery_datetime text;
 create table normal_order_items(product_id text, product_name text, unit_price numeric(10,2), quantity int, line_total numeric(10,2), order_id bigint);
 create table bulk_order_items(like normal_order_items including all);
 grant usage on schema public to service_role;
 grant all on all tables in schema public to service_role;
 grant usage, select on all sequences in schema public to service_role;
 insert into products values ('dish','Dish',199.99,true,'normal'),('other','Other',100,true,'normal'),('bulk','Bulk',250,true,'bulk');

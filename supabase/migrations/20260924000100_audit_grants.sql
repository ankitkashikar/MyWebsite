-- Explicitly override inherited default privileges on the new audit tables.
-- Keep historical migration files unchanged for installations that applied them.
begin;
revoke all on public.delivery_rule_events, public.coupon_admin_events from service_role;
grant select, insert on public.delivery_rule_events, public.coupon_admin_events to service_role;
NOTIFY pgrst, 'reload schema';
commit;

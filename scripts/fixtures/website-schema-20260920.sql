


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."consume_security_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
begin
  if p_key is null or pg_catalog.length(p_key) < 16 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;
  insert into public.security_rate_limits(key,window_started_at,request_count,updated_at)
  values (p_key,v_now,1,v_now)
  on conflict (key) do update set
    window_started_at = case when public.security_rate_limits.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds) then v_now else public.security_rate_limits.window_started_at end,
    request_count = case when public.security_rate_limits.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds) then 1 else public.security_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;


ALTER FUNCTION "public"."consume_security_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_bulk_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.order_number := 'BLK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('bulk_order_seq')::text, 6, '0');
  return new;
end;
$$;


ALTER FUNCTION "public"."generate_bulk_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_normal_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.order_number := 'CBD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('normal_order_seq')::text, 6, '0');
  return new;
end;
$$;


ALTER FUNCTION "public"."generate_normal_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bulk_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    CONSTRAINT "bulk_order_items_quantity_check" CHECK ((("quantity" > 0) AND ("quantity" <= 500)))
);

ALTER TABLE ONLY "public"."bulk_order_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bulk_order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bulk_order_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bulk_order_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bulk_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text",
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "notes" "text",
    "event_type" "text",
    "delivery_datetime" timestamp with time zone,
    "subtotal" numeric(10,2) NOT NULL,
    "coupon_code" "text",
    "discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "idempotency_key" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_status" "text" DEFAULT 'new'::"text" NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "preparing_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "rider_assigned_at" timestamp with time zone,
    "dispatched_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "delivery_partner_cost" numeric(10,2),
    "delivery_provider" "text",
    "delivery_booking_id" "text",
    "tracking_url" "text",
    "rider_name" "text",
    "rider_phone" "text",
    "estimated_delivery_from" timestamp with time zone,
    "estimated_delivery_to" timestamp with time zone,
    "payment_reference" "text",
    "paid_at" timestamp with time zone,
    CONSTRAINT "bulk_orders_order_status_check" CHECK (("order_status" = ANY (ARRAY['new'::"text", 'accepted'::"text", 'rejected'::"text", 'preparing'::"text", 'ready_for_pickup'::"text", 'rider_assigned'::"text", 'dispatched'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "bulk_orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['upi'::"text", 'cod'::"text"]))),
    CONSTRAINT "bulk_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refund_pending'::"text", 'refunded'::"text", 'partially_refunded'::"text"]))),
    CONSTRAINT "bulk_orders_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'Confirmed'::"text", 'Processing'::"text", 'Out for Delivery'::"text", 'Delivered'::"text", 'Cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."bulk_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bulk_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."customers" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."normal_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    CONSTRAINT "normal_order_items_quantity_check" CHECK ((("quantity" > 0) AND ("quantity" <= 50)))
);

ALTER TABLE ONLY "public"."normal_order_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."normal_order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."normal_order_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."normal_order_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."normal_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text",
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "notes" "text",
    "delivery_slot" "text" NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "coupon_code" "text",
    "discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "idempotency_key" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pincode" "text",
    "order_status" "text" DEFAULT 'new'::"text" NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "preparing_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "rider_assigned_at" timestamp with time zone,
    "dispatched_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "delivery_partner_cost" numeric(10,2),
    "delivery_provider" "text",
    "delivery_booking_id" "text",
    "tracking_url" "text",
    "rider_name" "text",
    "rider_phone" "text",
    "estimated_delivery_from" timestamp with time zone,
    "estimated_delivery_to" timestamp with time zone,
    "payment_reference" "text",
    "paid_at" timestamp with time zone,
    CONSTRAINT "normal_orders_order_status_check" CHECK (("order_status" = ANY (ARRAY['new'::"text", 'accepted'::"text", 'rejected'::"text", 'preparing'::"text", 'ready_for_pickup'::"text", 'rider_assigned'::"text", 'dispatched'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "normal_orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['upi'::"text", 'cod'::"text"]))),
    CONSTRAINT "normal_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refund_pending'::"text", 'refunded'::"text", 'partially_refunded'::"text"]))),
    CONSTRAINT "normal_orders_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'Confirmed'::"text", 'Processing'::"text", 'Out for Delivery'::"text", 'Delivered'::"text", 'Cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."normal_orders" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."normal_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_events" (
    "id" bigint NOT NULL,
    "order_type" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "order_number" "text",
    "previous_status" "text",
    "new_status" "text" NOT NULL,
    "reason" "text",
    "changed_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_status_events_order_type_check" CHECK (("order_type" = ANY (ARRAY['normal'::"text", 'bulk'::"text"])))
);

ALTER TABLE ONLY "public"."order_status_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_events" OWNER TO "postgres";


ALTER TABLE "public"."order_status_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_status_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "text" NOT NULL,
    "order_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_order_type_check" CHECK (("order_type" = ANY (ARRAY['normal'::"text", 'bulk'::"text"]))),
    CONSTRAINT "products_price_check" CHECK (("price" >= (0)::numeric))
);

ALTER TABLE ONLY "public"."products" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_rate_limits" (
    "key" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "security_rate_limits_request_count_check" CHECK (("request_count" >= 0))
);

ALTER TABLE ONLY "public"."security_rate_limits" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_rate_limits" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bulk_order_items"
    ADD CONSTRAINT "bulk_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bulk_orders"
    ADD CONSTRAINT "bulk_orders_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."bulk_orders"
    ADD CONSTRAINT "bulk_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."bulk_orders"
    ADD CONSTRAINT "bulk_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."normal_order_items"
    ADD CONSTRAINT "normal_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."normal_orders"
    ADD CONSTRAINT "normal_orders_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."normal_orders"
    ADD CONSTRAINT "normal_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."normal_orders"
    ADD CONSTRAINT "normal_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_events"
    ADD CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_rate_limits"
    ADD CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY ("key");



CREATE INDEX "bulk_orders_status_created_idx" ON "public"."bulk_orders" USING "btree" ("order_status", "created_at" DESC);



CREATE INDEX "idx_bulk_order_items_order" ON "public"."bulk_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_bulk_orders_created" ON "public"."bulk_orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_bulk_orders_customer" ON "public"."bulk_orders" USING "btree" ("customer_id");



CREATE INDEX "idx_bulk_orders_status" ON "public"."bulk_orders" USING "btree" ("status");



CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("phone");



CREATE INDEX "idx_normal_order_items_order" ON "public"."normal_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_normal_orders_created" ON "public"."normal_orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_normal_orders_customer" ON "public"."normal_orders" USING "btree" ("customer_id");



CREATE INDEX "idx_normal_orders_status" ON "public"."normal_orders" USING "btree" ("status");



CREATE INDEX "idx_products_order_type" ON "public"."products" USING "btree" ("order_type") WHERE "active";



CREATE INDEX "normal_orders_status_created_idx" ON "public"."normal_orders" USING "btree" ("order_status", "created_at" DESC);



CREATE INDEX "order_status_events_order_idx" ON "public"."order_status_events" USING "btree" ("order_type", "order_id", "created_at" DESC);



CREATE INDEX "security_rate_limits_updated_idx" ON "public"."security_rate_limits" USING "btree" ("updated_at");



CREATE OR REPLACE TRIGGER "trg_bulk_order_number" BEFORE INSERT ON "public"."bulk_orders" FOR EACH ROW EXECUTE FUNCTION "public"."generate_bulk_order_number"();



CREATE OR REPLACE TRIGGER "trg_bulk_orders_touch" BEFORE UPDATE ON "public"."bulk_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_customers_touch" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_normal_order_number" BEFORE INSERT ON "public"."normal_orders" FOR EACH ROW EXECUTE FUNCTION "public"."generate_normal_order_number"();



CREATE OR REPLACE TRIGGER "trg_normal_orders_touch" BEFORE UPDATE ON "public"."normal_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_products_touch" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."bulk_order_items"
    ADD CONSTRAINT "bulk_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bulk_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bulk_order_items"
    ADD CONSTRAINT "bulk_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."bulk_orders"
    ADD CONSTRAINT "bulk_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."normal_order_items"
    ADD CONSTRAINT "normal_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."normal_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."normal_order_items"
    ADD CONSTRAINT "normal_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."normal_orders"
    ADD CONSTRAINT "normal_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE "public"."bulk_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bulk_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."normal_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."normal_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_rate_limits" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_security_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_security_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_bulk_order_number"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_bulk_order_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_normal_order_number"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_normal_order_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."bulk_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bulk_order_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bulk_order_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bulk_order_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bulk_orders" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."normal_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."normal_order_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."normal_order_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."normal_order_seq" TO "service_role";



GRANT ALL ON TABLE "public"."normal_orders" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_status_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_status_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_status_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."security_rate_limits" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








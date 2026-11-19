CREATE TYPE "public"."hold_kind" AS ENUM('seats', 'capacity', 'group');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('active', 'converted', 'released');--> statement-breakpoint
CREATE TYPE "public"."merchant_of_record" AS ENUM('platform', 'venue');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'refunded', 'partially_refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."org_kind" AS ENUM('platform', 'venue_operator');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card_online', 'card_present', 'cash', 'payment_link', 'comp');--> statement-breakpoint
CREATE TYPE "public"."performance_status" AS ENUM('on_sale', 'off_sale', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('commission', 'net_rate');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('reserved', 'general_admission', 'timed_entry', 'open_date');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('marketplace', 'venue_site', 'box_office', 'phone', 'group', 'comp');--> statement-breakpoint
CREATE TYPE "public"."scan_mode" AS ENUM('single', 'multi');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('ok', 'already_used', 'wrong_date', 'invalid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('available', 'held', 'sold', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('platform_admin', 'call_center', 'venue_manager', 'box_office', 'door');--> statement-breakpoint
CREATE TYPE "public"."supply_type" AS ENUM('native', 'allocation', 'api', 'on_request');--> statement-breakpoint
CREATE TYPE "public"."ticket_kind" AS ENUM('ticket', 'voucher');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('valid', 'used', 'refunded', 'void');--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "hold_kind" NOT NULL,
	"performance_id" uuid,
	"pool_id" uuid,
	"quantity" integer NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"staff_user_id" uuid,
	"note" text,
	"status" "hold_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"performance_id" uuid,
	"label" text DEFAULT 'General' NOT NULL,
	"capacity" integer,
	"sold" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"venue_id" uuid,
	"role" "staff_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"performance_id" uuid,
	"price_tier_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"merchant" "merchant_of_record" NOT NULL,
	"unit_retail_cents" integer NOT NULL,
	"unit_net_cents" integer,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"fee_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"venue_payout_cents" integer NOT NULL,
	"platform_revenue_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"sold_by_user_id" uuid,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"accessibility_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "org_kind" DEFAULT 'venue_operator' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"brand_accent_hex" text,
	"brand_logo_url" text,
	"stripe_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"taken_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_seats" (
	"performance_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"hold_id" uuid,
	"held_until" timestamp with time zone,
	"order_id" uuid,
	"blocked_reason" text
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"status" "performance_status" DEFAULT 'on_sale' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_zone" text,
	"retail_cents" integer NOT NULL,
	"net_cents" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"kind" "product_kind" NOT NULL,
	"supply_type" "supply_type" DEFAULT 'native' NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'commission' NOT NULL,
	"commission_bps" integer DEFAULT 0 NOT NULL,
	"service_fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_bps" integer DEFAULT 0 NOT NULL,
	"seat_map_id" uuid,
	"valid_days" integer,
	"scan_mode" "scan_mode" DEFAULT 'single' NOT NULL,
	"uses_per_ticket" integer DEFAULT 1 NOT NULL,
	"requires_waiver" boolean DEFAULT false NOT NULL,
	"min_age" integer,
	"min_height_inches" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_reserved_has_map" CHECK ("products"."kind" <> 'reserved' OR "products"."seat_map_id" IS NOT NULL),
	CONSTRAINT "products_commission_range" CHECK ("products"."commission_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"ticket_id" uuid,
	"performance_id" uuid,
	"device_id" text,
	"gate" text,
	"result" "scan_result" NOT NULL,
	"scanned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seat_map_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"row_label" text NOT NULL,
	"seat_number" integer NOT NULL,
	"price_zone" text DEFAULT 'standard' NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"device_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"performance_id" uuid,
	"seat_id" uuid,
	"code" text NOT NULL,
	"kind" "ticket_kind" NOT NULL,
	"status" "ticket_status" DEFAULT 'valid' NOT NULL,
	"uses_remaining" integer DEFAULT 1 NOT NULL,
	"valid_until" timestamp with time zone,
	"waiver_signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"accent_hex" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_pool_id_inventory_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."inventory_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_pools" ADD CONSTRAINT "inventory_pools_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_pools" ADD CONSTRAINT "inventory_pools_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_tier_id_price_tiers_id_fk" FOREIGN KEY ("price_tier_id") REFERENCES "public"."price_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sold_by_user_id_users_id_fk" FOREIGN KEY ("sold_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_taken_by_user_id_users_id_fk" FOREIGN KEY ("taken_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_seats" ADD CONSTRAINT "performance_seats_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_seats" ADD CONSTRAINT "performance_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seat_map_id_seat_maps_id_fk" FOREIGN KEY ("seat_map_id") REFERENCES "public"."seat_maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_scanned_by_user_id_users_id_fk" FOREIGN KEY ("scanned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_maps" ADD CONSTRAINT "seat_maps_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_sections" ADD CONSTRAINT "seat_sections_seat_map_id_seat_maps_id_fk" FOREIGN KEY ("seat_map_id") REFERENCES "public"."seat_maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_section_id_seat_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."seat_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holds_pool_active_idx" ON "holds" USING btree ("pool_id","status");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_email_idx" ON "orders" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_seats_pk" ON "performance_seats" USING btree ("performance_id","seat_id");--> statement-breakpoint
CREATE INDEX "performance_seats_hold_idx" ON "performance_seats" USING btree ("hold_id");--> statement-breakpoint
CREATE INDEX "performances_product_starts_idx" ON "performances" USING btree ("product_id","starts_at");--> statement-breakpoint
CREATE INDEX "scans_performance_idx" ON "scans" USING btree ("performance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seats_position_uq" ON "seats" USING btree ("section_id","row_label","seat_number");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_idx" ON "ticket_events" USING btree ("ticket_id");
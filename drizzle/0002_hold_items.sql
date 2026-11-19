CREATE TABLE "hold_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"price_tier_id" uuid NOT NULL,
	"seat_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holds" ADD COLUMN "customer_token" text;--> statement-breakpoint
ALTER TABLE "hold_items" ADD CONSTRAINT "hold_items_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold_items" ADD CONSTRAINT "hold_items_price_tier_id_price_tiers_id_fk" FOREIGN KEY ("price_tier_id") REFERENCES "public"."price_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold_items" ADD CONSTRAINT "hold_items_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hold_items_hold_idx" ON "hold_items" USING btree ("hold_id");
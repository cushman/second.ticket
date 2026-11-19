DROP INDEX "performances_product_starts_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "performances_product_starts_uq" ON "performances" USING btree ("product_id","starts_at");
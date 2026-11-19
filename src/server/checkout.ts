import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { holdItems, holds, inventoryPools, performances, priceTiers, products, seats, venues } from "@/db/schema";
import { priceLine, sumLines, type LineResult } from "@/core/pricing";

export interface CheckoutLine {
  label: string;
  detail: string[];
  quantity: number;
  unitCents: number;
  price: LineResult;
}

/** A shopper's active hold with pricing, or null if it isn't theirs, is gone or has been used. */
export async function loadCheckout(holdId: string, token: string) {
  const db = getDb();
  const [hold] = await db.select().from(holds).where(and(eq(holds.id, holdId), eq(holds.customerToken, token)));
  if (!hold) return null;

  const performanceId = hold.performanceId ?? (hold.poolId ? (await db.select().from(inventoryPools).where(eq(inventoryPools.id, hold.poolId)))[0]?.performanceId : null);
  const items = await db
    .select({ quantity: holdItems.quantity, tier: priceTiers, seatRow: seats.rowLabel, seatNumber: seats.seatNumber })
    .from(holdItems)
    .innerJoin(priceTiers, eq(priceTiers.id, holdItems.priceTierId))
    .leftJoin(seats, eq(seats.id, holdItems.seatId))
    .where(eq(holdItems.holdId, hold.id));
  if (items.length === 0) return null;

  const [info] = await db
    .select({ product: products, venueName: venues.name, timeZone: venues.timezone })
    .from(products)
    .innerJoin(venues, eq(venues.id, products.venueId))
    .where(eq(products.id, items[0].tier.productId));
  const [perf] = performanceId ? await db.select().from(performances).where(eq(performances.id, performanceId)) : [];

  const grouped = new Map<string, { tier: (typeof items)[number]["tier"]; quantity: number; seats: string[] }>();
  for (const i of items) {
    const g = grouped.get(i.tier.id) ?? { tier: i.tier, quantity: 0, seats: [] };
    g.quantity += i.quantity;
    if (i.seatRow) g.seats.push(`Row ${i.seatRow}, seat ${i.seatNumber}`);
    grouped.set(i.tier.id, g);
  }

  const p = info.product;
  const lines: CheckoutLine[] = [...grouped.values()].map((g) => ({
    label: g.tier.name,
    detail: g.seats,
    quantity: g.quantity,
    unitCents: g.tier.retailCents,
    price: priceLine({
      model: p.pricingModel,
      quantity: g.quantity,
      retailCents: g.tier.retailCents,
      netCents: g.tier.netCents,
      commissionBps: p.commissionBps,
      serviceFeeCents: p.serviceFeeCents,
      taxBps: p.taxBps,
    }),
  }));

  const now = new Date();
  const expired = hold.status !== "active" || (hold.expiresAt !== null && hold.expiresAt <= now);
  return {
    hold,
    expired,
    product: p,
    venueName: info.venueName,
    timeZone: info.timeZone,
    startsAt: perf?.startsAt ?? null,
    lines,
    totals: sumLines(lines.map((l) => l.price)),
  };
}

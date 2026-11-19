import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { holds, inventoryPools, performanceSeats, performances, priceTiers, products, seatSections, seats, venues } from "@/db/schema";

export const SALES_DAYS = 28;

const localDay = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  kind: (typeof products.$inferSelect)["kind"];
  venueName: string;
  timeZone: string;
  fromCents: number | null;
  nextStart: Date | null;
  requiresWaiver: boolean;
}

/** Everything buyable now: products with an upcoming on-sale date, plus open-date products. */
export async function catalog(filter: { category?: string; date?: string } = {}): Promise<CatalogItem[]> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      category: products.category,
      kind: products.kind,
      requiresWaiver: products.requiresWaiver,
      venueName: venues.name,
      timeZone: venues.timezone,
      fromCents: sql<number | null>`(select min(${priceTiers.retailCents}) from ${priceTiers} where ${priceTiers.productId} = ${products.id})`,
    })
    .from(products)
    .innerJoin(venues, eq(venues.id, products.venueId))
    .where(filter.category ? eq(products.category, filter.category) : undefined)
    .orderBy(asc(products.name));
  if (rows.length === 0) return [];

  const upcoming = await db
    .select({ productId: performances.productId, startsAt: performances.startsAt })
    .from(performances)
    .where(and(inArray(performances.productId, rows.map((r) => r.id)), eq(performances.status, "on_sale"), gt(performances.startsAt, now)))
    .orderBy(asc(performances.startsAt));

  return rows
    .map((r) => {
      const starts = upcoming.filter((u) => u.productId === r.id).map((u) => u.startsAt);
      const onDate = filter.date ? starts.filter((s) => localDay(s, r.timeZone) === filter.date) : starts;
      return { ...r, fromCents: r.fromCents === null ? null : Number(r.fromCents), nextStart: onDate[0] ?? null };
    })
    .filter((r) => r.kind === "open_date" || r.nextStart !== null)
    .sort((a, b) => (a.nextStart?.getTime() ?? Infinity) - (b.nextStart?.getTime() ?? Infinity));
}

export async function categoryCounts() {
  const items = await catalog();
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  return counts;
}

export async function productBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({ product: products, venueName: venues.name, venueAddress: venues.address, timeZone: venues.timezone })
    .from(products)
    .innerJoin(venues, eq(venues.id, products.venueId))
    .where(eq(products.slug, slug));
  if (!row) return null;
  const tiers = await db
    .select({ id: priceTiers.id, name: priceTiers.name, priceZone: priceTiers.priceZone, retailCents: priceTiers.retailCents })
    .from(priceTiers)
    .where(eq(priceTiers.productId, row.product.id))
    .orderBy(asc(priceTiers.sortOrder));
  return { ...row, tiers };
}

export interface SaleTime {
  id: string;
  startsAt: Date;
  remaining: number | null;
}

/** On-sale performances in the next SALES_DAYS days, grouped by the venue's local date. */
export async function saleCalendar(productId: string, timeZone: string) {
  const db = getDb();
  const now = new Date();
  const until = new Date(now.getTime() + SALES_DAYS * 86400000);
  const list = await db
    .select({ id: performances.id, startsAt: performances.startsAt })
    .from(performances)
    .where(and(eq(performances.productId, productId), eq(performances.status, "on_sale"), gt(performances.startsAt, now), lt(performances.startsAt, until)))
    .orderBy(asc(performances.startsAt));
  const remaining = await remainingFor(list.map((p) => p.id), now);
  const days = new Map<string, SaleTime[]>();
  for (const p of list) {
    const key = localDay(p.startsAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), { ...p, remaining: remaining.get(p.id) ?? null }]);
  }
  return days;
}

/** Sellable tickets per performance: open seats, or pool capacity minus sold and active holds. */
async function remainingFor(performanceIds: string[], now: Date) {
  const out = new Map<string, number | null>();
  if (performanceIds.length === 0) return out;
  const db = getDb();
  const seatCounts = await db
    .select({
      performanceId: performanceSeats.performanceId,
      open: sql<number>`count(*) filter (where ${performanceSeats.status} = 'available' or (${performanceSeats.status} = 'held' and ${performanceSeats.heldUntil} < ${now}))::int`,
    })
    .from(performanceSeats)
    .where(inArray(performanceSeats.performanceId, performanceIds))
    .groupBy(performanceSeats.performanceId);
  for (const r of seatCounts) out.set(r.performanceId, Number(r.open));

  const pools = await db.select().from(inventoryPools).where(inArray(inventoryPools.performanceId, performanceIds));
  const held = await poolHolds(pools.map((p) => p.id), now);
  for (const p of pools) {
    if (!p.performanceId) continue;
    out.set(p.performanceId, p.capacity === null ? null : Math.max(0, p.capacity - p.sold - (held.get(p.id) ?? 0)));
  }
  return out;
}

async function poolHolds(poolIds: string[], now: Date) {
  const out = new Map<string, number>();
  if (poolIds.length === 0) return out;
  const rows = await getDb()
    .select({ poolId: holds.poolId, n: sql<number>`sum(${holds.quantity})::int` })
    .from(holds)
    .where(and(inArray(holds.poolId, poolIds), eq(holds.status, "active"), or(isNull(holds.expiresAt), gt(holds.expiresAt, now))))
    .groupBy(holds.poolId);
  for (const r of rows) if (r.poolId) out.set(r.poolId, Number(r.n));
  return out;
}

export interface SeatForSale {
  id: string;
  section: string;
  row: string;
  number: number;
  x: number;
  y: number;
  zone: string;
  accessible: boolean;
  available: boolean;
}

/** A performance that can be bought right now, with its seats or remaining capacity. */
export async function performanceForSale(productId: string, performanceId: string) {
  const db = getDb();
  const now = new Date();
  const [perf] = await db
    .select()
    .from(performances)
    .where(and(eq(performances.id, performanceId), eq(performances.productId, productId), eq(performances.status, "on_sale"), gt(performances.startsAt, now)));
  if (!perf) return null;

  const seatRows = await db
    .select({
      id: seats.id,
      section: seatSections.name,
      row: seats.rowLabel,
      number: seats.seatNumber,
      x: seats.x,
      y: seats.y,
      zone: seats.priceZone,
      accessible: seats.isAccessible,
      status: performanceSeats.status,
      heldUntil: performanceSeats.heldUntil,
    })
    .from(performanceSeats)
    .innerJoin(seats, eq(seats.id, performanceSeats.seatId))
    .innerJoin(seatSections, eq(seatSections.id, seats.sectionId))
    .where(eq(performanceSeats.performanceId, perf.id));

  const seatList: SeatForSale[] = seatRows.map(({ status, heldUntil, ...s }) => ({
    ...s,
    available: status === "available" || (status === "held" && heldUntil !== null && heldUntil < now),
  }));

  const [pool] = await db.select().from(inventoryPools).where(eq(inventoryPools.performanceId, perf.id));
  const remaining = pool ? (pool.capacity === null ? null : Math.max(0, pool.capacity - pool.sold - ((await poolHolds([pool.id], now)).get(pool.id) ?? 0))) : null;
  return { performance: perf, seats: seatList, poolId: pool?.id ?? null, remaining };
}

/** The any-day pool for an open-date product. */
export async function openDatePool(productId: string) {
  const [pool] = await getDb()
    .select()
    .from(inventoryPools)
    .where(and(eq(inventoryPools.productId, productId), isNull(inventoryPools.performanceId)));
  if (!pool) return null;
  const held = (await poolHolds([pool.id], new Date())).get(pool.id) ?? 0;
  return { poolId: pool.id, remaining: pool.capacity === null ? null : Math.max(0, pool.capacity - pool.sold - held) };
}

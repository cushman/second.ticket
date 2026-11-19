import { and, asc, count, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { holds, inventoryPools, performanceSeats, performances, products, seatSections, seats } from "@/db/schema";

type Product = typeof products.$inferSelect;
type Status = (typeof performances.$inferSelect)["status"];

export interface CreateOptions {
  /** Tickets per performance for GA, timed-entry slots and allocation blocks. */
  capacity?: number | null;
  durationMinutes?: number | null;
}

const CHUNK = 5000;

/**
 * Creates performances and their inventory: seats for reserved products, a capacity pool otherwise.
 * Start times that already exist for the product are skipped, so re-running a schedule is safe.
 */
export async function createPerformances(db: Db, product: Product, startTimes: Date[], opts: CreateOptions = {}) {
  if (product.kind === "open_date") throw new Error("Open-date tickets don't use dates or time slots.");
  const needsCapacity = product.kind !== "reserved";
  const capacity = opts.capacity ?? null;
  if (needsCapacity && (capacity === null || !Number.isInteger(capacity) || capacity < 1)) {
    throw new Error("Enter how many tickets each date or time slot can sell.");
  }

  return db.transaction(async (tx) => {
    let seatIds: string[] = [];
    if (product.kind === "reserved") {
      if (!product.seatMapId) throw new Error("This show needs a seat map first.");
      const rows = await tx
        .select({ id: seats.id })
        .from(seats)
        .innerJoin(seatSections, eq(seatSections.id, seats.sectionId))
        .where(eq(seatSections.seatMapId, product.seatMapId));
      seatIds = rows.map((r) => r.id);
      if (seatIds.length === 0) throw new Error("The seat map has no seats yet.");
    }

    const created = await tx
      .insert(performances)
      .values(
        startTimes.map((startsAt) => ({
          productId: product.id,
          startsAt,
          endsAt: opts.durationMinutes ? new Date(startsAt.getTime() + opts.durationMinutes * 60000) : null,
        })),
      )
      .onConflictDoNothing({ target: [performances.productId, performances.startsAt] })
      .returning({ id: performances.id, startsAt: performances.startsAt });

    if (product.kind === "reserved") {
      const rows = created.flatMap((p) => seatIds.map((seatId) => ({ performanceId: p.id, seatId })));
      for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(performanceSeats).values(rows.slice(i, i + CHUNK));
    } else if (created.length) {
      const label = product.supplyType === "allocation" ? "Branson Explorer block" : "General";
      await tx.insert(inventoryPools).values(created.map((p) => ({ productId: product.id, performanceId: p.id, label, capacity })));
    }

    return { created: created.length, skipped: startTimes.length - created.length };
  });
}

/** Tickets sold or currently held for a performance. */
export async function soldOrHeld(db: Db, performanceId: string, now: Date = new Date()) {
  const [seatsTaken] = await db
    .select({ n: count() })
    .from(performanceSeats)
    .where(
      and(
        eq(performanceSeats.performanceId, performanceId),
        sql`(${performanceSeats.status} = 'sold' OR (${performanceSeats.status} = 'held' AND (${performanceSeats.heldUntil} IS NULL OR ${performanceSeats.heldUntil} > ${now})))`,
      ),
    );
  const pools = await db.select({ id: inventoryPools.id, sold: inventoryPools.sold }).from(inventoryPools).where(eq(inventoryPools.performanceId, performanceId));
  let poolTaken = pools.reduce((a, p) => a + p.sold, 0);
  if (pools.length) {
    const [h] = await db
      .select({ n: sql<number>`coalesce(sum(${holds.quantity}), 0)::int` })
      .from(holds)
      .where(
        and(
          inArray(holds.poolId, pools.map((p) => p.id)),
          eq(holds.status, "active"),
          sql`(${holds.expiresAt} IS NULL OR ${holds.expiresAt} > ${now})`,
        ),
      );
    poolTaken += Number(h.n);
  }
  return seatsTaken.n + poolTaken;
}

export class PerformanceError extends Error {}

/** Takes a date off sale, puts it back, or cancels it. Cancelling is blocked while tickets are sold or held. */
export async function setPerformanceStatus(db: Db, performanceId: string, status: Status) {
  if (status === "cancelled" && (await soldOrHeld(db, performanceId)) > 0) {
    throw new PerformanceError("This date has tickets sold or held. Take it off sale instead; refunds come with checkout.");
  }
  const [row] = await db.update(performances).set({ status }).where(eq(performances.id, performanceId)).returning();
  if (!row) throw new PerformanceError("That date no longer exists.");
  return row;
}

export interface PerformanceSummary {
  id: string;
  startsAt: Date;
  status: Status;
  capacity: number | null;
  sold: number;
}

/** Upcoming performances for a product with capacity and sold counts. */
export async function upcomingPerformances(db: Db, productId: string, from: Date, limit = 400): Promise<PerformanceSummary[]> {
  const list = await db
    .select()
    .from(performances)
    .where(and(eq(performances.productId, productId), gte(performances.startsAt, from)))
    .orderBy(asc(performances.startsAt))
    .limit(limit);
  if (list.length === 0) return [];
  const ids = list.map((p) => p.id);

  const seatStats = await db
    .select({
      performanceId: performanceSeats.performanceId,
      total: sql<number>`count(*) filter (where ${performanceSeats.status} <> 'blocked')::int`,
      sold: sql<number>`count(*) filter (where ${performanceSeats.status} = 'sold')::int`,
    })
    .from(performanceSeats)
    .where(inArray(performanceSeats.performanceId, ids))
    .groupBy(performanceSeats.performanceId);
  const pools = await db
    .select({ performanceId: inventoryPools.performanceId, capacity: inventoryPools.capacity, sold: inventoryPools.sold })
    .from(inventoryPools)
    .where(inArray(inventoryPools.performanceId, ids));

  return list.map((p) => {
    const s = seatStats.find((r) => r.performanceId === p.id);
    const pool = pools.find((r) => r.performanceId === p.id);
    return {
      id: p.id,
      startsAt: p.startsAt,
      status: p.status,
      capacity: s ? Number(s.total) : (pool?.capacity ?? null),
      sold: s ? Number(s.sold) : (pool?.sold ?? 0),
    };
  });
}

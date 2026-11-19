import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { holds, inventoryPools, performanceSeats, performances } from "@/db/schema";

type Channel = (typeof holds.$inferInsert)["channel"];

export type InventoryErrorCode = "unavailable" | "hold_expired" | "hold_not_active" | "invalid_request";

export class InventoryError extends Error {
  constructor(
    public readonly code: InventoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

export const DEFAULT_HOLD_SECONDS = 600;

export interface SeatHoldRequest {
  performanceId: string;
  seatIds: string[];
  channel: Channel;
  staffUserId?: string;
  /** null = no expiry (staff group holds). */
  ttlSeconds?: number | null;
  note?: string;
  now?: Date;
}

/**
 * Holds specific seats for one performance, all or nothing.
 * The conditional UPDATE is the lock: Postgres re-checks the WHERE clause after any
 * competing transaction commits, so two buyers can never both get the same seat.
 */
export async function holdSeats(db: Db, req: SeatHoldRequest) {
  const seatIds = [...new Set(req.seatIds)];
  if (seatIds.length === 0) throw new InventoryError("invalid_request", "Pick at least one seat.");
  const now = req.now ?? new Date();
  const ttl = req.ttlSeconds === undefined ? DEFAULT_HOLD_SECONDS : req.ttlSeconds;
  const expiresAt = ttl === null ? null : new Date(now.getTime() + ttl * 1000);

  return db.transaction(async (tx) => {
    await assertOnSale(tx as unknown as Db, req.performanceId);
    const [hold] = await tx
      .insert(holds)
      .values({
        kind: ttl === null ? "group" : "seats",
        performanceId: req.performanceId,
        quantity: seatIds.length,
        channel: req.channel,
        staffUserId: req.staffUserId,
        note: req.note,
        expiresAt,
      })
      .returning({ id: holds.id });

    const taken = await tx
      .update(performanceSeats)
      .set({ status: "held", holdId: hold.id, heldUntil: expiresAt })
      .where(
        and(
          eq(performanceSeats.performanceId, req.performanceId),
          inArray(performanceSeats.seatId, seatIds),
          or(
            eq(performanceSeats.status, "available"),
            and(eq(performanceSeats.status, "held"), lt(performanceSeats.heldUntil, now)),
          ),
        ),
      )
      .returning({ seatId: performanceSeats.seatId });

    if (taken.length !== seatIds.length) {
      throw new InventoryError("unavailable", "One or more of those seats was just taken.");
    }
    return { holdId: hold.id, expiresAt, seatIds };
  });
}

export interface CapacityHoldRequest {
  poolId: string;
  quantity: number;
  channel: Channel;
  staffUserId?: string;
  ttlSeconds?: number | null;
  note?: string;
  now?: Date;
}

async function assertOnSale(tx: Db, performanceId: string) {
  const [perf] = await tx.select({ status: performances.status }).from(performances).where(eq(performances.id, performanceId));
  if (!perf) throw new InventoryError("invalid_request", "That date no longer exists.");
  if (perf.status !== "on_sale") throw new InventoryError("unavailable", "That date isn't on sale.");
}

async function activeHeld(tx: Db, poolId: string, now: Date) {
  const [row] = await tx
    .select({ held: sql<number>`coalesce(sum(${holds.quantity}), 0)::int` })
    .from(holds)
    .where(
      and(
        eq(holds.poolId, poolId),
        eq(holds.status, "active"),
        or(isNull(holds.expiresAt), gt(holds.expiresAt, now)),
      ),
    );
  return Number(row.held);
}

/** Holds a quantity from a capacity pool (GA, time slot, open-date, or a marketplace allocation). */
export async function holdCapacity(db: Db, req: CapacityHoldRequest) {
  if (!Number.isInteger(req.quantity) || req.quantity < 1) {
    throw new InventoryError("invalid_request", "Quantity must be at least 1.");
  }
  const now = req.now ?? new Date();
  const ttl = req.ttlSeconds === undefined ? DEFAULT_HOLD_SECONDS : req.ttlSeconds;
  const expiresAt = ttl === null ? null : new Date(now.getTime() + ttl * 1000);

  return db.transaction(async (tx) => {
    const [pool] = await tx.select().from(inventoryPools).where(eq(inventoryPools.id, req.poolId)).for("update");
    if (!pool) throw new InventoryError("invalid_request", "That ticket option no longer exists.");
    if (pool.performanceId) await assertOnSale(tx as unknown as Db, pool.performanceId);

    if (pool.capacity !== null) {
      const held = await activeHeld(tx as unknown as Db, pool.id, now);
      if (pool.sold + held + req.quantity > pool.capacity) {
        throw new InventoryError("unavailable", "Not enough tickets left for that time.");
      }
    }

    const [hold] = await tx
      .insert(holds)
      .values({
        kind: ttl === null ? "group" : "capacity",
        poolId: pool.id,
        quantity: req.quantity,
        channel: req.channel,
        staffUserId: req.staffUserId,
        note: req.note,
        expiresAt,
      })
      .returning({ id: holds.id });
    return { holdId: hold.id, expiresAt };
  });
}

/** Turns a hold into sold inventory once payment succeeds. */
export async function convertHold(db: Db, holdId: string, orderId: string, now: Date = new Date()) {
  return db.transaction(async (tx) => {
    const [hold] = await tx.select().from(holds).where(eq(holds.id, holdId)).for("update");
    if (!hold || hold.status !== "active") throw new InventoryError("hold_not_active", "This hold is no longer active.");
    if (hold.expiresAt && hold.expiresAt <= now) throw new InventoryError("hold_expired", "Your hold expired.");

    let seatIds: string[] = [];
    if (hold.poolId) {
      await tx
        .update(inventoryPools)
        .set({ sold: sql`${inventoryPools.sold} + ${hold.quantity}` })
        .where(eq(inventoryPools.id, hold.poolId));
    } else {
      const sold = await tx
        .update(performanceSeats)
        .set({ status: "sold", orderId, holdId: null, heldUntil: null })
        .where(and(eq(performanceSeats.holdId, holdId), eq(performanceSeats.status, "held")))
        .returning({ seatId: performanceSeats.seatId });
      if (sold.length !== hold.quantity) throw new InventoryError("hold_expired", "Some held seats were released.");
      seatIds = sold.map((s) => s.seatId);
    }

    await tx.update(holds).set({ status: "converted" }).where(eq(holds.id, holdId));
    return { seatIds };
  });
}

export async function releaseHold(db: Db, holdId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(performanceSeats)
      .set({ status: "available", holdId: null, heldUntil: null })
      .where(and(eq(performanceSeats.holdId, holdId), eq(performanceSeats.status, "held")));
    await tx
      .update(holds)
      .set({ status: "released" })
      .where(and(eq(holds.id, holdId), eq(holds.status, "active")));
  });
}

/** Tickets still sellable in a pool; null when unlimited. */
export async function remainingCapacity(db: Db, poolId: string, now: Date = new Date()) {
  const [pool] = await db.select().from(inventoryPools).where(eq(inventoryPools.id, poolId));
  if (!pool) throw new InventoryError("invalid_request", "Unknown pool.");
  if (pool.capacity === null) return null;
  return pool.capacity - pool.sold - (await activeHeld(db, poolId, now));
}

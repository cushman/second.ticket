import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createTestDb, seedFixture } from "@/test/db";
import { convertHold, holdCapacity, holdSeats, InventoryError, releaseHold, remainingCapacity } from "./inventory";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";

async function seatStatuses(db: Db, performanceId: string, seatIds: string[]) {
  const rows = await db
    .select()
    .from(schema.performanceSeats)
    .where(and(eq(schema.performanceSeats.performanceId, performanceId), inArray(schema.performanceSeats.seatId, seatIds)));
  return Object.fromEntries(rows.map((r) => [r.seatId, r.status]));
}

describe("reserved seats", () => {
  let db: Db;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  beforeEach(async () => {
    db = await createTestDb();
    fx = await seedFixture(db);
  });

  it("holds seats and refuses an overlapping hold without touching other seats", async () => {
    const [s1, s2, s3] = fx.seats.map((s) => s.id);
    await holdSeats(db, { performanceId: fx.performance.id, seatIds: [s1, s2], channel: "marketplace" });

    await expect(
      holdSeats(db, { performanceId: fx.performance.id, seatIds: [s2, s3], channel: "box_office" }),
    ).rejects.toMatchObject({ code: "unavailable" });

    expect(await seatStatuses(db, fx.performance.id, [s1, s2, s3])).toEqual({ [s1]: "held", [s2]: "held", [s3]: "available" });
  });

  it("lets exactly one of many simultaneous buyers get the same seat", async () => {
    const seat = fx.seats[0].id;
    const channels = ["marketplace", "venue_site", "box_office", "phone"] as const;
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        holdSeats(db, { performanceId: fx.performance.id, seatIds: [seat], channel: channels[i % 4] }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("frees seats when a hold expires and blocks converting the expired hold", async () => {
    const seat = fx.seats[0].id;
    const t0 = new Date("2026-11-19T18:00:00Z");
    const first = await holdSeats(db, { performanceId: fx.performance.id, seatIds: [seat], channel: "marketplace", ttlSeconds: 60, now: t0 });

    const later = new Date(t0.getTime() + 61_000);
    await holdSeats(db, { performanceId: fx.performance.id, seatIds: [seat], channel: "phone", now: later });

    await expect(convertHold(db, first.holdId, ORDER_ID, later)).rejects.toBeInstanceOf(InventoryError);
  });

  it("sells held seats on convert and frees them on release", async () => {
    const [s1, s2, s3] = fx.seats.map((s) => s.id);
    const sold = await holdSeats(db, { performanceId: fx.performance.id, seatIds: [s1, s2], channel: "marketplace" });
    expect((await convertHold(db, sold.holdId, ORDER_ID)).seatIds.sort()).toEqual([s1, s2].sort());

    const released = await holdSeats(db, { performanceId: fx.performance.id, seatIds: [s3], channel: "phone" });
    await releaseHold(db, released.holdId);

    expect(await seatStatuses(db, fx.performance.id, [s1, s2, s3])).toEqual({ [s1]: "sold", [s2]: "sold", [s3]: "available" });
    await expect(convertHold(db, released.holdId, ORDER_ID)).rejects.toMatchObject({ code: "hold_not_active" });
  });

  it("keeps staff group holds with no expiry", async () => {
    const seat = fx.seats[0].id;
    const t0 = new Date("2026-11-19T12:00:00Z");
    await holdSeats(db, { performanceId: fx.performance.id, seatIds: [seat], channel: "group", ttlSeconds: null, now: t0 });
    const muchLater = new Date(t0.getTime() + 30 * 24 * 3600_000);
    await expect(
      holdSeats(db, { performanceId: fx.performance.id, seatIds: [seat], channel: "marketplace", now: muchLater }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("capacity pools (timed entry, GA, open date, allocations)", () => {
  let db: Db;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  beforeEach(async () => {
    db = await createTestDb();
    fx = await seedFixture(db);
  });

  it("never oversells a go-kart heat", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => holdCapacity(db, { poolId: fx.pool.id, quantity: 2, channel: "marketplace" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    expect(await remainingCapacity(db, fx.pool.id)).toBe(0);
  });

  it("returns expired holds to sale and counts converted holds as sold", async () => {
    const t0 = new Date("2026-11-19T19:00:00Z");
    const a = await holdCapacity(db, { poolId: fx.pool.id, quantity: 5, channel: "box_office", now: t0 });
    await holdCapacity(db, { poolId: fx.pool.id, quantity: 3, channel: "marketplace", ttlSeconds: 60, now: t0 });
    await expect(holdCapacity(db, { poolId: fx.pool.id, quantity: 1, channel: "phone", now: t0 })).rejects.toMatchObject({
      code: "unavailable",
    });

    const later = new Date(t0.getTime() + 120_000);
    expect(await remainingCapacity(db, fx.pool.id, later)).toBe(3);
    await convertHold(db, a.holdId, ORDER_ID, later);
    expect(await remainingCapacity(db, fx.pool.id, later)).toBe(3);
  });

  it("rejects zero or fractional quantities", async () => {
    await expect(holdCapacity(db, { poolId: fx.pool.id, quantity: 0, channel: "marketplace" })).rejects.toMatchObject({
      code: "invalid_request",
    });
  });
});

const realUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!realUrl)("real Postgres, parallel connections", () => {
  let pool: Pool;
  afterAll(async () => pool?.end());

  it("still lets only one connection win the same seat", async () => {
    pool = new Pool({ connectionString: realUrl, max: 20 });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
    const db = drizzle(pool, { schema }) as unknown as Db;
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    const fx = await seedFixture(db);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        holdSeats(db, { performanceId: fx.performance.id, seatIds: [fx.seats[0].id, fx.seats[1].id], channel: "marketplace" }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const kart = await Promise.allSettled(
      Array.from({ length: 20 }, () => holdCapacity(db, { poolId: fx.pool.id, quantity: 1, channel: "box_office" })),
    );
    expect(kart.filter((r) => r.status === "fulfilled")).toHaveLength(8);
  });
});

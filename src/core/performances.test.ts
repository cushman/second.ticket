import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { createTestDb, seedFixture } from "@/test/db";
import { holdCapacity, holdSeats } from "./inventory";
import { createPerformances, PerformanceError, setPerformanceStatus, upcomingPerformances } from "./performances";
import { expandSchedule } from "./schedule";

const week = (times: string[]) =>
  expandSchedule({
    startDate: "2026-12-01",
    endDate: "2026-12-07",
    weekdays: [2, 3, 4, 5, 6],
    times: { mode: "list", times },
    timeZone: "America/Chicago",
  }).map((o) => o.startsAt);

describe("createPerformances", () => {
  let db: Db;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  beforeEach(async () => {
    db = await createTestDb();
    fx = await seedFixture(db, 4);
  });

  it("puts every seat on sale for each new show and skips times that already exist", async () => {
    const first = await createPerformances(db, fx.show, week(["14:00", "19:30"]));
    expect(first).toEqual({ created: 10, skipped: 0 });
    const again = await createPerformances(db, fx.show, week(["19:30", "21:00"]));
    expect(again).toEqual({ created: 5, skipped: 5 });

    const list = await upcomingPerformances(db, fx.show.id, new Date("2026-12-01T00:00:00Z"));
    expect(list).toHaveLength(15);
    expect(list.every((p) => p.capacity === 8 && p.sold === 0)).toBe(true);
  });

  it("gives each go-kart slot its own capacity pool", async () => {
    const slots = expandSchedule({
      startDate: "2026-12-05",
      endDate: "2026-12-05",
      weekdays: [6],
      times: { mode: "interval", open: "10:00", close: "11:00", everyMinutes: 10 },
      timeZone: "America/Chicago",
    }).map((o) => o.startsAt);
    expect(await createPerformances(db, fx.karts, slots, { capacity: 8 })).toEqual({ created: 6, skipped: 0 });
    await expect(createPerformances(db, fx.karts, slots, {})).rejects.toThrow(/how many tickets/);
  });

  it("refuses to cancel a date with tickets held, but allows taking it off sale", async () => {
    await createPerformances(db, fx.show, week(["19:30"]));
    const [perf] = await upcomingPerformances(db, fx.show.id, new Date("2026-12-01T00:00:00Z"));
    await holdSeats(db, { performanceId: perf.id, seatIds: [fx.seats[0].id], channel: "phone" });

    await expect(setPerformanceStatus(db, perf.id, "cancelled")).rejects.toBeInstanceOf(PerformanceError);
    expect((await setPerformanceStatus(db, perf.id, "off_sale")).status).toBe("off_sale");
  });

  it("cancels an empty date and stops all sales for it", async () => {
    expect((await setPerformanceStatus(db, fx.slot.id, "cancelled")).status).toBe("cancelled");
    await expect(holdCapacity(db, { poolId: fx.pool.id, quantity: 1, channel: "marketplace" })).rejects.toMatchObject({
      code: "unavailable",
    });
    await setPerformanceStatus(db, fx.performance.id, "off_sale");
    await expect(
      holdSeats(db, { performanceId: fx.performance.id, seatIds: [fx.seats[0].id], channel: "box_office" }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});

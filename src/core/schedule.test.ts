import { describe, expect, it } from "vitest";
import { expandSchedule, formatLocal, zonedTime } from "./schedule";

const TZ = "America/Chicago";

describe("zonedTime", () => {
  it("keeps 7:30 PM local on both sides of the November clock change", () => {
    expect(zonedTime("2026-10-31", "19:30", TZ).toISOString()).toBe("2026-11-01T00:30:00.000Z");
    expect(zonedTime("2026-11-02", "19:30", TZ).toISOString()).toBe("2026-11-03T01:30:00.000Z");
  });

  it("handles the March change and moves a skipped time an hour later", () => {
    expect(zonedTime("2026-03-07", "14:00", TZ).toISOString()).toBe("2026-03-07T20:00:00.000Z");
    expect(zonedTime("2026-03-09", "14:00", TZ).toISOString()).toBe("2026-03-09T19:00:00.000Z");
    expect(zonedTime("2026-03-08", "02:30", TZ).toISOString()).toBe("2026-03-08T08:30:00.000Z");
  });
});

describe("expandSchedule", () => {
  it("expands weekdays and show times, skipping dark days", () => {
    const occ = expandSchedule({
      startDate: "2026-12-20",
      endDate: "2026-12-27",
      weekdays: [2, 3, 4, 5, 6],
      times: { mode: "list", times: ["19:30", "14:00", "14:00"] },
      skipDates: ["2026-12-25"],
      timeZone: TZ,
    });
    expect([...new Set(occ.map((o) => o.date))]).toEqual(["2026-12-22", "2026-12-23", "2026-12-24", "2026-12-26"]);
    expect(occ.filter((o) => o.date === "2026-12-22").map((o) => o.time)).toEqual(["14:00", "19:30"]);
  });

  it("builds timed-entry slots that end by closing", () => {
    const occ = expandSchedule({
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      times: { mode: "interval", open: "10:00", close: "11:00", everyMinutes: 15 },
      timeZone: TZ,
    });
    expect(occ.map((o) => o.time)).toEqual(["10:00", "10:15", "10:30", "10:45"]);
  });

  it("explains bad input", () => {
    const base = { weekdays: [1], timeZone: TZ, times: { mode: "list" as const, times: ["19:30"] } };
    expect(() => expandSchedule({ ...base, startDate: "2026-12-10", endDate: "2026-12-01" })).toThrow(/before/);
    expect(() => expandSchedule({ ...base, startDate: "2026-02-30", endDate: "2026-03-01" })).toThrow(/real date/);
    expect(() => expandSchedule({ ...base, startDate: "2026-01-01", endDate: "2026-01-02", weekdays: [] })).toThrow(/day of the week/);
    expect(() =>
      expandSchedule({ ...base, startDate: "2026-01-01", endDate: "2026-01-02", times: { mode: "list", times: ["7:30pm"] } }),
    ).toThrow(/time like/);
    expect(() =>
      expandSchedule({
        ...base,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times: { mode: "interval", open: "08:00", close: "23:00", everyMinutes: 5 },
      }),
    ).toThrow(/smaller ranges/);
  });
});

describe("formatLocal", () => {
  it("shows venue time", () => {
    expect(formatLocal(new Date("2026-11-20T01:30:00Z"), TZ)).toBe("Thu, Nov 19 · 7:30 PM");
  });
});

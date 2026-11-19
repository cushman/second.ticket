import { describe, expect, it } from "vitest";
import { bestAvailable, buildSection, parseAisles, parseRows } from "./seatmap";

describe("parseRows", () => {
  it("expands letter ranges and skips I and O", () => {
    expect(parseRows("A-M")).toEqual("ABCDEFGHJKLM".split(""));
    expect(parseRows("aa-ee")).toEqual(["AA", "BB", "CC", "DD", "EE"]);
  });

  it("handles numbers and lists", () => {
    expect(parseRows("1-3, 10")).toEqual(["1", "2", "3", "10"]);
  });

  it("explains bad input", () => {
    expect(() => parseRows("M-A")).toThrow(/backwards/);
    expect(() => parseRows("A-BB")).toThrow(/like A-M/);
    expect(() => parseRows("A, A")).toThrow(/once/);
    expect(() => parseRows("")).toThrow(/at least one/);
    expect(() => parseRows("A!")).toThrow();
  });
});

describe("parseAisles", () => {
  it("accepts seat numbers inside the row", () => {
    expect(parseAisles("22, 8", 30)).toEqual([8, 22]);
    expect(parseAisles("", 30)).toEqual([]);
    expect(() => parseAisles("30", 30)).toThrow();
  });
});

describe("buildSection", () => {
  it("numbers seats and leaves gaps at aisles", () => {
    const seats = buildSection(["A", "B"], 4, [2], 5);
    expect(seats).toHaveLength(8);
    expect(seats.filter((s) => s.rowLabel === "A").map((s) => s.x)).toEqual([1, 2, 5, 6]);
    expect(seats[0]).toMatchObject({ rowLabel: "A", seatNumber: 1, y: 6 });
    expect(seats[7]).toMatchObject({ rowLabel: "B", seatNumber: 4, y: 7 });
  });

  it("rejects silly sizes", () => {
    expect(() => buildSection(["A"], 0, [])).toThrow();
  });
});

describe("bestAvailable", () => {
  const grid = buildSection(["A", "B", "C"], 6, [3]).map((s) => ({ id: `${s.rowLabel}${s.seatNumber}`, x: s.x, y: s.y, available: true }));
  const mark = (taken: string[]) => grid.map((s) => ({ ...s, available: !taken.includes(s.id) }));

  it("picks front and centre without crossing the aisle", () => {
    expect(bestAvailable(grid, 2)).toEqual(["A2", "A3"]);
    const pick = bestAvailable(grid, 3)!;
    expect(pick.every((id) => id.startsWith("A"))).toBe(true);
    expect(pick).toSatisfy((ids: string[]) => ids.join() === "A1,A2,A3" || ids.join() === "A4,A5,A6");
  });

  it("moves back a row when the front is broken up", () => {
    expect(bestAvailable(mark(["A2", "A5"]), 3)?.every((id) => id.startsWith("B"))).toBe(true);
  });

  it("returns null when no block fits", () => {
    expect(bestAvailable(grid, 4)).toBeNull();
    expect(bestAvailable(mark(grid.map((s) => s.id)), 1)).toBeNull();
    expect(bestAvailable(grid, 0)).toBeNull();
  });
});

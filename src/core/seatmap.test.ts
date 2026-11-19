import { describe, expect, it } from "vitest";
import { buildSection, parseAisles, parseRows } from "./seatmap";

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

import { describe, expect, it } from "vitest";
import { priceLine, sumLines } from "./pricing";

describe("priceLine", () => {
  it("commission: venue is merchant, platform keeps commission plus fees", () => {
    const r = priceLine({ model: "commission", quantity: 2, retailCents: 4800, commissionBps: 1000, serviceFeeCents: 325, taxBps: 838 });
    expect(r).toMatchObject({
      merchant: "venue",
      subtotalCents: 9600,
      feeCents: 650,
      taxCents: 804,
      totalCents: 11054,
      platformRevenueCents: 960 + 650,
      venuePayoutCents: 9600 - 960 + 804,
      taxRemittedBy: "venue",
    });
    expect(r.venuePayoutCents + r.platformRevenueCents).toBe(r.totalCents);
  });

  it("net rate: platform is merchant, venue gets the agreed net", () => {
    const r = priceLine({ model: "net_rate", quantity: 4, retailCents: 4800, netCents: 3600, serviceFeeCents: 0, taxBps: 838 });
    expect(r).toMatchObject({ merchant: "platform", venuePayoutCents: 14400, platformRevenueCents: 19200 - 14400, taxRemittedBy: "platform" });
    expect(r.venuePayoutCents + r.platformRevenueCents + r.taxCents).toBe(r.totalCents);
  });

  it("applies discounts before tax and never below zero", () => {
    const r = priceLine({ model: "commission", quantity: 1, retailCents: 2400, discountCents: 5000, taxBps: 838 });
    expect(r).toMatchObject({ discountCents: 2400, taxCents: 0, totalCents: 0 });
  });

  it("requires a net rate for net_rate pricing", () => {
    expect(() => priceLine({ model: "net_rate", quantity: 1, retailCents: 1000 })).toThrow();
  });

  it("sums order totals", () => {
    const a = priceLine({ model: "commission", quantity: 1, retailCents: 1000, serviceFeeCents: 100 });
    const b = priceLine({ model: "net_rate", quantity: 1, retailCents: 2000, netCents: 1500 });
    expect(sumLines([a, b])).toEqual({ subtotalCents: 3000, discountCents: 0, feeCents: 100, taxCents: 0, totalCents: 3100 });
  });
});

describe("tierFor", () => {
  const tiers = [
    { id: "a1", name: "Adult", priceZone: "premium", retailCents: 5800 },
    { id: "a2", name: "Adult", priceZone: "standard", retailCents: 4800 },
    { id: "c", name: "Child", priceZone: null, retailCents: 2400 },
  ];
  it("prefers the seat's price area and falls back to the general price", async () => {
    const { tierFor, tierNames } = await import("./pricing");
    expect(tierFor(tiers, "Adult", "premium")?.id).toBe("a1");
    expect(tierFor(tiers, "Child", "premium")?.id).toBe("c");
    expect(tierFor(tiers, "Adult", "balcony")).toBeUndefined();
    expect(tierNames(tiers)).toEqual(["Adult", "Child"]);
  });
});

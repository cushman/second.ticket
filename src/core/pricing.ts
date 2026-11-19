export type PricingModel = "commission" | "net_rate";

export interface LineInput {
  model: PricingModel;
  quantity: number;
  retailCents: number;
  /** Required for net_rate: what the venue is owed per ticket. */
  netCents?: number | null;
  /** Platform commission in basis points (1000 = 10%), commission model only. */
  commissionBps?: number;
  /** Service fee per ticket, kept by the platform. */
  serviceFeeCents?: number;
  /** Sales tax in basis points, applied to the discounted ticket price. */
  taxBps?: number;
  /** Discount for the whole line. */
  discountCents?: number;
}

export interface LineResult {
  merchant: "venue" | "platform";
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  taxCents: number;
  totalCents: number;
  venuePayoutCents: number;
  platformRevenueCents: number;
  taxRemittedBy: "venue" | "platform";
}

const pct = (amount: number, bps: number) => Math.round((amount * bps) / 10000);

/**
 * Splits one order line between venue and platform.
 * commission: venue is merchant of record (Stripe Connect); platform keeps commission + fee.
 * net_rate: platform is merchant; venue is owed the net rate; platform keeps the markup + fee.
 */
export function priceLine(input: LineInput): LineResult {
  const { model, quantity, retailCents } = input;
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("quantity must be a positive integer");
  if (!Number.isInteger(retailCents) || retailCents < 0) throw new Error("retailCents must be a non-negative integer");

  const subtotalCents = retailCents * quantity;
  const discountCents = Math.min(input.discountCents ?? 0, subtotalCents);
  const ticketCents = subtotalCents - discountCents;
  const feeCents = (input.serviceFeeCents ?? 0) * quantity;
  const taxCents = pct(ticketCents, input.taxBps ?? 0);
  const totalCents = ticketCents + feeCents + taxCents;

  if (model === "commission") {
    const commission = pct(ticketCents, input.commissionBps ?? 0);
    return {
      merchant: "venue",
      subtotalCents,
      discountCents,
      feeCents,
      taxCents,
      totalCents,
      venuePayoutCents: ticketCents - commission + taxCents,
      platformRevenueCents: commission + feeCents,
      taxRemittedBy: "venue",
    };
  }

  if (input.netCents == null) throw new Error("net_rate pricing needs netCents");
  const venuePayoutCents = input.netCents * quantity;
  return {
    merchant: "platform",
    subtotalCents,
    discountCents,
    feeCents,
    taxCents,
    totalCents,
    venuePayoutCents,
    platformRevenueCents: ticketCents - venuePayoutCents + feeCents,
    taxRemittedBy: "platform",
  };
}

export function sumLines(lines: LineResult[]) {
  return lines.reduce(
    (acc, l) => ({
      subtotalCents: acc.subtotalCents + l.subtotalCents,
      discountCents: acc.discountCents + l.discountCents,
      feeCents: acc.feeCents + l.feeCents,
      taxCents: acc.taxCents + l.taxCents,
      totalCents: acc.totalCents + l.totalCents,
    }),
    { subtotalCents: 0, discountCents: 0, feeCents: 0, taxCents: 0, totalCents: 0 },
  );
}

export interface TierRow {
  id: string;
  name: string;
  priceZone: string | null;
  retailCents: number;
}

/** The price row for a ticket type in a seat's price area, falling back to the type's general price. */
export function tierFor<T extends TierRow>(tiers: readonly T[], name: string, zone: string | null): T | undefined {
  return tiers.find((t) => t.name === name && t.priceZone === zone) ?? tiers.find((t) => t.name === name && t.priceZone === null);
}

/** Ticket type names in display order, each listed once. */
export function tierNames(tiers: readonly TierRow[]): string[] {
  return [...new Set(tiers.map((t) => t.name))];
}

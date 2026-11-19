import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Tenants, people, roles ----------

export const orgKind = pgEnum("org_kind", ["platform", "venue_operator"]);

export const organizations = pgTable("organizations", {
  id: id(),
  kind: orgKind("kind").notNull().default("venue_operator"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brandAccentHex: text("brand_accent_hex"),
  brandLogoUrl: text("brand_logo_url"),
  stripeAccountId: text("stripe_account_id"),
  createdAt: createdAt(),
});

export const venues = pgTable("venues", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  timezone: text("timezone").notNull().default("America/Chicago"),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  accentHex: text("accent_hex"),
  createdAt: createdAt(),
});

export const staffRole = pgEnum("staff_role", [
  "platform_admin",
  "call_center",
  "venue_manager",
  "box_office",
  "door",
]);

// orgId null = platform-wide role (admin, call center).
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    orgId: uuid("org_id").references(() => organizations.id),
    venueId: uuid("venue_id").references(() => venues.id),
    role: staffRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("memberships_user_idx").on(t.userId)],
);

// ---------- Seat maps ----------

export const seatMaps = pgTable("seat_maps", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const seatSections = pgTable("seat_sections", {
  id: id(),
  seatMapId: uuid("seat_map_id").notNull().references(() => seatMaps.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const seats = pgTable(
  "seats",
  {
    id: id(),
    sectionId: uuid("section_id").notNull().references(() => seatSections.id),
    rowLabel: text("row_label").notNull(),
    seatNumber: integer("seat_number").notNull(),
    priceZone: text("price_zone").notNull().default("standard"),
    isAccessible: boolean("is_accessible").notNull().default(false),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
  },
  (t) => [uniqueIndex("seats_position_uq").on(t.sectionId, t.rowLabel, t.seatNumber)],
);

// ---------- Products: shows and attractions ----------

export const productKind = pgEnum("product_kind", [
  "reserved", // theaters with seat maps
  "general_admission", // capacity per performance
  "timed_entry", // go-karts, laser tag: capacity per time slot
  "open_date", // putt-putt, museums: use any day within validity
]);

// Where the marketplace gets inventory for a product.
export const supplyType = pgEnum("supply_type", [
  "native", // venue runs on Branson Explorer
  "allocation", // venue gives a block of tickets per date
  "api", // venue's own system, booked through an integration
  "on_request", // staff confirm with the venue before issuing
]);

export const pricingModel = pgEnum("pricing_model", ["commission", "net_rate"]);
export const scanMode = pgEnum("scan_mode", ["single", "multi"]);

export const products = pgTable(
  "products",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    venueId: uuid("venue_id").notNull().references(() => venues.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category").notNull(),
    kind: productKind("kind").notNull(),
    supplyType: supplyType("supply_type").notNull().default("native"),
    pricingModel: pricingModel("pricing_model").notNull().default("commission"),
    commissionBps: integer("commission_bps").notNull().default(0),
    serviceFeeCents: integer("service_fee_cents").notNull().default(0),
    taxBps: integer("tax_bps").notNull().default(0),
    seatMapId: uuid("seat_map_id").references(() => seatMaps.id),
    validDays: integer("valid_days"),
    scanMode: scanMode("scan_mode").notNull().default("single"),
    usesPerTicket: integer("uses_per_ticket").notNull().default(1),
    requiresWaiver: boolean("requires_waiver").notNull().default(false),
    minAge: integer("min_age"),
    minHeightInches: integer("min_height_inches"),
    createdAt: createdAt(),
  },
  (t) => [
    check("products_reserved_has_map", sql`${t.kind} <> 'reserved' OR ${t.seatMapId} IS NOT NULL`),
    check("products_commission_range", sql`${t.commissionBps} BETWEEN 0 AND 10000`),
  ],
);

export const priceTiers = pgTable("price_tiers", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(), // Adult, Teen (13–18), Child (4–12)
  priceZone: text("price_zone"),
  retailCents: integer("retail_cents").notNull(),
  netCents: integer("net_cents"), // what the venue is owed under net_rate
  sortOrder: integer("sort_order").notNull().default(0),
});

// A performance is a show date/time or an attraction time slot.
export const performanceStatus = pgEnum("performance_status", ["on_sale", "off_sale", "cancelled"]);

export const performances = pgTable(
  "performances",
  {
    id: id(),
    productId: uuid("product_id").notNull().references(() => products.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: performanceStatus("status").notNull().default("on_sale"),
  },
  (t) => [uniqueIndex("performances_product_starts_uq").on(t.productId, t.startsAt)],
);

// ---------- Inventory ----------

export const seatStatus = pgEnum("seat_status", ["available", "held", "sold", "blocked"]);

export const performanceSeats = pgTable(
  "performance_seats",
  {
    performanceId: uuid("performance_id").notNull().references(() => performances.id),
    seatId: uuid("seat_id").notNull().references(() => seats.id),
    status: seatStatus("status").notNull().default("available"),
    holdId: uuid("hold_id"),
    heldUntil: timestamp("held_until", { withTimezone: true }),
    orderId: uuid("order_id"),
    blockedReason: text("blocked_reason"),
  },
  (t) => [uniqueIndex("performance_seats_pk").on(t.performanceId, t.seatId), index("performance_seats_hold_idx").on(t.holdId)],
);

// Capacity for GA, time slots, open-date products and marketplace allocations.
// capacity null = unlimited.
export const inventoryPools = pgTable("inventory_pools", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id),
  performanceId: uuid("performance_id").references(() => performances.id),
  label: text("label").notNull().default("General"),
  capacity: integer("capacity"),
  sold: integer("sold").notNull().default(0),
});

export const salesChannel = pgEnum("sales_channel", [
  "marketplace", // Branson Explorer site
  "venue_site", // venue's own branded checkout
  "box_office",
  "phone",
  "group",
  "comp",
]);

export const holdKind = pgEnum("hold_kind", ["seats", "capacity", "group"]);
export const holdStatus = pgEnum("hold_status", ["active", "converted", "released"]);

export const holds = pgTable(
  "holds",
  {
    id: id(),
    kind: holdKind("kind").notNull(),
    performanceId: uuid("performance_id").references(() => performances.id),
    poolId: uuid("pool_id").references(() => inventoryPools.id),
    quantity: integer("quantity").notNull(),
    channel: salesChannel("channel").notNull(),
    staffUserId: uuid("staff_user_id").references(() => users.id),
    /** Random per-browser token for online shoppers; only that browser can see or release the hold. */
    customerToken: text("customer_token"),
    note: text("note"),
    status: holdStatus("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("holds_pool_active_idx").on(t.poolId, t.status)],
);

// What a hold is for: the ticket type for each seat, or a quantity per ticket type.
export const holdItems = pgTable(
  "hold_items",
  {
    id: id(),
    holdId: uuid("hold_id").notNull().references(() => holds.id),
    priceTierId: uuid("price_tier_id").notNull().references(() => priceTiers.id),
    seatId: uuid("seat_id").references(() => seats.id),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("hold_items_hold_idx").on(t.holdId)],
);

// ---------- Orders, payments, tickets ----------

export const orderStatus = pgEnum("order_status", ["pending", "paid", "refunded", "partially_refunded", "cancelled"]);
export const merchantOfRecord = pgEnum("merchant_of_record", ["platform", "venue"]);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    code: text("code").notNull().unique(),
    channel: salesChannel("channel").notNull(),
    soldByUserId: uuid("sold_by_user_id").references(() => users.id),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    status: orderStatus("status").notNull().default("pending"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    feeCents: integer("fee_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    accessibilityNote: text("accessibility_note"),
    createdAt: createdAt(),
  },
  (t) => [index("orders_email_idx").on(t.customerEmail), index("orders_phone_idx").on(t.customerPhone)],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  performanceId: uuid("performance_id").references(() => performances.id),
  priceTierId: uuid("price_tier_id").notNull().references(() => priceTiers.id),
  quantity: integer("quantity").notNull(),
  merchant: merchantOfRecord("merchant").notNull(),
  unitRetailCents: integer("unit_retail_cents").notNull(),
  unitNetCents: integer("unit_net_cents"),
  discountCents: integer("discount_cents").notNull().default(0),
  feeCents: integer("fee_cents").notNull(),
  taxCents: integer("tax_cents").notNull(),
  venuePayoutCents: integer("venue_payout_cents").notNull(),
  platformRevenueCents: integer("platform_revenue_cents").notNull(),
});

export const paymentMethod = pgEnum("payment_method", ["card_online", "card_present", "cash", "payment_link", "comp"]);

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  method: paymentMethod("method").notNull(),
  amountCents: integer("amount_cents").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  takenByUserId: uuid("taken_by_user_id").references(() => users.id),
  createdAt: createdAt(),
});

export const ticketKind = pgEnum("ticket_kind", ["ticket", "voucher"]);
export const ticketStatus = pgEnum("ticket_status", ["valid", "used", "refunded", "void"]);

export const tickets = pgTable("tickets", {
  id: id(),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
  performanceId: uuid("performance_id").references(() => performances.id),
  seatId: uuid("seat_id").references(() => seats.id),
  code: text("code").notNull().unique(),
  kind: ticketKind("kind").notNull(),
  status: ticketStatus("status").notNull().default("valid"),
  usesRemaining: integer("uses_remaining").notNull().default(1),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  waiverSignedAt: timestamp("waiver_signed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Append-only history of every change to a ticket: issued, scanned, refunded, exchanged.
export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: id(),
    ticketId: uuid("ticket_id").notNull().references(() => tickets.id),
    type: text("type").notNull(),
    userId: uuid("user_id").references(() => users.id),
    deviceId: text("device_id"),
    data: jsonb("data"),
    at: createdAt(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId)],
);

export const scanResult = pgEnum("scan_result", ["ok", "already_used", "wrong_date", "invalid", "refunded"]);

export const scans = pgTable(
  "scans",
  {
    id: id(),
    code: text("code").notNull(),
    ticketId: uuid("ticket_id").references(() => tickets.id),
    performanceId: uuid("performance_id").references(() => performances.id),
    deviceId: text("device_id"),
    gate: text("gate"),
    result: scanResult("result").notNull(),
    scannedByUserId: uuid("scanned_by_user_id").references(() => users.id),
    at: createdAt(),
  },
  (t) => [index("scans_performance_idx").on(t.performanceId)],
);

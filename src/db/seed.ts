// Local development data. Wipes every table first. Run with: npm run db:seed
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "./schema";
import type { Db } from "./client";
import { createPerformances } from "../core/performances";
import { expandSchedule, type Times } from "../core/schedule";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema: s });

const DAYS = 7;
const TZ = "America/Chicago";
const ymd = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offset * 86400000),
  );

function nextWeek(times: Times) {
  const now = Date.now();
  return expandSchedule({ startDate: ymd(0), endDate: ymd(DAYS - 1), weekdays: [0, 1, 2, 3, 4, 5, 6], times, timeZone: TZ })
    .map((o) => o.startsAt)
    .filter((t) => t.getTime() > now);
}

async function main() {
  await db.execute(sql`TRUNCATE TABLE
    scans, ticket_events, tickets, payments, order_items, orders, holds, inventory_pools, performance_seats,
    performances, price_tiers, products, seats, seat_sections, seat_maps, memberships, users, venues, organizations
    CASCADE`);

  const [platform] = await db.insert(s.organizations).values({ kind: "platform", name: "Branson Explorer", slug: "branson-explorer" }).returning();
  const [mainHallCo] = await db.insert(s.organizations).values({ name: "Main Hall Entertainment", slug: "main-hall-entertainment" }).returning();
  const [racewayCo] = await db
    .insert(s.organizations)
    .values({ name: "Hollow Family Fun Park", slug: "hollow-family-fun", brandAccentHex: "#2E7D32" })
    .returning();
  const [cruiseCo] = await db.insert(s.organizations).values({ name: "Table Rock Cruises", slug: "table-rock-cruises" }).returning();

  const [mainHall] = await db.insert(s.venues).values({ orgId: mainHallCo.id, name: "Main Hall Theater", slug: "main-hall-theater", address: "76 Country Blvd, Branson, MO" }).returning();
  const [funPark] = await db.insert(s.venues).values({ orgId: racewayCo.id, name: "Hollow Family Fun Park", slug: "hollow-family-fun-park", address: "Branson, MO" }).returning();
  const [dock] = await db.insert(s.venues).values({ orgId: cruiseCo.id, name: "Table Rock Landing", slug: "table-rock-landing", address: "Table Rock Lake, MO" }).returning();

  const people = await db
    .insert(s.users)
    .values([
      { email: "admin@example.com", name: "Jordan (Platform admin)" },
      { email: "calls@example.com", name: "Casey (Call center)" },
      { email: "manager@example.com", name: "Morgan (Main Hall manager)" },
      { email: "window@example.com", name: "Riley (Main Hall box office)" },
      { email: "door@example.com", name: "Drew (Main Hall door)" },
      { email: "funpark@example.com", name: "Taylor (Fun park manager)" },
    ])
    .returning();
  const [admin, calls, manager, window, door, funManager] = people;
  await db.insert(s.memberships).values([
    { userId: admin.id, orgId: null, role: "platform_admin" },
    { userId: calls.id, orgId: null, role: "call_center" },
    { userId: manager.id, orgId: mainHallCo.id, role: "venue_manager" },
    { userId: window.id, orgId: mainHallCo.id, venueId: mainHall.id, role: "box_office" },
    { userId: door.id, orgId: mainHallCo.id, venueId: mainHall.id, role: "door" },
    { userId: funManager.id, orgId: racewayCo.id, role: "venue_manager" },
  ]);

  // Main Hall seat map: orchestra 12 rows (8 | 14 | 8) and balcony 5 rows (6 | 12 | 6).
  const [map] = await db.insert(s.seatMaps).values({ venueId: mainHall.id, name: "Main Hall" }).returning();
  const layout = [
    { name: "Orchestra", rows: "ABCDEFGHJKLM".split(""), blocks: [8, 14, 8], zone: (r: string) => ("ABCD".includes(r) ? "premium" : "standard") },
    { name: "Balcony", rows: ["AA", "BB", "CC", "DD", "EE"], blocks: [6, 12, 6], zone: () => "balcony" },
  ];
  const seatIds: string[] = [];
  let y = 0;
  for (const [i, sec] of layout.entries()) {
    const [section] = await db.insert(s.seatSections).values({ seatMapId: map.id, name: sec.name, sortOrder: i }).returning();
    const rows = sec.rows.flatMap((rowLabel) => {
      y += 1;
      let n = 0;
      let x = 0;
      return sec.blocks.flatMap((count, bi) => {
        if (bi > 0) x += 2;
        return Array.from({ length: count }, () => {
          n += 1;
          x += 1;
          return {
            sectionId: section.id,
            rowLabel,
            seatNumber: n,
            x,
            y,
            priceZone: sec.zone(rowLabel),
            isAccessible: rowLabel === "M" && (n <= 2 || n >= 29),
          };
        });
      });
    });
    y += 2;
    const inserted = await db.insert(s.seats).values(rows).returning({ id: s.seats.id });
    seatIds.push(...inserted.map((r) => r.id));
  }

  const [jubilee] = await db
    .insert(s.products)
    .values({
      orgId: mainHallCo.id,
      venueId: mainHall.id,
      name: "Ozark Country Jubilee",
      slug: "ozark-country-jubilee",
      category: "Music & variety",
      kind: "reserved",
      seatMapId: map.id,
      supplyType: "native",
      pricingModel: "commission",
      commissionBps: 1000,
      serviceFeeCents: 325,
    })
    .returning();
  await db.insert(s.priceTiers).values([
    { productId: jubilee.id, name: "Adult", priceZone: "premium", retailCents: 5800, sortOrder: 0 },
    { productId: jubilee.id, name: "Adult", priceZone: "standard", retailCents: 4800, sortOrder: 1 },
    { productId: jubilee.id, name: "Adult", priceZone: "balcony", retailCents: 3800, sortOrder: 2 },
    { productId: jubilee.id, name: "Teen (13–18)", retailCents: 3800, sortOrder: 3 },
    { productId: jubilee.id, name: "Child (4–12)", retailCents: 2400, sortOrder: 4 },
  ]);
  await createPerformances(db as unknown as Db, jubilee, nextWeek({ mode: "list", times: ["14:00", "19:30"] }), { durationMinutes: 120 });

  const [karts] = await db
    .insert(s.products)
    .values({
      orgId: racewayCo.id,
      venueId: funPark.id,
      name: "Hollow Raceway Go-Karts",
      slug: "hollow-raceway-go-karts",
      category: "Family fun",
      kind: "timed_entry",
      supplyType: "native",
      pricingModel: "commission",
      commissionBps: 800,
      serviceFeeCents: 150,
      requiresWaiver: true,
      minHeightInches: 54,
    })
    .returning();
  await db.insert(s.priceTiers).values([
    { productId: karts.id, name: "Driver", retailCents: 1800, sortOrder: 0 },
    { productId: karts.id, name: "Passenger (under 54 in)", retailCents: 1200, sortOrder: 1 },
  ]);
  await createPerformances(db as unknown as Db, karts, nextWeek({ mode: "interval", open: "10:00", close: "21:00", everyMinutes: 10 }), {
    capacity: 8,
    durationMinutes: 10,
  });

  const [putt] = await db
    .insert(s.products)
    .values({
      orgId: racewayCo.id,
      venueId: funPark.id,
      name: "Hollow Mini Golf",
      slug: "hollow-mini-golf",
      category: "Family fun",
      kind: "open_date",
      supplyType: "native",
      pricingModel: "commission",
      commissionBps: 800,
      validDays: 365,
    })
    .returning();
  await db.insert(s.priceTiers).values([
    { productId: putt.id, name: "Adult", retailCents: 1200, sortOrder: 0 },
    { productId: putt.id, name: "Child (4–12)", retailCents: 900, sortOrder: 1 },
  ]);
  await db.insert(s.inventoryPools).values({ productId: putt.id, label: "Any day", capacity: null });

  const [cruise] = await db
    .insert(s.products)
    .values({
      orgId: cruiseCo.id,
      venueId: dock.id,
      name: "Table Rock Dinner Cruise",
      slug: "table-rock-dinner-cruise",
      category: "On the lake",
      kind: "general_admission",
      supplyType: "allocation",
      pricingModel: "net_rate",
    })
    .returning();
  await db.insert(s.priceTiers).values([
    { productId: cruise.id, name: "Adult", retailCents: 6200, netCents: 4500, sortOrder: 0 },
    { productId: cruise.id, name: "Child (4–12)", retailCents: 3200, netCents: 2300, sortOrder: 1 },
  ]);
  await createPerformances(db as unknown as Db, cruise, nextWeek({ mode: "list", times: ["12:00", "19:00"] }), {
    capacity: 40,
    durationMinutes: 150,
  });

  console.log(`Seeded ${people.length} staff, 4 companies (incl. ${platform.name}), 4 products, ${seatIds.length} seats.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

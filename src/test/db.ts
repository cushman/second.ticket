import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

/** One venue with a 2-row theater, a reserved show, and a timed-entry go-kart slot. */
export async function seedFixture(db: Db, seatsPerRow = 5) {
  const [org] = await db.insert(schema.organizations).values({ name: "Main Hall Co", slug: "main-hall-co" }).returning();
  const [venue] = await db
    .insert(schema.venues)
    .values({ orgId: org.id, name: "Main Hall Theater", slug: "main-hall" })
    .returning();
  const [map] = await db.insert(schema.seatMaps).values({ venueId: venue.id, name: "Main floor" }).returning();
  const [section] = await db.insert(schema.seatSections).values({ seatMapId: map.id, name: "Orchestra" }).returning();
  const seatRows = await db
    .insert(schema.seats)
    .values(
      ["A", "B"].flatMap((rowLabel) =>
        Array.from({ length: seatsPerRow }, (_, i) => ({ sectionId: section.id, rowLabel, seatNumber: i + 1 })),
      ),
    )
    .returning();

  const [show] = await db
    .insert(schema.products)
    .values({
      orgId: org.id,
      venueId: venue.id,
      name: "Ozark Country Jubilee",
      slug: "ozark-country-jubilee",
      category: "Music & variety",
      kind: "reserved",
      seatMapId: map.id,
    })
    .returning();
  const [performance] = await db
    .insert(schema.performances)
    .values({ productId: show.id, startsAt: new Date("2026-11-19T19:30:00-06:00") })
    .returning();
  await db
    .insert(schema.performanceSeats)
    .values(seatRows.map((s) => ({ performanceId: performance.id, seatId: s.id })));

  const [karts] = await db
    .insert(schema.products)
    .values({
      orgId: org.id,
      venueId: venue.id,
      name: "Hollow Raceway Go-Karts",
      slug: "hollow-raceway",
      category: "Outdoor adventure",
      kind: "timed_entry",
      requiresWaiver: true,
      minHeightInches: 54,
    })
    .returning();
  const [slot] = await db
    .insert(schema.performances)
    .values({ productId: karts.id, startsAt: new Date("2026-11-19T14:10:00-06:00") })
    .returning();
  const [pool] = await db
    .insert(schema.inventoryPools)
    .values({ productId: karts.id, performanceId: slot.id, label: "2:10 PM heat", capacity: 8 })
    .returning();

  return { org, venue, seats: seatRows, show, performance, karts, slot, pool };
}

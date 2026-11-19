import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { organizations, priceTiers, products, seatMaps, seatSections, seats, users, venues } from "@/db/schema";
import { orgsFor, type Action } from "@/core/permissions";
import type { Staff } from "./auth";

function orgFilter(staff: Staff, action: Action, column: typeof venues.orgId | typeof products.orgId | typeof organizations.id) {
  const ids = orgsFor(staff.memberships, action);
  if (ids === "all") return undefined;
  return inArray(column, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
}

/** Venue ids a venue-restricted membership is limited to, or null when the staff member sees whole companies. */
function venueLimit(staff: Staff): string[] | null {
  const restricted = staff.memberships.filter((m) => m.orgId !== null && m.venueId !== null);
  const whole = staff.memberships.some((m) => m.orgId === null || m.venueId === null);
  return whole || restricted.length === 0 ? null : restricted.map((m) => m.venueId as string);
}

export async function companiesFor(staff: Staff, action: Action) {
  return getDb()
    .select({ id: organizations.id, name: organizations.name, kind: organizations.kind, brandAccentHex: organizations.brandAccentHex })
    .from(organizations)
    .where(orgFilter(staff, action, organizations.id))
    .orderBy(asc(organizations.name));
}

export async function venuesFor(staff: Staff, action: Action = "venue.manage") {
  const limit = venueLimit(staff);
  const rows = await getDb()
    .select({ id: venues.id, name: venues.name, address: venues.address, orgId: venues.orgId, orgName: organizations.name })
    .from(venues)
    .innerJoin(organizations, eq(organizations.id, venues.orgId))
    .where(orgFilter(staff, action, venues.orgId))
    .orderBy(asc(venues.name));
  return limit ? rows.filter((v) => limit.includes(v.id)) : rows;
}

export async function productsFor(staff: Staff) {
  const limit = venueLimit(staff);
  const rows = await getDb()
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      kind: products.kind,
      supplyType: products.supplyType,
      pricingModel: products.pricingModel,
      commissionBps: products.commissionBps,
      serviceFeeCents: products.serviceFeeCents,
      venueId: products.venueId,
      venueName: venues.name,
    })
    .from(products)
    .innerJoin(venues, eq(venues.id, products.venueId))
    .where(orgFilter(staff, "product.manage", products.orgId))
    .orderBy(asc(products.name));
  const visible = limit ? rows.filter((p) => limit.includes(p.venueId)) : rows;
  if (visible.length === 0) return [];
  const tiers = await getDb()
    .select()
    .from(priceTiers)
    .where(inArray(priceTiers.productId, visible.map((p) => p.id)))
    .orderBy(asc(priceTiers.sortOrder));
  return visible.map((p) => ({ ...p, tiers: tiers.filter((t) => t.productId === p.id) }));
}

export async function seatMapsFor(staff: Staff) {
  const allowed = await venuesFor(staff, "venue.manage");
  if (allowed.length === 0) return [];
  const maps = await getDb()
    .select({ id: seatMaps.id, name: seatMaps.name, venueId: seatMaps.venueId })
    .from(seatMaps)
    .where(inArray(seatMaps.venueId, allowed.map((v) => v.id)))
    .orderBy(asc(seatMaps.name));
  return maps.map((m) => ({ ...m, venueName: allowed.find((v) => v.id === m.venueId)?.name ?? "" }));
}

export async function seatMapDetail(staff: Staff, mapId: string) {
  const maps = await seatMapsFor(staff);
  const map = maps.find((m) => m.id === mapId);
  if (!map) return null;
  const db = getDb();
  const sections = await db.select().from(seatSections).where(eq(seatSections.seatMapId, map.id)).orderBy(asc(seatSections.sortOrder));
  const seatRows = sections.length
    ? await db.select().from(seats).where(inArray(seats.sectionId, sections.map((s) => s.id)))
    : [];
  return {
    ...map,
    sections: sections.map((s) => {
      const list = seatRows.filter((r) => r.sectionId === s.id);
      return { ...s, seats: list, rows: [...new Set(list.map((r) => r.rowLabel))] };
    }),
  };
}

export async function overviewCounts(staff: Staff) {
  const [v, p, m] = await Promise.all([venuesFor(staff), productsFor(staff), seatMapsFor(staff)]);
  return { venues: v.length, products: p.length, seatMaps: m.length };
}

export async function devSignInUsers() {
  return getDb().select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(asc(users.email));
}

"use server";

import { and, eq, gt, inArray, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  organizations,
  performanceSeats,
  performances,
  priceTiers,
  products,
  seatMaps,
  seatSections,
  seats,
  users,
  venues,
} from "@/db/schema";
import { can } from "@/core/permissions";
import { buildSection, parseAisles, parseRows } from "@/core/seatmap";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/core/session";
import { normalizeHex } from "@/core/theme";
import { devSignInEnabled, requireStaff, sessionSecret } from "@/server/auth";
import { seatMapsFor, venuesFor } from "@/server/admin-data";
import type { FormState } from "./form-state";

const NO_ACCESS: FormState = { message: "You don't have access to do that." };

function issues(error: z.ZodError): FormState {
  const errors: Record<string, string> = {};
  for (const i of error.issues) errors[String(i.path[0] ?? "form")] ??= i.code === "invalid_type" && !i.message.startsWith("Choose") && !i.message.startsWith("Enter") ? "This field is required" : i.message;
  return { errors, message: "Check the highlighted fields." };
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "item";
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(slug))) return slug;
  }
  return `${root}-${Date.now()}`;
}

const dollars = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 48 or 48.50")
  .transform((v) => Math.round(Number(v) * 100));

const percent = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a percentage like 10 or 8.25")
  .transform((v) => Math.round(Number(v) * 100))
  .refine((bps) => bps <= 10000, "Must be 100% or less");

const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Enter a whole number");

// ---------- Sign in / out ----------

export async function devSignIn(formData: FormData) {
  if (!devSignInEnabled()) throw new Error("Development sign-in is turned off.");
  const userId = z.uuid().parse(formData.get("userId"));
  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error("Unknown user");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  (await cookies()).set(SESSION_COOKIE, signSession(user.id, expires, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  redirect("/admin");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/signin");
}

// ---------- Venues ----------

const venueSchema = z.object({
  orgId: z.string().min(1, "Choose a company"),
  newCompany: z.string().trim().max(120).optional().default(""),
  name: z.string().trim().min(2, "Enter the venue name").max(120),
  address: z.string().trim().max(200).optional().default(""),
});

export async function createVenue(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = venueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return issues(parsed.error);
  const input = parsed.data;
  const db = getDb();

  let orgId = input.orgId;
  if (orgId === "new") {
    if (!can(staff.memberships, "platform.manage")) return NO_ACCESS;
    if (input.newCompany.length < 2) return { errors: { newCompany: "Enter the company name" } };
    const slug = await uniqueSlug(input.newCompany, async (s) => (await db.select().from(organizations).where(eq(organizations.slug, s))).length > 0);
    const [org] = await db.insert(organizations).values({ name: input.newCompany, slug }).returning();
    orgId = org.id;
  } else if (!can(staff.memberships, "venue.manage", { orgId })) {
    return NO_ACCESS;
  }

  const slug = await uniqueSlug(input.name, async (s) => (await db.select().from(venues).where(eq(venues.slug, s))).length > 0);
  await db.insert(venues).values({ orgId, name: input.name, slug, address: input.address || null });
  refresh();
  return { ok: true, message: `Added ${input.name}.` };
}

// ---------- Seat maps ----------

export async function createSeatMap(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = z
    .object({ venueId: z.uuid("Choose a venue"), name: z.string().trim().min(2, "Name the seat map").max(80) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return issues(parsed.error);
  const venue = (await venuesFor(staff)).find((v) => v.id === parsed.data.venueId);
  if (!venue || !can(staff.memberships, "venue.manage", { orgId: venue.orgId, venueId: venue.id })) return NO_ACCESS;

  const [map] = await getDb().insert(seatMaps).values({ venueId: venue.id, name: parsed.data.name }).returning();
  redirect(`/admin/seat-maps?map=${map.id}`);
}

export async function addSeatSection(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = z
    .object({
      mapId: z.uuid(),
      name: z.string().trim().min(1, "Name the section").max(60),
      rows: z.string().trim().min(1, "Enter rows like A-M"),
      seatsPerRow: z.coerce.number().int("Whole number").min(1, "At least 1").max(200, "200 at most"),
      aisles: z.string().optional().default(""),
      priceZone: z.string().trim().min(1, "Enter a price area").max(40),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return issues(parsed.error);
  const input = parsed.data;

  const map = (await seatMapsFor(staff)).find((m) => m.id === input.mapId);
  if (!map) return NO_ACCESS;

  let rowLabels: string[];
  let aisles: number[];
  try {
    rowLabels = parseRows(input.rows);
    aisles = parseAisles(input.aisles, input.seatsPerRow);
  } catch (e) {
    return { errors: { [String(e).includes("isle") ? "aisles" : "rows"]: (e as Error).message } };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const sections = await tx.select({ id: seatSections.id }).from(seatSections).where(eq(seatSections.seatMapId, map.id));
    const [{ maxY }] = sections.length
      ? await tx.select({ maxY: max(seats.y) }).from(seats).where(inArray(seats.sectionId, sections.map((s) => s.id)))
      : [{ maxY: null }];
    const [section] = await tx
      .insert(seatSections)
      .values({ seatMapId: map.id, name: input.name, sortOrder: sections.length })
      .returning();
    const created = await tx
      .insert(seats)
      .values(
        buildSection(rowLabels, input.seatsPerRow, aisles, maxY === null ? 0 : maxY + 2).map((s) => ({
          ...s,
          sectionId: section.id,
          priceZone: input.priceZone,
        })),
      )
      .returning({ id: seats.id });

    // New seats must also exist on every upcoming performance that uses this map.
    const upcoming = await tx
      .select({ id: performances.id })
      .from(performances)
      .innerJoin(products, eq(products.id, performances.productId))
      .where(and(eq(products.seatMapId, map.id), gt(performances.startsAt, new Date())));
    if (upcoming.length) {
      await tx
        .insert(performanceSeats)
        .values(upcoming.flatMap((p) => created.map((s) => ({ performanceId: p.id, seatId: s.id }))));
    }
  });

  refresh();
  return { ok: true, message: `Added ${input.name}: ${rowLabels.length} rows × ${input.seatsPerRow} seats.` };
}

// ---------- Products ----------

const productSchema = z.object({
  venueId: z.uuid("Choose a venue"),
  name: z.string({ error: "Enter a name" }).trim().min(2, "Enter a name").max(120),
  category: z.string({ error: "Choose a category" }).trim().min(2, "Choose a category"),
  kind: z.enum(["reserved", "general_admission", "timed_entry", "open_date"]),
  seatMapId: z.string().optional().default(""),
  validDays: optionalInt,
  minAge: optionalInt,
  minHeightInches: optionalInt,
  requiresWaiver: z.string().optional(),
  scanMode: z.enum(["single", "multi"]).default("single"),
  usesPerTicket: z.coerce.number().int().min(1).max(100).default(1),
  supplyType: z.enum(["native", "allocation", "api", "on_request"]).default("native"),
  pricingModel: z.enum(["commission", "net_rate"]).default("commission"),
  commission: percent.default(0),
  serviceFee: dollars.default(0),
  tax: percent.default(0),
});

export async function createProduct(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const raw = Object.fromEntries(formData);
  for (const key of ["commission", "serviceFee", "tax"]) if (raw[key] === "") delete raw[key];
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return issues(parsed.error);
  const input = parsed.data;

  const venue = (await venuesFor(staff, "product.manage")).find((v) => v.id === input.venueId);
  if (!venue || !can(staff.memberships, "product.manage", { orgId: venue.orgId, venueId: venue.id })) return NO_ACCESS;

  // Supply, money model and platform fees are business terms only the platform sets.
  const isPlatform = can(staff.memberships, "platform.manage");
  const terms = isPlatform
    ? { supplyType: input.supplyType, pricingModel: input.pricingModel, commissionBps: input.commission, serviceFeeCents: input.serviceFee }
    : { supplyType: "native" as const, pricingModel: "commission" as const, commissionBps: 0, serviceFeeCents: 0 };

  const db = getDb();
  let seatMapId: string | null = null;
  if (input.kind === "reserved") {
    const map = (await seatMapsFor(staff)).find((m) => m.id === input.seatMapId && m.venueId === venue.id);
    if (!map) return { errors: { seatMapId: "Reserved seating needs a seat map for this venue" } };
    seatMapId = map.id;
  }
  if (input.kind === "open_date" && !input.validDays) {
    return { errors: { validDays: "Open-date tickets need a number of days they stay valid" } };
  }

  const names = formData.getAll("tierName").map((v) => String(v).trim());
  const retail = formData.getAll("tierRetail").map((v) => String(v).trim());
  const net = formData.getAll("tierNet").map((v) => String(v).trim());
  const tiers: { name: string; retailCents: number; netCents: number | null }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (!names[i]) continue;
    const r = dollars.safeParse(retail[i] ?? "");
    if (!r.success) return { errors: { tiers: `Price for "${names[i]}": ${r.error.issues[0].message}` } };
    let n: number | null = null;
    if (terms.pricingModel === "net_rate") {
      const parsedNet = dollars.safeParse(net[i] ?? "");
      if (!parsedNet.success) return { errors: { tiers: `Net rate for "${names[i]}" is required for net-rate pricing` } };
      n = parsedNet.data;
    }
    tiers.push({ name: names[i], retailCents: r.data, netCents: n });
  }
  if (tiers.length === 0) return { errors: { tiers: "Add at least one ticket type and price" } };

  const slug = await uniqueSlug(input.name, async (s) => (await db.select().from(products).where(eq(products.slug, s))).length > 0);
  await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        orgId: venue.orgId,
        venueId: venue.id,
        name: input.name,
        slug,
        category: input.category,
        kind: input.kind,
        seatMapId,
        validDays: input.kind === "open_date" ? input.validDays : null,
        minAge: input.minAge,
        minHeightInches: input.minHeightInches,
        requiresWaiver: input.requiresWaiver === "on",
        scanMode: input.scanMode,
        usesPerTicket: input.scanMode === "multi" ? input.usesPerTicket : 1,
        taxBps: input.tax,
        ...terms,
      })
      .returning();
    await tx.insert(priceTiers).values(tiers.map((t, i) => ({ ...t, productId: product.id, sortOrder: i })));
  });

  refresh();
  return { ok: true, message: `Added ${input.name}. Next: add dates or time slots.` };
}

// ---------- Brand colors ----------

export async function saveCompanyAccent(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const orgId = String(formData.get("orgId") ?? "");
  if (!can(staff.memberships, "brand.manage", { orgId })) return NO_ACCESS;
  let hex: string | null;
  try {
    hex = formData.get("useDefault") ? null : normalizeHex(String(formData.get("accent") ?? ""));
  } catch {
    return { errors: { accent: "Pick a color or enter a hex code like #E8834A" } };
  }
  await getDb().update(organizations).set({ brandAccentHex: hex }).where(eq(organizations.id, orgId));
  refresh();
  return { ok: true, message: hex ? "Company color saved." : "Company color reset to Copper." };
}

export async function saveMyAccent(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let hex: string | null;
  try {
    hex = formData.get("useDefault") ? null : normalizeHex(String(formData.get("accent") ?? ""));
  } catch {
    return { errors: { accent: "Pick a color or enter a hex code like #E8834A" } };
  }
  await getDb().update(users).set({ accentHex: hex }).where(eq(users.id, staff.id));
  refresh();
  return { ok: true, message: hex ? "Your color saved." : "Your color now follows the company." };
}

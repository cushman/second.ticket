"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { holds } from "@/db/schema";
import { holdCapacity, holdSeats, InventoryError, releaseHold } from "@/core/inventory";
import { tierFor } from "@/core/pricing";
import { cartToken, ensureCartToken } from "@/server/cart";
import { openDatePool, performanceForSale, productBySlug } from "@/server/catalog";
import { MAX_TICKETS } from "./limits";

export interface ReserveState {
  message?: string;
}

const TAKEN = "Someone just took one of those seats. The map is updated; please pick again.";

function friendly(e: unknown): ReserveState {
  if (e instanceof InventoryError) {
    refresh();
    if (e.code === "unavailable") return { message: TAKEN };
    return { message: e.message };
  }
  throw e;
}

export async function reserveSeats(_: ReserveState, formData: FormData): Promise<ReserveState> {
  const slug = String(formData.get("slug") ?? "");
  const performanceId = z.uuid().safeParse(formData.get("performanceId"));
  const seatIds = formData.getAll("seat").map(String);
  const seatTiers = formData.getAll("seatTier").map(String);
  if (!performanceId.success || seatIds.length === 0) return { message: "Pick at least one seat." };
  if (seatIds.length > MAX_TICKETS) return { message: `You can buy up to ${MAX_TICKETS} tickets online. For groups, call us.` };
  if (seatTiers.length !== seatIds.length) return { message: "Choose a ticket type for each seat." };

  const show = await productBySlug(slug);
  if (!show || show.product.kind !== "reserved") return { message: "That show isn't available." };
  const sale = await performanceForSale(show.product.id, performanceId.data);
  if (!sale) return { message: "That date is no longer on sale." };

  const items = [];
  for (const [i, seatId] of seatIds.entries()) {
    const seat = sale.seats.find((s) => s.id === seatId);
    if (!seat) return { message: "One of those seats isn't part of this show." };
    const tier = tierFor(show.tiers, seatTiers[i], seat.zone);
    if (!tier) return { message: `${seatTiers[i]} tickets aren't sold for row ${seat.row}.` };
    items.push({ priceTierId: tier.id, seatId });
  }

  let holdId: string;
  try {
    const token = await ensureCartToken();
    ({ holdId } = await holdSeats(getDb(), {
      performanceId: sale.performance.id,
      seatIds,
      channel: "marketplace",
      customerToken: token,
      items,
    }));
  } catch (e) {
    return friendly(e);
  }
  redirect(`/checkout/${holdId}`);
}

export async function reserveTickets(_: ReserveState, formData: FormData): Promise<ReserveState> {
  const slug = String(formData.get("slug") ?? "");
  const show = await productBySlug(slug);
  if (!show || show.product.kind === "reserved") return { message: "That isn't available." };

  const items = show.tiers
    .map((t) => ({ priceTierId: t.id, quantity: Number(formData.get(`qty:${t.id}`) ?? 0) }))
    .filter((i) => Number.isInteger(i.quantity) && i.quantity > 0);
  const total = items.reduce((a, i) => a + i.quantity, 0);
  if (total === 0) return { message: "Add at least one ticket." };
  if (total > MAX_TICKETS) return { message: `You can buy up to ${MAX_TICKETS} tickets online. For groups, call us.` };

  let poolId: string | null;
  if (show.product.kind === "open_date") {
    poolId = (await openDatePool(show.product.id))?.poolId ?? null;
  } else {
    const performanceId = z.uuid().safeParse(formData.get("performanceId"));
    const sale = performanceId.success ? await performanceForSale(show.product.id, performanceId.data) : null;
    poolId = sale?.poolId ?? null;
  }
  if (!poolId) return { message: "That time is no longer on sale." };

  let holdId: string;
  try {
    const token = await ensureCartToken();
    ({ holdId } = await holdCapacity(getDb(), { poolId, quantity: total, channel: "marketplace", customerToken: token, items }));
  } catch (e) {
    const r = friendly(e);
    return r.message === TAKEN ? { message: "There aren't that many tickets left for this time. Try fewer tickets or another time." } : r;
  }
  redirect(`/checkout/${holdId}`);
}

export async function releaseReservation(formData: FormData) {
  const holdId = z.uuid().safeParse(formData.get("holdId"));
  const back = String(formData.get("back") ?? "/shows");
  const token = await cartToken();
  if (holdId.success && token) {
    const [hold] = await getDb()
      .select({ id: holds.id })
      .from(holds)
      .where(and(eq(holds.id, holdId.data), eq(holds.customerToken, token), eq(holds.status, "active")));
    if (hold) await releaseHold(getDb(), hold.id);
  }
  redirect(back.startsWith("/shows/") ? back : "/shows");
}

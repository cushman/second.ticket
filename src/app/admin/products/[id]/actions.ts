"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { performances } from "@/db/schema";
import { can } from "@/core/permissions";
import { createPerformances, PerformanceError, setPerformanceStatus } from "@/core/performances";
import { expandSchedule, type Times } from "@/core/schedule";
import { requireStaff } from "@/server/auth";
import { productDetail } from "@/server/admin-data";
import type { FormState } from "../../form-state";

async function managedProduct(productId: string) {
  const staff = await requireStaff();
  const detail = await productDetail(staff, productId);
  if (!detail) return null;
  const { product } = detail;
  if (!can(staff.memberships, "product.manage", { orgId: product.orgId, venueId: product.venueId })) return null;
  return detail;
}

const optionalPositive = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 100000), "Enter a whole number");

export async function addSchedule(_: FormState, formData: FormData): Promise<FormState> {
  const productId = z.uuid().safeParse(formData.get("productId"));
  if (!productId.success) return { message: "Unknown show." };
  const detail = await managedProduct(productId.data);
  if (!detail) return { message: "You don't have access to do that." };
  const { product, timeZone } = detail;

  const capacity = optionalPositive.safeParse(formData.get("capacity") ?? "");
  const duration = optionalPositive.safeParse(formData.get("duration") ?? "");
  if (!capacity.success) return { errors: { capacity: capacity.error.issues[0].message } };
  if (!duration.success) return { errors: { duration: duration.error.issues[0].message } };

  const times: Times =
    formData.get("mode") === "interval"
      ? {
          mode: "interval",
          open: String(formData.get("open") ?? ""),
          close: String(formData.get("close") ?? ""),
          everyMinutes: Number(formData.get("every")),
        }
      : { mode: "list", times: formData.getAll("time").map(String) };

  let occurrences;
  try {
    occurrences = expandSchedule({
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      weekdays: formData.getAll("weekday").map(Number),
      times,
      skipDates: String(formData.get("skipDates") ?? "").split(/[\s,]+/),
      timeZone,
    });
  } catch (e) {
    return { errors: { schedule: (e as Error).message } };
  }

  const now = Date.now();
  const future = occurrences.filter((o) => o.startsAt.getTime() > now).map((o) => o.startsAt);
  const past = occurrences.length - future.length;
  if (future.length === 0) return { errors: { schedule: "All of those times are in the past." } };

  try {
    const { created, skipped } = await createPerformances(getDb(), product, future, {
      capacity: capacity.data,
      durationMinutes: duration.data,
    });
    refresh();
    const notes = [skipped && `${skipped} already existed`, past && `${past} in the past were left out`].filter(Boolean);
    const noun = product.kind === "timed_entry" ? ["time slot", "time slots"] : ["date", "dates"];
    return { ok: true, message: `Added ${created} ${noun[created === 1 ? 0 : 1]}${notes.length ? ` (${notes.join(", ")})` : ""}.` };
  } catch (e) {
    return { errors: { schedule: (e as Error).message } };
  }
}

export async function setDateStatus(formData: FormData) {
  const input = z
    .object({ performanceId: z.uuid(), productId: z.uuid(), status: z.enum(["on_sale", "off_sale", "cancelled"]) })
    .parse(Object.fromEntries(formData));
  const detail = await managedProduct(input.productId);
  if (!detail) redirect(`/admin/products/${input.productId}?notice=${encodeURIComponent("You don't have access to do that.")}`);

  const [perf] = await getDb().select().from(performances).where(eq(performances.id, input.performanceId));
  if (!perf || perf.productId !== input.productId) redirect(`/admin/products/${input.productId}`);

  let notice: string;
  try {
    await setPerformanceStatus(getDb(), perf.id, input.status);
    notice = { on_sale: "Back on sale.", off_sale: "Taken off sale.", cancelled: "Date cancelled." }[input.status];
  } catch (e) {
    if (!(e instanceof PerformanceError)) throw e;
    notice = e.message;
  }
  redirect(`/admin/products/${input.productId}?notice=${encodeURIComponent(notice)}`);
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { upcomingPerformances, type PerformanceSummary } from "@/core/performances";
import { formatLocal } from "@/core/schedule";
import { requireStaff } from "@/server/auth";
import { productDetail } from "@/server/admin-data";
import { ActionForm } from "../../action-form";
import styles from "../../admin.module.css";
import { addSchedule, setDateStatus } from "./actions";
import { ScheduleFields } from "./schedule-fields";

const STATUS_LABEL = { on_sale: "On sale", off_sale: "Off sale", cancelled: "Cancelled" } as const;

function localDay(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function DateButton({ p, productId, status, label }: { p: PerformanceSummary; productId: string; status: string; label: string }) {
  return (
    <form action={setDateStatus}>
      <input type="hidden" name="performanceId" value={p.id} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={styles.linkButton}>
        {label}
      </button>
    </form>
  );
}

function Calendar({ list, productId, timeZone, compact }: { list: PerformanceSummary[]; productId: string; timeZone: string; compact: boolean }) {
  if (list.length === 0) return <p className={styles.empty}>No upcoming dates yet. Add some above.</p>;
  const days = new Map<string, PerformanceSummary[]>();
  for (const p of list) {
    const key = localDay(p.startsAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), p]);
  }
  const time = (p: PerformanceSummary) => formatLocal(p.startsAt, timeZone).split(" · ")[1];
  return (
    <div className={styles.days}>
      {[...days.values()].map((items) => {
        const sold = items.reduce((a, p) => a + p.sold, 0);
        const cap = items.reduce((a, p) => a + (p.capacity ?? 0), 0);
        const heading = formatLocal(items[0].startsAt, timeZone).split(" · ")[0];
        const rows = (
          <div className={styles.dayRows}>
            {items.map((p) => (
              <div key={p.id} className={styles.dateRow} data-status={p.status}>
                <span className={styles.mono}>{time(p)}</span>
                <span className={styles.muted}>
                  {p.sold} / {p.capacity ?? "∞"} sold
                </span>
                <span className={styles.pill}>{STATUS_LABEL[p.status]}</span>
                <span className={styles.dateActions}>
                  {p.status === "on_sale" && <DateButton p={p} productId={productId} status="off_sale" label="Take off sale" />}
                  {p.status !== "on_sale" && <DateButton p={p} productId={productId} status="on_sale" label="Put on sale" />}
                  {p.status !== "cancelled" && <DateButton p={p} productId={productId} status="cancelled" label="Cancel" />}
                </span>
              </div>
            ))}
          </div>
        );
        return compact ? (
          <details key={heading} className={styles.day}>
            <summary>
              <strong>{heading}</strong>
              <span className={styles.muted}>
                {items.length} slots · {sold} / {cap} sold
              </span>
            </summary>
            {rows}
          </details>
        ) : (
          <div key={heading} className={styles.day}>
            <strong>{heading}</strong>
            {rows}
          </div>
        );
      })}
    </div>
  );
}

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const staff = await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const detail = await productDetail(staff, id);
  if (!detail) {
    return (
      <section className={styles.panel}>
        <h2>Not found</h2>
        <p className={styles.empty}>This show doesn’t exist or you don’t have access to it.</p>
      </section>
    );
  }
  await connection();
  const { product, venueName, timeZone, seatMapName, tiers } = detail;
  const list = product.kind === "open_date" ? [] : await upcomingPerformances(getDb(), product.id, new Date());
  const today = localDay(new Date(), timeZone);

  return (
    <>
      <div className={styles.pageHead}>
        <Link href="/admin/products" className={styles.muted}>
          ← Shows &amp; attractions
        </Link>
        <h1>{product.name}</h1>
        <p>
          {venueName} · {product.category}
          {seatMapName ? ` · ${seatMapName} seat map` : ""} · {tiers.map((t) => `${t.name} $${(t.retailCents / 100).toFixed(2)}`).join(", ")}
        </p>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {product.kind === "open_date" ? (
        <section className={styles.panel}>
          <h2>No schedule needed</h2>
          <p className={styles.empty}>
            Open-date tickets can be used any day for {product.validDays} days after purchase, so there are no dates or time slots to add.
          </p>
        </section>
      ) : (
        <div className={styles.columns}>
          <section className={styles.panel}>
            <h2>Add {product.kind === "timed_entry" ? "time slots" : "dates"}</h2>
            <ActionForm action={addSchedule} submitLabel="Add to schedule">
              <ScheduleFields productId={product.id} kind={product.kind} timeZone={timeZone} today={today} />
            </ActionForm>
          </section>
          <section className={styles.panel}>
            <h2>Upcoming</h2>
            <Calendar list={list} productId={product.id} timeZone={timeZone} compact={product.kind === "timed_entry"} />
            {list.length === 400 && <p className={styles.hint}>Showing the next 400.</p>}
          </section>
        </div>
      )}
    </>
  );
}

export default function ProductDetailPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <Detail params={params} searchParams={searchParams as Promise<{ notice?: string }>} />
    </Suspense>
  );
}

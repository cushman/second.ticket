import Link from "next/link";
import { Suspense } from "react";
import { tierNames } from "@/core/pricing";
import { formatLocal } from "@/core/schedule";
import { openDatePool, performanceForSale, productBySlug, saleCalendar, type SaleTime } from "@/server/catalog";
import { dollars } from "../../show-card";
import { SiteHeader } from "../../site-header";
import styles from "../../site.module.css";
import { MAX_TICKETS } from "../limits";
import { SeatPicker } from "./seat-picker";
import { TicketCounter } from "./ticket-counter";
import { artFor } from "../../art";

type Search = { date?: string; time?: string };

function availabilityNote(remaining: number | null) {
  if (remaining === null) return "Available";
  if (remaining === 0) return "Sold out";
  if (remaining <= 10) return `${remaining} left`;
  return "Available";
}

function dayParts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: at.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    month: at.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    day: d,
  };
}

async function Show({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const show = await productBySlug(slug);
  if (!show) {
    return (
      <section className={styles.hero}>
        <h1 className={styles.pageTitle}>Not found</h1>
        <p className={styles.lead}>
          We couldn’t find that show. <Link href="/shows">See everything on sale</Link>.
        </p>
      </section>
    );
  }
  const { product, venueName, venueAddress, timeZone, tiers } = show;
  const names = tierNames(tiers);
  const priceList = names.map((n) => {
    const prices = tiers.filter((t) => t.name === n).map((t) => t.retailCents);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return `${n} ${lo === hi ? dollars(lo) : `${dollars(lo)}–${dollars(hi)}`}`;
  });

  const facts = [
    product.requiresWaiver && "Waiver required before riding",
    product.minHeightInches && `Must be at least ${product.minHeightInches} in tall`,
    product.minAge && `Ages ${product.minAge}+`,
    product.kind === "open_date" && `Use any day within ${product.validDays} days`,
    product.scanMode === "multi" && `${product.usesPerTicket} uses per ticket`,
  ].filter(Boolean) as string[];

  const header = (
    <section className={styles.hero}>
      <Link href={`/shows?category=${encodeURIComponent(product.category)}`} className={styles.backLink}>
        ← {product.category}
      </Link>
      <div className={styles.banner} style={{ backgroundImage: `url(${artFor(product.category, product.name)})` }} aria-hidden="true" />
      <h1 className={styles.pageTitle}>{product.name}</h1>
      <ul className={styles.facts}>
        <li>
          <strong>{venueName}</strong>
          {venueAddress ? ` · ${venueAddress}` : ""}
        </li>
        <li>{priceList.join(" · ")}</li>
      </ul>
      {facts.length > 0 && (
        <ul className={styles.facts}>
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <p className={styles.fine}>Prices before service fee and tax. You’ll see the full total before paying.</p>
    </section>
  );

  if (product.kind === "open_date") {
    const pool = await openDatePool(product.id);
    return (
      <>
        {header}
        <section className={styles.panel}>
          <h2>Tickets</h2>
          {pool ? (
            <TicketCounter slug={product.slug} performanceId={null} tiers={tiers} remaining={pool.remaining} max={MAX_TICKETS} />
          ) : (
            <p className={styles.empty}>Tickets aren’t on sale yet.</p>
          )}
        </section>
      </>
    );
  }

  const calendar = await saleCalendar(product.id, timeZone);
  const days = [...calendar.entries()];
  if (days.length === 0) {
    return (
      <>
        {header}
        <p className={styles.notice}>No dates are on sale right now. Check back soon.</p>
      </>
    );
  }
  const firstOpen = days.find(([, t]) => t.some((x) => x.remaining !== 0))?.[0] ?? days[0][0];
  const selectedDay = search.date && calendar.has(search.date) ? search.date : firstOpen;
  const times = calendar.get(selectedDay) ?? [];
  const selectedTime: SaleTime | undefined =
    times.find((t) => t.id === search.time) ?? (times.length === 1 && times[0].remaining !== 0 ? times[0] : undefined);
  const sale = selectedTime ? await performanceForSale(product.id, selectedTime.id) : null;
  const timeLabel = (t: SaleTime) => formatLocal(t.startsAt, timeZone).split(" · ")[1];

  return (
    <>
      {header}
      <section className={styles.panel} aria-labelledby="pick-date">
        <h2 id="pick-date">1. Pick a date</h2>
        <nav className={styles.dayStrip} aria-label="Dates">
          {days.map(([ymd, list]) => {
            const parts = dayParts(ymd);
            const left = list.some((t) => t.remaining === null) ? null : list.reduce((a, t) => a + (t.remaining ?? 0), 0);
            return (
              <Link
                key={ymd}
                href={`/shows/${product.slug}?date=${ymd}`}
                scroll={false}
                className={styles.day}
                aria-current={ymd === selectedDay ? "date" : undefined}
                data-soldout={left === 0}
              >
                <span>{parts.weekday}</span>
                <strong>{parts.day}</strong>
                <span className={styles.dayNote}>{left === 0 ? "Sold out" : parts.month}</span>
              </Link>
            );
          })}
        </nav>
      </section>

      <section className={styles.panel} aria-labelledby="pick-time">
        <h2 id="pick-time">2. Pick a time</h2>
        <div className={styles.times}>
          {times.map((t) => (
            <Link
              key={t.id}
              href={`/shows/${product.slug}?date=${selectedDay}&time=${t.id}`}
              scroll={false}
              className={styles.time}
              aria-current={t.id === selectedTime?.id ? "true" : undefined}
              aria-disabled={t.remaining === 0 ? "true" : undefined}
            >
              <strong>{timeLabel(t)}</strong>
              <span>{availabilityNote(t.remaining)}</span>
            </Link>
          ))}
        </div>
      </section>

      {selectedTime && (
        <section className={styles.panel} aria-labelledby="pick-seats">
          <h2 id="pick-seats">3. {product.kind === "reserved" ? "Choose seats" : "Choose tickets"}</h2>
          {!sale ? (
            <p className={styles.empty}>That time just went off sale. Please pick another.</p>
          ) : product.kind === "reserved" ? (
            <SeatPicker
              key={sale.performance.id}
              slug={product.slug}
              performanceId={sale.performance.id}
              seats={sale.seats}
              tiers={tiers}
              max={MAX_TICKETS}
              when={formatLocal(sale.performance.startsAt, timeZone)}
            />
          ) : (
            <TicketCounter
              key={sale.performance.id}
              slug={product.slug}
              performanceId={sale.performance.id}
              tiers={tiers}
              remaining={sale.remaining}
              max={MAX_TICKETS}
            />
          )}
        </section>
      )}
    </>
  );
}

export default function ShowPage({ params, searchParams }: PageProps<"/shows/[slug]">) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <Suspense fallback={<p className={styles.empty}>Loading…</p>}>
          <Show params={params} searchParams={searchParams as Promise<Search>} />
        </Suspense>
      </main>
    </div>
  );
}

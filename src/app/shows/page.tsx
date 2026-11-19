import Link from "next/link";
import { Suspense } from "react";
import { catalog, categoryCounts } from "@/server/catalog";
import { ShowCard } from "../show-card";
import { SiteHeader } from "../site-header";
import styles from "../site.module.css";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function niceDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

async function Listing({ searchParams }: { searchParams: Promise<{ category?: string; date?: string }> }) {
  const params = await searchParams;
  const category = params.category || undefined;
  const date = params.date && DATE.test(params.date) ? params.date : undefined;
  const [items, counts] = await Promise.all([catalog({ category, date }), categoryCounts()]);
  const query = (c?: string) => {
    const q = new URLSearchParams();
    if (c) q.set("category", c);
    if (date) q.set("date", date);
    const s = q.toString();
    return s ? `/shows?${s}` : "/shows";
  };

  return (
    <>
      <div className={styles.hero}>
        <h1 className={styles.pageTitle}>{category ?? "Everything on sale"}</h1>
        {date && (
          <p className={styles.lead}>
            Showing what’s on {niceDate(date)}. <Link href={category ? `/shows?category=${encodeURIComponent(category)}` : "/shows"}>Show all dates</Link>
          </p>
        )}
      </div>
      <nav className={styles.chips} aria-label="Categories">
        <Link href={query()} className={styles.chip} aria-current={!category ? "page" : undefined}>
          All
        </Link>
        {[...counts.keys()].sort().map((c) => (
          <Link key={c} href={query(c)} className={styles.chip} aria-current={c === category ? "page" : undefined}>
            {c} · {counts.get(c)}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className={styles.empty}>Nothing matches yet. Try another date or category.</p>
      ) : (
        <div className={styles.cards}>
          {items.map((item) => (
            <ShowCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

export default function ShowsPage({ searchParams }: PageProps<"/shows">) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <Suspense fallback={<p className={styles.empty}>Loading…</p>}>
          <Listing searchParams={searchParams as Promise<{ category?: string; date?: string }>} />
        </Suspense>
      </main>
    </div>
  );
}

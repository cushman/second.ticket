import Link from "next/link";
import { formatLocal } from "@/core/schedule";
import type { CatalogItem } from "@/server/catalog";
import styles from "./site.module.css";

const KIND = {
  reserved: "Reserved seats",
  general_admission: "General admission",
  timed_entry: "Timed entry",
  open_date: "Any day",
} as const;

export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function ShowCard({ item }: { item: CatalogItem }) {
  const badge = item.requiresWaiver ? "Waiver required" : KIND[item.kind];
  return (
    <Link href={`/shows/${item.slug}`} className={styles.cardLink}>
      <article className={styles.card}>
        <div className={styles.cardBody}>
          <p className={styles.kind}>
            {item.category} · {item.venueName}
          </p>
          <h3>{item.name}</h3>
          <div className={styles.photo}>
            <span>Photo</span>
            <span className={styles.badge}>{badge}</span>
          </div>
          <p className={styles.times}>{item.nextStart ? `Next: ${formatLocal(item.nextStart, item.timeZone)}` : "Use any day"}</p>
        </div>
        <div className={styles.stub}>
          <span>from</span>
          <strong>{item.fromCents === null ? "—" : dollars(item.fromCents)}</strong>
        </div>
      </article>
    </Link>
  );
}

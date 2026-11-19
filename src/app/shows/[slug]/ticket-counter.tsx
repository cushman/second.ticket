"use client";

import { useActionState, useState } from "react";
import type { TierRow } from "@/core/pricing";
import { reserveTickets, type ReserveState } from "../actions";
import styles from "./picker.module.css";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function TicketCounter({
  slug,
  performanceId,
  tiers,
  remaining,
  max,
}: {
  slug: string;
  performanceId: string | null;
  tiers: TierRow[];
  remaining: number | null;
  max: number;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, action, pending] = useActionState<ReserveState, FormData>(reserveTickets, {});
  const count = Object.values(qty).reduce((a, n) => a + n, 0);
  const limit = Math.min(max, remaining ?? max);
  const total = tiers.reduce((a, t) => a + (qty[t.id] ?? 0) * t.retailCents, 0);
  const change = (id: string, d: number) =>
    setQty((q) => {
      const next = Math.max(0, (q[id] ?? 0) + d);
      if (d > 0 && count >= limit) return q;
      return { ...q, [id]: next };
    });

  if (remaining === 0) return <p className={styles.muted}>Sold out. Please pick another time.</p>;

  return (
    <form action={action} className={styles.summary}>
      <input type="hidden" name="slug" value={slug} />
      {performanceId && <input type="hidden" name="performanceId" value={performanceId} />}
      <ul className={styles.counters}>
        {tiers.map((t) => (
          <li key={t.id}>
            <span>
              <strong>{t.name}</strong>
              <span className={styles.muted}> · {money(t.retailCents)}</span>
            </span>
            <span className={styles.stepper}>
              <button type="button" onClick={() => change(t.id, -1)} disabled={!qty[t.id]} aria-label={`One fewer ${t.name}`}>
                −
              </button>
              <output aria-live="polite" aria-label={`${t.name} tickets`}>
                {qty[t.id] ?? 0}
              </output>
              <button type="button" onClick={() => change(t.id, 1)} disabled={count >= limit} aria-label={`One more ${t.name}`}>
                +
              </button>
            </span>
            <input type="hidden" name={`qty:${t.id}`} value={qty[t.id] ?? 0} />
          </li>
        ))}
      </ul>
      {remaining !== null && remaining <= 10 && <p className={styles.muted}>Only {remaining} left for this time.</p>}
      {state.message && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      <div className={styles.footer}>
        <span className={styles.muted}>
          {count} {count === 1 ? "ticket" : "tickets"}
        </span>
        <button type="submit" className={styles.primary} disabled={count === 0 || pending}>
          {pending ? "Holding your tickets…" : count ? `Continue · ${money(total)}` : "Continue"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { tierFor, tierNames, type TierRow } from "@/core/pricing";
import { bestAvailable } from "@/core/seatmap";
import type { SeatForSale } from "@/server/catalog";
import { reserveSeats, type ReserveState } from "../actions";
import styles from "./picker.module.css";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function SeatPicker({
  slug,
  performanceId,
  seats,
  tiers,
  max,
  when,
}: {
  slug: string;
  performanceId: string;
  seats: SeatForSale[];
  tiers: TierRow[];
  max: number;
  when: string;
}) {
  const names = tierNames(tiers);
  const [selected, setSelected] = useState<string[]>([]);
  const [seatTier, setSeatTier] = useState<Record<string, string>>({});
  const [groupSize, setGroupSize] = useState(2);
  const [hint, setHint] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [state, action, pending] = useActionState<ReserveState, FormData>(reserveSeats, {});

  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const maxX = Math.max(...seats.map((s) => s.x));
  const maxY = Math.max(...seats.map((s) => s.y));
  const [width, setWidth] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Start with the whole house visible; zoom in from there.
  const preferred = maxX > 28 ? 18 : 24;
  let base = preferred;
  if (width) {
    const roomy = Math.floor((width - 8 - (maxX - 1) * 3) / maxX);
    base = roomy >= 14 ? Math.min(preferred, roomy) : Math.max(6, Math.floor((width - 8 - (maxX - 1)) / maxX));
  }
  const cell = Math.round(base * zoom);
  const gap = cell >= 14 ? 3 : 1;
  const available = seats.filter((s) => s.available).length;

  // Seats someone else took since the shopper clicked them drop out once the page refreshes.
  const chosen = selected.filter((id) => byId.get(id)?.available);

  const priceOf = (seatId: string) => {
    const seat = byId.get(seatId)!;
    return tierFor(tiers, seatTier[seatId] ?? names[0], seat.zone)?.retailCents ?? null;
  };
  const total = chosen.reduce((a, id) => a + (priceOf(id) ?? 0), 0);

  function toggle(id: string) {
    setHint(null);
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.filter((x) => byId.get(x)?.available).length >= max) {
        setHint(`You can choose up to ${max} seats online. For bigger groups, call us.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  function pickBest() {
    const ids = bestAvailable(
      seats.map((s) => ({ id: s.id, x: s.x, y: s.y, available: s.available })),
      groupSize,
    );
    if (!ids) {
      setHint(`There aren’t ${groupSize} seats together left. Pick seats on the map instead.`);
      return;
    }
    setHint(null);
    setSelected(ids);
  }

  const label = (s: SeatForSale) => `${s.section}, row ${s.row}, seat ${s.number}`;

  return (
    <div className={styles.picker}>
      <div className={styles.toolbar}>
        <label className={styles.inline}>
          Seats together
          <select value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.secondary} onClick={pickBest} disabled={available === 0}>
          Find best seats
        </button>
        <span className={styles.spacer} />
        <span className={styles.zoom} role="group" aria-label="Map size">
          <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Smaller map">
            −
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Bigger map">
            +
          </button>
        </span>
      </div>

      <ul className={styles.legend}>
        <li>
          <span className={styles.seat} aria-hidden="true" /> Available
        </li>
        <li>
          <span className={styles.seat} data-state="mine" aria-hidden="true">
            <Check />
          </span>{" "}
          Your seats
        </li>
        <li>
          <span className={styles.seat} data-state="taken" aria-hidden="true">
            <Cross />
          </span>{" "}
          Unavailable
        </li>
        <li>
          <span className={styles.seat} data-accessible="true" aria-hidden="true" /> Wheelchair space
        </li>
      </ul>

      <div className={styles.mapScroll} ref={mapRef}>
        <div className={styles.stage}>STAGE</div>
        <div
          className={styles.map}
          style={{ gridTemplateColumns: `repeat(${maxX}, ${cell}px)`, gridTemplateRows: `repeat(${maxY}, ${cell - (cell > 10 ? 2 : 1)}px)`, gap }}
          role="group"
          aria-label={`Seat map, ${available} seats available`}
        >
          {seats.map((s) => {
            const mine = chosen.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={styles.seat}
                style={{ gridColumn: s.x, gridRow: s.y }}
                data-state={mine ? "mine" : s.available ? "open" : "taken"}
                data-accessible={s.accessible || undefined}
                disabled={!s.available}
                aria-pressed={mine}
                aria-label={`${label(s)}${s.accessible ? ", wheelchair space" : ""}${s.available ? "" : ", unavailable"}`}
                title={label(s)}
                onClick={() => toggle(s.id)}
              >
                {mine ? <Check /> : !s.available ? <Cross /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {hint && (
        <p className={styles.hint} role="status">
          {hint}
        </p>
      )}

      <form action={action} className={styles.summary}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="performanceId" value={performanceId} />
        {chosen.length === 0 ? (
          <p className={styles.muted}>Tap seats on the map, or use “Find best seats”.</p>
        ) : (
          <ul className={styles.lines}>
            {chosen.map((id) => {
              const s = byId.get(id)!;
              const price = priceOf(id);
              return (
                <li key={id}>
                  <input type="hidden" name="seat" value={id} />
                  <span>
                    <strong>
                      Row {s.row}, seat {s.number}
                    </strong>
                    <span className={styles.muted}> · {s.section}</span>
                  </span>
                  <select
                    name="seatTier"
                    aria-label={`Ticket type for row ${s.row}, seat ${s.number}`}
                    value={seatTier[id] ?? names[0]}
                    onChange={(e) => setSeatTier((m) => ({ ...m, [id]: e.target.value }))}
                  >
                    {names.map((n) => (
                      <option key={n} value={n} disabled={!tierFor(tiers, n, s.zone)}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className={styles.price}>{price === null ? "—" : money(price)}</span>
                  <button type="button" className={styles.remove} onClick={() => toggle(id)} aria-label={`Remove row ${s.row}, seat ${s.number}`}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {state.message && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}
        <div className={styles.footer}>
          <span className={styles.muted}>{when}</span>
          <button type="submit" className={styles.primary} disabled={chosen.length === 0 || pending}>
            {pending ? "Holding your seats…" : chosen.length ? `Continue · ${money(total)}` : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 10 8" aria-hidden="true">
      <path d="M1 4L4 7L9 1" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

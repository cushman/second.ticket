import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/server/auth";
import { seatMapDetail, seatMapsFor, venuesFor } from "@/server/admin-data";
import { ActionForm, FieldError } from "../action-form";
import { addSeatSection, createSeatMap } from "../actions";
import styles from "../admin.module.css";

type Detail = NonNullable<Awaited<ReturnType<typeof seatMapDetail>>>;

function MapPreview({ map }: { map: Detail }) {
  const all = map.sections.flatMap((s) => s.seats);
  if (all.length === 0) return <p className={styles.empty}>No seats yet. Add the first section below.</p>;
  const maxX = Math.max(...all.map((s) => s.x));
  const maxY = Math.max(...all.map((s) => s.y));
  const cell = maxX > 28 ? 9 : 14;
  const hasAccessible = all.some((s) => s.isAccessible);
  return (
    <div className={styles.mapScroll}>
      <div className={styles.stage}>STAGE</div>
      <div
        className={styles.map}
        style={{
          gridTemplateColumns: `repeat(${maxX}, ${cell}px)`,
          gridTemplateRows: `repeat(${maxY}, ${cell - 2}px)`,
          gap: cell > 10 ? 3 : 2,
        }}
        role="img"
        aria-label={`${all.length} seats in ${map.sections.length} sections`}
      >
        {all.map((s) => (
          <span
            key={s.id}
            className={s.isAccessible ? styles.seatAccessible : styles.seat}
            style={{ gridColumn: s.x, gridRow: s.y, width: cell, height: cell - 2 }}
            title={`Row ${s.rowLabel}, seat ${s.seatNumber}${s.isAccessible ? " (accessible)" : ""}`}
          />
        ))}
      </div>
      {hasAccessible && (
        <p className={styles.legend}>
          <span className={styles.seatAccessible} aria-hidden="true" /> Wheelchair-accessible space
        </p>
      )}
    </div>
  );
}

async function SeatMaps({ searchParams }: { searchParams: Promise<{ map?: string }> }) {
  const staff = await requireStaff();
  const { map: selected } = await searchParams;
  const [maps, venues] = await Promise.all([seatMapsFor(staff), venuesFor(staff)]);
  const detail = selected ? await seatMapDetail(staff, selected) : null;

  return (
    <div className={styles.columns}>
      <div className={styles.form}>
        <section className={styles.panel}>
          <h2>Seat maps</h2>
          {maps.length === 0 ? (
            <p className={styles.empty}>No seat maps yet.</p>
          ) : (
            <div className={styles.listLinks}>
              {maps.map((m) => (
                <Link key={m.id} href={`/admin/seat-maps?map=${m.id}`} aria-current={m.id === selected ? "page" : undefined}>
                  <strong>{m.name}</strong>
                  <span className={styles.muted}>{m.venueName}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        {venues.length > 0 && (
          <section className={styles.panel}>
            <h2>New seat map</h2>
            <ActionForm action={createSeatMap} submitLabel="Create seat map">
              <label className={styles.field}>
                Venue
                <select name="venueId">
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <FieldError name="venueId" />
              </label>
              <label className={styles.field}>
                Name
                <input name="name" placeholder="Main floor" />
                <FieldError name="name" />
              </label>
            </ActionForm>
          </section>
        )}
      </div>

      {detail && (
        <div className={styles.form}>
          <section className={styles.panel}>
            <h2>{detail.name}</h2>
            <p className={styles.muted}>
              {detail.venueName} ·{" "}
              {detail.sections.map((s) => `${s.name} (${s.rows[0]}–${s.rows[s.rows.length - 1]}, ${s.seats.length} seats)`).join(" · ") ||
                "no sections"}
            </p>
            <MapPreview map={detail} />
          </section>
          <section className={styles.panel}>
            <h2>Add a section</h2>
            <ActionForm action={addSeatSection} submitLabel="Add section">
              <input type="hidden" name="mapId" value={detail.id} />
              <div className={styles.row}>
                <label className={styles.field}>
                  Section name
                  <input name="name" placeholder="Orchestra" />
                  <FieldError name="name" />
                </label>
                <label className={styles.field}>
                  Price area
                  <input name="priceZone" defaultValue="standard" />
                  <FieldError name="priceZone" />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.field}>
                  Rows
                  <span className={styles.hint}>A-M, AA-EE or 1-20. I and O are skipped.</span>
                  <input name="rows" placeholder="A-M" />
                  <FieldError name="rows" />
                </label>
                <label className={styles.field}>
                  Seats per row
                  <input name="seatsPerRow" inputMode="numeric" placeholder="30" />
                  <FieldError name="seatsPerRow" />
                </label>
                <label className={styles.field}>
                  Aisles after seat
                  <span className={styles.hint}>Seat numbers, e.g. 8, 22</span>
                  <input name="aisles" placeholder="8, 22" />
                  <FieldError name="aisles" />
                </label>
              </div>
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  );
}

export default function SeatMapsPage({ searchParams }: PageProps<"/admin/seat-maps">) {
  return (
    <>
      <div className={styles.pageHead}>
        <h1>Seat maps</h1>
        <p>Build a theater’s layout section by section. Seats added here go on sale for every upcoming show that uses the map.</p>
      </div>
      <Suspense fallback={<p className={styles.muted}>Loading seat maps…</p>}>
        <SeatMaps searchParams={searchParams as Promise<{ map?: string }>} />
      </Suspense>
    </>
  );
}

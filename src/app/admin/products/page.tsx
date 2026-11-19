import { Suspense } from "react";
import { can } from "@/core/permissions";
import { requireStaff } from "@/server/auth";
import { productsFor, seatMapsFor, venuesFor } from "@/server/admin-data";
import { ActionForm, FieldError } from "../action-form";
import { createProduct } from "../actions";
import styles from "../admin.module.css";

const KIND_LABELS = {
  reserved: "Reserved seats",
  general_admission: "General admission",
  timed_entry: "Timed entry",
  open_date: "Open date",
} as const;

const SUPPLY_LABELS = {
  native: "On Branson Explorer",
  allocation: "Ticket block",
  api: "Their system (API)",
  on_request: "Confirm by phone",
} as const;

const CATEGORIES = [
  "Music & variety",
  "Dinner shows",
  "Comedy & magic",
  "Faith & family",
  "Theme parks",
  "On the lake",
  "Family fun",
  "Museums",
  "Outdoor adventure",
];

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

async function Products() {
  const staff = await requireStaff();
  const [list, venues, maps] = await Promise.all([productsFor(staff), venuesFor(staff, "product.manage"), seatMapsFor(staff)]);
  const isPlatform = can(staff.memberships, "platform.manage");

  return (
    <div className={styles.form}>
      <section className={styles.panel}>
        <h2>Catalog</h2>
        {list.length === 0 ? (
          <p className={styles.empty}>Nothing listed yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Prices</th>
                  {isPlatform && <th>Supply · money</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <div className={styles.muted}>
                        {p.venueName} · {p.category}
                      </div>
                    </td>
                    <td>
                      <span className={styles.pill}>{KIND_LABELS[p.kind]}</span>
                    </td>
                    <td className={styles.mono}>
                      {p.tiers.map((t) => (
                        <div key={t.id}>
                          {t.name}
                          {t.priceZone ? ` (${t.priceZone})` : ""} {money(t.retailCents)}
                          {t.netCents != null ? ` · net ${money(t.netCents)}` : ""}
                        </div>
                      ))}
                    </td>
                    {isPlatform && (
                      <td>
                        <div>{SUPPLY_LABELS[p.supplyType]}</div>
                        <div className={styles.muted}>
                          {p.pricingModel === "commission"
                            ? `${p.commissionBps / 100}% commission + ${money(p.serviceFeeCents)} fee`
                            : `Net rate + ${money(p.serviceFeeCents)} fee`}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {venues.length > 0 && (
        <section className={styles.panel}>
          <h2>Add a show or attraction</h2>
          <ActionForm action={createProduct} submitLabel="Add to catalog">
            <div className={styles.row}>
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
                <input name="name" placeholder="Hollow Laser Tag" />
                <FieldError name="name" />
              </label>
              <label className={styles.field}>
                Category
                <select name="category" defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <FieldError name="category" />
              </label>
            </div>

            <fieldset className={styles.fieldset}>
              <legend>How tickets work</legend>
              <div className={styles.row}>
                <label className={styles.field}>
                  Ticket type
                  <select name="kind" defaultValue="timed_entry">
                    <option value="reserved">Reserved seats (theaters)</option>
                    <option value="general_admission">General admission with a capacity</option>
                    <option value="timed_entry">Timed entry (go-karts, laser tag)</option>
                    <option value="open_date">Open date (putt-putt, museums)</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Seat map
                  <span className={styles.hint}>Reserved seats only</span>
                  <select name="seatMapId" defaultValue="">
                    <option value="">None</option>
                    {maps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.venueName})
                      </option>
                    ))}
                  </select>
                  <FieldError name="seatMapId" />
                </label>
                <label className={styles.field}>
                  Valid for (days)
                  <span className={styles.hint}>Open date only</span>
                  <input name="validDays" inputMode="numeric" placeholder="365" />
                  <FieldError name="validDays" />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.field}>
                  Scanning
                  <select name="scanMode" defaultValue="single">
                    <option value="single">One use per ticket</option>
                    <option value="multi">Multiple uses (punch pass)</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Uses per ticket
                  <span className={styles.hint}>For punch passes, e.g. 5 laps</span>
                  <input name="usesPerTicket" inputMode="numeric" defaultValue="1" />
                </label>
                <label className={styles.field}>
                  Minimum height (inches)
                  <input name="minHeightInches" inputMode="numeric" placeholder="54" />
                  <FieldError name="minHeightInches" />
                </label>
                <label className={styles.field}>
                  Minimum age
                  <input name="minAge" inputMode="numeric" />
                  <FieldError name="minAge" />
                </label>
              </div>
              <label className={styles.check}>
                <input type="checkbox" name="requiresWaiver" /> Guests must sign a liability waiver
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Ticket types and prices</legend>
              <div className={styles.tierRow}>
                <span className={styles.hint}>Name</span>
                <span className={styles.hint}>Price ($)</span>
                <span className={styles.hint}>Net to venue ($)</span>
              </div>
              {["Adult", "Teen (13–18)", "Child (4–12)", ""].map((name, i) => (
                <div key={i} className={styles.tierRow}>
                  <input name="tierName" defaultValue={name} aria-label={`Ticket type ${i + 1} name`} />
                  <input name="tierRetail" inputMode="decimal" aria-label={`Ticket type ${i + 1} price`} />
                  <input name="tierNet" inputMode="decimal" aria-label={`Ticket type ${i + 1} net rate`} disabled={!isPlatform} />
                </div>
              ))}
              <FieldError name="tiers" />
              <label className={styles.field}>
                Sales tax (%)
                <input name="tax" inputMode="decimal" placeholder="0" />
                <FieldError name="tax" />
              </label>
            </fieldset>

            {isPlatform && (
              <fieldset className={styles.fieldset}>
                <legend>Branson Explorer terms (platform only)</legend>
                <div className={styles.row}>
                  <label className={styles.field}>
                    Where tickets come from
                    <select name="supplyType" defaultValue="native">
                      {Object.entries(SUPPLY_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Money model
                    <select name="pricingModel" defaultValue="commission">
                      <option value="commission">Commission (venue is seller)</option>
                      <option value="net_rate">Net rate (we are seller)</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    Commission (%)
                    <input name="commission" inputMode="decimal" placeholder="10" />
                    <FieldError name="commission" />
                  </label>
                  <label className={styles.field}>
                    Service fee per ticket ($)
                    <input name="serviceFee" inputMode="decimal" placeholder="3.25" />
                    <FieldError name="serviceFee" />
                  </label>
                </div>
              </fieldset>
            )}
          </ActionForm>
        </section>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <>
      <div className={styles.pageHead}>
        <h1>Shows &amp; attractions</h1>
        <p>Everything that sells: theater shows, go-karts, putt-putt, cruises. Dates and time slots come next.</p>
      </div>
      <Suspense fallback={<p className={styles.muted}>Loading catalog…</p>}>
        <Products />
      </Suspense>
    </>
  );
}

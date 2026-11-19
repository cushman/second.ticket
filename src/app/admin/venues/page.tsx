import { Suspense } from "react";
import { can } from "@/core/permissions";
import { requireStaff } from "@/server/auth";
import { companiesFor, venuesFor } from "@/server/admin-data";
import { ActionForm, FieldError } from "../action-form";
import { createVenue } from "../actions";
import styles from "../admin.module.css";

async function Venues() {
  const staff = await requireStaff();
  const [list, companies] = await Promise.all([venuesFor(staff), companiesFor(staff, "venue.manage")]);
  const isPlatform = can(staff.memberships, "platform.manage");
  const options = companies.filter((c) => c.kind === "venue_operator");
  const canAdd = isPlatform || options.some((c) => can(staff.memberships, "venue.manage", { orgId: c.id }));

  return (
    <div className={styles.columns}>
      <section className={styles.panel}>
        <h2>Your venues</h2>
        {list.length === 0 ? (
          <p className={styles.empty}>No venues yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Company</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.name}</strong>
                    </td>
                    <td>{v.orgName}</td>
                    <td className={styles.muted}>{v.address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canAdd && (
        <section className={styles.panel}>
          <h2>Add a venue</h2>
          <ActionForm action={createVenue} submitLabel="Add venue">
            <label className={styles.field}>
              Company
              <select name="orgId" defaultValue={options[0]?.id ?? "new"}>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {isPlatform && <option value="new">New company…</option>}
              </select>
              <FieldError name="orgId" />
            </label>
            {isPlatform && (
              <label className={styles.field}>
                New company name
                <span className={styles.hint}>Only needed when you choose “New company”.</span>
                <input name="newCompany" placeholder="Silver Hollow Attractions LLC" />
                <FieldError name="newCompany" />
              </label>
            )}
            <label className={styles.field}>
              Venue name
              <input name="name" required placeholder="Main Hall Theater" />
              <FieldError name="name" />
            </label>
            <label className={styles.field}>
              Address
              <input name="address" placeholder="76 Country Blvd, Branson, MO" />
            </label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

export default function VenuesPage() {
  return (
    <>
      <div className={styles.pageHead}>
        <h1>Venues</h1>
        <p>Theaters, parks and docks. Each venue can have seat maps, shows and attractions.</p>
      </div>
      <Suspense fallback={<p className={styles.muted}>Loading venues…</p>}>
        <Venues />
      </Suspense>
    </>
  );
}

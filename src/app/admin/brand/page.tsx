import { Suspense } from "react";
import { requireStaff } from "@/server/auth";
import { companiesFor } from "@/server/admin-data";
import { AccentPicker } from "../accent-picker";
import { ActionForm, FieldError } from "../action-form";
import { saveCompanyAccent, saveMyAccent } from "../actions";
import styles from "../admin.module.css";

function ResetButton({ label }: { label: string }) {
  return (
    <button type="submit" name="useDefault" value="1" className={styles.ghost}>
      {label}
    </button>
  );
}

async function Brand() {
  const staff = await requireStaff();
  const companies = (await companiesFor(staff, "brand.manage")).filter((c) => c.kind === "venue_operator");

  return (
    <div className={styles.columns}>
      <section className={styles.panel}>
        <h2>Your color</h2>
        <p className={styles.muted}>Changes the accent on your own screens only. Leave it unset to follow your company.</p>
        <ActionForm action={saveMyAccent} submitLabel="Save my color" extraButtons={<ResetButton label="Follow company" />}>
          <AccentPicker id="me" initial={staff.accentHex} />
          <FieldError name="accent" />
        </ActionForm>
      </section>

      {companies.map((c) => (
        <section key={c.id} className={styles.panel}>
          <h2>{c.name}</h2>
          <p className={styles.muted}>Used across your staff screens and on your branded ticket pages.</p>
          <ActionForm action={saveCompanyAccent} submitLabel="Save company color" extraButtons={<ResetButton label="Reset to Copper" />}>
            <input type="hidden" name="orgId" value={c.id} />
            <AccentPicker id={c.id} initial={c.brandAccentHex} />
            <FieldError name="accent" />
          </ActionForm>
        </section>
      ))}
    </div>
  );
}

export default function BrandPage() {
  return (
    <>
      <div className={styles.pageHead}>
        <h1>Brand colors</h1>
        <p>Pick any accent. Branson Explorer makes a dark and a light version that stay readable.</p>
      </div>
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <Brand />
      </Suspense>
    </>
  );
}

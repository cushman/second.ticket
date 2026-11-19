import Link from "next/link";
import { Suspense } from "react";
import { can, ROLE_LABELS } from "@/core/permissions";
import { requireStaff } from "@/server/auth";
import { overviewCounts } from "@/server/admin-data";
import styles from "./admin.module.css";

async function Overview() {
  const staff = await requireStaff();
  const counts = await overviewCounts(staff);
  const isPlatform = can(staff.memberships, "platform.manage");
  return (
    <>
      <div className={styles.pageHead}>
        <h1>Hi, {staff.name.split(" ")[0]}</h1>
        <p>
          {isPlatform
            ? "You can see and manage every company on Branson Explorer."
            : `Signed in as ${[...new Set(staff.memberships.map((m) => ROLE_LABELS[m.role]))].join(", ")}.`}
        </p>
      </div>
      <div className={styles.stats}>
        <Link href="/admin/venues" className={styles.stat}>
          <span>Venues</span>
          <strong>{counts.venues}</strong>
        </Link>
        <Link href="/admin/seat-maps" className={styles.stat}>
          <span>Seat maps</span>
          <strong>{counts.seatMaps}</strong>
        </Link>
        <Link href="/admin/products" className={styles.stat}>
          <span>Shows &amp; attractions</span>
          <strong>{counts.products}</strong>
        </Link>
      </div>
      <section className={styles.panel}>
        <h2>Coming next</h2>
        <p className={styles.empty}>
          Dates and time slots for each show, then checkout. Selling, scanning and the live dashboard follow once tickets
          can be bought.
        </p>
      </section>
    </>
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <Overview />
    </Suspense>
  );
}

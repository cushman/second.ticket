import Link from "next/link";
import { Suspense } from "react";
import { ROLE_LABELS } from "@/core/permissions";
import { DEFAULT_ACCENT, deriveTheme, themeCss } from "@/core/theme";
import { requireStaff } from "@/server/auth";
import { ThemeToggle } from "../theme-toggle";
import { signOut } from "./actions";
import styles from "./admin.module.css";

async function StaffCard() {
  const staff = await requireStaff();
  const accent = staff.accentHex ?? staff.orgAccentHex ?? DEFAULT_ACCENT;
  const roles = [...new Set(staff.memberships.map((m) => ROLE_LABELS[m.role]))].join(", ");
  return (
    <div className={styles.staffCard}>
      <style dangerouslySetInnerHTML={{ __html: themeCss(deriveTheme(accent)) }} />
      <strong>{staff.name}</strong>
      <span className={styles.muted}>{roles}</span>
      <div className={styles.buttons}>
        <ThemeToggle className={styles.ghost} />
        <form action={signOut}>
          <button type="submit" className={styles.ghost}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <svg width="20" height="13" viewBox="0 0 18 12">
              <path d="M1 11 L7 2 L11 7 L13 4.5 L17 11 Z" fill="currentColor" />
            </svg>
          </span>
          Branson Explorer
        </Link>
        <nav className={styles.nav} aria-label="Admin">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/venues">Venues</Link>
          <Link href="/admin/seat-maps">Seat maps</Link>
          <Link href="/admin/products">Shows &amp; attractions</Link>
          <Link href="/admin/brand">Brand colors</Link>
        </nav>
        <Suspense fallback={<div className={styles.staffCard} />}>
          <StaffCard />
        </Suspense>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

import Link from "next/link";
import styles from "./site.module.css";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <svg width="24" height="16" viewBox="0 0 18 12">
            <path d="M1 11 L7 2 L11 7 L13 4.5 L17 11 Z" fill="currentColor" />
          </svg>
        </span>
        <span>Branson Explorer</span>
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/shows">Shows</Link>
        <Link href="/shows?category=Family%20fun">Attractions</Link>
        <Link href="/shows?category=On%20the%20lake">On the lake</Link>
        <Link href="/shows">This week</Link>
      </nav>
      <div className={styles.actions}>
        <ThemeToggle className={styles.iconButton} />
        <Link href="/admin" className={styles.ghostButton}>
          Staff
        </Link>
        <Link href="/shows" className={styles.accentButton}>
          Get tickets
        </Link>
      </div>
    </header>
  );
}

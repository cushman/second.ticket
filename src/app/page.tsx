import Link from "next/link";
import styles from "./page.module.css";
import { categories, featured } from "./sample-data";
import { ThemeToggle } from "./theme-toggle";

function LogoMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <svg width="24" height="16" viewBox="0 0 18 12">
        <path d="M1 11 L7 2 L11 7 L13 4.5 L17 11 Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <LogoMark />
          <span>Branson Explorer</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <a href="#shows">Shows</a>
          <a href="#browse">Attractions</a>
          <a href="#browse">Christmas</a>
          <a href="#browse">Groups</a>
        </nav>
        <div className={styles.actions}>
          <ThemeToggle className={styles.iconButton} />
          <a href="#" className={styles.ghostButton}>Sign in</a>
          <a href="#" className={styles.accentButton}>My tickets</a>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>76 Country Blvd · Branson, MO</p>
          <h1 className={styles.headline}>
            Showtime
            <br />
            on the <span>76.</span>
          </h1>
          <p className={styles.lead}>
            Shows, theme parks, go-karts and lake cruises across Branson. Pick a date, tell us who’s coming, and your
            tickets go straight to your phone.
          </p>
          <form className={styles.search} action="#shows">
            <label className={styles.field}>
              <span>Date</span>
              <input name="date" type="date" defaultValue="2026-11-19" />
            </label>
            <label className={styles.field}>
              <span>Group size</span>
              <input name="guests" defaultValue="2 adults, 2 kids" />
            </label>
            <button type="submit" className={styles.searchButton}>Find tickets</button>
          </form>
          <p className={styles.fine}>Every price shows tax and fees before you check out.</p>
        </section>

        <section id="shows" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Featured</h2>
            <span>Promoted · partner placement</span>
          </div>
          <div className={styles.cards}>
            {featured.map((s) => (
              <article key={s.slug} className={styles.card}>
                <div className={styles.cardBody}>
                  <p className={styles.kind}>{s.kind}</p>
                  <h3>{s.name}</h3>
                  <div className={styles.photo}>
                    <span>Show photo</span>
                    <span className={styles.badge}>{s.badge}</span>
                  </div>
                  <p className={styles.times}>{s.times}</p>
                </div>
                <div className={styles.stub}>
                  <span>Adult</span>
                  <strong>{s.adult}</strong>
                  <span>Child {s.child}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="browse" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Browse</h2>
          </div>
          <div className={styles.categories}>
            {categories.map((c) => (
              <a key={c.name} href="#" className={styles.category}>
                <strong>{c.name}</strong>
                <span>{c.note}</span>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>Sample shows, times and prices for layout only.</footer>
    </div>
  );
}

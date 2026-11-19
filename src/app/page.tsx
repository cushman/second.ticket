import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { catalog, categoryCounts } from "@/server/catalog";
import { artFor } from "./art";
import { ShowCard } from "./show-card";
import { SiteHeader } from "./site-header";
import styles from "./site.module.css";

const CATEGORY_NOTES: Record<string, string> = {
  "Music & variety": "Matinee and evening shows",
  "Dinner shows": "Meal and show together",
  "Comedy & magic": "Family-friendly laughs",
  "Faith & family": "Biblical and gospel stages",
  "Theme parks": "Rides, crafts, festivals",
  "On the lake": "Cruises on Table Rock",
  "Family fun": "Go-karts, putt-putt, laser tag",
  Museums: "Indoor, any weather",
  "Outdoor adventure": "Ziplines, caves, ATVs",
};

function todayInBranson() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

async function Featured() {
  await connection();
  const items = (await catalog()).slice(0, 3);
  if (items.length === 0) return <p className={styles.empty}>New shows are being added. Check back soon.</p>;
  return (
    <div className={styles.cards}>
      {items.map((item) => (
        <ShowCard key={item.id} item={item} />
      ))}
    </div>
  );
}

async function Browse() {
  await connection();
  const counts = await categoryCounts();
  const names = Object.keys(CATEGORY_NOTES);
  return (
    <div className={styles.categories}>
      {names.map((name) => (
        <Link key={name} href={`/shows?category=${encodeURIComponent(name)}`} className={styles.category}>
          <span className={styles.categoryArt} style={{ backgroundImage: `url(${artFor(name)})` }} aria-hidden="true" />
          <span className={styles.categoryText}>
            <strong>{name}</strong>
            <span>
              {counts.get(name) ? `${counts.get(name)} on sale · ` : ""}
              {CATEGORY_NOTES[name]}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

async function SearchForm() {
  await connection();
  return (
    <form className={styles.search} action="/shows">
      <label className={styles.field}>
        <span>Date</span>
        <input name="date" type="date" defaultValue={todayInBranson()} />
      </label>
      <label className={styles.field}>
        <span>Group size</span>
        <input name="guests" type="number" min={1} max={10} defaultValue={4} />
      </label>
      <button type="submit" className={styles.searchButton}>
        Find tickets
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.heroWrap}>
          <div className={styles.hero}>
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
            <Suspense fallback={<div className={styles.search} style={{ minHeight: 70 }} />}>
              <SearchForm />
            </Suspense>
            <p className={styles.fine}>Every price shows tax and fees before you check out.</p>
          </div>
          <div className={styles.collage} aria-hidden="true">
            <span style={{ backgroundImage: "url(/art/stage.svg)" }} />
            <span style={{ backgroundImage: "url(/art/lake.svg)" }} />
            <span style={{ backgroundImage: "url(/art/karts.svg)" }} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Featured</h2>
            <Link href="/shows">See everything</Link>
          </div>
          <Suspense fallback={<p className={styles.empty}>Loading shows…</p>}>
            <Featured />
          </Suspense>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Browse</h2>
          </div>
          <Suspense fallback={<p className={styles.empty}>Loading…</p>}>
            <Browse />
          </Suspense>
        </section>
      </main>
      <footer className={styles.footer}>Branson Explorer · Illustrations stand in until venue photos arrive.</footer>
    </div>
  );
}

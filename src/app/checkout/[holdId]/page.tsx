import Link from "next/link";
import { Suspense } from "react";
import { formatLocal } from "@/core/schedule";
import { cartToken } from "@/server/cart";
import { loadCheckout } from "@/server/checkout";
import { releaseReservation } from "../../shows/actions";
import { SiteHeader } from "../../site-header";
import styles from "../../site.module.css";
import checkout from "./checkout.module.css";
import { Countdown } from "./countdown";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

async function Checkout({ params }: { params: Promise<{ holdId: string }> }) {
  const [{ holdId }, token] = await Promise.all([params, cartToken()]);
  const data = /^[0-9a-f-]{36}$/.test(holdId) && token ? await loadCheckout(holdId, token) : null;

  if (!data) {
    return (
      <section className={styles.hero}>
        <h1 className={styles.pageTitle}>Nothing on hold</h1>
        <p className={styles.lead}>
          We couldn’t find tickets held for you on this device. <Link href="/shows">Find tickets</Link>
        </p>
      </section>
    );
  }

  const { hold, expired, product, venueName, timeZone, startsAt, lines, totals } = data;
  const back = `/shows/${product.slug}`;

  if (hold.status === "converted") {
    return (
      <section className={styles.hero}>
        <h1 className={styles.pageTitle}>Already booked</h1>
        <p className={styles.lead}>These tickets have been purchased.</p>
      </section>
    );
  }

  if (expired) {
    return (
      <section className={styles.hero}>
        <h1 className={styles.pageTitle}>Your hold ended</h1>
        <p className={styles.lead}>
          We hold tickets for 10 minutes so others can buy them too. They may still be available.{" "}
          <Link href={back}>Pick again</Link>
        </p>
      </section>
    );
  }

  return (
    <div className={checkout.layout}>
      <section className={styles.hero}>
        <Link href={back} className={styles.backLink}>
          ← {product.name}
        </Link>
        <h1 className={styles.pageTitle}>Review your tickets</h1>
        <p className={checkout.timer}>
          Held for you for <Countdown expiresAt={hold.expiresAt!.toISOString()} />
        </p>
      </section>

      <div className={checkout.columns}>
        <section className={styles.panel} aria-labelledby="order">
          <h2 id="order">{product.name}</h2>
          <p className={styles.empty}>
            {venueName}
            {startsAt ? ` · ${formatLocal(startsAt, timeZone)}` : ` · Use any day within ${product.validDays} days`}
          </p>
          <table className={checkout.table}>
            <tbody>
              {lines.map((l) => (
                <tr key={l.label}>
                  <th scope="row">
                    {l.quantity} × {l.label}
                    {l.detail.length > 0 && <span>{l.detail.join(" · ")}</span>}
                  </th>
                  <td>{money(l.price.subtotalCents)}</td>
                </tr>
              ))}
              {totals.feeCents > 0 && (
                <tr>
                  <th scope="row">Service fee</th>
                  <td>{money(totals.feeCents)}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Tax</th>
                <td>{money(totals.taxCents)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{money(totals.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
          {product.requiresWaiver && <p className={styles.notice}>Every rider signs a short waiver before their ticket can be used.</p>}
        </section>

        <section className={styles.panel} aria-labelledby="pay">
          <h2 id="pay">Payment</h2>
          <p className={styles.empty}>Online payment is being connected. Your tickets stay held until the timer runs out.</p>
          <button type="button" className={checkout.pay} disabled>
            Pay {money(totals.totalCents)}
          </button>
          <form action={releaseReservation}>
            <input type="hidden" name="holdId" value={hold.id} />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className={checkout.secondary}>
              Change tickets
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function CheckoutPage({ params }: PageProps<"/checkout/[holdId]">) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <Suspense fallback={<p className={styles.empty}>Loading…</p>}>
          <Checkout params={params} />
        </Suspense>
      </main>
    </div>
  );
}

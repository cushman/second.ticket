import { connection } from "next/server";
import { Suspense } from "react";
import { devSignInEnabled } from "@/server/auth";
import { devSignInUsers } from "@/server/admin-data";
import { devSignIn } from "../admin/actions";
import styles from "../admin/admin.module.css";

async function People() {
  await connection();
  if (!devSignInEnabled()) {
    return <p className={styles.muted}>Staff sign-in is being set up. Contact Branson Explorer for access.</p>;
  }
  const people = await devSignInUsers();
  return (
    <>
      <p className={styles.notice}>Development sign-in: choose a sample staff member. This is turned off in production.</p>
      <div className={styles.people}>
        {people.map((p) => (
          <form key={p.id} action={devSignIn}>
            <input type="hidden" name="userId" value={p.id} />
            <button type="submit">
              {p.name}
              <span>{p.email}</span>
            </button>
          </form>
        ))}
      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <main className={styles.signin}>
      <div className={styles.pageHead}>
        <h1>Staff sign in</h1>
        <p>For venue, box office and Branson Explorer staff.</p>
      </div>
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <People />
      </Suspense>
    </main>
  );
}

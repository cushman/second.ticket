import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { memberships, organizations, users } from "@/db/schema";
import type { Membership } from "@/core/permissions";
import { SESSION_COOKIE, verifySession } from "@/core/session";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return secret;
}

/** Pick-a-user sign-in for local development only. Real sign-in replaces it before launch. */
export function devSignInEnabled(): boolean {
  return process.env.ALLOW_DEV_SIGNIN === "true" && process.env.NODE_ENV !== "production";
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  accentHex: string | null;
  orgAccentHex: string | null;
  memberships: Membership[];
}

export const getStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await connection();
  const userId = verifySession(token, sessionSecret(), new Date());
  if (!userId) return null;

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const rows = await db
    .select({
      role: memberships.role,
      orgId: memberships.orgId,
      venueId: memberships.venueId,
      orgAccent: organizations.brandAccentHex,
    })
    .from(memberships)
    .leftJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, user.id));
  if (rows.length === 0) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accentHex: user.accentHex,
    orgAccentHex: rows.find((r) => r.orgAccent)?.orgAccent ?? null,
    memberships: rows.map(({ role, orgId, venueId }) => ({ role, orgId, venueId })),
  };
});

export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/signin");
  return staff;
}

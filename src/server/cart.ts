import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const CART_COOKIE = "be_cart";

export async function cartToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && /^[A-Za-z0-9_-]{32,}$/.test(value) ? value : null;
}

/** Call from a server action: returns this browser's cart token, creating one if needed. */
export async function ensureCartToken(): Promise<string> {
  const existing = await cartToken();
  if (existing) return existing;
  const token = randomBytes(24).toString("base64url");
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

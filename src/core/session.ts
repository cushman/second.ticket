import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "be_session";
export const SESSION_HOURS = 12;

function mac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(userId: string, expiresAt: Date, secret: string): string {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const payload = `${userId}.${expiresAt.getTime()}`;
  return `${payload}.${mac(payload, secret)}`;
}

/** Returns the user id for a valid, unexpired token, otherwise null. */
export function verifySession(token: string | undefined, secret: string, now: Date = new Date()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = Buffer.from(mac(`${userId}.${exp}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) <= now.getTime()) return null;
  return userId;
}

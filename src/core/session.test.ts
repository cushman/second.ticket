import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "test-secret-test-secret-test-secret-123";
const USER = "6f0b7c1e-0000-4000-8000-000000000001";

describe("session tokens", () => {
  const now = new Date("2026-11-19T18:00:00Z");
  const later = new Date(now.getTime() + 3600_000);

  it("round-trips a valid token", () => {
    expect(verifySession(signSession(USER, later, SECRET), SECRET, now)).toBe(USER);
  });

  it("rejects expired, tampered, foreign and malformed tokens", () => {
    const token = signSession(USER, later, SECRET);
    expect(verifySession(token, SECRET, new Date(later.getTime() + 1))).toBeNull();
    expect(verifySession(token.replace(USER, "6f0b7c1e-0000-4000-8000-000000000002"), SECRET, now)).toBeNull();
    expect(verifySession(token, "another-secret-another-secret-12345", now)).toBeNull();
    expect(verifySession("garbage", SECRET, now)).toBeNull();
    expect(verifySession(undefined, SECRET, now)).toBeNull();
  });

  it("refuses short secrets", () => {
    expect(() => signSession(USER, later, "short")).toThrow();
  });
});

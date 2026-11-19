import { describe, expect, it } from "vitest";
import { contrast, deriveTheme, normalizeHex, SURFACES, themeCss } from "./theme";

describe("deriveTheme", () => {
  it("keeps copper as-is in dark mode and darkens it for white text in light mode", () => {
    const t = deriveTheme("#E8834A");
    expect(t.dark.accent).toBe("#E8834A");
    expect(t.light.accent).not.toBe("#E8834A");
    expect(contrast(t.light.accent, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("makes every possible pick readable in both modes", () => {
    const steps = ["00", "33", "66", "99", "CC", "FF"];
    for (const r of steps)
      for (const g of steps)
        for (const b of steps) {
          const t = deriveTheme(`#${r}${g}${b}`);
          expect(contrast(t.dark.accent, t.dark.onAccent)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.dark.accentText, SURFACES.dark.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.light.accent, t.light.onAccent)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.light.accentText, SURFACES.light.bg)).toBeGreaterThanOrEqual(4.5);
        }
  });

  it("normalizes input and rejects junk", () => {
    expect(normalizeHex("e83")).toBe("#EE8833");
    expect(() => deriveTheme("copper")).toThrow();
  });

  it("emits CSS for a venue scope", () => {
    const css = themeCss(deriveTheme("#2E7D32"), ".venue-theme");
    expect(css).toContain(".venue-theme { --be-accent:");
    expect(css).toContain(':root[data-theme="light"] .venue-theme');
  });
});

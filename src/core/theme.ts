/**
 * Turns any accent color a venue picks into readable dark- and light-mode variants.
 * Dark mode: dark text on the accent. Light mode: white text on the accent.
 * The lightness is nudged only as far as needed to reach WCAG AA (4.5:1).
 */

export const SURFACES = {
  dark: { bg: "#151312", panel: "#201C1A", ink: "#151312" },
  light: { bg: "#F5F3F1", panel: "#FFFFFF", ink: "#FFFFFF" },
} as const;

export const DEFAULT_ACCENT = "#E8834A";
const MIN_CONTRAST = 4.5;

export interface AccentSet {
  accent: string;
  onAccent: string;
  accentText: string;
}

export interface DerivedTheme {
  input: string;
  dark: AccentSet;
  light: AccentSet;
  /** True when the picked color had to be lightened or darkened for readability. */
  adjusted: boolean;
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function normalizeHex(input: string): string {
  const m = HEX.exec(input.trim());
  if (!m) throw new Error(`"${input}" is not a hex color`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** Moves lightness in one direction until the color reaches the contrast target against `against`. */
function shiftUntil(hex: string, against: string, direction: 1 | -1): string {
  const [h, s, l0] = toHsl(hex);
  for (let step = 0; step <= 100; step++) {
    const l = Math.min(1, Math.max(0, l0 + direction * step * 0.01));
    const candidate = fromHsl(h, s, l);
    if (contrast(candidate, against) >= MIN_CONTRAST) return candidate;
    if ((direction === 1 && l === 1) || (direction === -1 && l === 0)) return candidate;
  }
  return hex;
}

export function deriveTheme(input: string = DEFAULT_ACCENT): DerivedTheme {
  const base = normalizeHex(input);

  const darkAccent = shiftUntil(base, SURFACES.dark.ink, 1);
  const darkText = shiftUntil(darkAccent, SURFACES.dark.bg, 1);
  const lightAccent = shiftUntil(base, SURFACES.light.ink, -1);
  const lightText = shiftUntil(lightAccent, SURFACES.light.bg, -1);

  return {
    input: base,
    dark: { accent: darkAccent, onAccent: SURFACES.dark.ink, accentText: darkText },
    light: { accent: lightAccent, onAccent: SURFACES.light.ink, accentText: lightText },
    adjusted: darkAccent !== base || lightAccent !== base,
  };
}

/** CSS that overrides the accent tokens in design/tokens.css for one venue or user. */
export function themeCss(theme: DerivedTheme, selector = ":root"): string {
  const vars = (s: AccentSet) =>
    `--be-accent: ${s.accent}; --be-on-accent: ${s.onAccent}; --be-accent-text: ${s.accentText};`;
  const scoped = (rootState: string) =>
    selector === ":root" ? `:root${rootState}` : `:root${rootState} ${selector}`;
  return [
    `${selector} { ${vars(theme.dark)} }`,
    `@media (prefers-color-scheme: light) { ${scoped(':not([data-theme="dark"])')} { ${vars(theme.light)} } }`,
    `${scoped('[data-theme="light"]')} { ${vars(theme.light)} }`,
  ].join("\n");
}

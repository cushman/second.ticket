"use client";

import { useState } from "react";
import { DEFAULT_ACCENT, deriveTheme, normalizeHex, SURFACES } from "@/core/theme";
import styles from "./accent-picker.module.css";

const PRESETS = [
  { name: "Copper", hex: DEFAULT_ACCENT },
  { name: "Ember", hex: "#FF5A3C" },
  { name: "Marquee gold", hex: "#F5B544" },
  { name: "Lake teal", hex: "#1C9AA8" },
  { name: "Ozark green", hex: "#2E7D32" },
  { name: "Neon pink", hex: "#FF3D7F" },
  { name: "Violet", hex: "#8B6CFF" },
  { name: "Ink blue", hex: "#3B6FE0" },
];

function safeTheme(hex: string) {
  try {
    return deriveTheme(hex);
  } catch {
    return null;
  }
}

export function AccentPicker({ id, initial }: { id: string; initial: string | null }) {
  const [hex, setHex] = useState(initial ?? DEFAULT_ACCENT);
  const [text, setText] = useState(initial ?? DEFAULT_ACCENT);
  const theme = safeTheme(hex);

  function choose(value: string) {
    setText(value);
    try {
      setHex(normalizeHex(value));
    } catch {}
  }

  return (
    <div className={styles.picker}>
      <input type="hidden" name="accent" value={hex} />
      <div className={styles.controls}>
        <label className={styles.wheel}>
          <input type="color" value={hex.toLowerCase()} onChange={(e) => choose(e.target.value.toUpperCase())} aria-label="Pick any color" />
          <span>Pick any color</span>
        </label>
        <label className={styles.hex} htmlFor={`${id}-hex`}>
          Hex code
          <input id={`${id}-hex`} value={text} onChange={(e) => choose(e.target.value)} spellCheck={false} maxLength={7} />
        </label>
      </div>
      <div className={styles.presets} role="group" aria-label="Suggested colors">
        {PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            className={styles.swatch}
            style={{ background: p.hex }}
            aria-label={p.name}
            aria-pressed={hex === p.hex}
            title={p.name}
            onClick={() => choose(p.hex)}
          />
        ))}
      </div>
      {theme && (
        <div className={styles.previews}>
          {(["dark", "light"] as const).map((mode) => (
            <div key={mode} className={styles.preview} style={{ background: SURFACES[mode].bg, color: mode === "dark" ? "#F5F0EB" : "#1C1816" }}>
              <span className={styles.modeLabel}>{mode === "dark" ? "Dark mode" : "Light mode"}</span>
              <span className={styles.previewTitle}>
                Showtime on the <span style={{ color: theme[mode].accentText }}>76.</span>
              </span>
              <span className={styles.previewButton} style={{ background: theme[mode].accent, color: theme[mode].onAccent }}>
                Find tickets
              </span>
              <span className={styles.previewHex}>{theme[mode].accent}</span>
            </div>
          ))}
        </div>
      )}
      {theme?.adjusted && (
        <p className={styles.note}>This color is adjusted slightly in one mode so button text stays easy to read.</p>
      )}
    </div>
  );
}

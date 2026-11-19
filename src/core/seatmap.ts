/**
 * Turns a section description ("rows A-M, 30 seats, aisles after 8 and 22") into seat positions.
 * Row specs: "A-M", "AA-EE", "1-20", or lists like "A,B,C". Letters I and O are skipped in
 * ranges by default because theaters avoid them (they look like 1 and 0).
 */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function parseRows(spec: string, skip: readonly string[] = ["I", "O"]): string[] {
  const out: string[] = [];
  for (const raw of spec.split(",")) {
    const part = raw.trim().toUpperCase();
    if (!part) continue;
    const range = /^([A-Z]+|\d+)\s*-\s*([A-Z]+|\d+)$/.exec(part);
    if (!range) {
      if (!/^[A-Z]+$|^\d+$/.test(part)) throw new Error(`"${raw.trim()}" isn't a row label or range`);
      out.push(part);
      continue;
    }
    const [, from, to] = range;
    if (/^\d+$/.test(from) && /^\d+$/.test(to)) {
      const a = Number(from);
      const b = Number(to);
      if (b < a) throw new Error(`Row range ${part} runs backwards`);
      for (let n = a; n <= b; n++) out.push(String(n));
      continue;
    }
    const sameLetter = (s: string) => /^([A-Z])\1*$/.test(s);
    if (!sameLetter(from) || !sameLetter(to) || from.length !== to.length) {
      throw new Error(`Row range ${part} must be like A-M or AA-EE`);
    }
    const a = LETTERS.indexOf(from[0]);
    const b = LETTERS.indexOf(to[0]);
    if (b < a) throw new Error(`Row range ${part} runs backwards`);
    for (let i = a; i <= b; i++) {
      const letter = LETTERS[i];
      if (skip.includes(letter)) continue;
      out.push(letter.repeat(from.length));
    }
  }
  if (out.length === 0) throw new Error("Enter at least one row");
  if (new Set(out).size !== out.length) throw new Error("Each row label can only appear once");
  return out;
}

export function parseAisles(spec: string, seatsPerRow: number): number[] {
  if (!spec.trim()) return [];
  const nums = spec.split(",").map((s) => Number(s.trim()));
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n >= seatsPerRow) {
      throw new Error(`Aisles must be seat numbers between 1 and ${seatsPerRow - 1}`);
    }
  }
  return [...new Set(nums)].sort((a, b) => a - b);
}

export interface SeatSpec {
  rowLabel: string;
  seatNumber: number;
  x: number;
  y: number;
}

/** Lays out seats left to right; each aisle adds a two-seat gap. startY lets sections stack. */
export function buildSection(rows: string[], seatsPerRow: number, aislesAfter: number[], startY = 0): SeatSpec[] {
  if (!Number.isInteger(seatsPerRow) || seatsPerRow < 1 || seatsPerRow > 200) {
    throw new Error("Seats per row must be between 1 and 200");
  }
  return rows.flatMap((rowLabel, r) => {
    let x = 0;
    return Array.from({ length: seatsPerRow }, (_, i) => {
      const seatNumber = i + 1;
      x += aislesAfter.includes(i) ? 3 : 1;
      return { rowLabel, seatNumber, x, y: startY + r + 1 };
    });
  });
}

export interface PickSeat {
  id: string;
  x: number;
  y: number;
  available: boolean;
}

/**
 * Finds n seats side by side in one row, never across an aisle, closest to the front and centre.
 * One row back counts the same as four seats off centre. Returns null when no such block exists.
 */
export function bestAvailable(seats: readonly PickSeat[], n: number): string[] | null {
  if (!Number.isInteger(n) || n < 1 || seats.length === 0) return null;
  const xs = seats.map((s) => s.x);
  const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
  const rows = [...new Set(seats.map((s) => s.y))].sort((a, b) => a - b);

  let best: { score: number; ids: string[] } | null = null;
  rows.forEach((y, rank) => {
    const row = seats.filter((s) => s.y === y).sort((a, b) => a.x - b.x);
    let run: PickSeat[] = [];
    const consider = () => {
      for (let i = 0; i + n <= run.length; i++) {
        const block = run.slice(i, i + n);
        const mid = (block[0].x + block[n - 1].x) / 2;
        const score = rank + Math.abs(mid - centre) / 4;
        if (!best || score < best.score) best = { score, ids: block.map((s) => s.id) };
      }
    };
    for (const seat of row) {
      const touching = run.length > 0 && seat.x === run[run.length - 1].x + 1;
      if (seat.available && (touching || run.length === 0)) run.push(seat);
      else {
        consider();
        run = seat.available ? [seat] : [];
      }
    }
    consider();
  });
  return (best as { ids: string[] } | null)?.ids ?? null;
}

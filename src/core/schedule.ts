/**
 * Expands a schedule ("Tue–Sat at 2:00 and 7:30 PM, Mar 1–Dec 20, dark Dec 25") into exact start times.
 * Times are venue wall-clock times; conversion to UTC follows the venue's time zone, including
 * daylight-saving changes.
 */

export const MAX_OCCURRENCES = 5000;

export type Times = { mode: "list"; times: string[] } | { mode: "interval"; open: string; close: string; everyMinutes: number };

export interface ScheduleRule {
  startDate: string; // YYYY-MM-DD, venue local
  endDate: string; // inclusive
  weekdays: number[]; // 0 = Sunday
  times: Times;
  skipDates?: string[];
  timeZone: string;
}

export interface Occurrence {
  date: string;
  time: string;
  startsAt: Date;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseDate(s: string) {
  if (!DATE.test(s)) throw new Error(`"${s}" isn't a date like 2026-11-19`);
  const [y, m, d] = s.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  if (new Date(t).getUTCDate() !== d) throw new Error(`"${s}" isn't a real date`);
  return t;
}

function minutesOf(s: string) {
  const m = TIME.exec(s.trim());
  if (!m) throw new Error(`"${s}" isn't a time like 19:30`);
  return Number(m[1]) * 60 + Number(m[2]);
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Offset of a time zone from UTC at a given instant, in minutes (Chicago in winter: -360). */
function offsetMinutes(timeZone: string, at: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at) / 60000);
}

/** UTC instant for a wall-clock time in a zone. A time skipped by spring-forward moves an hour later. */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const local = parseDate(date) + minutesOf(time) * 60000;
  const before = offsetMinutes(timeZone, local - 12 * 3600000);
  const after = offsetMinutes(timeZone, local + 12 * 3600000);
  const valid = [before, after]
    .map((off) => local - off * 60000)
    .filter((utc, i) => offsetMinutes(timeZone, utc) === [before, after][i])
    .sort((a, b) => a - b);
  // Ambiguous fall-back times take the first occurrence; nonexistent spring-forward times shift later.
  return new Date(valid[0] ?? local - before * 60000);
}

function timesFor(times: Times): string[] {
  if (times.mode === "list") {
    const list = [...new Set(times.times.map((t) => t.trim()).filter(Boolean))];
    if (list.length === 0) throw new Error("Add at least one start time");
    list.forEach(minutesOf);
    return list.sort((a, b) => minutesOf(a) - minutesOf(b));
  }
  const open = minutesOf(times.open);
  const close = minutesOf(times.close);
  if (close <= open) throw new Error("Closing time must be after opening time");
  if (!Number.isInteger(times.everyMinutes) || times.everyMinutes < 5 || times.everyMinutes > 240) {
    throw new Error("Slots must be every 5 to 240 minutes");
  }
  const out: string[] = [];
  for (let m = open; m + times.everyMinutes <= close; m += times.everyMinutes) out.push(hhmm(m));
  if (out.length === 0) throw new Error("No slot fits between opening and closing");
  return out;
}

export function expandSchedule(rule: ScheduleRule): Occurrence[] {
  const start = parseDate(rule.startDate);
  const end = parseDate(rule.endDate);
  if (end < start) throw new Error("The last date is before the first date");
  if (end - start > 400 * 86400000) throw new Error("Schedules can cover at most about 13 months at a time");
  if (rule.weekdays.length === 0) throw new Error("Pick at least one day of the week");
  const skip = new Set((rule.skipDates ?? []).map((d) => d.trim()).filter(Boolean));
  skip.forEach(parseDate);
  const times = timesFor(rule.times);

  const out: Occurrence[] = [];
  for (let t = start; t <= end; t += 86400000) {
    const d = new Date(t);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    if (!rule.weekdays.includes(d.getUTCDay()) || skip.has(date)) continue;
    for (const time of times) {
      out.push({ date, time, startsAt: zonedTime(date, time, rule.timeZone) });
      if (out.length > MAX_OCCURRENCES) {
        throw new Error(`That's more than ${MAX_OCCURRENCES} dates and times. Add them in smaller ranges.`);
      }
    }
  }
  return out;
}

/** "Thu, Nov 19 · 7:30 PM" in the venue's zone. */
export function formatLocal(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(at)
    .replace(/, (\d)/, " · $1")
    .replace(" at ", " · ");
}

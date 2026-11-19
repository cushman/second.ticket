"use client";

import { useState } from "react";
import { expandSchedule, formatLocal, type Times } from "@/core/schedule";
import { FieldError } from "../../action-form";
import styles from "../../admin.module.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleFields({
  productId,
  kind,
  timeZone,
  today,
}: {
  productId: string;
  kind: "reserved" | "general_admission" | "timed_entry";
  timeZone: string;
  today: string;
}) {
  const interval = kind === "timed_entry";
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [weekdays, setWeekdays] = useState<number[]>(interval ? [0, 1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]);
  const [times, setTimes] = useState<string[]>(["14:00", "19:30"]);
  const [open, setOpen] = useState("10:00");
  const [close, setClose] = useState("21:00");
  const [every, setEvery] = useState("10");
  const [skip, setSkip] = useState("");

  const rule: Times = interval ? { mode: "interval", open, close, everyMinutes: Number(every) } : { mode: "list", times };
  let preview: string;
  try {
    const occ = expandSchedule({ startDate, endDate, weekdays, times: rule, skipDates: skip.split(/[\s,]+/), timeZone });
    const days = new Set(occ.map((o) => o.date)).size;
    preview = occ.length
      ? `${occ.length} ${interval ? "time slots" : "performances"} on ${days} ${days === 1 ? "day" : "days"}, from ${formatLocal(occ[0].startsAt, timeZone)} to ${formatLocal(occ[occ.length - 1].startsAt, timeZone)}.`
      : "No dates match. Check the days of the week.";
  } catch (e) {
    preview = (e as Error).message;
  }

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  return (
    <>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="mode" value={interval ? "interval" : "list"} />
      <div className={styles.row}>
        <label className={styles.field}>
          First date
          <input type="date" name="startDate" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className={styles.field}>
          Last date
          <input type="date" name="endDate" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Days of the week</legend>
        <div className={styles.buttons}>
          {DAYS.map((d, i) => (
            <label key={d} className={styles.check}>
              <input type="checkbox" name="weekday" value={i} checked={weekdays.includes(i)} onChange={() => toggleDay(i)} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      {interval ? (
        <div className={styles.row}>
          <label className={styles.field}>
            Opens
            <input type="time" name="open" value={open} onChange={(e) => setOpen(e.target.value)} />
          </label>
          <label className={styles.field}>
            Closes
            <input type="time" name="close" value={close} onChange={(e) => setClose(e.target.value)} />
          </label>
          <label className={styles.field}>
            A slot every (minutes)
            <input name="every" inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value)} />
          </label>
        </div>
      ) : (
        <fieldset className={styles.fieldset}>
          <legend>Start times</legend>
          <div className={styles.buttons}>
            {times.map((t, i) => (
              <span key={i} className={styles.timeChip}>
                <input
                  type="time"
                  name="time"
                  value={t}
                  aria-label={`Start time ${i + 1}`}
                  onChange={(e) => setTimes((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {times.length > 1 && (
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTimes((all) => all.filter((_, j) => j !== i))}>
                    ×
                  </button>
                )}
              </span>
            ))}
            <button type="button" className={styles.ghost} onClick={() => setTimes((all) => [...all, "11:00"])}>
              Add a time
            </button>
          </div>
        </fieldset>
      )}

      <div className={styles.row}>
        {kind !== "reserved" && (
          <label className={styles.field}>
            Tickets per {interval ? "slot" : "date"}
            <input name="capacity" inputMode="numeric" placeholder={interval ? "8" : "40"} />
            <FieldError name="capacity" />
          </label>
        )}
        <label className={styles.field}>
          Length (minutes)
          <span className={styles.hint}>Optional</span>
          <input name="duration" inputMode="numeric" placeholder={interval ? every : "120"} />
          <FieldError name="duration" />
        </label>
      </div>

      <label className={styles.field}>
        Dark days
        <span className={styles.hint}>Dates with no shows, e.g. 2026-12-25, 2026-12-31</span>
        <input name="skipDates" value={skip} onChange={(e) => setSkip(e.target.value)} placeholder="2026-12-25" />
      </label>

      <p className={styles.notice} aria-live="polite">
        {preview}
      </p>
      <FieldError name="schedule" />
    </>
  );
}

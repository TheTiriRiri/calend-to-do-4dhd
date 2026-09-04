export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function todayStart(now: Date = new Date()): Date {
  return startOfDay(now);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local (not UTC) yyyy-mm-dd. Never use Date.toISOString() for day values. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 7-day window starting `weekOffset` weeks from the window that contains
 *  `anchor` (offset 0 = the 7 days from anchor's day on) — the calendar's
 *  browsable week (I-10: events further out than +6 days were unreachable). */
export function weekWindow(anchor: Date, weekOffset: number): Date[] {
  const start = addDays(startOfDay(anchor), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

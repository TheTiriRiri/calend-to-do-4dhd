import type { CalendarEvent, Task } from './types';
import { sameDay, startOfDay, todayStart, toISODate } from './dates';

export function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => sameDay(new Date(e.startsAt), day))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Day view for day D (spec §5): tasks with scheduledDate == D, EXCEPT incomplete
 *  ones when D < today — overdue tasks exist only on the daily list. Completed
 *  tasks stay visible on their day. */
export function tasksScheduledOn(tasks: Task[], day: Date, now: Date = new Date()): Task[] {
  const d = toISODate(day);
  const isPast = startOfDay(day) < todayStart(now);
  return tasks.filter((t) => t.scheduledDate === d && (!!t.dateCompleted || !isPast));
}

/** End must be after start. Both are "HH:mm" (same local day) or ISO datetimes —
 *  lexicographic compare works for both formats. */
export function eventTimesValid(start: string, end?: string): boolean {
  return !end || end > start;
}

export type TaskRowsMode = 'all' | 'timed' | 'none';

export type DayEntry =
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'task'; task: Task };

function entryTime(entry: DayEntry): string {
  if (entry.kind === 'event') return new Date(entry.event.startsAt).toTimeString().slice(0, 5);
  return entry.task.scheduledTime ?? '';
}

/** One chronological list for the day view: events by startsAt, tasks by
 *  scheduledTime, undated tasks last. mode filters task rows ('none' = events
 *  only, used by the review screen where the daily list already shows tasks). */
export function dayTimeline(events: CalendarEvent[], tasks: Task[], mode: TaskRowsMode = 'all'): DayEntry[] {
  const entries: DayEntry[] = events.map((event) => ({ kind: 'event', event }));
  if (mode !== 'none') {
    for (const task of tasks) {
      if (mode === 'timed' && !task.scheduledTime) continue;
      entries.push({ kind: 'task', task });
    }
  }
  return entries.sort((a, b) => {
    const ta = entryTime(a);
    const tb = entryTime(b);
    if (!ta) return tb ? 1 : 0;
    if (!tb) return -1;
    return ta.localeCompare(tb);
  });
}

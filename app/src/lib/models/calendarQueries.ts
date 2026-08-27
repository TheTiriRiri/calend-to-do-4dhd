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

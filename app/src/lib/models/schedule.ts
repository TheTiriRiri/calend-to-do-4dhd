import type { Task } from './types';
import { addDays, startOfDay, toISODate } from './dates';

export function schedule(t: Task, day: Date, time?: string): void {
  t.scheduledDate = toISODate(day);
  if (time) t.scheduledTime = time;
  else delete t.scheduledTime;
}

export function moveToNextDay(t: Task, from: Date = new Date()): void {
  t.scheduledDate = toISODate(addDays(startOfDay(from), 1));
}

export function unschedule(t: Task): void {
  delete t.scheduledDate;
  delete t.scheduledTime;
}

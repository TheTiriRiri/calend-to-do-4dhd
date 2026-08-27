import type { Priority, Task } from './types';
import { sameDay, todayStart } from './dates';

export const priorityRank: Record<Priority, number> = { a: 0, b: 1, c: 2 };

export function isActive(t: Task, now: Date = new Date()): boolean {
  if (t.dateCompleted) return false;
  if (!t.scheduledDate) return false;
  return new Date(`${t.scheduledDate}T00:00:00`) <= todayStart(now);
}

export function isDoneToday(t: Task, now: Date = new Date()): boolean {
  return !!t.dateCompleted && sameDay(new Date(t.dateCompleted), now);
}

export function sortedForDailyList(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (x, y) => priorityRank[x.priority] - priorityRank[y.priority] || x.sortOrder - y.sortOrder,
  );
}

export function activeTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return sortedForDailyList(tasks.filter((t) => isActive(t, now)));
}

export function doneTodayTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => isDoneToday(t, now));
}

export function isContainer(t: Task, all: Task[]): boolean {
  return all.some((c) => c.parentId === t.id);
}

export function childrenOf(parent: Task, all: Task[]): Task[] {
  return all.filter((t) => t.parentId === parent.id);
}

export function actionableMasterTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isContainer(t, tasks) && !t.dateCompleted);
}

import type { Priority, Task } from './types';
import { sameDay, toISODate, todayStart } from './dates';

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
  const containers = containerIdSet(tasks);
  // defensive: a container must never reach the daily list, even if scheduled
  return sortedForDailyList(tasks.filter((t) => isActive(t, now) && !containers.has(t.id)));
}

export function doneTodayTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => isDoneToday(t, now));
}

function containerIdSet(tasks: Task[]): Set<string> {
  const ids = new Set<string>();
  for (const t of tasks) if (t.parentId) ids.add(t.parentId);
  return ids;
}

export function isContainer(t: Task, all: Task[]): boolean {
  return all.some((c) => c.parentId === t.id);
}

export function childrenOf(parent: Task, all: Task[]): Task[] {
  return all.filter((t) => t.parentId === parent.id);
}

/** Master-list sections: containers at the root of the breakdown tree (spec §4 allows nesting). */
export function topLevelContainers(tasks: Task[]): Task[] {
  const containers = containerIdSet(tasks);
  return tasks.filter((t) => containers.has(t.id) && !t.parentId && !t.dateCompleted);
}

export function actionableMasterTasks(tasks: Task[]): Task[] {
  const containers = containerIdSet(tasks);
  return tasks.filter((t) => !containers.has(t.id) && !t.dateCompleted);
}

/** Completed tasks, newest completion first (history view). */
export function completedHistory(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.dateCompleted)
    .sort((a, b) => (b.dateCompleted ?? '').localeCompare(a.dateCompleted ?? ''));
}

/** Scheduled before today (shown with the "earlier days" badge on the daily list). */
export function isEarlierThanToday(t: Task, now: Date = new Date()): boolean {
  return !!t.scheduledDate && t.scheduledDate < toISODate(todayStart(now));
}

/** Problem-form wizard gating: step 1 needs a problem, step 2 needs ≥1 solution. */
export function canAdvanceWizardStep(step: number, problem: string, solutionCount: number): boolean {
  if (step === 1) return problem.trim().length > 0;
  if (step === 2) return solutionCount > 0;
  return true;
}

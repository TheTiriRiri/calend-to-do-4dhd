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

/** Product heuristic, not protocol: the material defines A as "today or tomorrow"
 *  and sets no count. Deliberately a source constant — a Settings knob here is the
 *  "perfect system trap". */
export const A_COMFORT_LIMIT = 3;

/** True once more than A_COMFORT_LIMIT A tasks sit on today's list — a nudge to move
 *  some to tomorrow, never a hard limit and never a blocking rule.
 *  Takes activeTasks() output: the caller already holds that list. */
export function hasTooManyA(active: readonly Task[]): boolean {
  return active.filter((t) => t.priority === 'a').length > A_COMFORT_LIMIT;
}

export function doneTodayTasks(tasks: Task[], now: Date = new Date()): Task[] {
  const containers = containerIdSet(tasks);
  // a container's completion is derived from its steps and needs no undo of its
  // own (C-1) — showing it here would let undo re-open it with every step still done
  return tasks.filter((t) => isDoneToday(t, now) && !containers.has(t.id));
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
  return sortedForDailyList(all.filter((t) => t.parentId === parent.id));
}

/** Master-list sections: containers at the root of the breakdown tree (spec §4 allows nesting). */
export function topLevelContainers(tasks: Task[]): Task[] {
  const containers = containerIdSet(tasks);
  return tasks.filter((t) => containers.has(t.id) && !t.parentId && !t.dateCompleted);
}

/** Steps (and grandchildren, ...) of any depth under root, in render order —
 *  depth-first so a step's own children follow it immediately. The master list
 *  shows this flattened at one indent level under the container header rather
 *  than mirroring the breakdown depth (v1 simplicity).
 *
 *  Completed steps stay in the list (handoff 2a) and render in a done state: the
 *  section is the record of a breakdown, and a project with three of four steps
 *  ticked off should look like progress, not like it was never started. A
 *  container all of whose steps are done auto-completes and drops out of the
 *  master list entirely, so no section is ever all-done. */
export function containerDescendants(root: Task, all: Task[]): Task[] {
  return childrenOf(root, all).flatMap((child) => [child, ...containerDescendants(child, all)]);
}

export interface HistoryDay {
  day: string; // local yyyy-mm-dd
  tasks: Task[];
}

/** History grouped into an axis of days (handoff 2f), newest day first and
 *  newest completion first inside a day. */
export function completedByDay(tasks: Task[]): HistoryDay[] {
  const days = new Map<string, Task[]>();
  for (const task of completedHistory(tasks)) {
    const day = toISODate(new Date(task.dateCompleted as string));
    const bucket = days.get(day);
    if (bucket) bucket.push(task);
    else days.set(day, [task]);
  }
  return [...days].map(([day, dayTasks]) => ({ day, tasks: dayTasks }));
}

export interface MasterListSection {
  container: Task;
  steps: Task[];
}

/** Master-list partition (I-1 fix): every open task appears exactly once, either
 *  as a step under its container's section or as a loose top-level task. */
export function masterListSections(tasks: Task[]): { sections: MasterListSection[]; loose: Task[] } {
  const containers = containerIdSet(tasks);
  const sections = topLevelContainers(tasks).map((container) => ({
    container,
    steps: containerDescendants(container, tasks),
  }));
  const loose = sortedForDailyList(
    tasks.filter((t) => !containers.has(t.id) && !t.parentId && !t.dateCompleted),
  );
  return { sections, loose };
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

import type { Task } from './types';

/** Marks the task done; walks up the parentId chain auto-completing containers
 *  whose last step just finished (spec §4, nested breakdown included).
 *  Returns every mutated task so callers can db.tasks.bulkPut(changed). */
export function completeWithParent(task: Task, all: Task[], now: Date = new Date()): Task[] {
  task.dateCompleted = now.toISOString();
  const changed = [task];
  let current: Task = task;
  while (current.parentId) {
    const parent = all.find((t) => t.id === current.parentId);
    if (!parent) break;
    const siblings = all.filter((t) => t.parentId === parent.id);
    if (!siblings.every((s) => s.dateCompleted)) break;
    parent.dateCompleted = now.toISOString();
    changed.push(parent);
    current = parent;
  }
  return changed;
}

/** Undoes a completion (mis-tap). Re-opens every completed ancestor container —
 *  a container with an unfinished step is not done. */
export function uncompleteWithParent(task: Task, all: Task[]): Task[] {
  delete task.dateCompleted;
  const changed = [task];
  let current: Task = task;
  while (current.parentId) {
    const parent = all.find((t) => t.id === current.parentId);
    if (!parent) break;
    if (parent.dateCompleted) {
      delete parent.dateCompleted;
      changed.push(parent);
    }
    current = parent;
  }
  return changed;
}

/** After a step is DELETED, its ancestor chain may have only completed children
 *  left (nothing else re-checks on delete). Walks up exactly like
 *  completeWithParent, completing every container whose remaining children are
 *  all done. Zero remaining children → parent stays open (untouched). Returns
 *  every mutated task. */
export function completeParentIfDone(parentId: string, all: Task[], now: Date = new Date()): Task[] {
  const changed: Task[] = [];
  let currentId: string | undefined = parentId;
  while (currentId) {
    const parent: Task | undefined = all.find((t) => t.id === currentId);
    if (!parent || parent.dateCompleted) break;
    const children = all.filter((t) => t.parentId === parent.id);
    if (children.length === 0 || !children.every((c) => c.dateCompleted)) break;
    parent.dateCompleted = now.toISOString();
    changed.push(parent);
    currentId = parent.parentId;
  }
  return changed;
}

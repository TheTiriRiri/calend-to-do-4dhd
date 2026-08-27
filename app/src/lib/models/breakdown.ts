import type { Task } from './types';

export function makeSteps(parent: Task, titles: string[], now: Date = new Date(), startOrder = 0): Task[] {
  return titles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((title, i) => ({
      id: crypto.randomUUID(),
      title,
      priority: parent.priority,
      dateAdded: now.toISOString(),
      sortOrder: startOrder + i, // offset by existing step count when adding to a container
      parentId: parent.id,
    }));
}

/** Container rules (spec §4): a container never carries a date; adding a step to
 *  an auto-completed container re-opens it. */
export function applyContainerRules(parent: Task): void {
  delete parent.scheduledDate;
  delete parent.scheduledTime;
  delete parent.dateCompleted;
}

/** Ids of the container plus all (nested) descendants — for the delete confirm
 *  dialog that names the step count. */
export function cascadeDeleteIds(root: Task, all: Task[]): string[] {
  const ids = [root.id];
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = all.filter((t) => t.parentId && frontier.includes(t.parentId)).map((t) => t.id);
    ids.push(...children);
    frontier = children;
  }
  return ids;
}

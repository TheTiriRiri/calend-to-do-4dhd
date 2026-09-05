export type Priority = 'a' | 'b' | 'c';

export interface Task {
  id: string;
  title: string;
  priority: Priority;        // required at creation (one-tap, spec §5)
  categoryId?: string;
  dateAdded: string;         // ISO datetime, set on creation
  dateCompleted?: string;    // ISO datetime; set = completed, task stays in DB
  scheduledDate?: string;    // local ISO date yyyy-mm-dd; absent = master list only
  scheduledTime?: string;    // HH:mm, optional
  parentId?: string;         // set = step of a broken-down task
  sortOrder: number;         // order within priority section
}

export interface Category {
  id: string;
  name: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;          // ISO datetime, required
  endsAt?: string;
  note?: string;
}

export interface ProblemForm {
  id: string;
  problem: string;
  createdAt: string;
  chosenSolutionId?: string;
}

export interface Solution {
  id: string;
  formId: string;
  text: string;
  pros: string[];
  cons: string[];
  rating: number;            // 1-10
}

/** Date.now() alone collides for tasks created inside the same millisecond - two
 *  quick-adds in a row, or a wizard that spawns a task right after its parent -
 *  and equal sortOrders fall back to table order, which is not insertion order.
 *  The counter breaks the tie so the sequence is strictly increasing. It is
 *  per-session state; a later session restarts from a larger Date.now() anyway. */
let lastSortOrder = 0;

function nextSortOrder(): number {
  lastSortOrder = Math.max(Date.now(), lastSortOrder + 1);
  return lastSortOrder;
}

export function newTask(title: string, priority: Priority): Task {
  return {
    id: crypto.randomUUID(),
    title,
    priority,
    dateAdded: new Date().toISOString(),
    sortOrder: nextSortOrder(), // strictly increasing -> insertion order within a section
  };
}

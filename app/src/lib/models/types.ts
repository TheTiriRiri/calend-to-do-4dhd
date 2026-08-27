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

export function newTask(title: string, priority: Priority): Task {
  return {
    id: crypto.randomUUID(),
    title,
    priority,
    dateAdded: new Date().toISOString(),
    sortOrder: 0,
  };
}

import type { CalendarEvent, Category, ProblemForm, Solution, Task } from './types';

// Compat policy: v1 hard-throws on any unknown/mismatched schema — no silent migration.
export const SCHEMA_VERSION = 1;

export interface BackupTables {
  tasks: Task[];
  categories: Category[];
  events: CalendarEvent[];
  problemForms: ProblemForm[];
  solutions: Solution[];
}

export interface Backup extends BackupTables {
  schema: number;
  exportedAt: string;
}

export function serialize(tables: BackupTables, now: Date = new Date()): string {
  return JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: now.toISOString(), ...tables }, null, 2);
}

export function deserialize(json: string): Backup {
  const data = JSON.parse(json) as Backup;
  if (data.schema !== SCHEMA_VERSION) {
    throw new Error(`unsupported backup schema: ${data.schema}`);
  }
  validateTables(data);
  return data;
}

// present-but-wrong-type rows crash views later (eventsOn/completedHistory sort
// by these strings) — an absent optional field is fine, a wrong-typed one is not
function isOptionalString(v: unknown): boolean {
  return v === undefined || typeof v === 'string';
}

function validateTables(data: Backup): void {
  for (const key of ['tasks', 'categories', 'events', 'problemForms', 'solutions'] as const) {
    if (!Array.isArray(data[key])) {
      throw new Error(`backup table "${key}" is missing or not an array`);
    }
  }
  for (const task of data.tasks) {
    if (
      typeof task?.id !== 'string' ||
      typeof task.title !== 'string' ||
      !['a', 'b', 'c'].includes(task.priority) ||
      typeof task.dateAdded !== 'string' ||
      typeof task.sortOrder !== 'number' ||
      !isOptionalString(task.dateCompleted) ||
      !isOptionalString(task.scheduledDate) ||
      !isOptionalString(task.scheduledTime) ||
      !isOptionalString(task.parentId) ||
      !isOptionalString(task.categoryId)
    ) {
      throw new Error('backup contains an invalid task row');
    }
  }
  for (const category of data.categories) {
    if (typeof category?.id !== 'string' || typeof category.name !== 'string') {
      throw new Error('backup contains an invalid category row');
    }
  }
  for (const form of data.problemForms) {
    if (
      typeof form?.id !== 'string' ||
      typeof form.problem !== 'string' ||
      typeof form.createdAt !== 'string' ||
      !isOptionalString(form.chosenSolutionId)
    ) {
      throw new Error('backup contains an invalid problem form row');
    }
  }
  for (const solution of data.solutions) {
    if (
      typeof solution?.id !== 'string' ||
      typeof solution.formId !== 'string' ||
      typeof solution.text !== 'string' ||
      // the wizard renders these with {#each} — a non-array throws mid-render
      !Array.isArray(solution.pros) ||
      !Array.isArray(solution.cons) ||
      typeof solution.rating !== 'number'
    ) {
      throw new Error('backup contains an invalid solution row');
    }
  }
  for (const event of data.events) {
    if (
      typeof event?.id !== 'string' ||
      typeof event.title !== 'string' ||
      typeof event.startsAt !== 'string' ||
      !isOptionalString(event.endsAt) ||
      !isOptionalString(event.note)
    ) {
      throw new Error('backup contains an invalid event row');
    }
  }
}

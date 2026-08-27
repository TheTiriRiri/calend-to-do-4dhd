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
      task.dateAdded == null
    ) {
      throw new Error('backup contains an invalid task row');
    }
  }
  for (const event of data.events) {
    if (typeof event?.id !== 'string' || typeof event.title !== 'string' || event.startsAt == null) {
      throw new Error('backup contains an invalid event row');
    }
  }
}

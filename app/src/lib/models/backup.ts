import type { CalendarEvent, Category, ProblemForm, Solution, Task } from './types';

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
  return data;
}

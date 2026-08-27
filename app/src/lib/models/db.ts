import Dexie, { type Table } from 'dexie';
import type { CalendarEvent, Category, ProblemForm, Solution, Task } from './types';

export class AppDB extends Dexie {
  tasks!: Table<Task, string>;
  categories!: Table<Category, string>;
  events!: Table<CalendarEvent, string>;
  problemForms!: Table<ProblemForm, string>;
  solutions!: Table<Solution, string>;

  constructor() {
    super('calendtodo');
    this.version(1).stores({
      tasks: 'id, scheduledDate, dateCompleted, parentId',
      categories: 'id',
      events: 'id, startsAt',
      problemForms: 'id',
      solutions: 'id, formId',
    });
  }
}

export const db = new AppDB();

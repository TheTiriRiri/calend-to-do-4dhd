import { describe, it, expect } from 'vitest';
import { newTask } from '../../src/lib/models/types';
import { deserialize, serialize, SCHEMA_VERSION } from '../../src/lib/models/backup';

describe('backup round-trip', () => {
  it('serialize then deserialize returns the same rows', () => {
    const tables = {
      tasks: [newTask('x', 'a')],
      categories: [{ id: 'c1', name: 'dom' }],
      events: [],
      problemForms: [],
      solutions: [],
    };
    const restored = deserialize(serialize(tables, new Date('2026-08-27T10:00:00')));
    expect(restored.schema).toBe(SCHEMA_VERSION);
    expect(restored.tasks).toEqual(tables.tasks);
    expect(restored.categories).toEqual(tables.categories);
  });

  it('round-trips every optional field (I-12: a fixture with only required fields would miss a drop)', () => {
    const step = newTask('krok', 'b');
    step.parentId = 'container-1';
    step.scheduledDate = '2026-08-27';
    step.scheduledTime = '09:30';
    step.dateCompleted = '2026-08-27T09:00:00.000Z';
    step.categoryId = 'c1';
    const tables = {
      tasks: [step],
      categories: [{ id: 'c1', name: 'dom' }],
      events: [{ id: 'e1', title: 'wizyta', startsAt: '2026-08-27T10:00:00.000Z', endsAt: '2026-08-27T11:00:00.000Z', note: 'notatka' }],
      problemForms: [{ id: 'f1', problem: 'problem', createdAt: '2026-08-27T08:00:00.000Z', chosenSolutionId: 's1' }],
      solutions: [{ id: 's1', formId: 'f1', text: 'rozwiązanie', pros: ['+'], cons: ['-'], rating: 8 }],
    };
    const restored = deserialize(serialize(tables, new Date('2026-08-27T10:00:00')));
    expect(restored.tasks).toEqual(tables.tasks);
    expect(restored.events).toEqual(tables.events);
    expect(restored.problemForms).toEqual(tables.problemForms);
    expect(restored.solutions).toEqual(tables.solutions);
  });

  it('rejects a foreign schema version', () => {
    expect(() => deserialize('{"schema":999}')).toThrow();
  });

  it('rejects malformed JSON', () => {
    expect(() => deserialize('{not json')).toThrow();
  });

  it('rejects a backup with a missing table', () => {
    const tables = { tasks: [], categories: [], events: [], problemForms: [] };
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', ...tables });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a task with a bad priority', () => {
    const tables = {
      tasks: [{ id: 't1', title: 'x', priority: 'z', dateAdded: '2026-08-27T10:00:00' }],
      categories: [],
      events: [],
      problemForms: [],
      solutions: [],
    };
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', ...tables });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a task with a wrong-typed scheduledDate (M-4)', () => {
    const tasks = [{ id: 't1', title: 'x', priority: 'a', dateAdded: '2026-08-27T10:00:00', sortOrder: 0, scheduledDate: 1790000000000 }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks, categories: [], events: [], problemForms: [], solutions: [] });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a task with a wrong-typed sortOrder (M-4)', () => {
    const tasks = [{ id: 't1', title: 'x', priority: 'a', dateAdded: '2026-08-27T10:00:00', sortOrder: '0' }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks, categories: [], events: [], problemForms: [], solutions: [] });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects an event with a wrong-typed startsAt (M-4)', () => {
    const events = [{ id: 'e1', title: 'x', startsAt: 1790000000000 }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks: [], categories: [], events, problemForms: [], solutions: [] });
    expect(() => deserialize(json)).toThrow();
  });

  // tasks and events were validated from the start; the other three tables went
  // straight into the DB unchecked, so a junk row survived the import and only
  // blew up later, in a view (M-4 applied to the remaining tables)
  it('rejects a category with a missing name', () => {
    const categories = [{ id: 'c1' }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks: [], categories, events: [], problemForms: [], solutions: [] });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a problem form with a wrong-typed createdAt', () => {
    const problemForms = [{ id: 'f1', problem: 'x', createdAt: 1790000000000 }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks: [], categories: [], events: [], problemForms, solutions: [] });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a solution whose pros is not an array', () => {
    const solutions = [{ id: 's1', formId: 'f1', text: 'x', pros: 'plusy', cons: [], rating: 5 }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks: [], categories: [], events: [], problemForms: [], solutions });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a solution with a non-numeric rating', () => {
    const solutions = [{ id: 's1', formId: 'f1', text: 'x', pros: [], cons: [], rating: '9' }];
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', tasks: [], categories: [], events: [], problemForms: [], solutions });
    expect(() => deserialize(json)).toThrow();
  });

  it('rejects a task missing a title', () => {
    const tables = {
      tasks: [{ id: 't1', priority: 'a', dateAdded: '2026-08-27T10:00:00' }],
      categories: [],
      events: [],
      problemForms: [],
      solutions: [],
    };
    const json = JSON.stringify({ schema: SCHEMA_VERSION, exportedAt: '', ...tables });
    expect(() => deserialize(json)).toThrow();
  });
});

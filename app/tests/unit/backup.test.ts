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

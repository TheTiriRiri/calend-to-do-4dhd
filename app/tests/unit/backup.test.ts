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

  it('rejects a foreign schema version', () => {
    expect(() => deserialize('{"schema":999}')).toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { newTask } from '../../src/lib/models/types';
import { applyContainerRules, cascadeDeleteIds, makeSteps } from '../../src/lib/models/breakdown';

const now = new Date();

describe('makeSteps', () => {
  it('creates child tasks with parent priority, trims, drops empties', () => {
    const parent = newTask('projekt', 'a');
    const steps = makeSteps(parent, [' krok 1 ', '', 'krok 2'], now);
    expect(steps).toHaveLength(2);
    expect(steps[0].title).toBe('krok 1');
    expect(steps.every((s) => s.parentId === parent.id && s.priority === 'a')).toBe(true);
    expect(steps.map((s) => s.sortOrder)).toEqual([0, 1]);
  });
});

describe('applyContainerRules (spec §4 edge cases)', () => {
  it('clears scheduled date/time and re-opens a completed container', () => {
    const parent = newTask('projekt', 'b');
    parent.scheduledDate = '2026-08-20';
    parent.scheduledTime = '10:00';
    parent.dateCompleted = now.toISOString();
    applyContainerRules(parent);
    expect(parent.scheduledDate).toBeUndefined();
    expect(parent.scheduledTime).toBeUndefined();
    expect(parent.dateCompleted).toBeUndefined();
  });
});

describe('cascadeDeleteIds', () => {
  it('collects container and nested descendants', () => {
    const root = newTask('root', 'b');
    const child = newTask('child', 'b'); child.parentId = root.id;
    const grandchild = newTask('gc', 'b'); grandchild.parentId = child.id;
    const unrelated = newTask('other', 'b');
    const ids = cascadeDeleteIds(root, [root, child, grandchild, unrelated]);
    expect(ids.sort()).toEqual([root.id, child.id, grandchild.id].sort());
  });
});

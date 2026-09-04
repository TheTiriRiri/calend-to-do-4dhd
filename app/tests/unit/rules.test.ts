import { describe, it, expect } from 'vitest';
import { newTask } from '../../src/lib/models/types';
import { isCollapsed } from '../../src/lib/models/collapse';
import { completeWithParent, completeParentIfDone, uncompleteWithParent } from '../../src/lib/models/completion';
import { moveToNextDay, schedule, unschedule } from '../../src/lib/models/schedule';
import { addDays, startOfDay, toISODate } from '../../src/lib/models/dates';

const now = new Date();

describe('isCollapsed (hard rule: A before B before C)', () => {
  it('A never collapses', () => {
    expect(isCollapsed('a', new Set(['a']), new Set())).toBe(false);
  });
  it('B collapses while A has active tasks, expands when A empty', () => {
    expect(isCollapsed('b', new Set(['a', 'b']), new Set())).toBe(true);
    expect(isCollapsed('b', new Set(['b']), new Set())).toBe(false);
  });
  it('C collapses while A or B has active tasks', () => {
    expect(isCollapsed('c', new Set(['a', 'c']), new Set())).toBe(true);
    expect(isCollapsed('c', new Set(['b', 'c']), new Set())).toBe(true);
    expect(isCollapsed('c', new Set(['c']), new Set())).toBe(false);
  });
  it('manual expand overrides', () => {
    expect(isCollapsed('c', new Set(['a', 'c']), new Set(['c' as const]))).toBe(false);
  });
});

describe('completeWithParent', () => {
  it('sets dateCompleted and returns the task', () => {
    const t = newTask('x', 'a');
    const changed = completeWithParent(t, [t], now);
    expect(t.dateCompleted).toBe(now.toISOString());
    expect(changed).toEqual([t]);
  });

  it('auto-completes the container when its last step completes', () => {
    const parent = newTask('projekt', 'b');
    const s1 = newTask('k1', 'b'); s1.parentId = parent.id;
    const s2 = newTask('k2', 'b'); s2.parentId = parent.id;
    const all = [parent, s1, s2];
    expect(completeWithParent(s1, all, now)).toEqual([s1]);
    expect(parent.dateCompleted).toBeUndefined();
    const changed = completeWithParent(s2, all, now);
    expect(parent.dateCompleted).toBe(now.toISOString());
    expect(changed).toContain(parent);
  });

  it('walks up nested containers', () => {
    const gp = newTask('gp', 'b');
    const parent = newTask('p', 'b'); parent.parentId = gp.id;
    const step = newTask('s', 'b'); step.parentId = parent.id;
    const all = [gp, parent, step];
    const changed = completeWithParent(step, all, now);
    expect(parent.dateCompleted).toBe(now.toISOString());
    expect(gp.dateCompleted).toBe(now.toISOString());
    expect(changed).toHaveLength(3);
  });
});

describe('uncompleteWithParent (mis-tap undo)', () => {
  it('clears completion and re-opens completed ancestors', () => {
    const parent = newTask('p', 'b');
    const step = newTask('s', 'b'); step.parentId = parent.id;
    const all = [parent, step];
    completeWithParent(step, all, now);
    expect(parent.dateCompleted).toBeDefined();
    const changed = uncompleteWithParent(step, all);
    expect(step.dateCompleted).toBeUndefined();
    expect(parent.dateCompleted).toBeUndefined();
    expect(changed).toContain(parent);
  });

  it('leaves an incomplete parent alone', () => {
    const parent = newTask('p', 'b');
    const s1 = newTask('s1', 'b'); s1.parentId = parent.id;
    const s2 = newTask('s2', 'b'); s2.parentId = parent.id;
    const all = [parent, s1, s2];
    completeWithParent(s1, all, now); // parent NOT auto-completed (s2 open)
    const changed = uncompleteWithParent(s1, all);
    expect(s1.dateCompleted).toBeUndefined();
    expect(changed).toEqual([s1]);
  });
});

describe('completeParentIfDone (container re-check after step deletion)', () => {
  it('completes a container whose remaining children are all done', () => {
    const parent = newTask('p', 'b');
    const done = newTask('d', 'b'); done.parentId = parent.id; done.dateCompleted = now.toISOString();
    expect(completeParentIfDone(parent.id, [parent, done], now)).toEqual([parent]);
    expect(parent.dateCompleted).toBe(now.toISOString());
  });

  it('leaves a container with open or zero children alone', () => {
    const parent = newTask('p', 'b');
    const open = newTask('o', 'b'); open.parentId = parent.id;
    expect(completeParentIfDone(parent.id, [parent, open], now)).toEqual([]);
    expect(completeParentIfDone(parent.id, [parent], now)).toEqual([]);
  });

  it('walks up two levels (I-3): grandparent completes when its last grandchild is deleted', () => {
    // projekt -> etap -> [krok1 done, krok2 open]; delete krok2, re-check from etap
    const projekt = newTask('projekt', 'b');
    const etap = newTask('etap', 'b'); etap.parentId = projekt.id;
    const krok1 = newTask('krok1', 'b'); krok1.parentId = etap.id; krok1.dateCompleted = now.toISOString();
    const all = [projekt, etap, krok1]; // krok2 already deleted from the array
    const changed = completeParentIfDone(etap.id, all, now);
    expect(etap.dateCompleted).toBe(now.toISOString());
    expect(projekt.dateCompleted).toBe(now.toISOString());
    expect(changed).toEqual([etap, projekt]);
  });
});

describe('schedule actions', () => {
  it('schedule normalizes to a local day and optional time', () => {
    const t = newTask('x', 'b');
    schedule(t, now, '09:30');
    expect(t.scheduledDate).toBe(toISODate(now));
    expect(t.scheduledTime).toBe('09:30');
  });

  it('moveToNextDay sets tomorrow', () => {
    const t = newTask('x', 'a');
    schedule(t, now);
    moveToNextDay(t, now);
    expect(t.scheduledDate).toBe(toISODate(addDays(startOfDay(now), 1)));
  });

  it('unschedule returns the task to master-only', () => {
    const t = newTask('x', 'c');
    schedule(t, now, '10:00');
    unschedule(t);
    expect(t.scheduledDate).toBeUndefined();
    expect(t.scheduledTime).toBeUndefined();
  });
});

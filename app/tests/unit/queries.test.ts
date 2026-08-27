import { describe, it, expect } from 'vitest';
import { newTask, type Task } from '../../src/lib/models/types';
import { addDays, startOfDay, toISODate } from '../../src/lib/models/dates';
import {
  activeTasks,
  actionableMasterTasks,
  canAdvanceWizardStep,
  childrenOf,
  completedHistory,
  doneTodayTasks,
  isContainer,
  isEarlierThanToday,
  sortedForDailyList,
  topLevelContainers,
} from '../../src/lib/models/queries';

const now = new Date();

function scheduled(daysAgo: number, completedDaysAgo?: number): Task {
  const t = newTask('t', 'b');
  t.scheduledDate = toISODate(addDays(startOfDay(now), -daysAgo));
  if (completedDaysAgo !== undefined) {
    t.dateCompleted = addDays(now, -completedDaysAgo).toISOString();
  }
  return t;
}

describe('activeTasks', () => {
  it('includes task scheduled today', () => {
    const t = scheduled(0);
    expect(activeTasks([t], now)).toEqual([t]);
  });

  it('rolls overdue tasks into today (rollover is a query, not a mutation)', () => {
    const t = scheduled(3);
    expect(activeTasks([t], now)).toEqual([t]);
    expect(t.scheduledDate).toBe(toISODate(addDays(startOfDay(now), -3))); // unchanged
  });

  it('excludes unscheduled (master-only), future, and completed tasks', () => {
    expect(activeTasks([newTask('x', 'a')], now)).toEqual([]);
    expect(activeTasks([scheduled(-1)], now)).toEqual([]);
    expect(activeTasks([scheduled(2, 1)], now)).toEqual([]);
  });
});

describe('doneTodayTasks', () => {
  it('includes tasks completed today, excludes yesterday', () => {
    expect(doneTodayTasks([scheduled(5, 0)], now)).toHaveLength(1);
    expect(doneTodayTasks([scheduled(5, 1)], now)).toEqual([]);
  });
});

describe('sortedForDailyList', () => {
  it('orders by priority a<b<c, then sortOrder', () => {
    const c = newTask('c', 'c');
    const a2 = newTask('a2', 'a'); a2.sortOrder = 1;
    const a1 = newTask('a1', 'a'); a1.sortOrder = 0;
    const b = newTask('b', 'b');
    expect(sortedForDailyList([c, a2, a1, b]).map((t) => t.title)).toEqual(['a1', 'a2', 'b', 'c']);
  });
});

describe('containers', () => {
  it('excludes containers from the actionable master list; steps stay', () => {
    const parent = newTask('projekt', 'b');
    const step = newTask('krok', 'b');
    step.parentId = parent.id;
    const plain = newTask('zwykłe', 'a');
    const all = [parent, step, plain];
    expect(isContainer(parent, all)).toBe(true);
    expect(isContainer(step, all)).toBe(false);
    expect(actionableMasterTasks(all).map((t) => t.title)).toEqual(['krok', 'zwykłe']);
    expect(childrenOf(parent, all)).toEqual([step]);
  });

  it('excludes completed tasks from actionable master list', () => {
    const t = newTask('x', 'a');
    t.dateCompleted = now.toISOString();
    expect(actionableMasterTasks([t])).toEqual([]);
  });
});


describe('topLevelContainers', () => {
  it('nested breakdown (projekt → etap → krok) yields only the root as a section', () => {
    const projekt = newTask('projekt', 'b');
    const etap = newTask('etap', 'b');
    etap.parentId = projekt.id;
    const krok = newTask('krok', 'b');
    krok.parentId = etap.id;
    const all = [projekt, etap, krok];
    expect(topLevelContainers(all).map((t) => t.title)).toEqual(['projekt']);
  });

  it('excludes completed containers and non-containers', () => {
    const done = newTask('gotowy', 'b');
    const child = newTask('dziecko', 'b');
    child.parentId = done.id;
    done.dateCompleted = now.toISOString();
    const plain = newTask('zwykłe', 'a');
    expect(topLevelContainers([done, child, plain])).toEqual([]);
  });
});

describe('activeTasks containers', () => {
  it('excludes containers even when scheduled', () => {
    const parent = scheduled(0);
    parent.title = 'kontener';
    const step = scheduled(0);
    step.parentId = parent.id;
    expect(activeTasks([parent, step], now).map((t) => t.id)).toEqual([step.id]);
  });
});

describe('completedHistory', () => {
  it('returns completed tasks, newest completion first', () => {
    const older = scheduled(5, 3);
    older.title = 'starsze';
    const newer = scheduled(5, 1);
    newer.title = 'nowsze';
    const open = newTask('otwarte', 'a');
    expect(completedHistory([older, open, newer]).map((t) => t.title)).toEqual([
      'nowsze',
      'starsze',
    ]);
  });
});

describe('isEarlierThanToday', () => {
  it('true for past scheduledDate, false for today/future/unscheduled', () => {
    expect(isEarlierThanToday(scheduled(2), now)).toBe(true);
    expect(isEarlierThanToday(scheduled(0), now)).toBe(false);
    expect(isEarlierThanToday(scheduled(-1), now)).toBe(false);
    expect(isEarlierThanToday(newTask('x', 'a'), now)).toBe(false);
  });
});

describe('canAdvanceWizardStep', () => {
  it('step 1 requires a non-blank problem, step 2 requires a solution, others always pass', () => {
    expect(canAdvanceWizardStep(1, '', 0)).toBe(false);
    expect(canAdvanceWizardStep(1, '  ', 0)).toBe(false);
    expect(canAdvanceWizardStep(1, 'problem', 0)).toBe(true);
    expect(canAdvanceWizardStep(2, 'problem', 0)).toBe(false);
    expect(canAdvanceWizardStep(2, 'problem', 1)).toBe(true);
    expect(canAdvanceWizardStep(3, '', 0)).toBe(true);
    expect(canAdvanceWizardStep(4, '', 0)).toBe(true);
  });
});

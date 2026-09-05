import { describe, it, expect } from 'vitest';
import { newTask, type Task } from '../../src/lib/models/types';
import { addDays, startOfDay, toISODate } from '../../src/lib/models/dates';
import {
  activeTasks,
  canAdvanceWizardStep,
  childrenOf,
  completedByDay,
  completedHistory,
  containerDescendants,
  doneTodayTasks,
  hasTooManyA,
  isContainer,
  isEarlierThanToday,
  masterListSections,
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

describe('hasTooManyA', () => {
  const withPriority = (priority: Task['priority']) => newTask('t', priority);

  it('3 A tasks is not too many', () => {
    expect(hasTooManyA([withPriority('a'), withPriority('a'), withPriority('a')])).toBe(false);
  });

  it('a 4th A task tips it over', () => {
    const a = [withPriority('a'), withPriority('a'), withPriority('a'), withPriority('a')];
    expect(hasTooManyA(a)).toBe(true);
  });

  it('B and C tasks never count, however many there are', () => {
    const bc = [withPriority('b'), withPriority('b'), withPriority('b'), withPriority('b'), withPriority('c')];
    expect(hasTooManyA(bc)).toBe(false);
  });

  // locks the contract: the caller feeds activeTasks() output, so a future-dated
  // or completed A task must not push 3 active A tasks over the limit
  it('over activeTasks(), a future or completed A task does not tip 3 active A over', () => {
    const activeA = [0, 1, 2].map(() => scheduledA(0));
    const tomorrowA = scheduledA(-1);
    const doneA = scheduledA(0);
    doneA.dateCompleted = now.toISOString();
    expect(hasTooManyA(activeTasks([...activeA, tomorrowA, doneA], now))).toBe(false);
  });

  // the only executable proof of decision D-1: rolled-over A tasks count
  it('over activeTasks(), 3 rolled-over A tasks plus 1 added today is too many', () => {
    const rolledOver = [2, 3, 4].map((d) => scheduledA(d));
    expect(hasTooManyA(activeTasks([...rolledOver, scheduledA(0)], now))).toBe(true);
  });

  function scheduledA(daysAgo: number): Task {
    const t = newTask('t', 'a');
    t.scheduledDate = toISODate(addDays(startOfDay(now), -daysAgo));
    return t;
  }
});

describe('doneTodayTasks', () => {
  it('includes tasks completed today, excludes yesterday', () => {
    expect(doneTodayTasks([scheduled(5, 0)], now)).toHaveLength(1);
    expect(doneTodayTasks([scheduled(5, 1)], now)).toEqual([]);
  });

  it('excludes an auto-completed container even though it is done today (C-1)', () => {
    const parent = scheduled(5, 0);
    parent.title = 'kontener';
    const step = scheduled(5, 0);
    step.parentId = parent.id;
    expect(doneTodayTasks([parent, step], now).map((t) => t.id)).toEqual([step.id]);
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
  it('identifies containers vs steps; childrenOf returns the direct children', () => {
    const parent = newTask('projekt', 'b');
    const step = newTask('krok', 'b');
    step.parentId = parent.id;
    const plain = newTask('zwykłe', 'a');
    const all = [parent, step, plain];
    expect(isContainer(parent, all)).toBe(true);
    expect(isContainer(step, all)).toBe(false);
    expect(childrenOf(parent, all)).toEqual([step]);
  });

  it('childrenOf returns steps in insertion (sortOrder) order, not table order (I-2)', () => {
    const parent = newTask('projekt', 'b');
    const s2 = newTask('krok2', 'b'); s2.parentId = parent.id; s2.sortOrder = 2;
    const s1 = newTask('krok1', 'b'); s1.parentId = parent.id; s1.sortOrder = 1;
    const all = [parent, s2, s1];
    expect(childrenOf(parent, all).map((t) => t.title)).toEqual(['krok1', 'krok2']);
  });
});

describe('newTask sortOrder (I-2)', () => {
  it('assigns an increasing sortOrder so later insertions sort last', () => {
    const first = newTask('pierwsze', 'a');
    const second = newTask('drugie', 'a');
    expect(second.sortOrder).toBeGreaterThanOrEqual(first.sortOrder);
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

describe('containerDescendants', () => {
  // handoff 2a: a finished step keeps its row in the container and shows a done
  // state — the section is the record of the breakdown, so hiding what is done
  // would make a half-finished project look untouched
  it('flattens nested steps depth-first, completed ones included, in insertion order', () => {
    const projekt = newTask('projekt', 'b');
    const etap = newTask('etap', 'b'); etap.parentId = projekt.id; etap.sortOrder = 0;
    const krok = newTask('krok', 'b'); krok.parentId = etap.id;
    const inny = newTask('inny etap', 'b'); inny.parentId = projekt.id; inny.sortOrder = 1;
    const done = newTask('zrobiony', 'b'); done.parentId = projekt.id; done.sortOrder = 2;
    done.dateCompleted = now.toISOString();
    const all = [projekt, etap, krok, inny, done];
    expect(containerDescendants(projekt, all).map((t) => t.title)).toEqual(['etap', 'krok', 'inny etap', 'zrobiony']);
  });

  it('keeps the children of a completed step visible under it', () => {
    const projekt = newTask('projekt', 'b');
    const etap = newTask('etap', 'b'); etap.parentId = projekt.id; etap.dateCompleted = now.toISOString();
    const krok = newTask('krok', 'b'); krok.parentId = etap.id; krok.dateCompleted = now.toISOString();
    expect(containerDescendants(projekt, [projekt, etap, krok]).map((t) => t.title)).toEqual(['etap', 'krok']);
  });
});

describe('completedByDay (handoff 2f: history is an axis of days)', () => {
  it('groups by local completion day, newest day first', () => {
    const a = newTask('wcześniej dziś', 'a'); a.dateCompleted = '2026-09-05T08:00:00.000Z';
    const b = newTask('później dziś', 'a'); b.dateCompleted = '2026-09-05T15:00:00.000Z';
    const c = newTask('wczoraj', 'b'); c.dateCompleted = '2026-09-04T12:00:00.000Z';
    const open = newTask('otwarte', 'c');
    const days = completedByDay([a, c, open, b]);
    expect(days.map((d) => d.day)).toEqual(['2026-09-05', '2026-09-04']);
    // newest completion first inside a day, matching completedHistory
    expect(days[0].tasks.map((t) => t.title)).toEqual(['później dziś', 'wcześniej dziś']);
    expect(days[1].tasks.map((t) => t.title)).toEqual(['wczoraj']);
  });

  it('returns nothing when nothing was completed', () => {
    expect(completedByDay([newTask('otwarte', 'a')])).toEqual([]);
  });
});

describe('masterListSections (I-1: every open task appears exactly once)', () => {
  it('nested steps render under the top-level container, not as loose rows', () => {
    const projekt = newTask('projekt', 'b');
    const etap = newTask('etap', 'b'); etap.parentId = projekt.id;
    const krok = newTask('krok', 'b'); krok.parentId = etap.id;
    const luzne = newTask('luźne', 'a');
    const all = [projekt, etap, krok, luzne];
    const { sections, loose } = masterListSections(all);
    expect(sections).toHaveLength(1);
    expect(sections[0].container.title).toBe('projekt');
    expect(sections[0].steps.map((t) => t.title)).toEqual(['etap', 'krok']);
    expect(loose.map((t) => t.title)).toEqual(['luźne']);
  });

  it('excludes completed containers/steps and completed loose tasks', () => {
    const doneContainer = newTask('gotowy', 'b');
    const doneChild = newTask('dziecko', 'b'); doneChild.parentId = doneContainer.id;
    doneContainer.dateCompleted = now.toISOString();
    const doneLoose = newTask('zrobione', 'a'); doneLoose.dateCompleted = now.toISOString();
    const { sections, loose } = masterListSections([doneContainer, doneChild, doneLoose]);
    expect(sections).toEqual([]);
    expect(loose).toEqual([]);
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

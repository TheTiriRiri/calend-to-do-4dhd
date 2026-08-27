# ADHD Calendar + Task List PWA — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

v2: external review v1 applied (H1 history view, H2 hosting before real data, H3 solution→task spawn, M1 container reachability, M2 undo completion, M3 week view, M4 reorder cut recorded, M5 category UI, M6 master sort, M7 import confirm, M8 Svelte syntax, M9 e2e extended, S1–S10).

**Goal:** Build the v1 app from `specs/2026-08-27-adhd-calendar-tasklist-ios-design.md` (v3, PWA): calendar + two-level task list with enforced A/B/C order, automatic rollover, OS-level daily review reminder, five-step problem form, task breakdown, history view, JSON backup.

**Architecture:** Local-first installable PWA. Vite + Svelte 5 + TypeScript static SPA, Dexie (IndexedDB) persistence with `liveQuery` driving views, hash router, vite-plugin-pwa service worker. All domain rules live in pure functions under `src/lib/models/` — unit-tested with Vitest without a database; Dexie writes are thin wrappers covered by Playwright e2e.

**Tech Stack:** Node 24 / npm 11 (this Ubuntu host), Vite, Svelte 5 (runes), TypeScript strict, Dexie, vite-plugin-pwa, Vitest, Playwright (webkit).

## Global Constraints

- Dev machine: this Ubuntu host (`/home/kkopec/projects/calend-to-do-4dhd`). All commands run here unless marked **[iPhone]**.
- Runtime dependency: `dexie` only. Dev deps: vite, svelte, @sveltejs/vite-plugin-svelte, typescript, vitest, vite-plugin-pwa, @playwright/test, wrangler (Task 19 only).
- App code lives in `app/` (subdirectory of this repo). Polish UI copy only in `app/src/lib/design/strings.ts`; code, comments, filenames in English.
- No backend, no accounts, no analytics, no runtime network calls.
- "Today" = local calendar day (midnight boundary). `scheduledDate` stored as local ISO date `yyyy-mm-dd` via `toISODate()` — never `Date.toISOString()` for day values (UTC shift bug). Parse day inputs noon-anchored (`new Date(`${d}T12:00:00`)`).
- Completed tasks are never auto-deleted; they are visible in the done-today strip and the history view.
- **Recorded cuts (conscious, v1):** drag-to-reorder within sections (within-section order = insertion order; priority change via editor), non-blocking error banner for failed Dexie writes (bare `await`s; failure mode near-nonexistent locally), read-view listing past problem forms (forms are saved; only the chosen solution spawns action), clearing an assigned category (overwrite only). Mirrored in spec §9.
- App display name: **Plan Dnia**. Routes (hash): `#/` review, `#/lista` master, `#/kalendarz` calendar, `#/historia` history, `#/ustawienia` settings. Wizards and editors are modals, not routes.
- Commit after every task. Conventional English messages (`feat:`, `test:`, `chore:`).
- Working directory for all npm commands below: `app/`.

---

### Task 0: Repository baseline commit

**Files:** none created; stages existing repo files.

- [ ] **Step 1: Verify `docs/` stays untracked, then commit the baseline**

```bash
cd /home/kkopec/projects/calend-to-do-4dhd
git status --short          # must NOT list anything under docs/
git add CLAUDE.md .gitignore specs plans
git commit -m "chore: baseline — spec, plan, project conventions"
```

(Requires the user's go-ahead for git mutations — confirm before running.)

---

### Task 1: Vite + Svelte + TS scaffold

**Files:**
- Create: whole `app/` via template, then modify below
- Modify: `app/package.json` (scripts)
- Create: `app/vite.config.ts`
- Test: `app/tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: buildable app, `npm run test:unit` harness. All later tasks assume this layout.

- [ ] **Step 1: Scaffold and install**

```bash
cd /home/kkopec/projects/calend-to-do-4dhd
npm create vite@latest app -- --template svelte-ts
cd app
npm install
npm install dexie
npm install -D vitest vite-plugin-pwa @playwright/test
```

- [ ] **Step 2: Remove template demo files**

```bash
rm -f src/lib/Counter.svelte src/assets/svelte.svg src/app.css
```

- [ ] **Step 3: Replace `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
```

- [ ] **Step 4: Add scripts to `package.json`** (merge into existing `scripts`)

```json
"test:unit": "vitest run",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Write the harness smoke test**

`tests/unit/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run test to verify harness works**

Run: `npm run test:unit`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "chore: scaffold Vite + Svelte 5 + TS app with vitest"
```

---

### Task 2: Types, date utils, list queries

**Files:**
- Create: `app/src/lib/models/types.ts`
- Create: `app/src/lib/models/dates.ts`
- Create: `app/src/lib/models/queries.ts`
- Test: `app/tests/unit/queries.test.ts`

**Interfaces:**
- Produces: `Priority`, `Task`, `Category`, `CalendarEvent`, `ProblemForm`, `Solution`, `newTask(title, priority)`; date helpers `startOfDay/todayStart/addDays/sameDay/toISODate`; query fns `isActive/isDoneToday/sortedForDailyList/activeTasks/doneTodayTasks/isContainer/actionableMasterTasks/childrenOf`. Used by every later task.

- [ ] **Step 1: Write the failing tests**

`tests/unit/queries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newTask, type Task } from '../../src/lib/models/types';
import { addDays, startOfDay, toISODate } from '../../src/lib/models/dates';
import {
  activeTasks,
  actionableMasterTasks,
  childrenOf,
  doneTodayTasks,
  isContainer,
  sortedForDailyList,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — module not found `../../src/lib/models/types`.

- [ ] **Step 3: Implement `types.ts`**

```ts
export type Priority = 'a' | 'b' | 'c';

export interface Task {
  id: string;
  title: string;
  priority: Priority;        // required at creation (one-tap, spec §5)
  categoryId?: string;
  dateAdded: string;         // ISO datetime, set on creation
  dateCompleted?: string;    // ISO datetime; set = completed, task stays in DB
  scheduledDate?: string;    // local ISO date yyyy-mm-dd; absent = master list only
  scheduledTime?: string;    // HH:mm, optional
  parentId?: string;         // set = step of a broken-down task
  sortOrder: number;         // order within priority section
}

export interface Category {
  id: string;
  name: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;          // ISO datetime, required
  endsAt?: string;
  note?: string;
}

export interface ProblemForm {
  id: string;
  problem: string;
  createdAt: string;
  chosenSolutionId?: string;
}

export interface Solution {
  id: string;
  formId: string;
  text: string;
  pros: string[];
  cons: string[];
  rating: number;            // 1-10
}

export function newTask(title: string, priority: Priority): Task {
  return {
    id: crypto.randomUUID(),
    title,
    priority,
    dateAdded: new Date().toISOString(),
    sortOrder: 0,
  };
}
```

- [ ] **Step 4: Implement `dates.ts`**

```ts
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function todayStart(now: Date = new Date()): Date {
  return startOfDay(now);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local (not UTC) yyyy-mm-dd. Never use Date.toISOString() for day values. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
```

- [ ] **Step 5: Implement `queries.ts`**

```ts
import type { Priority, Task } from './types';
import { sameDay, todayStart } from './dates';

export const priorityRank: Record<Priority, number> = { a: 0, b: 1, c: 2 };

export function isActive(t: Task, now: Date = new Date()): boolean {
  if (t.dateCompleted) return false;
  if (!t.scheduledDate) return false;
  return new Date(`${t.scheduledDate}T00:00:00`) <= todayStart(now);
}

export function isDoneToday(t: Task, now: Date = new Date()): boolean {
  return !!t.dateCompleted && sameDay(new Date(t.dateCompleted), now);
}

export function sortedForDailyList(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (x, y) => priorityRank[x.priority] - priorityRank[y.priority] || x.sortOrder - y.sortOrder,
  );
}

export function activeTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return sortedForDailyList(tasks.filter((t) => isActive(t, now)));
}

export function doneTodayTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => isDoneToday(t, now));
}

export function isContainer(t: Task, all: Task[]): boolean {
  return all.some((c) => c.parentId === t.id);
}

export function childrenOf(parent: Task, all: Task[]): Task[] {
  return all.filter((t) => t.parentId === parent.id);
}

export function actionableMasterTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isContainer(t, tasks) && !t.dateCompleted);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS (8 tests total incl. smoke)

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/models app/tests/unit/queries.test.ts
git commit -m "feat: task types, date utils, daily-list queries with automatic rollover"
```

---

### Task 3: Collapse rule, completion (recursive + undo), scheduling

**Files:**
- Create: `app/src/lib/models/collapse.ts`
- Create: `app/src/lib/models/completion.ts`
- Create: `app/src/lib/models/schedule.ts`
- Test: `app/tests/unit/rules.test.ts`

**Interfaces:**
- Consumes: Task 2 types/dates.
- Produces: `isCollapsed(section, nonEmpty, manuallyExpanded)`; `completeWithParent(task, all, now?) -> Task[]` and `uncompleteWithParent(task, all) -> Task[]` (both return mutated tasks for `db.tasks.bulkPut`); `schedule(t, day, time?)`, `moveToNextDay(t, from?)`, `unschedule(t)`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newTask } from '../../src/lib/models/types';
import { isCollapsed } from '../../src/lib/models/collapse';
import { completeWithParent, uncompleteWithParent } from '../../src/lib/models/completion';
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `collapse.ts`**

```ts
import type { Priority } from './types';

/** Hard rule (spec §6): lower sections collapse while a higher section has active
 *  tasks. nonEmpty contains priorities that have ACTIVE tasks only (done-today
 *  items never affect collapsing). A deliberate tap overrides. */
export function isCollapsed(
  section: Priority,
  nonEmpty: ReadonlySet<Priority>,
  manuallyExpanded: ReadonlySet<Priority>,
): boolean {
  if (manuallyExpanded.has(section)) return false;
  if (section === 'a') return false;
  if (section === 'b') return nonEmpty.has('a');
  return nonEmpty.has('a') || nonEmpty.has('b');
}
```

- [ ] **Step 4: Implement `completion.ts`**

```ts
import type { Task } from './types';

/** Marks the task done; walks up the parentId chain auto-completing containers
 *  whose last step just finished (spec §4, nested breakdown included).
 *  Returns every mutated task so callers can db.tasks.bulkPut(changed). */
export function completeWithParent(task: Task, all: Task[], now: Date = new Date()): Task[] {
  task.dateCompleted = now.toISOString();
  const changed = [task];
  let current: Task = task;
  while (current.parentId) {
    const parent = all.find((t) => t.id === current.parentId);
    if (!parent) break;
    const siblings = all.filter((t) => t.parentId === parent.id);
    if (!siblings.every((s) => s.dateCompleted)) break;
    parent.dateCompleted = now.toISOString();
    changed.push(parent);
    current = parent;
  }
  return changed;
}

/** Undoes a completion (mis-tap). Re-opens every completed ancestor container —
 *  a container with an unfinished step is not done. */
export function uncompleteWithParent(task: Task, all: Task[]): Task[] {
  delete task.dateCompleted;
  const changed = [task];
  let current: Task = task;
  while (current.parentId) {
    const parent = all.find((t) => t.id === current.parentId);
    if (!parent) break;
    if (parent.dateCompleted) {
      delete parent.dateCompleted;
      changed.push(parent);
    }
    current = parent;
  }
  return changed;
}
```

- [ ] **Step 5: Implement `schedule.ts`**

```ts
import type { Task } from './types';
import { addDays, startOfDay, toISODate } from './dates';

export function schedule(t: Task, day: Date, time?: string): void {
  t.scheduledDate = toISODate(day);
  if (time) t.scheduledTime = time;
  else delete t.scheduledTime;
}

export function moveToNextDay(t: Task, from: Date = new Date()): void {
  t.scheduledDate = toISODate(addDays(startOfDay(from), 1));
}

export function unschedule(t: Task): void {
  delete t.scheduledDate;
  delete t.scheduledTime;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS (19 tests total)

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/models app/tests/unit/rules.test.ts
git commit -m "feat: A/B/C collapse, recursive container complete/un-complete, schedule actions"
```

---

### Task 4: Calendar day-view queries (past-day rule)

**Files:**
- Create: `app/src/lib/models/calendarQueries.ts`
- Test: `app/tests/unit/calendarQueries.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `eventsOn(events, day) -> CalendarEvent[]`, `tasksScheduledOn(tasks, day, now?) -> Task[]` implementing spec §5's precise rule. Used by Task 12.

- [ ] **Step 1: Write the failing tests**

`tests/unit/calendarQueries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newTask, type CalendarEvent } from '../../src/lib/models/types';
import { eventsOn, tasksScheduledOn } from '../../src/lib/models/calendarQueries';
import { addDays, startOfDay, toISODate } from '../../src/lib/models/dates';

const now = new Date();
const today = startOfDay(now);

function taskOn(day: Date, completed = false) {
  const t = newTask('t', 'a');
  t.scheduledDate = toISODate(day);
  if (completed) t.dateCompleted = now.toISOString();
  return t;
}

describe('tasksScheduledOn (spec §5 past-day rule)', () => {
  it('shows incomplete tasks on today and future days', () => {
    expect(tasksScheduledOn([taskOn(today)], today, now)).toHaveLength(1);
    expect(tasksScheduledOn([taskOn(addDays(today, 2))], addDays(today, 2), now)).toHaveLength(1);
  });

  it('hides incomplete tasks when browsing a PAST day (they live on the daily list)', () => {
    const past = addDays(today, -3);
    expect(tasksScheduledOn([taskOn(past)], past, now)).toEqual([]);
  });

  it('keeps completed tasks visible on their past day (proof of work)', () => {
    const past = addDays(today, -3);
    expect(tasksScheduledOn([taskOn(past, true)], past, now)).toHaveLength(1);
  });
});

describe('eventsOn', () => {
  it('returns only that day, sorted by start', () => {
    const e1: CalendarEvent = { id: '1', title: 'b', startsAt: addDays(now, 0).toISOString() };
    const e2: CalendarEvent = { id: '2', title: 'a', startsAt: addDays(now, 1).toISOString() };
    expect(eventsOn([e1, e2], now).map((e) => e.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `calendarQueries.ts`**

```ts
import type { CalendarEvent, Task } from './types';
import { sameDay, startOfDay, todayStart, toISODate } from './dates';

export function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => sameDay(new Date(e.startsAt), day))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Day view for day D (spec §5): tasks with scheduledDate == D, EXCEPT incomplete
 *  ones when D < today — overdue tasks exist only on the daily list. Completed
 *  tasks stay visible on their day. */
export function tasksScheduledOn(tasks: Task[], day: Date, now: Date = new Date()): Task[] {
  const d = toISODate(day);
  const isPast = startOfDay(day) < todayStart(now);
  return tasks.filter((t) => t.scheduledDate === d && (!!t.dateCompleted || !isPast));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS (23 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/models/calendarQueries.ts app/tests/unit/calendarQueries.test.ts
git commit -m "feat: calendar day-view queries with past-day rule"
```

---

### Task 5: Five-step problem solver logic

**Files:**
- Create: `app/src/lib/models/problemSolver.ts`
- Test: `app/tests/unit/problemSolver.test.ts`

**Interfaces:**
- Produces: `bestSolution(solutions) -> Solution | undefined`, `nextBest(after, solutions) -> Solution | undefined`. Used by Task 13.

- [ ] **Step 1: Write the failing tests**

`tests/unit/problemSolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Solution } from '../../src/lib/models/types';
import { bestSolution, nextBest } from '../../src/lib/models/problemSolver';

function sol(text: string, rating: number): Solution {
  return { id: text, formId: 'f', text, pros: [], cons: [], rating };
}

describe('problemSolver', () => {
  it('best is highest rated', () => {
    expect(bestSolution([sol('low', 3), sol('high', 9)])?.text).toBe('high');
  });

  it('nextBest after rejecting the winner', () => {
    const a = sol('a', 9);
    expect(nextBest(a, [a, sol('b', 7), sol('c', 2)])?.text).toBe('b');
  });

  it('nextBest is undefined when exhausted', () => {
    const a = sol('a', 9);
    expect(nextBest(a, [a])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `problemSolver.ts`**

```ts
import type { Solution } from './types';

export function bestSolution(solutions: Solution[]): Solution | undefined {
  return [...solutions].sort((x, y) => y.rating - x.rating)[0];
}

export function nextBest(after: Solution, solutions: Solution[]): Solution | undefined {
  return bestSolution(solutions.filter((s) => s.id !== after.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS (26 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/models/problemSolver.ts app/tests/unit/problemSolver.test.ts
git commit -m "feat: five-step problem solver selection logic"
```

---

### Task 6: Breakdown helpers and cascade delete

**Files:**
- Create: `app/src/lib/models/breakdown.ts`
- Test: `app/tests/unit/breakdown.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `makeSteps(parent, titles, now?) -> Task[]`, `applyContainerRules(parent): void` (clears date/time, re-opens), `cascadeDeleteIds(root, all) -> string[]`. Used by Tasks 11 and 14.

- [ ] **Step 1: Write the failing tests**

`tests/unit/breakdown.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `breakdown.ts`**

```ts
import type { Task } from './types';

export function makeSteps(parent: Task, titles: string[], now: Date = new Date()): Task[] {
  return titles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((title, i) => ({
      id: crypto.randomUUID(),
      title,
      priority: parent.priority,
      dateAdded: now.toISOString(),
      sortOrder: i,
      parentId: parent.id,
    }));
}

/** Container rules (spec §4): a container never carries a date; adding a step to
 *  an auto-completed container re-opens it. */
export function applyContainerRules(parent: Task): void {
  delete parent.scheduledDate;
  delete parent.scheduledTime;
  delete parent.dateCompleted;
}

/** Ids of the container plus all (nested) descendants — for the delete confirm
 *  dialog that names the step count. */
export function cascadeDeleteIds(root: Task, all: Task[]): string[] {
  const ids = [root.id];
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = all.filter((t) => t.parentId && frontier.includes(t.parentId)).map((t) => t.id);
    ids.push(...children);
    frontier = children;
  }
  return ids;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS (29 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/models/breakdown.ts app/tests/unit/breakdown.test.ts
git commit -m "feat: breakdown step factory, container rules, cascade delete ids"
```

---

### Task 7: Dexie database and JSON backup

**Files:**
- Create: `app/src/lib/models/db.ts`
- Create: `app/src/lib/models/backup.ts`
- Test: `app/tests/unit/backup.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `db` (Dexie instance; tables `tasks, categories, events, problemForms, solutions`); `serialize(tables, now?) -> string`, `deserialize(json) -> Backup`, `SCHEMA_VERSION = 1`. Backup used by Task 15 settings.

- [ ] **Step 1: Write the failing test (round-trip, pure — no IndexedDB needed)**

`tests/unit/backup.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `db.ts`**

```ts
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
```

- [ ] **Step 4: Implement `backup.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS (31 tests total)

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/models/db.ts app/src/lib/models/backup.ts app/tests/unit/backup.test.ts
git commit -m "feat: Dexie schema and versioned JSON backup serialization"
```

---

### Task 8: Polish copy and theme

**Files:**
- Create: `app/src/lib/design/strings.ts`
- Create: `app/src/lib/design/theme.css`

**Interfaces:**
- Produces: `strings` constant used by every component below; `theme.css` imported once in `main.ts` (Task 15). No tests; build check only.

- [ ] **Step 1: Write `strings.ts` (all v1 copy, neutral tone — no blame words)**

```ts
export const strings = {
  common: {
    add: 'Dodaj',
    save: 'Zapisz',
    cancel: 'Anuluj',
    delete: 'Usuń',
    close: 'Zamknij',
    confirmDeletePlain: 'Usunąć zadanie na stałe?',
  },
  tabs: { today: 'Dziś', master: 'Lista główna', calendar: 'Kalendarz', settings: 'Ustawienia' },
  quickAdd: {
    title: 'Nowe zadanie',
    titlePlaceholder: 'Co jest do zrobienia?',
    priorityPrompt: 'Jak pilne?',
    priorityA: 'A — dziś/jutro',
    priorityB: 'B — częściowo pilne',
    priorityC: 'C — może poczekać',
  },
  dailyList: {
    earlierDays: 'z wcześniejszych dni',
    doneToday: 'Zrobione dziś',
    emptyState: 'Pusto? Spokojnie — dodaj zadanie albo przełóż coś z listy głównej.',
    moveToTomorrow: 'Przełóż na jutro',
    sectionA: 'A — najważniejsze',
    sectionB: 'B — mniej pilne',
    sectionC: 'C — na później',
  },
  review: { title: 'Poranny przegląd', problemFormEntry: 'Problem w 5 krokach' },
  calendar: {
    addEvent: 'Dodaj wydarzenie',
    eventTitlePlaceholder: 'Np. wizyta u lekarza',
    emptyDay: 'Nic w kalendarzu. To też jest informacja.',
    start: 'Start',
    end: 'Koniec',
  },
  editor: {
    day: 'Dzień',
    time: 'Godzina',
    breakDown: 'Podziel na kroki',
    category: 'Kategoria',
    categoryPlaceholder: 'np. dom, praca',
  },
  master: {
    oneStepHint: 'Na listę dzienną bierz jeden krok naraz.',
    historyLink: 'Historia',
  },
  breakdown: {
    action: 'Podziel na kroki',
    oneDayTest: 'Dasz radę zrobić ten krok w jeden dzień?',
    splitFurtherHint: 'Jeśli chcesz to odkładać — podziel na mniejsze.',
    stepPlaceholder: 'Krok…',
    dateCleared: 'Zadanie stało się zbiorem kroków — jego data jest wyczyszczona.',
    confirmDelete: (n: number) => `Usunąć zadanie wraz z ${n} krokami?`,
  },
  problemForm: {
    title: 'Problem w 5 krokach',
    step1: 'Opisz problem w 1–2 zdaniach',
    step1Placeholder: 'Np. nie mogę się zdecydować…',
    step2: 'Wypisz wszystkie rozwiązania — bez oceniania',
    step2Placeholder: 'Rozwiązanie…',
    step3: 'Plusy i minusy każdego rozwiązania',
    step4: 'Oceń każde od 1 do 10',
    step5: 'Najlepiej oceniane — wdrażasz?',
    choose: 'Wybieram to',
    pickNext: 'Wolę kolejne najwyżej oceniane',
    addAsTask: 'Dodaj jako zadanie',
    next: 'Dalej',
  },
  history: { title: 'Historia', subtitle: 'Tyle się udało' },
  onboarding: {
    screen1: 'Dwa narzędzia: kalendarz (data i godzina) i lista zadań (bez daty).',
    screen2title: 'O której porze przejrzysz dzień? (np. przy porannej kawie)',
    screen2intro: 'Ustaw JEDNO przypomnienie systemowe:',
    screen2clock: 'Zegar: codzienny budzik o tej porze',
    screen2calendar: 'Kalendarz: codzienne wydarzenie z alertem',
    screen2shortcuts: 'Skróty: automatyzacja „o porze dnia" otwierająca tę aplikację',
    screen3: 'Dodaj pierwsze zadanie.',
    next: 'Dalej',
    start: 'Zaczynam',
  },
  settings: {
    title: 'Ustawienia',
    backupSection: 'Kopia zapasowa',
    backupHint: 'Eksportuj co jakiś czas — to Twoja historia pracy.',
    export: 'Eksportuj kopię (JSON)',
    import: 'Importuj kopię',
    confirmImport: 'Zastąpić wszystkie dane zawartością kopii?',
    imported: 'Wczytano kopię.',
    importError: 'Nie udało się wczytać pliku.',
    reviewTimeLabel: 'Twoja pora przeglądu',
    reminderHint: 'Przypomnienie ustawiasz w systemie: Zegar (budzik), Kalendarz (wydarzenie z alertem) albo Skróty (automatyzacja o porze dnia).',
  },
} as const;
```

- [ ] **Step 2: Write `theme.css`**

```css
:root {
  --muted: #6b7280;
  --accent: #4a6fa5;
  --bg: #ffffff;
  color-scheme: light;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, system-ui, sans-serif;
  background: var(--bg);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

button { font: inherit; min-height: 44px; }
input, textarea { font: inherit; }

.muted { color: var(--muted); }
.section-collapsed { color: var(--muted); }
.container-header { background: none; border: none; padding: 0; text-align: left; }

nav.tabs {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--bg);
  border-top: 1px solid #e5e7eb;
  padding-bottom: env(safe-area-inset-bottom);
}
nav.tabs a { flex: 1; text-align: center; padding: 12px 0; text-decoration: none; color: inherit; }
nav.tabs a.active { color: var(--accent); font-weight: 600; }

main { padding: 16px; padding-bottom: 72px; }
.sheet { padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; margin: 8px 0; }
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: builds (template `App.svelte` may still reference deleted demo files — if so, replace its body with `<main>Plan Dnia</main>` and remove the `app.css` import from `main.ts`; both replaced for real in Task 15)

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/design app/src/App.svelte app/src/main.ts
git commit -m "feat: Polish UI copy and base theme"
```

---

### Task 9: Quick-add and master list components

**Files:**
- Create: `app/src/lib/tasklist/QuickAdd.svelte`
- Create: `app/src/lib/tasklist/MasterList.svelte`

**Interfaces:**
- Consumes: `db` (Task 7), `newTask` (Task 2), `schedule` (Task 3), `actionableMasterTasks/childrenOf/isContainer/sortedForDailyList` (Task 2), `strings` (Task 8).
- Produces: `<QuickAdd onclose={...} defaultToday?={...} />`; `<MasterList onedit={(task, container?) => ...} />` (onedit wired in Task 15).

- [ ] **Step 1: Implement `QuickAdd.svelte`**

```svelte
<script lang="ts">
  import { db } from '../models/db';
  import { newTask, type Priority } from '../models/types';
  import { schedule } from '../models/schedule';
  import { strings } from '../design/strings';

  // defaultToday: opened from the "Dziś" screen — the task lands on today's list
  // instead of vanishing onto the master list.
  let { onclose, defaultToday = false }: { onclose: () => void; defaultToday?: boolean } = $props();
  let title = $state('');

  async function add(priority: Priority) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const task = newTask(trimmed, priority);
    if (defaultToday) schedule(task, new Date());
    await db.tasks.add(task);
    onclose();
  }
</script>

<div class="sheet">
  <h2>{strings.quickAdd.title}</h2>
  <input bind:value={title} placeholder={strings.quickAdd.titlePlaceholder} />
  <p>{strings.quickAdd.priorityPrompt}</p>
  <button onclick={() => add('a')}>{strings.quickAdd.priorityA}</button>
  <button onclick={() => add('b')}>{strings.quickAdd.priorityB}</button>
  <button onclick={() => add('c')}>{strings.quickAdd.priorityC}</button>
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>
```

- [ ] **Step 2: Implement `MasterList.svelte`** (containers tappable → editor with delete/breakdown; actionable list priority-sorted; one-step hint per spec §5)

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Task } from '../models/types';
  import {
    actionableMasterTasks,
    childrenOf,
    isContainer,
    sortedForDailyList,
  } from '../models/queries';
  import { strings } from '../design/strings';
  import QuickAdd from './QuickAdd.svelte';

  let { onedit }: { onedit: (task: Task, container?: boolean) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let adding = $state(false);
</script>

<main>
  <h1>{strings.tabs.master}</h1>
  {#if $tasks}
    {#each $tasks.filter((t) => isContainer(t, $tasks) && !t.dateCompleted) as parent (parent.id)}
      <section class="sheet">
        <button class="container-header" onclick={() => onedit(parent, true)}>
          <h3>{parent.title}</h3>
        </button>
        <p class="muted">{strings.master.oneStepHint}</p>
        <ul>
          {#each childrenOf(parent, $tasks).filter((s) => !s.dateCompleted) as step (step.id)}
            <li><button class="muted" onclick={() => onedit(step)}>{step.title}</button></li>
          {/each}
        </ul>
      </section>
    {/each}
    <ul>
      {#each sortedForDailyList(actionableMasterTasks($tasks)) as task (task.id)}
        <li>
          <button onclick={() => onedit(task)}>
            <strong>{task.priority.toUpperCase()}</strong> {task.title}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <button onclick={() => (adding = true)}>{strings.common.add}</button>
  <a href="#/historia" class="muted">{strings.master.historyLink}</a>
  {#if adding}<QuickAdd onclose={() => (adding = false)} />{/if}
</main>
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: BUILD SUCCEEDED (components not yet routed — fine)

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/tasklist
git commit -m "feat: quick-add with one-tap priority, master list with tappable containers"
```

---

### Task 10: Daily list component (sections, collapse, done strip with undo)

**Files:**
- Create: `app/src/lib/tasklist/DailyList.svelte`

**Interfaces:**
- Consumes: `activeTasks/doneTodayTasks` (Task 2), `isCollapsed` (Task 3), `completeWithParent/uncompleteWithParent` (Task 3), `moveToNextDay` (Task 3), `strings` (Task 8), `QuickAdd` (Task 9).
- Produces: `<DailyList onedit={(task) => ...} />` — embedded in the review screen (Task 15).

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Priority, Task } from '../models/types';
  import { activeTasks, doneTodayTasks } from '../models/queries';
  import { isCollapsed } from '../models/collapse';
  import { completeWithParent, uncompleteWithParent } from '../models/completion';
  import { moveToNextDay } from '../models/schedule';
  import { todayStart, toISODate } from '../models/dates';
  import { strings } from '../design/strings';
  import QuickAdd from './QuickAdd.svelte';

  let { onedit }: { onedit: (task: Task) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let manuallyExpanded = $state<ReadonlySet<Priority>>(new Set());
  let adding = $state(false);

  const active = $derived(activeTasks($tasks ?? []));
  const doneToday = $derived(doneTodayTasks($tasks ?? []));
  const nonEmpty = $derived(new Set(active.map((t) => t.priority)));

  const sections: { p: Priority; title: string }[] = [
    { p: 'a', title: strings.dailyList.sectionA },
    { p: 'b', title: strings.dailyList.sectionB },
    { p: 'c', title: strings.dailyList.sectionC },
  ];

  function expand(p: Priority) {
    manuallyExpanded = new Set(manuallyExpanded).add(p);
  }
  async function onComplete(task: Task) {
    await db.tasks.bulkPut(completeWithParent(task, $tasks ?? []));
  }
  async function onUncomplete(task: Task) {
    await db.tasks.bulkPut(uncompleteWithParent(task, $tasks ?? []));
  }
  async function onMove(task: Task) {
    moveToNextDay(task);
    await db.tasks.put(task);
  }
  function isEarlier(task: Task): boolean {
    return !!task.scheduledDate && task.scheduledDate < toISODate(todayStart());
  }
</script>

<section>
  {#if active.length === 0 && doneToday.length === 0}
    <p class="muted">{strings.dailyList.emptyState}</p>
  {/if}

  {#each sections as { p, title } (p)}
    {@const list = active.filter((t) => t.priority === p)}
    {#if list.length > 0}
      {#if isCollapsed(p, nonEmpty, manuallyExpanded)}
        <button class="section-collapsed" onclick={() => expand(p)}>{title} ({list.length}) ▸</button>
      {:else}
        <h3>{title}</h3>
        <ul>
          {#each list as task (task.id)}
            <li>
              <button aria-label="done" onclick={() => onComplete(task)}>○</button>
              <button onclick={() => onedit(task)}>{task.title}</button>
              {#if isEarlier(task)}<span class="muted">{strings.dailyList.earlierDays}</span>{/if}
              <button class="muted" onclick={() => onMove(task)}>{strings.dailyList.moveToTomorrow}</button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/each}

  {#if doneToday.length > 0}
    <h3 class="muted">{strings.dailyList.doneToday}</h3>
    <ul class="muted">
      {#each doneToday as task (task.id)}
        <li>
          <button aria-label="undo" onclick={() => onUncomplete(task)}>✓</button> {task.title}
        </li>
      {/each}
    </ul>
  {/if}

  <button onclick={() => (adding = true)}>{strings.common.add}</button>
  {#if adding}<QuickAdd defaultToday onclose={() => (adding = false)} />{/if}
</section>
```

(✓ in the done strip un-completes — mis-taps are reversible, ancestors re-open.
QuickAdd here passes `defaultToday` so a task added from "Dziś" lands on today.)

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/tasklist/DailyList.svelte
git commit -m "feat: daily list with A/B/C collapse, done strip, completion undo"
```

---

### Task 11: Task editor (save-on-commit, priority, category, cascade delete)

**Files:**
- Create: `app/src/lib/tasklist/TaskEditor.svelte`

**Interfaces:**
- Consumes: `schedule/unschedule` (Task 3), `cascadeDeleteIds` (Task 6), `strings` (Task 8).
- Produces: `<TaskEditor task={...} container?={...} onclose={...} onbreakdown={...} />` — modal from lists (wired Task 15). `container=true` hides the day/time inputs (containers never carry dates, spec §4).

- [ ] **Step 1: Implement** (all edits are local state, committed together on Save — no binding into the live object)

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Priority, Task } from '../models/types';
  import { schedule, unschedule } from '../models/schedule';
  import { cascadeDeleteIds } from '../models/breakdown';
  import { strings } from '../design/strings';

  let { task, container = false, onclose, onbreakdown }: {
    task: Task;
    container?: boolean;
    onclose: () => void;
    onbreakdown: (task: Task) => void;
  } = $props();

  const priorities: Priority[] = ['a', 'b', 'c'];
  let title = $state(task.title);
  let priority = $state<Priority>(task.priority);
  let day = $state(task.scheduledDate ?? '');
  let time = $state(task.scheduledTime ?? '');
  let categoryName = $state('');

  const categories = liveQuery(() => db.categories.toArray());

  async function save() {
    task.title = title.trim() || task.title;
    task.priority = priority;
    if (!container) {
      if (day) schedule(task, new Date(`${day}T12:00:00`), time || undefined);
      else unschedule(task);
    }
    const cat = categoryName.trim();
    if (cat) {
      const existing = ($categories ?? []).find((c) => c.name === cat);
      if (existing) {
        task.categoryId = existing.id;
      } else {
        const id = crypto.randomUUID();
        await db.categories.add({ id, name: cat });
        task.categoryId = id;
      }
    }
    await db.tasks.put(task);
    onclose();
  }

  async function remove() {
    const all = await db.tasks.toArray();
    const ids = cascadeDeleteIds(task, all);
    const steps = ids.length - 1;
    const message = steps > 0 ? strings.breakdown.confirmDelete(steps) : strings.common.confirmDeletePlain;
    if (!confirm(message)) return; // every hard delete confirms (spec §4)
    await db.tasks.bulkDelete(ids);
    onclose();
  }
</script>

<div class="sheet">
  <input bind:value={title} placeholder={strings.quickAdd.titlePlaceholder} />
  <p>{strings.quickAdd.priorityPrompt}</p>
  {#each priorities as p}
    <button onclick={() => (priority = p)} disabled={priority === p}>{p.toUpperCase()}</button>
  {/each}
  {#if !container}
    <label>{strings.editor.day} <input type="date" bind:value={day} /></label>
    <label>{strings.editor.time} <input type="time" bind:value={time} /></label>
  {/if}
  <label>
    {strings.editor.category}
    <input bind:value={categoryName} list="category-options" placeholder={strings.editor.categoryPlaceholder} />
    <datalist id="category-options">
      {#each $categories ?? [] as c (c.id)}<option value={c.name}></option>{/each}
    </datalist>
  </label>
  <div>
    <button onclick={save}>{strings.common.save}</button>
    <button class="muted" onclick={() => onbreakdown(task)}>{strings.editor.breakDown}</button>
    <button class="muted" onclick={remove}>{strings.common.delete}</button>
    <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
  </div>
</div>
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/tasklist/TaskEditor.svelte
git commit -m "feat: task editor — save-committed edits, category, confirmed cascade delete"
```

---

### Task 12: Calendar views (week list + day) and event editor

**Files:**
- Create: `app/src/lib/calendar/DayView.svelte`
- Create: `app/src/lib/calendar/WeekView.svelte`
- Create: `app/src/lib/calendar/CalendarView.svelte`
- Create: `app/src/lib/calendar/EventEditor.svelte`

**Interfaces:**
- Consumes: `eventsOn/tasksScheduledOn` (Task 4), `strings` (Task 8).
- Produces: `<DayView day={Date} />` (also used on the review screen, Task 15), `<CalendarView />` tab (week list per spec §5).

- [ ] **Step 1: Implement `DayView.svelte`**

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import { eventsOn, tasksScheduledOn } from '../models/calendarQueries';
  import { strings } from '../design/strings';

  let { day }: { day: Date } = $props();
  const events = liveQuery(() => db.events.toArray());
  const tasks = liveQuery(() => db.tasks.toArray());

  const dayEvents = $derived(eventsOn($events ?? [], day));
  const dayTasks = $derived(tasksScheduledOn($tasks ?? [], day));
</script>

{#if dayEvents.length === 0 && dayTasks.length === 0}
  <p class="muted">{strings.calendar.emptyDay}</p>
{/if}
<ul>
  {#each dayEvents as event (event.id)}
    <li>
      {new Date(event.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
      {event.title}
    </li>
  {/each}
  {#each dayTasks as task (task.id)}
    <li>{#if task.scheduledTime}{task.scheduledTime} {/if}{task.title}</li>
  {/each}
</ul>
```

- [ ] **Step 2: Implement `WeekView.svelte`** (spec §5 week list: 7 day sections from today)

```svelte
<script lang="ts">
  import { addDays, todayStart } from '../models/dates';
  import DayView from './DayView.svelte';

  const days = Array.from({ length: 7 }, (_, i) => addDays(todayStart(), i));
  const fmt = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

{#each days as day (day.toISOString())}
  <section class="sheet">
    <h3>{fmt.format(day)}</h3>
    <DayView {day} />
  </section>
{/each}
```

- [ ] **Step 3: Implement `CalendarView.svelte`**

```svelte
<script lang="ts">
  import { strings } from '../design/strings';
  import WeekView from './WeekView.svelte';
  import EventEditor from './EventEditor.svelte';

  let addingEvent = $state(false);
</script>

<main>
  <h1>{strings.tabs.calendar}</h1>
  <button onclick={() => (addingEvent = true)}>{strings.calendar.addEvent}</button>
  {#if addingEvent}<EventEditor onclose={() => (addingEvent = false)} />{/if}
  <WeekView />
</main>
```

- [ ] **Step 4: Implement `EventEditor.svelte`** (end-before-start rejected)

```svelte
<script lang="ts">
  import { db } from '../models/db';
  import { strings } from '../design/strings';
  import { toISODate } from '../models/dates';

  let { onclose }: { onclose: () => void } = $props();
  let title = $state('');
  let day = $state(toISODate(new Date()));
  let time = $state('12:00');
  let hasEnd = $state(false);
  let endTime = $state('13:00');

  const invalid = $derived(!title.trim() || (hasEnd && endTime <= time));

  async function save() {
    if (invalid) return;
    await db.events.add({
      id: crypto.randomUUID(),
      title: title.trim(),
      startsAt: new Date(`${day}T${time}:00`).toISOString(),
      endsAt: hasEnd ? new Date(`${day}T${endTime}:00`).toISOString() : undefined,
    });
    onclose();
  }
</script>

<div class="sheet">
  <input bind:value={title} placeholder={strings.calendar.eventTitlePlaceholder} />
  <label>{strings.editor.day} <input type="date" bind:value={day} /></label>
  <label>{strings.calendar.start} <input type="time" bind:value={time} /></label>
  <label><input type="checkbox" bind:checked={hasEnd} /> {strings.calendar.end}</label>
  {#if hasEnd}<input type="time" bind:value={endTime} />{/if}
  <button onclick={save} disabled={invalid}>{strings.common.save}</button>
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: BUILD SUCCEEDED

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/calendar
git commit -m "feat: calendar week list, day view, event editor with end validation"
```

---

### Task 13: Problem-form wizard (+ per-solution pros/cons editor, spawn task)

**Files:**
- Create: `app/src/lib/strategies/ProsConsEditor.svelte`
- Create: `app/src/lib/strategies/ProblemFormWizard.svelte`

**Interfaces:**
- Consumes: `bestSolution/nextBest` (Task 5), `newTask` (Task 2), `db` (Task 7), `strings.problemForm` (Task 8).
- Produces: `<ProblemFormWizard onclose={...} />` — modal from review screen (Task 15). After "Wybieram to" the saved screen offers `addAsTask` (spec §5: chosen solution spawns action).

- [ ] **Step 1: Implement `ProsConsEditor.svelte`** (per-solution input state)

```svelte
<script lang="ts">
  import type { Solution } from '../models/types';
  import { strings } from '../design/strings';

  let { solution }: { solution: Solution } = $props();
  let proText = $state('');
  let conText = $state('');

  function addPro() {
    const t = proText.trim();
    if (!t) return;
    solution.pros = [...solution.pros, t];
    proText = '';
  }
  function addCon() {
    const t = conText.trim();
    if (!t) return;
    solution.cons = [...solution.cons, t];
    conText = '';
  }
</script>

<section class="sheet">
  <strong>{solution.text}</strong>
  <ul>{#each solution.pros as pro}<li>+ {pro}</li>{/each}</ul>
  <input bind:value={proText} placeholder="+" /><button onclick={addPro}>{strings.common.add}</button>
  <ul>{#each solution.cons as con}<li>− {con}</li>{/each}</ul>
  <input bind:value={conText} placeholder="−" /><button onclick={addCon}>{strings.common.add}</button>
</section>
```

- [ ] **Step 2: Implement `ProblemFormWizard.svelte`**

```svelte
<script lang="ts">
  import { db } from '../models/db';
  import { newTask, type Solution } from '../models/types';
  import { bestSolution, nextBest } from '../models/problemSolver';
  import { strings } from '../design/strings';
  import ProsConsEditor from './ProsConsEditor.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const s = strings.problemForm;

  let step = $state(1);
  let problem = $state('');
  let solutions = $state<Solution[]>([]);
  let newSolution = $state('');
  let rejected = $state<ReadonlySet<string>>(new Set());
  let saved = $state<Solution | null>(null);

  const candidates = $derived(solutions.filter((x) => !rejected.has(x.id)));
  const best = $derived(bestSolution(candidates));

  function addSolution() {
    const t = newSolution.trim();
    if (!t) return;
    solutions = [...solutions, { id: crypto.randomUUID(), formId: '', text: t, pros: [], cons: [], rating: 5 }];
    newSolution = '';
  }
  function reject(sol: Solution) {
    rejected = new Set(rejected).add(sol.id);
  }
  async function finish(chosen: Solution) {
    const formId = crypto.randomUUID();
    await db.problemForms.add({ id: formId, problem, createdAt: new Date().toISOString(), chosenSolutionId: chosen.id });
    await db.solutions.bulkAdd(solutions.map((x) => ({ ...x, formId })));
    saved = chosen;
  }
  async function addAsTask() {
    if (!saved) return;
    // chosen solution is meant to be implemented today/tomorrow → priority A
    await db.tasks.add(newTask(saved.text, 'a'));
    onclose();
  }
</script>

<div class="sheet">
  <h2>{s.title}{#if !saved} — {step}/5{/if}</h2>

  {#if saved}
    <h3>{saved.text}</h3>
    <button onclick={addAsTask}>{s.addAsTask}</button>
    <button class="muted" onclick={onclose}>{strings.common.close}</button>
  {:else if step === 1}
    <p>{s.step1}</p>
    <textarea bind:value={problem} placeholder={s.step1Placeholder} rows="3"></textarea>
  {:else if step === 2}
    <p>{s.step2}</p>
    <ul>{#each solutions as sol (sol.id)}<li>{sol.text}</li>{/each}</ul>
    <input bind:value={newSolution} placeholder={s.step2Placeholder} />
    <button onclick={addSolution}>{strings.common.add}</button>
  {:else if step === 3}
    <p>{s.step3}</p>
    {#each solutions as sol (sol.id)}
      <ProsConsEditor solution={sol} />
    {/each}
  {:else if step === 4}
    <p>{s.step4}</p>
    {#each solutions as sol (sol.id)}
      <label>{sol.text}: {sol.rating}
        <input type="range" min="1" max="10" bind:value={sol.rating} />
      </label>
    {/each}
  {:else}
    <p>{s.step5}</p>
    {#if best}
      <h3>{best.text} ({best.rating}/10)</h3>
      <button onclick={() => finish(best)}>{s.choose}</button>
      {#if nextBest(best, candidates)}
        <button class="muted" onclick={() => reject(best)}>{s.pickNext}</button>
      {/if}
    {/if}
  {/if}

  {#if !saved}
    <div>
      {#if step < 5}
        <button onclick={() => (step += 1)} disabled={(step === 1 && !problem.trim()) || (step === 2 && solutions.length === 0)}>{s.next}</button>
      {/if}
      <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/strategies
git commit -m "feat: five-step wizard with per-solution pros/cons and solution-to-task spawn"
```

---

### Task 14: Breakdown wizard component

**Files:**
- Create: `app/src/lib/strategies/BreakdownWizard.svelte`

**Interfaces:**
- Consumes: `makeSteps/applyContainerRules` (Task 6), `db` (Task 7), `strings.breakdown` (Task 8).
- Produces: `<BreakdownWizard parent={Task} onclose={...} />` — modal from TaskEditor (wired Task 15).

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { db } from '../models/db';
  import type { Task } from '../models/types';
  import { applyContainerRules, makeSteps } from '../models/breakdown';
  import { strings } from '../design/strings';

  let { parent, onclose }: { parent: Task; onclose: () => void } = $props();
  const s = strings.breakdown;

  let steps = $state<string[]>(['']);
  const hadDate = parent.scheduledDate !== undefined;

  async function save() {
    const made = makeSteps(parent, steps);
    if (made.length === 0) return;
    applyContainerRules(parent); // clears date/time, re-opens completed container
    await db.tasks.put(parent);
    await db.tasks.bulkAdd(made);
    onclose();
  }
</script>

<div class="sheet">
  <h2>{s.action}: {parent.title}</h2>
  {#each steps as _, i (i)}
    <input bind:value={steps[i]} placeholder={s.stepPlaceholder} />
  {/each}
  <button onclick={() => (steps = [...steps, ''])}>{strings.common.add}</button>
  <p>{s.oneDayTest}</p>
  <p class="muted">{s.splitFurtherHint}</p>
  {#if hadDate}<p class="muted">{s.dateCleared}</p>{/if}
  <button onclick={save}>{strings.common.save}</button>
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/strategies/BreakdownWizard.svelte
git commit -m "feat: breakdown wizard with container rules and one-day test prompt"
```

---

### Task 15: App shell — router, tabs, review, onboarding, history, settings

**Files:**
- Modify: `app/src/App.svelte` (replace template)
- Create: `app/src/lib/review/DailyReview.svelte`
- Create: `app/src/lib/review/Onboarding.svelte`
- Create: `app/src/lib/review/History.svelte`
- Create: `app/src/lib/settings/Settings.svelte`
- Modify: `app/src/main.ts` (final form)

**Interfaces:**
- Consumes: everything above. Produces the runnable app. Onboarding sets `localStorage.onboarded = '1'` and `localStorage.reviewTime = 'HH:mm'`; Settings surfaces `reviewTime` and the JSON backup. Route `#/historia` added; `onedit(task, container?)` threaded from MasterList.

- [ ] **Step 1: Implement `DailyReview.svelte`**

```svelte
<script lang="ts">
  import type { Task } from '../models/types';
  import { strings } from '../design/strings';
  import DayView from '../calendar/DayView.svelte';
  import DailyList from '../tasklist/DailyList.svelte';
  import TaskEditor from '../tasklist/TaskEditor.svelte';
  import BreakdownWizard from '../strategies/BreakdownWizard.svelte';
  import ProblemFormWizard from '../strategies/ProblemFormWizard.svelte';

  let editing = $state<Task | null>(null);
  let breaking = $state<Task | null>(null);
  let problemForm = $state(false);
</script>

<main>
  <h1>{strings.review.title}</h1>
  <DayView day={new Date()} />
  <DailyList onedit={(t) => (editing = t)} />
  <button class="muted" onclick={() => (problemForm = true)}>{strings.review.problemFormEntry}</button>

  {#if editing}
    <TaskEditor task={editing} onclose={() => (editing = null)} onbreakdown={(t) => { breaking = t; editing = null; }} />
  {/if}
  {#if breaking}
    <BreakdownWizard parent={breaking} onclose={() => (breaking = null)} />
  {/if}
  {#if problemForm}
    <ProblemFormWizard onclose={() => (problemForm = false)} />
  {/if}
</main>
```

- [ ] **Step 2: Implement `Onboarding.svelte`** (3 screens; screen 2 = OS-level reminder guide, spec §7)

```svelte
<script lang="ts">
  import { strings } from '../design/strings';
  import QuickAdd from '../tasklist/QuickAdd.svelte';

  let { ondone }: { ondone: () => void } = $props();
  const o = strings.onboarding;
  let screen = $state(1);
  let reviewTime = $state('09:00');

  function finish() {
    localStorage.setItem('onboarded', '1');
    localStorage.setItem('reviewTime', reviewTime);
    ondone();
  }
</script>

<main>
  {#if screen === 1}
    <p>{o.screen1}</p>
    <button onclick={() => (screen = 2)}>{o.next}</button>
  {:else if screen === 2}
    <p>{o.screen2title}</p>
    <input type="time" bind:value={reviewTime} />
    <p>{o.screen2intro}</p>
    <ul>
      <li>{o.screen2clock}</li>
      <li>{o.screen2calendar}</li>
      <li>{o.screen2shortcuts}</li>
    </ul>
    <button onclick={() => (screen = 3)}>{o.next}</button>
  {:else}
    <p>{o.screen3}</p>
    <QuickAdd onclose={finish} />
    <button class="muted" onclick={finish}>{o.start}</button>
  {/if}
</main>
```

- [ ] **Step 3: Implement `History.svelte`** (spec §4: completed tasks stay visible; positive framing §8)

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import { strings } from '../design/strings';

  const tasks = liveQuery(() => db.tasks.toArray());
  const done = $derived(
    ($tasks ?? [])
      .filter((t) => t.dateCompleted)
      .sort((a, b) => (b.dateCompleted ?? '').localeCompare(a.dateCompleted ?? '')),
  );
  function dayLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
</script>

<main>
  <h1>{strings.history.title}</h1>
  <p class="muted">{strings.history.subtitle}: {done.length}</p>
  <ul>
    {#each done as task (task.id)}
      <li>✓ {task.title} <span class="muted">{dayLabel(task.dateCompleted ?? '')}</span></li>
    {/each}
  </ul>
</main>
```

- [ ] **Step 4: Implement `Settings.svelte`** (confirmed import, review time + reminder instructions)

```svelte
<script lang="ts">
  import { db } from '../models/db';
  import { deserialize, serialize } from '../models/backup';
  import { strings } from '../design/strings';

  const s = strings.settings;
  const reviewTime = localStorage.getItem('reviewTime') ?? '09:00';
  let message = $state('');

  async function exportJson() {
    const tables = {
      tasks: await db.tasks.toArray(),
      categories: await db.categories.toArray(),
      events: await db.events.toArray(),
      problemForms: await db.problemForms.toArray(),
      solutions: await db.solutions.toArray(),
    };
    const blob = new Blob([serialize(tables)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plan-dnia-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm(s.confirmImport)) return; // import replaces everything — confirm first
    try {
      const data = deserialize(await file.text());
      await db.transaction('rw', [db.tasks, db.categories, db.events, db.problemForms, db.solutions], async () => {
        await Promise.all([db.tasks.clear(), db.categories.clear(), db.events.clear(), db.problemForms.clear(), db.solutions.clear()]);
        await db.tasks.bulkAdd(data.tasks);
        await db.categories.bulkAdd(data.categories);
        await db.events.bulkAdd(data.events);
        await db.problemForms.bulkAdd(data.problemForms);
        await db.solutions.bulkAdd(data.solutions);
      });
      message = s.imported;
    } catch {
      message = s.importError;
    }
  }
</script>

<main>
  <h1>{s.title}</h1>
  <section class="sheet">
    <h2>{s.reviewTimeLabel}: {reviewTime}</h2>
    <p class="muted">{s.reminderHint}</p>
  </section>
  <section class="sheet">
    <h2>{s.backupSection}</h2>
    <p class="muted">{s.backupHint}</p>
    <button onclick={exportJson}>{s.export}</button>
    <label>{s.import} <input type="file" accept="application/json" onchange={importJson} /></label>
    {#if message}<p>{message}</p>{/if}
  </section>
</main>
```

- [ ] **Step 5: Replace `App.svelte` (hash router + tabs + onboarding gate)**

```svelte
<script lang="ts">
  import { strings } from './lib/design/strings';
  import DailyReview from './lib/review/DailyReview.svelte';
  import MasterList from './lib/tasklist/MasterList.svelte';
  import CalendarView from './lib/calendar/CalendarView.svelte';
  import History from './lib/review/History.svelte';
  import Settings from './lib/settings/Settings.svelte';
  import Onboarding from './lib/review/Onboarding.svelte';
  import TaskEditor from './lib/tasklist/TaskEditor.svelte';
  import BreakdownWizard from './lib/strategies/BreakdownWizard.svelte';
  import type { Task } from './lib/models/types';

  let hash = $state(location.hash || '#/');
  window.addEventListener('hashchange', () => (hash = location.hash || '#/'));
  let onboarded = $state(localStorage.getItem('onboarded') === '1');
  let editing = $state<{ task: Task; container: boolean } | null>(null);
  let breaking = $state<Task | null>(null);

  const tabs = [
    { route: '#/', label: strings.tabs.today },
    { route: '#/lista', label: strings.tabs.master },
    { route: '#/kalendarz', label: strings.tabs.calendar },
    { route: '#/ustawienia', label: strings.tabs.settings },
  ];
</script>

{#if !onboarded}
  <Onboarding ondone={() => (onboarded = true)} />
{:else}
  {#if hash === '#/lista'}
    <MasterList onedit={(task, container) => (editing = { task, container: container ?? false })} />
  {:else if hash === '#/kalendarz'}
    <CalendarView />
  {:else if hash === '#/historia'}
    <History />
  {:else if hash === '#/ustawienia'}
    <Settings />
  {:else}
    <DailyReview />
  {/if}

  <nav class="tabs">
    {#each tabs as tab (tab.route)}
      <a href={tab.route} class:active={hash === tab.route}>{tab.label}</a>
    {/each}
  </nav>

  {#if editing}
    <TaskEditor
      task={editing.task}
      container={editing.container}
      onclose={() => (editing = null)}
      onbreakdown={(t) => { breaking = t; editing = null; }}
    />
  {/if}
  {#if breaking}
    <BreakdownWizard parent={breaking} onclose={() => (breaking = null)} />
  {/if}
{/if}
```

- [ ] **Step 6: Final `main.ts`**

```ts
import { mount } from 'svelte';
import App from './App.svelte';
import './lib/design/theme.css';

// Ask the OS to keep site data (no-op on iOS Safari — harmless).
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

const app = mount(App, { target: document.getElementById('app')! });
export default app;
```

- [ ] **Step 7: Build and run all unit tests**

Run: `npm run build && npm run test:unit`
Expected: BUILD SUCCEEDED, all PASS (31 tests)

- [ ] **Step 8: Commit**

```bash
git add app/src
git commit -m "feat: app shell — tabs, review, onboarding, history, settings with backup"
```

---

### Task 16: PWA install (manifest, service worker, icons)

**Files:**
- Modify: `app/vite.config.ts`
- Modify: `app/index.html`
- Create: `app/scripts/make-icons.mjs`
- Create: `app/public/icons/*.png` (generated)

**Interfaces:**
- Produces: installable PWA. Manifest name "Plan Dnia", `display: standalone`.

- [ ] **Step 1: Write the icon generator** (verified on this host — pure Node, no deps)

`app/scripts/make-icons.mjs`:

```js
// Generates solid-color PWA icons with pure Node (zlib) — no dependencies.
// Usage: node scripts/make-icons.mjs [outdir]   (default: public/icons)
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// brand color #4A6FA5
function solidPng(size, r = 0x4a, g = 0x6f, b = 0xa5) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3)]);
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outdir = process.argv[2] ?? 'public/icons';
fs.mkdirSync(outdir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(outdir, name), solidPng(size));
  console.log('wrote', name);
}
```

Run: `node scripts/make-icons.mjs`
Expected: writes 3 files; `file public/icons/icon-512.png` reports "PNG image data, 512 x 512".

- [ ] **Step 2: Update `vite.config.ts` (add PWA plugin)**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Plan Dnia',
        short_name: 'Plan Dnia',
        description: 'Kalendarz i lista zadań',
        lang: 'pl',
        display: 'standalone',
        start_url: '.',
        background_color: '#ffffff',
        theme_color: '#4a6fa5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
```

- [ ] **Step 3: Update `index.html`**

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Plan Dnia" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <title>Plan Dnia</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Build and verify SW + manifest emitted**

Run: `npm run build && ls dist/manifest.webmanifest dist/sw.js dist/icons`
Expected: files exist, BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add app/vite.config.ts app/index.html app/scripts app/public
git commit -m "feat: PWA manifest, service worker, icons"
```

---

### Task 17: Playwright e2e smoke tests

**Files:**
- Create: `app/playwright.config.ts`
- Test: `app/tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: the built app. Playwright gives each test a fresh browser context → fresh IndexedDB; no manual DB reset needed (deleting IndexedDB under an open Dexie connection blocks).

- [ ] **Step 1: Install browser** (webkit ≈ Safari; if system deps fail, switch project to chromium)

Run: `npx playwright install --with-deps webkit`
Expected: installed (may ask for sudo password for system deps; on failure: `npx playwright install chromium` and change the project name below)

- [ ] **Step 2: Write `playwright.config.ts`** (iPhone 14 Pro viewport)

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
  },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
});
```

- [ ] **Step 3: Write `tests/e2e/smoke.spec.ts`** (4 flows: quick-add, wizard end-to-end with task spawn, breakdown, schedule→complete→history)

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

test('quick-add puts a task on the master list', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Wyrzucić śmieci');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await expect(page.getByText('Wyrzucić śmieci')).toBeVisible();
});

test('five-step wizard end-to-end: chosen solution becomes a task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Problem w 5 krokach' }).click();
  await page.getByPlaceholder('Np. nie mogę się zdecydować…').fill('Testowy problem');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByPlaceholder('Rozwiązanie…').fill('Opcja 1');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click(); // step 3 skippable
  await page.getByRole('button', { name: 'Dalej' }).click(); // step 4, default rating
  await page.getByRole('button', { name: 'Dalej' }).click(); // step 5
  await page.getByRole('button', { name: 'Wybieram to' }).click();
  await page.getByRole('button', { name: 'Dodaj jako zadanie' }).click();
  await page.goto('/#/lista');
  await expect(page.getByText('Opcja 1')).toBeVisible();
});

test('breakdown creates a tappable container with steps', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Duży projekt');
  await page.getByRole('button', { name: 'B — częściowo pilne' }).click();
  await page.getByText('Duży projekt').click();
  await page.getByRole('button', { name: 'Podziel na kroki' }).click();
  await page.getByPlaceholder('Krok…').fill('Pierwszy krok');
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('heading', { name: 'Duży projekt' })).toBeVisible();
  await expect(page.getByText('Pierwszy krok')).toBeVisible();
});

test('scheduled task completes and lands in history', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Zadanie na dziś');
  await page.getByRole('button', { name: 'B — częściowo pilne' }).click();
  await page.getByText('Zadanie na dziś').click();
  await page.getByLabel(/Dzień/).fill(new Date().toLocaleDateString('sv-SE'));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await page.goto('/');
  await expect(page.getByText('Zadanie na dziś')).toBeVisible();
  await page.getByRole('button', { name: 'done' }).click();
  await expect(page.getByText('Zrobione dziś')).toBeVisible();
  await page.goto('/#/historia');
  await expect(page.getByText('Zadanie na dziś')).toBeVisible();
});
```

(`toLocaleDateString('sv-SE')` yields local `yyyy-mm-dd` — matches the date input format.)

- [ ] **Step 4: Run e2e**

Run: `npm run test:e2e`
Expected: PASS (4 tests). If a selector mismatches real rendered markup, fix the selector to match the code — do not weaken assertions.

- [ ] **Step 5: Commit**

```bash
git add app/playwright.config.ts app/tests/e2e
git commit -m "test: Playwright e2e — quick-add, wizard, breakdown, complete-to-history"
```

---

### Task 18: On-device smoke test (ephemeral tunnel — NO real data)

**Files:** none.

Purpose: verify install + offline behavior on the iPhone. **`*.trycloudflare.com` origins are random per session and IndexedDB is origin-bound — data entered here is throwaway. Do NOT start real use yet; that begins after Task 19.**

- [ ] **Step 1: Build and serve**

```bash
cd app
npm run build
npm run preview -- --host &
```

- [ ] **Step 2: HTTPS tunnel** (service worker + install require HTTPS)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb
cloudflared tunnel --url http://localhost:4173
```

Note the printed `https://*.trycloudflare.com` URL.

- [ ] **Step 3: [iPhone]** Open the tunnel URL in Safari → share sheet → "Dodaj do ekranu głównej" → launch from icon → walk through onboarding → toggle airplane mode once to confirm the shell loads offline.

- [ ] **Step 4:** Kill the tunnel. Any device-only issues become new tasks.

---

### Task 19: Permanent hosting (Cloudflare Pages) — before any real data

**Files:** none (deploy config only). Prerequisite for real use: a **stable origin**, otherwise IndexedDB (and the 3-month proof-of-work history) is lost between URLs.

- [ ] **Step 1: Install wrangler and deploy**

```bash
cd app
npm run build
npm install -D wrangler
npx wrangler login        # opens browser; free Cloudflare account
npx wrangler pages deploy dist --project-name plan-dnia
```

Expected: deploy prints `https://plan-dnia.pages.dev` (first deploy creates the project).

- [ ] **Step 2: [iPhone]** Open `https://plan-dnia.pages.dev` in Safari → "Dodaj do ekranu głównej" → launch from icon. This is the permanent install; delete the Task 18 icon.

- [ ] **Step 3: [iPhone]** Start real use: onboarding, OS-level reminder (Zegar/Kalendarz/Skróty per spec §7), first tasks.

- [ ] **Step 4: Later updates:** `npm run build && npx wrangler pages deploy dist --project-name plan-dnia` — same origin, service worker auto-updates, data intact.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: wrangler for Pages deploys"
```

---

## Self-review results (v2, after external review)

- **Spec coverage:** §3 queries/rendering → Tasks 2, 10. §4 model + container edges + history → Tasks 2, 3, 6, 11, 14, 15 (`History.svelte`). §5 flows incl. week list and solution→task spawn → Tasks 9–15 (week: 12; spawn: 13). §6 collapse → Tasks 3, 10. §7 OS reminder → Task 15 onboarding + Settings re-display. §8 copy → Task 8. §10 backup → Tasks 7, 15 (with confirm). §11 testing → unit Tasks 2–7 (31 tests), e2e Task 17 (4 flows incl. wizard end-to-end and breakdown). §12 structure → matches. §2 storage honesty → Task 15 `persist()` + backup; H2 origin stability → Task 19 before real data, Task 18 explicitly smoke-only.
- **Recorded cuts (mirrored in spec §9):** drag-to-reorder (within-section order = insertion), error banner, problem-forms read view, category clearing.
- **Placeholder scan:** none — every code step contains complete code. Icon generator pre-verified on this host.
- **Type consistency:** `onedit(task, container?)` threaded MasterList → App → TaskEditor; `completeWithParent/uncompleteWithParent -> Task[]` match `bulkPut` in Task 10; `candidates` (not full list) feeds `nextBest` in Task 13 step 5; routes `#/, #/lista, #/kalendarz, #/historia, #/ustawienia` consistent between Tasks 8 (link), 15 (router), 17 (e2e). Test counts: 1 (T1) +7 (T2) = 8; +11 (T3) = 19; +4 (T4) = 23; +3 (T5) = 26; +3 (T6) = 29; +2 (T7) = 31.

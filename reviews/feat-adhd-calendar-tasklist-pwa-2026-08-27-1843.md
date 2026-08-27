# Code review — `feat/adhd-calendar-tasklist-pwa`

Date: 2026-08-27 18:43
Range: `904dd5a` (repo baseline — spec/plan/conventions only) .. `2500dc5` (HEAD)
Scope: 27 commits, 57 files, ~8800 insertions — the complete v1 of the "Plan Dnia" PWA.

Note: `main` sits at `25943f8`, mid-branch, so most of this work is already on main. The
whole feature range was reviewed regardless — the earlier commits never got a pre-merge review.

**Verdict: merge with fixes.** C1 and C2 block.

---

## Review method

Three passes:

1. **Requirements + domain layer** — spec v3, plan v3, CLAUDE.md, then all 11 files in
   `app/src/lib/models/` in final state, traced against plan Tasks 2–7 and spec §3/§4/§5/§6.
2. **UI** — all 17 `.svelte` files in final state, compared against the plan's inline code
   blocks to locate deviations.
3. **Build/tests/targeted hunts** — verification commands, then three focused audits: every
   Dexie write site vs. `$state.snapshot`, the whole unit suite under four hostile timezones,
   and a scripted reproduction of the nested-container rendering path.

## Verification actually run (from `app/`)

| Command | Result |
|---|---|
| `npm run test:unit` | **34 passed / 7 files**, 218 ms |
| `npm run check` (svelte-check + tsc) | **0 errors, 5 warnings** — all `state_referenced_locally` in TaskEditor/BreakdownWizard, intentional (save-on-commit) |
| `npm run build` | **succeeded** — 164.11 kB JS (55.79 kB gz), SW + manifest + 7 precache entries emitted |
| `npx playwright test` | **4 passed** (4.1 s) — but on **chromium**, not webkit (see I5) |
| `TZ={Pacific/Kiritimati, Pacific/Niue, America/Los_Angeles, Australia/Sydney} vitest run` | **34 passed in each** — no UTC-shift bugs |

---

## Strengths

**The domain layer is the real thing.** `src/lib/models/` is genuinely pure and DB-free — every
rule is a function over plain arrays, and all 34 unit tests assert concrete input→output
behavior with no mocks and no tautologies (the single `1+1` harness test is the deliberate
exception). This is the part that will still be correct in six months.

**Local-day correctness is enforced, not hoped for.** `toISODate()` (`dates.ts:26`) is
local-field-based; `isActive` parses `${scheduledDate}T00:00:00` as local (`queries.ts:9`); day
inputs are noon-anchored (`TaskEditor.svelte:40`); `dateAdded`/`dateCompleted`/`startsAt`
correctly use `toISOString()` because they are datetimes. Stress-tested: the suite is green at
UTC+14, UTC−11, UTC−8 and UTC+10. `EventEditor` round-trips local→UTC→local correctly and is
DST-safe.

**Rollover is a query, not a mutation** (`queries.ts:22`), and `queries.test.ts:33` explicitly
asserts `scheduledDate` is *unchanged* after an overdue task appears on today's list. That is
the friction-free requirement, proven.

**Protocol rule 3 (all A before B before C) is structurally enforced at the point that matters.**
`isCollapsed` (`collapse.ts`) is keyed on *active* tasks only, exactly matching spec §3's
rendering rule, and in `DailyList.svelte:65-79` the completion checkbox is rendered *only inside
the expanded branch*. Since `TaskEditor` and `MasterList` expose no completion affordance at
all, the daily list is the only way to tick anything — so a C task genuinely cannot be completed
while A is open without a deliberate expand tap.

**Container semantics are handled to the edges,** including the two that are usually missed:
`uncompleteWithParent` re-opening ancestors on a mis-tap, and `completeParentIfDone` re-checking
after a *step deletion* (`completion.ts:43`) — both tested.

**Protocol rule 4 (never auto-delete) holds.** The only `bulkDelete` in the codebase is
`TaskEditor.svelte:66`, behind a confirm that names the step count. Nothing auto-purges.

**Import cannot destroy existing data.** `Settings.svelte:36-43` wraps clear+bulkAdd in one Dexie
`rw` transaction, so any failure aborts and rolls back. Traced specifically because it is the
obvious data-loss candidate — it is correct.

**The `$state.snapshot` bug class is clean.** All 20 Dexie write sites audited. The two fixed
instances (`TaskEditor.svelte:55`, `BreakdownWizard.svelte:19`) are the only ones that need it —
`DailyList`'s writes take plain objects straight from `liveQuery`, and `makeSteps`/`newTask`/
`EventEditor` all construct fresh literals from primitives. No remaining instances.

**Type safety is real:** strict via `@tsconfig/svelte`, zero `any`, zero `@ts-ignore`, zero
`{@html}`, one benign `!` (`main.ts:10`) and one narrow `as HTMLInputElement`.

**The e2e specs assert meaningful end states,** not just that clicks don't throw — container
heading *plus* step button, "Zrobione dziś" *then* the history entry. The `toBeHidden()` wait
added in `b9fef54` fixes a genuine in-flight-transaction race rather than weakening an assertion.

**Tone is right.** No streaks, no red overdue badge, "z wcześniejszych dni", "Tyle się udało".
The protocol's psychological constraints were respected.

---

## Issues

### Critical (must fix)

#### C1. Nested breakdown breaks the container invariant and double-renders

**File:** `app/src/lib/tasklist/MasterList.svelte:22,27`

Spec §4 explicitly allows nested breakdown ("splitting a step further is allowed"). But the
container query is written inline in the template with no `parentId` filter:

```svelte
{#each $tasks.filter((t) => isContainer(t, $tasks) && !t.dateCompleted) as parent (parent.id)}
```

Reproduced with the real query functions. Given `projekt → etap → krok`, `sections` renders
`['projekt', 'etap']` — `etap` gets its **own top-level container section** *and* is
simultaneously listed as a step-button under `projekt` (line 27–29). Two consequences:

1. Duplicate rendering of the same task on the master list.
2. The step-button path calls `onedit(step)` with `container` **undefined → false**, so
   `TaskEditor` shows the day/time inputs (`TaskEditor.svelte:83`) and lets the user schedule a
   container — violating spec §4's "a container never carries its own `scheduledDate`". A
   scheduled container then reaches the daily list (`activeTasks` has no container filter), where
   ticking it calls `completeWithParent` and marks a container done with open steps; those orphan
   steps then jump into the flat actionable list.

**Why it matters:** a spec-endorsed flow silently corrupts the container invariant and produces
tasks the user cannot reason about.

**Fix:** filter top-level sections to `!t.parentId` (or render nesting inline); pass
`isContainer(step, $tasks)` as the container flag when opening a step; add a defensive
`!isContainer(t, all)` filter to `activeTasks`; move the whole query into `models/queries.ts`
with a nested-case unit test.

#### C2. Calendar events can never be edited or deleted

**Files:** `app/src/lib/calendar/EventEditor.svelte`, `app/src/lib/calendar/CalendarView.svelte:11`,
`app/src/lib/calendar/DayView.svelte:19-24`

`grep 'db.events'` returns exactly one write in the entire app: `db.events.add(...)`. There is no
update path, no delete path, and `DayView` renders events as inert `<li>` text with no tap
target. A mistyped appointment is permanent. Also unimplemented and *not* in the recorded cuts:
`note` (spec §5 "optional note", present in the `CalendarEvent` type, never captured or shown)
and `endsAt` (captured, never displayed).

This originates in the plan — Task 12 only ever specified creation — so confirm whether it was an
intentional silent cut. But the calendar is one of the two tools protocol rule 1 names, and an
append-only calendar the user cannot correct will not survive three months of daily use.

**Fix:** make `DayView` event rows tappable into `EventEditor` with an optional `event` prop
(create/edit), add a confirmed delete, and surface `note` + `endsAt`.

### Important (should fix)

#### I1. The review screen shows every scheduled task twice, and leaks C tasks past the collapse

**File:** `app/src/lib/review/DailyReview.svelte:17-18`

`<DayView day={new Date()} />` renders all of today's `scheduledDate` tasks, then `<DailyList />`
renders the same tasks again in A/B/C sections. The e2e test comment at `smoke.spec.ts:59`
documents the duplication as a known fact. Worse: `DayView` lists them **unsorted and unmuted**,
so a C task sitting behind a collapsed C section is fully visible a few lines above it.

That does not let the user *complete* a C task (no affordance there), so rule 3's hard
enforcement survives — but it substantially undermines the mechanism the spec calls "firmer than
visual muting", and it violates the simplicity requirement on the single most important screen.

**Fix:** on the review screen, restrict `DayView` to calendar **events** only (tasks are already
the daily list's job), or pass a flag suppressing the task rows.

#### I2. The midnight guard (R4) misses the review screen's calendar half

**File:** `app/src/lib/review/DailyReview.svelte:17`

`day={new Date()}` is evaluated once at mount and is not reactive. `DailyList` and `WeekView`
both have the `nowTick` visibilitychange guard; `DayView` on the review screen has none, so after
midnight the task half updates while the calendar half still shows yesterday's appointments. On
iOS a home-screen PWA is suspended, not killed, so this is the normal case, not an edge case.

**Fix:** hoist the `nowTick`/visibilitychange guard into `DailyReview` and pass a `$derived` day.

#### I3. Backup import writes unvalidated rows

**Files:** `app/src/lib/data/backup.ts:22-27`, `app/src/lib/settings/Settings.svelte:38-42`

`deserialize` does `JSON.parse(json) as Backup` and checks only `schema !== 1`. A file with
`schema: 1` and structurally wrong rows passes straight into `bulkAdd`. A task row missing
`priority` then reaches `MasterList.svelte:37` → `task.priority.toUpperCase()` → **TypeError**,
and there is no `<svelte:boundary>` anywhere, so the screen is dead with no in-app recovery.
Truncated or hand-edited backup files are a realistic failure mode for the very feature that
exists to protect against data loss.

**Fix:** validate row shape in `deserialize` (required keys + `priority ∈ {a,b,c}`) and throw
before the transaction; add an error boundary around the router.

#### I4. Domain logic leaked into templates — violates the plan's core architecture rule

The plan states "All domain rules live in pure functions under `src/lib/models/`". Five pieces do
not, and none are unit-tested:

- `MasterList.svelte:22,27` — the container/step queries (this is exactly where C1 lives)
- `History.svelte:7-11` — completed-task filter + sort
- `DailyList.svelte:50-52` — `isEarlier` date comparison
- `EventEditor.svelte:13` — the `invalid` end-before-start rule
- `ProblemFormWizard.svelte:86` — step-gating conditions

The fact that the one real logic bug found sits in the largest of these is the argument for the
rule.

#### I5. e2e runs chromium, target is iOS Safari

**File:** `app/playwright.config.ts:14`

The plan specified webkit with chromium as a documented fallback, and the fallback was taken —
but nothing records that it was, and the plan file was never updated. This app leans on
Safari-specific behavior: IndexedDB persistence semantics, `<input type="date">`/`type="time"`
rendering, `env(safe-area-inset-*)`, and the `navigator.storage.persist()` no-op. None of that is
exercised.

**Fix:** retry `npx playwright install webkit`, or record the deviation explicitly in the plan.

#### I6. "Modal" sheets are not modal, and one can render under the tab bar

**Files:** `app/src/lib/design/theme.css:39`, `app/src/App.svelte:48-58`

`.sheet` is a plain in-flow bordered box — no backdrop, no fixed positioning, no focus trap, no
scroll-into-view. Tapping a task low on a long master list appends the editor at the bottom of
the document; on a 390×844 viewport the user may see nothing happen. Worse, the `App.svelte`
editor is rendered *after* `<nav class="tabs">` and **outside `<main>`**, so it does not get
`main`'s `padding-bottom: 72px` — its bottom row (Cancel/Delete) sits behind the
`position: fixed` tab bar. `DailyReview`'s editor is inside `<main>` and does not have this
problem, which makes the two paths behave differently.

### Minor (nice to have)

- **`aria-label="done"` / `"undo"` are English and hardcoded** — `DailyList.svelte:72,88`.
  Screen-reader text is user-facing copy; CLAUDE.md requires Polish and requires it to live in
  `strings.ts`. The e2e suite depends on the English strings, so fix both together. Same for
  `placeholder="+"` / `"−"` in `ProsConsEditor.svelte:26,28`.
- **liveQuery fan-out** — `WeekView` mounts 7 `DayView`s, each opening 2
  `liveQuery(() => db.X.toArray())` subscriptions = 14 full-table scans re-running on *every*
  write. Fine at this data volume, but it is the first thing that will bite; a single shared
  tasks/events store would collapse it.
- **O(n²) master-list queries** — `isContainer` inside a `.filter` over the same array
  (`queries.ts:30,38`). Build a `Set` of `parentId`s once.
- **Day view is not chronological** — `DayView.svelte:19-27` renders all events, then all tasks,
  so a 09:00 task appears below a 17:00 event. Merge and sort by time.
- **Service worker has no update check while open** — `skipWaiting` + `clientsClaim` +
  `cleanupOutdatedCaches` are all set correctly (verified in `dist/sw.js`), so there is no
  stale-shell trap *on reload*; but `registerSW.js` only registers on `load`, and an installed
  iOS PWA can stay open for weeks. Add a periodic `registration.update()`.
- **No test pins a clock or timezone.** TZ-correctness was verified by hand across four zones;
  nothing in the repo would catch a regression. Add `vi.setSystemTime` plus a TZ matrix (a 23:30
  UTC−8 case would be the sharp one).
- **Backup has no forward/backward compat path** — `deserialize` hard-throws on any
  `schema !== 1`. Fine for v1, but the policy should be written down alongside `SCHEMA_VERSION`.
- **Copy nits** — `strings.review.title` is `'Poranny przegląd'` (morning) although the review
  time is user-configurable; `strings.ts:76` mixes an opening `„` with a straight closing `"`.
- **`TaskEditor.save` silently reverts an emptied title** (`TaskEditor.svelte:37`) instead of
  validating.
- **Plan hygiene** — 97 `- [ ]` checkboxes, 0 ticked. The plan's own header calls for checkbox
  tracking; git log is the only record of progress.
- **Docs are thin** — `app/README.md` is 10 lines, no deployment instructions (plan Tasks 18/19
  are genuinely not done), no architecture note.

---

## Recommendations

1. **Fix C1 and I4 together.** Move `masterContainers`, `masterSteps`, `completedHistory`,
   `isEarlier` and the event-validity rule into `models/` with unit tests. C1 exists *because*
   that query lived in a template where no test could see it — that is the argument for the
   architecture rule, made concretely.
2. **Add one `<svelte:boundary>` around the router.** Combined with I3's validation it turns
   "corrupt backup bricks the app" into "corrupt backup shows a message".
3. **Decide C2 explicitly.** Either implement event edit/delete + note, or add it to the recorded
   cuts in spec §9 so it stops looking like an oversight. Given protocol rule 1, implementing it
   is the better call.
4. **One shared Dexie store.** `liveQuery(() => db.tasks.toArray())` appears in five components.
   A single `tasks` store imported everywhere fixes the fan-out, the O(n²) recomputation, and the
   `$tasks ?? []` vs `{#if $tasks}` inconsistency in one move.
5. **Pick one Dexie-write convention and put it in the wrapper.** Two call sites snapshot and
   four do not, based on a correct but non-obvious analysis of which objects are proxies. A thin
   `saveTask(t) { db.tasks.put($state.snapshot(t)) }` makes the rule unconditional and
   un-regressable.

---

## Assessment

**Ready to merge?** With fixes.

**Reasoning:** The domain core is excellent — pure, tested, timezone-correct, and it enforces the
A/B/C rule, rollover, and never-delete structurally rather than conventionally, with all four
verification commands green. But two protocol-level defects reachable through normal,
spec-endorsed flows must be fixed first: nested breakdown double-renders a container and lets it
be scheduled (C1), and calendar events can never be corrected or removed (C2).

# Code review — `feat/adhd-calendar-tasklist-pwa` (pre-merge)

Date: 2026-08-27 18:51
Range: `25943f8` (`main`) .. `7c11ad3` (branch head) — 14 commits, 23 files, +529/-100.
Scope: plan Tasks ~14-17 (`$state.snapshot` fixes, BreakdownWizard, app shell: hash router / DailyReview /
Onboarding / History / Settings + JSON backup, PWA manifest / service worker / icons, Playwright e2e, repo
hygiene, CLAUDE.md rewrite). Because this is the pre-merge review of the whole feature, the files the delta
wires together (all `models/*.ts`, all `.svelte` components, `theme.css`, `strings.ts`, spec v3, plan v3)
were read in their final state as well; two findings (C1, C2) sit in code that predates the delta.

**Verdict: merge with fixes.** C1, C2, I1, I2 block. I3 must be confirmed on-device (Task 18) before any
real data is entered.

---

## Verification actually run (from `app/`, tree untouched)

| Command | Result |
|---|---|
| `npm run check` | 114 files, 0 errors, 5 warnings (`state_referenced_locally`: `TaskEditor.svelte:18-21` ×4, `BreakdownWizard.svelte:11` ×1) — matches the documented intentional set |
| `npm run test:unit` | 7 files, 34/34 passed |
| `npm run build` | OK; `dist/sw.js`, `workbox-*.js`, `registerSW.js`, `manifest.webmanifest`, 3 icons; precache 7 entries / 162 KiB; `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, `NavigationRoute -> index.html` present |
| `npm run test:e2e` | 4/4 passed, chromium, 9.4 s |
| `git log --format=%b 25943f8..7c11ad3` | all 14 bodies empty; all subjects conventional-prefixed; no attribution trailers |
| bundle grep | one `fetch(` = Vite modulepreload polyfill (same-origin); no `XMLHttpRequest` / `WebSocket` / `sendBeacon`; no `{@html}` / `innerHTML` in `src/` |
| `grep -rn 'db.events' src` | exactly one write: `EventEditor.svelte:17` `db.events.add(...)` — no update, no delete |

---

## Strengths

- **Plan alignment near-verbatim; every deviation is a fix.** Tasks 14-16 match the plan line-for-line. The
  three `$state.snapshot()` insertions (`ProblemFormWizard.svelte:33`, `TaskEditor.svelte:55`,
  `BreakdownWizard.svelte:18`) correct a real `DataCloneError` the plan's own code would have hit. e2e
  deviations (`exact: true`, `toBeHidden()` before navigating, role-scoped assertions) tighten assertions,
  exactly as the plan's Step 4 instructs.
- **Domain rules survive the shell wiring.** Daily list is still a pure `liveQuery` over `activeTasks` /
  `doneTodayTasks`; nothing in the shell copies or mutates tasks on day change. History is a flat positive
  count ("Tyle się udało: N"), no streaks, no red badges, no blaming copy anywhere in `strings.ts`.
  Onboarding asks the protocol's real question first (fixed review moment), then offers exactly three
  zero-infrastructure OS-level reminder options — spec §7.
- **No runtime network calls, verified in the bundle** (table above). Task text is escaped by Svelte.
- **Backup import is atomic.** `Settings.svelte:36-43` clears and re-adds all five tables inside one `rw`
  transaction; a throw from `deserialize`, a missing table, or a key-path error rolls back to the pre-import
  state. The destructive path is confirmed first.
- **Service worker config is sound for this app.** Precache covers `index.html`, the single JS chunk, CSS,
  manifest and icons; `NavigationRoute` bound to `index.html` makes all hash routes resolve offline;
  `cleanupOutdatedCaches()` is on. Single chunk means `skipWaiting` + `clientsClaim` cannot strand a lazy
  import in an already-open page.
- **e2e tests are deterministic and assert through real IndexedDB.** Role/label selectors, `.sheet` scoping
  where labels collide, no `waitForTimeout`. Test 4 round-trips schedule -> daily list -> complete -> history
  through Dexie, not mocks.
- **Hygiene.** `scripts/make-icons.mjs` is dependency-free and deterministic. CLAUDE.md is accurate on counts
  (5 warnings / 34 unit / 4 e2e), routes, and the `reminder/` folder note.

---

## Issues

### Critical (must fix)

#### C1. Nested breakdown breaks the container invariant and double-renders

**File:** `app/src/lib/tasklist/MasterList.svelte:22,27`

Spec §4 explicitly allows splitting a step further. The container section query is inline in the template
with no `parentId` filter:

```svelte
{#each $tasks.filter((t) => isContainer(t, $tasks) && !t.dateCompleted) as parent (parent.id)}
```

With `projekt -> etap -> krok`, `etap` gets its own top-level container section *and* is listed as a step
button under `projekt` (line 27-29). Consequences:

1. The same task renders twice on the master list.
2. The step-button path calls `onedit(step)` with `container` undefined -> `false`, so `TaskEditor` shows the
   day/time inputs and lets the user schedule a container — violating spec §4 ("a container never carries its
   own `scheduledDate`"). A scheduled container then reaches the daily list (`activeTasks` in
   `queries.ts:22-24` has no container filter); ticking it marks a container done while steps are open, and
   the orphan steps drop into the flat actionable list.

**Why it matters:** a spec-endorsed flow silently corrupts the container invariant on the master list, which
is the product's source of truth.

**Fix:** filter top-level sections to `!t.parentId` (or render nesting inline); pass
`isContainer(step, $tasks)` as the container flag when opening a step; add a defensive `!isContainer(t, all)`
filter to `activeTasks`; move the query into `models/queries.ts` with a nested-case unit test.

#### C2. Calendar events can never be edited or deleted

**Files:** `app/src/lib/calendar/EventEditor.svelte:17`, `app/src/lib/calendar/DayView.svelte:19-24`

The only write to `db.events` in the app is `add`. `DayView` renders events as inert `<li>` text with no tap
target. A mistyped appointment is permanent. `note` (spec §5 "optional note", present on `CalendarEvent`) is
never captured or shown; `endsAt` is captured but never displayed. Neither is in the recorded v1 cuts
(spec §9 / CLAUDE.md).

This originates in the plan — Task 12 only specified creation — so confirm whether it was an intentional
silent cut. The calendar is one of the two tools protocol rule 1 names; an append-only calendar the user
cannot correct will not survive three months of daily use.

**Fix:** make `DayView` event rows tappable into `EventEditor` with an optional `event` prop (create/edit),
add a confirmed delete, surface `note` + `endsAt`.

### Important (should fix)

#### I1. Review screen freezes "today" at mount

**File:** `app/src/lib/review/DailyReview.svelte:17`

`<DayView day={new Date()} />` evaluates once. `DailyList.svelte:19-26,55` and `WeekView.svelte:6-14` carry
the `nowTick` + `visibilitychange` guard precisely because an iOS standalone PWA left open overnight resumes
with yesterday's JS state. DailyReview is the screen the OS reminder lands on and the only day-dependent view
without the guard: at 09:00 the user sees yesterday's events above a correct today list.

**Fix (3 lines):**
```svelte
let nowTick = $state(0);
const today = $derived.by(() => { void nowTick; return new Date(); });
<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />
<DayView day={today} />
```

#### I2. Editor/wizard sheets opened from the master list render off-screen and clipped by the tab bar

**Files:** `app/src/App.svelte:48-58`, `app/src/lib/design/theme.css:37-39`

`.sheet` is a plain in-flow card (no `position`, no backdrop, no focus trap, no scroll-into-view). In
`App.svelte` the TaskEditor / BreakdownWizard is mounted *after* `<nav class="tabs">` and outside `<main>`,
so it gets no `padding-bottom: 72px`. On a long master list, tapping a task shows no visible change; after
scrolling to the end the button row sits ~58 px above document bottom (16 sheet padding + 8 margin + 34
safe-area) while the fixed nav covers ~78 px (44 + 34 safe-area) on an iPhone 14 Pro -> lower half of
Zapisz / Usuń / Anuluj clipped. Playwright passes because it auto-scrolls and desktop has 0 safe-area inset.
`DailyReview`'s editor is inside `<main>` and behaves differently, so the two paths diverge.

**Fix, in order of preference:** (a) make editor/wizard sheets a fixed overlay
(`position: fixed; inset: 0; overflow: auto; background: var(--bg)`) — also makes CLAUDE.md's "modal sheets"
wording true; or (b) wrap in a container with `padding-bottom: calc(72px + env(safe-area-inset-bottom))` plus
`scrollIntoView()` on mount. The off-screen-on-long-list half also applies to sheets inside DailyReview.

#### I3. Backup export: revoke race + unverified on iOS standalone

**File:** `app/src/lib/settings/Settings.svelte:22-27`

Spec §10 calls JSON export "the real backup path" against iOS eviction. Two concerns:

- (a) `URL.revokeObjectURL(a.href)` runs synchronously right after `a.click()`. Safari has historically
  cancelled the download when the blob URL is revoked before navigation starts. Defer:
  `setTimeout(() => URL.revokeObjectURL(url), 1000)`.
- (b) `<a download>` from an iOS *standalone* PWA has been unreliable across iOS versions (silent no-op, no
  share sheet). Web Share with files is the supported route on iOS 15+ standalone:
  ```ts
  const file = new File([json], 'plan-dnia-backup.json', { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
  else /* anchor fallback */
  ```

Must be an explicit check item in Task 18 before any real data enters the app.

#### I4. Every task scheduled for today is listed twice on the habit screen (confirm intent)

**File:** `app/src/lib/review/DailyReview.svelte:17-18`

`DayView` renders `tasksScheduledOn(tasks, today)`; `DailyList` renders the same tasks in A/B/C sections.
`smoke.spec.ts:60` acknowledges the duplicate. DayView lists them unsorted and unmuted, so a C task behind a
collapsed C section is fully visible a few lines above it — no completion affordance there, so rule 3's hard
enforcement survives, but the mechanism the spec calls "firmer than visual muting" is undermined on the one
screen the user opens daily. Spec §5 says the review screen is "today's events + daily list"; the
tasks-on-their-day rule was written for the calendar tab.

**Fix:** give `DayView` a prop (e.g. `tasks: 'all' | 'timed' | 'none'`) and on the review screen show events
plus only `scheduledTime` tasks, or events only. Record the decision in spec §5 either way.

#### I5. `deserialize` validates only the schema number

**File:** `app/src/lib/models/backup.ts:24-27`

A `schema: 1` file whose task rows lack `priority` / `title` imports (the transaction only rolls back on
key-path errors) and then throws in `MasterList.svelte:37` on `task.priority.toUpperCase()`; there is no
`<svelte:boundary>` anywhere, so the screen is dead with no in-app recovery. Truncated or hand-edited backup
files are a realistic failure mode for the one feature that exists to protect against data loss.

**Fix:** shape check in the pure fn (tables are arrays; each task has `id`, `title`, `priority ∈ a|b|c`,
`dateAdded`) and throw before the transaction; two unit tests (malformed JSON, missing table) —
`backup.test.ts` covers only round-trip and foreign schema. Consider an error boundary around the router.

#### I6. Domain logic leaked into templates

The plan states "all domain rules live in pure functions under `src/lib/models/`". Not the case for:

- `MasterList.svelte:22,27` — container / step queries (where C1 lives)
- `History.svelte:7-11` — completed-task filter + sort
- `DailyList.svelte:50-52` — `isEarlier` date comparison
- `EventEditor.svelte:13` — `invalid` end-before-start rule
- `ProblemFormWizard.svelte:86` — step-gating conditions

None are unit-tested. The one real logic bug found (C1) sits in the largest of them.

### Minor (nice to have)

#### M1. Import `<input>`: MIME-only `accept`, no value reset

**File:** `app/src/lib/settings/Settings.svelte:61`

iOS Files sometimes greys out `.json` under `accept="application/json"`; use `accept=".json,application/json"`.
Selecting the same file twice does not re-fire `change` — set `input.value = ''` after handling.

#### M2. QuickAdd "Anuluj" completes onboarding

**File:** `app/src/lib/review/Onboarding.svelte:33`

`onclose={finish}` -> last screen shows two buttons ("Anuluj", "Zaczynam") doing the same thing; "Anuluj"
reads as "go back" to a first-time user. Pass an `onclose` that only hides the form, or hide QuickAdd's
cancel via a prop.

#### M3. BreakdownWizard: silent no-op on all-blank steps; unsaved editor edits discarded

**File:** `app/src/lib/strategies/BreakdownWizard.svelte:13-16`

`if (made.length === 0) return;` gives no feedback. Because TaskEditor is save-committed, "Podziel na kroki"
passes the *stored* task, so a title/priority edit made in the same editor session is lost without warning.
Both defensible in v1; a one-line hint string covers the first.

#### M4. PWA polish before the permanent origin

**Files:** `app/index.html:6-7`, `app/vite.config.ts:19`

No `<meta name="theme-color">` (vite-plugin-pwa does not inject it), no
`apple-mobile-web-app-status-bar-style`, manifest has no `id`. Icons are solid `#4A6FA5` squares with no
glyph -> blank blue home-screen tile. Fine for the Task 18 throwaway install; do before Task 19 since iOS
caches the touch icon at install time.

#### M5. Docs drift

`CLAUDE.md:63` — `queries.ts` row omits `activeTasks` / `doneTodayTasks`, the two fns `DailyList` actually
calls. `CLAUDE.md:74` — "modal sheets" is inaccurate today (see I2); fix CSS or the sentence.
`app/README.md` omits `npm run check`.

#### M6. Chromium-only e2e while webkit is already downloaded

**File:** `app/playwright.config.ts:14`

`~/.cache/ms-playwright/webkit-2336` exists. Documented fallback, not a deviation — but I2, I3, M1 are all
WebKit-specific. A second `webkit` project, even run manually, would catch some before a device test.

#### M7. No e2e for the backup round trip

`page.setInputFiles` on the import input + `page.waitForEvent('download')` content assertion covers the
only destructive flow in the app in ~20 lines.

---

## Recommendations

- Land C1, C2, I1, I2 before Task 18 — all visible from the code today and would otherwise burn the
  on-device iteration. I1 is three lines; I2 is a CSS decision that also settles the CLAUDE.md wording.
- Make I3 a named Task 18 checklist item; prefer `navigator.share` with a file. The backup story is the
  spec's answer to storage eviction and deserves the same rigour as the data layer.
- Decide I4 explicitly and write it into spec §5 so the next reader does not "fix" the duplication or its
  absence.
- Keep the pattern: every `db.*.put/add` of a prop or `$state` value goes through `$state.snapshot()`.
  Three separate commits converged on it; a grep-based check in review is cheaper than a helper.

---

## Assessment

**Ready to merge?** With fixes.

**Reasoning:** The delta is faithful to the plan, enforces the domain rules, and passes check / unit /
build / e2e. Two pre-existing defects (C1 nested-container corruption, C2 append-only calendar) and two
shell defects (I1 stale day on the habit screen, I2 clipped editor) must land first; I3 must be confirmed
on-device in Task 18 before real data is entered.

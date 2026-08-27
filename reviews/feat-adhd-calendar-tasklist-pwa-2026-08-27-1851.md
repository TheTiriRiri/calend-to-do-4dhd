# Code review — `feat/adhd-calendar-tasklist-pwa` (pre-merge, delta vs `main`)

Date: 2026-08-27 18:51
Range: `25943f8` (`main`) .. `7c11ad3` (branch head before this file; `08f5cea` on top is only the previous review file)
Scope: 14 commits, 23 files, +529/-100 — plan Tasks ~14-17: `$state.snapshot` fixes, BreakdownWizard,
app shell (router/DailyReview/Onboarding/History/Settings+backup), PWA manifest/SW/icons, Playwright e2e,
repo hygiene, CLAUDE.md rewrite.

Relation to the earlier review (`feat-adhd-calendar-tasklist-pwa-2026-08-27-1843.md`, range `904dd5a..2500dc5`,
whole feature): this one was produced by an independent reviewer looking only at the `main..HEAD` delta, then
cross-checked against the code by hand. Overlapping findings are marked **(= earlier Ix)**; findings unique to
this pass are marked **(new)**. Nothing from the earlier review has been addressed yet — every commit since
18:43 is docs-only — so its **C1** (nested breakdown breaks container invariant) and **C2** (calendar events
cannot be edited/deleted) still block. They live in files outside this delta and are not repeated below.

**Verdict: merge with fixes.** Earlier C1 + C2 block; from this pass, #1 and #2 should land before Task 18.

---

## Verification actually run (from `app/`, tree untouched)

| Command | Result |
|---|---|
| `npm run check` | 114 files, 0 errors, 5 warnings (`state_referenced_locally`: TaskEditor.svelte:18-21 ×4, BreakdownWizard.svelte:11 ×1) — matches the documented intentional set |
| `npm run test:unit` | 7 files, 34/34 passed |
| `npm run build` | OK; `dist/sw.js`, `workbox-*.js`, `registerSW.js`, `manifest.webmanifest`, 3 icons; precache 7 entries / 162 KiB; `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, `NavigationRoute -> index.html` present |
| `npm run test:e2e` | 4/4 passed, chromium, 9.4 s |
| `git log --format=%b 25943f8..7c11ad3` | all 14 bodies empty, all subjects conventional-prefixed |
| bundle grep | one `fetch(` = Vite modulepreload polyfill (same-origin); no `XMLHttpRequest`/`WebSocket`/`sendBeacon`; no `{@html}`/`innerHTML` in `src/` |

---

## Strengths

- **Plan alignment near-verbatim; every deviation is a fix.** Tasks 14-16 match the plan line-for-line. The
  three `$state.snapshot()` insertions (`ProblemFormWizard.svelte:33`, `TaskEditor.svelte:55`,
  `BreakdownWizard.svelte:18`) correct a real `DataCloneError` the plan's own code would have hit. e2e
  deviations (`exact: true`, `toBeHidden()` before navigating, role-scoped assertions) tighten assertions.
- **Domain rules survive the shell wiring.** Daily list still a pure `liveQuery` over `activeTasks` /
  `doneTodayTasks`; nothing in the shell copies tasks on day change. History = flat positive count, no
  streaks, no red badges, no blaming copy in `strings.ts`. Onboarding asks the protocol's real question
  (fixed review moment) then offers exactly three OS-level reminder options — spec §7.
- **No runtime network calls, verified in the bundle** (see table). Task text escaped by Svelte.
- **Backup import is atomic.** `Settings.svelte:36-43` clears + re-adds all five tables in one `rw`
  transaction; any throw rolls back. Destructive path is confirmed first.
- **SW config sound for a single-chunk build.** Precache covers shell + manifest + icons; `NavigationRoute`
  makes hash routes resolve offline; single chunk means `skipWaiting`+`clientsClaim` cannot strand a lazy
  import.
- **e2e deterministic and DB-backed.** Role/label selectors, `.sheet` scoping where labels collide, no
  `waitForTimeout`. Test 4 round-trips schedule -> daily list -> complete -> history through Dexie.
- **Hygiene.** Single-line conventional commits, no attribution trailers. `scripts/make-icons.mjs` is
  dependency-free and deterministic. CLAUDE.md counts (5 warnings / 34 unit / 4 e2e), routes and the
  `reminder/` note are accurate.

---

## Issues

### Critical (must fix)

None new in this delta. Earlier review's **C1** and **C2** remain open and blocking.

### Important (should fix)

#### 1. Review screen freezes "today" at mount **(= earlier I2)**

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

#### 2. Editor/wizard sheets opened from the master list render off-screen and clipped by the tab bar **(= earlier I6)**

**Files:** `app/src/App.svelte:48-58`, `app/src/lib/design/theme.css:37-39`

`.sheet` is a plain in-flow card (no `position`, no backdrop). In `App.svelte` the TaskEditor /
BreakdownWizard is mounted *after* `<nav class="tabs">` and outside `<main>`, so it gets no
`padding-bottom: 72px`. On a long master list, tapping a task shows no visible change; after scrolling to the
end the button row sits ~58 px above document bottom (16 sheet padding + 8 margin + 34 safe-area) while the
fixed nav covers ~78 px (44 + 34 safe-area) on an iPhone 14 Pro -> lower half of Zapisz/Usuń/Anuluj clipped.
Playwright passes because it auto-scrolls and desktop has 0 safe-area inset.

**Fix, in order of preference:** (a) make editor/wizard sheets a fixed overlay
(`position: fixed; inset: 0; overflow: auto; background: var(--bg)`) — also makes CLAUDE.md's "modal sheets"
wording true; or (b) wrap in a container with `padding-bottom: calc(72px + env(safe-area-inset-bottom))` plus
`scrollIntoView()` on mount. The off-screen-on-long-list half also applies to sheets inside DailyReview
(minus tab-bar clipping).

#### 3. Backup export: revoke race + unverified on iOS standalone **(new)**

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

Either way this must be an explicit check item in Task 18 before any real data enters the app.

#### 4. Every task scheduled for today is listed twice on the habit screen **(= earlier I1; confirm intent)**

**File:** `app/src/lib/review/DailyReview.svelte:17-18`

`DayView` renders `tasksScheduledOn(tasks, today)`; `DailyList` renders the same tasks in A/B/C sections.
`smoke.spec.ts:60` acknowledges the duplicate. Earlier I1 adds the sharper point: DayView lists them unsorted
and unmuted, so a C task behind a collapsed C section is visible a few lines above it. Spec §5 says the review
screen is "today's events + daily list"; the tasks-on-their-day rule was written for the calendar tab.

**Fix:** give `DayView` a prop (e.g. `tasks: 'all' | 'timed' | 'none'`) and on the review screen show events
plus only `scheduledTime` tasks, or events only. Record the decision in spec §5 either way.

### Minor (nice to have)

#### 5. `deserialize` validates only the schema number **(= earlier I3)**

**File:** `app/src/lib/models/backup.ts:24-27`

A `schema: 1` file whose task rows lack `priority`/`title` imports (transaction only rolls back on key-path
errors) and then throws in `MasterList.svelte` on `task.priority.toUpperCase()`. Shape check in the pure fn
(tables are arrays; each task has `id`, `title`, `priority ∈ a|b|c`, `dateAdded`) + two unit tests
(malformed JSON, missing table). `backup.test.ts` covers only round-trip and foreign schema.

#### 6. Import `<input>`: MIME-only `accept`, no value reset **(new)**

**File:** `app/src/lib/settings/Settings.svelte:61`

iOS Files sometimes greys out `.json` under `accept="application/json"`; use `accept=".json,application/json"`.
Selecting the same file twice does not re-fire `change` — set `input.value = ''` after handling.

#### 7. QuickAdd "Anuluj" completes onboarding **(new)**

**File:** `app/src/lib/review/Onboarding.svelte:33`

`onclose={finish}` -> last screen shows two buttons ("Anuluj", "Zaczynam") doing the same thing; "Anuluj"
reads as "go back" to a first-time user. Pass an `onclose` that only hides the form, or hide QuickAdd's
cancel via a prop.

#### 8. BreakdownWizard: silent no-op on all-blank steps; unsaved editor edits discarded **(new)**

**File:** `app/src/lib/strategies/BreakdownWizard.svelte:13-16`

`if (made.length === 0) return;` gives no feedback. And because TaskEditor is save-committed,
"Podziel na kroki" passes the *stored* task, so a title/priority edit made in the same editor session is
lost without warning. Both defensible in v1; a one-line hint string covers the first.

#### 9. PWA polish before the permanent origin **(new)**

**Files:** `app/index.html:6-7`, `app/vite.config.ts:19`

No `<meta name="theme-color">` (vite-plugin-pwa does not inject it), no
`apple-mobile-web-app-status-bar-style`, manifest has no `id`. Icons are solid `#4A6FA5` squares with no
glyph -> blank blue home-screen tile. Fine for the Task 18 throwaway install; do before Task 19 since iOS
caches the touch icon at install time.

#### 10. Docs drift **(new)**

`CLAUDE.md:63` — `queries.ts` row omits `activeTasks` / `doneTodayTasks`, the two fns `DailyList` actually
calls. `CLAUDE.md:74` — "modal sheets" is inaccurate today (see #2); fix CSS or the sentence.
`app/README.md` omits `npm run check`.

#### 11. Chromium-only e2e while webkit is already downloaded **(= earlier I5)**

**File:** `app/playwright.config.ts:14`

`~/.cache/ms-playwright/webkit-2336` exists. Documented fallback, not a deviation — but #2, #3, #6 are all
WebKit-specific. A second `webkit` project, even run manually, would catch some before a device test.

#### 12. No e2e for the backup round trip **(new)**

`page.setInputFiles` on the import input + `page.waitForEvent('download')` content assertion covers the
only destructive flow in the app in ~20 lines.

---

## Recommendations

- Land #1 and #2 before Task 18 — both are visible from the code today and would otherwise burn the
  on-device iteration. #1 is three lines; #2 is a CSS decision that also settles the CLAUDE.md wording.
- Make #3 a named Task 18 checklist item; prefer `navigator.share` with a file. The backup story is the
  spec's answer to storage eviction and deserves the same rigour as the data layer.
- Decide #4 explicitly and write it into spec §5 so the next reader does not "fix" the duplication or its
  absence.
- Keep the pattern: every `db.*.put/add` of a prop or `$state` value goes through `$state.snapshot()`.
  Three separate commits converged on it; a grep-based check in review is cheaper than a helper.

---

## Assessment

**Ready to merge?** With fixes.

**Reasoning:** This delta is faithful to the plan, enforces the domain rules, and passes check / unit /
build / e2e. Required before merge: earlier C1 + C2 (outside this delta, still open) and #1 + #2 from this
pass; #3 must be confirmed on-device in Task 18 before real data is entered.

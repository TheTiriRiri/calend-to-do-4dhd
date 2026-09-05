# QA open items — after the 2026-09-05 pass

State at the time of writing: `main` = `ff35163`, deployed and confirmed running on the
phone. `npm run check` 0 errors / 15 warnings, 78 unit tests, 58 e2e flows / 116 green on
chromium + webkit via `npm run test:e2e:docker`.

Everything below is what is *not* done. Items are ordered by what would hurt most if it
broke on the real device with real data. Effort: S < 1 h, M = a few hours, L = a day.

---

## 1. Manual, on the iPhone — nothing else can cover these

The desktop suite cannot reach the install, the OS share sheet, or the storage lifecycle.
Run these on the installed home-screen app, from the bare `https://cal-to-do-kk.pages.dev`
origin, with throwaway data first.

| # | Check | Why it cannot be automated |
|---|---|---|
| 1.1 | Airplane mode, cold launch from the icon: app loads, Barlow renders (not system sans), no error | the precache is only exercised by a real offline launch |
| 1.2 | Export: share sheet opens, save the JSON to Files; then cancel a share and confirm no error message and no stray download | `navigator.share` with files exists only on the device |
| 1.3 | Import that file back: confirm dialog, data replaced, counts match | the file picker is native |
| 1.4 | Date and time wheels in the task editor and the event editor produce the value that gets saved | native pickers differ from the desktop widgets |
| 1.5 | Safe areas: header clear of the notch, tabbar clear of the home indicator, bottom action block not overlapped; then rotate to landscape and confirm nothing is clipped | `env(safe-area-inset-*)` is 0 in the test browser |
| 1.6 | VoiceOver: the checkbox announces "oznacz jako zrobione", undo announces "cofnij <title>", a section head reads "A Najważniejsze" and not "ANajważniejsze" | the suite asserts the names exist, not how they are spoken |
| 1.7 | Field corners are square after the WebKit radius fix (`7174a9b`) | a screenshot on the device is the only proof for the human eye |
| 1.8 | Overlay sheets scroll when the keyboard is up and the sheet is taller than the visual viewport | the software keyboard has no desktop equivalent |
| 1.9 | Leave the app open overnight, or set the device clock forward one day and return to it: yesterday's unfinished task sits under today with "z wcześniejszych dni", the date header moved, the done-today strip is empty | the automated version fakes the clock; this is the real thing |

Closed by observation already: the service worker updates the installed app within two
launches (`autoUpdate` needs no prompt), and the install colours now come from the design
tokens.

## 2. Automated gaps worth closing next

| # | Gap | Effort | What to write |
|---|---|---|---|
| ~~2.1~~ | ~~The "z wcześniejszych dni" badge has no e2e (unit only)~~ — **closed 2026-09-05**, covered by the backdated `'Pranie'` task in `daily-actions.spec.ts` | S | done |
| 2.2 | No DST test | S | unit test over 2026-10-25 (Europe/Warsaw): a task scheduled that day is active exactly once, and `moveToNextDay` lands on the 26th |
| ~~2.3~~ | ~~`newTask` gives two tasks created in the same millisecond an identical `sortOrder`~~ — **closed 2026-09-05**, `nextSortOrder()` in `types.ts` breaks the tie with a module-level counter; three unit tests in `queries.test.ts` cover it and all three fail without it | S | done |
| 2.4 | Zero accessibility automation | M | add `@axe-core/playwright`, run it over the five routes with the seeded fixture from `theme.spec.ts`, fail on serious/critical only |
| 2.5 | `svelte:boundary` failure snippet is never exercised | S | force a throw in a child component behind a test-only flag, assert the copy and that `reset()` recovers |

## 3. Open question — do not close it without evidence

**The category prefill race.** `2c: a category typed once is offered to the next task`
failed once in a full run (`option[value="dom"]` count 0) and has not failed since.
Reading the code, `TaskEditor`'s prefill `$effect` could overwrite a name typed while the
`categories` liveQuery was still resolving, which would explain it exactly. A guard was
added in `3016904` — but the race could **not** be reproduced without that guard in 78
runs, so the guard is defensive, not a proven fix.

If the test fails again, the hypothesis was wrong: capture the trace
(`npx playwright test --trace on`) before assuming anything, and look at whether the
first save actually wrote a category row rather than at the datalist.

## 4. The 2a–2g / 3a–3e redesign sweep

Both `models/` questions it waited on are decided and implemented, so the sweep is markup
and CSS only:

- completed steps stay in their container in a done state (`containerDescendants`, handoff 2a)
- history groups by completion day (`completedByDay`, handoff 2f)

**Safety net already in place** (do not start without it, do not weaken it to make a
screen pass):

- `app/tests/e2e/pre-sweep.spec.ts` — 13 locks on what each of those screens *does*
- `app/tests/e2e/theme.spec.ts` — radius 0, 44 px targets and no field under 16 px, over
  all five routes with seeded data, plus the install-colour check

**Suggested order** — one screen per commit, `check` + `test:unit` + `test:e2e` green on
each, `test:e2e:docker` before the last one:

1. 2c TaskEditor and 3d EventEditor — the two screens every other flow passes through
2. 2a MasterList — the largest markup change; the completed-step state lands visually here
3. 2f History — the day axis exists in the model, only the blueprint frame is missing
4. 2g Settings, 2d BreakdownWizard, 2e ProblemFormWizard
5. 3a–3c Onboarding and the QuickAdd sheet
6. 2b Calendar / WeekView last: it shares `DayView` with the finished review screen

`theme.css` is global, so each commit can move the screens it did not touch. The per-route
invariants are there to catch exactly that — treat a failure on an untouched route as the
commit's own bug.

## 5. Versioning

`v1.0.0` tags `8faa9ea`, which is no longer what production serves. Tag the build that is
actually installed after the next deploy (`v1.0.1`), or wait for the sweep and tag
`v1.1.0` then — but do not move an existing tag.

## 6. Deliberately not doing

Per spec §9 and the protocol's warning about the "perfect system trap": drag-to-reorder,
error banners for failed IndexedDB writes, a read view of past problem forms, clearing an
assigned category, a weekly list level, per-event alerts or any push notification, streak
counters, overdue badges framed as failure. None of these are bugs.

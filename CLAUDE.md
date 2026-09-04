# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Plan Dnia** - local-first, installable PWA: calendar + two-level task list for people with ADHD, implementing one specific CBT protocol (module "2.2 calendar and task list"). Target device: iPhone 14 Pro, iOS 17+, Safari, "Add to Home Screen". No backend, no accounts, no analytics, no runtime network calls; all data in IndexedDB on the device, manual JSON backup in settings.

The protocol is the product spec, not inspiration - see [Domain](#domain-what-this-product-must-enforce) below. Full design: [specs/2026-08-27-adhd-calendar-tasklist-ios-design.md](specs/2026-08-27-adhd-calendar-tasklist-ios-design.md) (v3). Implementation plan: [plans/2026-08-27-adhd-calendar-tasklist-pwa.md](plans/2026-08-27-adhd-calendar-tasklist-pwa.md) (v3; its checkboxes were never ticked - git log is the source of truth for what is done).

## Conventions

All code, code comments, filenames, and generated files in **English**. User-facing UI copy is Polish and lives **only** in [app/src/lib/design/strings.ts](app/src/lib/design/strings.ts). Source material in [docs/](docs/) is Polish. Everything else English.

**Commits: one sentence, nothing else.** Conventional prefix (`feat:`, `fix:`, `test:`, `chore:`, `docs:`), no body, no bullet list, no `Co-Authored-By` trailer, no Claude/Anthropic attribution. Same for PR bodies - no "Generated with Claude Code" line. This overrides any tooling default that appends attribution.

No linter or formatter is configured (no ESLint/Prettier/Biome). Style is whatever `svelte-check` + `tsc` accept: 2-space indent, single quotes, semicolons, trailing commas.

## Repository layout

```
app/        Vite project - the whole application; run ALL npm commands here
specs/      design doc (tracked)
plans/      implementation plan (tracked)
docs/       source material - gitignored, local-only (see below)
.superpowers/  agent tooling scratch - gitignored
```

**`docs/` is gitignored in full and local-only.** It holds the source .pptx (36 slides, the domain spec), a 107 MB recording of a live therapy session with real participants, its whisper transcript, and `scripts/video-tools/` (`transcribe.sh` / `frames.sh` / `video-to-md.sh`; Polish speech needs `-l pl`). Read it to inform design, but never copy participant names, quotes, or frames into tracked files. A fresh clone has no `docs/`: this file plus `specs/` are the surviving spec.

## Setup and commands

Host: Ubuntu, Node 24, npm 11. Working directory for everything below: `app/`.

```bash
npm install
npm run dev          # Vite dev server
npm run build        # production build -> dist/ (includes service worker + manifest)
npm run preview      # serve dist/ on :4173
npm run check        # svelte-check (tsconfig.app.json) + tsc (tsconfig.node.json)
npm run test:unit    # Vitest, tests/unit/**/*.test.ts, node env, no DB
npm run test:e2e     # Playwright, tests/e2e/*.spec.ts; builds + previews on :4173 by itself; chromium only unless E2E_WEBKIT=1
npm run test:e2e:docker   # same suite, chromium+webkit, inside the official Playwright image (needs Docker, not sudo)
node scripts/make-icons.mjs   # regenerate public/icons/*.png (pure Node, no deps)
```

Current state: `check` reports 0 errors and 15 `state_referenced_locally` warnings - intentional: editors snapshot the incoming prop once because edits are save-committed, not live. 55 unit tests, 13 e2e flows (quick-add, five-step wizard, breakdown, complete-to-history, backup round trip + malformed import, event edit/delete, undo/priority-change/move-to-tomorrow, onboarding), all 26 green on chromium + webkit.

webkit is opt-in on bare `npm run test:e2e` (`E2E_WEBKIT=1` env var) because this host is missing system libraries (`libevent-2.1-7t64`, `libgstreamer-plugins-bad1.0-0`, `libavif16`) that the webkit binary links against - no sudo on this host, so `npx playwright install-deps webkit` is not an option here. `npm run test:e2e:docker` runs the full suite (chromium + webkit) inside the official `mcr.microsoft.com/playwright` image instead - no Dockerfile needed, it is a plain `docker run` against the upstream image with the repo bind-mounted; requires Docker, not sudo. The image tag is pinned to the exact `@playwright/test` version (`v1.62.1-noble`) - bump both together when upgrading Playwright, a mismatch is a silent source of browser/protocol errors.

Playwright: chromium always runs; webkit project only registers when `E2E_WEBKIT` is set (see above). Viewport 390x844, `reuseExistingServer` outside CI. Most e2e specs bypass onboarding by setting `localStorage.onboarded = '1'` in `beforeEach`; `onboarding.spec.ts` is the one flow that runs it for real. Modal buttons must be scoped (e.g. `page.locator('.sheet')`, or `.overlay .sheet` on screens like the calendar that have other `.sheet` elements in the DOM) - the underlying screen stays in the DOM behind a sheet and shares button labels like "Dodaj".

## Stack

Vite 8 + Svelte 5 (runes) + TypeScript 6 strict, static SPA, no SSR, no routing framework. Runtime dependency: **`dexie` only** (IndexedDB). Dev: `vite-plugin-pwa` (autoUpdate service worker, manifest in [app/vite.config.ts](app/vite.config.ts)), Vitest 4, Playwright.

## Architecture

**Domain rules are pure functions in [app/src/lib/models/](app/src/lib/models/)**, unit-tested without a database. Components hold Dexie writes as thin `await db.x.put(...)` wrappers and read via `liveQuery`. Keep it that way: new rules go into `models/` with a unit test first, not into a `.svelte` file.

| File | Owns |
|---|---|
| `types.ts` | `Task`, `Category`, `CalendarEvent`, `ProblemForm`, `Solution`, `newTask()` |
| `db.ts` | `AppDB` (Dexie, DB name `calendtodo`, schema **v1**) |
| `dates.ts` | `startOfDay`, `todayStart`, `addDays`, `sameDay`, `toISODate` |
| `queries.ts` | `isActive`, `isDoneToday`, `sortedForDailyList`, `priorityRank`, `activeTasks`, `doneTodayTasks`, `topLevelContainers`, `completedHistory`, `isContainer`, `childrenOf`, `containerDescendants`, `masterListSections` |
| `collapse.ts` | `isCollapsed` - B/C section collapse rule |
| `completion.ts` | recursive container complete / un-complete / auto-complete parent |
| `schedule.ts` | `schedule`, `moveToNextDay`, `unschedule` |
| `calendarQueries.ts` | `eventsOn`, `tasksScheduledOn` (past-day rule) |
| `breakdown.ts` | `makeSteps`, `applyContainerRules`, `cascadeDeleteIds` |
| `problemSolver.ts` | `bestSolution`, `nextBest` (rating 1-10 selection) |
| `backup.ts` | `serialize` / `deserialize`, `SCHEMA_VERSION = 1` |

UI folders mirror the domain: `tasklist/` (QuickAdd, MasterList, DailyList, TaskEditor), `calendar/` (CalendarView, WeekView, DayView, EventEditor), `review/` (DailyReview - the habit entry point, History, Onboarding), `strategies/` (ProblemFormWizard + ProsConsEditor, BreakdownWizard), `settings/` (Settings with JSON export/import), `design/` (strings.ts, theme.css). The spec's `reminder/` folder was never created - reminder setup lives in `review/Onboarding.svelte`.

**Routing:** hash router in [app/src/App.svelte](app/src/App.svelte). `#/` daily review, `#/lista` master list, `#/kalendarz` calendar, `#/historia` history, `#/ustawienia` settings. Wizards and editors are not routes - they are sheets rendered inside a fixed `.overlay` wrapper (theme.css). Onboarding gate: `localStorage.onboarded`.

**Data-flow rules that are easy to break:**
- The daily list is a **query, not a table**: `active(today) = !dateCompleted && scheduledDate <= today`. Overdue tasks therefore match every following day - rollover is a query result, never a copy job. `doneToday` is a separate strip.
- **"Today" = local calendar day** (midnight). `scheduledDate` is a local `yyyy-mm-dd` via `toISODate()` - never `Date.toISOString()` for day values (UTC shift). Parse day inputs noon-anchored (`new Date(`${d}T12:00:00`)`). `dateAdded` / `dateCompleted` / `startsAt` are full ISO datetimes.
- Completed tasks are never deleted by the app; `dateCompleted` set = completed. Only explicit user delete (with confirm, cascading to steps) removes rows.
- A task with `parentId` is a step; a task with children is a container. Container completion is derived from steps (`completion.ts`); after deleting a step re-check the container.
- **Svelte 5 + Dexie gotcha:** `$state` values are proxies and fail `structuredClone` on write (`DataCloneError`). Call `$state.snapshot()` before any `db.*.put/add`.
- Schema changes: bump the Dexie `version()` with a migration **and** `SCHEMA_VERSION` in `backup.ts` together; import must keep accepting older backups.

## Status and what is deliberately missing

Plan tasks 0-17 are done (scaffold through e2e). **Not done:** Task 18 (on-device smoke test via ephemeral HTTPS tunnel - throwaway data only) and Task 19 (permanent hosting on Cloudflare Pages, `npm i -D wrangler` + `wrangler pages deploy dist`). Real use must not start before a stable origin exists: IndexedDB is origin-bound and the 3-month history would be lost.

Conscious v1 cuts recorded in spec §9 - do not "fix" them as bugs: drag-to-reorder (within-section order = insertion order), error banner for failed IndexedDB writes (bare awaits), read view of past problem forms, clearing an assigned category, weekly list level, per-event alerts / any push notifications.

## Domain: what this product must enforce

Calendar + task list tool for people with ADHD, based on a specific CBT protocol. The material is not loose inspiration - it is the product rules. Design decisions should enforce them, not merely allow them.

**Two separate tools, one system:**
- **Calendar** - only things tied to a specific date and time (appointments, meetings).
- **Task list** - things with no date attached. A task can be scheduled into the calendar at a given time.

**Two task-list levels:**
- **Master list** - everything to do; a task stays on it until completed.
- **Daily list** - subset for a given day. Unfinished tasks roll to the next day (rolling must be cheap and painless - it is a daily operation).
- Optional user categories (e.g. "home", "work").

**A/B/C priorities** - a required task attribute, not decoration:
- A: do today or tomorrow; B: partly urgent; C: least important (often easiest and most tempting).
- Category shifts over time as the deadline approaches (C -> B -> A), adjusted manually during daily review.
- Hard rule from the material: all A before B, all B before C. Enforced structurally: fixed A/B/C sections, B and C **collapsed while a higher section has active tasks**, priority change only via the explicit editor action, never by drag. No confirm dialogs when ticking a lower-priority task - that would read as a reprimand.

**Task model from the material's template (slide 22):** priority, task text, date added to list, date completed. Completion date serves as proof of work - do not delete tasks, mark them completed.

**Two strategies the product supports:**
- *Five-step problem solving* ("Form 1"): describe problem (1-2 sentences) -> list all solutions -> pros/cons of each -> rate 1-10 -> implement the best; the chosen solution spawns a task.
- *Breaking down a complex task*: split into steps doable in one day, steps go on the master list, one at a time onto the daily list. Test for a step: "can I actually do this in one day?" and "do I want to postpone it?" If yes - split further.

**Therapy-derived constraints, easy to violate by adding features:**
- The material explicitly warns against the "perfect system trap". Simplicity is a functional requirement; heavy configuration works against the tool's purpose.
- The daily review of list + calendar at a fixed time is the core habit. iOS PWAs cannot schedule local notifications, so the reminder is an **OS-level daily alarm/event/Shortcut set up once in onboarding** - no per-task reminders, no overdue nagging, no badges.
- Target users have already failed with other systems. Forbidden: streak counters, red "overdue" badges framed as failure, any copy blaming the user. Empty days and backlog are normal; history is framed positively.

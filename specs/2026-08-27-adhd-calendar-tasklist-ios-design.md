# Design: ADHD Calendar + Task List (iPhone-targeted PWA)

Date: 2026-08-27
Status: draft v3 — stack RESOLVED to PWA. User's answer on record: **no Mac**;
development machine is Ubuntu 24.04, target device iPhone 14 Pro. (A prior v2
edit claimed "confirmed with user: has a Mac" — that claim was incorrect and is
superseded here.) Review v2 residuals R1-R5 applied. Domain sections (§1, §4-§6,
§8-§9) unchanged from v2 except where a residual required a sentence.
Target device: iPhone 14 Pro, iOS 17+, Safari, installed to home screen

## 1. Purpose

Mobile app implementing the CBT protocol from module "2.2 calendar and task list"
(source material in `docs/`, gitignored). The protocol is the product spec: design
decisions must enforce its rules, not merely allow them.

Core protocol rules:

1. Exactly two tools: **calendar** (only things with a specific date and time) and
   **task list** (no date attached). No loose notes/reminders outside the system.
2. Two list levels: **master list** (everything, task stays until completed) and
   **daily list** (subset for a given day). Unfinished tasks roll to the next day;
   rolling must be free of friction and guilt.
3. **A/B/C priority** is a required task attribute. Hard rule: all A before B, all B
   before C. Priorities are adjusted manually during daily review (C -> B -> A as a
   deadline approaches).
4. Task template: priority, task text, date added, date completed. Completed tasks
   are never auto-deleted — completion date is proof of work.
5. Daily review of list + calendar at a fixed time is the core habit (protocol target:
   ~3 months of daily use). One fixed-time review reminder matters more than
   per-task reminders.
6. Two supported strategies:
   - **Five-step problem solving** ("Form 1"): describe problem (1-2 sentences) ->
     list all solutions -> pros/cons of each -> rate each 1-10 -> implement the best.
   - **Breaking down a complex task**: split into steps doable in one day; steps go
     to the master list, one at a time onto the daily list, optionally with a date
     and hour. Test for a step: "can I actually do this in one day?" and "do I want
     to postpone it?" — if postponed often, split further.
7. Simplicity is a functional requirement (protocol explicitly warns against the
   "perfect system trap"). Tone and onboarding must never punish backlog or empty
   days.

## 2. Stack — RESOLVED: PWA

Deciding constraint: development happens on Ubuntu 24.04 and **no Mac is
available**. Native iOS requires Xcode/macOS; Linux-side sideloading workarounds
are fragile and re-sign every 7 days — fatal for a 3-month daily habit. Expo/EAS
cloud builds still require an Apple account and a signing path to the device. A
PWA builds on Linux, installs from Safari ("Add to Home Screen"), needs no Apple
account, and updates by redeploy.

Chosen stack:

- **Vite + Svelte 5 + TypeScript**, static build, no SSR. Tiny hash-based router
  (few screens, no routing framework needed).
- **Dexie (IndexedDB)** for persistence; `liveQuery` drives views the way
  SwiftData `@Query` would have.
- **Service worker** (vite-plugin-pwa): full offline operation, precached shell.
  App is local-first; no accounts, no analytics, no network calls at runtime in v1.
- **Web manifest**: Polish name, `display: standalone`, icons, theme colors;
  safe-area insets respected (Dynamic Island device).
- Hosting: any static HTTPS host (Cloudflare Pages or GitHub Pages, free tier).
  HTTPS is mandatory for service worker + install; on-device testing from the
  Ubuntu machine therefore goes through an HTTPS tunnel (e.g. `cloudflared`) or a
  Pages preview deploy, not plain LAN HTTP.

Storage honesty: an installed PWA's IndexedDB is exempt from Safari's 7-day
inactivity purge, but iOS may still evict site data under storage pressure and
the iCloud-backup story is weaker than a native app container. Mitigations:
`navigator.storage.persist()` requested at install (not guaranteed on iOS), plus
the JSON export/import in §10 as the real backup path. Data volume is tiny (text
rows), quota is not a concern.

Rejected alternatives:
- **Native SwiftUI + SwiftData** — no Mac; hard precondition unmet.
- **Expo + EAS cloud build** — still needs an Apple account + signing path for
  real-device installs; cross-platform overhead with no current need.
- **Free provisioning / sideloading from Linux** — 7-day signature expiry, weekly
  reinstall; fatal for the habit.

- UI copy in Polish; code, comments, filenames in English (per CLAUDE.md).

## 3. Architecture

Single-page app, plain Svelte components + Dexie `liveQuery` (no separate
view-model layer in v1). Folder-level separation mirrors the domain:

- `src/lib/models/` — TypeScript types, Dexie schema, domain queries.
- `src/lib/tasklist/` — master list and daily list screens, task editor, quick-add.
- `src/lib/calendar/` — day/week event views, event editor.
- `src/lib/review/` — daily review flow (the habit entry point).
- `src/lib/strategies/` — five-step problem form wizard, task breakdown wizard.
- `src/lib/reminder/` — onboarding setup of the OS-level daily reminder (§7).
- `src/lib/design/` — colors, typography, copy constants (Polish strings in one file).

### Data flow

The daily list is a computed query, not a separate table. **"Today" is the local
calendar day (midnight boundary)** — a deliberate, simple v1 decision; a
configurable night-owl boundary is a v2 candidate.

The daily list has two parts, both derived by query:

```
active(today)    = tasks where dateCompleted == null
                   AND scheduledDate != null
                   AND scheduledDate <= today
doneToday(today) = tasks where dateCompleted falls within today
```

A task with `scheduledDate == null` lives only on the master list; assigning a day
puts it on that day's list. Overdue uncompleted tasks match `active` on every
following day, so rollover is a query result, not a mutation — no daily copy job,
no duplicates on the master list.

**Rendering rule (feeds §6 collapse logic):** the A/B/C sections contain **active
tasks only**; `doneToday` renders as one separate strip below the sections
(positive framing per §8). "Non-empty" in §6 always means "has active tasks" — a
fully completed A section counts as empty and un-collapses B.

## 4. Data model (Dexie / IndexedDB)

Fields are the protocol template (slide 22) plus justified extensions only.

```ts
type Priority = 'a' | 'b' | 'c';

interface Task {
  id: string;                // uuid
  title: string;
  priority: Priority;        // required at creation (one-tap choice, §5)
  categoryId?: string;       // optional user-defined category ("dom", "praca")
  dateAdded: string;         // ISO date, set on creation, shown as "na liście od"
  dateCompleted?: string;    // ISO datetime; set = completed; task stays in DB
  scheduledDate?: string;    // ISO date, day precision; absent = master list only
  scheduledTime?: string;    // optional HH:mm when put into the calendar
  parentId?: string;         // set = step of a broken-down task
  sortOrder: number;         // order within priority section
}

interface Category { id: string; name: string; }

interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;          // ISO datetime, required
  endsAt?: string;
  note?: string;
}

interface ProblemForm {
  id: string;
  problem: string;           // 1-2 sentences, enforced by UI hint
  createdAt: string;
  chosenSolutionId?: string;
}

interface Solution {
  id: string;
  formId: string;
  text: string;
  pros: string[];
  cons: string[];
  rating: number;            // 1-10
}
```

Dexie tables: `tasks`, `categories`, `events`, `problemForms`, `solutions`.
Schema versioning via Dexie `version(n).stores(...)` migrations; schema v1 frozen
after first real deployment.

**Parent semantics (decision):** a task with children becomes a **container**, not
an actionable item. Containers are excluded from the master list's actionable view
(no double-counting of work) and shown as a group header over their steps. A
container auto-completes (`dateCompleted` set) when its last step completes; it
never carries its own `scheduledDate`. Steps are ordinary tasks on the master
list, per the protocol (steps go onto the master list). Edge rules:

- Breaking down a task that already has `scheduledDate`: the date is cleared when
  it becomes a container; the breakdown UI says so.
- Adding a new step to an auto-completed container re-opens it
  (`dateCompleted` cleared).
- Hard-deleting a container cascades to its steps after one confirmation that
  names the step count.
- Nested breakdown (splitting a step further) is allowed — the protocol endorses
  splitting further; one level of visual indent is enough for v1.

Deletion policy: `Task` soft-completes via `dateCompleted`. Hard delete exists only
as an explicit swipe action with confirmation; completed tasks are hidden behind an
archive/history view, never purged automatically.

## 5. Core flows

**Daily review (habit anchor).** Opens from the OS reminder (§7) or app icon.
Single screen: today's events + daily list grouped A/B/C + done-today strip, then
actions: mark done, change priority, move to a specific day, break down. Empty day
shows neutral, encouraging copy (no streaks, no shame). The day-view block on this
screen shows calendar events only (`tasks="none"`) — today's tasks render once, on
the daily list, so nothing appears twice.

**Quick capture.** Source material requires capturing tasks the moment they come
up. Quick-add is therefore: title field + **three large A/B/C buttons (mandatory
single tap)** — priority stays required by rule, but costs one tap. Category and
scheduling are optional, later, from the task editor.

**Task lifecycle.** Create on master list (title + priority) -> appears on the
daily list when `scheduledDate <= today` -> complete via checkbox (sets
`dateCompleted`, stays visible in the done-today strip, moves to history at day
end).

**Rollover.** Automatic by query (see §3). A "przełóż na jutro" one-tap action sets
`scheduledDate = tomorrow` for users who prefer explicit moves. Overdue items are
labeled neutrally ("z wcześniejszych dni"), never as failure.

**Calendar.** Day and week list views (not a grid month view in v1). Events have
date+time, optional end, optional note. A task joins the calendar by setting
`scheduledDate` (+ optional `scheduledTime`). **Calendar day view rule (precise):
day view for day D shows events on D plus tasks with `scheduledDate == D`, EXCEPT
tasks that are incomplete and D < today — those exist only on the daily list until
re-scheduled.** Completed tasks remain visible on their scheduled day (proof of
work).

**Five-step form wizard.** Five screens: problem -> brainstorm solutions (any
number) -> pros/cons per solution -> rating 1-10 per solution -> summary with
best-rated solution highlighted; user confirms or picks the next highest-rated.
Confirmed solution can spawn a task or a breakdown.

**Task breakdown.** From any task: "podziel na kroki". Steps become child tasks on
the master list; each step must pass the one-day test via a UI prompt. Only one
step at a time is encouraged onto the daily list (UI hint, not a hard block). The
parent becomes a container (see §4).

## 6. Priority enforcement (hard rule)

The protocol's golden rule (all A, then all B, then all C; no skipping) is enforced
structurally, not just visually:

- Daily list renders three fixed sections: A, B, C, in that order (active tasks
  only; done-today lives in its own strip, §3).
- **B and C sections are collapsed by default while any higher-priority section is
  non-empty** (non-empty = has active tasks); expanding one requires a deliberate
  tap. Firmer than visual muting, but not a punishment — no confirm dialogs when
  checking off a lower-priority task (a dialog would read as a reprimand).
- Drag-to-reorder works **within a section only**; moving a task across sections is
  a priority change, done via the explicit priority action, never by drag.
- Priority change is a one-tap action on the task (used during daily review to
  escalate C -> B -> A as deadlines approach).

## 7. Reminder (replaces native notifications)

iOS PWAs cannot schedule local notifications, and a Web Push server would
reintroduce a backend the protocol's simplicity rule argues against. v1 therefore
uses an **OS-level daily reminder, set up once during onboarding**:

- Onboarding screen "Przypomnienie" guides the user step-by-step to create ONE of
  (their choice, all zero-infrastructure):
  1. iOS Clock: daily repeating alarm labeled with the review habit, or
  2. iOS Calendar: daily repeating event with an alert, or
  3. iOS Shortcuts: Time-of-Day personal automation (runs without confirmation on
     iOS 17) showing a notification or opening the app URL.
- Default suggested time 9:00, but the screen asks the protocol's real question
  first: "at which fixed daily moment will you review? (e.g. morning coffee)" and
  the reminder is anchored to that.
- In-app: opening the app lands on the daily review screen (§5). No per-task
  reminders, no overdue nagging, no badges.
- Per-event alerts for calendar events: **not possible in v1 without push —
  consciously dropped.** Real appointments can additionally live in the system
  calendar if the user wants OS alerts for them.
- v2 candidate: optional Web Push daily reminder (VAPID; a cron-triggered
  serverless function with a generic payload — no therapy content leaves the
  device). Only if the OS-level reminder proves too weak in practice.

## 8. Tone and copy

- All UI strings Polish, centralized in `src/lib/design/strings.ts`.
- Onboarding: 3 screens max (why two tools -> set up the reminder -> add first
  task). No account, no tutorial walls.
- Forbidden: streak counters, "overdue" red badges framed as failure, any copy
  blaming the user. Completed-tasks history is framed positively ("tyle się udało").

## 9. Scope

v1: everything above.

Conscious cuts (recorded, not forgotten):
- **Weekly list level** — the source material mentions an optional weekly plan;
  cut for v1 simplicity (simplicity > completeness).
- Optional **second, evening glance** at the list — the material suggests it;
  candidate for later, not v1.
- **Therapist sharing** — the material mentions showing the list to the therapist;
  a screenshot (or the §10 JSON export) suffices for v1, no dedicated feature.
- **Per-event alerts** — dropped with the PWA decision (§7).
- **Drag-to-reorder within a section** — §6 allows it, v1 cuts it (mobile web drag
  is janky); within-section order is insertion order, priority change stays the
  explicit editor action.
- **Non-blocking error banner** for failed IndexedDB writes (§10) — cut; local
  write failures are near-nonexistent, writes are bare awaits in v1.
- **Read view of past problem forms** — forms are persisted, but v1 surfaces only
  the chosen solution (as a spawned task); listing old forms is a v2 candidate.
- **Clearing an assigned category** — v1 can set/overwrite a category, not unset it.

Out of scope v1 (candidates, not commitments): Web Push reminder (§7), stats
dashboard, configurable day boundary, home-screen widget and Apple Calendar
import (both impossible from a PWA — would require going native later), Android
layout polish (works by default, not tuned).

## 10. Error handling and backup

Local-only app; failure modes are data-layer ones. IndexedDB write failures
surface as a non-blocking banner with retry; no crash-on-error. If
`navigator.storage.persist()` is denied, the app continues silently (no nagging).

Backup: **manual JSON export/import** in settings — one file containing all
tables, versioned with the schema number. This is the answer to iOS storage
eviction risk and to phone loss; the onboarding's final screen mentions it once.
No cloud, no accounts.

## 11. Testing

- Unit (Vitest): priority ordering rule, section-collapse logic (non-empty =
  active), rollover query, done-today query, calendar day-view rule (§5),
  container auto-complete/re-open/cascade, breakdown one-day prompt logic,
  five-step rating selection, export/import round-trip.
- Migration: Dexie schema upgrade smoke test once schema v1 ships.
- E2E (Playwright, mobile viewport): three smoke flows — quick-add/schedule/
  complete a task; five-step wizard end-to-end; breakdown into steps.

## 12. Project structure (target)

```
app/
  index.html
  vite.config.ts            (vite-plugin-pwa: manifest + service worker)
  src/
    main.ts
    App.svelte              (hash router, screen shell, safe-area)
    lib/
      models/               (types.ts, db.ts, queries.ts)
      tasklist/             (MasterList.svelte, DailyList.svelte,
                             TaskEditor.svelte, QuickAdd.svelte)
      calendar/             (DayView.svelte, WeekView.svelte, EventEditor.svelte)
      review/               (DailyReview.svelte)
      strategies/           (ProblemFormWizard.svelte, BreakdownWizard.svelte)
      reminder/             (ReminderSetup.svelte)
      design/               (strings.ts, theme.css)
  tests/                    (unit + e2e)
```

App name chosen at scaffolding; not part of this design.

## 13. Repository note

Repository initialized with `git init` on 2026-08-27. `specs/` and `plans/` are
tracked; `docs/` stays gitignored (source material, local-only). Node/TS is
already covered by the existing `.gitignore`.

# Review v1: plans/2026-08-27-adhd-calendar-tasklist-pwa.md

Date: 2026-08-27
Reviewer role: senior product architect
Reviewed against: specs/2026-08-27-adhd-calendar-tasklist-ios-design.md (v3, PWA)
Environment claims verified on host: Node v24.14.0 ✓, npm 11.9.0 ✓, `app/` absent ✓,
git initialized but **zero commits** (see P0).

Verdict: **strong skeleton — right architecture (pure-function domain layer,
TDD ordering, explicit inter-task interfaces), but the self-review's "No gaps"
claim is false.** 3 high findings, ~9 medium. The plan implements roughly 80% of
spec v1 and silently drops the rest. Fix the H items and record-or-add the M
items before executing.

---

## HIGH

**H1. History/archive view is missing entirely.**
Spec §4: "completed tasks are hidden behind an archive/history view, never purged
automatically"; §8 frames history positively ("tyle się udało"); the protocol's
completion date is *proof of work* meant to be looked at. In the plan, a completed
task is visible only in the done-today strip until midnight — afterwards it exists
in IndexedDB but in **no UI whatsoever**. The core motivational artifact of the
protocol has no screen. Add a task: history view (e.g. reachable from Settings or
the master list; grouped by completion day, positive framing).

**H2. Task 18 puts real data on an ephemeral origin — future data loss.**
`cloudflared tunnel --url` gives a random `*.trycloudflare.com` subdomain. The PWA
installed from it is origin-bound: next tunnel session = new subdomain = **new
origin = empty IndexedDB** (and no update path for the cached app). Task 18 then
says "add 2–3 real tasks; tomorrow verify rollover" — real habit data on a
throwaway origin, while permanent hosting is declared out of scope. For a 3-month
daily-use tool this is a trap. Fix: permanent static hosting (Cloudflare/GitHub
Pages — spec §2 already names them) must be a plan task **before** the user
starts entering real tasks; the quick tunnel is fine for a smoke test only, with
an explicit "do not enter real data yet" warning.

**H3. Five-step wizard cannot spawn a task or breakdown.**
Spec §5: "Confirmed solution can spawn a task or a breakdown." Task 13's
`finish()` saves the form and closes. The protocol's whole point is that the
chosen solution becomes action; here it becomes a row no screen ever shows again
(no UI lists saved `problemForms` either). Add: after "Wybieram to", offer
"Dodaj jako zadanie" (prefilled quick-add / breakdown entry), and consider a
minimal list of past forms (or record the read-view as a conscious cut).

---

## MEDIUM

**M1. Containers become unreachable after creation.** MasterList renders a
container as a plain `<h3>` — no tap target. TaskEditor (the only path to
breakdown, delete, rename) opens only from actionable tasks and steps. Result:
you can never add a step to an existing container, rename it, or delete it — so
the container re-open rule (Task 6) and the cascade-delete confirm (Task 11) are
**dead code paths** for real containers. Make the container header tappable
(opens editor or at least "add step" / delete).

**M2. No undo for completion.** The ○ button completes instantly; the done strip
is inert text. A mis-tap is permanent (and pollutes proof-of-work history).
ADHD users mis-tap. Add un-complete (tap ✓ in the done strip clears
`dateCompleted`; if it auto-completed a container, re-open it).

**M3. Week view silently dropped.** Spec §5: "Day and week list views". Task 12
ships a day view with a date picker only. Implement or record as a cut in the
plan (and mirror in spec §9).

**M4. Drag-to-reorder within a section is missing.** Spec §6 defines it;
`sortOrder` exists but nothing ever sets it except breakdown steps. Implement
(within-section only, per spec) or record as a cut; if cut, say how order within
a section is determined (currently: insertion order).

**M5. Category UI is missing.** Spec §4/§5: category optional, assignable "from
the task editor". Plan has the `Category` type, table, and backup — and no way
to create or assign one. Implement in TaskEditor or record as a cut (then drop
the dead table from v1 backup expectations).

**M6. Master list is unsorted.** `actionableMasterTasks` filters but never sorts;
tasks render in insertion order with a priority letter prefix. The protocol
applies A/B/C to the master list too. Apply `sortedForDailyList` (or group into
A/B/C sections) in MasterList.

**M7. Import silently wipes the database.** Task 15 `importJson` does
`clear()` + `bulkAdd` inside a transaction with **no confirmation**. Importing an
old backup destroys newer data irreversibly. Add a confirm dialog stating the
replacement ("Zastąpić wszystkie dane zawartością kopii?").

**M8. Build-breaking Svelte syntax in Task 11.**
`{#each ['a', 'b', 'c'] as const as p}` — Svelte's `{#each}` grammar can't take a
TS `as const` inside the expression followed by `as p`; this fails to compile.
Use `{#each ['a', 'b', 'c'] as p}` with `const priorities: Priority[] = ['a','b','c']`
in the script instead. (Task 11's "Expected: BUILD SUCCEEDED" would not happen.)

**M9. E2E coverage is below spec §11.** Spec: three smoke flows including
"five-step wizard end-to-end" and "breakdown into steps". Task 17's wizard test
stops at step 3 (pros/cons visible), and there is **no breakdown e2e at all**.
Extend the wizard test to `finish()` and add a breakdown smoke.

---

## SMALL

- **S1.** `completeWithParent` is not recursive: completing the last step of a
  *nested* container auto-completes its parent but never the grandparent, even
  when everything under it is done. Walk up the `parentId` chain; add a test.
- **S2.** ProblemFormWizard: one shared `proText`/`conText` state is bound to
  every solution's input — typing mirrors across all solutions. Use per-solution
  input state. Also step 5 checks `nextBest(best, solutions)` against the FULL
  list, so after rejecting all candidates the UI dead-ends; check against
  `candidates`.
- **S3.** Deleting a plain (non-container) task skips confirmation
  (`ids.length > 1` guard). Spec §4 requires confirmation for every hard delete.
- **S4.** TaskEditor semantics are mixed: priority persists on tap, title/date
  persist on Save, and Cancel leaves the mutated title visible in the list until
  the next DB write (prop object mutated via `bind:value`). Make all edits
  commit on Save (or all instant), and don't bind directly into the live object.
- **S5.** E2E `beforeEach` fires `indexedDB.deleteDatabase` without awaiting it,
  while Dexie may hold an open connection — the delete can block and leak state
  between tests. Await deletion (and `db.close()` via page context) or reset via
  Dexie itself.
- **S6.** `reviewTime` is stored in localStorage and never used or shown. Either
  surface it in Settings ("Twoja pora przeglądu: 09:00" + re-show reminder
  instructions) or drop it.
- **S7.** QuickAdd opened from the "Dziś" screen creates a master-only task — it
  immediately "disappears" from the screen the user is on. Offer a "na dziś"
  toggle in QuickAdd (or schedule-today default when opened from the daily list).
- **S8.** Spec §10's non-blocking error banner is nowhere in the plan — all
  Dexie writes are bare `await`s. Record as a cut or add one minimal banner.
- **S9.** EventEditor accepts `endTime < startTime` (same-day end assumed, no
  validation).
- **S10.** The one-day test renders as one static line under all step inputs;
  spec wording is per-step ("each step must pass the one-day test via a UI
  prompt"). Borderline-acceptable as a hint; the *"only one step at a time onto
  the daily list"* encouragement (spec §5) is missing entirely.

**Spec-side note (for the spec author, not the plan):** spec §5 says "Category,
scheduling and notes are optional… from the task editor", but the §4 Task model
has no note field. Plan follows the model (no notes) — reconcile the spec
wording.

---

## P0 — before Task 1

Git has zero commits (init only). Task 1's commit stages only `app/`, so
CLAUDE.md, `.gitignore`, `specs/`, `plans/` would remain untracked forever.
First commit the repo baseline (`git add CLAUDE.md .gitignore specs plans &&
git commit`), then start Task 1. Verify `docs/` stays ignored in `git status`.

---

## What is good (keep as-is)

- **Domain rules as pure functions** under `models/`, unit-tested without a
  database; Dexie writes are thin wrappers. Best decision in the plan — every
  protocol rule (rollover-as-query, collapse, past-day rule, container edges,
  next-best solution) has a direct, deterministic test.
- TDD ordering (failing test → implement → pass → commit) with expected test
  counts per task; interfaces between tasks declared explicitly.
- `toISODate` local-day guard against the classic UTC-shift bug, noon-anchored
  date parsing, `sv-SE` trick in e2e.
- Icon generator is dependency-free and was pre-verified on the host; Node/npm
  versions claimed match the actual host.
- Collapse rule honors "manual expand overrides" without confirm dialogs —
  faithful to spec §6's no-reprimand stance.
- Self-review section exists at all (coverage map + type-consistency pass) —
  the right instinct, even though its "No gaps" conclusion is wrong.

## Suggested execution order after fixes

1. P0 baseline commit.
2. Apply M8 (syntax) + S1/S2 (logic) directly in the plan's code blocks.
3. Add tasks: history view (H1), permanent hosting before real data (H2),
   solution→task spawn (H3), container reachability (M1), undo (M2).
4. Decide implement-vs-cut for M3/M4/M5 and record the decision in plan AND spec §9.
5. Execute.

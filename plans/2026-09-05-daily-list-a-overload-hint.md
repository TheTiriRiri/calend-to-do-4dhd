# Daily List A-Overload Hint Implementation Plan

> **Revision v2 (2026-09-05).** Rewritten after `plans/2026-09-05-daily-list-a-overload-hint-review-v1.md`.
> All blocking findings (B-1..B-3), all Important findings (I-1..I-5) and all Minor findings (M-1..M-6)
> are applied. Decisions D-1 and D-2 are now recorded explicitly in the Spec block below instead of
> being made in passing — D-2 is still flagged for the user to confirm before Task 2 ships.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a quiet, non-blaming text hint in the A section of the daily list once more than 3 active A-priority tasks are on it, nudging the user to move some to tomorrow — without becoming the "overdue nagging" pattern the product explicitly forbids.

**Architecture:** One new pure domain function (`hasTooManyA`) in `models/queries.ts` that takes the **already-derived active list** and returns a verdict. `DailyList.svelte` holds that list today (`const active = $derived.by(...)` → `activeTasks($tasks ?? [])`), so the rule must not re-run `activeTasks` itself: a second pass would duplicate the container filter and the sort for no gain, and would need its own `now` parameter to stay correct across midnight. Passing `active` in gets the midnight rollover for free, because `active` already re-derives on `nowTick`. One new Polish string. One conditional `<p>` plus one scoped CSS rule in the existing A-section render. No new component, no new state, no schema change.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest (unit), Playwright (e2e). No new dependencies.

**Spec:** No separate spec file — this is a *bounded* change (existing screen, existing data) per the project's brainstorming skill. Decided in chat on 2026-09-05:

- **Signal.** The number of A-priority tasks in the daily list's *active* set — literally the list the A section renders, not a raw table count. B/C backlog never triggers it; future-dated and completed A tasks are excluded because `activeTasks` already excludes them.
- **Rollover counts (decision D-1, option 1).** A rolled-over A task counts exactly like one added today. Rationale: a backlog that keeps A tasks on the list *is* the overload case, not an exception to it. Known consequence, accepted: a user sitting on 4 stale A tasks sees this line every day until they clear or reschedule them. That is the boundary against spec §7's ban on overdue nagging, and it is why the line must stay a neutral statement with no colour, no icon, no count and no badge. If it ever reads as a standing reproach in real use, the fallback is option 2 — count only A tasks with `!isEarlierThanToday` — which keeps the hint for "I overloaded today" and stays silent about the backlog the list already annotates with "z wcześniejszych dni". Do not implement the third option that was considered (show once per day behind a session flag): it adds state this feature promised not to add.
- **Threshold.** Source constant, `> 3`. **This number is a product heuristic, not protocol.** The source material defines A as "do today or tomorrow" and gives no count anywhere. Not user-configurable — a Settings knob here is exactly the "perfect system trap" the material warns about.
- **Placement (decision D-2 — confirm before Task 2).** One 12px muted line between the A section heading and the first task row. Handoff 1c §3 (Sekcja A) shows heading → task rows and nothing between them, so this is an addition to the handoff, not something it specifies. The pattern itself already exists in the system (`master.oneStepHint`, a 12px muted line under a frame title on screen 2a) — but note that `MasterList.svelte` is **pre-sweep markup** and will be rewritten by the 2a–2g sweep, so cite it as proof that the pattern is admissible, never copy its CSS. The handoff is the visual authority for this product. **Ask the user (or the designer) to confirm the placement before Task 2 is committed;** the whole change is one `{#if}` block and one CSS rule, so moving it later is cheap.
- **Copy.** `strings.dailyList.manyA` = `'Sporo w A na dziś — część może zaczekać do jutra.'` A *statement*, not a question, not a command, not a warning. No icon, no colour change, no dismiss button; it appears and disappears purely as a function of the count. (If the user prefers a question, `'Sporo w A na dziś. Coś może zaczekać do jutra?'` is the alternative that was on the table — copy is the user's call, but whichever ships, this bullet must describe it.)
- **Record.** One sentence in the CLAUDE.md "Domain" section, so the next reader can tell this is a deliberate heuristic rather than a stray feature. A matching line in spec §6 is the user's edit, not this plan's.

## Global Constraints

- Domain rules are pure functions in `app/src/lib/models/`, unit-tested without a database. New rules go into `models/` with a unit test first — never inline the threshold logic in the `.svelte` file.
- User-facing UI copy is Polish and lives **only** in `app/src/lib/design/strings.ts`.
- No linter/formatter is configured. Style is whatever `svelte-check` + `tsc` accept: 2-space indent, single quotes, semicolons, trailing commas.
- Commits: **one sentence, nothing else.** Conventional prefix (`feat:`, `test:`, `docs:`), no body, no bullet list, no `Co-Authored-By` trailer, no Claude/Anthropic attribution.
- Domain rule this feature must not violate: no red "overdue" badges framed as failure, no copy blaming the user, no confirm dialogs for benign actions, no heavy configuration — the threshold is a source constant, not a Settings option.
- Working directory for every `npm` command below is `app/`.
- `app/tests/unit/**/*.test.ts` run in a node environment with no database (Vitest). `app/tests/e2e/*.spec.ts` run against a real build via Playwright (chromium locally by default).
- **Never quote a whole file line from CLAUDE.md and paste it back.** The "Current state" line changes under almost every commit; Task 4 edits the numbers in place. Likewise, every code anchor below is given as *text to search for*, never as a line number — the files move.

---

### Task 1: `hasTooManyA` domain rule + unit tests

**Files:**
- Modify: `app/src/lib/models/queries.ts`
- Modify: `app/tests/unit/queries.test.ts`

**Interfaces:**
- Consumes: `Task` from `./types`. (Not `Priority` — the function compares a string literal and needs no import for it.)
- Produces: `export const A_COMFORT_LIMIT: number` and `export function hasTooManyA(active: readonly Task[]): boolean` — both consumed by Task 2.
- **Contract:** the argument is the output of `activeTasks()`. The function does no filtering of its own beyond the priority letter; excluding completed, future and container tasks is `activeTasks`' job and is already unit-tested there.

- [ ] **Step 1: Write the failing unit tests**

Add `hasTooManyA` to the **existing** import list from `'../../src/lib/models/queries'` at the top of `app/tests/unit/queries.test.ts` — alphabetically, between `doneTodayTasks` and `isContainer`. Do not retype the list: it already imports `completedByDay` and others, and a pasted replacement would drop them and break the whole suite with a `ReferenceError`.

Add this new `describe` block right after the existing `describe('activeTasks', ...)` block, before `describe('doneTodayTasks', ...)`:

```ts
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
```

Each of the first three cases sits exactly at its own boundary and fails against a wrong implementation on its own. The last two are composition locks over `activeTasks()` and are the only ones that need dates: the fourth proves future and completed A tasks stay out, the fifth proves rolled-over ones stay in. Without the fifth, decision D-1 would be written down but never executed — a future "fix" that silently switched to option 2 would keep the whole suite green.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm run test:unit -- --run`
Expected: FAIL — `hasTooManyA` is not exported from `../../src/lib/models/queries`.

- [ ] **Step 3: Implement `hasTooManyA`**

In `app/src/lib/models/queries.ts`, add this immediately after the `activeTasks` function, before `doneTodayTasks`:

```ts
/** Product heuristic, not protocol: the material defines A as "today or tomorrow"
 *  and sets no count. Deliberately a source constant — a Settings knob here is the
 *  "perfect system trap". */
export const A_COMFORT_LIMIT = 3;

/** True once more than A_COMFORT_LIMIT A tasks sit on today's list — a nudge to move
 *  some to tomorrow, never a hard limit and never a blocking rule.
 *  Takes activeTasks() output: the caller already holds that list. */
export function hasTooManyA(active: readonly Task[]): boolean {
  return active.filter((t) => t.priority === 'a').length > A_COMFORT_LIMIT;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm run test:unit -- --run`
Expected: PASS, **83 tests** (78 existing on `ff35163` + 5 new). If the existing count has moved because something else landed, use the real number everywhere below.

- [ ] **Step 5: Type-check**

Run: `cd app && npm run check`
Expected: 0 errors (15 pre-existing `state_referenced_locally` warnings are fine and unrelated).

- [ ] **Step 6: Commit**

```bash
cd /home/kkopec/projects/calend-to-do-4dhd
git add app/src/lib/models/queries.ts app/tests/unit/queries.test.ts
git commit -m "feat: add hasTooManyA rule for the daily list A section"
```

---

### Task 2: Copy + the hint in `DailyList.svelte`

One commit: the string exists only to be rendered by this markup, and the repo's cadence is one commit per rule-plus-its-UI (see `1fead71`).

**Files:**
- Modify: `app/src/lib/design/strings.ts`
- Modify: `app/src/lib/tasklist/DailyList.svelte`

**Interfaces:**
- Produces: `strings.dailyList.manyA: string`.
- Consumes: `hasTooManyA` from `../models/queries` (Task 1).

- [ ] **Step 1: Add the string**

In `app/src/lib/design/strings.ts`, inside the `dailyList` object, after the `sectionNameC: 'Na później',` line:

```ts
    sectionNameC: 'Na później',
    manyA: 'Sporo w A na dziś — część może zaczekać do jutra.',
```

- [ ] **Step 2: Import `hasTooManyA`**

In the existing `../models/queries` import in `DailyList.svelte`, add it alphabetically:

```ts
  import { activeTasks, doneTodayTasks, hasTooManyA, isEarlierThanToday, priorityRank } from '../models/queries';
```

- [ ] **Step 3: Add the `tooManyA` derived value**

Immediately after the `const nonEmpty = $derived(new Set(active.map((t) => t.priority)));` line:

```ts
  const tooManyA = $derived(hasTooManyA(active));
```

Plain `$derived`, not `$derived.by` with `void nowTick`: `active` already re-derives on the tick, so the midnight rollover is inherited.

- [ ] **Step 4: Render the hint under the A section heading**

Inside the `{#each sections as { p, letter, name } (p)}` block, directly after the `<h3 class="section-head" ...>` line:

```svelte
          <h3 class="section-head" aria-label="{letter} {name}"><span class="letter" aria-hidden="true">{letter}</span>{name}</h3>
          {#if p === 'a' && tooManyA}
            <p class="muted hint">{strings.dailyList.manyA}</p>
          {/if}
          {#each list as task (task.id)}
```

- [ ] **Step 5: Add the CSS rule**

New CSS **is** required — do not reuse `.note`. `.note` is `display: block; font-size: 12px;` and resets no margin, because its only current use is a `<span>` inside the title button, where the browser's default `<p>` margin never applies. On a real `<p>` in the section's flex column, the UA's `1em` top and bottom margins survive (flex items do not collapse margins) and would open ~24px of unplanned space between the heading and the first row. Add next to `.note` in the component's `<style>`:

```css
  /* a real <p>, unlike .note's <span>: the UA margin has to go, and the section's
     4px flex gap owns the spacing */
  .hint { margin: 0; font-size: 12px; }
```

`.muted` (global, `theme.css`) supplies `--color-neutral-600`. 12px is safe here — `theme.spec.ts`'s 16px floor applies to focusable form fields only, and this screen already ships 12px text.

- [ ] **Step 6: Type-check**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 7: Manual smoke check**

Run `cd app && npm run dev`, open the app, set `localStorage.onboarded = '1'` and reload. Quick-add sets priority only — it does not schedule — so for each of 4 tasks: add it with priority A on `#/lista`, open it, set the "Dzień" field to today, save. Then go to `#/` and confirm the hint sits under the A heading with no extra gap; mark one done and confirm it disappears.

- [ ] **Step 8: Commit**

```bash
cd /home/kkopec/projects/calend-to-do-4dhd
git add app/src/lib/design/strings.ts app/src/lib/tasklist/DailyList.svelte
git commit -m "feat: show a gentle hint when too many A tasks pile up today"
```

---

### Task 3: E2e coverage

**Files:**
- Modify: `app/tests/e2e/daily-actions.spec.ts`

**Interfaces:**
- Consumes: the existing `addTaskScheduledToday(page, title, priority)` helper at the top of this file, widened to `addTaskScheduled(page, title, priority, daysAgo = 0)`.

**Widen the helper first.** It hard-codes today's date (`new Date().toLocaleDateString('sv-SE')`). Add a fourth parameter with a default so every existing call site keeps working unchanged, and rename it to match what it now does:

```ts
async function addTaskScheduled(page: import('@playwright/test').Page, title: string, priority: 'A — dziś/jutro' | 'B — częściowo pilne' | 'C — może poczekać', daysAgo = 0) {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  // ... unchanged, except the "Dzień" fill uses day.toLocaleDateString('sv-SE')
}
```

Rename the 10 existing call sites in this file in the same commit — `sed -i 's/addTaskScheduledToday(/addTaskScheduled(/g' app/tests/e2e/daily-actions.spec.ts` covers the definition and every call.

**Do not run that `sed` across `app/tests/e2e/`.** `theme.spec.ts` defines its own *independent copy* of the same helper (its own `async function addTaskScheduledToday`, three call sites). It is a separate local function, not an import, so this change does not reach it and it must keep the name it has. Widening one copy and renaming the other is how a spec file starts failing for reasons nobody can find.

- [ ] **Step 1: Write the e2e test**

Add at the end of `app/tests/e2e/daily-actions.spec.ts`, after the last existing `test(...)` block. Task titles share no prefix on purpose: the helper clicks with `page.getByText(title)`, which is substring-matched, so `'A raz'`-style names collide the moment anything longer starts with the same letters.

```ts
test('a 4th active A task shows the overload hint, which clears once one is done', async ({ page }) => {
  const hint = page.getByText('Sporo w A na dziś — część może zaczekać do jutra.');

  // 'Pranie' is dated two days back: it proves decision D-1 end to end (a rolled-over
  // A task counts) and asserts the "z wcześniejszych dni" badge, which had no e2e at
  // all until now — QA open item 2.1
  await addTaskScheduled(page, 'Pranie', 'A — dziś/jutro', 2);
  await addTaskScheduled(page, 'Kot', 'A — dziś/jutro');
  await addTaskScheduled(page, 'Rachunki', 'A — dziś/jutro');
  await page.goto('/');
  await expect(page.getByText('z wcześniejszych dni')).toBeVisible();
  await expect(hint).toBeHidden();

  await addTaskScheduled(page, 'Zakupy', 'A — dziś/jutro');
  await page.goto('/');
  await expect(hint).toBeVisible();

  await page.getByRole('button', { name: 'oznacz jako zrobione' }).first().click();
  await expect(hint).toBeHidden();
});
```

The 3-task assertion is what makes the test falsifiable in both directions: without it, an implementation that always shows the hint would still pass. `.first()` on the done button is safe even though `newTask` can hand two tasks the same `sortOrder` when they land in the same millisecond (QA open item 2.3): the row order may be unstable, but completing *any* A task drops the count to 3.

- [ ] **Step 2: Run the e2e suite**

Run: `cd app && npm run test:e2e`
Expected: all pass, including the new one (chromium). Then run `npm run test:e2e:docker` for the chromium + webkit bar this repo tracks, if Docker is available — remember it needs the `--user` flag or it root-owns `node_modules/` and `dist/` on the host.

- [ ] **Step 3: Commit**

```bash
cd /home/kkopec/projects/calend-to-do-4dhd
git add app/tests/e2e/daily-actions.spec.ts
git commit -m "test: cover the daily list A-overload hint appearing and clearing"
```

---

### Task 4: Record the rule and the counts in CLAUDE.md

**Files:**
- Modify: `/home/kkopec/projects/calend-to-do-4dhd/CLAUDE.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Record the rule itself**

Without this, the only trace of the feature after merge is a constant in `queries.ts`, and the next reader who meets the hint in the UI cannot tell whether it is protocol, heuristic or bug. In the **"Domain: what this product must enforce"** section, under the **A/B/C priorities** bullet list, add one bullet:

> - A soft, non-blocking hint appears in the daily list's A section once more than 3 active A tasks sit on it (`hasTooManyA` / `A_COMFORT_LIMIT` in `queries.ts`). The threshold is a **product heuristic, not from the material** — the material defines A as "today or tomorrow" and sets no count. Rolled-over A tasks count. Deliberately not user-configurable, and deliberately a neutral statement with no colour, icon or badge, so it stays a nudge and not the overdue nagging the protocol forbids.

- [ ] **Step 2: Edit the counts in place**

Find the `Current state:` line and change **only the numbers and the flow list** — do not replace the sentence wholesale, it names flows that were added after this plan was written (the expansion-close rule, the `pre-sweep.spec.ts` locks, the per-route theme invariants) and a pasted line would delete them.

- unit tests: `78` → `83`
- e2e flows: `58` → `59`
- green runs: `116` → `118` (chromium + webkit each run the new flow)
- insert `the daily list's gentle hint when too many A tasks pile up,` into the existing parenthetical, after `a scheduled container staying off the daily list,`

Verify the unit number first: `cd app && npm run test:unit -- --run` must print `83 passed (83)`. If another change landed in parallel, use the real number.

Note: the "e2e flows" count is a hand-maintained prose count of *named* flows, **not** the number of Playwright `test(...)` blocks — several blocks sit behind one named flow (`pre-sweep.spec.ts` alone holds a dozen). Do not re-derive it with `grep`; increment by 1.

- [ ] **Step 3: Commit**

```bash
cd /home/kkopec/projects/calend-to-do-4dhd
git add CLAUDE.md
git commit -m "docs: record the A-overload hint rule and bump the test counts"
```

---

## Relationship to `plans/2026-09-05-qa-open-items.md`

That document is a **product-wide QA register** — manual iPhone checks, automation gaps, one
open flake investigation, the redesign-sweep order, versioning, and the list of things
deliberately not built. It is not an implementation plan and must not be merged into this
one: folding a six-section backlog into a one-feature plan would bury both.

Two of its items genuinely overlap this feature and **are** folded in above:

| QA item | Where it landed | Why here |
|---|---|---|
| 2.1 — the "z wcześniejszych dni" badge has no e2e, unit only | Task 3, the backdated `'Pranie'` task | decision D-1 needs a rolled-over A task on screen anyway, and that is exactly the state 2.1 asks for — one flow, both assertions, no extra fixture |
| 2.3 — `newTask` can repeat `sortOrder` inside one millisecond | Task 3, a note under the test | it makes row order unstable, so the plan states why `.first()` is still safe instead of leaving a future reader to wonder |

Everything else in that register stays out, and this feature does not change it:

- **2.2 (DST), 2.4 (axe), 2.5 (`svelte:boundary`)** — unrelated code paths. 2.4 would pass over
  the new markup regardless: a `<p>` of static text adds no a11y surface.
- **Section 1, the manual device checks** — none are affected. Add the hint to 1.9's overnight
  check as a free observation if convenient, but do not turn it into a step.
- **Section 3, the category-prefill flake** — unrelated screen (`TaskEditor`).
- **Section 4, the redesign sweep** — `DailyList` is screen 1c and already swept, so this
  change does not touch the sweep's scope. It does not need a `pre-sweep.spec.ts` lock either:
  those locks exist for screens that have *not* been redesigned yet. `theme.spec.ts` already
  covers `#/`, and the new 12px line passes its 16px rule, which applies to focusable fields
  only.
- **Section 5, versioning** — tag the deploy, not the feature. Out of scope here.
- **Section 6, deliberately not doing** — worth re-reading before Task 2 as a tone check: the
  hint sits one bad decision away from the "overdue badge framed as failure" that list forbids.
  That is what decision D-1's constraints are protecting.

After this plan lands, cross 2.1 off the QA register and note that 2.3 is still open.

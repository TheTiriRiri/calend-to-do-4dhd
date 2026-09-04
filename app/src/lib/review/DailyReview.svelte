<script lang="ts">
  import type { CalendarEvent, Task } from '../models/types';
  import { strings } from '../design/strings';
  import { shortDate } from '../design/format';
  import DayView from '../calendar/DayView.svelte';
  import EventEditor from '../calendar/EventEditor.svelte';
  import DailyList from '../tasklist/DailyList.svelte';
  import TaskEditor from '../tasklist/TaskEditor.svelte';
  import QuickAdd from '../tasklist/QuickAdd.svelte';
  import BreakdownWizard from '../strategies/BreakdownWizard.svelte';
  import ProblemFormWizard from '../strategies/ProblemFormWizard.svelte';

  let editing = $state<Task | null>(null);
  let editingEvent = $state<CalendarEvent | null>(null);
  let breaking = $state<Task | null>(null);
  let problemForm = $state(false);
  let adding = $state(false);
  // recompute "today" when the app returns to foreground — otherwise the review
  // screen stays frozen at mount across midnight
  let nowTick = $state(0);
  const today = $derived.by(() => {
    void nowTick;
    return new Date();
  });
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

<main class="review">
  <header>
    <h1>{strings.review.title}</h1>
    <span class="date">{shortDate(today)}</span>
  </header>

  <!-- tasks="none": the daily list below already shows today's tasks (spec §5) -->
  <DayView day={today} tasks="none" tail="restFree" onedit={(e) => (editingEvent = e)} />
  <DailyList onedit={(t) => (editing = t)} />

  <div class="actions">
    <button class="btn btn-primary blueprint add" onclick={() => (adding = true)}>
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      {strings.dailyList.addTask}
    </button>
    <button class="btn btn-ghost" onclick={() => (problemForm = true)}>{strings.review.problemFormEntry}</button>
  </div>

  {#if adding}
    <div class="overlay">
      <QuickAdd defaultToday onclose={() => (adding = false)} />
    </div>
  {/if}
  {#if editing}
    <div class="overlay">
      <TaskEditor task={editing} onclose={() => (editing = null)} onbreakdown={(t) => { breaking = t; editing = null; }} />
    </div>
  {/if}
  {#if editingEvent}
    <div class="overlay">
      <EventEditor event={editingEvent} onclose={() => (editingEvent = null)} />
    </div>
  {/if}
  {#if breaking}
    <div class="overlay">
      <BreakdownWizard parent={breaking} onclose={() => (breaking = null)} />
    </div>
  {/if}
  {#if problemForm}
    <div class="overlay">
      <ProblemFormWizard onclose={() => (problemForm = false)} />
    </div>
  {/if}
</main>

<style>
  /* one column, actions pinned to the bottom above the tabbar. body already
     carries padding-top: safe-area, so a bare 100dvh would always overflow by
     that much and the page would scroll even when short */
  .review {
    display: flex; flex-direction: column; gap: 18px;
    min-height: calc(100dvh - env(safe-area-inset-top));
  }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  header h1 { margin: 0; }
  .date {
    font-size: 13px; color: var(--color-neutral-700);
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .actions { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
  .add { width: 100%; min-height: 48px; }
</style>

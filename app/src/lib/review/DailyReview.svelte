<script lang="ts">
  import type { CalendarEvent, Task } from '../models/types';
  import { strings } from '../design/strings';
  import DayView from '../calendar/DayView.svelte';
  import EventEditor from '../calendar/EventEditor.svelte';
  import DailyList from '../tasklist/DailyList.svelte';
  import TaskEditor from '../tasklist/TaskEditor.svelte';
  import BreakdownWizard from '../strategies/BreakdownWizard.svelte';
  import ProblemFormWizard from '../strategies/ProblemFormWizard.svelte';

  let editing = $state<Task | null>(null);
  let editingEvent = $state<CalendarEvent | null>(null);
  let breaking = $state<Task | null>(null);
  let problemForm = $state(false);
  // recompute "today" when the app returns to foreground — otherwise the review
  // screen stays frozen at mount across midnight
  let nowTick = $state(0);
  const today = $derived.by(() => {
    void nowTick;
    return new Date();
  });
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

<main>
  <h1>{strings.review.title}</h1>
  <!-- tasks="none": the daily list below already shows today's tasks (spec §5) -->
  <DayView day={today} tasks="none" tail="restFree" onedit={(e) => (editingEvent = e)} />
  <DailyList onedit={(t) => (editing = t)} />
  <button class="muted" onclick={() => (problemForm = true)}>{strings.review.problemFormEntry}</button>

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

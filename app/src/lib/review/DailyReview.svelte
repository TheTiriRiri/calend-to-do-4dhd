<script lang="ts">
  import type { Task } from '../models/types';
  import { strings } from '../design/strings';
  import DayView from '../calendar/DayView.svelte';
  import DailyList from '../tasklist/DailyList.svelte';
  import TaskEditor from '../tasklist/TaskEditor.svelte';
  import BreakdownWizard from '../strategies/BreakdownWizard.svelte';
  import ProblemFormWizard from '../strategies/ProblemFormWizard.svelte';

  let editing = $state<Task | null>(null);
  let breaking = $state<Task | null>(null);
  let problemForm = $state(false);
</script>

<main>
  <h1>{strings.review.title}</h1>
  <DayView day={new Date()} />
  <DailyList onedit={(t) => (editing = t)} />
  <button class="muted" onclick={() => (problemForm = true)}>{strings.review.problemFormEntry}</button>

  {#if editing}
    <TaskEditor task={editing} onclose={() => (editing = null)} onbreakdown={(t) => { breaking = t; editing = null; }} />
  {/if}
  {#if breaking}
    <BreakdownWizard parent={breaking} onclose={() => (breaking = null)} />
  {/if}
  {#if problemForm}
    <ProblemFormWizard onclose={() => (problemForm = false)} />
  {/if}
</main>

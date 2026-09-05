<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Task } from '../models/types';
  import { isContainer, masterListSections } from '../models/queries';
  import { strings } from '../design/strings';
  import QuickAdd from './QuickAdd.svelte';

  let { onedit }: { onedit: (task: Task, container?: boolean) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let adding = $state(false);
</script>

<main>
  <h1>{strings.tabs.master}</h1>
  {#if $tasks}
    {@const { sections, loose } = masterListSections($tasks)}
    {#each sections as { container, steps } (container.id)}
      <section class="sheet">
        <h3><button class="container-header" onclick={() => onedit(container, true)}>{container.title}</button></h3>
        <p class="muted">{strings.master.oneStepHint}</p>
        <ul>
          {#each steps as step (step.id)}
            <!-- a finished step keeps its row and shows the tick (handoff 2a) -->
            <li data-done={step.dateCompleted ? 'true' : null}>
              <button class="muted" onclick={() => onedit(step, isContainer(step, $tasks))}>
                {#if step.dateCompleted}<span aria-hidden="true">✓</span>{/if}
                {step.title}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
    <ul>
      {#each loose as task (task.id)}
        <li>
          <button onclick={() => onedit(task)}>
            <strong>{task.priority.toUpperCase()}</strong> {task.title}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <button onclick={() => (adding = true)}>{strings.common.add}</button>
  <a href="#/historia" class="muted">{strings.master.historyLink}</a>
  {#if adding}<QuickAdd onclose={() => (adding = false)} />{/if}
</main>

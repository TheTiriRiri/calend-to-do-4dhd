<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Task } from '../models/types';
  import {
    actionableMasterTasks,
    childrenOf,
    isContainer,
    sortedForDailyList,
  } from '../models/queries';
  import { strings } from '../design/strings';
  import QuickAdd from './QuickAdd.svelte';

  let { onedit }: { onedit: (task: Task, container?: boolean) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let adding = $state(false);
</script>

<main>
  <h1>{strings.tabs.master}</h1>
  {#if $tasks}
    {#each $tasks.filter((t) => isContainer(t, $tasks) && !t.dateCompleted) as parent (parent.id)}
      <section class="sheet">
        <h3><button class="container-header" onclick={() => onedit(parent, true)}>{parent.title}</button></h3>
        <p class="muted">{strings.master.oneStepHint}</p>
        <ul>
          {#each childrenOf(parent, $tasks).filter((s) => !s.dateCompleted) as step (step.id)}
            <li><button class="muted" onclick={() => onedit(step)}>{step.title}</button></li>
          {/each}
        </ul>
      </section>
    {/each}
    <ul>
      {#each sortedForDailyList(actionableMasterTasks($tasks)) as task (task.id)}
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

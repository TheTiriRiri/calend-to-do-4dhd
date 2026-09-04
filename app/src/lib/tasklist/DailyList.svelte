<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Priority, Task } from '../models/types';
  import { activeTasks, doneTodayTasks, isEarlierThanToday } from '../models/queries';
  import { isCollapsed } from '../models/collapse';
  import { completeWithParent, uncompleteWithParent } from '../models/completion';
  import { moveToNextDay } from '../models/schedule';
  import { strings } from '../design/strings';
  import QuickAdd from './QuickAdd.svelte';

  let { onedit }: { onedit: (task: Task) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let manuallyExpanded = $state<ReadonlySet<Priority>>(new Set());
  let adding = $state(false);
  // day-dependent deriveds re-run when the app returns to foreground —
  // otherwise "today" stays frozen at mount across midnight
  let nowTick = $state(0);

  const active = $derived.by(() => {
    void nowTick;
    return activeTasks($tasks ?? []);
  });
  const doneToday = $derived.by(() => {
    void nowTick;
    return doneTodayTasks($tasks ?? []);
  });
  const nonEmpty = $derived(new Set(active.map((t) => t.priority)));
  const now = $derived.by(() => {
    void nowTick;
    return new Date();
  });

  const sections: { p: Priority; title: string }[] = [
    { p: 'a', title: strings.dailyList.sectionA },
    { p: 'b', title: strings.dailyList.sectionB },
    { p: 'c', title: strings.dailyList.sectionC },
  ];

  function expand(p: Priority) {
    manuallyExpanded = new Set(manuallyExpanded).add(p);
  }
  async function onComplete(task: Task) {
    await db.tasks.bulkPut(completeWithParent(task, $tasks ?? []));
  }
  async function onUncomplete(task: Task) {
    await db.tasks.bulkPut(uncompleteWithParent(task, $tasks ?? []));
  }
  async function onMove(task: Task) {
    moveToNextDay(task);
    await db.tasks.put(task);
  }
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

<section>
  {#if $tasks}
    {#if active.length === 0 && doneToday.length === 0}
      <p class="muted">{strings.dailyList.emptyState}</p>
    {/if}

    {#each sections as { p, title } (p)}
      {@const list = active.filter((t) => t.priority === p)}
      {#if list.length > 0}
        {#if isCollapsed(p, nonEmpty, manuallyExpanded)}
          <button class="section-collapsed" onclick={() => expand(p)}>{title} ({list.length}) ▸</button>
        {:else}
          <h3>{title}</h3>
          <ul>
            {#each list as task (task.id)}
              <li>
                <button aria-label={strings.dailyList.markDone} onclick={() => onComplete(task)}>○</button>
                <button onclick={() => onedit(task)}>{task.title}</button>
                {#if isEarlierThanToday(task, now)}<span class="muted">{strings.dailyList.earlierDays}</span>{/if}
                <button class="muted" onclick={() => onMove(task)}>{strings.dailyList.moveToTomorrow}</button>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    {/each}

    {#if doneToday.length > 0}
      <h3 class="muted">{strings.dailyList.doneToday}</h3>
      <ul class="muted">
        {#each doneToday as task (task.id)}
          <li>
            <button aria-label={strings.dailyList.undoDone} onclick={() => onUncomplete(task)}>✓</button> {task.title}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <button onclick={() => (adding = true)}>{strings.common.add}</button>
  {#if adding}<QuickAdd defaultToday onclose={() => (adding = false)} />{/if}
</section>

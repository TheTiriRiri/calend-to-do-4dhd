<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Priority, Task } from '../models/types';
  import { activeTasks, doneTodayTasks, isEarlierThanToday } from '../models/queries';
  import { isCollapsed } from '../models/collapse';
  import { completeWithParent, uncompleteWithParent } from '../models/completion';
  import { moveToNextDay } from '../models/schedule';
  import { strings } from '../design/strings';
  import { taskCount } from '../design/format';

  let { onedit }: { onedit: (task: Task) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let manuallyExpanded = $state<ReadonlySet<Priority>>(new Set());
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

  const sections: { p: Priority; letter: string; name: string }[] = [
    { p: 'a', letter: 'A', name: strings.dailyList.sectionNameA },
    { p: 'b', letter: 'B', name: strings.dailyList.sectionNameB },
    { p: 'c', letter: 'C', name: strings.dailyList.sectionNameC },
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
      <p class="muted empty">{strings.dailyList.emptyState}</p>
    {/if}

    <!-- open sections first, each in its own blueprint frame -->
    {#each sections as { p, letter, name } (p)}
      {@const list = active.filter((t) => t.priority === p)}
      {#if list.length > 0 && !isCollapsed(p, nonEmpty, manuallyExpanded)}
        <div class="blueprint section" data-priority={p}>
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <!-- aria-label: without it the inline spans read as "ANajważniejsze" -->
          <h3 class="section-head" aria-label="{letter} {name}"><span class="letter" aria-hidden="true">{letter}</span>{name}</h3>
          {#each list as task (task.id)}
            <div class="task-row">
              <button class="tap" aria-label={strings.dailyList.markDone} onclick={() => onComplete(task)}>
                <span class="box"></span>
              </button>
              <button class="title" onclick={() => onedit(task)}>
                {task.title}
                {#if isEarlierThanToday(task, now)}<span class="muted note">{strings.dailyList.earlierDays}</span>{/if}
              </button>
              <button class="tap move" aria-label={strings.dailyList.moveToTomorrow} onclick={() => onMove(task)}>
                {strings.dailyList.moveShort}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}

    <!-- collapsed sections sit together underneath, as two small tiles -->
    <div class="tiles">
      {#each sections as { p, letter } (p)}
        {@const list = active.filter((t) => t.priority === p)}
        {#if list.length > 0 && isCollapsed(p, nonEmpty, manuallyExpanded)}
          <button class="tile section-collapsed" data-priority={p} aria-label="{letter} {taskCount(list.length)}" onclick={() => expand(p)}>
            <span class="letter" aria-hidden="true">{letter}</span>{taskCount(list.length)}<span class="chevron" aria-hidden="true">▸</span>
          </button>
        {/if}
      {/each}
    </div>

    {#if doneToday.length > 0}
      <!-- one visual line, but still one <li> per task: daily-actions.spec.ts
           counts these to prove an auto-completed container is not listed -->
      <p class="done-label muted">{strings.dailyList.doneToday}{strings.dailyList.doneSeparator}</p>
      <ul class="muted done-list">
        {#each doneToday as task, i (task.id)}
          <li>
            {#if i > 0}<span aria-hidden="true">{strings.dailyList.doneListSeparator}</span>{/if}
            <button class="undo" aria-label={strings.dailyList.undoDone} onclick={() => onUncomplete(task)}>{task.title}</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .empty { font-size: 15px; color: var(--color-neutral-700); }

  .section { padding: 14px 14px 12px; margin: 6px 6px 0; display: flex; flex-direction: column; gap: 4px; }
  .section-head { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; margin: 0; font-size: 17px; }

  .letter {
    display: grid; place-items: center; flex: none;
    width: 24px; height: 24px;
    font-family: var(--font-heading); font-weight: 600; font-size: 14px;
  }
  [data-priority='a'] .letter { background: var(--color-accent-800); color: var(--color-bg); }
  [data-priority='b'] .letter { background: var(--color-accent-500); color: var(--color-bg); }
  [data-priority='c'] .letter { background: var(--color-accent-300); color: var(--color-accent-900); }
  .tile .letter { width: 22px; height: 22px; font-size: 13px; }

  .task-row { display: flex; align-items: center; border-top: 1px solid var(--color-divider); min-height: 44px; }
  /* 22px square for the eye, 44px button for the finger */
  .box { width: 22px; height: 22px; border: 1px solid var(--color-accent-700); }
  .title {
    flex: 1; text-align: left; font: inherit; font-size: 15px; color: inherit;
    background: none; border: none; padding: 10px 4px; min-height: 44px; cursor: pointer;
  }
  .note { display: block; font-size: 12px; }
  .move { font-size: 12px; color: var(--color-accent-700); }

  /* no :empty rule — Svelte's {#each} leaves an anchor node inside, and an
     empty flex div costs no height here anyway */
  .tiles { display: flex; gap: 8px; }
  .tile {
    flex: 1; display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; min-height: 44px;
    background: none; border: 1px solid var(--color-divider);
    font: inherit; font-size: 14px; color: var(--color-neutral-700); cursor: pointer;
  }
  .chevron { margin-left: auto; }

  .done-label { display: inline; font-size: 13px; padding-left: 6px; margin: 0; }
  .done-list { display: inline; font-size: 13px; padding: 0 6px 0 0; list-style: none; margin: 0; }
  .done-list li { display: inline; }
  /* a word inside a running sentence: padding grows the hit area to ~40px,
     the negative margin keeps the line box at 13px so the sentence stays one line */
  .undo {
    font: inherit; font-size: 13px; color: inherit;
    background: none; border: none; cursor: pointer;
    padding: 12px 4px; margin: -12px 0; min-height: 0; min-width: 0;
  }
</style>

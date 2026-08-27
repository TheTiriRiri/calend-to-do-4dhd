<script lang="ts">
  import { db } from '../models/db';
  import { newTask, type Priority } from '../models/types';
  import { schedule } from '../models/schedule';
  import { strings } from '../design/strings';

  // defaultToday: opened from the "Dziś" screen — the task lands on today's list
  // instead of vanishing onto the master list.
  let { onclose, defaultToday = false }: { onclose: () => void; defaultToday?: boolean } = $props();
  let title = $state('');

  async function add(priority: Priority) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const task = newTask(trimmed, priority);
    if (defaultToday) schedule(task, new Date());
    await db.tasks.add(task);
    onclose();
  }
</script>

<div class="sheet">
  <h2>{strings.quickAdd.title}</h2>
  <input bind:value={title} placeholder={strings.quickAdd.titlePlaceholder} />
  <p>{strings.quickAdd.priorityPrompt}</p>
  <button onclick={() => add('a')}>{strings.quickAdd.priorityA}</button>
  <button onclick={() => add('b')}>{strings.quickAdd.priorityB}</button>
  <button onclick={() => add('c')}>{strings.quickAdd.priorityC}</button>
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>

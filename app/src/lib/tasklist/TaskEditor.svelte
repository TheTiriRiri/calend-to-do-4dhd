<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Priority, Task } from '../models/types';
  import { schedule, unschedule } from '../models/schedule';
  import { cascadeDeleteIds } from '../models/breakdown';
  import { completeParentIfDone } from '../models/completion';
  import { strings } from '../design/strings';

  let { task, container = false, onclose, onbreakdown }: {
    task: Task;
    container?: boolean;
    onclose: () => void;
    onbreakdown: (task: Task) => void;
  } = $props();

  const priorities: Priority[] = ['a', 'b', 'c'];
  let title = $state(task.title);
  let priority = $state<Priority>(task.priority);
  let day = $state(task.scheduledDate ?? '');
  let time = $state(task.scheduledTime ?? '');
  let categoryName = $state('');

  const categories = liveQuery(() => db.categories.toArray());

  // prefill current category name once categories load (otherwise the field
  // opens empty while a category is set — display would lie)
  let prefilled = false;
  $effect(() => {
    if (!prefilled && $categories) {
      categoryName = $categories.find((c) => c.id === task.categoryId)?.name ?? '';
      prefilled = true;
    }
  });

  async function save() {
    task.title = title.trim() || task.title;
    task.priority = priority;
    if (!container) {
      if (day) schedule(task, new Date(`${day}T12:00:00`), time || undefined);
      else unschedule(task);
    }
    const cat = categoryName.trim();
    if (cat) {
      const existing = ($categories ?? []).find((c) => c.name === cat);
      if (existing) {
        task.categoryId = existing.id;
      } else {
        const id = crypto.randomUUID();
        await db.categories.add({ id, name: cat });
        task.categoryId = id;
      }
    }
    // task may be a $state proxy — Dexie needs a plain snapshot (structuredClone)
    await db.tasks.put($state.snapshot(task));
    onclose();
  }

  async function remove() {
    const all = await db.tasks.toArray();
    const ids = cascadeDeleteIds(task, all);
    const steps = ids.length - 1;
    const message = steps > 0 ? strings.breakdown.confirmDelete(steps) : strings.common.confirmDeletePlain;
    if (!confirm(message)) return; // every hard delete confirms (spec §4)
    const parentId = task.parentId;
    await db.tasks.bulkDelete(ids);
    // a deleted step may leave its container with only completed children —
    // nothing else re-checks on delete, so do it here
    if (parentId) {
      const parent = completeParentIfDone(parentId, await db.tasks.toArray());
      if (parent) await db.tasks.put(parent);
    }
    onclose();
  }
</script>

<div class="sheet">
  <input bind:value={title} placeholder={strings.quickAdd.titlePlaceholder} />
  <p>{strings.quickAdd.priorityPrompt}</p>
  {#each priorities as p}
    <button onclick={() => (priority = p)} disabled={priority === p}>{p.toUpperCase()}</button>
  {/each}
  {#if !container}
    <label>{strings.editor.day} <input type="date" bind:value={day} /></label>
    <label>{strings.editor.time} <input type="time" bind:value={time} /></label>
  {/if}
  <label>
    {strings.editor.category}
    <input bind:value={categoryName} list="category-options" placeholder={strings.editor.categoryPlaceholder} />
    <datalist id="category-options">
      {#each $categories ?? [] as c (c.id)}<option value={c.name}></option>{/each}
    </datalist>
  </label>
  <div>
    <button onclick={save}>{strings.common.save}</button>
    <button class="muted" onclick={() => onbreakdown(task)}>{strings.editor.breakDown}</button>
    <button class="muted" onclick={remove}>{strings.common.delete}</button>
    <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
  </div>
</div>

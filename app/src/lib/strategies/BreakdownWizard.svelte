<script lang="ts">
  import { db } from '../models/db';
  import type { Task } from '../models/types';
  import { applyContainerRules, makeSteps } from '../models/breakdown';
  import { strings } from '../design/strings';

  let { parent, onclose }: { parent: Task; onclose: () => void } = $props();
  const s = strings.breakdown;

  let steps = $state<string[]>(['']);
  let emptyHint = $state(false);
  const hadDate = parent.scheduledDate !== undefined;

  async function save() {
    const existing = await db.tasks.where('parentId').equals(parent.id).count();
    const made = makeSteps(parent, steps, new Date(), existing);
    if (made.length === 0) {
      emptyHint = true;
      return;
    }
    applyContainerRules(parent); // clears date/time, re-opens completed container
    // parent may be a $state proxy — Dexie needs a plain snapshot (structuredClone)
    await db.tasks.put($state.snapshot(parent));
    await db.tasks.bulkAdd(made);
    onclose();
  }
</script>

<div class="sheet">
  <h2>{s.action}: {parent.title}</h2>
  {#each steps as _, i (i)}
    <input bind:value={steps[i]} placeholder={s.stepPlaceholder} />
  {/each}
  <button onclick={() => (steps = [...steps, ''])}>{strings.common.add}</button>
  <p>{s.oneDayTest}</p>
  <p class="muted">{s.splitFurtherHint}</p>
  {#if hadDate}<p class="muted">{s.dateCleared}</p>{/if}
  {#if emptyHint}<p class="muted">{s.noStepsHint}</p>{/if}
  <button onclick={save}>{strings.common.save}</button>
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>

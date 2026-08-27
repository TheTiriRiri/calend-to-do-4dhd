<script lang="ts">
  import { db } from '../models/db';
  import { newTask, type Solution } from '../models/types';
  import { bestSolution, nextBest } from '../models/problemSolver';
  import { strings } from '../design/strings';
  import ProsConsEditor from './ProsConsEditor.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const s = strings.problemForm;

  let step = $state(1);
  let problem = $state('');
  let solutions = $state<Solution[]>([]);
  let newSolution = $state('');
  let rejected = $state<ReadonlySet<string>>(new Set());
  let saved = $state<Solution | null>(null);

  const candidates = $derived(solutions.filter((x) => !rejected.has(x.id)));
  const best = $derived(bestSolution(candidates));

  function addSolution() {
    const t = newSolution.trim();
    if (!t) return;
    solutions = [...solutions, { id: crypto.randomUUID(), formId: '', text: t, pros: [], cons: [], rating: 5 }];
    newSolution = '';
  }
  function reject(sol: Solution) {
    rejected = new Set(rejected).add(sol.id);
  }
  async function finish(chosen: Solution) {
    const formId = crypto.randomUUID();
    await db.problemForms.add({ id: formId, problem, createdAt: new Date().toISOString(), chosenSolutionId: chosen.id });
    await db.solutions.bulkAdd(solutions.map((x) => ({ ...x, formId })));
    saved = chosen;
  }
  async function addAsTask() {
    if (!saved) return;
    // chosen solution is meant to be implemented today/tomorrow → priority A
    // (spec's "or a breakdown": the spawned task's editor offers it immediately)
    await db.tasks.add(newTask(saved.text, 'a'));
    onclose();
  }
</script>

<div class="sheet">
  <h2>{s.title}{#if !saved} — {step}/5{/if}</h2>

  {#if saved}
    <h3>{saved.text}</h3>
    <button onclick={addAsTask}>{s.addAsTask}</button>
    <button class="muted" onclick={onclose}>{strings.common.close}</button>
  {:else if step === 1}
    <p>{s.step1}</p>
    <textarea bind:value={problem} placeholder={s.step1Placeholder} rows="3"></textarea>
  {:else if step === 2}
    <p>{s.step2}</p>
    <ul>{#each solutions as sol (sol.id)}<li>{sol.text}</li>{/each}</ul>
    <input bind:value={newSolution} placeholder={s.step2Placeholder} />
    <button onclick={addSolution}>{strings.common.add}</button>
  {:else if step === 3}
    <p>{s.step3}</p>
    {#each solutions as sol (sol.id)}
      <ProsConsEditor solution={sol} />
    {/each}
  {:else if step === 4}
    <p>{s.step4}</p>
    {#each solutions as sol (sol.id)}
      <label>{sol.text}: {sol.rating}
        <input type="range" min="1" max="10" bind:value={sol.rating} />
      </label>
    {/each}
  {:else}
    <p>{s.step5}</p>
    {#if best}
      <h3>{best.text} ({best.rating}/10)</h3>
      <button onclick={() => finish(best)}>{s.choose}</button>
      {#if nextBest(best, candidates)}
        <button class="muted" onclick={() => reject(best)}>{s.pickNext}</button>
      {/if}
    {/if}
  {/if}

  {#if !saved}
    <div>
      {#if step < 5}
        <button onclick={() => (step += 1)} disabled={(step === 1 && !problem.trim()) || (step === 2 && solutions.length === 0)}>{s.next}</button>
      {/if}
      <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
    </div>
  {/if}
</div>

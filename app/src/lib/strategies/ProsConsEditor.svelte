<script lang="ts">
  import type { Solution } from '../models/types';
  import { strings } from '../design/strings';

  let { solution }: { solution: Solution } = $props();
  let proText = $state('');
  let conText = $state('');

  function addPro() {
    const t = proText.trim();
    if (!t) return;
    solution.pros = [...solution.pros, t];
    proText = '';
  }
  function addCon() {
    const t = conText.trim();
    if (!t) return;
    solution.cons = [...solution.cons, t];
    conText = '';
  }
</script>

<section class="sheet">
  <strong>{solution.text}</strong>
  <ul>{#each solution.pros as pro}<li>+ {pro}</li>{/each}</ul>
  <input bind:value={proText} placeholder="+" /><button onclick={addPro}>{strings.common.add}</button>
  <ul>{#each solution.cons as con}<li>− {con}</li>{/each}</ul>
  <input bind:value={conText} placeholder="−" /><button onclick={addCon}>{strings.common.add}</button>
</section>

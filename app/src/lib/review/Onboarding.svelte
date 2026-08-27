<script lang="ts">
  import { strings } from '../design/strings';
  import QuickAdd from '../tasklist/QuickAdd.svelte';

  let { ondone }: { ondone: () => void } = $props();
  const o = strings.onboarding;
  let screen = $state(1);
  let reviewTime = $state('09:00');

  function finish() {
    localStorage.setItem('onboarded', '1');
    localStorage.setItem('reviewTime', reviewTime);
    ondone();
  }
</script>

<main>
  {#if screen === 1}
    <p>{o.screen1}</p>
    <button onclick={() => (screen = 2)}>{o.next}</button>
  {:else if screen === 2}
    <p>{o.screen2title}</p>
    <input type="time" bind:value={reviewTime} />
    <p>{o.screen2intro}</p>
    <ul>
      <li>{o.screen2clock}</li>
      <li>{o.screen2calendar}</li>
      <li>{o.screen2shortcuts}</li>
    </ul>
    <button onclick={() => (screen = 3)}>{o.next}</button>
  {:else}
    <p>{o.screen3}</p>
    <QuickAdd defaultToday onclose={finish} />
    <button class="muted" onclick={finish}>{o.start}</button>
  {/if}
</main>

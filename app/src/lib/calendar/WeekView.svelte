<script lang="ts">
  import { addDays, todayStart } from '../models/dates';
  import DayView from './DayView.svelte';

  // recompute the 7-day window when the app returns to foreground (midnight guard)
  let nowTick = $state(0);
  const days = $derived.by(() => {
    void nowTick;
    return Array.from({ length: 7 }, (_, i) => addDays(todayStart(), i));
  });
  const fmt = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

{#each days as day (day.toISOString())}
  <section class="sheet">
    <h3>{fmt.format(day)}</h3>
    <DayView {day} />
  </section>
{/each}

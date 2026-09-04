<script lang="ts">
  import type { CalendarEvent } from '../models/types';
  import { weekWindow } from '../models/dates';
  import { strings } from '../design/strings';
  import DayView from './DayView.svelte';

  let { onedit }: { onedit: (event: CalendarEvent) => void } = $props();

  // recompute the 7-day window when the app returns to foreground (midnight guard)
  let nowTick = $state(0);
  // shift in whole weeks from the window containing today (I-10: browse further out)
  let weekOffset = $state(0);
  const days = $derived.by(() => {
    void nowTick;
    return weekWindow(new Date(), weekOffset);
  });
  const dayFmt = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
  const rangeDayFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric' });
  const rangeMonthFmt = new Intl.DateTimeFormat('pl-PL', { month: 'short' });
  const rangeLabel = $derived.by(() => {
    const [first, last] = [days[0], days[6]];
    const start = `${rangeDayFmt.format(first)}${first.getMonth() === last.getMonth() ? '' : ' ' + rangeMonthFmt.format(first)}`;
    return `${start} – ${rangeDayFmt.format(last)} ${rangeMonthFmt.format(last)}`;
  });
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

<div class="week-nav">
  <button aria-label={strings.calendar.prevWeek} onclick={() => (weekOffset -= 1)}>◂</button>
  <span>{rangeLabel}</span>
  <button aria-label={strings.calendar.nextWeek} onclick={() => (weekOffset += 1)}>▸</button>
</div>

{#each days as day (day.toISOString())}
  <section class="sheet">
    <h3>{dayFmt.format(day)}</h3>
    <DayView {day} {onedit} />
  </section>
{/each}

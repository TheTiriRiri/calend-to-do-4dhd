<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { CalendarEvent } from '../models/types';
  import { eventsOn, tasksScheduledOn, dayTimeline, type TaskRowsMode } from '../models/calendarQueries';
  import { strings } from '../design/strings';

  // tail: only the review screen closes the axis with "the rest of the day is
  // free" — WeekView renders this component once per day and would repeat it.
  let { day, onedit, tasks = 'all', tail = 'none' }: {
    day: Date;
    onedit: (event: CalendarEvent) => void;
    tasks?: TaskRowsMode;
    tail?: 'restFree' | 'none';
  } = $props();
  const events = liveQuery(() => db.events.toArray());
  const taskRows = liveQuery(() => db.tasks.toArray());

  const dayEvents = $derived(eventsOn($events ?? [], day));
  const dayTasks = $derived(tasksScheduledOn($taskRows ?? [], day));
  const timeline = $derived(dayTimeline(dayEvents, dayTasks, tasks));

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
</script>

{#if timeline.length === 0 && tail === 'none'}
  <p class="muted">{strings.calendar.emptyDay}</p>
{/if}

<div class="axis">
  {#each timeline as entry (entry.kind + ':' + (entry.kind === 'event' ? entry.event.id : entry.task.id))}
    {#if entry.kind === 'event'}
      <div class="axis-time">{fmtTime(entry.event.startsAt)}</div>
      <div class="axis-body">
        <button class="row-btn" onclick={() => onedit(entry.event)}>
          {entry.event.title}
          {#if entry.event.endsAt}<span class="until">{strings.calendar.until(fmtTime(entry.event.endsAt))}</span>{/if}
        </button>
      </div>
    {:else}
      <div class="axis-time">{entry.task.scheduledTime ?? '—'}</div>
      <div class="axis-body">{entry.task.title}</div>
    {/if}
  {/each}

  {#if tail === 'restFree'}
    <div class="axis-time">—</div>
    <div class="axis-body axis-tail">
      {timeline.length === 0 ? strings.calendar.emptyDay : strings.calendar.restFree}
    </div>
  {/if}
</div>

<style>
  /* the whole row is the target, so the button carries no chrome of its own */
  .row-btn {
    display: block; width: 100%; text-align: left;
    background: none; border: none; padding: 0; font: inherit; color: inherit;
    min-height: 44px; cursor: pointer;
  }
  .until { display: block; font-size: 12px; color: var(--color-neutral-600); }
</style>

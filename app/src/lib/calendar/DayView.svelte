<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { CalendarEvent } from '../models/types';
  import { eventsOn, tasksScheduledOn, dayTimeline, type TaskRowsMode } from '../models/calendarQueries';
  import { strings } from '../design/strings';

  let { day, onedit, tasks = 'all' }: {
    day: Date;
    onedit: (event: CalendarEvent) => void;
    tasks?: TaskRowsMode;
  } = $props();
  const events = liveQuery(() => db.events.toArray());
  const taskRows = liveQuery(() => db.tasks.toArray());

  const dayEvents = $derived(eventsOn($events ?? [], day));
  const dayTasks = $derived(tasksScheduledOn($taskRows ?? [], day));
  const timeline = $derived(dayTimeline(dayEvents, dayTasks, tasks));

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
</script>

{#if timeline.length === 0}
  <p class="muted">{strings.calendar.emptyDay}</p>
{/if}
<ul>
  {#each timeline as entry (entry.kind + ':' + (entry.kind === 'event' ? entry.event.id : entry.task.id))}
    <li>
      {#if entry.kind === 'event'}
        <button onclick={() => onedit(entry.event)}>
          {fmtTime(entry.event.startsAt)}{#if entry.event.endsAt}–{fmtTime(entry.event.endsAt)}{/if}
          {entry.event.title}
        </button>
      {:else}
        {#if entry.task.scheduledTime}{entry.task.scheduledTime} {/if}{entry.task.title}
      {/if}
    </li>
  {/each}
</ul>

<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import { eventsOn, tasksScheduledOn } from '../models/calendarQueries';
  import { strings } from '../design/strings';

  let { day }: { day: Date } = $props();
  const events = liveQuery(() => db.events.toArray());
  const tasks = liveQuery(() => db.tasks.toArray());

  const dayEvents = $derived(eventsOn($events ?? [], day));
  const dayTasks = $derived(tasksScheduledOn($tasks ?? [], day));
</script>

{#if dayEvents.length === 0 && dayTasks.length === 0}
  <p class="muted">{strings.calendar.emptyDay}</p>
{/if}
<ul>
  {#each dayEvents as event (event.id)}
    <li>
      {new Date(event.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
      {event.title}
    </li>
  {/each}
  {#each dayTasks as task (task.id)}
    <li>{#if task.scheduledTime}{task.scheduledTime} {/if}{task.title}</li>
  {/each}
</ul>

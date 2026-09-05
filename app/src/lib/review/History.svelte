<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import { completedByDay, completedHistory } from '../models/queries';
  import { strings } from '../design/strings';

  const tasks = liveQuery(() => db.tasks.toArray());
  const done = $derived(completedHistory($tasks ?? []));
  const days = $derived(completedByDay($tasks ?? []));
  // noon-anchored: a bare yyyy-mm-dd parses as UTC midnight and shifts a day west
  function dayLabel(day: string): string {
    return new Date(`${day}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
</script>

<main>
  <h1>{strings.history.title}</h1>
  {#if $tasks}
    <p class="muted">{strings.history.subtitle}: {done.length}</p>
    <!-- an axis of days (handoff 2f): the day is the heading, not a suffix on
         every row, so a good day reads as one block of work -->
    {#each days as { day, tasks: dayTasks } (day)}
      <section class="sheet">
        <h3>{dayLabel(day)}</h3>
        <ul>
          {#each dayTasks as task (task.id)}
            <li>✓ {task.title}</li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>

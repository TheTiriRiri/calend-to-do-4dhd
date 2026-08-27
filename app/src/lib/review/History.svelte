<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import { completedHistory } from '../models/queries';
  import { strings } from '../design/strings';

  const tasks = liveQuery(() => db.tasks.toArray());
  const done = $derived(completedHistory($tasks ?? []));
  function dayLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
</script>

<main>
  <h1>{strings.history.title}</h1>
  <p class="muted">{strings.history.subtitle}: {done.length}</p>
  <ul>
    {#each done as task (task.id)}
      <li>✓ {task.title} <span class="muted">{dayLabel(task.dateCompleted ?? '')}</span></li>
    {/each}
  </ul>
</main>

<script lang="ts">
  import { db } from '../models/db';
  import { deserialize, serialize } from '../models/backup';
  import { strings } from '../design/strings';

  const s = strings.settings;
  let reviewTime = $state(localStorage.getItem('reviewTime') ?? '09:00');
  let message = $state('');

  function saveReviewTime() {
    localStorage.setItem('reviewTime', reviewTime);
  }

  async function exportJson() {
    const tables = {
      tasks: await db.tasks.toArray(),
      categories: await db.categories.toArray(),
      events: await db.events.toArray(),
      problemForms: await db.problemForms.toArray(),
      solutions: await db.solutions.toArray(),
    };
    const blob = new Blob([serialize(tables)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plan-dnia-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm(s.confirmImport)) return; // import replaces everything — confirm first
    try {
      const data = deserialize(await file.text());
      await db.transaction('rw', [db.tasks, db.categories, db.events, db.problemForms, db.solutions], async () => {
        await Promise.all([db.tasks.clear(), db.categories.clear(), db.events.clear(), db.problemForms.clear(), db.solutions.clear()]);
        await db.tasks.bulkAdd(data.tasks);
        await db.categories.bulkAdd(data.categories);
        await db.events.bulkAdd(data.events);
        await db.problemForms.bulkAdd(data.problemForms);
        await db.solutions.bulkAdd(data.solutions);
      });
      message = s.imported;
    } catch {
      message = s.importError;
    }
  }
</script>

<main>
  <h1>{s.title}</h1>
  <section class="sheet">
    <h2>{s.reviewTimeLabel}: <input type="time" bind:value={reviewTime} onchange={saveReviewTime} /></h2>
    <p class="muted">{s.reminderHint}</p>
  </section>
  <section class="sheet">
    <h2>{s.backupSection}</h2>
    <p class="muted">{s.backupHint}</p>
    <button onclick={exportJson}>{s.export}</button>
    <label>{s.import} <input type="file" accept="application/json" onchange={importJson} /></label>
    {#if message}<p>{message}</p>{/if}
  </section>
</main>

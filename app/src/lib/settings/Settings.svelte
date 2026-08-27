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
    const json = serialize(tables);
    // prefer the native share sheet (iOS) when it accepts files
    const file = new File([json], 'plan-dnia-backup.json', { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plan-dnia-backup.json';
    a.click();
    // defer revocation — revoking synchronously can cancel the download before it starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importJson(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ''; // reset so selecting the same file again re-fires change
    if (!confirm(s.confirmImport)) return; // import replaces everything — confirm first
    try {
      const data = deserialize(await file.text());
      await db.transaction('rw', [db.tasks, db.categories, db.events, db.problemForms, db.solutions], async () => {
        await Promise.all([db.tasks.clear(), db.categories.clear(), db.events.clear(), db.problemForms.clear(), db.solutions.clear()]);
        await db.tasks.bulkAdd($state.snapshot(data.tasks));
        await db.categories.bulkAdd($state.snapshot(data.categories));
        await db.events.bulkAdd($state.snapshot(data.events));
        await db.problemForms.bulkAdd($state.snapshot(data.problemForms));
        await db.solutions.bulkAdd($state.snapshot(data.solutions));
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
    <label>{s.import} <input type="file" accept=".json,application/json" onchange={importJson} /></label>
    {#if message}<p>{message}</p>{/if}
  </section>
</main>

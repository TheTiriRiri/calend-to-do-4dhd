<script lang="ts">
  import { db } from '../models/db';
  import { strings } from '../design/strings';
  import { toISODate } from '../models/dates';

  let { onclose }: { onclose: () => void } = $props();
  let title = $state('');
  let day = $state(toISODate(new Date()));
  let time = $state('12:00');
  let hasEnd = $state(false);
  let endTime = $state('13:00');

  const invalid = $derived(!title.trim() || (hasEnd && endTime <= time));

  async function save() {
    if (invalid) return;
    await db.events.add({
      id: crypto.randomUUID(),
      title: title.trim(),
      startsAt: new Date(`${day}T${time}:00`).toISOString(),
      endsAt: hasEnd ? new Date(`${day}T${endTime}:00`).toISOString() : undefined,
    });
    onclose();
  }
</script>

<div class="sheet">
  <input bind:value={title} placeholder={strings.calendar.eventTitlePlaceholder} />
  <label>{strings.editor.day} <input type="date" bind:value={day} /></label>
  <label>{strings.calendar.start} <input type="time" bind:value={time} /></label>
  <label><input type="checkbox" bind:checked={hasEnd} /> {strings.calendar.end}</label>
  {#if hasEnd}<input type="time" bind:value={endTime} />{/if}
  <button onclick={save} disabled={invalid}>{strings.common.save}</button>
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>

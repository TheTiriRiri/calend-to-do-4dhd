<script lang="ts">
  import { db } from '../models/db';
  import type { CalendarEvent } from '../models/types';
  import { eventTimesValid } from '../models/calendarQueries';
  import { strings } from '../design/strings';
  import { toISODate } from '../models/dates';

  let { event, onclose }: { event?: CalendarEvent; onclose: () => void } = $props();

  const localTime = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

  let title = $state(event?.title ?? '');
  let day = $state(event ? toISODate(new Date(event.startsAt)) : toISODate(new Date()));
  let time = $state(event ? localTime(event.startsAt) : '12:00');
  let hasEnd = $state(!!event?.endsAt);
  let endTime = $state(event?.endsAt ? localTime(event.endsAt) : '13:00');
  let note = $state(event?.note ?? '');

  const invalid = $derived(!title.trim() || (hasEnd && !eventTimesValid(time, endTime)));

  async function save() {
    if (invalid) return;
    const record: CalendarEvent = {
      id: event?.id ?? crypto.randomUUID(),
      title: title.trim(),
      startsAt: new Date(`${day}T${time}:00`).toISOString(),
      endsAt: hasEnd ? new Date(`${day}T${endTime}:00`).toISOString() : undefined,
      note: note.trim() || undefined,
    };
    // event may be a $state proxy — write a plain literal, never the prop itself
    if (event) await db.events.put(record);
    else await db.events.add(record);
    onclose();
  }

  async function remove() {
    if (!event || !confirm(strings.calendar.confirmDeleteEvent)) return;
    await db.events.delete(event.id);
    onclose();
  }
</script>

<div class="sheet">
  {#if event}<h3>{strings.calendar.editEvent}</h3>{/if}
  <input bind:value={title} placeholder={strings.calendar.eventTitlePlaceholder} />
  <label>{strings.editor.day} <input type="date" bind:value={day} /></label>
  <label>{strings.calendar.start} <input type="time" bind:value={time} /></label>
  <label><input type="checkbox" bind:checked={hasEnd} /> {strings.calendar.end}</label>
  {#if hasEnd}<input type="time" bind:value={endTime} />{/if}
  <label>
    {strings.calendar.note}
    <input bind:value={note} placeholder={strings.calendar.eventNotePlaceholder} />
  </label>
  <button onclick={save} disabled={invalid}>{strings.common.save}</button>
  {#if event}<button class="muted" onclick={remove}>{strings.common.delete}</button>{/if}
  <button class="muted" onclick={onclose}>{strings.common.cancel}</button>
</div>

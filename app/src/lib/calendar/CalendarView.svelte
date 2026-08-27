<script lang="ts">
  import type { CalendarEvent } from '../models/types';
  import { strings } from '../design/strings';
  import WeekView from './WeekView.svelte';
  import EventEditor from './EventEditor.svelte';

  let addingEvent = $state(false);
  let editingEvent = $state<CalendarEvent | null>(null);
</script>

<main>
  <h1>{strings.tabs.calendar}</h1>
  <button onclick={() => (addingEvent = true)}>{strings.calendar.addEvent}</button>
  {#if addingEvent}
    <div class="overlay"><EventEditor onclose={() => (addingEvent = false)} /></div>
  {/if}
  {#if editingEvent}
    <div class="overlay"><EventEditor event={editingEvent} onclose={() => (editingEvent = null)} /></div>
  {/if}
  <WeekView onedit={(e) => (editingEvent = e)} />
</main>

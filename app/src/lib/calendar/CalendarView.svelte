<script lang="ts">
  import { strings } from '../design/strings';
  import WeekView from './WeekView.svelte';
  import EventEditor from './EventEditor.svelte';

  let addingEvent = $state(false);
</script>

<main>
  <h1>{strings.tabs.calendar}</h1>
  <button onclick={() => (addingEvent = true)}>{strings.calendar.addEvent}</button>
  {#if addingEvent}<EventEditor onclose={() => (addingEvent = false)} />{/if}
  <WeekView />
</main>

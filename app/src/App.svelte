<script lang="ts">
  import { strings } from './lib/design/strings';
  import DailyReview from './lib/review/DailyReview.svelte';
  import MasterList from './lib/tasklist/MasterList.svelte';
  import CalendarView from './lib/calendar/CalendarView.svelte';
  import History from './lib/review/History.svelte';
  import Settings from './lib/settings/Settings.svelte';
  import Onboarding from './lib/review/Onboarding.svelte';
  import TaskEditor from './lib/tasklist/TaskEditor.svelte';
  import BreakdownWizard from './lib/strategies/BreakdownWizard.svelte';
  import type { Task } from './lib/models/types';

  let hash = $state(location.hash || '#/');
  window.addEventListener('hashchange', () => (hash = location.hash || '#/'));
  let onboarded = $state(localStorage.getItem('onboarded') === '1');
  let editing = $state<{ task: Task; container: boolean } | null>(null);
  let breaking = $state<Task | null>(null);

  const tabs = [
    { route: '#/', label: strings.tabs.today },
    { route: '#/lista', label: strings.tabs.master },
    { route: '#/kalendarz', label: strings.tabs.calendar },
    { route: '#/ustawienia', label: strings.tabs.settings },
  ];
</script>

{#if !onboarded}
  <Onboarding ondone={() => (onboarded = true)} />
{:else}
  <svelte:boundary>
    {#if hash === '#/lista'}
      <MasterList onedit={(task, container) => (editing = { task, container: container ?? false })} />
    {:else if hash === '#/kalendarz'}
      <CalendarView />
    {:else if hash === '#/historia'}
      <History />
    {:else if hash === '#/ustawienia'}
      <Settings />
    {:else}
      <DailyReview />
    {/if}
    {#snippet failed()}<p>{strings.common.appError}</p>{/snippet}
  </svelte:boundary>

  <nav class="tabs">
    {#each tabs as tab (tab.route)}
      <a href={tab.route} class:active={hash === tab.route}>{tab.label}</a>
    {/each}
  </nav>

  {#if editing}
    <div class="overlay">
      <TaskEditor
        task={editing.task}
        container={editing.container}
        onclose={() => (editing = null)}
        onbreakdown={(t) => { breaking = t; editing = null; }}
      />
    </div>
  {/if}
  {#if breaking}
    <div class="overlay">
      <BreakdownWizard parent={breaking} onclose={() => (breaking = null)} />
    </div>
  {/if}
{/if}

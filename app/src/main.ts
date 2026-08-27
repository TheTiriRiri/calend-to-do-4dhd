import { mount } from 'svelte';
import App from './App.svelte';
import './lib/design/theme.css';

// Ask the OS to keep site data (no-op on iOS Safari — harmless).
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

const app = mount(App, { target: document.getElementById('app')! });
export default app;

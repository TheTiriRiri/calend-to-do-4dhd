# Plan Dnia

Local-first ADHD-friendly calendar + tasklist PWA. All data stays on the device (IndexedDB via Dexie); installable and offline-capable.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build (outputs `dist/`, includes service worker)
- `npm run check` — svelte-check + tsc type check
- `npm run test:unit` — Vitest unit tests
- `npm run test:e2e` — Playwright e2e smoke tests (builds and previews the app automatically)

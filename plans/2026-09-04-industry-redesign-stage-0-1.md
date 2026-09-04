# Industry Redesign — Stage 0 (foundation) + Stage 1 (screen 1c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app the "Industry" visual language (self-hosted Barlow, blueprint frames, steel-blue ramp, zero radius) and rebuild the `#/` daily-review screen to handoff variant 1c, without changing a single domain rule.

**Architecture:** Two stages. Stage 0 lays a presentation layer the whole app will later share: self-hosted webfonts wired into the service-worker precache, a rewritten `theme.css` holding tokens plus five primitives (`.blueprint`, `.btn*`, `.tag*`, `.input`, focus ring), and the copy/format helpers the new screens need. Stage 1 consumes that layer on exactly three files — `DayView`, `DailyList`, `DailyReview`. `theme.css` is global, so every other screen turns into a hybrid the moment Task 2 lands (Barlow, new heading sizes, `main` padding, zero-radius `.sheet`) while keeping its old markup; that is accepted and recorded in CLAUDE.md in Task 7, and Task 2 carries a visual check so nothing on those screens is clipped or unreadable. `app/src/lib/models/` is not touched in either stage; the redesign is markup and CSS only.

**Tech Stack:** Vite 8, Svelte 5 (runes), TypeScript 6 strict, `dexie` (untouched here), `vite-plugin-pwa` (workbox generateSW), Vitest 4, Playwright 1.62.

**Spec:** `docs/ADHD calendartodo aplikacja v2/design_handoff_dzis_1c/` — `README.md` (the written handoff), `Dziś.dc.html` (HTML prototype; screen `1c` is the target, `1a` is the current state, `1b`/`1d` are rejected), `styles.css` (source of tokens and primitives). **`docs/` is gitignored and local-only** — never copy it into tracked files; quote values, not files. Product spec: `specs/2026-08-27-adhd-calendar-tasklist-ios-design.md`.

## Global Constraints

- All code, comments, filenames and generated files in **English**. User-facing copy is Polish and lives **only** in `app/src/lib/design/strings.ts`. Any Polish string literal inside a `.svelte` file is a defect.
- **No runtime network calls.** No backend, no analytics, no CDN. This is why the fonts are self-hosted; a `fonts.googleapis.com` `<link>` or `@import` is forbidden, including transitively via the handoff's `styles.css`.
- Runtime dependency stays **`dexie` only**. Stage 0/1 add no runtime dependency.
- **No change to `app/src/lib/models/`** and no `db.version()` / `SCHEMA_VERSION` bump. If a task appears to need one, stop and escalate — it means the task was mis-scoped.
- Commits: **one sentence, conventional prefix, nothing else.** No body, no bullets, no `Co-Authored-By`, no Claude/Anthropic attribution.
- No linter; style is what `svelte-check` + `tsc` accept: 2-space indent, single quotes, semicolons, trailing commas.
- Run every npm command from `app/`.
- **Preserve the test contract** wherever the design does not literally require otherwise: keep the `.sheet` and `.overlay` class names, keep `<button>`/`<h*>`/`<label>` element choices, and keep the accessible names `oznacz jako zrobione`, `cofnij`, `Przełóż na jutro`. Visible text may shrink to a glyph; the accessible name may not.
- Protocol rules that the design must keep enforcing: all A before B before C; B/C collapsed while a higher section has active tasks; ticking a task never opens a confirm dialog; no streak counters, no red "overdue" badges, no copy that blames the user.
- Target viewport 390×844 (iPhone 14 Pro), safe-area aware. Every interactive element keeps a ≥44px hit area — one recorded exception: the `.undo` word inside the "Zrobione dziś" sentence (Task 5), which gets a padded hit area via negative margins rather than a 44px box.
- Radius is **0** everywhere in this design; no shadows on these screens.
- Baseline to preserve: `npm run check` = 0 errors / 15 warnings, `npm run test:unit` = 61 passed, `npm run test:e2e` = 14 passed (chromium). Task counts grow; errors do not.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/scripts/fetch-fonts.mjs` | create | Dev-time only. Downloads Barlow / Barlow Condensed woff2 subsets from Google and writes both the files and the generated `@font-face` CSS. Never runs at runtime or during `npm run build`. |
| `app/public/fonts/*.woff2` | create (generated, committed) | 10 font files, ~121 KB total, served from our own origin. |
| `app/public/fonts/OFL.txt` | create (generated, committed) | SIL Open Font License 1.1 — Barlow's licence; redistributing the font files requires shipping it. |
| `app/src/lib/design/fonts.css` | create (generated, committed) | The `@font-face` block with local `url()`s and Google's `unicode-range` values preserved. Imported by `theme.css`. |
| `app/src/lib/design/theme.css` | rewrite | Design tokens + global base + the primitives every screen shares (`.blueprint`/`.corner`, `.btn*`, `.tag*`, `.input`, focus ring, tabbar, `.overlay`, `.sheet`). |
| `app/src/lib/design/format.ts` | create | Presentation-only pure helpers: `shortDate()`, `taskCount()`. Not domain logic, so it does **not** belong in `models/`; it is unit-tested all the same. |
| `app/src/lib/design/strings.ts` | modify | ~10 new keys plus the split of `sectionA/B/C` into bare names. |
| `app/src/lib/calendar/DayView.svelte` | modify | The `56px | 1fr` time axis, plus a `tail` prop so only the review screen prints "rest of the day is free". |
| `app/src/lib/tasklist/DailyList.svelte` | modify | Section A (or the first uncollapsed section) as a blueprint frame; B/C as two collapsed tiles; done-today as one inline line. |
| `app/src/lib/review/DailyReview.svelte` | modify | Screen skeleton: header + date, axis, list, bottom action block; owns the QuickAdd overlay. |
| `app/src/App.svelte` | unchanged (verify only) | The tabbar restyle is pure CSS in `theme.css`; the `nav.tabs a.active` markup this relies on already exists here. |
| `app/vite.config.ts` | modify | `workbox.globPatterns` so woff2 lands in the precache. |
| `app/tests/e2e/fonts.spec.ts` | create | Proves offline-first typography and the no-network rule. |
| `app/tests/e2e/theme.spec.ts` | create | Proves the token layer reached the DOM and the `.sheet` contract survived. |
| `app/tests/unit/format.test.ts` | create | Polish plurals and the `Pt 04.09` composer. |
| `app/tests/e2e/daily-actions.spec.ts` | modify | Locators that the new copy changes. |
| `app/tests/e2e/calendar.spec.ts` | modify | New assertion for the `tail` prop. |
| `CLAUDE.md` | modify | Record the design system, the font pipeline and the new class contract. |

---

### Task 1: Self-hosted fonts, precached

**Files:**
- Create: `app/scripts/fetch-fonts.mjs`
- Create: `app/public/fonts/*.woff2` + `app/public/fonts/OFL.txt` (generated by the script)
- Create: `app/src/lib/design/fonts.css` (generated by the script)
- Modify: `app/src/lib/design/theme.css:1` (add the import)
- Modify: `app/vite.config.ts:17` (workbox globPatterns, next to `registerType`)
- Modify: `app/package.json:8` (add the `fonts` script after `"build"`)
- Test: `app/tests/e2e/fonts.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS families `"Barlow"` (400/500/700) and `"Barlow Condensed"` (400/600), available to every later task as `var(--font-body)` / `var(--font-heading)` once Task 2 defines those tokens.

- [ ] **Step 1: Write the failing test**

Create `app/tests/e2e/fonts.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// bypass onboarding: that screen has no heading and no .btn, so nothing on it
// would ever request Barlow Condensed and the face would stay "unloaded"
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

test('typography is self-hosted: no font CDN request, Barlow actually loads', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) external.push(url);
  });

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  // the app must never reach a third party at runtime (CLAUDE.md: no runtime network calls)
  expect(external).toEqual([]);
  // assert on face status, not document.fonts.check(): check() answers true
  // for a family with no @font-face at all, so it can never go red
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family}/${f.weight}`));
  expect(loaded).toContain('Barlow Condensed/600');
  expect(loaded).toContain('Barlow/400');
});

test('font files are in the service worker precache', async ({ page, request }) => {
  await page.goto('/');
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  // generateSW inlines the precache manifest; woff2 entries must be in it or the
  // first offline launch falls back to system-ui
  expect(await sw.text()).toContain('.woff2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- fonts.spec.ts`
Expected: FAIL — `document.fonts` holds no face at all, so `loaded` is `[]` and `toContain('Barlow Condensed/600')` fails; the `/sw.js` body contains no `.woff2`.

- [ ] **Step 3: Write the fetch script**

Create `app/scripts/fetch-fonts.mjs`:

```js
// Downloads the Barlow / Barlow Condensed subsets we use and rewrites Google's
// @font-face CSS to point at our own origin. Dev-time only — run it by hand
// (`npm run fonts`) when the font set changes. The app itself never talks to a
// CDN; see CLAUDE.md ("no runtime network calls").
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://fonts.googleapis.com/css2'
  + '?family=Barlow:wght@400;500;700'
  + '&family=Barlow+Condensed:wght@400;600'
  + '&display=swap';
// Google serves woff2 only to a browser-looking UA; anything else gets ttf.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Polish needs latin-ext (ł ż ś ę ą ć ń ó ź); vietnamese is dead weight here.
const SUBSETS = new Set(['latin', 'latin-ext']);

const outDir = path.resolve('public/fonts');
const cssOut = path.resolve('src/lib/design/fonts.css');

const css = await (await fetch(API, { headers: { 'User-Agent': UA } })).text();
fs.mkdirSync(outDir, { recursive: true });

const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)];
const kept = [];
let bytes = 0;

for (const [, subset, body] of blocks) {
  if (!SUBSETS.has(subset)) continue;
  const family = /font-family:\s*'([^']+)'/.exec(body)[1];
  const weight = /font-weight:\s*(\d+)/.exec(body)[1];
  const range = /unicode-range:\s*([^;]+);/.exec(body)[1].trim();
  const url = /url\((https[^)]+)\)/.exec(body)[1];

  const file = `${family.replace(/\s+/g, '')}-${weight}-${subset}.woff2`;
  const data = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  fs.writeFileSync(path.join(outDir, file), data);
  bytes += data.length;
  console.log(`wrote public/fonts/${file} (${Math.round(data.length / 1024)} KB)`);

  kept.push(
    `/* ${subset} */\n@font-face {\n`
    + `  font-family: '${family}';\n`
    + `  font-style: normal;\n`
    + `  font-weight: ${weight};\n`
    + `  font-display: swap;\n`
    + `  src: url('/fonts/${file}') format('woff2');\n`
    + `  unicode-range: ${range};\n}`,
  );
}

const header = '/* Generated by scripts/fetch-fonts.mjs — do not edit by hand.\n'
  + '   Self-hosted so the app makes no runtime network calls. */\n\n';
fs.writeFileSync(cssOut, header + kept.join('\n\n') + '\n');
console.log(`wrote src/lib/design/fonts.css (${kept.length} faces, ${Math.round(bytes / 1024)} KB of woff2)`);

// Barlow is SIL OFL 1.1 — redistributing the files requires shipping the licence.
const LICENSE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt';
fs.writeFileSync(path.join(outDir, 'OFL.txt'), await (await fetch(LICENSE)).text());
console.log('wrote public/fonts/OFL.txt');
```

- [ ] **Step 4: Run the script**

Run: `node scripts/fetch-fonts.mjs`
Expected: 10 lines of `wrote public/fonts/...`, then `wrote src/lib/design/fonts.css (10 faces, ~121 KB of woff2)`, then `wrote public/fonts/OFL.txt`. If a family reports fewer than 2 subsets, Google changed its response — stop and re-check the API URL rather than hand-editing the output. Barlow 500/700 are not used by Stage 0/1 (only Condensed 600 and Barlow 400 are referenced); they are fetched now because the 2a–2g screens use them and re-running the script later would churn every file's revision hash.

- [ ] **Step 5: Add the regeneration script**

In `app/package.json`, add to `"scripts"` after `"build"`:

```json
    "fonts": "node scripts/fetch-fonts.mjs",
```

- [ ] **Step 6: Import the generated CSS**

Add as the very first line of `app/src/lib/design/theme.css`:

```css
@import './fonts.css';
```

- [ ] **Step 7: Precache the woff2 files**

In `app/vite.config.ts`, inside the `VitePWA({ ... })` options object, add a `workbox` key next to `registerType`:

```ts
      registerType: 'autoUpdate',
      // the default globPatterns has no woff2 — without this the first offline
      // launch renders in system-ui
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'] },
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test:e2e -- fonts.spec.ts`
Expected: 2 passed. If the precache assertion still fails, run `npm run build` and grep `dist/sw.js` for `woff2` — an empty match means the `workbox` key landed in the wrong object.

- [ ] **Step 9: Verify offline for real**

Run: `npm run build && npm run preview`
Then, in a browser at `http://localhost:4173`: load once, open DevTools → Network → Offline, hard-reload. Expected: the page still renders and headings are still Barlow Condensed (not the system font). Stop the preview server afterwards.

- [ ] **Step 10: Commit**

```bash
git add app/scripts/fetch-fonts.mjs app/public/fonts app/src/lib/design/fonts.css app/src/lib/design/theme.css app/vite.config.ts app/package.json app/tests/e2e/fonts.spec.ts
git commit -m "feat: self-host Barlow fonts and precache them for offline use"
```

---

### Task 2: Industry tokens and primitives in theme.css

**Files:**
- Modify: `app/src/lib/design/theme.css` (full rewrite, keeping the import from Task 1)
- Test: `app/tests/e2e/theme.spec.ts`

**Interfaces:**
- Consumes: `fonts.css` from Task 1.
- Produces, for every later task: tokens `--color-bg`, `--color-surface`, `--color-text`, `--color-divider`, `--color-accent`, `--color-accent-200…900`, `--color-neutral-300/600/700`, `--font-heading`, `--font-body`, `--space-2/3/4/6`; classes `.blueprint` + `.corner.tl/.tr/.bl/.br`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.tag`, `.tag-accent`, `.tag-neutral`, `.tag-outline`, `.input`, `.axis`, `.tap`; and the preserved contract classes `.sheet`, `.overlay`, `.muted`, `.section-collapsed`, `nav.tabs`.

Do **not** import the handoff's `styles.css` wholesale: it resets `h1`–`h6` globally (42/32/25/20/16/13px), which contradicts the handoff's own 34px/26px header sizes and would blow up every existing screen. Hand-copy only what is listed above.

- [ ] **Step 1: Write the failing test**

Create `app/tests/e2e/theme.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

test('the Industry token layer reaches the DOM', async ({ page }) => {
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(242, 242, 243)');
  expect(await body.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Barlow');

  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
  expect(accent).toBe('#5980a6');
});

test('the .sheet / .overlay selector contract survives the restyle', async ({ page }) => {
  // CLAUDE.md documents these as the scoping idiom for e2e; the redesign keeps
  // the class names and moves only the styling onto .blueprint
  await page.goto('/#/kalendarz');
  await page.locator('.sheet').first().waitFor();
  expect(await page.locator('.sheet').count()).toBeGreaterThan(0);
});

test('nothing on the review screen has rounded corners', async ({ page }) => {
  const radii = await page.evaluate(() =>
    [...document.querySelectorAll('main *')].map((el) => getComputedStyle(el).borderRadius));
  expect(radii.every((r) => r === '0px' || r === '')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- theme.spec.ts`
Expected: test 1 FAILS on its first assertion — the body is still `rgb(255, 255, 255)`. Tests 2 and 3 already pass (WeekView renders `section.sheet` today, and nothing on the current review screen has a radius) — they are guards against the rewrite, not red-first tests.

- [ ] **Step 3: Rewrite theme.css**

Replace the whole of `app/src/lib/design/theme.css` with:

```css
@import './fonts.css';

/* Industry design system — steel blue on a light technical ground, zero radius,
   blueprint frames with registration corners. Values from the v2 handoff. */
:root {
  --color-bg: #f2f2f3;
  --color-surface: #e9e9ea;
  --color-text: #1d1f20;
  --color-accent: #5980a6;
  --color-divider: color-mix(in srgb, #1d1f20 16%, transparent);

  --color-neutral-300: #d4d4d7;
  --color-neutral-600: #7a7a7d;
  --color-neutral-700: #5d5d60;

  --color-accent-200: #d6ebff;
  --color-accent-300: #b5d9fd;
  --color-accent-400: #94bce3;
  --color-accent-500: #749dc4;
  --color-accent-600: #597ea3;
  --color-accent-700: #416180;
  --color-accent-800: #2c455d;
  --color-accent-900: #1d2d3d;

  --font-heading: 'Barlow Condensed', system-ui, sans-serif;
  --font-body: 'Barlow', system-ui, sans-serif;

  --space-2: 6.8px;
  --space-3: 10.2px;
  --space-4: 13.6px;
  --space-6: 20.4px;

  color-scheme: light;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
  color: var(--color-text);
  background: var(--color-bg);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

h1, h2, h3 { font-family: var(--font-heading); font-weight: 600; line-height: 1.12; margin: 0 0 var(--space-2); }
h1 { font-size: 34px; line-height: 1; }
h2 { font-size: 26px; }
h3 { font-size: 17px; }

button, input, textarea, select { font: inherit; }
button { min-height: 44px; min-width: 44px; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

.muted { color: var(--color-neutral-600); }

/* — blueprint frame: 1px rule plus four registration crosses — */
.blueprint { position: relative; border: 1px solid var(--color-divider); border-radius: 0; }
.blueprint > .corner {
  position: absolute; width: 11px; height: 11px;
  color: color-mix(in srgb, var(--color-text) 55%, transparent);
}
.blueprint > .corner::before, .blueprint > .corner::after { content: ''; position: absolute; background: currentColor; }
.blueprint > .corner::before { left: 5px; top: 0; width: 1px; height: 100%; }
.blueprint > .corner::after { top: 5px; left: 0; width: 100%; height: 1px; }
.blueprint > .corner.tl { top: -6px; left: -6px; }
.blueprint > .corner.tr { top: -6px; right: -6px; }
.blueprint > .corner.bl { bottom: -6px; left: -6px; }
.blueprint > .corner.br { bottom: -6px; right: -6px; }

/* — buttons — */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-family: var(--font-heading); font-weight: 600; font-size: 15px; line-height: 1.2;
  color: var(--color-text); background: transparent;
  border: 1px solid transparent; border-radius: 0;
  padding: var(--space-2) var(--space-4); cursor: pointer;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); }
.btn-primary:hover { background: var(--color-accent-600); }
.btn-primary:active { background: var(--color-accent-700); }
.btn-secondary { border-color: var(--color-divider); }
.btn-secondary:hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.btn-secondary:active { background: color-mix(in srgb, var(--color-text) 14%, transparent); }
.btn-ghost { color: var(--color-accent); }
.btn-ghost:hover { background: color-mix(in srgb, var(--color-accent) 10%, transparent); }
.btn-icon { width: 44px; height: 44px; padding: 0; }

/* A bare tap target: 44px for the finger, no box for the eye. Used by the
   checkbox and the "→ jutro" affordance, which must stay real buttons so the
   accessible name survives. */
.tap {
  display: inline-grid; place-items: center;
  background: none; border: none; padding: 0; color: inherit;
  min-width: 44px; min-height: 44px; cursor: pointer;
}

/* — tags — */
.tag { display: inline-flex; align-items: center; font-size: 11px; letter-spacing: 0.02em; padding: 3px 10px; border-radius: 0; }
.tag-accent { background: var(--color-accent-200); color: var(--color-accent-800); }
.tag-neutral { background: var(--color-surface); color: var(--color-neutral-700); }
.tag-outline { border: 1px solid var(--color-accent); color: var(--color-accent); }

/* — fields — */
.input {
  width: 100%; min-height: 44px; padding: 6px 10px; font-size: 15px;
  color: var(--color-text); caret-color: var(--color-accent);
  background: var(--color-surface);
  border: 1px solid var(--color-divider); border-radius: 0;
}
.input:focus-visible { border-color: var(--color-accent); outline-offset: 0; }

/* — the shared time axis (DayView, and later WeekView / History) — */
.axis { display: grid; grid-template-columns: 56px 1fr; column-gap: 14px; }
.axis > .axis-time {
  font-family: var(--font-heading); color: var(--color-neutral-700);
  padding: 12px 0; border-right: 1px solid var(--color-divider);
}
.axis > .axis-body { padding: 12px 0; border-bottom: 1px solid var(--color-divider); font-size: 15px; }
.axis > .axis-body.axis-tail { border-bottom: none; font-size: 12px; color: var(--color-neutral-600); }

/* — chrome — */
nav.tabs {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; background: var(--color-bg);
  border-top: 1px solid var(--color-divider);
  padding-bottom: env(safe-area-inset-bottom);
  font-family: var(--font-heading); font-size: 15px; letter-spacing: 0.03em;
}
nav.tabs a { flex: 1; text-align: center; padding: 12px 0; text-decoration: none; color: var(--color-text); }
nav.tabs a.active { color: var(--color-accent-700); border-top: 2px solid var(--color-accent); margin-top: -1px; }

main { padding: 8px 20px 0; padding-bottom: 96px; }

.week-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.section-collapsed { color: var(--color-neutral-700); }
.container-header { background: none; border: none; padding: 0; text-align: left; }

/* .sheet keeps its name: CLAUDE.md documents `.sheet` / `.overlay .sheet` as the
   e2e scoping idiom, because the screen behind an overlay shares button labels. */
.sheet { padding: 14px; border: 1px solid var(--color-divider); border-radius: 0; margin: 8px 0; }

.overlay {
  position: fixed; inset: 0; overflow: auto;
  background: var(--color-bg); z-index: 10;
  padding: 16px;
  padding-top: calc(16px + env(safe-area-inset-top));
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:e2e -- theme.spec.ts`
Expected: 3 passed.

- [ ] **Step 5: Verify nothing else regressed**

Run: `npm run check && npm run test:unit && npm run test:e2e`
Expected: 0 errors / 15 warnings; 61 unit passed; 19 e2e passed (14 old + 2 fonts + 3 theme). Any old-spec failure here is a real regression from the CSS rewrite — fix it before committing, do not adjust the old spec.

- [ ] **Step 6: Look at the screens this rewrite touches without restyling**

`theme.css` is global: the new `h1`/`h2`/`h3` sizes, `main` padding, body font and zero-radius `.sheet` land on every screen now. Run `npm run dev`, open `http://localhost:5173` at 390×844 and walk `#/lista`, `#/kalendarz`, `#/ustawienia`, `#/historia`, the task editor, the event editor, and onboarding (clear `localStorage.onboarded`). Expected: old markup in new type — inconsistent by design, but nothing clipped, overlapping, or unreadable. A 34px `h1` at `line-height: 1` breaking a layout is a Task 2 bug: fix it here (scoped override in that component is acceptable), do not defer it. Stop the dev server afterwards.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/design/theme.css app/tests/e2e/theme.spec.ts
git commit -m "feat: replace theme.css with the Industry token layer and primitives"
```

---

### Task 3: Copy and format helpers

**Files:**
- Create: `app/src/lib/design/format.ts`
- Create: `app/tests/unit/format.test.ts`
- Modify: `app/src/lib/design/strings.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `shortDate(d: Date): string` → `'Pt 04.09'`
  - `taskCount(n: number): string` → `'1 zadanie'` / `'3 zadania'` / `'5 zadań'`
  - new string keys: `dailyList.sectionNameA/B/C`, `dailyList.moveShort`, `dailyList.doneSeparator`, `dailyList.doneListSeparator`, `dailyList.taskCountForms`, `dailyList.addTask`, `calendar.restFree`, `calendar.until`, `dates.weekdaysShort`

`sectionA/B/C` are **not** deleted in this task — Task 5 is the only consumer and deletes them there, so this task can land green on its own.

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shortDate, taskCount } from '../../src/lib/design/format';

describe('shortDate', () => {
  it('renders a Polish short weekday with a zero-padded day and month', () => {
    // 2026-09-04 is a Friday; noon-anchored so no timezone can shift the day
    expect(shortDate(new Date('2026-09-04T12:00:00'))).toBe('Pt 04.09');
  });

  it('pads single-digit days and months', () => {
    expect(shortDate(new Date('2026-01-05T12:00:00'))).toBe('Pn 05.01');
  });

  it('covers every weekday, Sunday included', () => {
    // padStart: `2026-09-010` is not ISO and parses as Invalid Date
    const week = [4, 5, 6, 7, 8, 9, 10].map((d) => shortDate(new Date(`2026-09-${String(d).padStart(2, '0')}T12:00:00`)));
    expect(week).toEqual(['Pt 04.09', 'So 05.09', 'Nd 06.09', 'Pn 07.09', 'Wt 08.09', 'Śr 09.09', 'Cz 10.09']);
  });
});

describe('taskCount', () => {
  it('uses the singular for exactly one', () => {
    expect(taskCount(1)).toBe('1 zadanie');
  });

  it('uses the "few" form for 2-4', () => {
    expect(taskCount(2)).toBe('2 zadania');
    expect(taskCount(3)).toBe('3 zadania');
    expect(taskCount(4)).toBe('4 zadania');
  });

  it('uses the "many" form for 5 and up', () => {
    expect(taskCount(5)).toBe('5 zadań');
    expect(taskCount(11)).toBe('11 zadań');
    expect(taskCount(25)).toBe('25 zadań');
  });

  it('keeps the Polish teens rule: 12-14 are "many", not "few"', () => {
    expect(taskCount(12)).toBe('12 zadań');
    expect(taskCount(22)).toBe('22 zadania');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- format`
Expected: FAIL — `Failed to resolve import "../../src/lib/design/format"`.

- [ ] **Step 3: Add the new strings**

In `app/src/lib/design/strings.ts`, add to the `dailyList` object (after `sectionC`):

```ts
    sectionNameA: 'Najważniejsze',
    sectionNameB: 'Mniej pilne',
    sectionNameC: 'Na później',
    moveShort: '→ jutro',
    // "Zrobione dziś · Pranie, Kot" — a dot after the label, commas between titles
    doneSeparator: ' · ',
    doneListSeparator: ', ',
    addTask: 'Dodaj zadanie',
    taskCountForms: { one: 'zadanie', few: 'zadania', many: 'zadań' },
```

Add to the `calendar` object (after `emptyDay`):

```ts
    restFree: 'Reszta dnia jest wolna.',
    until: (time: string) => `do ${time}`,
```

Add a new top-level block before the closing `} as const;`:

```ts
  dates: {
    // Intl 'pl-PL' emits "pt" lowercase with a trailing dot in some runtimes and
    // a comma in the long form — neither matches the design, so the abbreviations
    // are spelled out here. Index by Date.getDay(): 0 = Sunday.
    weekdaysShort: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'],
  },
```

- [ ] **Step 4: Write the minimal implementation**

Create `app/src/lib/design/format.ts`:

```ts
import { strings } from './strings';

/** "Pt 04.09" — the review-screen date. Composed by hand: pl-PL Intl gives
 *  "pt, 04.09" (comma, lowercase), which the design does not use. */
export function shortDate(d: Date): string {
  const weekday = strings.dates.weekdaysShort[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${day}.${month}`;
}

const plural = new Intl.PluralRules('pl-PL');

/** "3 zadania" — Polish has three forms and the 12-14 exception, so a template
 *  string is not enough ("5 zadania" would be wrong). */
export function taskCount(n: number): string {
  const forms = strings.dailyList.taskCountForms;
  const rule = plural.select(n);
  const word = rule === 'one' ? forms.one : rule === 'few' ? forms.few : forms.many;
  return `${n} ${word}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- format`
Expected: 7 passed. If the weekday test fails on `Śr`, the file was saved as non-UTF-8 — re-save it.

- [ ] **Step 6: Verify the whole suite**

Run: `npm run check && npm run test:unit`
Expected: 0 errors / 15 warnings; 68 passed (61 + 7).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/design/format.ts app/src/lib/design/strings.ts app/tests/unit/format.test.ts
git commit -m "feat: add Polish plural and short-date formatters for the redesign"
```

---

### Task 4: DayView time axis with a tail row

**Files:**
- Modify: `app/src/lib/calendar/DayView.svelte`
- Modify: `app/src/lib/review/DailyReview.svelte:29` (pass the new prop)
- Test: `app/tests/e2e/calendar.spec.ts` (append one test)

**Interfaces:**
- Consumes: `.axis` / `.axis-time` / `.axis-body` / `.axis-tail` (Task 2), `strings.calendar.restFree`, `strings.calendar.until` (Task 3).
- Produces: `DayView` gains `tail?: 'restFree' | 'none'` (default `'none'`). `WeekView.svelte:38` renders `DayView` seven times and must keep the default — without the prop the "rest of the day is free" line would print once per day.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/e2e/calendar.spec.ts`:

```ts
test('the rest-of-day line belongs to the review screen only, never to the week view', async ({ page }) => {
  // every test starts on an empty DB; with no event today the tail row prints
  // emptyDay, not restFree — so create one first
  await page.goto('/#/kalendarz');
  await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Np. wizyta u lekarza').fill('Wizyta');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Wizyta' })).toBeVisible();
  await expect(page.getByText('Reszta dnia jest wolna.')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Wizyta' })).toBeVisible();
  await expect(page.getByText('Reszta dnia jest wolna.')).toHaveCount(1);
});

test('an empty day on the review screen closes the axis with the empty-day line, not the rest-of-day line', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.axis-tail')).toHaveText('Nic w kalendarzu. To też jest informacja.');
  await expect(page.getByText('Reszta dnia jest wolna.')).toHaveCount(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- calendar.spec.ts`
Expected: 2 FAIL — the first on its last assertion (the review screen renders 0 `restFree`, not 1), the second because no `.axis-tail` element exists yet.

- [ ] **Step 3: Rewrite DayView**

Replace `app/src/lib/calendar/DayView.svelte` with:

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { CalendarEvent } from '../models/types';
  import { eventsOn, tasksScheduledOn, dayTimeline, type TaskRowsMode } from '../models/calendarQueries';
  import { strings } from '../design/strings';

  // tail: only the review screen closes the axis with "the rest of the day is
  // free" — WeekView renders this component once per day and would repeat it.
  let { day, onedit, tasks = 'all', tail = 'none' }: {
    day: Date;
    onedit: (event: CalendarEvent) => void;
    tasks?: TaskRowsMode;
    tail?: 'restFree' | 'none';
  } = $props();
  const events = liveQuery(() => db.events.toArray());
  const taskRows = liveQuery(() => db.tasks.toArray());

  const dayEvents = $derived(eventsOn($events ?? [], day));
  const dayTasks = $derived(tasksScheduledOn($taskRows ?? [], day));
  const timeline = $derived(dayTimeline(dayEvents, dayTasks, tasks));

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
</script>

{#if timeline.length === 0 && tail === 'none'}
  <p class="muted">{strings.calendar.emptyDay}</p>
{/if}

<div class="axis">
  {#each timeline as entry (entry.kind + ':' + (entry.kind === 'event' ? entry.event.id : entry.task.id))}
    {#if entry.kind === 'event'}
      <div class="axis-time">{fmtTime(entry.event.startsAt)}</div>
      <div class="axis-body">
        <button class="row-btn" onclick={() => onedit(entry.event)}>
          {entry.event.title}
          {#if entry.event.endsAt}<span class="until">{strings.calendar.until(fmtTime(entry.event.endsAt))}</span>{/if}
        </button>
      </div>
    {:else}
      <div class="axis-time">{entry.task.scheduledTime ?? '—'}</div>
      <div class="axis-body">{entry.task.title}</div>
    {/if}
  {/each}

  {#if tail === 'restFree'}
    <div class="axis-time">—</div>
    <div class="axis-body axis-tail">
      {timeline.length === 0 ? strings.calendar.emptyDay : strings.calendar.restFree}
    </div>
  {/if}
</div>

<style>
  /* the whole row is the target, so the button carries no chrome of its own */
  .row-btn {
    display: block; width: 100%; text-align: left;
    background: none; border: none; padding: 0; font: inherit; color: inherit;
    min-height: 44px; cursor: pointer;
  }
  .until { display: block; font-size: 12px; color: var(--color-neutral-600); }
</style>
```

- [ ] **Step 4: Pass the prop from the review screen**

In `app/src/lib/review/DailyReview.svelte`, replace line 29:

```svelte
  <DayView day={today} tasks="none" tail="restFree" onedit={(e) => (editingEvent = e)} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:e2e -- calendar.spec.ts`
Expected: 5 passed (3 existing + 2 new).

- [ ] **Step 6: Verify the whole suite**

Run: `npm run check && npm run test:e2e`
Expected: 0 errors / 15 warnings; 21 e2e passed.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/calendar/DayView.svelte app/src/lib/review/DailyReview.svelte app/tests/e2e/calendar.spec.ts
git commit -m "feat: render the day view as a time axis with an optional closing row"
```

---

### Task 5: DailyList as blueprint section plus collapsed tiles

**Files:**
- Modify: `app/src/lib/tasklist/DailyList.svelte`
- Modify: `app/src/lib/design/strings.ts` (delete the now-unused `sectionA/B/C`)
- Modify: `app/tests/e2e/daily-actions.spec.ts:65`

**Interfaces:**
- Consumes: `.blueprint`/`.corner`, `.tap` (Task 2); `taskCount()` (Task 3); `strings.dailyList.sectionNameA/B/C`, `.moveShort`, `.doneSeparator`, `.doneListSeparator` (Task 3).
- Produces: nothing for later tasks — but it **hands the "add task" button to Task 6**: this task removes the `Dodaj` button and the `QuickAdd` mount from `DailyList`, and Task 6 re-creates them in `DailyReview`. Between the two tasks there is no way to add a task from the review screen; that is why Task 6 must follow immediately.

Contract points this task must not break:
- the checkbox stays a `<button aria-label={strings.dailyList.markDone}>` — only its visible content becomes a 22px square;
- "→ jutro" stays a `<button aria-label={strings.dailyList.moveToTomorrow}>` — `moveShort` is visible text only;
- done-today stays `<ul class="muted"><li>` with a `<button aria-label={strings.dailyList.undoDone}>` per title — `daily-actions.spec.ts:52` counts those `li` elements to prove the C-1 container rule, and collapsing them into one text node would delete that guarantee. The single-line look comes from CSS, not from a single string.

- [ ] **Step 1: Write the failing test**

In `app/tests/e2e/daily-actions.spec.ts`, replace line 65:

```ts
  await expect(page.getByRole('heading', { name: 'Mniej pilne' })).toBeVisible();
```

And append a new test at the end of the file:

```ts
test('a collapsed section shows a Polish-correct task count and expands on tap', async ({ page }) => {
  await addTaskScheduledToday(page, 'Pilne raz', 'A — dziś/jutro');
  await addTaskScheduledToday(page, 'Mniej pilne raz', 'B — częściowo pilne');
  await addTaskScheduledToday(page, 'Mniej pilne dwa', 'B — częściowo pilne');

  await page.goto('/');
  // B stays collapsed while A has active tasks (protocol: all A before B)
  const tile = page.getByRole('button', { name: '2 zadania' });
  await expect(tile).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mniej pilne raz' })).toBeHidden();

  await tile.click();
  await expect(page.getByRole('button', { name: 'Mniej pilne raz' })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- daily-actions.spec.ts`
Expected: FAIL — the heading is still `B — mniej pilne`, and no button is named `2 zadania` (today it reads `B — mniej pilne (2) ▸`).

- [ ] **Step 3: Rewrite DailyList**

Replace `app/src/lib/tasklist/DailyList.svelte` with:

```svelte
<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../models/db';
  import type { Priority, Task } from '../models/types';
  import { activeTasks, doneTodayTasks, isEarlierThanToday } from '../models/queries';
  import { isCollapsed } from '../models/collapse';
  import { completeWithParent, uncompleteWithParent } from '../models/completion';
  import { moveToNextDay } from '../models/schedule';
  import { strings } from '../design/strings';
  import { taskCount } from '../design/format';

  let { onedit }: { onedit: (task: Task) => void } = $props();
  const tasks = liveQuery(() => db.tasks.toArray());
  let manuallyExpanded = $state<ReadonlySet<Priority>>(new Set());
  // day-dependent deriveds re-run when the app returns to foreground —
  // otherwise "today" stays frozen at mount across midnight
  let nowTick = $state(0);

  const active = $derived.by(() => {
    void nowTick;
    return activeTasks($tasks ?? []);
  });
  const doneToday = $derived.by(() => {
    void nowTick;
    return doneTodayTasks($tasks ?? []);
  });
  const nonEmpty = $derived(new Set(active.map((t) => t.priority)));
  const now = $derived.by(() => {
    void nowTick;
    return new Date();
  });

  const sections: { p: Priority; letter: string; name: string }[] = [
    { p: 'a', letter: 'A', name: strings.dailyList.sectionNameA },
    { p: 'b', letter: 'B', name: strings.dailyList.sectionNameB },
    { p: 'c', letter: 'C', name: strings.dailyList.sectionNameC },
  ];

  function expand(p: Priority) {
    manuallyExpanded = new Set(manuallyExpanded).add(p);
  }
  async function onComplete(task: Task) {
    await db.tasks.bulkPut(completeWithParent(task, $tasks ?? []));
  }
  async function onUncomplete(task: Task) {
    await db.tasks.bulkPut(uncompleteWithParent(task, $tasks ?? []));
  }
  async function onMove(task: Task) {
    moveToNextDay(task);
    await db.tasks.put(task);
  }
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

<section>
  {#if $tasks}
    {#if active.length === 0 && doneToday.length === 0}
      <p class="muted empty">{strings.dailyList.emptyState}</p>
    {/if}

    <!-- open sections first, each in its own blueprint frame -->
    {#each sections as { p, letter, name } (p)}
      {@const list = active.filter((t) => t.priority === p)}
      {#if list.length > 0 && !isCollapsed(p, nonEmpty, manuallyExpanded)}
        <div class="blueprint section" data-priority={p}>
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <!-- aria-label: without it the inline spans read as "ANajważniejsze" -->
          <h3 class="section-head" aria-label="{letter} {name}"><span class="letter" aria-hidden="true">{letter}</span>{name}</h3>
          {#each list as task (task.id)}
            <div class="task-row">
              <button class="tap" aria-label={strings.dailyList.markDone} onclick={() => onComplete(task)}>
                <span class="box"></span>
              </button>
              <button class="title" onclick={() => onedit(task)}>
                {task.title}
                {#if isEarlierThanToday(task, now)}<span class="muted note">{strings.dailyList.earlierDays}</span>{/if}
              </button>
              <button class="tap move" aria-label={strings.dailyList.moveToTomorrow} onclick={() => onMove(task)}>
                {strings.dailyList.moveShort}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}

    <!-- collapsed sections sit together underneath, as two small tiles -->
    <div class="tiles">
      {#each sections as { p, letter } (p)}
        {@const list = active.filter((t) => t.priority === p)}
        {#if list.length > 0 && isCollapsed(p, nonEmpty, manuallyExpanded)}
          <button class="tile section-collapsed" data-priority={p} aria-label="{letter} {taskCount(list.length)}" onclick={() => expand(p)}>
            <span class="letter" aria-hidden="true">{letter}</span>{taskCount(list.length)}<span class="chevron" aria-hidden="true">▸</span>
          </button>
        {/if}
      {/each}
    </div>

    {#if doneToday.length > 0}
      <!-- one visual line, but still one <li> per task: daily-actions.spec.ts
           counts these to prove an auto-completed container is not listed -->
      <p class="done-label muted">{strings.dailyList.doneToday}{strings.dailyList.doneSeparator}</p>
      <ul class="muted done-list">
        {#each doneToday as task, i (task.id)}
          <li>
            {#if i > 0}<span aria-hidden="true">{strings.dailyList.doneListSeparator}</span>{/if}
            <button class="undo" aria-label={strings.dailyList.undoDone} onclick={() => onUncomplete(task)}>{task.title}</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .empty { font-size: 15px; color: var(--color-neutral-700); }

  .section { padding: 14px 14px 12px; margin: 6px 6px 0; display: flex; flex-direction: column; gap: 4px; }
  .section-head { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; margin: 0; font-size: 17px; }

  .letter {
    display: grid; place-items: center; flex: none;
    width: 24px; height: 24px;
    font-family: var(--font-heading); font-weight: 600; font-size: 14px;
  }
  [data-priority='a'] .letter { background: var(--color-accent-800); color: var(--color-bg); }
  [data-priority='b'] .letter { background: var(--color-accent-500); color: var(--color-bg); }
  [data-priority='c'] .letter { background: var(--color-accent-300); color: var(--color-accent-900); }
  .tile .letter { width: 22px; height: 22px; font-size: 13px; }

  .task-row { display: flex; align-items: center; border-top: 1px solid var(--color-divider); min-height: 44px; }
  /* 22px square for the eye, 44px button for the finger */
  .box { width: 22px; height: 22px; border: 1px solid var(--color-accent-700); }
  .title {
    flex: 1; text-align: left; font: inherit; font-size: 15px; color: inherit;
    background: none; border: none; padding: 10px 4px; min-height: 44px; cursor: pointer;
  }
  .note { display: block; font-size: 12px; }
  .move { font-size: 12px; color: var(--color-accent-700); }

  /* no :empty rule — Svelte's {#each} leaves an anchor node inside, and an
     empty flex div costs no height here anyway */
  .tiles { display: flex; gap: 8px; }
  .tile {
    flex: 1; display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; min-height: 44px;
    background: none; border: 1px solid var(--color-divider);
    font: inherit; font-size: 14px; color: var(--color-neutral-700); cursor: pointer;
  }
  .chevron { margin-left: auto; }

  .done-label { display: inline; font-size: 13px; padding-left: 6px; margin: 0; }
  .done-list { display: inline; font-size: 13px; padding: 0 6px 0 0; list-style: none; margin: 0; }
  .done-list li { display: inline; }
  /* a word inside a running sentence: padding grows the hit area to ~40px,
     the negative margin keeps the line box at 13px so the sentence stays one line */
  .undo {
    font: inherit; font-size: 13px; color: inherit;
    background: none; border: none; cursor: pointer;
    padding: 12px 4px; margin: -12px 0; min-height: 0; min-width: 0;
  }
</style>
```

- [ ] **Step 4: Delete the superseded strings**

In `app/src/lib/design/strings.ts`, remove the three now-unused lines from `dailyList`:

```ts
    sectionA: 'A — najważniejsze',
    sectionB: 'B — mniej pilne',
    sectionC: 'C — na później',
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:e2e -- daily-actions.spec.ts`
Expected: 5 passed (4 existing, one of them with the new heading name, plus the new collapse test).

Note the recorded exception to the 44px rule: `.undo` is a word inside a running sentence, where a 44px box would break the line. The padding/negative-margin pair gives it a ~40px tall target without growing the line; if it still proves hard to hit on the phone during Task 7's device check, raise the padding rather than restructuring the line.

- [ ] **Step 6: Verify the whole suite**

Run: `npm run check && npm run test:unit && npm run test:e2e`
Expected: 0 errors / 15 warnings; 68 unit passed; 22 e2e passed.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/tasklist/DailyList.svelte app/src/lib/design/strings.ts app/tests/e2e/daily-actions.spec.ts
git commit -m "feat: rebuild the daily list as a blueprint section with collapsed priority tiles"
```

---

### Task 6: DailyReview skeleton and the bottom action block

**Files:**
- Modify: `app/src/lib/review/DailyReview.svelte`
- Test: `app/tests/e2e/smoke.spec.ts` (append one test)

**Interfaces:**
- Consumes: `shortDate()` (Task 3); `DayView`'s `tail` prop (Task 4); `DailyList` without its own add button (Task 5); `.btn`/`.btn-primary`/`.btn-ghost`/`.blueprint` (Task 2); `strings.dailyList.addTask`.
- Produces: the finished 1c screen.

`QuickAdd` moves here and now opens inside `.overlay` — it keeps its own `.sheet` wrapper, so `smoke.spec.ts:24`'s `.sheet` scoping keeps working for the five-step wizard. QuickAdd itself keeps its pre-redesign markup (an `h2` and three plain buttons); its 3c restyle is out of scope, so expect it to look old inside the new overlay and do not fix that here.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/e2e/smoke.spec.ts`:

```ts
test('the review screen adds a task straight onto today', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Przegląd dnia' })).toBeVisible();

  await page.getByRole('button', { name: 'Dodaj zadanie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Co jest do zrobienia?').fill('Zadanie z przeglądu');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'A — dziś/jutro' }).click();

  // lands on the daily list, not just the master list
  await expect(page.getByRole('button', { name: 'Zadanie z przeglądu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Najważniejsze' })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- smoke.spec.ts`
Expected: FAIL — no button named `Dodaj zadanie` exists (Task 5 removed the old `Dodaj`).

- [ ] **Step 3: Rewrite DailyReview**

Replace `app/src/lib/review/DailyReview.svelte` with:

```svelte
<script lang="ts">
  import type { CalendarEvent, Task } from '../models/types';
  import { strings } from '../design/strings';
  import { shortDate } from '../design/format';
  import DayView from '../calendar/DayView.svelte';
  import EventEditor from '../calendar/EventEditor.svelte';
  import DailyList from '../tasklist/DailyList.svelte';
  import TaskEditor from '../tasklist/TaskEditor.svelte';
  import QuickAdd from '../tasklist/QuickAdd.svelte';
  import BreakdownWizard from '../strategies/BreakdownWizard.svelte';
  import ProblemFormWizard from '../strategies/ProblemFormWizard.svelte';

  let editing = $state<Task | null>(null);
  let editingEvent = $state<CalendarEvent | null>(null);
  let breaking = $state<Task | null>(null);
  let problemForm = $state(false);
  let adding = $state(false);
  // recompute "today" when the app returns to foreground — otherwise the review
  // screen stays frozen at mount across midnight
  let nowTick = $state(0);
  const today = $derived.by(() => {
    void nowTick;
    return new Date();
  });
</script>

<svelte:document onvisibilitychange={() => { if (document.visibilityState === 'visible') nowTick += 1; }} />

<main class="review">
  <header>
    <h1>{strings.review.title}</h1>
    <span class="date">{shortDate(today)}</span>
  </header>

  <!-- tasks="none": the daily list below already shows today's tasks (spec §5) -->
  <DayView day={today} tasks="none" tail="restFree" onedit={(e) => (editingEvent = e)} />
  <DailyList onedit={(t) => (editing = t)} />

  <div class="actions">
    <button class="btn btn-primary blueprint add" onclick={() => (adding = true)}>
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      {strings.dailyList.addTask}
    </button>
    <button class="btn btn-ghost" onclick={() => (problemForm = true)}>{strings.review.problemFormEntry}</button>
  </div>

  {#if adding}
    <div class="overlay">
      <QuickAdd defaultToday onclose={() => (adding = false)} />
    </div>
  {/if}
  {#if editing}
    <div class="overlay">
      <TaskEditor task={editing} onclose={() => (editing = null)} onbreakdown={(t) => { breaking = t; editing = null; }} />
    </div>
  {/if}
  {#if editingEvent}
    <div class="overlay">
      <EventEditor event={editingEvent} onclose={() => (editingEvent = null)} />
    </div>
  {/if}
  {#if breaking}
    <div class="overlay">
      <BreakdownWizard parent={breaking} onclose={() => (breaking = null)} />
    </div>
  {/if}
  {#if problemForm}
    <div class="overlay">
      <ProblemFormWizard onclose={() => (problemForm = false)} />
    </div>
  {/if}
</main>

<style>
  /* one column, actions pinned to the bottom above the tabbar. body already
     carries padding-top: safe-area, so a bare 100dvh would always overflow by
     that much and the page would scroll even when short */
  .review {
    display: flex; flex-direction: column; gap: 18px;
    min-height: calc(100dvh - env(safe-area-inset-top));
  }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  header h1 { margin: 0; }
  .date {
    font-size: 13px; color: var(--color-neutral-700);
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .actions { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
  .add { width: 100%; min-height: 48px; }
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:e2e -- smoke.spec.ts`
Expected: 5 passed (4 existing + 1 new).

- [ ] **Step 5: Verify the whole suite**

Run: `npm run check && npm run test:unit && npm run test:e2e`
Expected: 0 errors / 15 warnings; 68 unit passed; 23 e2e passed.

- [ ] **Step 6: Look at it**

Run: `npm run dev`, open `http://localhost:5173` in a browser at 390×844 (DevTools device toolbar, iPhone 14 Pro). Check against the handoff prototype's 1c screen: header 34px Barlow Condensed with the date right-aligned on the same baseline; the time axis with its 56px hour column; section A framed with four corner crosses; B/C as two tiles; the done-today line; the primary button with its own corner crosses above the ghost button; the tabbar with a 2px accent line over the active tab. Stop the dev server afterwards.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/review/DailyReview.svelte app/tests/e2e/smoke.spec.ts
git commit -m "feat: rebuild the review screen to the 1c layout with a bottom action block"
```

---

### Task 7: Cross-browser verification, device check, documentation

**Files:**
- Modify: `CLAUDE.md`
- No source changes expected; any fix found here belongs in the task that introduced it.

**Interfaces:**
- Consumes: everything above.
- Produces: an updated project brief so the next session inherits the new conventions.

- [ ] **Step 1: Run the full suite on both engines**

Run: `npm run test:e2e:docker`
Expected: 46 passed (23 chromium + 23 webkit). WebKit is where this redesign is most likely to differ: `color-mix()` in `--color-divider`, `100dvh` on `.review`, and `place-items` on the letter squares. A WebKit-only failure is a real iOS bug — fix it, do not skip the test.

- [ ] **Step 2: Verify the production build**

Run: `npm run build`
Expected: build succeeds; the PWA line reports **≥ 17** precache entries (7 before + 10 woff2, plus whatever `ico,png,svg` the new glob picks up from `public/`). If the count is still 7, `globPatterns` did not take effect. Confirm explicitly:

```bash
grep -o '[A-Za-z-]*\.woff2' dist/sw.js | sort -u | wc -l
```

Expected: `10`.

- [ ] **Step 3: Deploy and check on the phone**

```bash
npm run deploy
```

Then on the iPhone, open the app from the home-screen icon (`https://cal-to-do-kk.pages.dev`) and confirm: Barlow renders (not the system font), the safe-area top is respected, section A's corner crosses are not clipped at the screen edge, the checkbox and "→ jutro" are comfortably tappable, and the tabbar sits above the home indicator. Then enable airplane mode and relaunch: the app must still load with Barlow intact.

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md`, under "Setup and commands", add to the command list:

```bash
npm run fonts       # re-download public/fonts/*.woff2 + OFL.txt, regenerate src/lib/design/fonts.css (dev-time only)
```

Under "Architecture", after the routing paragraph, add:

```markdown
**Design system:** `design/theme.css` holds the Industry tokens (steel-blue accent ramp on `#f2f2f3`, Barlow / Barlow Condensed, radius 0, no shadows) plus the shared primitives: `.blueprint` + `.corner.tl/.tr/.bl/.br` (framed block with registration crosses), `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-icon`, `.tag*`, `.input`, `.axis` (the `56px | 1fr` time axis), and `.tap` (a chrome-less 44px hit area). Fonts are **self-hosted** in `public/fonts/` with `src/lib/design/fonts.css` generated by `scripts/fetch-fonts.mjs` — never link a font CDN, it breaks both the no-network rule and offline launch, and `vite.config.ts` carries a `workbox.globPatterns` entry so the woff2 files are precached. `design/format.ts` holds presentation-only pure helpers (`shortDate`, `taskCount` with Polish plurals); domain logic still lives in `models/`.

**Class contract for tests:** `.sheet` and `.overlay` are kept as marker classes even where `.blueprint` supplies the styling — the e2e suite scopes modal buttons with them. Likewise the accessible names `oznacz jako zrobione`, `cofnij` and `Przełóż na jutro` are load-bearing: visible text may shrink to a glyph, the `aria-label` may not change.
```

Under "Status and what is deliberately missing", replace the first paragraph's task list with a line recording that the Industry redesign has landed for the review screen only:

```markdown
Redesign status: the Industry design system (handoff v2, screen 1c) is implemented for `#/` only — `DailyReview`, `DailyList`, `DayView`, the tabbar and `theme.css`. Every other screen (master list, calendar, editors, wizards, history, settings, onboarding) still uses the pre-redesign markup and will look inconsistent until the 2a–2g / 3a–3e sweep lands. That sweep is not planned yet; it needs a decision on whether the master list shows completed steps (`containerDescendants` filters them out today) and on day-grouping for history.
```

- [ ] **Step 5: Verify the baseline one final time**

Run: `npm run check && npm run test:unit && npm run test:e2e`
Expected: 0 errors / 15 warnings; 68 unit passed; 23 e2e passed. Report the real numbers; if a count differs from this plan, say so rather than adjusting the claim.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the Industry design system and the self-hosted font pipeline"
```

---

## Deliberately out of scope

Do not start these inside this plan; each needs its own decision or plan.

- **Screens 2a–2g and 3a–3e.** Estimated 3–5 days on their own. Two open questions block parts of it: 2a draws a completed step inside a container card, but `queries.ts:63` filters completed steps out of `containerDescendants`, so showing them is a product decision with a model change behind it; 2f wants history grouped by day, while `completedHistory` returns a flat list.
- **Master-list collapse.** The handoff's 2a mock implies A/B/C grouping with collapse on the master list. The collapse rule is currently a daily-list rule; applying it to undated tasks changes the protocol's meaning and needs a decision first.
- **Manifest and icon palette.** `theme_color` in `vite.config.ts` is still `#4a6fa5` while the design system's accent is `#5980a6`. Aligning the manifest colour is cheap; the icons are **not** — `public/icons/` now holds hand-designed artwork and `scripts/make-icons.mjs` is superseded, so never regenerate them into the default outdir. Changing the icon also changes how the user finds the app on their home screen, which is a deliberate call, not a cleanup.
- **Re-collapsing an expanded section.** `manuallyExpanded` only ever grows; there is no way back except a reload. The design does not ask for one.

## Self-review

**Spec coverage.** Handoff README §"Screen: Dziś (1c)" points 1–7: header (Task 6), day axis (Task 4), section A blueprint (Task 5), B/C tiles (Task 5), done-today line (Task 5), bottom actions (Task 6), tabbar (Task 2 CSS, verified in Task 6 step 6). §"Design Tokens" and §"Blueprint frame" and §"Buttons" → Task 2. §"Zakres zmian w repo" font line → Task 1, implemented as self-hosting because the CDN form is forbidden. §"Interactions & Behavior" → preserved by construction: no animations are added, ticking stays dialog-free, `isCollapsed` is untouched, and the empty state keeps `strings.dailyList.emptyState` (README:61's version; README:34's split heading belongs to screen 3e and is out of scope here). §"State Management" "no changes" → honoured; `liveQuery`, `activeTasks`, `doneTodayTasks`, `isCollapsed`, `nowTick` all keep their current shapes. The five strings README:44 promises are all present, plus the ones the prototype needs that it forgot.

**Placeholder scan.** No TBD/TODO, no "handle edge cases", no "similar to Task N": every code step carries the full file or the exact replacement line, and both new test files are written out in full.

**Deliberate deviations from the handoff.** `.btn` has a transparent border and `.btn-secondary` adds the divider (the handoff puts the divider on `.btn` and clears it on `.btn-ghost`) — same rendered result for the three variants used, one fewer override. `font-display: swap` is kept even though the files are precached: it only costs a swap on the very first online launch. `:focus { outline: none }` is global and also reaches the un-restyled screens; `:focus-visible` restores the ring everywhere.

**Type consistency.** `tail?: 'restFree' | 'none'` is declared in Task 4 and consumed in Task 4 step 4 and Task 6 step 3 with the same literal. `shortDate(d: Date): string` and `taskCount(n: number): string` are defined in Task 3 and called in Task 6 and Task 5 respectively with those signatures. `strings.dailyList.taskCountForms` is written in Task 3 step 3 and read in Task 3 step 4 under the same path. `sectionNameA/B/C` are added in Task 3 and consumed in Task 5, where the superseded `sectionA/B/C` are deleted — no task reads a key another task removed before it runs. `.tap`, `.blueprint`, `.corner`, `.axis*` are defined in Task 2 and used in Tasks 4–6 under those exact names.

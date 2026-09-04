import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
  },
  // webkit needs system libraries (libevent, gstreamer, libavif) that a fresh host
  // usually lacks — `npx playwright install-deps webkit` installs them; until then
  // run only chromium rather than fail every invocation of `npm run test:e2e`.
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(process.env.E2E_WEBKIT ? [{ name: 'webkit', use: { browserName: 'webkit' as const } }] : []),
  ],
});

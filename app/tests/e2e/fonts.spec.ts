import { test, expect } from '@playwright/test';
import { bypassOnboarding } from './utils';

// bypass onboarding: that screen has no heading and no .btn, so nothing on it
// would ever request Barlow Condensed and the face would stay "unloaded"
test.beforeEach(({ page }) => bypassOnboarding(page));

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
  // generateSW inlines the precache manifest; all ten woff2 files (public/fonts/)
  // must be in it, or a globPatterns regression dropping a subset falls back to
  // system-ui offline for the missing weights/subsets without failing this test
  expect((await sw.text()).match(/\.woff2/g) ?? []).toHaveLength(10);
});

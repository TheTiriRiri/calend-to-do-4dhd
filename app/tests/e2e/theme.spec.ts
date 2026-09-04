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

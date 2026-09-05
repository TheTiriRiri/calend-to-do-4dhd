import { test, expect } from '@playwright/test';
import { bypassOnboarding } from './utils';

// The app is installed to the home screen and is rarely quit — it is normally
// resumed, not launched. "Today" is therefore recomputed on visibilitychange
// (DailyReview/DailyList/WeekView), and this spec is the only place that proves
// the resume path: a task scheduled for the day the app was opened must still be
// on the list after midnight, now flagged as coming from an earlier day.
const OPENED_AT = new Date('2026-09-05T09:00:00');
const NEXT_MORNING = new Date('2026-09-06T09:00:00');
const SCHEDULED_DAY = '2026-09-05';

test('the daily list follows the clock across midnight when the app returns to foreground', async ({ page }) => {
  await page.clock.install({ time: OPENED_AT });
  await bypassOnboarding(page);

  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Zadanie przez północ');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await page.getByText('Zadanie przez północ').click();
  await page.getByLabel(/Dzień/).fill(SCHEDULED_DAY);
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();

  await page.goto('/');
  await expect(page.getByText('05.09')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zadanie przez północ' })).toBeVisible();
  await expect(page.getByText('z wcześniejszych dni')).toBeHidden();

  // the phone sat locked overnight; the app was never reloaded
  await page.clock.setSystemTime(NEXT_MORNING);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByText('06.09')).toBeVisible();
  // rollover is a query result, not a copy job: same row, still active, now labelled
  await expect(page.getByRole('button', { name: 'Zadanie przez północ' })).toBeVisible();
  await expect(page.getByText('z wcześniejszych dni')).toBeVisible();
});

test('a task completed yesterday leaves the done-today strip and stays in history', async ({ page }) => {
  await page.clock.install({ time: OPENED_AT });
  await bypassOnboarding(page);

  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Wczorajszy sukces');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await page.getByText('Wczorajszy sukces').click();
  await page.getByLabel(/Dzień/).fill(SCHEDULED_DAY);
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();

  await page.goto('/');
  await page.getByRole('button', { name: 'oznacz jako zrobione' }).click();
  await expect(page.getByText('Zrobione dziś')).toBeVisible();

  await page.clock.setSystemTime(NEXT_MORNING);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  // the strip is today's proof of work only — yesterday's win moves to history,
  // it is never deleted (dateCompleted is the record)
  await expect(page.getByText('Zrobione dziś')).toBeHidden();
  await page.goto('/#/historia');
  await expect(page.getByText('Wczorajszy sukces')).toBeVisible();
});

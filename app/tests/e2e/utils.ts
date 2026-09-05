import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** The three priority buttons the task editor offers, by visible label. */
export type PriorityLabel = 'A — dziś/jutro' | 'B — częściowo pilne' | 'C — może poczekać';

/** Local yyyy-mm-dd, the format the day input takes — never toISOString(), which
 *  shifts to UTC and can land on the wrong calendar day. */
export function localDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('sv-SE');
}

/** Most specs start past the onboarding gate; onboarding.spec.ts is the one flow
 *  that runs it for real. The reload is what makes App.svelte re-read the flag. */
export async function bypassOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
}

/** Adds a task through the UI and schedules it onto a daily list: `daysAgo` 0 is
 *  today, higher values backdate it so it shows up as rolled over. */
export async function addTaskScheduled(
  page: Page,
  title: string,
  priority: PriorityLabel,
  daysAgo = 0,
): Promise<void> {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill(title);
  await page.getByRole('button', { name: priority }).click();
  await page.getByText(title).click();
  await page.getByLabel(/Dzień/).fill(localDay(-daysAgo));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();
}

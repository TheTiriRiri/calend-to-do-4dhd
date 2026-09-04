import { test, expect } from '@playwright/test';

test('onboarding walks through all three screens and lands on the review screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Dwa narzędzia: kalendarz')).toBeVisible();
  await page.getByRole('button', { name: 'Dalej' }).click();

  await expect(page.getByText('O której porze przejrzysz dzień?')).toBeVisible();
  await page.getByRole('button', { name: 'Dalej' }).click();

  await expect(page.getByText('Dodaj pierwsze zadanie.')).toBeVisible();
  await page.getByRole('button', { name: 'Zaczynam' }).click();

  await expect(page.getByRole('heading', { name: 'Przegląd dnia' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('onboarded'))).toBe('1');
});

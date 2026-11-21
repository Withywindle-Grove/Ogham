// Opens the full sheet's own page through the campaign's menu (≡'s drawer on a phone, ⋯ on a tablet): the Player tab's
// own row "Full character sheet" is gone (row C10, tfr-4, tfr-5); the page stays while ⚑ 11 is open.
import { expect, type Page } from '@playwright/test';

export async function openFullSheetFromMenu(page: Page): Promise<void> {
  if (page.viewportSize()!.width < 600) await page.locator('.top-row').getByRole('button', { name: 'Menu' }).click();
  else await page.getByRole('button', { name: 'Character options' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
  await expect(page.locator('.top-row__title', { hasText: /^Full sheet$/ })).toBeVisible();
}

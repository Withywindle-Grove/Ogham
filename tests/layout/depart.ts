// The layout checks' way to start an expedition from the open Depart sheet (plan scene-point-to-point B7; page 24,
// DP1): Where? is required before Start (⚑ 4), so where nothing is picked yet a place is typed under Other… first,
// then Start is tapped. Shared by the specs so the flow lives in one place, as `src/testing/depart.ts` is for the
// screen tests.
import type { Page } from '@playwright/test';

/** The place a check's expedition starts at when it gives none. */
export const ANY_PLACE = 'The Mustering Field';

/** Taps the open Depart sheet's Start, typing `where` under Where?'s Other… first if nothing is picked. */
export async function departStart(page: Page, where: string = ANY_PLACE): Promise<void> {
  const sheet = page.getByRole('dialog', { name: /Depart$/ });
  const unpicked = sheet.getByRole('button', { name: 'Where?: Pick a Location' });
  if ((await unpicked.count()) > 0) {
    await unpicked.click();
    await page.getByRole('button', { name: /^Other…/ }).click();
    await page.getByRole('textbox', { name: "A place that isn't listed" }).fill(where);
    await page.getByRole('button', { name: 'Set place' }).click();
  }
  await sheet.getByRole('button', { name: 'Start' }).click();
}

/** Opens the Depart sheet's Where? list on the layout page's quay with `places` (`isle`, `marches`); gives the list. */
export async function openDepartWhere(page: Page, places: string) {
  await page.goto(`/layout.html?as=gm&town=town&places=${places}`);
  await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
  await page.getByRole('button', { name: 'Depart' }).click();
  await page.getByRole('dialog', { name: /Depart$/ }).getByRole('button', { name: 'Where?: Pick a Location' }).click();
  const picker = page.getByRole('dialog', { name: /Where\?$/ });
  await picker.getByRole('textbox', { name: 'Search places by name or map number' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return picker;
}

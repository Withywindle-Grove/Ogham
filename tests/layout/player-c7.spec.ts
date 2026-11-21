// The burden's levels as a pop-up (plan test-feedback-2026-11-19, row C7; ruling tfb-4; mockup december/26, approved
// 2026-11-19 with fixes, frame M2h), on the shared P1-like character (layout.html?as=player&p1=1, Brannoch Fenward;
// src/testing/layoutP1Character.ts), in a real browser on a phone (375 px) and a tablet held sideways (1180 px), in
// light and dark. Purposes, in plain words:
//   1. On the Player tab a tap on the burden ("Light") opens a pop-up titled "Burden" with the levels as a book table,
//      the character's own row in bold; the page under it does not move (Movement and the section after it stay where
//      they were); nothing in it runs past the screen, nothing is under 14 px, and it passes the accessibility check.
//      Escape closes it and focus is back on the burden.
//   2. Over the limit (999 bundles of reeds), the pop-up's last row, "Over the limit", is the bold one, and the long
//      figure fits.
//   1a. The table's title band is left-aligned, as M2h draws it (Francis's fix of 2026-11-20).
//   3. On the Pack tab the same tap opens the same pop-up, and the Pack under it does not move.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openPlayer(page: Page, width: number, height: number, scheme: 'light' | 'dark', p1 = '1') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** Where a part of the page sits, rounded: the page under the pop-up must keep it. */
const placeOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  return box && { x: Math.round(box.x), y: Math.round(box.y), height: Math.round(box.height) };
};

/** The smallest text in the pop-up, in px. */
const smallestText = (dialog: Locator) =>
  dialog.evaluate((el) => Math.min(...[...el.querySelectorAll<HTMLElement>('p, td, th, caption, span, h2')].filter((n) => n.textContent?.trim()).map((n) => parseFloat(getComputedStyle(n).fontSize))));

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Player tab: the burden opens its levels in a pop-up and the page doesn't move (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      const movement = page.getByRole('region', { name: 'Movement' });
      const tier = movement.locator('.pack__tier');
      await tier.scrollIntoViewIfNeeded();
      const before = await placeOf(movement);
      const load = await placeOf(movement.locator('.pack__load'));
      await tier.click();
      const dialog = page.getByRole('dialog', { name: 'Burden' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('region', { name: 'Burden by weight' })).toBeVisible();
      await expect(dialog.locator('.book-table__marked')).toHaveCount(1);
      // The table's title band is left-aligned, as M2h draws it (Francis's fix of 2026-11-20).
      expect(await dialog.locator('.book-table caption').first().evaluate((el) => getComputedStyle(el).textAlign)).toMatch(/^(start|left)$/);
      await expect(movement.locator('.pack__explain')).toHaveCount(0);
      expect(await placeOf(movement)).toEqual(before);
      expect(await placeOf(movement.locator('.pack__load'))).toEqual(load);
      expect(await smallestText(dialog)).toBeGreaterThanOrEqual(14);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c7-burden-${size.width}-${scheme}.png` });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(tier).toBeFocused();
    });

    test(`Player tab, over the limit at 999: the last row is the bold one and it fits (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme, 'heavy');
      const tier = page.getByRole('region', { name: 'Movement' }).locator('.pack__tier');
      await tier.scrollIntoViewIfNeeded();
      await tier.click();
      const dialog = page.getByRole('dialog', { name: 'Burden' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.book-table__marked td').first()).toHaveText(/^Over the limit/);
      await expect(dialog.locator('tbody tr').last()).toHaveClass(/book-table__marked/);
      expect(await layoutProblems(page)).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c7-burden-over-${size.width}-${scheme}.png` });
    });

    test(`Pack tab: the burden opens the same pop-up and the Pack doesn't move (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
      const tier = page.locator('.pack__load .pack__tier').first();
      await expect(tier).toBeVisible();
      const load = await placeOf(page.locator('.pack__load').first());
      await tier.click();
      const dialog = page.getByRole('dialog', { name: 'Burden' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('region', { name: 'Burden by weight' })).toBeVisible();
      await expect(page.locator('.pack__explain')).toHaveCount(0);
      expect(await placeOf(page.locator('.pack__load').first())).toEqual(load);
      expect(await layoutProblems(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(tier).toBeFocused();
    });
  }
}

// The revealed result on the players' Scene (sf-7b; page 44's EN5, approved 2026-11-26), in a real browser on the
// layout page: ?revealed=1 has the GM's reveal of a hit standing, so the player's prompt slot holds its card;
// ?revealed=long, a reveal of forty-odd words. What it checks, in plain words:
//   * the card stands in the players' prompt slot, inside the screen, under the top's band; its "Got it" is 44 px and
//     plain (not the accent); the words keep their column beside "Got it", on a tablet and at 375 px (EN5 A, B);
//   * a long reveal wraps inside the card, with nothing scrolling sideways;
//   * with the device remembering a folded top, the card still stands (the slot is not part of the fold);
//   * "Got it" puts the card away, and it stays away when the page opens again on this device;
//   * no text under 14 px, every tap 44 px, axe finds no serious problem, at 375 and 1024 px, light and dark.
// Each test saves its pictures (the built screen beside EN5 in the pull request).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, flag: '1' | 'long' = '1') {
  await page.goto(`/layout.html?as=player&placePage=spots&session=running&revealed=${flag}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
}

const card = (page: Page) => page.locator('.prompt-slot .call-card--encounter');

for (const width of [375, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the revealed card on the players' Scene (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (EN5 A, B): the card stands in the slot under the top, inside the screen, its words beside a plain
      // "Got it" a finger can tap.
      test('stands in the slot under the top, the words beside a plain Got it', async ({ page }) => {
        await openScene(page);
        await expect(card(page).getByRole('heading', { name: 'An encounter' })).toBeVisible();
        await expect(card(page).getByText('Two grey shapes rise from the weed and reach for the oars.')).toBeVisible();
        const gotIt = card(page).getByRole('button', { name: 'Got it: An encounter' });
        expect(await gotIt.getAttribute('class')).not.toContain('button-primary');
        const [box, button, words, band] = await Promise.all([card(page).boundingBox(), gotIt.boundingBox(), card(page).locator('.call-card__words').boundingBox(), page.locator('.scene-band').first().boundingBox()]);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y).toBeGreaterThanOrEqual(band!.y + band!.height);
        expect(button!.height).toBeGreaterThanOrEqual(44);
        expect(button!.width).toBeGreaterThanOrEqual(44);
        // EN5: the words keep their own column, left of "Got it", at both widths.
        expect(words!.x + words!.width).toBeLessThanOrEqual(button!.x);
        await card(page).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/players-revealed-card-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (overflow): a reveal of forty-odd words wraps inside the card; nothing scrolls sideways.
      test('a long reveal wraps inside the card', async ({ page }) => {
        await openScene(page, 'long');
        const words = card(page).locator('.call-card__words');
        await expect(words).toContainText('flown inland over the drowned customs house.');
        const [box, text] = await Promise.all([card(page).boundingBox(), words.boundingBox()]);
        expect(text!.x + text!.width).toBeLessThanOrEqual(box!.x + box!.width);
        expect(text!.height).toBeGreaterThan(48);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await card(page).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/players-revealed-card-long-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (EN5: "the card also shows if the top is folded"): with the device remembering a folded top, the card
      // still stands in the slot.
      test('stands with the top folded', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('grimoire.sceneTopOpen', 'folded'));
        await openScene(page);
        await expect(card(page).getByRole('heading', { name: 'An encounter' })).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (sf-23): "Got it" puts the card away, and this device remembers it when the page opens again.
      test('Got it puts it away, remembered on the device', async ({ page }) => {
        await openScene(page);
        await card(page).getByRole('button', { name: 'Got it: An encounter' }).click();
        await expect(card(page)).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem('grimoire.revealsGotIt'))).toBe('["reveal-reed"]');
        await openScene(page);
        await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
        await expect(card(page)).toHaveCount(0);
      });
    });
  }
}

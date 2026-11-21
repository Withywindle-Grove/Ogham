// The players' Activities (plan dec-9-the-players-scene, row P6, with P11 and P13; ruling mc-45a; frames 01-08,
// 01-08j, approved 2026-11-12; page 18, PL1 and PL5, approved 2026-11-14), in a real browser on the layout page's
// invented harbour with invented actions (?activities=1, =long). What it checks, in plain words:
//   * with something of the place shown, the card stands in the left column under the place's card; on a phone, in
//     the one column, before the marching order (PL5's order);
//   * its buttons in the pack's order, the one without rule text left out, each at least 44 px tall, a long name
//     wrapping inside its button and never past the card's edge;
//   * a tap opens the rule's sheet: "Activities", the name, the words, the source, and no button but the ✕;
//   * before anything is shown the card is there too, under "Somewhere new" (d5-18, 2026-11-20);
//   * nothing scrolls sideways, no text is under 14 px, and axe finds no serious problem, at 375, 834 and 1024 px, in
//     light and dark. Each test saves its picture.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, state: 'spots' | 'spot', activities: '1' | 'long' = '1') {
  await page.goto(`/layout.html?as=player&placePage=${state}&session=running&activities=${activities}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
}

for (const width of [375, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the players' Activities (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (PL1, PL5; 01-08): the card at the left under the place, its buttons in the pack's order, each a
      // 44 px tap, the long name wrapped inside its button; on a phone before the marching order.
      test('the card under the place', async ({ page }) => {
        await openScene(page, 'spots', 'long');
        const left = page.locator('.players-page__column[data-column="left"]');
        const card = left.getByRole('region', { name: 'Activities' });
        await expect(card).toBeVisible();
        const [placeBox, cardBox] = await Promise.all([left.getByRole('heading', { name: 'The Drowned Harbour' }).boundingBox(), card.boundingBox()]);
        expect(cardBox!.y).toBeGreaterThan(placeBox!.y + placeBox!.height);
        const buttons = card.getByRole('button');
        await expect(buttons).toHaveText(['Search', 'Listen', 'Force a door', 'Listen at the iron-bound door of the Drowned Customs House']);
        for (const box of await Promise.all((await buttons.all()).map((b) => b.boundingBox()))) {
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.x + box!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 0.5);
        }
        if (width < 768) {
          const order = await page.getByRole('heading', { name: 'Marching order' }).boundingBox();
          expect(order!.y).toBeGreaterThan(cardBox!.y + cardBox!.height);
        }
        await page.screenshot({ path: `test-results/layout-screens/players-activities-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (01-08j; mc-45a): a tap opens the rule in the rule's sheet, a reading aid with no button but the ✕.
      test('an activity’s rule', async ({ page }) => {
        await openScene(page, 'spots');
        await page.getByRole('region', { name: 'Activities' }).getByRole('button', { name: 'Force a door' }).click();
        const sheet = page.getByRole('dialog', { name: 'Force a door' });
        await expect(sheet.getByText('Activities', { exact: true })).toBeVisible();
        await expect(sheet.getByText('A stuck or barred door may be forced by one character at a time.')).toBeVisible();
        await expect(sheet.getByText('From your setting: Fen Rules, p. 88')).toBeVisible();
        await expect(sheet.getByRole('button')).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/players-activity-rule-${width}-${scheme}.png`, fullPage: false });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (d5-18, 2026-11-20): before anything of the place is shown the card stands at the left under
      // "Somewhere new", and the place's name is still nowhere on the page.
      test('the card before anything is shown', async ({ page }) => {
        await openScene(page, 'spot');
        const left = page.locator('.players-page__column[data-column="left"]');
        const somewhere = left.getByRole('heading', { name: 'Somewhere new' });
        const card = left.getByRole('region', { name: 'Activities' });
        await expect(somewhere).toBeVisible();
        await expect(card).toBeVisible();
        const [somewhereBox, cardBox] = await Promise.all([somewhere.boundingBox(), card.boundingBox()]);
        expect(cardBox!.y).toBeGreaterThan(somewhereBox!.y + somewhereBox!.height);
        await expect(page.locator('.players-page')).not.toContainText(/jetty/i);
        await page.screenshot({ path: `test-results/layout-screens/players-activities-before-shown-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

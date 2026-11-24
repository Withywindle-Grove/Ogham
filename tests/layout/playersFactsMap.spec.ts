// A player's tap on a fact (plan dec-9-the-players-scene P10; page 18, PL8) and the players' map (P5; 01-08, 01-08c,
// PL1, PL5b), in a real browser on the layout page's invented harbour. What it checks, in plain words:
//   * the Encounter check's and the Light fact's pop-ups: their labelled lines in the book's faces, nothing cut or
//     scrolling sideways, every tap 44 px, axe content; the Light pop-up's "Light" button at its foot's right;
//   * the shared map: first in the right column (under the left one on a phone), its picture and its title, no tools
//     cut, the pop-up opening on a tap;
//   * at 375, 834 and 1024 px, in light and dark. Each test saves its picture.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openHarbour(page: Page, map: boolean) {
  await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
  await page.goto(`/layout.html?as=player&placePage=spots&session=running${map ? '&map=shown' : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('group', { name: 'Scene facts' })).toBeVisible();
}

for (const width of [375, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`a player's facts and map (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (PL8): the Encounter check opens its pop-up with "When." and "Chance." as the book's labelled lines,
      // and nothing in it is cut or scrolls sideways.
      test('the Encounter check pop-up', async ({ page }) => {
        await openHarbour(page, false);
        await page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Encounter check:/ }).click();
        const pop = page.getByRole('dialog', { name: 'Encounter check' });
        await expect(pop.getByText('When.')).toBeVisible();
        await expect(pop.getByText('Chance.')).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-fact-check-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL8): the Light fact opens its pop-up with the group's light as a labelled line.
      test('the Light pop-up', async ({ page }) => {
        await openHarbour(page, false);
        const light = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:/ });
        test.skip((await light.count()) === 0, 'no Light fact on this page');
        await light.click();
        await expect(page.getByRole('dialog', { name: 'Light' }).locator('.book-label').first()).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-fact-light-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL8): the Light pop-up ends with the player's "Light" button (the torch over the word) at the right, a
      // 44 px target, nothing cut; the pick it opens with several lights is At hand's own.
      test('the Light pop-up’s Light button', async ({ page }) => {
        await openHarbour(page, false);
        const light = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:/ });
        await light.click();
        const pop = page.getByRole('dialog', { name: 'Light' });
        const button = pop.getByRole('button', { name: 'Light', exact: true });
        await expect(button).toBeVisible();
        const box = (await button.boundingBox())!;
        const card = (await pop.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        // At the foot's right, as PL8 draws it.
        expect(card.x + card.width - (box.x + box.width)).toBeLessThan(48);
        await page.screenshot({ path: `test-results/layout-screens/players-fact-light-button-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (P5; PL1, PL5b): the shared map stands first in the right column with its picture and title; a tap on
      // it opens the pop-up.
      test('the shared map', async ({ page }) => {
        await openHarbour(page, true);
        const right = page.locator('.players-page__column[data-column="right"]');
        const map = right.getByRole('region', { name: 'The map' });
        await expect(map.locator('img')).toBeVisible();
        await expect(map.locator('.map-tools > .map-tools__title')).toHaveText('The Drowned Harbour, the harbour chart');
        expect(await right.locator('> *').first().locator('.map-card').count()).toBe(1);
        await map.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/players-map-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await map.locator('img').click();
        await expect(page.getByRole('dialog', { name: /The map/ })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-map-open-${width}-${scheme}.png` });
      });
    });
  }
}

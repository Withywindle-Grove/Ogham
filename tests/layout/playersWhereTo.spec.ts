// A player's Where to? on the Scene (plan dec-9-the-players-scene, row P2, with P11 and P13; page 18 of the December
// mockups, PL1, PL2, PL4c, PL5, PL10), in a real browser on the layout page's invented harbour (?placePage=spot&ways=…).
// What it checks, in plain words:
//   * once a piece of the jetty is shown (&ways=1): "Where to?" in the place's card at the left, a row a destination,
//     each way a button with its picture, word and time, at least 44 px; the far end not shown reads "Not yet
//     explored."; the hidden way to the sea cave is nowhere; a tap opens the pop-up that says the GM moves the party;
//   * before anything is shown: "Where to?" says there is nothing to choose from yet, and no way is on the page;
//   * shown with no ways (&ways=none): no "Where to?" at all (d5-1);
//   * messy data (&ways=messy): a long far end's name and 999 turns keep inside the row at 375 px;
//   * nothing scrolls sideways, every tap is 44 px, no text is under 14 px, and axe finds no serious problem, at 375,
//     834 and 1024 px, in light and dark. Each test saves its picture.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, ways: '1' | 'none' | 'messy' | null) {
  await page.goto(`/layout.html?as=player&placePage=spot&session=running${ways ? `&ways=${ways}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
}

const left = (page: Page) => page.locator('.players-page__column[data-column="left"]');

for (const width of [375, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`a player's Where to? (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (PL1, PL5; mc-28, mc-36, mc-36a; P14): the rows in the place's card, each way a button of a tap's size;
      // the unexplored far end said so; the hidden way nowhere; a tap's pop-up says the GM moves the party.
      test('with the jetty shown', async ({ page }) => {
        await openScene(page, '1');
        const where = left(page).getByRole('region', { name: 'Where to?' });
        await expect(where).toBeVisible();
        const wreck = where.getByRole('group', { name: 'The wreck' });
        await expect(wreck.getByRole('button', { name: 'Swimming, 3 turns, to The wreck' })).toBeVisible();
        await expect(where.getByRole('group', { name: 'Walking' }).getByText('Not yet explored.')).toBeVisible();
        await expect(page.locator('body')).not.toContainText(/sea cave|customs shed/i);
        for (const button of await where.locator('.way-button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        // The rows stand inside the place's card.
        const [card, list] = await Promise.all([left(page).locator('.players-page__card').first().boundingBox(), where.boundingBox()]);
        expect(list!.y + list!.height).toBeLessThanOrEqual(card!.y + card!.height);
        await page.screenshot({ path: `test-results/layout-screens/players-where-to-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await wreck.getByRole('button', { name: 'Rowing, 1 turn, to The wreck' }).click();
        const popup = page.getByRole('dialog', { name: 'To the wreck, rowing' });
        await expect(popup.getByText('Your GM moves the party. Say where you want to go.')).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-where-to-tap-${width}-${scheme}.png` });
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL2; mc-28b): before anything is shown, the line that says there is nothing yet, and no way at all.
      test('before anything is shown', async ({ page }) => {
        await openScene(page, null);
        const where = left(page).getByRole('region', { name: 'Where to?' });
        await expect(where.getByText('None to choose from yet. They show here once your GM has shown you something of this place.')).toBeVisible();
        await expect(page.locator('.way-button')).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/players-where-to-before-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (d5-1): the place shown, no ways sent: no "Where to?" at all.
      test('shown with no ways', async ({ page }) => {
        await openScene(page, 'none');
        await expect(left(page).getByText('Black piles, a mooring ring, weed to the waterline.')).toBeVisible();
        await expect(page.locator('.where-to')).toHaveCount(0);
      });
    });
  }
}

test.describe('a player’s Where to? with messy data (375 px)', () => {
  test.use({ viewport: { width: 375, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });

  // Purpose (PL10; P13): a far end named at length wraps inside its row and 999 turns keeps its button's shape.
  test('a long name and 999 turns stay inside the row', async ({ page }) => {
    await openScene(page, 'messy');
    const row = left(page).getByRole('group', { name: 'The water stair under the customs house, by the tarred door' });
    await expect(row.getByRole('button', { name: 'Climbing, 999 turns, to The water stair under the customs house, by the tarred door' })).toBeVisible();
    const [rowBox, buttons] = await Promise.all([row.boundingBox(), row.locator('.way-button').all()]);
    for (const b of buttons) {
      const box = (await b.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width);
    }
    await page.screenshot({ path: 'test-results/layout-screens/players-where-to-messy-375.png', fullPage: true });
    expect(await layoutProblems(page)).toEqual([]);
  });
});

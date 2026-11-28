// The marching order as a player sees it on their Scene (plan dec-9-the-players-scene, row P8, with P11 and P13; page
// 18 of the December mockups, PL1, PL6 and PL10, approved 2026-11-14, ap-10), in a real browser on the layout page's
// invented harbour. What it checks, in plain words:
//   * messy data (?party=eight, PL10): eight in four ranks of two, a long name, 0 of 12, 40 of 40 and 999 of 999; every
//     circle, its name and its hit points' bar stay inside the card, and the card is the last in the right column;
//   * a split party (?split=1, PL6): the player's own group alone, headed plain "Marching order", with "Your group. Ash
//     is elsewhere." under the heading and no circle for Ash;
//   * nothing scrolls sideways, every tap is 44 px, no text is under 14 px, and axe finds no serious problem, at 375
//     and 1024 px, in light and dark. Each test saves its picture.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, extra: string) {
  await page.goto(`/layout.html?as=player&placePage=spots&session=running${extra}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('heading', { name: /^Marching order/ })).toBeVisible();
}

const order = (page: Page) => page.locator('.players-page__column[data-column="right"] section.marching');

for (const width of [375, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the players' marching order (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (PL10; P13's overflow): with eight in the order, a long name, 0 of 12 and 999 of 999, every circle, its
      // words and its hit points' bar stay inside the card, in four ranks of two, the card last in the right column.
      test('eight in four ranks, with messy names and hit points, inside the card', async ({ page }) => {
        await openScene(page, '&party=eight');
        const card = order(page);
        // (The harbour is dark here, so each circle also reads "no light".)
        await expect(card.getByRole('button', { name: /^Pip, .*999 of 999 hit points/ })).toBeVisible();
        await expect(card.getByRole('button', { name: /^Fenna of the Long Causeway, .*0 of 12 hit points/ })).toBeVisible();
        expect(await card.locator('.marching__rank').count()).toBe(4);
        const box = (await card.boundingBox())!;
        for (const part of await card.locator('.party-circle, .party-circle__hp, .hp-bar').all()) {
          const inner = (await part.boundingBox())!;
          expect(inner.x).toBeGreaterThanOrEqual(box.x - 0.5);
          expect(inner.x + inner.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
        }
        // Last in the right column (PL1, PL5b: the map, the place's card, the marching order): it stands under the
        // place's card, and nothing else in the column comes after it but today's Split party (P1's departure).
        const right = page.locator('.players-page__column[data-column="right"]');
        await expect(right.locator('section.players-area')).toBeVisible();
        const [place, last] = await Promise.all([right.locator('section.players-area').boundingBox(), card.boundingBox()]);
        expect(last!.y).toBeGreaterThanOrEqual(place!.y + place!.height);
        const bottoms = await right.evaluate((column) => {
          const marching = column.querySelector('section.marching')!;
          return [...column.children].filter((part) => !part.contains(marching) && !part.classList.contains('groups__actions')).map((part) => part.getBoundingClientRect().bottom);
        });
        expect(bottoms.length).toBeGreaterThan(0);
        for (const bottom of bottoms) expect(last!.y).toBeGreaterThanOrEqual(bottom - 0.5);
        await page.screenshot({ path: `test-results/layout-screens/players-marching-eight-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL6; ap-10): split, a player sees their own group's order alone, headed plain "Marching order", and
      // one line under the heading names who is elsewhere, never where.
      test('split: their group alone, and who is elsewhere', async ({ page }) => {
        await openScene(page, '&split=1');
        const card = order(page);
        await expect(card.getByRole('heading', { name: 'Marching order', exact: true })).toBeVisible();
        await expect(card.getByText('Your group. Ash is elsewhere.')).toBeVisible();
        await expect(card.getByRole('button', { name: /^Wren of the Lantern Wardens/ })).toBeVisible();
        await expect(card.getByRole('button', { name: /^Ash\b/ })).toHaveCount(0);
        // The line stands under the heading, over the ranks.
        const [head, line, first] = await Promise.all([
          card.getByRole('heading', { name: 'Marching order', exact: true }).boundingBox(),
          card.getByText('Your group. Ash is elsewhere.').boundingBox(),
          card.locator('.marching__rank').first().boundingBox(),
        ]);
        expect(line!.y).toBeGreaterThanOrEqual(head!.y + head!.height);
        expect(first!.y).toBeGreaterThanOrEqual(line!.y + line!.height);
        await card.screenshot({ path: `test-results/layout-screens/players-marching-split-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

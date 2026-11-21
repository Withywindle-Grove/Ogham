// The players' Scene under its top: the page's structure (plan dec-9-the-players-scene, row P1, with P11 and P13; page
// 18 of the December mockups, PL1, PL2, PL5, PL5b), in a real browser on the layout page's invented harbour. What it
// checks, in plain words:
//   * with something of the place shown (?placePage=spots): from 768 px the place stands at the left and the marching
//     order at the right, the two columns of one width, starting on one line; under it one column, the place first
//     and the marching order after it (PL5's order: what a player acts on before what they read);
//   * before anything is shown (?placePage=spot): "Somewhere new" at the left; the right column in its place with the
//     map's empty frame and "This place", then the marching order; nothing of the jetty's name on the page;
//   * the place's rule button at the card's top right, level with the place's name (PL1; Francis's fix, 2026-11-20),
//     a long name wrapping beside it without touching it;
//   * nothing scrolls sideways, every tap is 44 px, no text is under 14 px, and axe finds no serious problem, at 375,
//     680, 834 and 1024 px, in light and dark. Each test saves its picture.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, state: 'spots' | 'spot', extra = '') {
  await page.goto(`/layout.html?as=player&placePage=${state}&session=running${extra}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
}

/** The two columns' boxes, as drawn. */
async function columns(page: Page) {
  const [left, right] = await Promise.all([page.locator('.players-page__column[data-column="left"]').boundingBox(), page.locator('.players-page__column[data-column="right"]').boundingBox()]);
  return { left: left!, right: right! };
}

for (const width of [375, 680, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the players' page (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });
      const two = width >= 768;

      // Purpose (PL1, PL5): the place at the left and the marching order at the right in two columns of one width
      // from 768 px; under it one column, the place before the marching order.
      test('with the place shown', async ({ page }) => {
        await openScene(page, 'spots');
        const place = page.locator('.players-page__column[data-column="left"]').getByRole('heading', { name: 'The Drowned Harbour' });
        const order = page.locator('.players-page__column[data-column="right"]').getByRole('heading', { name: 'Marching order' });
        await expect(place).toBeVisible();
        await expect(order).toBeVisible();
        const { left, right } = await columns(page);
        if (two) {
          expect(right.x).toBeGreaterThan(left.x + left.width);
          expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(left.x - right.x)).toBeLessThanOrEqual(1);
          expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
        }
        // The prompt slot stays over both columns (PL4): it starts no lower than the page.
        const slot = await page.locator('.prompt-slot').first().boundingBox();
        if (slot) expect(slot.y + slot.height).toBeLessThanOrEqual(left.y + 1);
        await page.screenshot({ path: `test-results/layout-screens/players-page-shown-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL2; mc-28b, mc-50): before anything is shown, "Somewhere new" at the left and the right column in
      // its place, empty, the marching order after it; the place's name is nowhere on the page.
      test('before anything is shown', async ({ page }) => {
        await openScene(page, 'spot');
        const left = page.locator('.players-page__column[data-column="left"]');
        const right = page.locator('.players-page__column[data-column="right"]');
        await expect(left.getByRole('heading', { name: 'Somewhere new' })).toBeVisible();
        await expect(left.getByText('Your GM hasn’t described this place yet.')).toBeVisible();
        const frame = right.getByRole('region', { name: 'The map' });
        const card = right.getByRole('region', { name: 'This place' });
        await expect(frame.getByText('No map shared yet.')).toBeVisible();
        await expect(card.getByText('Nothing shared yet.')).toBeVisible();
        const [frameBox, cardBox, orderBox] = await Promise.all([frame.boundingBox(), card.boundingBox(), right.getByRole('heading', { name: 'Marching order' }).boundingBox()]);
        expect(cardBox!.y).toBeGreaterThanOrEqual(frameBox!.y + frameBox!.height);
        expect(orderBox!.y).toBeGreaterThanOrEqual(cardBox!.y + cardBox!.height);
        const boxes = await columns(page);
        if (two) expect(Math.abs(boxes.left.y - boxes.right.y)).toBeLessThanOrEqual(1);
        else expect(boxes.right.y).toBeGreaterThanOrEqual(boxes.left.y + boxes.left.height);
        await expect(page.locator('.players-page')).not.toContainText(/jetty/i);
        await page.screenshot({ path: `test-results/layout-screens/players-page-before-shown-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

for (const width of [375, 1024] as const) {
  for (const name of ['short', 'long'] as const) {
    test.describe(`the place's rule button (${width} px, ${name} name)`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });

      // Purpose (PL1; Francis's fix, 2026-11-20): the place's rule button stands at the top right of the place's card,
      // its top level with the place's name and its right edge at the card's right padding; a long name wraps beside
      // it and never runs under it.
      test('stands at the card’s top right, level with the name', async ({ page }) => {
        await openScene(page, 'spots', name === 'long' ? '&name=long' : '');
        const card = page.locator('.players-page__column[data-column="left"] .players-page__card').first();
        // The Location's card since ppf-6 (2026-11-20), in place of today's place line.
        const heading = card.locator('.players-place__name');
        const button = card.getByRole('button', { name: /Falling into the harbour/ });
        await expect(button).toBeVisible();
        const [cardBox, nameBox, buttonBox] = await Promise.all([card.boundingBox(), heading.boundingBox(), button.boundingBox()]);
        const padding = await card.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight) + parseFloat(getComputedStyle(el).borderRightWidth));
        // Level with the name: both start on the card's first line.
        expect(Math.abs(buttonBox!.y - nameBox!.y)).toBeLessThanOrEqual(1);
        // At the card's right padding.
        expect(Math.abs(cardBox!.x + cardBox!.width - padding - (buttonBox!.x + buttonBox!.width))).toBeLessThanOrEqual(1);
        // The name keeps to its side of the button, however long.
        expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(buttonBox!.x);
        // The place's words start under the row, not beside the button.
        const text = await card.locator('.players-place__piece').first().boundingBox();
        expect(text!.y).toBeGreaterThanOrEqual(Math.max(nameBox!.y + nameBox!.height, buttonBox!.y + buttonBox!.height));
        expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/players-page-rule-button-${width}-${name}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

// The players' top (plan dec-9-the-whole-scene S15; page 16, T9a to T9e; st-7, mc-39b, sa-1) and the facts' one-line
// values (tv-1 as corrected by the lead, 2026-11-15), in a real browser on the layout page's invented campaigns. What it
// checks, in plain words:
//   * a player's top at the harbour (?placePage=spots): the band without a button or menu, the heading naming the
//     shown harbour and its turn, the facts with the harbour's own check, the strip; no accent in the top;
//   * paused (&session=paused): today's words in the band, on a line of their own under the date on a phone (T9e);
//   * the facts' tiles with the longest weather and the shortest ("Fair"): each value and small line on one line
//     inside its tile, the long one a step smaller and cut, its whole words in the tile's name; for the player and the
//     GM alike (the same part);
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, at 375, 680, 834 and 1024 px, in
//     light and dark. Each test saves its picture.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const LONG = 'A grey, drowning rain that comes sideways off the lantern coast';

async function openHarbour(page: Page, session: 'running' | 'paused') {
  await page.goto(`/layout.html?as=player&placePage=spots&session=${session}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('group', { name: 'Scene facts' })).toBeVisible();
}

async function openDryFord(page: Page, as: 'player' | 'gm', fair: boolean) {
  await page.goto(`/layout.html?as=${as}${fair ? '&weather=fair' : ''}`);
  await page.getByRole('button', { name: /The Dry Ford/ }).click();
  if (as === 'player') await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  const weather = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Weather: / });
  await expect(weather).toBeVisible();
  return weather;
}

/** A tile's value and small line: each on one line, inside the tile; whether the value dropped a step or was cut. */
async function tileFit(tile: Locator) {
  return tile.evaluate((el) => {
    const tileBox = el.getBoundingClientRect();
    const one = (part: Element | null) => {
      if (!part) return null;
      const node = part as HTMLElement;
      const box = node.getBoundingClientRect();
      return { lines: Math.round(box.height / parseFloat(getComputedStyle(node).lineHeight)), inside: box.right <= tileBox.right + 0.5 && box.left >= tileBox.left - 0.5, cut: node.scrollWidth > node.clientWidth + 1 };
    };
    const value = el.querySelector('.scene-fact__value-text') as HTMLElement;
    return { value: one(value), sub: one(el.querySelector('.scene-fact__sub-text')), smaller: value.dataset.fit === 'smaller', size: parseFloat(getComputedStyle(value).fontSize), height: tileBox.height };
  });
}

for (const width of [375, 680, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the players' top (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (T9a, T9d): the band without a button or menu, the shown harbour named with its turn, the facts with
      // the harbour's own check as the GM sees it, the strip, and no accent in the top.
      test('at the harbour', async ({ page }) => {
        await openHarbour(page, 'running');
        const time = page.getByRole('region', { name: 'Time' });
        await expect(time.getByRole('heading', { name: 'The Drowned Harbour, turn 1' })).toBeVisible();
        for (const name of ['Next turn', 'Time options', 'Resume session', 'Encounter check']) await expect(time.getByRole('button', { name, exact: true })).toHaveCount(0);
        await expect(time.locator('.scene-band .button-primary')).toHaveCount(0);
        await expect(page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: 'Encounter check: On every move. 1 in 6' })).toBeVisible();
        await expect(time.getByRole('group', { name: 'Sequence of play' })).toBeVisible();
        await expect(page.getByRole('list', { name: 'This hour' })).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/players-top-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (T9b, T9e): paused, today's words stand in the band (beside the heading on a tablet, under the date on
      // a phone); the heading has no turn count; the facts stay.
      test('paused', async ({ page }) => {
        await openHarbour(page, 'paused');
        const words = page.getByText('Session paused, waiting for the GM');
        await expect(words).toBeVisible();
        await expect(page.locator('.scene-band__heading')).toHaveText('The Drowned Harbour');
        await expect(page.getByRole('button', { name: /Show details/ })).toHaveCount(0);
        const [line, date] = await Promise.all([words.boundingBox(), page.locator('.scene-band__date-line').boundingBox()]);
        if (width < 600) expect(line!.y).toBeGreaterThanOrEqual(date!.y + date!.height - 1);
        await page.screenshot({ path: `test-results/layout-screens/players-top-paused-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (tv-1): with the longest weather, the value keeps one line inside its tile, a step smaller and cut,
      // never under 16, and its small line keeps one line too; the tile's name holds the whole weather. The same for
      // the GM's tile (the same part).
      for (const as of ['player', 'gm'] as const) {
        test(`the longest weather, ${as}`, async ({ page }) => {
          const tile = await openDryFord(page, as, false);
          expect(await tile.getAttribute('aria-label')).toContain(LONG);
          const fit = await tileFit(tile);
          expect(fit.value).toMatchObject({ lines: 1, inside: true, cut: true });
          expect(fit.smaller || width < 600).toBe(true);
          expect(fit.size).toBeGreaterThanOrEqual(16);
          if (fit.sub) expect(fit.sub).toMatchObject({ lines: 1, inside: true });
          await page.screenshot({ path: `test-results/layout-screens/players-top-weather-long-${as}-${width}-${scheme}.png` });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        });
      }

      // Purpose (tv-1): the shortest weather, "Fair", stays whole at its full size.
      test('the shortest weather', async ({ page }) => {
        const tile = await openDryFord(page, 'player', true);
        const fit = await tileFit(tile);
        expect(fit.value).toMatchObject({ lines: 1, inside: true, cut: false });
        expect(fit.smaller).toBe(false);
        await page.screenshot({ path: `test-results/layout-screens/players-top-weather-fair-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

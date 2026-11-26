// The Scene's quick fixes, batch A, the top (plan docs/plans/dec-scene-quickfix.md). Q3 (F3 a, Francis 2026-11-25:
// "'...' should be the rightmost buttons to the right of '-'"): during an expedition the GM's band reads, left to right,
// the quick marks, Next turn, the fold mark, the menu button; the menu is the last. It departs from page 24, TF1
// (approved 2026-11-18 with the fix), where the fold mark came after the menu; TF1b (375 px) is unchanged. What it
// checks, in plain words, on the layout page's invented harbour (`?placePage=spot&session=running`):
//   * on a tablet the menu button is the band's rightmost, the fold mark at its left, 8 px between, each 52 px, one top,
//     open and folded;
//   * the Tab key reaches Next turn, then the fold mark, then the menu button;
//   * on a phone the fold mark stays at the heading's right and the menu button is still the last of the date's row;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, in light and dark.
// Q4 (F7 a, F11 a, Francis 2026-11-25: "These buttons should be centered"; "These boxes should be centered"): during an
// expedition fewer than four facts stand centred in their row, each as wide as one of the row's tracks (a quarter where
// four fit; a third at 1024 px, where the GM's side column narrows the row), on the GM's Scene and the players'; on a
// phone they stay two by two from the left (unchanged, ⚑ 1 of the plan). It departs from page 16, T1 and T8a, and
// page 18, PL1 (approved 2026-11-14), where the facts start at the row's left. The harbour draws two facts; Larger
// text is checked too. One fact (&check=none) and three (outdoors, the weather due) are checked on the GM's Scene.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

/** The band's one height for its controls (p2p-16; page 23, frame LA1). */
const BAND_CONTROL = 52;

async function openExpedition(page: Page) {
  await page.goto('/layout.html?as=gm&placePage=spot&session=running');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('button', { name: 'Next turn' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Scene's top, Q3 (${size.width}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose (Q3): during an expedition the menu button is the band's last button, the fold mark just before it,
      // open and folded alike; on a phone the fold mark stays at the heading's right (TF1b) and the menu is the last
      // button of the date's row.
      test('the menu button is last, after the fold mark', async ({ page }) => {
        await openExpedition(page);
        const band = page.locator('.scene-band').first();
        const menuButton = page.getByRole('button', { name: 'Time options' });
        for (const foldName of ['Fold the top away', 'Show the top']) {
          const fold = page.getByRole('button', { name: foldName });
          const [mark, menu, next, heading, whole] = await Promise.all([fold, menuButton, page.getByRole('button', { name: 'Next turn' }), band.getByRole('heading'), band].map(async (l) => (await l.boundingBox())!));
          expect([Math.round(mark!.width), Math.round(mark!.height)]).toEqual([BAND_CONTROL, BAND_CONTROL]);
          expect([Math.round(menu!.width), Math.round(menu!.height)]).toEqual([BAND_CONTROL, BAND_CONTROL]);
          // The menu button at the band's far right, on either size.
          expect(Math.abs(menu!.x + menu!.width - (whole!.x + whole!.width))).toBeLessThan(2);
          if (size.name === 'tablet') {
            expect(Math.round(menu!.x - (mark!.x + mark!.width))).toBe(8);
            expect(Math.round(mark!.x - (next!.x + next!.width))).toBe(8);
            expect(Math.round(mark!.y)).toBe(Math.round(menu!.y));
            expect(Math.round(next!.y)).toBe(Math.round(menu!.y));
          } else {
            // TF1b, unchanged: the fold mark at the heading's right, over the menu button; the menu after Next turn.
            expect(Math.abs(mark!.x + mark!.width - (whole!.x + whole!.width))).toBeLessThan(2);
            expect(mark!.y).toBeLessThan(heading!.y + heading!.height);
            expect(heading!.x + heading!.width).toBeLessThanOrEqual(mark!.x + 1);
            expect(mark!.y + mark!.height).toBeLessThanOrEqual(menu!.y + 1);
            expect(Math.round(menu!.x - (next!.x + next!.width))).toBe(8);
            expect(Math.round(next!.y)).toBe(Math.round(menu!.y));
          }
          await page.screenshot({ path: `test-results/layout-screens/scene-quick-top-${foldName === 'Show the top' ? 'folded' : 'open'}-${size.width}-${scheme}.png` });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
          await fold.click();
        }
      });

      // Purpose (Q3): the Tab key follows the same order: Next turn, then the fold mark, then the menu button.
      test('the Tab key reaches the fold mark before the menu', async ({ page }) => {
        await openExpedition(page);
        await page.getByRole('button', { name: 'Next turn' }).focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Fold the top away' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Time options' })).toBeFocused();
      });
    });
  }
}

/** The facts row's box, its grid tracks' widths, the gap between them, and each tile's box. */
async function factsGeometry(page: Page) {
  return page.getByRole('group', { name: 'Scene facts' }).evaluate((row) => {
    const box = row.getBoundingClientRect();
    const style = getComputedStyle(row);
    const tracks = style.gridTemplateColumns.split(' ').map(parseFloat);
    return { row: { x: box.x, width: box.width }, tracks, gap: parseFloat(style.columnGap), tiles: [...row.children].map((t) => { const b = t.getBoundingClientRect(); return { x: b.x, width: b.width }; }) };
  });
}

/**
 * Fewer than four facts (`count` of them) stand at a track's width each; on a tablet the last line, where it is not
 * full, has its middle at the row's middle, and every tile stays inside the row; on a phone the first tile is at the
 * row's left (two by two, as built).
 */
async function expectCentredAtATrack(page: Page, width: number, count: number) {
  await expect(page.getByRole('group', { name: 'Scene facts' })).toBeVisible();
  const { row, tracks, gap, tiles } = await factsGeometry(page);
  expect(tiles.length).toBe(count);
  const track = tracks[0]!;
  for (const tile of tiles) {
    expect(Math.abs(tile.width - track)).toBeLessThan(1);
    expect(tile.x).toBeGreaterThanOrEqual(row.x - 1);
    expect(tile.x + tile.width).toBeLessThanOrEqual(row.x + row.width + 1);
  }
  if (width >= 600) {
    // The last line: the tiles after the full lines above it (none where all fit on one line).
    const last = tiles.slice(tiles.length - (tiles.length % tracks.length || tracks.length));
    const left = Math.min(...last.map((t) => t.x));
    const right = Math.max(...last.map((t) => t.x + t.width));
    // Its middle is the row's middle (a full line fills the row, as built).
    expect(Math.abs((left + right) / 2 - (row.x + row.width / 2))).toBeLessThan(1.5);
    // With four across, a tile is a quarter of the row and its gaps (the width it has with four).
    if (tracks.length === 4) expect(Math.abs(track - (row.width - 3 * gap) / 4)).toBeLessThan(1);
  } else {
    expect(Math.abs(Math.min(...tiles.map((t) => t.x)) - row.x)).toBeLessThan(1);
  }
}

for (const size of [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    for (const who of ['gm', 'player'] as const) {
      for (const text of ['standard', 'larger'] as const) {
        test.describe(`the Scene's facts, Q4 (${size.width}, ${scheme}, ${who}, ${text} text)`, () => {
          test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

          // Purpose (Q4): on a tablet two facts stand centred, each as wide as one of the row's tracks (as with four);
          // on a phone they stay at the row's left, two by two, as built.
          test('fewer than four facts stand centred at a track each', async ({ page }) => {
            if (text === 'larger') await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
            if (who === 'gm') await openExpedition(page);
            else {
              await page.goto('/layout.html?as=player&placePage=spots&session=running');
              await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
              await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
              await page.evaluate(() => document.fonts.ready);
            }
            await expectCentredAtATrack(page, size.width, 2);
            await page.screenshot({ path: `test-results/layout-screens/scene-quick-facts-${who}-${text}-${size.width}-${scheme}.png` });
            expect(await layoutProblems(page)).toEqual([]);
            expect(await accessibilityProblems(page)).toEqual([]);
          });
        });
      }
    }
  }
}

// One and three facts (the review of #110), on the GM's Scene: &check=none leaves Light alone; outdoors with the sun's
// daylight and the weather not yet rolled gives Weather, Light and the encounter check.
for (const size of [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [count, flags] of [
      [1, '&check=none'],
      [3, '&outdoors=1&daylight=1&weather=due'],
    ] as const) {
      test.describe(`the Scene's facts, Q4, ${count} (${size.width}, ${scheme})`, () => {
        test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

        // Purpose (Q4): one fact, and three, stand centred at a track each on a tablet, and at the row's left on a phone.
        test(`${count === 1 ? 'one fact stands' : 'three facts stand'} centred at a track each`, async ({ page }) => {
          await page.goto(`/layout.html?as=gm&placePage=spot&session=running${flags}`);
          await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
          // (Outdoors the band's step is "Next day".)
          await expect(page.getByRole('button', { name: /^Next (turn|day)$/ })).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await expectCentredAtATrack(page, size.width, count);
          await page.screenshot({ path: `test-results/layout-screens/scene-quick-facts-${count}-${size.width}-${scheme}.png` });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        });
      });
    }
  }
}

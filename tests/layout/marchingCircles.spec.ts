// The marching order as circles (plan dec-9-the-whole-scene S12; page 16 T10, R1; page 04 C3), in a real browser on
// the layout page's invented harbour with a party of five (`?placePage=spot&session=running&party=five`). What it
// checks, in plain words:
//   * the card's head is the caller's banner, "Caller" and Wren's name, one button;
//   * five circles in two ranks, front to back; a circle whose hit points aren't set reads "— of 9";
//   * the circles in a rank sit side by side 8 px apart or more, inside their rank's box, each hit-point bar whole
//     inside its circle;
//   * Wren's lit light draws its ring and halo, and the line over the ranks names it;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, in light and dark;
//   * no lock (B11 of docs/plans/scene-point-to-point.md; page 23, LA1, and page 18, PL1): the card carries no switch,
//     for the GM or a player; in a campaign locked before the lock went (`&lock=old`) a player still moves a rank;
//     with "Players can reorder marching order" off (`&reorder=off`) a player's try opens a pop-up that says why.
// It also keeps a picture of the card at each size (test-results/layout-screens), for the as-built pictures.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page) {
  await page.goto('/layout.html?as=gm&placePage=spot&session=running&party=five');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('list', { name: 'Marching order, front to back' })).toBeVisible();
}

/** The same Scene as a player (Sam), with more options on the address (`&lock=old`, `&reorder=off`). */
async function openPlayerScene(page: Page, more = '') {
  await page.goto(`/layout.html?as=player&placePage=spot&session=running&party=five${more}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  // A player lands on their own character; the marching order lives on Scene.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('list', { name: 'Marching order, front to back' })).toBeVisible();
}

/** A rank's hidden slider (what a screen reader and the arrow keys move), front first. */
const rankSlider = (page: Page, index: number) => page.getByRole('list', { name: 'Marching order, front to back' }).getByRole('listitem').nth(index).getByRole('slider');
/** How many circles each rank holds, front to back. */
const rankSizes = async (page: Page) => {
  const ranks = await page.getByRole('list', { name: 'Marching order, front to back' }).getByRole('listitem').all();
  return Promise.all(ranks.map((r) => r.locator('.party-circle').count()));
};

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the marching order as circles (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the caller's banner heads the card; five circles in two ranks, each inside its rank, 8 px apart; unset hit points read "— of 9".
      test('five in two ranks, under the caller', async ({ page }) => {
        await openScene(page);
        await expect(page.getByRole('button', { name: 'Caller: Wren of the Lantern Wardens. Change the caller' })).toBeVisible();
        // No lock (B11; page 23, LA1): the GM's card carries no switch.
        await expect(page.locator('section.marching').getByRole('switch')).toHaveCount(0);
        await expect(page.locator('section.marching').getByText(/lock/i)).toHaveCount(0);
        const ranks = page.getByRole('list', { name: 'Marching order, front to back' }).getByRole('listitem');
        await expect(ranks).toHaveCount(2);
        await expect(ranks.nth(1).locator('.party-circle')).toHaveCount(3);
        await expect(page.getByRole('button', { name: /^Pell, not set of 9 hit points/ })).toContainText('— of 9');
        for (let r = 0; r < 2; r += 1) {
          const box = (await ranks.nth(r).locator('.marching__rank').boundingBox())!;
          const circles = await ranks.nth(r).locator('.party-circle').all();
          const boxes = await Promise.all(circles.map(async (c) => (await c.boundingBox())!));
          for (const b of boxes) {
            expect(b.x).toBeGreaterThanOrEqual(box.x - 0.5);
            expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
          }
          for (let i = 1; i < boxes.length; i += 1) expect(boxes[i]!.x - (boxes[i - 1]!.x + boxes[i - 1]!.width)).toBeGreaterThanOrEqual(7.5);
          // Each circle's hit-point bar is whole inside its circle, never cut by a narrow rank.
          for (const [i, c] of circles.entries()) {
            const bar = c.locator('.hp-bar');
            if ((await bar.count()) === 0) continue;
            const b = (await bar.boundingBox())!;
            expect(b.x).toBeGreaterThanOrEqual(boxes[i]!.x - 0.5);
            expect(b.x + b.width).toBeLessThanOrEqual(boxes[i]!.x + boxes[i]!.width + 0.5);
            expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          }
        }
        // Wren's lit rushlight: the ring and halo on her circle, and the line naming the light lit.
        await expect(page.getByText(/^One light lit: Wren of the Lantern Wardens’ rushlight, /)).toBeVisible();
        await expect(page.locator('.party-circle--lit .party-circle__halo')).toHaveCount(1);
        await expect(page.locator('.party-circle--lit .party-circle__arc')).toHaveCount(1);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        // The picture: the page made tall enough that the card shows whole, clear of the fixed bars.
        await page.setViewportSize({ width: size.width, height: 3000 });
        await page.locator('section.marching').screenshot({ path: `test-results/layout-screens/marching-circles-${size.width}-${scheme}.png` });
      });

      // Purpose (B11; page 18, PL1): a player's card carries no lock switch; and in a campaign locked before the lock
      // went, a player still moves a rank at once, with an Undo that puts it back.
      test('a player sees no lock switch, and still moves a rank in a campaign locked before', async ({ page }) => {
        await openPlayerScene(page, '&lock=old');
        const card = page.locator('section.marching');
        await expect(card.getByRole('switch')).toHaveCount(0);
        await expect(card.getByText(/lock/i)).toHaveCount(0);
        expect(await rankSizes(page)).toEqual([2, 3]);
        await rankSlider(page, 1).focus();
        await page.keyboard.press('ArrowUp');
        await expect.poll(() => rankSizes(page)).toEqual([3, 2]);
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect.poll(() => rankSizes(page)).toEqual([2, 3]);
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (B11, flag 5): with "Players can reorder marching order" off, a player's rank is never a disabled
      // control: trying to move it opens a pop-up with the plain reason, nothing moves, and the pop-up passes the
      // layout and accessibility checks.
      test('with players reordering off, a player\'s try opens a pop-up that says why', async ({ page }) => {
        await openPlayerScene(page, '&reorder=off');
        const slider = rankSlider(page, 1);
        await expect(slider).toBeEnabled();
        await slider.focus();
        await page.keyboard.press('ArrowUp');
        const popUp = page.getByRole('dialog', { name: "Can't move them now" });
        await expect(popUp).toBeVisible();
        await expect(popUp.getByText('Only the GM sets the marching order in this campaign.')).toBeVisible();
        expect(await rankSizes(page)).toEqual([2, 3]);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (the approval's fix 4, 2026-11-18; messy data): a long status is one line of text that wraps under the
      // name as whole lines: its mark starts the first line, its words carry on beside it and wrap back under the mark,
      // and its count ends the last line; never a narrow column with the mark and the count floating either side.
      test('a long status wraps as whole lines, its mark and count with its words', async ({ page }) => {
        await openScene(page);
        // The book's faces loaded first: a fallback font wraps the words elsewhere.
        await page.evaluate(() => document.fonts.ready);
        const status = page.locator('.party-circle__status', { hasText: 'Bog-sickness' });
        await expect(status).toBeVisible();
        const word = status.locator('.party-circle__status-word');
        const shown = await word.evaluate((el) => getComputedStyle(el).display !== 'none');
        // A circle too narrow for words keeps the mark and count only (mc-3); then there is no line to wrap.
        test.skip(!shown, 'the circle drops the words at this width');
        const geometry = await status.evaluate((el) => {
          const mark = el.querySelector('.status-ring__mark')!.getBoundingClientRect();
          const lines = [...el.querySelector('.party-circle__status-word')!.getClientRects()].map((r) => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom }));
          const count = el.querySelector('.party-circle__count')!.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return { mark: { x: mark.x, right: mark.right, y: mark.y, bottom: mark.bottom }, lines, count: { x: count.x, y: count.y, bottom: count.bottom }, box: { x: box.x, right: box.right } };
        });
        const { mark, lines, count, box } = geometry;
        expect(lines.length).toBeGreaterThan(1);
        // The words start beside the mark, on its line.
        expect(lines[0]!.x).toBeGreaterThanOrEqual(mark.right - 0.5);
        expect(mark.y).toBeLessThan(lines[0]!.bottom);
        expect(mark.bottom).toBeGreaterThan(lines[0]!.y);
        // A later line runs under the mark (the whole width), not in a column beside it.
        expect(Math.min(...lines.slice(1).map((l) => l.x))).toBeLessThan(mark.right);
        // The count ends the text: after the last line's words, or on a line of its own under them (never beside the
        // block, halfway down).
        const last = lines[lines.length - 1]!;
        expect(count.y).toBeGreaterThanOrEqual(last.y - 1);
        if (count.y < last.bottom - 1) expect(count.x).toBeGreaterThanOrEqual(last.right - 0.5);
        for (const l of lines) {
          expect(l.x).toBeGreaterThanOrEqual(box.x - 0.5);
          expect(l.right).toBeLessThanOrEqual(box.right + 0.5);
        }
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

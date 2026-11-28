// A long describing table in its real sheet (m5b-long-tables; mockup creation/final/13, B with C's field; ruled
// 2026-11-09), opened from the gallery's button. Purposes:
//   At tablet width a range's rows sit in two columns, filled down the left first (row 14 tops the right column); at
//   phone width they sit in one column.
//   Tapping a range on the bar scrolls the sheet so that range's first row sits just under the bar, and What you
//   rolled and the bar both stay at the top of the sheet while it scrolls on (#571 round 2: the box is sticky too).
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';

const SIZES = [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openSheet(page: Page) {
  await page.goto('/gallery.html?theme=light');
  await page.evaluate(() => document.fonts.ready);
  // The button is at the gallery's foot: brought into view first, so the long page has settled under the tap.
  const open = page.getByRole('button', { name: 'Open the long table' });
  await open.scrollIntoViewIfNeeded();
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Marsh finds' });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Row n, in the open sheet only (the gallery's previews hold the same parts): the book's row, a radio (dec-10 F-a: a long table marks). */
const rowOf = (sheet: Locator, n: number) => sheet.getByRole('radio', { name: new RegExp(`^${n} `) });
const boxOf = async (sheet: Locator, n: number) => (await rowOf(sheet, n).boundingBox())!;

test.describe('phone, the strip', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // On a phone the typed-roll strip is at most three lines, so the first rows of the table stay in view (lt-1, the
  // lead, 2026-11-14: in creation's book type the label takes a line of its own at 375 px). The box and Show stay on
  // one line, the bar on the next; the bar's eight bands don't fit, so it scrolls sideways on its own line rather than
  // wrapping, and the page never scrolls sideways.
  test('the strip is at most three lines; the bar scrolls sideways without wrapping', async ({ page }) => {
    const sheet = await openSheet(page);
    const box = (await sheet.getByLabel('What you rolled').boundingBox())!;
    const showButton = (await sheet.getByRole('button', { name: 'Show', exact: true }).boundingBox())!;
    const bar = sheet.getByRole('group', { name: 'Go to rows' });
    const buttons = bar.getByRole('button');
    // The box is two taps wide (88 px), on one line with Show.
    expect(Math.round(box.width)).toBe(88);
    expect(Math.abs(box.y + box.height / 2 - (showButton.y + showButton.height / 2))).toBeLessThan(2);
    // Every band on one line, under the box's line.
    const tops = await buttons.evaluateAll((all) => all.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(tops.length).toBe(8);
    expect(new Set(tops).size).toBe(1);
    expect(tops[0]!).toBeGreaterThanOrEqual(Math.round(showButton.y + showButton.height));
    // Wider than the sheet, so it scrolls sideways; scrolled, the last band comes into view.
    const { scrollWidth, clientWidth } = await bar.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    await bar.evaluate((el) => el.scrollBy(1000, 0));
    await expect(buttons.last()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    // The strip is just those three lines, no helper line inside it. The limit is its parts, measured: the strip's
    // padding (8 above, 8 below) and its two 8 px gaps, plus the label (30 at 375 px), the box with Show (44) and the
    // bar (48): 8 + 30 + 8 + 44 + 8 + 48 + 8 = 154, plus 1 px for rounding.
    const label = (await sheet.locator('.table-typed .label').boundingBox())!;
    const barBox = (await bar.boundingBox())!;
    const strip = (await bar.locator('..').boundingBox())!;
    expect(strip.height).toBeLessThanOrEqual(8 + label.height + 8 + box.height + 8 + barBox.height + 8 + 1);
  });

  // The point of the limit (lt-1): on a small phone (375 × 667) with the keyboard closed, the table's first row is
  // fully in view under the three-line strip.
  test('on a 375 × 667 screen the first row is fully in view under the strip', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const sheet = await openSheet(page);
    const strip = (await sheet.getByRole('group', { name: 'Go to rows' }).locator('..').boundingBox())!;
    const sheetBox = (await sheet.boundingBox())!;
    // The first row whole: the first block of the first band (its range and its words, one tap).
    const firstRow = sheet.locator('.table-sheet__long > *').first();
    await expect(firstRow.getByRole('radio', { name: /^1 / })).toBeVisible();
    const first = (await firstRow.boundingBox())!;
    expect(first.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
    expect(first.y + first.height).toBeLessThanOrEqual(Math.min(sheetBox.y + sheetBox.height, 667) + 1);
  });
});

// At the Large text size the line may wrap, but only the label goes above: the box and Show stay on one line together.
test('at Large text on a phone, the box and Show stay on one line', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html?theme=light&size=large');
  await page.evaluate(() => document.fonts.ready);
  const open = page.getByRole('button', { name: 'Open the long table' });
  await open.scrollIntoViewIfNeeded();
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Marsh finds' });
  await expect(sheet).toBeVisible();
  const box = (await sheet.getByLabel('What you rolled').boundingBox())!;
  const showButton = (await sheet.getByRole('button', { name: 'Show', exact: true }).boundingBox())!;
  expect(Math.abs(box.y + box.height / 2 - (showButton.y + showButton.height / 2))).toBeLessThan(2);
  expect(showButton.x).toBeGreaterThan(box.x + box.width);
});

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test(`a long table's rows: ${size.name === 'tablet' ? 'two columns' : 'one column'}`, async ({ page }) => {
      const sheet = await openSheet(page);
      const thirteen = await boxOf(sheet, 13);
      const fourteen = await boxOf(sheet, 14);
      if (size.name === 'tablet') {
        // Row 14 tops the right column: level with row 1, to the right of row 13.
        const one = await boxOf(sheet, 1);
        expect(Math.abs(fourteen.y - one.y)).toBeLessThan(2);
        expect(fourteen.x).toBeGreaterThan(thirteen.x + thirteen.width);
      } else {
        expect(fourteen.y).toBeGreaterThan(thirteen.y);
        expect(Math.abs(fourteen.x - thirteen.x)).toBeLessThan(2);
      }
    });

    test(`the range bar scrolls to its range; the box and the bar stay at the top (${size.name})`, async ({ page }) => {
      const sheet = await openSheet(page);
      const bar = sheet.getByRole('group', { name: 'Go to rows' });
      // The sticky strip: What you rolled over the bar's buttons (its own padding around them).
      const strip = bar.locator('..');
      const box = sheet.getByLabel('What you rolled');
      await bar.getByRole('button', { name: '51–75' }).click();
      const fiftyOne = rowOf(sheet, 51);
      await expect(fiftyOne).toBeInViewport();
      const sheetBox = (await sheet.boundingBox())!;
      let barBox = (await strip.boundingBox())!;
      const rowBox = (await fiftyOne.boundingBox())!;
      // The range's first row just under the bar (its padding between), and the bar at the sheet's top.
      expect(rowBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
      expect(rowBox.y - (barBox.y + barBox.height)).toBeLessThan(16);
      expect(Math.abs(barBox.y - sheetBox.y)).toBeLessThan(2);
      // The box is in the strip, above the bar, and in view.
      await expect(box).toBeInViewport();
      expect((await box.boundingBox())!.y).toBeLessThan((await bar.boundingBox())!.y);
      // Scrolled further by hand, the box and the bar are still at the top.
      await sheet.evaluate((el) => el.scrollBy(0, 400));
      barBox = (await strip.boundingBox())!;
      expect(Math.abs(barBox.y - sheetBox.y)).toBeLessThan(2);
      await expect(box).toBeInViewport();
      const boxTop = (await box.boundingBox())!.y;
      expect(boxTop).toBeGreaterThanOrEqual(sheetBox.y);
      expect(boxTop).toBeLessThan(barBox.y + barBox.height);
      await expect(bar.getByRole('button', { name: '76–100' })).toBeInViewport();
    });
  });
}

// One format at any length (cts-2, frames TS5 to TS8, approved 2026-11-19). Purposes: a short table's sheet (6 rows,
// with the player's own words) and a long one's have the same parts in the same order, at 375 px and at 1,024 px: the
// Roll row, What you rolled, the book's head, the rows, then the foot ("Or type your own" just over the foot); "Take
// it" ends at the sheet's right edge; every row is a 44 px tap.
for (const size of SIZES) {
  test.describe(`one format (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test(`a short table's sheet and a long one's have the same parts in the same order (${size.name})`, async ({ page }) => {
      /** The tops of the sheet's parts, in the order the format puts them; null for a part that is missing. */
      const partsOf = (sheet: Locator) =>
        sheet.evaluate((el) =>
          ['.roll-row', '.table-typed', '.book-tap-head', '.table-sheet__long', '.dialog__actions'].map((part) => {
            const found = el.querySelector(part);
            return found ? found.getBoundingClientRect().top + el.scrollTop : null;
          }),
        );
      const long = await openSheet(page);
      const longParts = await partsOf(long);
      await long.getByRole('button', { name: 'Close' }).click();
      await expect(long).toBeHidden();
      const open = page.getByRole('button', { name: 'Open the six-row table' });
      await open.scrollIntoViewIfNeeded();
      await open.click();
      const short = page.getByRole('dialog', { name: 'Manner' });
      await expect(short).toBeVisible();
      const shortParts = await partsOf(short);
      for (const parts of [longParts, shortParts]) {
        expect(parts.every((top) => top !== null)).toBe(true);
        const tops = parts as number[];
        for (let n = 1; n < tops.length; n++) expect(tops[n]!).toBeGreaterThan(tops[n - 1]!);
      }
      // Every row a 44 px tap, no Pick button and no Done.
      const rows = short.getByRole('radio');
      expect(await rows.count()).toBe(6);
      for (const height of await rows.evaluateAll((all) => all.map((r) => r.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
      await expect(short.getByRole('button', { name: /^Pick/ })).toHaveCount(0);
      await expect(short.getByRole('button', { name: 'Done' })).toHaveCount(0);
      // The player's own words after the rows, then Take it at the foot's right: its right edge is the foot's, which
      // is the sheet's content edge, the box's own right edge.
      const ownBox = short.locator('.table-sheet__own');
      await ownBox.scrollIntoViewIfNeeded();
      const own = (await ownBox.boundingBox())!;
      const lastRow = (await rows.last().boundingBox())!;
      const take = (await short.getByRole('button', { name: 'Take it' }).boundingBox())!;
      const foot = (await short.locator('.dialog__actions').boundingBox())!;
      expect(own.y).toBeGreaterThan(lastRow.y);
      expect(take.y).toBeGreaterThan(own.y);
      expect(Math.abs(take.x + take.width - (foot.x + foot.width))).toBeLessThan(2);
      expect(Math.abs(foot.x + foot.width - (own.x + own.width))).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  });
}

// The Depart sheet's "Exploration method" (plan scene-point-to-point B7, p2p-5; page 24, DP1 and DP1b, approved
// 2026-11-18). It replaces scene-test-small-fixes' rule (the two-sided switch hugging its two sides, page 16's T6): the
// choice now has three sides, the setting's two ways and Point to point, sharing the row's width with no blank space at
// its right. In a real browser on the layout page's invented quay (`?town=town`, two ways of exploring). What it checks,
// in plain words:
//   * the switch's frame is as wide as the sheet's field, and its sides fill it in one row: the first starts at its
//     left, the last ends at its right, with no gap between;
//   * each side is a 44 px tap at least, and no side's words break onto a second line;
//   * nothing scrolls sideways and axe finds no serious problem, at 375 px and on a tablet, in light and dark.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

for (const width of [375, 834] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Depart sheet's method (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1200 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (B7): the three sides of "Exploration method" share the row's width, as DP1 and DP1b draw them.
      test('the three sides share the row', async ({ page }) => {
        await page.goto('/layout.html?as=gm&town=town');
        await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
        await page.getByRole('button', { name: 'Depart' }).click();
        const sheet = page.getByRole('dialog', { name: /Depart$/ });
        await expect(sheet).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const how = sheet.getByRole('group', { name: 'Exploration method' });
        await expect(how).toHaveClass(/button-row--switch/);
        const sides = how.getByRole('button');
        await expect(sides).toHaveText(['Market town', 'Under the quay', 'Point to point']);
        const frame = (await how.boundingBox())!;
        const field = (await how.locator('xpath=..').boundingBox())!;
        // The frame is the field's width.
        expect(Math.abs(frame.width - field.width)).toBeLessThanOrEqual(1);
        const edge = await how.evaluate((el) => parseFloat(getComputedStyle(el).borderInlineStartWidth));
        const boxes = await Promise.all([0, 1, 2].map(async (i) => (await sides.nth(i).boundingBox())!));
        // Each side a tap of 44 px at least, its words on one line (a side no taller than the tallest single-line one).
        for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
        const oneLine = await sides.evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 1));
        expect(oneLine).toBe(true);
        // The sides fill the frame: rows of sides with no blank space at the right (one row where they fit).
        const rows = new Map<number, typeof boxes>();
        for (const box of boxes) rows.set(Math.round(box.y), [...(rows.get(Math.round(box.y)) ?? []), box]);
        // The quay's three sides fit one row, at 375 px too (DP1b).
        expect(rows.size).toBe(1);
        for (const row of rows.values()) {
          const left = Math.min(...row.map((b) => b.x));
          const right = Math.max(...row.map((b) => b.x + b.width));
          expect(Math.abs(left - (frame.x + edge))).toBeLessThanOrEqual(1);
          expect(Math.abs(frame.x + frame.width - edge - right)).toBeLessThanOrEqual(1);
        }
        await page.screenshot({ path: `test-results/layout-screens/depart-method-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

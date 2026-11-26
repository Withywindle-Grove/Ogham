// The detail row and its one pop-up (sf-6a; page 44, EN1, EN3, EN4 D), in the gallery's `stat-block` section, in a real
// browser. Purposes:
//   At 375 px a stat line breaks only between a label and the next: a label always starts its pair's first line, a short
//   pair never wraps, and a die keeps its glyph and its number on one line (finding 12).
//   No detail row is under 44 px.
//   A long name wraps in the pop-up's head, beside the X, with nothing scrolling sideways.
//   The pop-up keeps its own form wherever it opens: a sheet from the foot on a phone, a centred card on a tablet.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const open = async (page: Page, theme = 'light') => {
  await page.goto(`/gallery.html?theme=${theme}`);
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' });

    test('a stat line breaks only between pairs, a die keeps its number, and every row is 44 px or more', async ({ page }) => {
      await open(page);
      const found = await page.evaluate(() => {
        const lines = (el: Element) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
        };
        const rows = [...document.querySelectorAll('#stat-block .book-detail')];
        const pairs = rows.flatMap((row) => [...row.querySelectorAll('.stat-block__pair')]);
        return {
          rows: rows.length,
          short: rows.filter((r) => r.getBoundingClientRect().height < 43.5).map((r) => r.getAttribute('aria-label')),
          pairs: pairs.length,
          // A label that is not on its pair's first line has been split from the line before it.
          // (within half a line: a die's glyph can stand a little taller than the words)
          labelsLate: pairs.filter((p) => p.querySelector('.stat-block__label')!.getBoundingClientRect().top - p.getBoundingClientRect().top > 8).map((p) => p.textContent),
          shortWrapped: pairs.filter((p) => p.matches('.stat-block__pair--short') && lines(p) > 1).map((p) => p.textContent),
          diceSplit: rows.flatMap((row) => [...row.querySelectorAll('.stat-block__die')]).filter((d) => d.getClientRects().length > 1).map((d) => d.textContent),
        };
      });
      expect(found.rows).toBeGreaterThanOrEqual(8);
      expect(found.pairs).toBeGreaterThan(10);
      expect(found.short).toEqual([]);
      expect(found.labelsLate).toEqual([]);
      expect(found.shortWrapped).toEqual([]);
      expect(found.diceSplit).toEqual([]);
    });

    test('a long name wraps in the pop-up’s head beside the X', async ({ page }) => {
      await open(page);
      const head = page.locator('#stat-block .dialog--preview', { hasText: 'The Old Ferrywarden' }).locator('.dialog__head');
      const title = await head.locator('h2').boundingBox();
      const close = await head.getByRole('button', { name: 'Close' }).boundingBox();
      expect(title!.height).toBeGreaterThan(40);
      expect(title!.x + title!.width).toBeLessThanOrEqual(close!.x + 1);
      expect(close!.y).toBeLessThan(title!.y + title!.height);
      expect(await layoutProblems(page)).toEqual([]);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`the pop-up a row opens is ${size.name === 'phone' ? 'a sheet from the foot' : 'a centred card'} (${theme})`, async ({ page }) => {
        await open(page, theme);
        const row = page.locator('#stat-block').getByRole('button', { name: 'Bog lurker: read it' }).first();
        await row.scrollIntoViewIfNeeded();
        await row.click();
        const card = page.getByRole('dialog', { name: 'Bog lurker' });
        await expect(card).toBeVisible();
        const box = (await card.boundingBox())!;
        if (size.name === 'phone') {
          expect(Math.round(box.x)).toBe(0);
          expect(Math.round(box.width)).toBe(size.width);
          expect(Math.abs(box.y + box.height - size.height)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThanOrEqual(2);
        }
        await page.screenshot({ path: `test-results/layout-screens/detail-popup-${size.width}-${theme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
        await card.getByRole('button', { name: 'Close' }).click();
        await expect(card).toHaveCount(0);
        await expect(row).toBeFocused();
      });
    }
  });
}

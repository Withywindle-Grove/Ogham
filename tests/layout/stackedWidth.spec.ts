// The stacked button's width (stk-2, the lead's ruling of 2026-11-14, replacing stk-1's two lines under a cap),
// measured in the gallery's "A sheet's foot" section in WebKit at a phone (375) and a tablet (1024 and 1180): the
// section's last three feet (SheetFootSpecimens). Purposes:
//   * Done and Add together: each at its least width, 88 px, the same width, the word on one line;
//   * a long word: on one line, never cut or overflowing, its button wider than 88 px and inside the foot;
//   * three together (StackedGroup): every one the widest one's width, the word on one line; a row at the right on a
//     tablet; on a phone, where they don't fit, one column at the right in code order, still one width;
//   * nothing makes the page scroll sideways.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'iPad landscape', width: 1180, height: 820 },
]) {
  test(`stacked buttons: 88 px at least, one line, no widest, one width together (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const feet = await page.evaluate(() => {
      const box = (el: Element): Box => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return [...document.querySelectorAll('#sheet-foot .dialog__actions')].slice(4).map((foot) => ({
        foot: box(foot),
        stackedFoot: foot.classList.contains('dialog__actions--stacked'),
        buttons: [...foot.querySelectorAll('.stacked-button')].map((b) => {
          const word = b.querySelector('span')!;
          // One line: the word's text draws as a single line box, and it is not wider than its button's inside.
          const range = document.createRange();
          range.selectNodeContents(word);
          return { ...box(b), words: word.textContent, lines: range.getClientRects().length, overflows: word.scrollWidth > word.clientWidth + 0.5 || box(word).right > box(b).right + 0.5 };
        }),
      }));
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(feet).toHaveLength(3);
    type Foot = (typeof feet)[number];
    const [doneAdd, long, three] = feet as [Foot, Foot, Foot];

    for (const f of feet) {
      for (const b of f.buttons) {
        expect(b.lines, `"${b.words}" on one line`).toBe(1);
        expect(b.overflows, `"${b.words}" not cut or overflowing`).toBe(false);
        expect(b.width, `"${b.words}" at least 88 px`).toBeGreaterThanOrEqual(88 - 0.5);
        expect(b.height, `"${b.words}" a 44 px tap`).toBeGreaterThanOrEqual(44 - 0.5);
        expect(b.right, `"${b.words}" inside its foot`).toBeLessThanOrEqual(f.foot.right + 1);
        expect(b.left, `"${b.words}" inside its foot`).toBeGreaterThanOrEqual(f.foot.left - 1);
      }
    }

    // Done and Add: short words, so each at the least width, 88 px; side by side at the right.
    expect(doneAdd.buttons.map((b) => b.words)).toEqual(['Done', 'Add']);
    for (const b of doneAdd.buttons) expect(b.width, `${b.words} at 88 px`).toBeLessThanOrEqual(88 + 0.5);
    expect(doneAdd.stackedFoot, 'Done and Add on one row').toBe(false);
    expect(Math.abs(doneAdd.foot.right - doneAdd.buttons[1]!.right), 'the group at the right').toBeLessThanOrEqual(1);

    // A long word widens its button (no widest), still on one line.
    expect(long.buttons.map((b) => b.words)).toEqual(['Roll them all at the table']);
    expect(long.buttons[0]!.width, 'the long word widens its button').toBeGreaterThan(88 * 1.5);
    expect(Math.abs(long.foot.right - long.buttons[0]!.right), 'at the right').toBeLessThanOrEqual(1);

    // Three together: one width, the widest one's.
    expect(three.buttons.map((b) => b.words)).toEqual(['Buy', 'Leave it', 'Ask the price']);
    const widths = three.buttons.map((b) => b.width);
    expect(Math.max(...widths) - Math.min(...widths), 'three at one width').toBeLessThanOrEqual(1);
    expect(widths[0], 'the widest word sets it, past 88 px').toBeGreaterThan(88 + 0.5);
    const heights = three.buttons.map((b) => b.height);
    expect(Math.max(...heights) - Math.min(...heights), 'three at one height').toBeLessThanOrEqual(1);
    if (size.width === 375) {
      expect(three.stackedFoot, 'three stack on a phone').toBe(true);
      for (const b of three.buttons) expect(Math.abs(three.foot.right - b.right), `${b.words} at the right`).toBeLessThanOrEqual(1);
      for (let i = 1; i < three.buttons.length; i++) expect(three.buttons[i]!.top - three.buttons[i - 1]!.bottom, 'in code order, 8 px apart').toBeGreaterThanOrEqual(8 - 0.5);
    } else {
      expect(three.stackedFoot, 'three in a row on a tablet').toBe(false);
      const middle = (b: Box) => (b.top + b.bottom) / 2;
      for (let i = 1; i < three.buttons.length; i++) {
        const [a, b] = [three.buttons[i - 1]!, three.buttons[i]!];
        expect(Math.abs(middle(a) - middle(b)), 'one line').toBeLessThan(2);
        expect(b.left - a.right, 'in code order, 8 px apart').toBeGreaterThanOrEqual(8 - 0.5);
      }
      expect(Math.abs(three.foot.right - three.buttons[2]!.right), 'the group at the right').toBeLessThanOrEqual(1);
    }

    expect(scrollWidth, 'no sideways scroll').toBeLessThanOrEqual(size.width);
  });
}

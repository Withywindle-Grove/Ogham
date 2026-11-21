import { expect } from '@playwright/test';
import { test } from '../fails.ts';

// The creation review's foot (approved frames creation/final 22-G1 at a phone and 22-G8 at the iPad; ft-1: a lone
// accent keeps its own width), measured in the gallery's first "Creation review" specimen in WebKit at 375 px and at
// the iPad (820 x 1180). Purposes, the same at both widths:
//   * no blank band: the gap between the hint's bottom and the first foot button below it is at most the foot's row
//     gap (8 px), and the hint is only its own lines tall;
//   * "Send to the GM" is narrower than the foot and sits at its right edge;
//   * "Start over" and "Save and leave" sit in one row, in that order, at the right;
//   * on a phone the accent has a row of its own under the pair (G1); on the iPad the pair and Send share one row (G8);
//   * the review's foot has no Back (the bar's arrow goes back).
// The first test keeps the specimen's one-line hint; the second sets a two-line one.

test("the review's foot with a one-line hint: no band, Send at the right at its own width, the quiet pair in one row (375 px and the iPad)", async ({ page }) => {
  type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
  for (const size of [
    { name: 'phone', width: 375, height: 812, accentOwnRow: true },
    { name: 'iPad', width: 820, height: 1180, accentOwnRow: false },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const foot = document.querySelector('.creation-step__foot--stacked') as HTMLElement;
      const hintEl = foot.querySelector('.creation-step__hint') as HTMLElement;
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const range = document.createRange();
      range.selectNodeContents(hintEl);
      const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
      const buttons = [...foot.querySelectorAll('button')].map((b) => ({ ...box(b), text: (b.textContent ?? '').trim(), accent: b.classList.contains('button-primary') }));
      return { foot: box(foot), hint: box(hintEl), lines, lineHeight: parseFloat(getComputedStyle(hintEl).lineHeight) || 20, buttons, backs: foot.querySelectorAll('.creation-step__foot-back').length };
    });
    const at = `${size.name}, ${size.width} px`;
    expect(m.lines, `a one-line hint (${at})`).toBe(1);
    expect(m.backs, `no Back (${at})`).toBe(0);
    expect(m.buttons.map((b) => b.text), at).toEqual(['Start over', 'Save and leave', 'Send to the GM']);
    const [startOver, saveLeave, send] = m.buttons as unknown as [Box, Box, Box & { accent: boolean }];
    const below = m.buttons.filter((b) => b.top >= m.hint.bottom - 1);
    if (below.length > 0) expect(Math.min(...below.map((b) => b.top)) - m.hint.bottom, `no blank band under the hint (${at})`).toBeLessThanOrEqual(8.5);
    expect(m.hint.height, `the hint is its own lines tall (${at})`).toBeLessThanOrEqual(m.lineHeight * m.lines + 2);
    expect(send.accent, at).toBe(true);
    expect(Math.abs(m.foot.right - send.right), `Send at the right (${at})`).toBeLessThanOrEqual(1);
    expect(send.width, `Send at its own width (${at})`).toBeLessThan(m.foot.width - 40);
    expect(send.left - m.foot.left, `Send not at the left (${at})`).toBeGreaterThan(40);
    const middle = (b: Box) => (b.top + b.bottom) / 2;
    expect(Math.abs(middle(startOver) - middle(saveLeave)), `the pair on one row (${at})`).toBeLessThan(2);
    expect(saveLeave.left - startOver.right, `the pair in order, apart (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
    if (size.accentOwnRow) {
      expect(Math.abs(m.foot.right - saveLeave.right), `the pair at the right (${at})`).toBeLessThanOrEqual(1);
      expect(send.top - saveLeave.bottom, `Send on a row of its own under the pair (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
    } else {
      expect(Math.abs(middle(saveLeave) - middle(send)), `the pair and Send on one row (${at})`).toBeLessThan(2);
      expect(send.left - saveLeave.right, `the pair, then Send at the right (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
    }
  }
});

test("the review's foot with a two-line hint: no band, Send at the right at its own width, the quiet pair in one row (375 px and the iPad)", async ({ page }) => {
  type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
  for (const size of [
    { name: 'phone', width: 375, height: 812, accentOwnRow: true },
    { name: 'iPad', width: 820, height: 1180, accentOwnRow: false },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const foot = document.querySelector('.creation-step__foot--stacked') as HTMLElement;
      const hintEl = foot.querySelector('.creation-step__hint') as HTMLElement;
      // Two lines at both widths: the full width of a phone, and beside the buttons on the iPad.
      hintEl.textContent = 'Languages: pick 1 more. Weapon skills: pick 2 more.';
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const range = document.createRange();
      range.selectNodeContents(hintEl);
      const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
      const buttons = [...foot.querySelectorAll('button')].map((b) => ({ ...box(b), text: (b.textContent ?? '').trim(), accent: b.classList.contains('button-primary') }));
      return { foot: box(foot), hint: box(hintEl), lines, lineHeight: parseFloat(getComputedStyle(hintEl).lineHeight) || 20, buttons, backs: foot.querySelectorAll('.creation-step__foot-back').length };
    });
    const at = `${size.name}, ${size.width} px`;
    expect(m.lines, `a two-line hint (${at})`).toBe(2);
    expect(m.backs, `no Back (${at})`).toBe(0);
    expect(m.buttons.map((b) => b.text), at).toEqual(['Start over', 'Save and leave', 'Send to the GM']);
    const [startOver, saveLeave, send] = m.buttons as unknown as [Box, Box, Box & { accent: boolean }];
    const below = m.buttons.filter((b) => b.top >= m.hint.bottom - 1);
    if (below.length > 0) expect(Math.min(...below.map((b) => b.top)) - m.hint.bottom, `no blank band under the hint (${at})`).toBeLessThanOrEqual(8.5);
    expect(m.hint.height, `the hint is its own lines tall (${at})`).toBeLessThanOrEqual(m.lineHeight * m.lines + 2);
    expect(send.accent, at).toBe(true);
    expect(Math.abs(m.foot.right - send.right), `Send at the right (${at})`).toBeLessThanOrEqual(1);
    expect(send.width, `Send at its own width (${at})`).toBeLessThan(m.foot.width - 40);
    expect(send.left - m.foot.left, `Send not at the left (${at})`).toBeGreaterThan(40);
    const middle = (b: Box) => (b.top + b.bottom) / 2;
    expect(Math.abs(middle(startOver) - middle(saveLeave)), `the pair on one row (${at})`).toBeLessThan(2);
    expect(saveLeave.left - startOver.right, `the pair in order, apart (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
    if (size.accentOwnRow) {
      expect(Math.abs(m.foot.right - saveLeave.right), `the pair at the right (${at})`).toBeLessThanOrEqual(1);
      expect(send.top - saveLeave.bottom, `Send on a row of its own under the pair (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
    } else {
      expect(Math.abs(middle(saveLeave) - middle(send)), `the pair and Send on one row (${at})`).toBeLessThan(2);
      expect(send.left - saveLeave.right, `the pair, then Send at the right (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
    }
  }
});

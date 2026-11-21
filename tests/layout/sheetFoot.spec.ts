// A sheet's or pop-up's foot (ft-1, 2026-11-14, "buttons are right justified"; the approved Pack
// frames PK3, PK5, PK10b and the shop's TW4a), measured in the gallery's "A sheet's foot" section in WebKit at a phone
// (375) and a tablet (1024 and 1180). Purposes:
//   * a foot with one accent: it sits at the right edge, at its own width (narrower than the foot, not at the left);
//   * a foot with two or more buttons: side by side, the group's right edge on the foot's, in code order (these
//     specimens write the accent first, as no drawing settles them); stacked, each at the right in the same order,
//     only when they don't fit one row:
//     the three-button foot is one row on a tablet and stacks at 375 px; the two-button foot is one row at both;
//   * a stacked accent alone in a foot: at the right edge, at its own width;
//   * the Patron step's foot keeps its own order (Back to Class, then Choose a patron), at the right;
//   * in a two-button foot, Tab order follows the order on screen;
//   * the kit's roll sequence (a sheet) keeps Next at the right at its own width at 375 px, after Back.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'iPad landscape', width: 1180, height: 820 },
]) {
  test(`a sheet's foot: a lone accent at the right at its own width; two or more side by side at the right in code order (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const feet = await page.evaluate(() =>
      [...document.querySelectorAll('#sheet-foot .dialog__actions')].map((foot) => {
        const box = (el: Element): Box => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        return {
          foot: box(foot),
          stackedFoot: foot.classList.contains('dialog__actions--stacked'),
          buttons: [...foot.querySelectorAll(':scope > button')].map((b) => ({ ...box(b), accent: b.classList.contains('button-primary'), stacked: b.classList.contains('stacked-button') })),
        };
      }),
    );
    // Four feet here; the section's last three are the stacked button's width (stk-2), in stackedWidth.spec.ts.
    expect(feet).toHaveLength(7);
    type Foot = (typeof feet)[number];
    const [alone, two, three, stacked] = feet as [Foot, Foot, Foot, Foot];

    // One accent alone: its right edge on the foot's, narrower than the foot, so clear of its left edge.
    for (const [what, f] of [
      ['a lone accent', alone],
      ['a stacked accent alone', stacked],
    ] as const) {
      expect(f.buttons, what).toHaveLength(1);
      const b = f.buttons[0]!;
      expect(b.accent, what).toBe(true);
      expect(Math.abs(f.foot.right - b.right), `${what} at the right`).toBeLessThanOrEqual(1);
      expect(b.width, `${what} at its own width`).toBeLessThan(f.foot.width - 40);
      expect(b.left - f.foot.left, `${what} not at the left`).toBeGreaterThan(40);
      expect(b.height, `${what} a 44 px tap`).toBeGreaterThanOrEqual(43.5);
    }
    expect(stacked.buttons[0]!.stacked).toBe(true);

    const middle = (b: Box) => (b.top + b.bottom) / 2;
    // A row: one line, in code order (the specimens write the accent first), the last button's right edge on the foot's.
    const isRow = (f: Foot, what: string) => {
      expect(f.stackedFoot, `${what} not stacked`).toBe(false);
      expect(f.buttons[0]!.accent, `${what}: code order, the accent written first`).toBe(true);
      for (let i = 1; i < f.buttons.length; i++) {
        const [a, b] = [f.buttons[i - 1]!, f.buttons[i]!];
        expect(Math.abs(middle(a) - middle(b)), `${what} on one line`).toBeLessThan(2);
        expect(b.left - a.right, `${what}: in order, 8 px apart`).toBeGreaterThanOrEqual(8 - 0.5);
      }
      expect(Math.abs(f.foot.right - f.buttons[f.buttons.length - 1]!.right), `${what}: the group at the right`).toBeLessThanOrEqual(1);
      expect(f.buttons[0]!.left - f.foot.left, `${what}: not stretched to the left`).toBeGreaterThan(8);
    };
    // Stacked: each at the right edge, top to bottom in code order (the accent, written first, on top).
    const isStack = (f: Foot, what: string) => {
      expect(f.stackedFoot, `${what} stacked`).toBe(true);
      expect(f.buttons[0]!.accent, `${what}: code order, the accent written first on top`).toBe(true);
      for (const b of f.buttons) expect(Math.abs(f.foot.right - b.right), `${what}: each at the right`).toBeLessThanOrEqual(1);
      for (let i = 1; i < f.buttons.length; i++) expect(f.buttons[i]!.top - f.buttons[i - 1]!.bottom, `${what}: in order, 8 px apart`).toBeGreaterThanOrEqual(8 - 0.5);
    };

    expect(two.buttons).toHaveLength(2);
    expect(three.buttons).toHaveLength(3);
    isRow(two, 'two buttons');
    if (size.width === 375) isStack(three, 'three buttons at 375 px');
    else isRow(three, 'three buttons on a tablet');

    // The Patron step's "Pick a patron first" keeps its own order (no drawing reorders it): Back to Class, then Choose
    // a patron, read left to right on one row or top to bottom when stacked, the group at the right.
    const patron = await page.evaluate(() => {
      const foot = document.querySelector('#patron-first .dialog__actions')!;
      const f = foot.getBoundingClientRect();
      return {
        right: f.right,
        buttons: [...foot.querySelectorAll(':scope > button')].map((b) => {
          const r = b.getBoundingClientRect();
          return { words: b.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      };
    });
    expect(patron.buttons.map((b) => b.words)).toEqual(['Back to Class', 'Choose a patron']);
    const [back, choose] = patron.buttons as [(typeof patron.buttons)[number], (typeof patron.buttons)[number]];
    expect(choose.left >= back.right || choose.top >= back.bottom - 0.5, 'Choose a patron after Back to Class').toBe(true);
    expect(Math.abs(patron.right - choose.right), 'the Patron foot at the right').toBeLessThanOrEqual(1);
  });

  // Purpose: in a two-button foot, Tab goes from the first button to the second, the same order as on screen.
  test(`a two-button foot: Tab order follows the order on screen (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    const foot = page.locator('#sheet-foot .dialog__actions').nth(1);
    await foot.getByRole('button', { name: 'Save' }).focus();
    await page.keyboard.press('Tab');
    await expect(foot.getByRole('button', { name: 'Cancel' })).toBeFocused();
  });
}

// Purpose: the kit's roll sequence is a sheet (the lead, 2026-11-14), so at 375 px its accent (Next or Done) sits at the
// right at its own width, after Back, never the full width the phone gives other accents.
test("the roll sequence's foot at 375 px: Next at the right at its own width, after Back", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html?theme=light');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const feet = await page.evaluate(() =>
    [...document.querySelectorAll('#creation-gear .roll-sequence__foot')].map((foot) => {
      const f = foot.getBoundingClientRect();
      const box = (sel: string) => {
        const r = foot.querySelector(sel)!.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
      };
      return { foot: { left: f.left, right: f.right, width: f.width }, next: box('.button-primary'), back: box('.creation-step__foot-back') };
    }),
  );
  expect(feet.length).toBeGreaterThan(0);
  for (const { foot, next, back } of feet) {
    expect(next.width, 'Next at its own width').toBeLessThan(foot.width / 2);
    expect(Math.abs(foot.right - next.right), 'Next at the right').toBeLessThanOrEqual(1);
    expect(next.left >= back.right || next.top >= back.bottom - 0.5, 'Back before Next').toBe(true);
  }
});

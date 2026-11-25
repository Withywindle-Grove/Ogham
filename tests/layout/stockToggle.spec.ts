// The three-position stock toggle (town row TC9, carried from the stack's W9a; tn-4; page 19 frame TW8f, ap-13) in a
// real browser, on the component gallery's section, at 375 and 1024 px, light and dark, and at Larger text. What it
// checks, in plain words:
//   * each half is a 44 px target, with 8 px between the two, and the usual 52 by 28 track sits centred under them;
//   * the knob sits in the middle on "?", at the left on "not in stock", at the right on "in stock";
//   * the halves lie over the track, so a half's focus ring is never painted over;
//   * a tap on the right half sets in and on the left half sets out;
//   * nothing scrolls sideways and axe finds no serious problem; a picture of the section for Design.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function open(page: Page, query: string) {
  await page.goto(`/gallery.html?${query}`);
  // As the gallery spec waits: the page drawn and its fonts in, so nothing redraws under the tap.
  await page.getByRole('heading', { name: 'Component gallery' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`the stock toggle (${size.name}, ${theme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      // Purpose (TW8f): the targets, the gap between them, the track and the knob's place; the track under the halves.
      test.fail('two 44 px halves 8 px apart, the track centred under them, the knob in place', async ({ page }) => {
        // The whole gallery loads and is measured for sideways scrolling: more than the default 30 s on a slow machine.
        test.setTimeout(90_000);
        await open(page, `theme=${theme}`);
        const section = page.locator('#stock-toggle');
        await section.scrollIntoViewIfNeeded();
        for (const [thing, at] of [
          ['Lamp oil', 'middle'],
          ['Bog-iron coat', 'left'],
          ['Reed spear', 'right'],
        ] as const) {
          const group = section.getByRole('radiogroup', { name: new RegExp(`^${thing}, stocked today`) });
          const out = (await group.getByRole('radio', { name: 'Not in stock', exact: true }).boundingBox())!;
          const inn = (await group.getByRole('radio', { name: 'In stock', exact: true }).boundingBox())!;
          const track = (await group.locator('.switch__track').boundingBox())!;
          const knob = (await group.locator('.switch__thumb').boundingBox())!;
          for (const half of [out, inn]) {
            expect(half.width).toBeCloseTo(44, 0);
            expect(half.height).toBeCloseTo(44, 0);
          }
          expect(inn.x - (out.x + out.width)).toBeCloseTo(8, 0);
          expect(track.width).toBeCloseTo(52, 0);
          expect(track.height).toBeCloseTo(28, 0);
          const groupBox = (await group.boundingBox())!;
          expect(Math.abs(track.x + track.width / 2 - (groupBox.x + groupBox.width / 2))).toBeLessThan(1);
          const knobMiddle = knob.x + knob.width / 2;
          const trackMiddle = track.x + track.width / 2;
          if (at === 'middle') expect(Math.abs(knobMiddle - trackMiddle)).toBeLessThan(1);
          if (at === 'left') expect(knobMiddle).toBeLessThan(trackMiddle - 8);
          if (at === 'right') expect(knobMiddle).toBeGreaterThan(trackMiddle + 8);
          // Where a half and the track overlap, the half is on top: its focus ring is drawn over the track, never under it.
          // (The track takes no taps, so for this one look it is made hit-testable: what is then found on top is what paints on top.)
          const onTop = await group.evaluate((el, [x, y]) => {
            const trackEl = el.querySelector<HTMLElement>('.switch__track')!;
            trackEl.style.pointerEvents = 'auto';
            const found = document.elementFromPoint(x!, y!)?.closest('[aria-label]')?.getAttribute('aria-label') ?? null;
            trackEl.style.pointerEvents = '';
            return found;
          }, [out.x + out.width - 2, out.y + out.height / 2]);
          expect(onTop).toBe('Not in stock');
        }
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '#stock-toggle')).toEqual([]);
        await section.screenshot({ path: `test-results/layout-screens/stock-toggle-${size.width}-${theme}.png` });
      });

      // Purpose (TW8f): the halves set in and out.
      test.fail('a tap sets in, then out', async ({ page }) => {
        await open(page, `theme=${theme}`);
        const group = page.locator('#stock-toggle').getByRole('radiogroup', { name: /^Waxed coat, stocked today/ });
        await expect(group).toHaveAttribute('aria-label', 'Waxed coat, stocked today: not decided');
        // Scrolled to first, as a tap is made on what the GM sees (the gallery redraws as it scrolls a long way at once).
        await group.scrollIntoViewIfNeeded();
        await group.getByRole('radio', { name: 'In stock', exact: true }).click();
        await expect(group.getByRole('radio', { name: 'In stock', exact: true })).toHaveAttribute('aria-checked', 'true');
        await group.getByRole('radio', { name: 'Not in stock', exact: true }).click();
        await expect(group.getByRole('radio', { name: 'Not in stock', exact: true })).toHaveAttribute('aria-checked', 'true');
      });
    });
  }
}

// Purpose (the plan's States: Larger text): at a phone's width with Larger text the halves stay 44 px, 8 px apart, and
// nothing in the section scrolls sideways.
test.describe('the stock toggle at Larger text', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.fail('the halves keep their size and gap', async ({ page }) => {
    await open(page, 'theme=light&size=larger');
    const section = page.locator('#stock-toggle');
    await section.scrollIntoViewIfNeeded();
    const group = section.getByRole('radiogroup', { name: /^Bog-iron coat, stocked today/ });
    const out = (await group.getByRole('radio', { name: 'Not in stock', exact: true }).boundingBox())!;
    const inn = (await group.getByRole('radio', { name: 'In stock', exact: true }).boundingBox())!;
    expect(Math.min(out.width, out.height, inn.width, inn.height)).toBeGreaterThanOrEqual(43.5);
    expect(inn.x - (out.x + out.width)).toBeGreaterThanOrEqual(7.5);
    expect(await layoutProblems(page)).toEqual([]);
    await section.screenshot({ path: 'test-results/layout-screens/stock-toggle-375-larger.png' });
  });
});

// The words under the strip's circles (scene-test-small-fixes; Francis's test of the live Scene, 18 Nov 2026: he saw
// "Wanderin / g / monsters" under a circle on a tablet). In a real browser on the layout page's invented harbour, with
// its procedure of seven steps (`&strip=words`): one named in two words, "Wandering monsters", which is also a tap,
// and one named in a single 14-letter word, "Lanternkeeping". What it checks, in plain words:
//   * on a tablet a label wraps only between words: no word is cut in two, at Standard and at Large text;
//   * a word too long for its step makes that step wider, and the label stays inside its step;
//   * nothing else moves the circles: the dotted links are all one length, and a step is wider than the narrowest one
//     only by what its own longest word needs; the circles stay in one row at their full size;
//   * on a phone, where the words don't show, the circles stay evenly spaced and each is still named;
//   * the tap is 44 px at least, nothing scrolls sideways, and axe finds no serious problem, in light and dark.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

type Size = 'standard' | 'large';

async function openStrip(page: Page, size: Size) {
  // The device's text size, as the personal menu saves it (src/ui/textSize.ts).
  await page.addInitScript((saved) => localStorage.setItem('grimoire.textSize', saved), size);
  await page.goto('/layout.html?as=gm&placePage=spots&session=running&strip=words');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('region', { name: 'Locations' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const strip = page.getByRole('group', { name: 'Sequence of play' });
  await expect(strip.locator('.procedure-strip__step')).toHaveCount(7);
  return strip;
}

/** The strip as drawn: each step's box, its circle, its label's box and words (the widest, and any cut in two), and each link's length. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const strip = document.querySelector('.procedure-strip')!;
    const box = strip.getBoundingClientRect();
    const steps = [...strip.querySelectorAll('.procedure-strip__step')].map((step) => {
      const own = step.getBoundingClientRect();
      const circle = step.querySelector('.procedure-strip__circle')!.getBoundingClientRect();
      const name = step.querySelector('.procedure-strip__name')!;
      const shown = getComputedStyle(name).display !== 'none';
      const label = name.getBoundingClientRect();
      const cut: string[] = [];
      let widestWord = 0;
      const text = name.firstChild;
      if (shown && text) {
        for (const word of (name.textContent ?? '').matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(text, word.index);
          range.setEnd(text, word.index + word[0].length);
          const pieces = [...range.getClientRects()];
          // A word on more than one line has pieces at more than one height.
          if (new Set(pieces.map((piece) => Math.round(piece.top))).size > 1) cut.push(word[0]);
          widestWord = Math.max(widestWord, ...pieces.map((piece) => piece.width));
        }
      }
      return {
        left: own.left,
        right: own.right,
        width: own.width,
        circleTop: Math.round(circle.top),
        circleWidth: circle.width,
        circleHeight: circle.height,
        centre: circle.left + circle.width / 2,
        shown,
        labelLeft: label.left,
        labelRight: label.right,
        cut,
        widestWord,
      };
    });
    const links = [...strip.querySelectorAll('.procedure-strip__link')].filter((link) => getComputedStyle(link).display !== 'none').map((link) => link.getBoundingClientRect().width);
    return { left: box.left, right: box.right, steps, links };
  });
}

for (const width of [680, 834] as const) {
  for (const size of ['standard', 'large'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test.describe(`the strip's words (${width} px, ${size} text, ${scheme})`, () => {
        test.use({ viewport: { width, height: 900 }, colorScheme: scheme });

        // Purpose: on a tablet a step's label wraps only between words, a word too long for its step widens that step and nothing else moves the circles, and the row still fits with its tap at 44 px.
        test('a label never breaks inside a word', async ({ page }) => {
          const strip = await openStrip(page, size);
          const drawn = await measure(page);
          // The words show under every circle, and none is cut in two.
          expect(drawn.steps.every((step) => step.shown)).toBe(true);
          expect(drawn.steps.flatMap((step) => step.cut)).toEqual([]);
          for (const step of drawn.steps) {
            // The label stays inside its step, and the step inside the strip.
            expect(step.labelLeft).toBeGreaterThanOrEqual(step.left - 1);
            expect(step.labelRight).toBeLessThanOrEqual(step.right + 1);
            expect(step.left).toBeGreaterThanOrEqual(drawn.left - 1);
            expect(step.right).toBeLessThanOrEqual(drawn.right + 1);
            // The circle keeps its size: a round 56 px.
            expect(Math.abs(step.circleWidth - 56)).toBeLessThanOrEqual(1);
            expect(Math.abs(step.circleHeight - 56)).toBeLessThanOrEqual(1);
          }
          // One row of circles.
          expect(new Set(drawn.steps.map((step) => step.circleTop)).size).toBe(1);
          // Nothing but a long word moves a circle: the links are one length, and a step is wider than the narrowest
          // only by what its own longest word needs.
          expect(drawn.links).toHaveLength(6);
          expect(Math.max(...drawn.links) - Math.min(...drawn.links)).toBeLessThanOrEqual(1);
          const narrowest = Math.min(...drawn.steps.map((step) => step.width));
          for (const step of drawn.steps) expect(step.width).toBeLessThanOrEqual(Math.max(narrowest, step.widestWord) + 1);
          // The 14-letter word is on one line, in a step as wide as it needs.
          const long = drawn.steps[2]!;
          expect(long.width).toBeGreaterThanOrEqual(long.widestWord - 1);
          // The tap is 44 px at least, each way.
          const tap = (await strip.getByRole('button', { name: 'Wandering monsters: read it' }).boundingBox())!;
          expect(Math.min(tap.width, tap.height)).toBeGreaterThanOrEqual(44);
          await page.screenshot({ path: `test-results/layout-screens/scene-strip-words-${width}-${size}-${scheme}.png`, fullPage: true });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        });
      });
    }
  }
}

for (const size of ['standard', 'large'] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the strip's words (375 px, ${size} text, ${scheme})`, () => {
      test.use({ viewport: { width: 375, height: 812 }, colorScheme: scheme });

      // Purpose: on a phone the same seven steps show no words, stay evenly spaced in one row with each circle named, and fit with the tap at 44 px. (It holds before the fix as well: it is here so the fix cannot disturb the phone.)
      test('on a phone the circles stay evenly spaced', async ({ page }) => {
        const strip = await openStrip(page, size);
        const drawn = await measure(page);
        expect(drawn.steps.some((step) => step.shown)).toBe(false);
        expect(new Set(drawn.steps.map((step) => step.circleTop)).size).toBe(1);
        for (const step of drawn.steps) {
          expect(step.left).toBeGreaterThanOrEqual(drawn.left - 1);
          expect(step.right).toBeLessThanOrEqual(drawn.right + 1);
        }
        // Evenly spaced: the tap keeps 44 px while the quiet rings give way, so the gaps beside it differ by a
        // couple of pixels and no more.
        const gaps = drawn.steps.slice(1).map((step, index) => step.centre - drawn.steps[index]!.centre);
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(4);
        // Each circle is still named for a screen reader.
        await expect(strip.getByRole('img', { name: 'Lanternkeeping' })).toBeVisible();
        const tap = (await strip.getByRole('button', { name: 'Wandering monsters: read it' }).boundingBox())!;
        expect(Math.min(tap.width, tap.height)).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/scene-strip-words-375-${size}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

// Purpose (the local review of #993): on the narrowest tablet at Larger text, a strip wider than its box keeps its
// first step reachable: nothing spills off its left edge, where it could not be scrolled to.
test('a strip wider than its box keeps its first step reachable (600 px, Larger text)', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto('/layout.html?as=gm&placePage=spots&session=running&strip=words');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('region', { name: 'Locations' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('group', { name: 'Sequence of play' }).locator('.procedure-strip__step')).toHaveCount(7);
  const drawn = await page.evaluate(() => {
    const strip = document.querySelector('.procedure-strip')!;
    const box = strip.getBoundingClientRect();
    const steps = [...strip.querySelectorAll('.procedure-strip__step')].map((step) => step.getBoundingClientRect());
    return { left: box.left, width: box.width, first: steps[0]!.left, rowWidth: steps.at(-1)!.right - steps[0]!.left };
  });
  // The case the review names: the row is wider than its box here.
  expect(drawn.rowWidth).toBeGreaterThan(drawn.width);
  // The first step starts inside the strip, never off its left edge.
  expect(drawn.first).toBeGreaterThanOrEqual(drawn.left - 1);
});

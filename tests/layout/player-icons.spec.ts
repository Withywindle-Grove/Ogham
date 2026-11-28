// Spec player-sitting, piece 8 (#170; p47-2, frame 47-2 of december/47, approved by Francis 2026-11-28): the Player
// screen's Fire, Drink, Eat and Stance buttons in a real browser, on the shared P1-like character with arrows, bread and
// a draught pinned and the bog-ox horns worn ready (layout.html ?as=player&p1=icons; src/testing/layoutP1Character.ts).
// Purposes:
//   Each of the four draws the icon Francis picked (Fire the striking arrows, Drink the round flask, Eat the bread,
//   Stance the pikeman), above its word, in the button's own text colour, so it reads in dark mode as the word does.
//   At the normal and the Larger text size, at 1180 and 375 px, in light and dark: each is a 44 px target at least,
//   88 px wide at least, its word on one line, inside At hand; the page never scrolls sideways, and the layout and
//   accessibility checks find nothing.
import { expect, test } from '@playwright/test';
import { ICON_SET, type SetIconName } from '../../src/ui/iconSet.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

const PICKED: [RegExp, string, SetIconName][] = [
  [/^Fire /, 'Fire', 'striking-arrows'],
  [/^Drink /, 'Drink', 'round-bottom-flask'],
  [/^Eat /, 'Eat', 'bread'],
  [/^Stance /, 'Stance', 'pikeman'],
];

for (const scheme of ['light', 'dark'] as const) {
  for (const larger of [false, true]) {
    for (const size of SIZES) {
      test.describe(`${size.name}, ${scheme}${larger ? ', Larger text' : ''}`, () => {
        test.use({ colorScheme: scheme });

        test(`Fire, Drink, Eat and Stance carry their picked icons (${size.width} px)`, async ({ page }) => {
          if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
          await page.setViewportSize({ width: size.width, height: size.height });
          await page.goto('/layout.html?as=player&p1=icons');
          await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
          const atHand = page.getByRole('region', { name: 'At hand' });
          await expect(atHand).toBeVisible();
          await page.evaluate(() => document.fonts.ready);

          for (const [name, word, icon] of PICKED) {
            const button = atHand.getByRole('button', { name });
            await expect(button).toBeVisible();
            await expect(button).toHaveClass(/stacked-button/);
            await expect(button).toHaveText(word);
            const facts = await button.evaluate((b) => {
              const box = b.getBoundingClientRect();
              const svg = b.querySelector('svg')!;
              const words = b.querySelector('span')!;
              const lineHeight = parseFloat(getComputedStyle(words).lineHeight) || 20;
              const outer = b.closest('[aria-label="At hand"]')!.getBoundingClientRect();
              return {
                d: svg.querySelector('path')?.getAttribute('d') ?? null,
                width: box.width,
                height: box.height,
                inside: box.left >= outer.left - 0.5 && box.right <= outer.right + 0.5,
                oneLine: words.getBoundingClientRect().height <= lineHeight * 1.5,
                iconAbove: svg.getBoundingClientRect().bottom <= words.getBoundingClientRect().top + 1,
                iconColour: getComputedStyle(svg).fill === 'currentcolor' || getComputedStyle(svg).color === getComputedStyle(b).color,
              };
            });
            expect(facts.d, word).toBe(ICON_SET[icon].d);
            expect(facts.height, word).toBeGreaterThanOrEqual(44);
            expect(facts.width, word).toBeGreaterThanOrEqual(88);
            expect(facts.inside, word).toBe(true);
            expect(facts.oneLine, word).toBe(true);
            expect(facts.iconAbove, word).toBe(true);
            expect(facts.iconColour, word).toBe(true);
          }

          expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page, '[aria-label="At hand"]')).toEqual([]);
        });
      });
    }
  }
}

// The Skills heading's roll line and a skill's figure (plan test-feedback-2026-11-19 rows C13 and C14; tfs-2, tfs-3;
// page M1, approved 2026-11-19), on the shared P1-like character with a roll for skills and three more skills
// (`layout.html?as=player&p1=skills`, src/testing/layoutP1Character.ts). Purposes:
//   The Skills heading's row carries the d6's glyph and "Roll d6: target or higher succeeds.", inside the screen, on a
//   tablet and on a 375 px phone, in light and dark.
//   A skill rolled the target or higher reads "N+ on", the die's glyph, "dN" on one line, the glyph between the words;
//   a long skill name wraps beside its figure and the figure never wraps; the pack's other styles ("2-in-6", "35%")
//   keep the glyph before the figure.
//   The full sheet's own page shows the same line and figures.
//   No text under 14 px, no sideways scroll, every row a 44 px target and no serious accessibility problem in Skills.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';
import { openFullSheetFromMenu } from './fullSheetMenu.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;
const LINE = 'Roll d6: target or higher succeeds.';
const LONG = 'Finding the way through fen and reed-bed';

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=skills');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Skills' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** The heading's row: the line's words, its d6 glyph visible, all inside the screen. */
async function checkHeading(skills: Locator, width: number) {
  const line = skills.locator('.rule-heading .roll-row--heading');
  await line.scrollIntoViewIfNeeded();
  await expect(line).toHaveText(LINE);
  await expect(line.locator('.die-glyph[data-die="6"]')).toBeVisible();
  const box = (await line.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
}

/** A value's words as drawn: each text part with its box. */
const wordsOf = (value: Locator) =>
  value.evaluate((el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
      .map((n) => {
        const range = document.createRange();
        range.selectNodeContents(n);
        const box = range.getBoundingClientRect();
        return { text: n.textContent!.trim(), x: box.x, right: box.right, top: box.top, height: box.height };
      }),
  );

/** One skill's row: its figure's parts in order, on one line, the row a 44 px target inside the screen. */
async function checkRow(skills: Locator, name: RegExp, parts: string[], glyphAt: number, width: number) {
  const row = skills.getByRole('button', { name });
  await row.scrollIntoViewIfNeeded();
  const value = row.locator('.list-row__value');
  const glyph = value.locator('.die-glyph');
  await expect(glyph).toBeVisible();
  const [r, g, v] = await Promise.all([row.boundingBox(), glyph.boundingBox(), value.boundingBox()]);
  expect(r!.height).toBeGreaterThanOrEqual(44);
  expect(r!.x + r!.width).toBeLessThanOrEqual(width);
  const words = await wordsOf(value);
  expect(words.map((w) => w.text)).toEqual(parts);
  // The glyph before the word part at `glyphAt`, after the one before it.
  if (glyphAt > 0) expect(words[glyphAt - 1]!.right).toBeLessThanOrEqual(g!.x + 0.5);
  expect(g!.x + g!.width).toBeLessThanOrEqual(words[glyphAt]!.x + 0.5);
  // One line: every part on the same line, the glyph's middle within the value's box.
  for (const w of words) expect(Math.abs(w.top - words[0]!.top)).toBeLessThan(2);
  const middle = g!.y + g!.height / 2;
  expect(middle).toBeGreaterThan(v!.y);
  expect(middle).toBeLessThan(v!.y + v!.height);
  return { row: r!, value: v! };
}

async function checkSkills(page: Page, width: number) {
  const skills = page.getByRole('region', { name: 'Skills' });
  await checkHeading(skills, width);
  await checkRow(skills, /^Hark, .*6\+ on d6: where it comes from$/, ['6+ on', 'd6'], 1, width);
  const long = await checkRow(skills, new RegExp(`^${LONG} 6\\+ on d6: where it comes from$`), ['6+ on', 'd6'], 1, width);
  // On a phone the long name wraps beside the figure; the figure stays on one line.
  if (width < 600) expect(long.row.height).toBeGreaterThan(long.value.height * 1.5);
  await checkRow(skills, /^Forage 2-in-6: where it comes from$/, ['2-in-6'], 0, width);
  await checkRow(skills, /^Climb 35%: where it comes from$/, ['35%'], 0, width);
  return skills;
}

for (const scheme of SCHEMES) {
  test.describe(`the Skills line and figures (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`the heading's line and "N+ on d6" (${size.name}, ${size.width} px, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        await checkSkills(page, size.width);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await noSidewaysScroll(page)).toBe(true);
        expect(await accessibilityProblems(page, 'section[aria-label="Skills"]')).toEqual([]);
      });
    }

    test(`the full sheet's own page shows the same (phone, 375 px, ${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await openPlayer(page);
      // The full sheet's own page from the menu: the Player tab's row is gone (tfr-5).
      await openFullSheetFromMenu(page);
      await expect(page.getByRole('region', { name: 'Level' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await checkSkills(page, SIZES[1].width);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await noSidewaysScroll(page)).toBe(true);
    });
  });
}

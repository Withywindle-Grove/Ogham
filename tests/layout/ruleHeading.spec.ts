// The rule lines in the headings' rows (plan dec-13 C5; sv-3, pf-20, rl-1; frames P1 and P2 of december/14), in a real
// browser, on the shared P1-like character (layout.html ?p1=1: Brannoch Fenward on the invented fixture pack, a rules
// set above it carrying `rolls`).
// Purposes:
//   On a landscape tablet (1180) the Saves heading's row carries the d20 and "Roll d20: your save's number or higher
//   succeeds." beside the heading, on the same line, and the Scores heading's row "Roll d20: your score or lower
//   succeeds."; nothing in either is cut or runs past its section.
//   On a phone (375) the line may wrap under its heading, but stays above the tiles, inside the screen, its glyph
//   beside its words.
//   The saves' line is drawn once (not again under the tiles).
//   The shared character's screen shows the lit storm lantern's line with its refills, and Refill, in At hand (C9).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

async function openP1(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('heading', { name: 'Saves' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

for (const size of [
  { width: 1180, height: 820, sameRow: true },
  { width: 375, height: 812, sameRow: false },
]) {
  test(`the Saves and Scores headings carry their rule lines (${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openP1(page);
    for (const [name, words] of [
      ['Saves', "Roll d20: your save's number or higher succeeds."],
      ['Scores', 'Roll d20: your score or lower succeeds.'],
    ] as const) {
      const heading = page.getByRole('heading', { name, exact: true });
      const row = heading.locator('xpath=..');
      await expect(row).toHaveClass(/rule-heading/);
      const line = row.locator('.roll-row--heading');
      await expect(line).toHaveText(words);
      const [h, l, glyph, section] = await Promise.all([heading.boundingBox(), line.boundingBox(), line.locator('.die-glyph').boundingBox(), row.locator('xpath=..').boundingBox()]);
      // Inside its section and the screen.
      expect(l!.x).toBeGreaterThanOrEqual(section!.x - 0.5);
      expect(l!.x + l!.width).toBeLessThanOrEqual(Math.min(section!.x + section!.width, size.width) + 0.5);
      // The glyph sits beside the words, 16 px.
      expect(Math.round(glyph!.height)).toBe(16);
      if (size.sameRow) {
        // Beside the heading, on the same line.
        expect(l!.x).toBeGreaterThanOrEqual(h!.x + h!.width);
        expect(Math.abs(l!.y + l!.height / 2 - (h!.y + h!.height / 2))).toBeLessThanOrEqual(8);
      } else {
        // Wrapped or not, never above the heading's top.
        expect(l!.y).toBeGreaterThanOrEqual(h!.y - 0.5);
      }
    }
    // The saves' line is drawn once.
    await expect(page.getByText("Roll d20: your save's number or higher succeeds.")).toHaveCount(1);
    expect((await box(page, '.roll-row--heading')).width).toBeGreaterThan(0);
  });
}

test("the shared character's lantern: its line counts the refills, and Refill shows (375 px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openP1(page);
  // The lit lantern sits in At hand with no Light heading (dec-13 C9, frames P1 and P2).
  const light = page.getByRole('region', { name: 'At hand' }).locator('.light-block--at-hand');
  await expect(light.getByText('Lit, 4 turns left. 3 refills left')).toBeVisible();
  await expect(light.getByRole('button', { name: 'Refill' })).toBeVisible();
  await expect(light.getByRole('button', { name: 'Put out Storm lantern' })).toBeVisible();
});

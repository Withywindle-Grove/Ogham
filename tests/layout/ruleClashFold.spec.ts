// The rule cards fold (rc-fold; Francis, 2026-11-20: "the conflicting rules section needs to be collapsible, it takes
// up too much screen real estate and never closes"), in a real browser on Rules for this campaign with two attached
// packs offering the same rules (layout.html ?clash=1: one card with a long topic and long choice names).
// Purposes:
//   Folded, each card is one line, "▸ <Topic>, <choice> (<pack>)": a long topic and a long choice name wrap inside the
//   card and the screen, the line is a 44 px target, and nothing scrolls sideways (375 px and 1024 px). Folded it is a
//   plain row like the topic groups above (Francis's fix 1, 2026-11-20): no box, its chevron and words where theirs
//   are, the same dotted rule under it.
//   A tap opens one card with every pack's choices, still inside the screen; axe finds no serious problem either way.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const LONG = /^Initiative ties between two lantern wardens on the same count, /;

async function openRules(page: Page) {
  await page.goto('/layout.html?as=gm&clash=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('button', { name: LONG })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
]) {
  test.describe(`the rule cards fold (${size.width} px)`, () => {
    test.use({ viewport: size });

    test('folded: one wrapped line each, inside the card and the screen, a 44 px target', async ({ page }) => {
      await openRules(page);
      const line = page.getByRole('button', { name: LONG });
      await expect(line).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('button', { name: /^Ac style, / })).toHaveAttribute('aria-expanded', 'false');
      // Folded, no choice shows.
      await expect(page.getByRole('group', { name: /^Choice for/ })).toHaveCount(0);
      const [l, card] = await Promise.all([line.boundingBox(), line.locator('xpath=..').boundingBox()]);
      expect(l!.height).toBeGreaterThanOrEqual(44);
      expect(l!.x).toBeGreaterThanOrEqual(card!.x);
      expect(l!.x + l!.width).toBeLessThanOrEqual(card!.x + card!.width + 0.5);
      expect(card!.x + card!.width).toBeLessThanOrEqual(size.width);
      // At 375 px the long line wraps (more than one line tall), never runs past the card.
      if (size.width === 375) expect(l!.height).toBeGreaterThan(44);
      // A plain row like "Table and players": no box, the chevron and the words where theirs are, the same rule under it.
      await expect(page.locator('.rule-card .creation-callout')).toHaveCount(0);
      const sister = page.getByRole('button', { name: /^Table and players, / });
      const [chevA, chevB, wordsA, wordsB] = await Promise.all([
        line.locator('.campaign-rules__chevron').boundingBox(),
        sister.locator('.campaign-rules__chevron').boundingBox(),
        line.locator('.campaign-rules__name').boundingBox(),
        sister.locator('.campaign-rules__name').boundingBox(),
      ]);
      expect(Math.abs(chevA!.x - chevB!.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(wordsA!.x - wordsB!.x)).toBeLessThanOrEqual(0.5);
      const rule = (el: Element) => getComputedStyle(el).borderBottom;
      expect(await line.locator('xpath=..').evaluate(rule)).toBe(await sister.locator('xpath=..').evaluate(rule));
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test('a tap opens one card with every choice, inside the screen', async ({ page }) => {
      await openRules(page);
      await page.getByRole('button', { name: LONG }).click();
      const card = page.getByRole('group', { name: 'Choice for initiative ties between two lantern wardens on the same count' });
      await expect(card).toBeVisible();
      await expect(card.getByRole('button')).toHaveCount(4);
      await expect(page.getByRole('button', { name: LONG })).toHaveAttribute('aria-expanded', 'true');
      // The other card stays folded.
      await expect(page.getByRole('group', { name: 'Choice for ac style' })).toHaveCount(0);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  });
}

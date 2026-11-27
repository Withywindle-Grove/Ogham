// The GM's Players row (page 32, M3a and M3b, approved 2026-11-21; row C15a of plans/test-feedback-2026-11-19.md), in a
// real browser on a phone (375 px) and a tablet held sideways (1180 px), in light and dark. Purposes, in plain words:
//   1. A caster's row (Wren, ?magic=1) reads View sheet, Pack, Magic, Scene, ⋯, in that order; every button is at least
//      44 px high, with at least 8 px between buttons side by side.
//   2. With a long character's name and a long player's name (?view=long), at 375 px, ⋯ never sits alone on a line: it
//      shares its line with the last door, Scene; and the name and the player's line wrap beside the portrait, never
//      under it (M3b).
//   3. ⋯ opens Edit, Give to a player… and Remove…; Remove… opens its panel under the long-named row; Give to a
//      player… opens its sheet, which keeps its own form.
//   4. The page has no sideways scrolling, no text under 14 px, no small targets and no serious accessibility problem,
//      closed, with ⋯ open, and with the Remove panel open.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const LONG = 'Ashwin Thistlewood of the Long Stair, called the Lantern-Bearer';

async function openPlayers(page: Page, width: number, height: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=gm&magic=1&view=long&give=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await expect(page.getByRole('button', { name: 'Open Wren of the Lantern Wardens’ magic' })).toBeVisible();
}

const rowOf = (page: Page, name: string) => page.locator('li.gm__character-row').filter({ has: page.getByRole('button', { name: `More for ${name}` }) });

/** Each button's box in a row, in order. */
const boxes = async (row: Locator) => {
  const found = [];
  for (const button of await row.getByRole('button').all()) found.push((await button.boundingBox())!);
  return found;
};

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the Players row: doors, ⋯ beside the last, 44 px and 8 px apart (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayers(page, size.width, size.height, scheme);
      const wren = rowOf(page, 'Wren of the Lantern Wardens');
      const words = await wren.getByRole('button').evaluateAll((all) => all.map((b) => (b.getAttribute('aria-label')?.startsWith('More for') ? '⋯' : b.textContent)));
      expect(words).toEqual(['View sheet', 'Pack', 'Magic', 'Scene', '⋯']);

      for (const name of ['Wren of the Lantern Wardens', LONG]) {
        const row = rowOf(page, name);
        const all = await boxes(row);
        for (const box of all) expect(box.height).toBeGreaterThanOrEqual(43.5);
        // Side by side on one line: 8 px apart at least.
        for (let i = 1; i < all.length; i++) {
          const [a, b] = [all[i - 1]!, all[i]!];
          if (Math.abs(a.y - b.y) < 2) expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(7.5);
        }
        // ⋯ never alone on its line: the last door, Scene, sits on the same line (pg32-1).
        const [scene, more] = all.slice(-2);
        expect(Math.abs(scene!.y - more!.y)).toBeLessThan(2);
        // The name block beside the portrait, never under it (M3b): its left edge is right of the portrait's.
        const portrait = (await row.locator('.portrait').first().boundingBox())!;
        const main = (await row.locator('.gm__row-main').boundingBox())!;
        expect(main.x).toBeGreaterThanOrEqual(portrait.x + portrait.width);
      }

      await page.screenshot({ path: `test-results/layout-screens/gm-view-row-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      // ⋯ open: Edit, Give to a player…, Remove….
      await rowOf(page, LONG).getByRole('button', { name: `More for ${LONG}` }).click();
      const menu = page.locator('.more-menu__panel');
      await expect(menu).toBeVisible();
      expect(await menu.getByRole('button').allTextContents()).toEqual(['Edit', 'Give to a player…', 'Remove…']);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-row-menu-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      // Remove… from ⋯: today's panel under the long-named row.
      await menu.getByRole('button', { name: 'Remove…' }).click();
      const panel = rowOf(page, LONG).getByRole('group', { name: `Remove ${LONG}` });
      await expect(panel).toBeVisible();
      await page.screenshot({ path: `test-results/layout-screens/gm-view-row-remove-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await panel.getByRole('button', { name: 'Cancel' }).click();
      await expect(panel).toBeHidden();
      await rowOf(page, LONG).getByRole('button', { name: `More for ${LONG}` }).click();
      await expect(menu).toBeVisible();

      // Give to a player… from ⋯: its sheet, in the form it had as a button of the row.
      await menu.getByRole('button', { name: 'Give to a player…' }).click();
      const sheet = page.getByRole('dialog', { name: /Give to a player$/ });
      await expect(sheet).toBeVisible();
      await expect(sheet).not.toHaveClass(/\bdialog--book\b/);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
    });
  }
}

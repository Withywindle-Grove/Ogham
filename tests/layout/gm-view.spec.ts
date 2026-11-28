// The GM's view as the player, its shell and the View band (page 32, M3c, M3d, M3j, M3k, approved 2026-11-21; row
// C15b of plans/test-feedback-2026-11-19.md), in a real browser on a phone (375 px) and a tablet held sideways
// (1180 px), in light and dark. Purposes, in plain words:
//   1. View sheet on Wren opens her Player tab: "‹ Players" in the top row, the band under it, "Sam's view of Wren" and
//      "What you do here is logged as yours.", each on one line; on the Pack and Magic tabs the same band and way back.
//      No sideways scrolling, no text under 14 px, no small targets, no serious accessibility problem.
//   2. With a long player's name and a long character's name (?view=long), the band is two lines at most on a phone and
//      on a tablet: the name line is cut with "…" on screen, its name is whole, and the logged line stays whole. The
//      top row's "‹ Players" stays whole, never cut: the title alone takes the cut (M3d).
//   3. The GM's own character (Ash, ?give=1): the band is one line, "Your view of Ash".
//   4. The Scene tab: the same band and way back (what the Scene shows is row C15f's).
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const LONG_C = 'Ashwin Thistlewood of the Long Stair, called the Lantern-Bearer';
// Long enough that the band's name line overflows on a tablet held sideways in every browser (about 1050 px there).
const LONG_P = 'Bartholomew Featherstone-Quillfeather the Younger, Keeper of the Lamps of the Seventh Sluice-Gate';

async function openView(page: Page, width: number, height: number, scheme: 'light' | 'dark', door: string) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=gm&magic=1&view=long&give=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await page.getByRole('button', { name: door }).click();
  await expect(page.getByRole('button', { name: '‹ Players' })).toBeVisible();
}

const band = (page: Page) => page.getByRole('note');

/** A line of the band holds one line: its height is under two of its own lines. */
async function oneLine(line: Locator) {
  const { height, lineHeight } = await line.evaluate((el) => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).fontSize) * 1.6 }));
  expect(height).toBeLessThan(lineHeight * 1.5);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the view: the band and the way back on Player, Pack and Magic (${size.name}, ${scheme})`, async ({ page }) => {
      await openView(page, size.width, size.height, scheme, "View Wren of the Lantern Wardens’ sheet");
      await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
      await expect(band(page)).toHaveAttribute('aria-label', 'Sam’s view of Wren of the Lantern Wardens. What you do here is logged as yours.');
      await oneLine(band(page).locator('.view-band__name'));
      await oneLine(band(page).locator('.view-band__logged'));
      await page.screenshot({ path: `test-results/layout-screens/gm-view-player-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      for (const tab of ['Pack', 'Magic']) {
        await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: tab }).click();
        await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: tab })).toHaveAttribute('aria-current', 'page');
        await expect(band(page)).toBeVisible();
        await expect(page.getByRole('button', { name: '‹ Players' })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/gm-view-${tab.toLowerCase()}-${size.width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      }

      // The Scene: the band and the way back (its content is C15f's).
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await expect(band(page)).toBeVisible();
      await page.getByRole('button', { name: '‹ Players' }).click();
      await expect(page.getByRole('button', { name: 'Invite a player' })).toBeVisible();
    });

    test(`the band with long names: two lines at most, the name cut, read whole (${size.name}, ${scheme})`, async ({ page }) => {
      await openView(page, size.width, size.height, scheme, `Open ${LONG_C}’s pack`);
      await expect(band(page)).toHaveAttribute('aria-label', `${LONG_P}’s view of ${LONG_C}. What you do here is logged as yours.`);
      const name = band(page).locator('.view-band__name');
      await oneLine(name);
      await oneLine(band(page).locator('.view-band__logged'));
      // Cut with "…" on screen.
      expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === 'ellipsis')).toBe(true);
      // The logged line whole.
      expect(await band(page).locator('.view-band__logged').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      // "‹ Players" whole, not cut: the long title alone ends in "…" (M3d).
      const back = page.getByRole('button', { name: '‹ Players' });
      expect(await back.textContent()).toBe('‹ Players');
      expect(await back.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-long-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`the GM's own character: one line, "Your view of Ash" (${size.name}, ${scheme})`, async ({ page }) => {
      await openView(page, size.width, size.height, scheme, "View Ash’s sheet");
      await expect(band(page)).toHaveAttribute('aria-label', 'Your view of Ash');
      await expect(band(page).locator('.view-band__logged')).toHaveCount(0);
      await oneLine(band(page).locator('.view-band__name'));
      await page.screenshot({ path: `test-results/layout-screens/gm-view-own-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
}

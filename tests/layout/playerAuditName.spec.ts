// Batch D of plan dec-14-player-audit-fixes, row 3 (page 38 of december, frame 38-3, approved 2026-11-24): a long name
// no longer squeezes the way back. Ruled 2026-11-24 (2 and 8): the 176 px floor holds on every screen with the standard
// top row, and the cut name leaves the bar, so the name shows once.
// Purposes, each a plain sentence:
//   3a. On a tablet held upright, with the long name, the way back is 176 px or wider and shows its words.
//   3b. Upright, with the long name, the head's line shows the whole name, uncut, before "the" kindred and the title,
//       with "No notices" under it; the bar's cut name is gone, so the name shows once.
//   3c. Upright, with a short name, nothing moves: the bar keeps the name and the head's line gives the rest (frame P2).
//   3d. Held sideways nothing changes: the bar reads the name, the kindred and the title, the way back keeps its words,
//       and the head draws no name.
//   3e. Every other screen with the standard top row (the Pack tab, the Scene tab) keeps its way back at 176 px or
//       wider upright, at the narrowest tablet (600 px) too; the Pack tab's bar keeps its title, as no head carries it.
//   3f. A phone (not drawn) is as built: ≡ at the left, the cut name beside it, no name in the head, nothing sideways.
//   Each in light and dark, with the shared checks (no sideways scroll, 44 px targets, nothing under 14 px).
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';
import { P1_LONG_NAME } from '../../src/testing/layoutP1Character.ts';

const UPRIGHT = { width: 820, height: 1180 };
const NARROW_TABLET = { width: 600, height: 960 };
const SIDEWAYS = { width: 1180, height: 820 };
const PHONE = { width: 375, height: 812 };
const FLOOR = 176;

async function openPlayer(page: Page, p1: '1' | 'messy', size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player-head')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const back = (page: Page) => page.locator('.top-row--standard .top-row__back').first();
const barTitle = (page: Page) => page.locator('.top-row__title').first();
const headName = (page: Page) => page.locator('.player-head h1');

/** Whether an element is drawn for the eye: visible, and more than the 1 px a screen readers' copy keeps. */
const drawn = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return getComputedStyle(el).visibility === 'visible' && r.width > 1 && r.height > 1;
  });

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`a long name and the way back (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test(`upright, long name: the way back keeps 176 px and its words; the head carries the whole name, once (${scheme})`, async ({ page }) => {
      await openPlayer(page, 'messy', UPRIGHT);
      // 3a.
      const way = (await back(page).boundingBox())!;
      expect(way.width).toBeGreaterThanOrEqual(FLOOR);
      await expect(back(page)).toContainText('The Storm Lantern');
      // 3b. The name leads the head's line, whole: drawn, never cut, wrapping inside the head.
      await expect(headName(page)).toHaveText(P1_LONG_NAME);
      await expect(page.locator('.top-row__title--cut')).toHaveCount(1);
      expect(await drawn(page, '.player-head h1')).toBe(true);
      const name = headName(page);
      expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 || getComputedStyle(el).display === 'inline')).toBe(true);
      const words = (await page.locator('.player-head__words').boundingBox())!;
      const head = (await page.locator('.player-head').boundingBox())!;
      expect(words.x + words.width).toBeLessThanOrEqual(head.x + head.width + 0.5);
      await expect(page.locator('.player-head__words')).toHaveText(/^Brannoch Fenward of the Seven Drowned Cairns, called the Unbowed the [^,]+(, .+)?$/);
      // The bar's cut name is gone, so the name is drawn once.
      expect(await drawn(page, '.top-row__title')).toBe(false);
      // "No notices" keeps its place under the line.
      const box = (await page.locator('.player-head .notices-box').boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(words.y + words.height - 0.5);
      // One heading carries the name for screen readers.
      await expect(page.getByRole('heading', { level: 1, name: P1_LONG_NAME })).toHaveCount(1);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test(`upright, short name: the bar keeps the name and the head's line gives the rest, as built (${scheme})`, async ({ page }) => {
      await openPlayer(page, '1', UPRIGHT);
      // 3c.
      await expect(barTitle(page)).toHaveText('Brannoch Fenward');
      expect(await drawn(page, '.top-row__title')).toBe(true);
      await expect(page.locator('.top-row__title--cut')).toHaveCount(0);
      expect(await drawn(page, '.player-head h1')).toBe(false);
      await expect(page.locator('.player-head__line')).toHaveText(/^the [^,]+(, .+)?$/);
      expect((await back(page).boundingBox())!.width).toBeGreaterThanOrEqual(FLOOR);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test(`sideways, long name: nothing changes (${scheme})`, async ({ page }) => {
      await openPlayer(page, 'messy', SIDEWAYS);
      // 3d.
      await expect(barTitle(page)).toHaveText(new RegExp(`^${P1_LONG_NAME} the `));
      expect(await drawn(page, '.top-row__title')).toBe(true);
      expect((await back(page).boundingBox())!.width).toBeGreaterThanOrEqual(FLOOR);
      await expect(back(page)).toContainText('The Storm Lantern');
      await expect(page.locator('.player-head__words')).toHaveCount(0);
      expect(await drawn(page, '.player-head h1')).toBe(false);
      expect(await layoutProblems(page)).toEqual([]);
    });

    for (const size of [UPRIGHT, NARROW_TABLET]) {
      test(`the other screens with the standard top row keep the floor at ${size.width} px (${scheme})`, async ({ page }) => {
        await openPlayer(page, 'messy', size);
        // 3e. The Player tab at this width too.
        expect((await back(page).boundingBox())!.width).toBeGreaterThanOrEqual(FLOOR);
        const nav = page.getByRole('navigation', { name: 'Main' });
        // The Pack tab: "<name>’s pack", cut, stays in the bar (no head carries it), and the way back keeps its words.
        await nav.getByRole('button', { name: /Pack/ }).click();
        await expect(barTitle(page)).toContainText('pack');
        expect(await drawn(page, '.top-row__title')).toBe(true);
        expect((await back(page).boundingBox())!.width).toBeGreaterThanOrEqual(FLOOR);
        await expect(back(page)).toContainText('The Storm Lantern');
        expect(await layoutProblems(page)).toEqual([]);
        // The Scene tab: no title, the way back as wide as ever.
        await nav.getByRole('button', { name: /Scene/ }).click();
        await expect(page.locator('.player-head')).toHaveCount(0);
        expect((await back(page).boundingBox())!.width).toBeGreaterThanOrEqual(FLOOR);
        expect(await layoutProblems(page)).toEqual([]);
      });
    }

    test(`phone (not drawn): as built, ≡ and the cut name in the bar, no name in the head (${scheme})`, async ({ page }) => {
      await openPlayer(page, 'messy', PHONE);
      // 3f.
      await expect(page.locator('.top-row--standard .top-row__menu[aria-label="Menu"]')).toBeVisible();
      await expect(page.locator('.top-row--standard .top-row__lead--worded')).toHaveCount(0);
      await expect(barTitle(page)).toHaveText(P1_LONG_NAME);
      expect(await drawn(page, '.top-row__title')).toBe(true);
      await expect(page.locator('.player-head__words')).toHaveCount(0);
      expect(await drawn(page, '.player-head h1')).toBe(false);
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}

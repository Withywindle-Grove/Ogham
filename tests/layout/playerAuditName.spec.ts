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
//   3g. Upright, with the long name, while the screen opens (the head not shown yet), the bar keeps its cut name, so the
//       name always shows somewhere (the review on #154, finding 1).
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

/**
 * Whether the way back keeps its words: "‹ The Storm Lantern" fits inside the link's box (frame 38-3 draws it cut after
 * them, "‹ The Storm Lantern …", so the whole name need not fit). Squeezed to "‹ …", those words overrun the box.
 */
const backFits = (page: Page) =>
  back(page).evaluate((el) => {
    const range = document.createRange();
    range.setStart(el, 0);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf('Lantern');
      if (at >= 0) {
        range.setEnd(node, at + 'Lantern'.length);
        return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;
      }
    }
    return false;
  });

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
      expect(await backFits(page)).toBe(true);
      // 3b. The name leads the head's line, whole: drawn, never cut, wrapping inside the head.
      await expect(headName(page)).toHaveText(P1_LONG_NAME);
      await expect(page.locator('.top-row__title--cut')).toHaveCount(1);
      expect(await drawn(page, '.player-head h1')).toBe(true);
      const name = headName(page);
      const words = (await page.locator('.player-head__words').boundingBox())!;
      const head = (await page.locator('.player-head').boundingBox())!;
      expect(words.x + words.width).toBeLessThanOrEqual(head.x + head.width + 0.5);
      // The name is an inline box (its scroll and client widths read 0), so "never cut" is: it wraps, and every line
      // of it ends inside the head's words.
      expect(await name.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('normal');
      const nameRight = await name.evaluate((el) => Math.max(...[...el.getClientRects()].map((r) => r.right)));
      expect(nameRight).toBeLessThanOrEqual(words.x + words.width + 0.5);
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

    test(`upright, long name, while the screen opens: the bar keeps its cut name, as the head is not shown yet (${scheme})`, async ({ page }) => {
      // 3g. While the head is hidden (the screen opening; a first open that failed is the same), the name shows in
      //     the bar, so it is never nowhere. `slow=1` holds every answer 600 ms, so the opening state can be read.
      await page.setViewportSize(UPRIGHT);
      await page.goto('/layout.html?as=player&p1=messy&slow=1');
      await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
      await expect(page.locator('.player__opened[hidden] .player-head__name')).toHaveCount(1);
      await expect(page.locator('.top-row__title--cut')).toHaveCount(1);
      expect(await page.locator('.player__opened').getAttribute('hidden')).not.toBeNull();
      expect(await drawn(page, '.top-row__title')).toBe(true);
      // Once open, the name moves to the head and leaves the bar (3b).
      await expect(page.locator('.player__opened')).not.toHaveAttribute('hidden');
      expect(await drawn(page, '.top-row__title')).toBe(false);
      expect(await drawn(page, '.player-head h1')).toBe(true);
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
      expect(await backFits(page)).toBe(true);
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
        expect(await backFits(page)).toBe(true);
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

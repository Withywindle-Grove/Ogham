// Row P3 of plan test-feedback-2026-11-19 (page 28, frames M4a to M4i, approved 2026-11-20; pg28-1 to pg28-8): the
// right column's list with pinned abilities and traits, on the shared P1-like character with an ability without uses
// and the trait with uses pinned (`layout.html?as=player&p1=pins`), on a tablet and at 375 px, light and dark.
// Purposes, each a plain sentence:
//   1. The list is headed "Abilities and traits"; the pinned row (Oath of light) comes first, then the block (Steady
//      flame), in the pins' order; the row and the block share one left edge and one width (pg28-6), 8 px apart.
//   2. The row's tap and the block's Use are 44 px targets; the heading's ⓘ is too, and opens "Hold to move".
//   3. The foot's Abilities row no longer names the pinned ability (pg28-3).
//   4. A pinned one's pop-up has Move down (it is first), and a tap moves it at once, the pop-up staying open.
//   5. Nothing spills sideways, and the page's own layout checks find nothing.
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

const list = (page: Page) => page.getByRole('region', { name: 'Abilities and traits' });

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=pins');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(list(page).locator('.pinned-box--block')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      test(`1-3. the pinned row and block, in the pins' order, one edge and width (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        await expect(list(page).getByRole('heading', { name: 'Abilities and traits' })).toBeVisible();
        const boxes = list(page).locator('.pinned-box');
        await expect(boxes).toHaveCount(2);
        await expect(boxes.nth(0)).toHaveText(/Oath of light/);
        await expect(boxes.nth(0)).not.toHaveClass(/pinned-box--block/);
        await expect(boxes.nth(1)).toHaveClass(/pinned-box--block/);
        const [row, block] = [await boxes.nth(0).boundingBox(), await boxes.nth(1).boundingBox()];
        expect(Math.abs((row?.x ?? 0) - (block?.x ?? 1))).toBeLessThanOrEqual(1);
        expect(Math.abs((row?.width ?? 0) - (block?.width ?? 1))).toBeLessThanOrEqual(1);
        expect(Math.round((block?.y ?? 0) - ((row?.y ?? 0) + (row?.height ?? 0)))).toBe(8);
        // 44 px targets: the row's tap, the block's Use, the heading's ⓘ.
        for (const target of [boxes.nth(0).getByRole('button').first(), boxes.nth(1).getByRole('button', { name: 'Use Steady flame' }), list(page).getByRole('button', { name: 'About moving pinned ones' })]) {
          const box = await target.boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        }
        // The foot's Abilities row leaves out the pinned ability (pg28-3).
        const abilities = page.locator('.player .list-row').filter({ has: page.locator('.list-row__title', { hasText: /^Abilities$/ }) });
        await expect(abilities.first()).toBeVisible();
        await expect(abilities.first()).not.toHaveText(/Oath of light/);
        const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(spill).toBeLessThanOrEqual(0);
        expect(await layoutProblems(page)).toEqual([]);
      });

      test(`2, 4. hold to move's ⓘ, and Move down in a pinned one's pop-up (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        await list(page).getByRole('button', { name: 'About moving pinned ones' }).click();
        const about = page.getByRole('dialog', { name: 'Hold to move' });
        await expect(about).toBeVisible();
        await about.getByRole('button', { name: 'Got it' }).click();
        await expect(about).toHaveCount(0);
        // The block's own pop-up: it is last, so Move up and no Move down; a tap moves it first, the pop-up still open.
        await list(page).locator('.pinned-box--block').getByRole('button', { name: /^Steady flame/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Steady flame' });
        await expect(sheet.getByRole('button', { name: 'Move down' })).toHaveCount(0);
        const up = sheet.getByRole('button', { name: 'Move up' });
        expect((await up.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        await up.click();
        await expect(sheet.getByRole('button', { name: 'Move down' })).toBeVisible();
        await expect(list(page).locator('.pinned-box').first()).toHaveClass(/pinned-box--block/);
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

// dec-13 C10 (docs/plans/dec-13-the-player-screen.md; ps-2, mv-1, mv-2; frames P1 and P2 of december/14, ps-9,
// approved 2026-11-14): movement and load on the shared P1-like character (`layout.html?as=player&p1=1`,
// src/testing/layoutP1Character.ts, its load tracked in coins by the fixture's tiers). Purposes:
//   On a tablet, Movement is third in the right column, after Scores and Saves.
//   The speed is said once: its figure on the speed card, and the load card's top line is the tier alone ("Light"),
//   with no "speed" in it; under it the load's bar and "260 of 1,200 coins".
//   The speed card and the tier's tap are 44 px targets; the section has no text under 14 px, no sideways scroll at
//   375 px, and no serious accessibility problem, in light and dark.
//   Messy data (`?p1=heavy`, 999 bundles of reeds): over the most, the load card names it with the warning sign and its
//   figures ("1,259 of 1,200 coins"), and the section still fits a 375 px phone.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openPlayer(page: Page, flag = '1') {
  await page.goto(`/layout.html?as=player&p1=${flag}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Movement' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const scheme of SCHEMES) {
  test.describe(`movement and load (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`the speed once, the tier alone, the bar and its figures (${size.name}, ${size.width} px, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const movement = page.getByRole('region', { name: 'Movement' });

        // The speed card: the figure, said here and only here.
        const speed = movement.locator('.sheet__card--tap');
        // With its unit from the load's words, and one line under it (Francis's fix 5 of 19 Nov 2026, frame P1).
        // The sample says it as P1 does (the review's nit of 19 Nov 2026): "120 paces", named "Speed".
        await expect(speed.locator('.sheet__card-figure')).toHaveText('120 paces');
        await expect(speed.locator('.auth__meta')).toHaveText('Speed, 40 paces in a fight');
        // The load card: the tier alone, the bar, the figures; no speed.
        const tier = movement.locator('.pack__tier');
        await expect(tier).toHaveText('Light');
        await expect(movement.locator('.pack__load')).not.toContainText(/speed/i);
        await expect(movement.locator('.pack__bar')).toBeVisible();
        await expect(movement.getByText('260 of 1,200 coins’ weight')).toBeVisible();

        // 44 px targets (t44-1).
        for (const target of [speed, tier]) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        // A short tier's name keeps a 44 px wide target too (the review's nit of 19 Nov 2026).
        expect((await tier.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await noSidewaysScroll(page)).toBe(true);
        expect(await accessibilityProblems(page, 'section[aria-label="Movement"]')).toEqual([]);
      });
    }

    test(`tablet: Movement is third on the right, after Scores and Saves (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[0].width, height: SIZES[0].height });
      await openPlayer(page);
      const order = await page.locator('.player__right section[aria-label]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(order.slice(0, 3)).toEqual(['Scores', 'Saves', 'Movement']);
    });

    test(`999 bundles of reeds: over the most, with the warning sign, still fits 375 px (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await openPlayer(page, 'heavy');
      const movement = page.getByRole('region', { name: 'Movement' });
      const tier = movement.locator('.pack__tier');
      await expect(tier).toHaveText("Can't move");
      await expect(tier.locator('svg, .warning-sign').first()).toBeVisible();
      await expect(movement.getByText('1,259 of 1,200 coins')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await noSidewaysScroll(page)).toBe(true);
    });
  });
}

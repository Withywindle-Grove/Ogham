// pss-12 (docs/specs/player-sitting.md, piece 6; ticket #167): armour mode's load card on the Player screen, beside
// the speed tile (`layout.html?as=player&p1=armour`: the P1 character in a light coat, carrying a pouch of pearls, by
// invented armour rules in src/testing/layoutP1Character.ts). Purposes:
//   The speed is said once: its figure on the speed card ("60 paces"), and the load card's top line has no "Move N";
//   it says "Carrying treasure", once, with "Treasure 120 of 1,600 coins’ weight" under it.
//   The top line stays a 44 px tap that opens the burden's levels in a pop-up.
//   No text under 14 px, no sideways scroll, no serious accessibility problem, at 375 px and on a tablet, light and dark.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=armour');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Movement' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const scheme of SCHEMES) {
  test.describe(`armour mode's load card (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`no "Move N" beside the speed tile; the treasure words once (${size.name}, ${size.width} px, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const movement = page.getByRole('region', { name: 'Movement' });

        await expect(movement.locator('.sheet__card--tap .sheet__card-figure')).toHaveText('60 paces');
        const tier = movement.locator('.pack__tier');
        await expect(tier).toHaveText('Carrying treasure');
        await expect(movement.locator('.pack__load')).not.toContainText('Move');
        await expect(movement.getByText('Carrying treasure')).toHaveCount(1);
        await expect(movement.getByText('Treasure 120 of 1,600 coins’ weight')).toBeVisible();

        const box = await tier.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await noSidewaysScroll(page)).toBe(true);
        expect(await accessibilityProblems(page, 'section[aria-label="Movement"]')).toEqual([]);
      });
    }

    test(`the top line opens the burden's levels (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await openPlayer(page);
      await page.getByRole('region', { name: 'Movement' }).getByRole('button', { name: 'Carrying treasure' }).click();
      const dialog = page.getByRole('dialog', { name: 'Burden' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Movement by armour')).toBeVisible();
    });
  });
}

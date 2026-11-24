// Batch A of plan dec-14-player-audit-fixes (page 38 of december, approved 2026-11-24): the Player tab's tight gaps.
// Row 2 (frames 38-2), on the shared P1-like characters (`layout.html?as=player&p1=…`; src/testing/layoutP1Character.ts).
// Purposes, each a plain sentence:
//   2a. With a long weapon name the weapon in hand's buttons, on their own line, sit 8 px or more under the words.
//   2b. With a short weapon name (one button, beside the name) nothing moves: the button stays on the name's line.
//   2c. The ⓘ beside "Abilities and traits" sits 8 px or more above the first pinned box.
//   2d. With nothing pinned there is no ⓘ, and the heading keeps its 4 px over the list, as built (row 4 may change
//       this state: "Use" off the rule).
//   2e. At Larger text both gaps still hold.
// 2a to 2d on a tablet and at 375 px, light and dark; the page never scrolls sideways.
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openPlayer(page: Page, p1: string) {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Weapon in hand' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const noSpill = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      test(`2a. a long weapon's buttons sit 8 px under its words (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'weapon');
        const region = page.getByRole('region', { name: 'Weapon in hand' });
        const words = (await region.locator('.weapon-in-hand .pack__row-main').boundingBox())!;
        const actions = (await region.locator('.weapon-in-hand__actions').boundingBox())!;
        expect(actions.y - (words.y + words.height)).toBeGreaterThanOrEqual(8 - 0.5);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`2b. a short weapon's one button stays beside its name (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, '1');
        const region = page.getByRole('region', { name: 'Weapon in hand' });
        const name = (await region.getByRole('button', { name: /^Reed spear/ }).boundingBox())!;
        const attack = (await region.getByRole('button', { name: 'Attack with Reed spear' }).boundingBox())!;
        expect(attack.y).toBeLessThan(name.y + name.height);
        expect(attack.x).toBeGreaterThan(name.x);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`2c. the ⓘ sits 8 px above the first pinned box (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'pins');
        const list = page.getByRole('region', { name: 'Abilities and traits' });
        await expect(list.locator('.pinned-box--block')).toBeVisible();
        const info = (await list.getByRole('button', { name: 'About moving pinned ones' }).boundingBox())!;
        const first = (await list.locator('.pinned-box').first().boundingBox())!;
        expect(first.y - (info.y + info.height)).toBeGreaterThanOrEqual(8 - 0.5);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`2d. with nothing pinned, no ⓘ and the heading as built (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, '1');
        const list = page.getByRole('region', { name: 'Abilities and traits' });
        await expect(list).toBeVisible();
        await expect(list.getByRole('button', { name: 'About moving pinned ones' })).toHaveCount(0);
        const heading = (await list.getByRole('heading', { name: 'Abilities and traits' }).boundingBox())!;
        const next = (await list.locator('.row-list').first().boundingBox())!;
        expect(Math.round(next.y - (heading.y + heading.height))).toBe(4);
      });
    });
  }
}

test(`2e. at Larger text both gaps hold: the weapon's buttons and the ⓘ 8 px clear (tablet, light)`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.setViewportSize({ width: 1180, height: 820 });
  await openPlayer(page, 'weapon');
  const region = page.getByRole('region', { name: 'Weapon in hand' });
  const words = (await region.locator('.weapon-in-hand .pack__row-main').boundingBox())!;
  const actions = (await region.locator('.weapon-in-hand__actions').boundingBox())!;
  expect(actions.y - (words.y + words.height)).toBeGreaterThanOrEqual(8 - 0.5);
  await openPlayer(page, 'pins');
  const list = page.getByRole('region', { name: 'Abilities and traits' });
  const info = (await list.getByRole('button', { name: 'About moving pinned ones' }).boundingBox())!;
  const first = (await list.locator('.pinned-box').first().boundingBox())!;
  expect(first.y - (info.y + info.height)).toBeGreaterThanOrEqual(8 - 0.5);
});

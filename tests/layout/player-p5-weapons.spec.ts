// Ticket #166 of spec player-sitting (piece 5; pib-1, pib-2; frame P5b of december/14, approved 2026-11-27): a block for
// every weapon in hand, on the shared P1-like character with several ready weapons (`layout.html?as=player&p1=arms`:
// the spear, the knife and a long-named axe with its Grip in hand; bog-ox horns worn and pinned; a heron bow pinned with
// its quiver), at 375 px and on a tablet, light and dark. Purposes, each a plain sentence:
//   1. Three weapons in hand are three blocks, with no cap, in the "Weapon in hand" region above At hand.
//   2. The horns, worn ready, are an At hand row with Attack and Stance, never a block and never Wield (pib-1).
//   3. The bow, pinned and not in hand, is an At hand row with Wield and Quiver (its mode button kept).
//   4. Every button there is a 44 px target; everything stays inside its block, the page never scrolls sideways, and
//      the page's own layout checks find nothing.
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=arms');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Weapon in hand' }).locator('.weapon-in-hand')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      test(`1-4. a block per weapon in hand, the worn horns and the pinned bow as rows (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const region = page.getByRole('region', { name: 'Weapon in hand' });
        const atHand = page.getByRole('region', { name: 'At hand' });

        // 1. Three blocks, above At hand; none of the three is a row in At hand.
        for (const name of [/^Reed spear/, /^Eel knife/, /^Hand axe of the Seven Cairns/]) await expect(region.getByRole('button', { name })).toHaveCount(1);
        await expect(atHand.getByRole('button', { name: /^Reed spear|^Eel knife|^Hand axe/ })).toHaveCount(0);
        const [mine, below] = [await region.boundingBox(), await atHand.boundingBox()];
        expect(below!.y).toBeGreaterThanOrEqual(mine!.y + mine!.height - 0.5);

        // 2. The horns: a row with Attack and Stance, no Wield, no block.
        await expect(region.getByRole('button', { name: /^Bog-ox horns/ })).toHaveCount(0);
        const horns = atHand.getByRole('button', { name: 'Attack with Bog-ox horns' });
        await expect(horns).toBeVisible();
        await expect(atHand.getByRole('button', { name: /^Stance/ })).toBeVisible();
        await expect(atHand.getByRole('button', { name: 'Wield Bog-ox horns' })).toHaveCount(0);

        // 3. The bow: a row with Wield and Quiver.
        const wield = atHand.getByRole('button', { name: 'Wield Heron bow' });
        const quiver = atHand.getByRole('button', { name: /^Quiver/ });
        await expect(wield).toBeVisible();
        await expect(quiver).toBeVisible();

        // 4. 44 px targets, everything inside its block, no sideways scroll, no layout problems.
        for (const target of [horns, atHand.getByRole('button', { name: /^Stance/ }), wield, quiver, ...(await region.getByRole('button').all())]) {
          const box = (await target.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
        for (const block of await region.locator('.weapon-in-hand').all()) {
          const outer = (await block.boundingBox())!;
          for (const inner of await block.locator('button, .weapon-in-hand__roll').all()) {
            const box = (await inner.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(outer.x - 0.5);
            expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

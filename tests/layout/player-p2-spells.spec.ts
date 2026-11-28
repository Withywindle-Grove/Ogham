// Ticket #168 of spec player-sitting (piece 2; pss-5, psb-5, psb-6, pg28-2; frame M4g of page 28, approved 2026-11-20):
// the pinned spells' blocks At hand, on the shared P1-like character as a caster (`layout.html?as=player&p1=spells`:
// Marsh light ready, a long-named spell with none left, Hush with no roll, Reed whisper in the book but not ready, and
// a pin whose spell has left the book), at 375 px and on a tablet, light and dark, and at Larger text on a phone.
// Purposes, each a plain sentence:
//   1. The four live pins are four blocks, first in At hand: above the pinned knife's row, under the weapon in hand.
//   2. The long name wraps beside Cast: it takes more than one line and stays left of the button.
//   3. Hush, with no roll and no range, has no roll line; Marsh light has its roll and its range.
//   4. Every Cast is a 44 px target; everything stays inside its block, the page never scrolls sideways, and the page's
//      own layout checks find nothing.
// Each run saves a picture of At hand (`spells-<size>-<scheme>.png`, the built screen beside frame M4g).
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;
const LONG = 'The Lady of the Lanterns’ light on drowned stone';

async function openPlayer(page: Page, larger = false) {
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto('/layout.html?as=player&p1=spells');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  const atHand = page.getByRole('region', { name: 'At hand' });
  await expect(atHand.locator('.weapon-in-hand--spell')).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
  return atHand;
}

async function checkBlocks(page: Page, atHand: ReturnType<Page['getByRole']>) {
  const blocks = atHand.locator('.weapon-in-hand--spell');
  // 1. First in At hand, in the pins' order, above the knife's row and under the weapon in hand.
  await expect(blocks.locator('.pack__name')).toHaveText([/^Marsh light/, new RegExp(`^${LONG}`), /^Hush/, /^Reed whisper/]);
  const last = (await blocks.nth(3).boundingBox())!;
  const knife = (await atHand.getByRole('button', { name: /^Eel knife/ }).boundingBox())!;
  expect(knife.y).toBeGreaterThanOrEqual(last.y + last.height - 0.5);
  const weapon = (await page.getByRole('region', { name: 'Weapon in hand' }).boundingBox())!;
  expect((await blocks.first().boundingBox())!.y).toBeGreaterThanOrEqual(weapon.y + weapon.height - 0.5);

  // 2. The long name wraps beside Cast.
  const longName = blocks.nth(1).locator('.pack__name');
  const nameBox = (await longName.boundingBox())!;
  const lineHeight = await longName.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(nameBox.height).toBeGreaterThan(lineHeight * 1.5);
  const longCast = (await blocks.nth(1).getByRole('button', { name: `Cast ${LONG}` }).boundingBox())!;
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(longCast.x + 0.5);

  // 3. Hush has no roll line; Marsh light has its roll and its range.
  await expect(blocks.nth(2).locator('.weapon-in-hand__roll')).toHaveCount(0);
  await expect(blocks.first().locator('.weapon-in-hand__roll')).toHaveText(['d6 +2 turns', '30 paces range']);

  // 4. 44 px targets, everything inside its block, no sideways scroll, no layout problems.
  for (const block of await blocks.all()) {
    const outer = (await block.boundingBox())!;
    for (const inner of await block.locator('button, .weapon-in-hand__roll').all()) {
      const box = (await inner.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(outer.x - 0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
    }
    const cast = (await block.getByRole('button', { name: /^Cast / }).boundingBox())!;
    expect(cast.height).toBeGreaterThanOrEqual(44);
    expect(cast.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(await layoutProblems(page)).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      test(`1-4. the pinned spells first in At hand (${size.name}, ${scheme})`, async ({ page }, info) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        const atHand = await openPlayer(page);
        await checkBlocks(page, atHand);
        await atHand.screenshot({ path: info.outputPath(`spells-${size.name}-${scheme}.png`) });
      });
    });
  }

  test.describe(`phone, Larger text, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`1-4. at Larger text on a phone (${scheme})`, async ({ page }, info) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const atHand = await openPlayer(page, true);
      await checkBlocks(page, atHand);
      await atHand.screenshot({ path: info.outputPath(`spells-phone-larger-${scheme}.png`) });
    });
  });
}

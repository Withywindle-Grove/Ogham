// A lit light with charges as one row (Player sitting piece 9; frame 47-3, approved 2026-11-28: C2, D1), on the shared
// P1-like character (`layout.html?as=player&p1=lituse|lituselong`, src/testing/layoutP1Character.ts). Purposes, at a
// phone (375) and a tablet held sideways (1180), light and dark:
//   The lantern shows once in At hand: the light's row, with Use at its right; no second item row.
//   The ring keeps its 72 by 76 target, Use is at least 44 by 44, each at least 8 px from the light's name, and Use's
//   right edge lines up with Keep lit's switch under it (At hand's right edge).
//   The line ends with the charges in words.
//   A long name with 999 turns, refills and charges wraps between the ring and Use; nothing overlaps.
//   At Larger text the same row holds. No sideways scroll anywhere.
import { expect, test, type Locator, type Page } from '@playwright/test';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const;

const LONG = 'Hooded lantern of the drowned bell';

async function openPlayer(page: Page, head: string, larger = false) {
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=player&p1=${head}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  const atHand = page.getByRole('region', { name: 'At hand' });
  await expect(atHand.locator('.light-block--at-hand')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { atHand, light: atHand.locator('.light-block--at-hand') };
}

const boxOf = async (target: Locator) => (await target.boundingBox())!;

async function oneRowWithUse(page: Page, atHand: Locator, light: Locator, name: string) {
  // Once: the light's name is the only one, and the only Use a charge is on the light's row.
  await expect(atHand.getByText(name, { exact: true })).toHaveCount(1);
  await expect(atHand.getByRole('button', { name: `Use a charge of ${name}` })).toHaveCount(1);
  const use = await boxOf(light.getByRole('button', { name: `Use a charge of ${name}` }));
  const ring = await boxOf(light.getByRole('button', { name: `Put out ${name}` }));
  const title = await boxOf(light.getByRole('button', { name, exact: true }));
  const words = await boxOf(light.locator('.light-block__words'));
  const toggle = await boxOf(light.getByRole('switch', { name: 'Keep lit' }));
  expect(ring.width).toBeGreaterThanOrEqual(71.5);
  expect(ring.height).toBeGreaterThanOrEqual(75.5);
  expect(use.width).toBeGreaterThanOrEqual(43.5);
  expect(use.height).toBeGreaterThanOrEqual(43.5);
  // The name and its line sit between the ring and Use, 8 px from each.
  expect(title.x - (ring.x + ring.width)).toBeGreaterThanOrEqual(7.5);
  expect(use.x - (title.x + title.width)).toBeGreaterThanOrEqual(7.5);
  expect(use.x - (words.x + words.width)).toBeGreaterThanOrEqual(7.5);
  // Use at At hand's right edge, over Keep lit's switch.
  expect(Math.abs(use.x + use.width - (toggle.x + toggle.width))).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.name} (${size.width} px), ${scheme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      test('a lit lantern with charges: one row, Use at its right, the charges at the end of its line', async ({ page }, info) => {
        const { atHand, light } = await openPlayer(page, 'lituse');
        await expect(light.locator('.light-block__words')).toHaveText('Lit, 4 turns left. 3 refills left. 2 charges left');
        await oneRowWithUse(page, atHand, light, 'Storm lantern');
        await atHand.screenshot({ path: info.outputPath(`light-use-${size.width}-${scheme}.png`) });
      });

      test('a long name with 999 turns, refills and charges wraps between the ring and Use', async ({ page }, info) => {
        const { atHand, light } = await openPlayer(page, 'lituselong');
        await expect(light.locator('.light-block__words')).toHaveText('Lit, 999 turns left. 999 refills left. 999 charges left');
        await oneRowWithUse(page, atHand, light, LONG);
        await atHand.screenshot({ path: info.outputPath(`light-use-long-${size.width}-${scheme}.png`) });
      });

      test('at Larger text the row holds', async ({ page }) => {
        const { atHand, light } = await openPlayer(page, 'lituselong', true);
        await oneRowWithUse(page, atHand, light, LONG);
      });
    });
  }
}

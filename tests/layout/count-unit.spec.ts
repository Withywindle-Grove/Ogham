// A count names its unit (G-233, piece C of docs/specs/dec5-gaps.md; page 49 frame 49-1, approved 2026-11-28 with
// findings 2 and 3), on the shared P1-like character (`layout.html?as=player&p1=units|unitsmessy`,
// src/testing/layoutP1Character.ts). Purposes, at a phone (375) and a tablet held sideways (1180), light and dark:
//   Each row's line says its count in the item's unit ("2 of 3 portions"), a wand with no unit keeps "charges", and a
//   hidden count says "Portions: ?".
//   The button stays "Use"; its spoken name says the unit ("Use a portion of Rum bottle"; "an" before a vowel).
//   The messy data: "999 of 999 doses" under a long name, a full count of 1 as "1 dose left" (finding 3), "2 of 4
//   ounces"; Use stays at least 44 by 44 and nothing scrolls sideways.
//   The At hand pop-up's fact is labelled with the unit ("Portions", "2 of 3 left").
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const;

const LONG = 'Black-water physic of the drowned abbey’s infirmary';

async function openPlayer(page: Page, head: string) {
  await page.goto(`/layout.html?as=player&p1=${head}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  const atHand = page.getByRole('region', { name: 'At hand' });
  await expect(atHand).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return atHand;
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.name} (${size.width} px), ${scheme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      test('each row says its count in its unit; Use keeps its word and says the unit aloud', async ({ page }, info) => {
        const atHand = await openPlayer(page, 'units');
        await expect(atHand.getByText('2 of 3 portions', { exact: true })).toBeVisible();
        await expect(atHand.getByText('3 of 5 charges', { exact: true })).toBeVisible();
        await expect(atHand.getByText('Portions: ?', { exact: true })).toBeVisible();
        const use = atHand.getByRole('button', { name: 'Use a portion of Rum bottle' });
        await expect(use).toHaveText(/^Use\b/);
        await expect(atHand.getByRole('button', { name: 'Use a charge of Glow wand' })).toHaveCount(1);
        await expect(atHand.getByRole('button', { name: 'Use a portion of Rum flask' })).toHaveCount(1);
        expect(await noSidewaysScroll(page)).toBe(false);
        await page.screenshot({ path: info.outputPath(`units-${size.width}-${scheme}.png`), fullPage: true });
      });

      test('the messy data: 999 of 999 doses, 1 dose left, 2 of 4 ounces, "Use an ounce"', async ({ page }, info) => {
        const atHand = await openPlayer(page, 'unitsmessy');
        await expect(atHand.getByText('999 of 999 doses', { exact: true })).toBeVisible();
        await expect(atHand.getByText('1 dose left', { exact: true })).toBeVisible();
        await expect(atHand.getByText('2 of 4 ounces', { exact: true })).toBeVisible();
        for (const name of ['Use an ounce of Lamp oil can', 'Use a dose of Salve tin', `Use a dose of ${LONG}`]) {
          const box = (await atHand.getByRole('button', { name }).boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(43.5);
          expect(box.height).toBeGreaterThanOrEqual(43.5);
        }
        expect(await noSidewaysScroll(page)).toBe(false);
        await page.screenshot({ path: info.outputPath(`units-messy-${size.width}-${scheme}.png`), fullPage: true });
      });

      test('the At hand pop-up labels the count with its unit', async ({ page }, info) => {
        const atHand = await openPlayer(page, 'units');
        await atHand.getByRole('button', { name: /^Rum bottle ,/ }).click();
        const popup = page.getByRole('dialog');
        await expect(popup.getByText('Portions', { exact: true })).toBeVisible();
        await expect(popup.getByText('Portions 2 of 3 left', { exact: true })).toBeVisible();
        expect(await noSidewaysScroll(page)).toBe(false);
        await page.screenshot({ path: info.outputPath(`units-popup-${size.width}-${scheme}.png`) });
      });
    });
  }
}

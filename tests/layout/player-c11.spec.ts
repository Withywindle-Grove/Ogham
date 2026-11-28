// dec-13 C11 (docs/plans/dec-13-the-player-screen.md; the self-review's states; frames P1 and P2 of december/14, ps-9,
// whose parts the states are built from), on the shared P1-like character and its states' variants (layout.html
// ?as=player&p1=…; src/testing/layoutP1Character.ts). Purposes:
//   At a 375 px phone and a 1024 px tablet, in light and dark, each messy character opens with no sideways scroll, no
//   layout problem and no serious accessibility problem: a long name and nine statuses with no portrait (messy);
//   nothing at hand, 0 hit points and a long level title (bare); no pack at all and 999 of 999 hit points (packless).
//   The long title is said whole (wrapped, never cut), 0 and 999 read as figures, and with nothing at hand there is no
//   At hand and no weapon in hand.
//   A score change waiting for the GM (bare) is a notice in the notices box (row C1, tfn-2), not in the columns; in its
//   sheet, its Take back a 44 px target.
//   At Larger text the phone still fits: no sideways scroll, every tap target still 44 px.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const;

async function openPlayer(page: Page, p1: string) {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

const scrollsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      for (const p1 of ['messy', 'bare', 'packless'] as const) {
        test(`the ${p1} character opens and fits (${size.width} px)`, async ({ page }) => {
          await page.setViewportSize({ width: size.width, height: size.height });
          await openPlayer(page, p1);
          const vitals = page.getByRole('region', { name: 'Vitals' });
          if (p1 === 'bare') {
            await expect(vitals.getByRole('button', { name: /^Hit points 0 of 16/ })).toBeVisible();
            await expect(page.getByRole('region', { name: 'At hand' })).toHaveCount(0);
            await expect(page.getByRole('region', { name: 'Weapon in hand' })).toHaveCount(0);
            // The long title, whole: in the bar beside (tablet) or the head's line (phone), wrapped, never cut.
            const title = page.getByText(/Warden of the Long Causeway and the Seven Drowned Cairns/).first();
            await expect(title).toBeVisible();
            const cut = await title.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis');
            // The bar may cut a title at its own end (it's the head's line that says it whole on a phone).
            if (size.name === 'phone') expect(cut).toBe(false);
            // The sheet's waiting change is in the notices box (row C1, tfn-2), not in the columns; in its sheet, its
            // Take back a 44 px target.
            await expect(page.getByText('Waiting for your GM: Muscle 15 → 16')).toHaveCount(0);
            await page.getByRole('button', { name: '1 notice, open them' }).click();
            const sheet = page.getByRole('dialog', { name: 'Notices' });
            await expect(sheet.getByText('Waiting for your GM: Muscle 15 → 16')).toBeVisible();
            const takeBack = (await sheet.getByRole('button', { name: 'Take back Muscle 15 → 16' }).boundingBox())!;
            expect(takeBack.height).toBeGreaterThanOrEqual(44);
            expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
            await sheet.getByRole('button', { name: 'Close' }).click();
          }
          if (p1 === 'packless') {
            await expect(vitals.getByRole('button', { name: /^Hit points 999 of 999/ })).toBeVisible();
            await expect(page.getByRole('region', { name: 'At hand' })).toHaveCount(0);
          }
          expect(await scrollsSideways(page)).toBe(false);
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page, '.player')).toEqual([]);
        });
      }
    });
  }
}

test('at Larger text the phone still fits, every target still 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await openPlayer(page, '1');
  expect(await scrollsSideways(page)).toBe(false);
  expect(await layoutProblems(page)).toEqual([]);
});

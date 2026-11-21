// Row C11 of the test feedback of 19 Nov 2026 (docs/plans/test-feedback-2026-11-19.md; tfr-3; page M1, frame M1g,
// approved 2026-11-19 with fixes), on the shared P1-like character (`layout.html?as=player&p1=…`,
// src/testing/layoutP1Character.ts; his Lore 9 changes nothing). Purposes, in plain words:
//   1. On the Player tab every score shows its modifier under it, "+0" for a score that changes nothing, every tile in
//      a row is one height, and nothing runs off a 375 px phone or a tablet, in light and dark.
//   2. A score with a change waiting for the GM (Muscle 15 → 16, `p1=bare`) keeps its "+2" under it, and its tile says
//      nothing of the change, at 375 px in light and dark.
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openPlayer(page: Page, p1: string) {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Scores' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** Each score tile's caption and box, read in the page. */
const tilesOf = (page: Page) =>
  page
    .getByRole('region', { name: 'Scores' })
    .locator('.score-row > .stat-tile')
    .evaluateAll((tiles) =>
      tiles.map((t) => {
        const box = t.getBoundingClientRect();
        return { caption: t.querySelector('.stat-tile__caption')?.textContent ?? null, top: Math.round(box.top), height: Math.round(box.height), right: box.right };
      }),
    );

for (const size of SIZES) {
  for (const scheme of SCHEMES) {
    test.describe(`"+0" under a score (${size.name}, ${scheme})`, () => {
      test.use({ colorScheme: scheme, viewport: { width: size.width, height: size.height } });

      test(`every score shows its modifier, "+0" for none (${size.name}, ${scheme})`, async ({ page }) => {
        await openPlayer(page, '1');
        const scores = page.getByRole('region', { name: 'Scores' });
        await scores.scrollIntoViewIfNeeded();
        await expect(scores.getByRole('button', { name: /^Lore 9/ }).locator('.stat-tile__caption')).toHaveText('+0');
        const tiles = await tilesOf(page);
        expect(tiles.length).toBe(6);
        for (const t of tiles) {
          expect(t.caption).toMatch(/^[+−]\d+$/);
          expect(t.right).toBeLessThanOrEqual(size.width);
        }
        // One height in each row of tiles.
        for (const t of tiles) expect(t.height).toBe(tiles.find((o) => o.top === t.top)!.height);
        expect(await layoutProblems(page)).toEqual([]);
        await scores.screenshot({ path: `test-results/c11/scores-${size.name}-${scheme}.png` });
      });
    });
  }
}

for (const scheme of SCHEMES) {
  test.describe(`a waiting change keeps the modifier (phone, ${scheme})`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 375, height: 812 } });

    test(`Muscle keeps "+2" while 16 waits, and its tile says nothing of it (${scheme})`, async ({ page }) => {
      await openPlayer(page, 'bare');
      // The change waits in the notices box (row C1).
      await expect(page.getByRole('button', { name: '1 notice, open them' })).toBeVisible();
      const muscle = page.getByRole('region', { name: 'Scores' }).getByRole('button', { name: /^Muscle 15/ });
      await muscle.scrollIntoViewIfNeeded();
      await expect(muscle.locator('.stat-tile__caption')).toHaveText('+2');
      await expect(page.getByRole('region', { name: 'Scores' }).getByText(/waiting/)).toHaveCount(0);
      expect(await layoutProblems(page)).toEqual([]);
      await page.getByRole('region', { name: 'Scores' }).screenshot({ path: `test-results/c11/scores-waiting-phone-${scheme}.png` });
    });
  });
}

// The follow-ups of-3 and of-5 (docs/design/rulings/p4-sitting-2026-11-20.md), in a real browser. Purposes, in plain
// words:
//   of-3. On the full sheet's own page a score with a change waiting for the GM shows its old figure and its modifier
//         and nothing more, as the Player tab's tile does (page M1, frame M1g); the waiting line at the top says it.
//         At a 375 px phone and a 768 px tablet, in light and dark, with no layout problem; the pictures are saved for
//         the pull request (test-results/layout-screens/of-3-…).
//   of-5. A trait's entry's When line reads "At level 3" (page M2), in the gallery's trait-entry specimen; its picture is
//         saved for the pull request (test-results/layout-screens/of-5-…).
import { expect } from '@playwright/test';
import { test } from '../fails.ts';
import { layoutProblems } from './checks.ts';
import { openFullSheetFromMenu } from './fullSheetMenu.ts';

// The full sheet has its own page below the landscape tablet's width (beside the Player tab there).
const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
] as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`of-3: the full sheet's waiting score shows its modifier only (${size.name}, ${size.width} px)`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        // The bare P1-like character has Muscle 15 → 16 waiting for the GM (src/testing/layoutP1Character.ts).
        await page.goto('/layout.html?as=player&p1=bare');
        await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
        await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
        await expect(page.getByText('Opening…')).toHaveCount(0);
        await openFullSheetFromMenu(page);
        const scores = page.getByRole('region', { name: 'Scores' });
        await expect(scores).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('.sheet__change').first()).toContainText('Muscle 15 → 16');
        const muscle = scores.getByRole('button', { name: /^Muscle 15/ });
        await expect(muscle).toContainText('+2');
        await expect(muscle).not.toContainText('waiting');
        await expect(scores).not.toContainText('16 waiting');
        expect(await layoutProblems(page)).toEqual([]);
        await page.screenshot({ path: `test-results/layout-screens/of-3-full-sheet-${size.width}-${scheme}.png` });
      });
    }

    test(`of-5: a trait's entry reads "At level 3" (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(`/gallery.html?theme=${scheme}`);
      const name = page.getByText('A trait whose note is in blocks', { exact: false }).first();
      await name.scrollIntoViewIfNeeded();
      const specimen = name.locator('xpath=..');
      await expect(specimen).toContainText('At level 3');
      await expect(specimen).not.toContainText('From level 3');
      await page.evaluate(() => document.fonts.ready);
      await specimen.screenshot({ path: `test-results/layout-screens/of-5-trait-entry-${scheme}.png` });
    });
  });
}

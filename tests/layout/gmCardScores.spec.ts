// The GM's approval card reads the scores as the player's review does (plan dec-15 row 9, caf-8; the review's words in
// frame 41-9-fix-review-none-rolled, approved 2026-11-24; the GM's card has no frame and is approved from these pictures),
// in a real browser on a phone (375 px) and a tablet held sideways (1180 px), in light and dark. Purpose, in plain words:
//   With no score rolled, Tam's card under "Waiting for approval" lists the six scores once with no "(rolled N)" and no
//   "Changed" mark, even on the two the kindred moved, and the line under them reads "All six: the average, not
//   rolled", the review's own words; nothing runs past the screen, nothing is under 14 px, and it passes the
//   accessibility check.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`The GM's approval card: the scores read as the review, none rolled (${size.name}, ${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/layout.html?as=gm&gmWaiting=1');
      await page.getByRole('button', { name: /The Fen Reckoning/ }).click();
      await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
      const card = page.locator('.gm__approval', { hasText: 'New character waiting: Tam' });
      await expect(card).toBeVisible();

      const scores = card.locator('.review__section', { has: page.locator('.review__title', { hasText: /^Scores/ }) });
      await expect(scores.locator('.review__line')).toHaveText(['Muscle 9, Nimbleness 10, Grit 8, Wit 9, Lore 9, Charm 9', 'All six: the average, not rolled']);
      await expect(scores).not.toContainText('rolled 9');
      await expect(scores.locator('.review__mark')).toHaveCount(0);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await card.evaluate((el) => Math.min(...[...el.querySelectorAll('*')].filter((e) => e.textContent?.trim() && !e.children.length).map((e) => parseFloat(getComputedStyle(e).fontSize))))).toBeGreaterThanOrEqual(14);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await card.screenshot({ path: `test-results/layout-screens/gm-card-scores-${size.width}-${scheme}.png` });
    });
  }
}

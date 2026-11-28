// Two of the figure pop-ups ruled on 2026-11-19 (plan test-feedback-2026-11-19 rows C12 and C4; mockup december/26,
// approved 2026-11-19 with fixes, frames M2c, M2d, M2e), on the shared P1-like character (layout.html?as=player&p1=1,
// Brannoch Fenward, a level 3 Lantern Warden; src/testing/layoutP1Character.ts), in a real browser on a phone (375 px)
// and a tablet held sideways (1180 px), in light and dark. Purposes, in plain words:
//   1. A skill's pop-up (Hark) starts with one line: "Succeeds on a 6+," in bold, then the d6's glyph and "roll 1d6"
//      in the regular weight, the glyph on the same line as the bold lead (a wrap comes after the die, M2d case 5)
//      and no taller than the line; nothing in the
//      pop-up runs past the screen and nothing is under 14 px (tfs-1).
//   2. The Level pop-up shows no number in bold under its title and none in its head: its first line is its sentence,
//      "Level 3 Lantern Warden." (tfb-3).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { layoutProblems } from './checks.ts';

async function openPlayer(page: Page, width: number, height: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a skill's pop-up starts with its one line, bold lead and the glyph with "roll 1d6" (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      const hark = page.getByRole('region', { name: 'Skills' }).locator('.list-row').filter({ hasText: /^Hark/ });
      await hark.scrollIntoViewIfNeeded();
      await hark.click();
      const dialog = page.getByRole('dialog', { name: 'Hark' });
      await expect(dialog).toBeVisible();
      const top = dialog.locator('.breakdown-sheet__figure');
      await expect(top).toHaveText('Succeeds on a 6+, roll 1d6');
      await expect(dialog.getByText(/Base chance for everyone|is better|counts:/)).toHaveCount(0);
      const parts = await top.evaluate((el) => {
        const strong = el.querySelector('strong')!;
        const lead = strong.getBoundingClientRect();
        const glyph = el.querySelector('.skill-roll__lead .die-glyph')!.getBoundingClientRect();
        const words = getComputedStyle(el.querySelector('.skill-roll')!);
        return {
          lead: Number(getComputedStyle(strong).fontWeight),
          rest: Number(words.fontWeight),
          // The glyph stays with the bold lead (the line wraps after the die, M2d case 5): its middle inside the
          // lead's line box.
          glyphMiddle: glyph.top + glyph.height / 2,
          leadTop: lead.top,
          leadBottom: lead.bottom,
          glyphHeight: glyph.height,
          fontSize: parseFloat(words.fontSize),
          lineHeight: parseFloat(words.lineHeight) || parseFloat(words.fontSize) * 1.5,
        };
      });
      expect(parts.lead).toBeGreaterThanOrEqual(600);
      expect(parts.rest).toBeLessThan(600);
      expect(parts.glyphMiddle).toBeGreaterThanOrEqual(parts.leadTop - 1);
      expect(parts.glyphMiddle).toBeLessThanOrEqual(parts.leadBottom + 1);
      expect(parts.glyphHeight).toBeLessThanOrEqual(parts.lineHeight + 1);
      expect(parts.fontSize).toBeGreaterThanOrEqual(14);
      expect(await layoutProblems(page)).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c12-skill-${size.width}-${scheme}.png` });
    });

    test(`the Level pop-up starts with its sentence and repeats no number (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      const level = page.locator('.list-row').filter({ hasText: /^Lantern Warden, level 3/ });
      await level.scrollIntoViewIfNeeded();
      await level.click();
      const dialog = page.getByRole('dialog', { name: 'Level' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.breakdown-sheet__figure')).toHaveCount(0);
      await expect(dialog.locator('.dialog__figure')).toHaveCount(0);
      await expect(dialog.locator('p.reading').first()).toHaveText('Level 3 Lantern Warden.');
      expect(await layoutProblems(page)).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c4-level-${size.width}-${scheme}.png` });
    });
  }
}

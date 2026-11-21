// The Pack in the GM's view as the player (page 32, M3g, M3g2, approved 2026-11-21; row C15e of
// plans/test-feedback-2026-11-19.md), in a real browser on a phone (375 px) and a tablet held sideways (1180 px), in
// light and dark. Purposes, in plain words:
//   1. On Wren's Pack in the view, the wand with a hidden count reads as the player's row: nothing of the count.
//   2. The ring with a long hidden curse opens the player's sheet plus the GM's line, at body size (16 px), with the
//      closed eye, and "Reveal…" above Give to…, at least 44 px high. No sideways scrolling, no text under 14 px, no
//      small targets, no serious accessibility problem.
//   3. "Reveal…" opens the GM's own sheet for the ring over it (⚑ 40), with its "Hidden from players" group, and that
//      sheet lays out as cleanly.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openPack(page: Page, width: number, height: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=gm&viewPack=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await page.getByRole('button', { name: "Open Wren of the Lantern Wardens's pack" }).click();
  await expect(page.getByRole('note')).toBeVisible();
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the Pack in the view: the player's rows, the GM's line and Reveal… (${size.name}, ${scheme})`, async ({ page }) => {
      await openPack(page, size.width, size.height, scheme);
      const wand = page.getByRole('button', { name: /^Glow wand/ });
      await expect(wand).toBeVisible();
      expect(await wand.textContent()).not.toMatch(/hidden|999|998/);

      await page.getByRole('button', { name: /^Mooring ring/ }).click();
      const sheet = page.getByRole('region', { name: 'Mooring ring' });
      const line = sheet.locator('.gm-line');
      await expect(line).toContainText('Only you see this: Curse: Whoever wears it');
      expect(await line.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
      await expect(line.locator('svg')).toHaveCount(1);
      const rows = sheet.getByRole('group', { name: 'Item actions' }).getByRole('button');
      const words = await rows.allTextContents();
      expect(words.indexOf('Reveal…')).toBeGreaterThanOrEqual(0);
      expect(words.indexOf('Reveal…')).toBeLessThan(words.indexOf('Give to…'));
      const reveal = sheet.getByRole('button', { name: 'Reveal…' });
      expect((await reveal.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-pack-ring-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      // Reveal… opens the GM's own sheet for the ring, as built.
      await reveal.click();
      await expect(page.getByRole('group', { name: 'Hidden from players' })).toBeVisible();
      await page.screenshot({ path: `test-results/layout-screens/gm-view-pack-reveal-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
}

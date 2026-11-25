// The Pack in the GM's view as the player (page 32, M3g, M3g2, approved 2026-11-21; row C15e of
// plans/test-feedback-2026-11-19.md), in a real browser on a phone (375 px) and a tablet held sideways (1180 px), in
// light and dark. Purposes, in plain words:
//   1. On Wren's Pack in the view, the wand with a hidden count reads as the player's row: nothing of the count.
//   2. The ring with a long hidden curse opens the player's sheet plus the GM's line, at body size (16 px), with the
//      closed eye, and "Reveal…" above Give to…, at least 44 px high. No sideways scrolling, no text under 14 px, no
//      small targets, no serious accessibility problem.
//   3. "Reveal…" opens the Reveal pop-up over it (k22-8, replacing ⚑ 40's reading and audit fix 5's own sheet), in
//      its own form (CLAUDE.md): the Sheet K22i draws, whole on screen, and that pop-up lays out as cleanly (its own
//      checks: k22-reveal.spec.ts); its ✕ closes it alone.
//   4. The cursed sword (M3g2) names only what Sam can't see (audit fix 6): Sam's copy shows its "Magic bonus -1", so
//      the line reads "Only you see this: cursed.", under the sword's details (audit fix 7), with "Reveal…" (its curse
//      is a hidden field).
//   5. After the ✕ on the Reveal pop-up (a tap) or Escape (a keyboard), focus is back on "Reveal…" in the player's
//      sheet, as it goes back to the opener after the other pop-ups (audit fix 3a; Francis's A, 24 Nov; the Dialog's
//      shared rule, #90).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
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
      await expect(line).toContainText('Only you see this: cursed, Whoever wears it');
      expect(await line.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
      await expect(line.locator('svg')).toHaveCount(1);
      // Under the item's figures, after its details (M3g2; audit fix 7).
      expect(await sheet.evaluate((el) => !!(el.querySelector('dl')!.compareDocumentPosition(el.querySelector('.gm-line')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
      const rows = sheet.getByRole('group', { name: 'Item actions' }).getByRole('button');
      const words = await rows.allTextContents();
      expect(words.indexOf('Reveal…')).toBeGreaterThanOrEqual(0);
      expect(words.indexOf('Reveal…')).toBeLessThan(words.indexOf('Give to…'));
      const reveal = sheet.getByRole('button', { name: 'Reveal…' });
      expect((await reveal.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-pack-ring-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      // Reveal… opens the Reveal pop-up for the ring, in its own form, whole on screen.
      await reveal.click();
      const inner = page.getByRole('dialog', { name: 'Reveal' });
      await expect(inner.getByRole('button', { name: /^Tell Curse/ })).toBeVisible();
      const box = (await inner.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-pack-reveal-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      // One ✕ closes one layer: the player's sheet stays.
      await inner.getByRole('button', { name: 'Close' }).click();
      await expect(inner).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Mooring ring' })).toBeVisible();
    });

    test(`after the Reveal pop-up closes, focus is back on Reveal… (${size.name}, ${scheme})`, async ({ page }) => {
      await openPack(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Mooring ring/ }).click();
      const reveal = page.getByRole('region', { name: 'Mooring ring' }).getByRole('button', { name: 'Reveal…' });
      const inner = page.getByRole('dialog', { name: 'Reveal' });
      // A tap on Reveal…, then on the ✕.
      await reveal.click();
      await inner.getByRole('button', { name: 'Close' }).click();
      await expect(inner).toHaveCount(0);
      await expect(reveal).toBeFocused();
      // The keyboard: Enter on Reveal…, then Escape.
      await page.keyboard.press('Enter');
      await expect(inner).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(inner).toHaveCount(0);
      await expect(reveal).toBeFocused();
      await expect(page.getByRole('dialog', { name: 'Mooring ring' })).toBeVisible();
    });

    test(`the cursed sword's GM line, in M3g2's words (${size.name}, ${scheme})`, async ({ page }) => {
      await openPack(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Old bronze sword/ }).click();
      const sheet = page.getByRole('region', { name: 'Old bronze sword' });
      await expect(sheet.getByText(/Magic bonus/)).toBeVisible();
      await expect(sheet.locator('.gm-line')).toHaveText('Only you see this: cursed.');
      await expect(sheet.getByRole('button', { name: 'Reveal…' })).toBeVisible();
      await page.screenshot({ path: `test-results/layout-screens/gm-view-pack-sword-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
}

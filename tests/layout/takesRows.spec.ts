// Rows picked more than once in creation (pf-16, as #671 has it; #747's review). Purpose: at a phone's width a short
// name keeps "Picked ✓✓" beside it, on the name's line, while a long name lets it drop under the name, at the right,
// so the name keeps its room.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';

test.use({ viewport: { width: 375, height: 812 } });

test('a short name keeps Picked ✓✓ beside it; a long one lets it drop under the name', async ({ page }) => {
  await page.goto('/gallery.html?theme=light');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const rows = await page.evaluate(() =>
    ['Heron', 'Keeper of the Nine Drowned Bells below the Old Lantern'].map((name) => {
      const body = [...document.querySelectorAll('#creation-shell .pick-row--takes .pick-row__body')].find((b) => b.textContent?.trim() === name)!;
      const picks = body.parentElement!.querySelector('.pick-row__picks')!;
      const b = body.getBoundingClientRect();
      const p = picks.getBoundingClientRect();
      return { name, beside: p.top < b.bottom - 1, rightEdge: Math.round(p.right), rowRight: Math.round(body.parentElement!.getBoundingClientRect().right) };
    }),
  );
  expect(rows[0]!.beside).toBe(true);
  expect(rows[1]!.beside).toBe(false);
  // Dropped, it still sits at the right.
  expect(rows[1]!.rightEdge).toBe(rows[1]!.rowRight);
});

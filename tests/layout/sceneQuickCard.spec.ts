// The Scene's quick fixes, batch B, the place card (docs/plans/dec-scene-quickfix.md, Q6 and Q7), in a real browser on
// the layout page's invented harbour (`?placePage=spot`, the jetty). What it checks, in plain words:
//   * Q6 (F17): the GM's row "From the book, for the GM" carries no crossed eye and no "never sent" name; the chevron
//     stays at the row's right; the row is still one target at least 44 px tall, folded and open;
//   * Q6 (F18): opened, the whole text shows, its list and boxed aside included;
//   * nothing scrolls sideways and axe finds no serious problem, on a phone and a tablet, light and dark.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openJetty(page: Page) {
  await page.goto('/layout.html?as=gm&placePage=spot');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('button', { name: /From the book, for the GM/ })).toBeVisible();
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the book's text row (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the row has no eye, keeps its chevron at the right and its 44 px target, folded and open, and opened it
      // shows the whole text with its list and boxed aside; the page passes the layout and accessibility checks.
      test('no crossed eye; the chevron at the right; the whole text opens', async ({ page }) => {
        await openJetty(page);
        const row = page.getByRole('button', { name: /From the book, for the GM/ });
        await expect(row.getByRole('img')).toHaveCount(0);
        await expect(row.getByLabel(/never sent/)).toHaveCount(0);
        const chevron = row.locator('.book-text__chevron');
        for (const state of ['folded', 'open'] as const) {
          if (state === 'open') await row.click();
          const rowBox = (await row.boundingBox())!;
          const chevronBox = (await chevron.boundingBox())!;
          expect(rowBox.height).toBeGreaterThanOrEqual(44);
          // The chevron is the row's last mark, at its right edge.
          expect(Math.round(rowBox.x + rowBox.width - (chevronBox.x + chevronBox.width))).toBeLessThanOrEqual(1);
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        }
        const text = page.getByRole('region', { name: 'From the book, for the GM' });
        await expect(text.getByRole('listitem').first()).toBeVisible();
        await expect(text.getByText('If the party asks the ferrymen about the ring.')).toBeVisible();
      });
    });
  }
}

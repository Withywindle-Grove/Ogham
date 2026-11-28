// A place's Knowledge sheet (December dec-7 piece 6a; mc-40; mockup december/01 frames 7 and 7b), in a real browser on
// the layout page's invented harbour (`?knowledge=1`; `one` a lone section, `empty` nothing written). What it checks,
// in plain words:
//   * the sheet opens with the facts showing and every section folded, each heading a 44 px target with its first line;
//   * a tap opens a section in place, a second leaves the first open, and the first line goes once it's open;
//   * on a phone the sheet is the whole screen's width; nothing scrolls sideways and axe finds no serious problem, in
//     light and dark, folded, opened, with a lone section and with nothing written.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Knowledge sheet (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the sheet opens folded, each heading a 44 px target showing the book's first line, and passes the checks.
      test('opens folded, each section with its first line', async ({ page }) => {
        await page.goto('/layout.html?knowledge=1');
        const sheet = page.getByRole('dialog', { name: 'The Drowned Harbour: Knowledge' });
        await sheet.waitFor();
        await expect(sheet.getByRole('group', { name: 'Facts' })).toBeVisible();
        const headings = sheet.locator('summary');
        await expect(headings).toHaveCount(3);
        for (const box of await Promise.all((await headings.all()).map((h) => h.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
        await expect(sheet.locator('.place-facts__first')).toHaveCount(3);
        await expect(sheet.locator('.place-facts__first').first()).toBeVisible();
        if (size.name === 'phone') expect(Math.round((await sheet.boundingBox())!.width)).toBe(size.width);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: a tap opens a section in place with its list; a second section opens beside it; the first line goes.
      test('opens two sections at once', async ({ page }) => {
        await page.goto('/layout.html?knowledge=1');
        const sheet = page.getByRole('dialog', { name: 'The Drowned Harbour: Knowledge' });
        await sheet.getByText('What everyone knows', { exact: true }).click();
        await sheet.getByText('The wreck’s cargo', { exact: true }).click();
        const folds = sheet.locator('details');
        await expect(folds.nth(0)).toHaveAttribute('open', '');
        await expect(folds.nth(1)).toHaveAttribute('open', '');
        await expect(folds.nth(1).locator('.place-facts__first')).toBeHidden();
        await expect(folds.nth(1).getByRole('listitem')).toHaveCount(4);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: a lone section starts open, and a place with nothing written says so; both pass the checks.
      test('a lone section, and nothing written', async ({ page }) => {
        await page.goto('/layout.html?knowledge=one');
        const sheet = page.getByRole('dialog', { name: 'The Drowned Harbour: Knowledge' });
        await expect(sheet.locator('details')).toHaveAttribute('open', '');
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.goto('/layout.html?knowledge=empty');
        await expect(page.getByText('The pack gives no knowledge for this place.')).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

// Details as frame P3 draws it (pss-1, pib-3; december/14, "opened" panel, approved 2026-11-27), on the shared P1-like
// character with long words and a Background from the kindred's list (`layout.html?as=player&p1=details`,
// src/testing/layoutP1Character.ts), on a tablet and at 375 px, light and dark. Purposes, each a plain sentence:
//   1. Opened, the lines come in P3's order: Motto, Kindred, Class, the alignment (the pack's "Leaning"), Background,
//      then the backstory under its "Backstory" label.
//   2. Each entry name is a tap named "<name>: open its entry", at least 44 px tall, in the full sheet's own value look
//      (its control border, no underline: Francis, 27 Nov 2026), and the line's words follow it on the same line.
//   3. Long words stay inside the column: nothing spills sideways, and the page's own checks find nothing.
//   4. A tap on an entry name opens its entry, and Details stays open under it.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

const details = (page: Page) => page.getByRole('region', { name: 'Details' });

async function openDetails(page: Page) {
  await page.goto('/layout.html?as=player&p1=details');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player-level')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const fold = details(page).getByRole('button', { name: 'Details' });
  await fold.scrollIntoViewIfNeeded();
  await fold.click();
  await expect(fold).toHaveAttribute('aria-expanded', 'true');
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`Details as P3 draws it, ${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme, viewport: { width: size.width, height: size.height } });

      test(`1-3. P3's lines, their entry taps and long words, whole (${size.name}, ${scheme})`, async ({ page }) => {
        await openDetails(page);
        const labels = await details(page).locator('.book-line > .book-label').allTextContents();
        expect(labels).toEqual(['Motto', 'Kindred', 'Class', 'Leaning', 'Background', 'Backstory']);
        const names = ['Bog folk', 'Lantern Warden', 'Lantern', 'Eel catcher'];
        for (const name of names) {
          const tap = details(page).getByRole('button', { name: `${name}: open its entry` });
          await expect(tap).toBeVisible();
          const box = (await tap.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(43.5);
          const look = await tap.evaluate((el) => {
            const style = getComputedStyle(el);
            const plain = document.createElement('button');
            plain.className = 'tap-value';
            el.closest('.book-line')!.appendChild(plain);
            const standard = getComputedStyle(plain);
            const want = { border: standard.borderTopWidth, borderColour: standard.borderTopColor, background: standard.backgroundColor };
            plain.remove();
            return {
              underline: style.textDecorationLine,
              classes: el.className,
              border: style.borderTopWidth,
              borderColour: style.borderTopColor,
              background: style.backgroundColor,
              want,
            };
          });
          expect(look.classes).toBe('tap-value');
          expect(look.underline).toBe('none');
          expect(look.border).not.toBe('0px');
          expect({ border: look.border, borderColour: look.borderColour, background: look.background }).toEqual(look.want);
        }
        // The Kindred line holds its label, the name's tap and the entry's own short line, in that order.
        const kindred = details(page).locator('.book-line').nth(1);
        const words = (await kindred.textContent()) ?? '';
        expect(words).toBe('Kindred Bog folk. Short, damp and hard to drown.');
        // Long words stay inside the column.
        const outside = await details(page).evaluate((el) => {
          const edge = el.getBoundingClientRect().right;
          return [...el.querySelectorAll('.book-line, .tap-value')].filter((l) => l.getBoundingClientRect().right > edge + 1).length;
        });
        expect(outside).toBe(0);
        const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(spill).toBeLessThanOrEqual(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, 'section[aria-label="Details"]')).toEqual([]);
        await details(page).screenshot({ path: `test-results/p3-details-${size.name}-${scheme}.png` });
      });

      test(`4. an entry name opens its entry; Details stays open (${size.name}, ${scheme})`, async ({ page }) => {
        await openDetails(page);
        await details(page).getByRole('button', { name: 'Eel catcher: open its entry' }).click();
        const entry = page.getByRole('dialog', { name: 'Eel catcher' });
        await expect(entry).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await entry.getByRole('button', { name: 'Close' }).first().click();
        await expect(details(page).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'true');
      });
    });
  }
}

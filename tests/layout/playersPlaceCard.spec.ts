// The players' place card (plan dec-9-the-players-scene, P4; page 24 PL1b to PL1d, set 9's PR1 to PR7c, page 01 frame
// 7b), in a real browser on the layout page's invented harbour (`?placeCard=1`; `bare` the Area never shown, `messy`
// long names and 999; `gm` the GM's Knowledge with its eyes). What it checks, in plain words:
//   * the two cards stand in the page's columns (one column on a phone, the Location first), the Area's rows each a
//     44 px target; nothing scrolls sideways and axe finds no serious problem, in light and dark;
//   * a known Location opens its shown pieces in the standard sheet, and the Rules row its list;
//   * the GM's eye on a section is a 44 px switch, and a tap shares it (its line and the count change).
import { expect, test } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the players' place card (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the Location's card and the Area's stand in their columns, every row a 44 px target, and pass the checks,
      // with the Area shown, never shown, and with long names and 999.
      test('both cards, in each state', async ({ page }) => {
        for (const state of ['1', 'bare', 'messy']) {
          await page.goto(`/layout.html?placeCard=${state}`);
          const location = page.getByRole('region', { name: /^Where you are: / });
          await location.waitFor();
          const left = await location.boundingBox();
          const area = page.locator('.players-area');
          await expect(area).toBeVisible();
          const right = await area.boundingBox();
          // One column on a phone, the Location first; two side by side on a tablet.
          if (size.name === 'phone') expect(right!.y).toBeGreaterThan(left!.y);
          else expect(right!.x).toBeGreaterThan(left!.x);
          for (const box of await Promise.all((await area.getByRole('button').all()).map((b) => b.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(await layoutProblems(page), state).toEqual([]);
          expect(await accessibilityProblems(page), state).toEqual([]);
        }
      });

      // Purpose: a known Location opens the standard sheet with its shown pieces; the Rules row opens its list, headed by
      // place when two places have rules.
      test('opens a known Location and the Rules list', async ({ page }) => {
        await page.goto('/layout.html?placeCard=1');
        await page.getByRole('button', { name: /2\. The Wreck/ }).click();
        const sheet = page.getByRole('dialog', { name: '2. The Wreck' });
        await expect(sheet.getByText(/A cog on her side/)).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await sheet.getByRole('button', { name: 'Close' }).click();
        await page.getByRole('button', { name: /^Rules: / }).click();
        const list = page.getByRole('dialog', { name: /Rules/ });
        await expect(list.locator('.players-rules__heading')).toHaveCount(2);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: the GM's eye is a 44 px switch beside each section; a tap shares the section and the count follows.
      test("the GM's eyes on Knowledge", async ({ page }) => {
        await page.goto('/layout.html?placeCard=gm');
        const sheet = page.getByRole('dialog', { name: 'The Drowned Harbour: Knowledge' });
        await sheet.waitFor();
        const eyes = sheet.getByRole('switch');
        await expect(eyes).toHaveCount(3);
        for (const box of await Promise.all((await eyes.all()).map((e) => e.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
        await expect(sheet.getByText('1 of 3 sections shared.')).toBeVisible();
        await eyes.nth(1).click();
        await expect(sheet.getByText('2 of 3 sections shared.')).toBeVisible();
        await expect(sheet.getByText('Shared with the players, turn 9.')).toHaveCount(2);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

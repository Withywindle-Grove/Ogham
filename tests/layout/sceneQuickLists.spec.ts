// The Scene's quick fixes, batch C, the lists (plan dec-scene-quickfix Q1; F1 a, ruled 2026-11-25), in a real browser
// on the layout page's invented campaigns. What it checks, in plain words:
//   * the Depart sheet's Where? lists an Area's Locations with those that have no map number first, in the pack's
//     order, then by number as numbers ("0." before "1.", "2." before "10."), though the pack lists them out of order;
//   * only the order changes: nothing scrolls sideways, every row is a 44 px tap, and axe finds no serious problem,
//     at 375 and 1180 px, in light and dark. Each test saves its picture.
import { expect, test } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

for (const [width, height] of [[375, 812], [1180, 820]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the lists' order (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (Q1): the Depart list's Locations come with no number first, then by number, 0 a number, 2 before 10.
      test("the Depart sheet's Where?, in map-number order", async ({ page }) => {
        await page.goto('/layout.html?as=gm&town=town&places=isle');
        await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
        await page.getByRole('button', { name: 'Depart' }).click();
        await page.getByRole('dialog', { name: /Depart$/ }).getByRole('button', { name: 'Where?: Pick a Location' }).click();
        const picker = page.getByRole('dialog', { name: /Where\?$/ });
        await expect(picker.getByRole('region', { name: 'The Drowned Harbour' }).getByRole('button')).toHaveText([
          'The Anchorage',
          '0. The Breakwater',
          '1. The Jetty',
          '2. The Wreck',
          '10. The Customs Shed of the Old Lantern Wardens, Long Since Flooded',
        ]);
        await expect(picker.getByRole('region', { name: 'The Shingle Beach' }).getByRole('button')).toHaveText(['The Landing', '1. The Sea Stack']);
        for (const row of await picker.getByRole('region').getByRole('button').all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/scene-quick-lists-depart-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

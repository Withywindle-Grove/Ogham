// The picture piece (TW13, ic-4; plan dec-9-the-whole-scene S17, built ahead), in a real browser on the layout page's
// invented harbour (`?placePage=spot&session=running&picture=1`: the party at the jetty, which has a picture). What it
// checks, in plain words:
//   * the picture's row keeps the thumbnail, "Picture." and its eye, and no buttons of its own;
//   * a tap on the row opens the picture large in the standing pop-up titled "Picture", whose foot has Change (the
//     easel) and Take it off (the cross) as stacked buttons at the right;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, in light and dark, at 375, 680,
//     834 and 1024 px.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openSpot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  // The picture's file: a stand-in drawing (the app's colours aren't in it).
  await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
  await page.goto('/layout.html?as=gm&placePage=spot&session=running&picture=1');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.place-page__name')).toBeVisible();
  await expect(page.locator('.place-page__thumb img')).toBeVisible();
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'two columns from', width: 680, height: 1000 },
  { name: 'upright iPad', width: 834, height: 1194 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the picture piece (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose (TW13): the row is the thumbnail, "Picture." and its eye, no buttons of its own; a tap opens the
      // "Picture" pop-up with Change and Take it off as stacked buttons, right-justified.
      test('the row, then the picture opened', async ({ page }) => {
        await openSpot(page);
        const row = page.locator('.place-page__piece--picture');
        await expect(row.getByRole('button')).toHaveCount(2);
        await expect(row.getByRole('button', { name: 'Change picture' })).toHaveCount(0);
        await expect(row.getByText('Picture.')).toBeVisible();
        await row.scrollIntoViewIfNeeded();
        await row.screenshot({ path: `test-results/layout-screens/picture-row-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);

        await row.getByRole('button', { name: 'Picture: open it' }).click();
        const pop = page.getByRole('dialog', { name: 'Picture' });
        await expect(pop.locator('img.place-picture__full')).toBeVisible();
        const change = pop.getByRole('button', { name: 'Change the picture' });
        const takeOff = pop.getByRole('button', { name: 'Take the picture off' });
        await expect(change).toHaveClass(/stacked-button/);
        await expect(takeOff).toHaveClass(/stacked-button/);
        // Right-justified: the foot's last button ends where the pop-up's content ends.
        const foot = (await pop.locator('.dialog__actions').boundingBox())!;
        const last = (await takeOff.boundingBox())!;
        expect(Math.abs(last.x + last.width - (foot.x + foot.width))).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `test-results/layout-screens/picture-pop-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

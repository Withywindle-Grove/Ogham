// The town's and downtime's top (plan dec-9-the-whole-scene S5; page 16 T4, T5 and T6's Start sheet), in a real browser
// on the layout page's invented quay (`?town=town|downtime`). What it checks, in plain words:
//   * in town the band's step reads "Advance time" and is plain, "Depart" is the page's one accent, the date line names
//     the part of the day, and the facts row holds "Part of the day" with no Light fact;
//   * Depart opens the Depart sheet: Where?, "Exploration method" as the switch (B7), and Start as the sheet's accent;
//   * in downtime "Next day" and "Depart" stand plain, nothing is the accent, and no fact shows (no weather yet);
//   * Depart only while a session runs (p2p-4; page 24, DP2, approved 2026-11-18; B6): with no session yet (the layout
//     page's new campaign, `?date=1`) the band shows Start alone, the accent; with the session paused (End session in
//     ⋯), Resume alone, the accent;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, at 375, 680, 834 and 1024 px, in
//     light and dark. Each test saves its picture, in a tall viewport so the band sits at the top.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openQuay(page: Page, town: 'town' | 'downtime') {
  await page.goto(`/layout.html?as=gm&town=${town}`);
  await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
  await expect(page.getByRole('button', { name: 'Depart' })).toBeVisible();
  // The page below the band has loaded (its loading rows gone), so the picture is the page at rest.
  await expect(page.locator('.skeleton')).toHaveCount(0);
  // The band's buttons never cover the date line (on a phone they take a row of their own under it).
  const date = await page.locator('.scene-band__date-line').boundingBox();
  for (const button of await page.locator('.scene-band__next').all()) {
    const box = (await button.boundingBox())!;
    const apart = box.y >= date!.y + date!.height || box.y + box.height <= date!.y || box.x >= date!.x + date!.width || box.x + box.width <= date!.x;
    expect(apart).toBe(true);
  }
}

/** The visible accent buttons on the page (one accent a screen). */
const accents = (page: Page) => page.locator('.button-primary:visible');
/** The band's buttons at its right (the actions and the menu). */
const bandButtons = (page: Page) => page.locator('.scene-band__actions button:visible');

for (const width of [375, 680, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the town's and downtime's top (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1200 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose: in town, Advance time is plain, Depart the one accent, the part of the day named, and no Light fact.
      test('in town', async ({ page }) => {
        await openQuay(page, 'town');
        const band = page.getByRole('region', { name: 'Time' });
        await expect(band.getByRole('button', { name: 'Advance time' })).toHaveClass(/button-secondary/);
        await expect(band.getByRole('button', { name: 'Depart' })).toHaveClass(/button-primary/);
        await expect(bandButtons(page)).toHaveCount(3);
        await expect(accents(page)).toHaveCount(1);
        await expect(band.getByText('Afternoon.')).toBeVisible();
        const facts = page.getByRole('group', { name: 'Scene facts' });
        await expect(facts.getByRole('button', { name: 'Part of the day: Afternoon. Night comes next. Advance by…' })).toBeVisible();
        await expect(facts.locator('.scene-fact--light')).toHaveCount(0);
        // Centred in the row, never stretched (ap-8; T4).
        const row = (await facts.boundingBox())!;
        const tile = (await facts.getByRole('button').first().boundingBox())!;
        expect(Math.abs(tile.x + tile.width / 2 - (row.x + row.width / 2))).toBeLessThan(2);
        expect(tile.width).toBeLessThan(row.width);
        await page.screenshot({ path: `test-results/layout-screens/town-top-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (p2p-4; DP2): with no session yet, the band shows Start alone, the one accent, with no Depart beside it.
      test('no session yet', async ({ page }) => {
        await page.goto('/layout.html?as=gm&date=1');
        await page.getByRole('button', { name: /The Reckoning Mere/ }).click();
        await expect(page.getByRole('heading', { name: 'No session yet' })).toBeVisible();
        const band = page.getByRole('region', { name: 'Time' });
        await expect(band.getByRole('button', { name: 'Start session' })).toHaveClass(/button-primary/);
        await expect(page.getByRole('button', { name: 'Depart' })).toHaveCount(0);
        await expect(bandButtons(page)).toHaveCount(2);
        await expect(accents(page)).toHaveCount(1);
        await expect(page.locator('.skeleton')).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/town-no-session-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (p2p-4; DP2): with the session paused in town, the band shows Resume alone, the one accent, with no
      // Depart and no Advance time.
      test('a session paused in town', async ({ page }) => {
        await openQuay(page, 'town');
        const band = page.getByRole('region', { name: 'Time' });
        await band.getByRole('button', { name: 'Time options' }).click();
        await page.getByRole('button', { name: 'End session' }).click();
        await expect(band.getByRole('button', { name: 'Resume session' })).toHaveClass(/button-primary/);
        await expect(page.getByRole('button', { name: 'Depart' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Advance time' })).toHaveCount(0);
        await expect(bandButtons(page)).toHaveCount(2);
        await expect(accents(page)).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/town-paused-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: Depart opens the Depart sheet, with Where?, the method as one switch (B7) and Start as its accent.
      test('the Depart sheet', async ({ page }) => {
        await openQuay(page, 'town');
        await page.getByRole('button', { name: 'Depart' }).click();
        const sheet = page.getByRole('dialog', { name: /Depart$/ });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByRole('group', { name: 'Exploration method' })).toHaveClass(/button-row--switch/);
        await expect(sheet.getByRole('button', { name: 'Where?: Pick a Location' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Start' })).toHaveClass(/button-primary/);
        // The sheet's only accent is its Start (sa-1).
        await expect(sheet.locator('.button-primary')).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/town-depart-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: Where? opened from the Depart sheet shows the place picker as its own pop-up (docs/06, Place picker),
      // not a sheet within the sheet, and it fits.
      test('the place picker from Depart', async ({ page }) => {
        await openQuay(page, 'town');
        await page.getByRole('button', { name: 'Depart' }).click();
        await page.getByRole('dialog', { name: /Depart$/ }).getByRole('button', { name: /^Where\?:/ }).click();
        await expect(page.getByRole('button', { name: /^Other…/ })).toBeVisible();
        await expect(page.locator('.dialog--sheet')).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/town-depart-picker-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: in downtime, Next day and Depart are plain, nothing is the accent, and no fact shows.
      test('in downtime', async ({ page }) => {
        await openQuay(page, 'downtime');
        const band = page.getByRole('region', { name: 'Time' });
        await expect(band.getByRole('button', { name: 'Next day' })).toHaveClass(/button-secondary/);
        await expect(band.getByRole('button', { name: 'Depart' })).toHaveClass(/button-secondary/);
        await expect(accents(page)).toHaveCount(0);
        await expect(page.getByRole('group', { name: 'Scene facts' })).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/downtime-top-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

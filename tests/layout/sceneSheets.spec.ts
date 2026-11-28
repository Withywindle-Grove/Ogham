// The band's sheets (plan dec-9-the-whole-scene S10; page 16, T6; st-3, wr-1), in a real browser on the layout page's
// invented campaigns. What it checks, in plain words:
//   * the Weather fact opens the Weather sheet: for the GM, the weather table in the book's style with "Roll d6, then
//     tap the row.", every row a 44 px tap and no accent in the sheet; once the weather is in, it says the weather and
//     its effects in plain words, who entered it, and marks its row;
//   * the date line, while the date is unset, opens Set the date: the day, the month as a field that opens the
//     calendar's months in order (a long month's name wraps), and the hour play starts, with "Set the date" as the
//     sheet's one accent;
//   * the Depart sheet (plan scene-point-to-point B7; page 24, DP1 and DP1b): Where? first, its list only Locations
//     under their Area, a picked Location with its Area under it and Point to point filled in; Start with nothing
//     picked opens "Pick a Location first";
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, at 375, 680, 834 and 1024 px, in
//     light and dark. Each test saves its picture, in a tall viewport so the band sits at the top.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

/** The visible accent buttons inside the open sheet (sa-1: one a surface you can act on). */
const sheetAccents = (page: Page) => page.getByRole('dialog').last().locator('.button-primary:visible');

async function openWeather(page: Page, campaign: RegExp) {
  await page.goto('/layout.html?as=gm');
  await page.getByRole('button', { name: campaign }).click();
  await page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Weather/ }).click();
  const sheet = page.getByRole('dialog', { name: /Weather$/ });
  await expect(sheet).toBeVisible();
  return sheet;
}

for (const width of [375, 680, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the band's sheets (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1200 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (st-3): the GM's weather roll is a tap on the table's row, in the book's style; the sheet has no accent.
      test('the Weather sheet, to roll', async ({ page }) => {
        const sheet = await openWeather(page, /The Wet Road/);
        await expect(sheet.getByText('Roll d6, then tap the row.')).toBeVisible();
        await expect(sheet.getByRole('group', { name: 'Fen sky' }).getByRole('radio')).toHaveCount(1);
        await expect(sheetAccents(page)).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-weather-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (T6): once in, the sheet says the weather and each effect in plain words, who entered it, and marks its row.
      test('the Weather sheet, once in', async ({ page }) => {
        const sheet = await openWeather(page, /The Dry Ford/);
        // T6's labelled lines: the weather's name, then each effect as its name and a full stop, then its words.
        const lines = sheet.locator('.weather-sheet__now .book-line');
        await expect(lines.first().locator('.book-label')).toHaveText(/^A grey, drowning rain .*\.$/);
        await expect(lines.filter({ hasText: 'Mired' })).toHaveText('Mired. −2 travel points.');
        await expect(sheet.getByText('Rolled by Sam.')).toBeVisible();
        await expect(sheet.getByRole('radio', { checked: true })).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-weather-in-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (st-3, T6): Reminders, from the menu, lists what is to come, each with when it next falls due, and the
      // stacked + Reminder; nothing in the sheet is the accent.
      test('the Reminders sheet', async ({ page }) => {
        await page.goto('/layout.html?as=gm&placePage=spots&session=running');
        await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
        await expect(page.getByRole('region', { name: 'Locations' })).toBeVisible();
        await page.getByRole('button', { name: 'Time options' }).click();
        await page.locator('.more-menu__panel').getByRole('button', { name: 'Reminders' }).click();
        const sheet = page.getByRole('dialog', { name: /Reminders$/ });
        const rows = sheet.getByRole('group', { name: 'Reminders to come' }).getByRole('button');
        expect(await rows.count()).toBeGreaterThanOrEqual(2);
        await expect(rows.filter({ hasText: 'Wandering check' })).toHaveAccessibleName(/^Wandering check: Encounter check\. Every 2 turns\. Next in \d+ turns?\./);
        await expect(sheet.getByRole('button', { name: '+ Reminder' })).toBeVisible();
        await expect(sheetAccents(page)).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-reminders-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        // #877's review: "+ Reminder" opens the reminder's own sheet as today's centred card, not as a sheet.
        await sheet.getByRole('button', { name: '+ Reminder' }).click();
        const card = page.getByRole('dialog', { name: 'New reminder' });
        await expect(card).toBeVisible();
        await expect(card).not.toHaveClass(/dialog--sheet/);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-reminders-new-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (B7, p2p-5; page 24, DP1 and DP1b; sf-2, page 44, DP3): the Depart sheet asks Where? first, with only
      // Locations under their Area in its list (the first Area open and the other folded, a long name wrapping, every row
      // a 44 px tap, the search over them, Other… under them); a picked Location shows its Area under its name and fills in
      // Point to point; Start is the sheet's one accent.
      test('the Depart sheet, Where? and its Locations', async ({ page }) => {
        test.setTimeout(90_000); // three pictures and three axe runs; a phone run under load outgrew 30 s
        await page.goto('/layout.html?as=gm&town=town&places=isle');
        await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
        await page.getByRole('button', { name: 'Depart' }).click();
        const sheet = page.getByRole('dialog', { name: /Depart$/ });
        await expect(sheet.getByRole('button', { name: 'Where?: Pick a Location' })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-depart-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await sheet.getByRole('button', { name: 'Where?: Pick a Location' }).click();
        const picker = page.getByRole('dialog', { name: /Where\?$/ });
        await expect(picker.getByRole('region', { name: 'The Drowned Harbour' }).locator('.depart-pick__row')).toHaveCount(5);
        await picker.getByRole('button', { name: 'Show The Shingle Beach' }).click();
        await expect(picker.getByRole('region', { name: 'The Shingle Beach' }).locator('.depart-pick__row')).toHaveText(['The Landing', '1. The Sea Stack']);
        await expect(picker.getByRole('textbox', { name: 'Search places by name or map number' })).toBeVisible();
        // Other… under the Locations, for everything else (⚑ 6).
        await expect(picker.getByRole('button', { name: 'Other… a place that isn’t listed' })).toBeVisible();
        for (const row of await picker.getByRole('button', { name: /^(The|\d)/ }).all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-depart-where-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await picker.getByRole('button', { name: 'The Anchorage' }).click();
        await expect(sheet.getByRole('button', { name: 'Where?: The Anchorage, The Drowned Harbour' })).toBeVisible();
        await expect(sheet.getByRole('group', { name: 'Exploration method' }).getByRole('button', { name: 'Point to point' })).toHaveAttribute('aria-pressed', 'true');
        await expect(sheetAccents(page)).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-depart-picked-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (B7, ⚑ 4; DP1 with its fix): Start with nothing picked opens "Pick a Location first" over the sheet, with
      // its one sentence and Got it, and it fits.
      test('the Depart sheet, Start with nothing picked', async ({ page }) => {
        await page.goto('/layout.html?as=gm&town=town&places=isle');
        await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
        await page.getByRole('button', { name: 'Depart' }).click();
        await page.getByRole('dialog', { name: /Depart$/ }).getByRole('button', { name: 'Start' }).click();
        const pop = page.getByRole('dialog', { name: 'Pick a Location first' });
        await expect(pop.getByText('An expedition starts at a Location.')).toBeVisible();
        await expect(pop.getByRole('button', { name: 'Got it' })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-depart-need-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (st-3): Set the date asks the day, the month (a field opening the months) and the hour, with one accent;
      // the months sheet lists the calendar's months in order, a long name wrapping.
      test('Set the date, and its months', async ({ page }) => {
        await page.goto('/layout.html?as=gm&date=1');
        await page.getByRole('button', { name: /The Reckoning Mere/ }).click();
        // WebKit reads the line's two spans with a space between ("Day 1 . Set the date").
        await page.getByRole('button', { name: /^Day 1 ?\. Set the date$/ }).click();
        const sheet = page.getByRole('dialog', { name: /Set the date$/ });
        await expect(sheet.getByLabel('Day')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Month: Frostwane. Change' })).toBeVisible();
        await expect(sheet.getByLabel('Hour')).toBeVisible();
        await expect(sheetAccents(page)).toHaveCount(1);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-date-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await sheet.getByRole('button', { name: 'Month: Frostwane. Change' }).click();
        const months = page.getByRole('dialog', { name: /Month$/ });
        await expect(months.getByRole('radio')).toHaveCount(7);
        await expect(months.getByRole('radio', { checked: true })).toHaveText(/^Frostwane/);
        await page.screenshot({ path: `test-results/layout-screens/scene-sheets-months-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await months.getByRole('radio', { name: /^Hayfall/ }).click();
        await expect(sheet.getByRole('button', { name: 'Month: Hayfall. Change' })).toBeVisible();
      });
    });
  }
}

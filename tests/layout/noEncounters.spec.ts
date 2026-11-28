// A place with no encounters, the GM's side (G-27; #187; page 48, approved 2026-11-28 with findings 1, 2, 4 and 6;
// dg-1 to dg-4, dg-17). On the layout page's invented harbour (`?placePage=spot&session=running&check=quiet`), whose
// pack says `"encounterCheck": { "none": true, "note": … }`, the party at a spot inside it. What it checks, in plain
// words, at 375 px and on a tablet, light and dark, with a long harbour name too (&name=long):
//   * the Encounter check tile reads "None here" with the small line "Its own rule.", neither cut (finding 1);
//   * "Checks here" reads "No encounters here." with its switch on, then the pack's sentence and whose rule it is;
//   * a tap on the switch reads "Encounters as usual here." with the switch off;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem.
// And a player's side (G-27 piece B, #190; page 48, 48-2 B), at 375 px, light and dark, with a long name too
// (`?as=player&placePage=spots&check=quiet`, the party at the harbour, shown): the same tile, "None here", "Its own
// rule.", whole; its pop-up says whose rule it is.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openQuiet(page: Page, name: '' | 'long') {
  await page.goto(`/layout.html?as=gm&placePage=spot&session=running&check=quiet${name ? `&name=${name}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('button', { name: 'Next turn' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** True when the element's words overrun it (cut with an ellipsis). */
const cut = (page: Page, part: string) =>
  page.getByRole('button', { name: /^Encounter check:/ }).locator(part).first().evaluate((el) => el.scrollWidth > el.clientWidth + 1);

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    for (const name of ['', 'long'] as const) {
      test.describe(`a place with no encounters (${size.width}, ${scheme}${name ? ', a long name' : ''})`, () => {
        test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

        // Purpose (dg-3, dg-17 findings 1, 2 and 4): the tile says "None here", "Its own rule.", whole at 375 px
        // whatever the place's name; the card says no encounters here with the pack's sentence and whose rule it is,
        // and switched off, encounters as usual.
        test('the tile says None here and the card says No encounters here', async ({ page }) => {
          await openQuiet(page, name);
          const tile = page.getByRole('button', { name: /^Encounter check:/ });
          await expect(tile).toHaveAttribute('aria-label', 'Encounter check: None here. Its own rule.');
          expect(await cut(page, '.scene-fact__value-text')).toBe(false);
          expect(await cut(page, '.scene-fact__sub-text')).toBe(false);
          const toggle = page.getByRole('switch', { name: 'No encounters here.' });
          await expect(toggle).toHaveAttribute('aria-checked', 'true');
          await expect(page.getByText(/^The harbour watch keeps the quay quiet\. .+’s? own rule\.$/)).toBeVisible();
          await page.screenshot({ path: `test-results/layout-screens/no-encounters-${size.width}-${scheme}${name ? '-long' : ''}.png`, fullPage: true });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
          await toggle.click();
          await expect(page.getByRole('switch', { name: 'Encounters as usual here.' })).toHaveAttribute('aria-checked', 'false');
          await page.screenshot({ path: `test-results/layout-screens/no-encounters-off-${size.width}-${scheme}${name ? '-long' : ''}.png`, fullPage: true });
          expect(await layoutProblems(page)).toEqual([]);
        });
      });
    }
  }
}

for (const scheme of ['light', 'dark'] as const) {
  for (const name of ['', 'long'] as const) {
    test.describe(`a player at a place with no encounters (375, ${scheme}${name ? ', a long name' : ''})`, () => {
      test.use({ viewport: { width: 375, height: 812 }, colorScheme: scheme });

      // Purpose (dg-3; 48-2 B): a player's tile says "None here", "Its own rule.", whole at 375 px whatever the place's
      // name; its pop-up says "None here." and whose rule it is; nothing scrolls sideways and axe finds nothing serious.
      test('the player’s tile says None here', async ({ page }) => {
        await page.goto(`/layout.html?as=player&placePage=spots&session=running&check=quiet${name ? `&name=${name}` : ''}`);
        await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
        await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
        await page.evaluate(() => document.fonts.ready);
        const tile = page.getByRole('button', { name: /^Encounter check:/ });
        await expect(tile).toHaveAttribute('aria-label', 'Encounter check: None here. Its own rule.');
        expect(await cut(page, '.scene-fact__value-text')).toBe(false);
        expect(await cut(page, '.scene-fact__sub-text')).toBe(false);
        await page.screenshot({ path: `test-results/layout-screens/no-encounters-player-375-${scheme}${name ? '-long' : ''}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await tile.click();
        const sheet = page.getByRole('dialog', { name: 'Encounter check' });
        await expect(sheet.getByText('None here.')).toBeVisible();
        await expect(sheet.getByText(/’s? own rule\.$/)).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/no-encounters-player-sheet-375-${scheme}${name ? '-long' : ''}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

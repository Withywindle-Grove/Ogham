// The Scene's quick fixes, batch B, the place card (docs/plans/dec-scene-quickfix.md, Q6 and Q7), in a real browser on
// the layout page's invented harbour (`?placePage=spot`, the jetty). What it checks, in plain words:
//   * Q6 (F17): the GM's row "From the book, for the GM" carries no crossed eye and no "never sent" name; the chevron
//     stays at the row's right; the row is still one target at least 44 px tall, folded and open;
//   * Q6 (F18): opened, the whole text shows, its list and boxed aside included;
//   * Q7 (F20 c, F21 b; `&ids=1`): the GM's small line on a piece names the pack's item, creature and character, never
//     their ids; an unknown id is left out; a long name wraps whole;
//   * nothing scrolls sideways and axe finds no serious problem, on a phone and a tablet, light and dark.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
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

// Q7 (F20 c, F21 b): the GM's small line on a piece names the pack's entries as a person would, never their ids.
const IDS = /reed-silver-arrows|reed-lantern-pole|reed-bog-lurker|reed-npc-oswy|reed-no-such-thing/;
for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the GM's small line names things (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: an item beside a value, an item alone, a creature with its count and note and a character read by
      // name; an unknown id is left out; a long name wraps whole; no id is on the page; the page passes the checks.
      test('names, never ids', async ({ page }) => {
        await page.goto('/layout.html?as=gm&placePage=spot&ids=1');
        await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
        await expect(page.getByText('Value stays yours (40 herons, Item: Silver-tipped arrows).')).toBeVisible();
        const long = page.getByText(/^Value stays yours \(Item: Lantern Warden’s hooked pole of the drowned customs house, with its spare wick\)\.$/);
        await expect(long).toBeVisible();
        await expect(page.getByText('The stat line never shows (Bog lurker ×6 (asleep under the planks)).')).toBeVisible();
        await expect(page.getByText('The stat line never shows (NPC: Oswy the ferryman).')).toBeVisible();
        await expect(page.getByText('Value stays yours (3 sp).')).toBeVisible();
        expect(await page.locator('body').innerText()).not.toMatch(IDS);
        // The long name wraps, never cut: its box shows all of it.
        expect(await long.evaluate((el) => el.scrollWidth <= el.clientWidth && getComputedStyle(el).textOverflow !== 'ellipsis')).toBe(true);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

// The call to adventure reaching a player (plan dec-9-the-players-scene, row P7, the mount; page 40, approved
// 2026-11-24; page 18's PL4b), in a real browser on the layout page: ?calls=1 has the GM send the party a call (it
// pays) and give the party a rumour, so the player's slot holds "1 of 2". What it checks, in plain words:
//   * the card stands in the players' prompt slot, last in it (p7-9), inside the screen, its "Got it" 44 px;
//   * after "Got it" the next call's card stands, with the seen one folded under it to a row 44 px high (40C);
//   * "Got it" by keyboard moves focus to the next card's "Got it", then to the folded row (audit finding 1);
//   * on a phone the words run on under "Got it"; on a tablet they keep a column beside it (findings 4 and 6);
//   * the card reads heading, Got it, words; on a phone the heading has the full width above Got it (re-audit 1, 2);
//   * nothing scrolls sideways, no text is under 14 px, every tap is 44 px, axe finds no serious problem, at 375 and
//     834 px, in light and dark. Each test saves its pictures (the phone and dark ones are owed to Francis, p7-8).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page) {
  await page.goto('/layout.html?as=player&calls=1');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
}

for (const width of [375, 834] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the call card on the players' Scene (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (p7-9; 40A, 40C): the oldest call's card stands last in the players' slot with "1 of 2", inside the
      // screen; Got it folds it under the next call's card, as a row a finger can tap.
      test('stands last in the slot, and folds after Got it', async ({ page }) => {
        await openScene(page);
        const calls = page.getByRole('group', { name: 'Calls to adventure' });
        await expect(calls).toBeVisible();
        await expect(calls.getByText('1 of 2')).toBeVisible();
        // Last in the slot (p7-9).
        const last = await page.locator('.prompt-slot').first().evaluate((slot) => !!slot.lastElementChild?.querySelector('.calls-slot'));
        expect(last).toBe(true);
        const [card, gotIt] = await Promise.all([calls.locator('.call-card').first().boundingBox(), calls.getByRole('button', { name: /^Got it/ }).boundingBox()]);
        expect(card!.x).toBeGreaterThanOrEqual(0);
        expect(card!.x + card!.width).toBeLessThanOrEqual(width);
        expect(gotIt!.height).toBeGreaterThanOrEqual(44);
        // Findings 4 and 6: on a phone the words run on under "Got it" (they end right of its left edge, and start below
        // it); on a tablet they keep their own column, left of it.
        const words = await calls.locator('.call-card__words').first().boundingBox();
        if (width === 375) {
          expect(words!.x + words!.width).toBeGreaterThan(gotIt!.x);
          expect(words!.y + words!.height).toBeGreaterThan(gotIt!.y + gotIt!.height);
        } else {
          expect(words!.x + words!.width).toBeLessThanOrEqual(gotIt!.x);
        }
        await calls.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/players-call-card-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);

        // "Got it" by keyboard (finding 1): focus goes to the next card's "Got it", not to the page's top.
        await calls.getByRole('button', { name: /^Got it/ }).focus();
        await page.keyboard.press('Enter');
        const fold = calls.getByRole('button', { name: 'A call to adventure, for the party' });
        await expect(fold).toBeVisible();
        await expect(calls.getByRole('button', { name: 'Got it: A rumour, for the party' })).toBeFocused();
        // One call left unseen: no count (p7-12), its card above the folded row (p7-13).
        await expect(calls.getByText(/of 2/)).toHaveCount(0);
        const [next, row] = await Promise.all([calls.locator('.call-card').first().boundingBox(), fold.boundingBox()]);
        expect(row!.y).toBeGreaterThanOrEqual(next!.y + next!.height);
        expect(row!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/players-call-card-folded-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);

        // The last "Got it" (finding 1): with no card left, focus goes to the row it folded to.
        await page.keyboard.press('Enter');
        await expect(calls.getByRole('button', { name: 'A rumour, for the party' })).toBeFocused();
      });

      // Purpose (Home Two's second audit, findings 1 and 2): the live region's text starts with the heading; on a phone
      // the heading has the card's full width, above "Got it" (it never wraps beside it); on a tablet "Got it" keeps its
      // drawn place, at the top right beside the heading and the words (40A).
      test.fail('reads the heading first, and gives it the full width on a phone', async ({ page }) => {
        await openScene(page);
        const calls = page.getByRole('group', { name: 'Calls to adventure' });
        await expect(calls.getByRole('status')).toHaveText(/^A call to adventure, for the party/);
        const [heading, gotIt, words] = await Promise.all([
          calls.locator('.call-card__heading').first().boundingBox(),
          calls.getByRole('button', { name: /^Got it/ }).boundingBox(),
          calls.locator('.call-card__words').first().boundingBox(),
        ]);
        if (width === 375) {
          expect(heading!.y + heading!.height).toBeLessThanOrEqual(gotIt!.y + 0.5);
          expect(heading!.x + heading!.width).toBeGreaterThan(gotIt!.x);
          expect(words!.y + words!.height).toBeGreaterThan(gotIt!.y + gotIt!.height);
        } else {
          expect(heading!.x + heading!.width).toBeLessThanOrEqual(gotIt!.x);
          expect(words!.x + words!.width).toBeLessThanOrEqual(gotIt!.x);
          expect(Math.abs(gotIt!.y - heading!.y)).toBeLessThanOrEqual(8);
        }
      });
    });
  }
}

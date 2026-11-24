// The call to adventure reaching a player (plan dec-9-the-players-scene, row P7, the mount; page 40, approved
// 2026-11-24; page 18's PL4b), in a real browser on the layout page: ?calls=1 has the GM send the party a call (it
// pays) and give the party a rumour, so the player's slot holds "1 of 2". What it checks, in plain words:
//   * the card stands in the players' prompt slot, last in it (p7-9), inside the screen, its "Got it" 44 px;
//   * after "Got it" the next call's card stands, with the seen one folded under it to a row 44 px high (40C);
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
        await calls.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/players-call-card-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);

        await calls.getByRole('button', { name: /^Got it/ }).click();
        const fold = calls.getByRole('button', { name: /read it again$/ });
        await expect(fold).toBeVisible();
        // One call left unseen: no count (p7-12), its card above the folded row (p7-13).
        await expect(calls.getByText(/of 2/)).toHaveCount(0);
        const [next, row] = await Promise.all([calls.locator('.call-card').first().boundingBox(), fold.boundingBox()]);
        expect(row!.y).toBeGreaterThanOrEqual(next!.y + next!.height);
        expect(row!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/players-call-card-folded-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

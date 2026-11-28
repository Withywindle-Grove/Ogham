// The find card in the Scene's prompt slot (K18d of docs/plans/dec-6-the-whole-pack-tab.md; page 45's FD1c C,
// approved 2026-11-26; p45-3 and p45-23), in a real browser on the layout page: `?finds=1` has the GM send Wren a
// Bronze ring, and `&calls=1` has him send the party a call and a rumour. What it checks, in plain words:
//   1. On the Scene the find card stands in the prompt slot, last in it, and nowhere else on the tab, at 375 px and at
//      1180 px (where the other tabs put it at the head of the right column); no sideways scrolling, every target 44 px,
//      readable text, no serious accessibility problem, in light and dark.
//   2. With a call due too, the find card shows and the call card does not; after the find's "Got it" the call card
//      stands in the same place, and a keyboard's focus moves to its "Got it".
// Each test saves its pictures for the pull request (the built screen beside FD1c C).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, query: string) {
  await page.goto(`/layout.html?as=player&${query}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await page.evaluate(() => document.fonts.ready);
}

for (const width of [375, 1180] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the find card on the Scene (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose 1.
      test('stands in the prompt slot, last, and nowhere else on the tab', async ({ page }) => {
        await openScene(page, 'finds=1');
        const card = page.locator('.find-card');
        await expect(card).toHaveCount(1);
        await expect(card.getByRole('heading', { name: 'New in your pack' })).toBeVisible();
        const place = await page.evaluate(() => {
          const found = document.querySelector('.find-card')!;
          const slot = found.closest('.prompt-slot');
          return { inSlot: !!slot, last: !!slot?.lastElementChild?.contains(found), inLive: !!found.closest('.calls-slot__live[role="status"]') };
        });
        expect(place).toEqual({ inSlot: true, last: true, inLive: true });
        const box = (await card.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect((await page.getByRole('button', { name: 'Got it: New in your pack' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/k18d-scene-find-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose 2.
      test('a call waits behind the find card, and stands after its Got it', async ({ page }) => {
        await openScene(page, 'finds=1&calls=1');
        await expect(page.locator('.find-card')).toHaveCount(1);
        await expect(page.locator('.call-card')).toHaveCount(0);
        await page.locator('.find-card').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/k18d-scene-find-call-waits-${width}-${scheme}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Got it: New in your pack' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.find-card')).toHaveCount(0);
        const calls = page.getByRole('group', { name: 'Calls to adventure' });
        await expect(calls.locator('.call-card')).toHaveCount(1);
        await expect(calls.getByRole('button', { name: /^Got it: A call to adventure/ })).toBeFocused();
        await page.screenshot({ path: `test-results/layout-screens/k18d-scene-call-after-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

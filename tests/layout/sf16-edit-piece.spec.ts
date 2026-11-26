// sf-16's built screens beside page 44's EP1 (approved by Francis 2026-11-26), on the layout page's invented wreck
// (`layout.html?as=gm&placePage=wreck&session=running&sf8=1`; src/testing/layoutHarness.tsx), in a real browser at
// 1024 px and 375 px, light and dark. Test pictures only: each test saves its screen under
// test-results/layout-screens/sf16-*.png, to be set beside the approved frame. Purposes, in plain words:
//   A. The Mast's arrow (a piece with nothing to send) opens Edit piece at once; "Save" stands alone at the foot's right.
//   B. Opened from the Bronze ring's sheet, "Kind" unfolds its seven kinds in place, each a 44 px row, inside the form.
//   C. A long text grows the box: nothing scrolls inside the field.
// Each: nothing scrolls sideways, no tap target under 44 px, no text under 14 px (layoutProblems).
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 812 },
] as const;

const LONG =
  'A plain band of old bronze, on a hook by the cabin door, green where the sea air has reached it and bright on the inside, as if it had been worn every day until the day it was hung up here and left.';

async function openCard(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  await page.goto('/layout.html?as=gm&placePage=wreck&session=running&sf8=1');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.place-page__name')).toBeVisible();
  await expect(page.locator('.place-page__piece').filter({ hasText: 'Bronze ring.' }).locator('button.place-page__piece-words')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const form = (page: Page) => page.getByRole('dialog', { name: 'Edit piece' });

async function shot(page: Page, frame: string, width: number, scheme: string) {
  // A sheet from the foot rises into place: the picture waits until it stands.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  await page.screenshot({ path: `test-results/layout-screens/sf16-${frame}-${width}-${scheme}.png` });
}

/** Edit piece for the Bronze ring, from its sheet's last row (TR1, EP1's example). */
async function ringForm(page: Page) {
  await page.locator('.place-page__piece').filter({ hasText: 'Bronze ring.' }).locator('.place-page__piece-words').click();
  await page.getByRole('dialog').getByRole('button', { name: "Edit the piece's words" }).click();
  await expect(form(page)).toBeVisible();
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`sf-16 (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      // Purpose: A, a piece with nothing to send opens the form from its arrow; Save alone at the foot's right.
      test('A: the arrow opens Edit piece; Save alone at the foot’s right', async ({ page }) => {
        await openCard(page, scheme);
        await page.getByRole('button', { name: /^Edit piece: Gulls quarrel on it/ }).click();
        await expect(form(page).getByLabel('What players will see')).toHaveValue(/^Gulls quarrel on it/);
        const foot = form(page).locator('.dialog__actions');
        await expect(foot.getByRole('button')).toHaveCount(1);
        const save = (await foot.getByRole('button', { name: 'Save' }).boundingBox())!;
        const field = (await form(page).getByLabel('What players will see').boundingBox())!;
        // At the right: its right edge on the field's.
        expect(Math.abs(save.x + save.width - (field.x + field.width))).toBeLessThanOrEqual(1);
        expect(save.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'form', size.width, scheme);
      });

      // Purpose: B, the kinds unfold in place inside the form, each row 44 px, the picked one ticked.
      test('B: Kind unfolds its seven kinds in place', async ({ page }) => {
        await openCard(page, scheme);
        await ringForm(page);
        await form(page).getByRole('button', { name: 'Kind Treasure' }).click();
        const options = form(page).locator('.edit-piece__option');
        await expect(options).toHaveCount(7);
        await expect(form(page).locator('.edit-piece__option[aria-pressed="true"]')).toHaveText('Treasure');
        for (const box of await Promise.all((await options.all()).map((o) => o.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'kinds', size.width, scheme);
      });

      // Purpose: C, a long text grows the box, so nothing is cut or scrolls inside the field.
      test('C: a long text grows the box', async ({ page }) => {
        await openCard(page, scheme);
        await ringForm(page);
        const field = form(page).getByLabel('What players will see');
        const before = (await field.boundingBox())!.height;
        await field.fill(LONG);
        await field.press('End');
        const after = (await field.boundingBox())!.height;
        expect(after).toBeGreaterThan(before);
        const cut = await field.evaluate((el) => el.scrollHeight - el.clientHeight);
        expect(cut).toBeLessThanOrEqual(1);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'long', size.width, scheme);
      });
    });
  }
}

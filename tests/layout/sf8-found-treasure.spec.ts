// sf-8's built screens beside page 44's TR1 and TR2 (approved by Francis 2026-11-26), on the layout page's invented
// wreck (`layout.html?as=gm&placePage=wreck&sf8=1`, or `&sf8=sent`; src/testing/layoutHarness.tsx), in a real browser at
// 1024 px and 375 px, light and dark. Test pictures only: each test saves its screen under
// test-results/layout-screens/sf8-*.png, to be set beside the approved frame. Purposes, in plain words:
//   A. The Bronze ring's arrow and eye are each 44 px and 8 px apart.
//   B. A tap on the Bronze ring (one thing) opens its sheet: its words, "To a character", "To the party stash", the edit row.
//   C. A tap on the Crate (a count) opens its sheet with "Send all" at the foot's right, under the edit row.
//   D. Once the ring is sent, its sheet says where it went, with "Take it back".
// Each: nothing scrolls sideways, no tap target under 44 px, no text under 14 px (layoutProblems).
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openCard(page: Page, scheme: 'light' | 'dark', sf8: '1' | 'sent') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  await page.goto(`/layout.html?as=gm&placePage=wreck&session=running&sf8=${sf8}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.place-page__name')).toBeVisible();
  await expect(ring(page).locator('.place-page__opens')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const ring = (page: Page) => page.locator('.place-page__piece').filter({ hasText: 'Bronze ring.' });
const crate = (page: Page) => page.locator('.place-page__piece').filter({ hasText: 'Crate.' });

async function shot(page: Page, frame: string, width: number, scheme: string) {
  // A sheet from the foot rises into place: the picture waits until it stands.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  await page.screenshot({ path: `test-results/layout-screens/sf8-${frame}-${width}-${scheme}.png` });
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`sf-8 (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      // Purpose: A, the arrow and the eye are two 44 px targets, 8 px apart.
      test('A: the arrow and the eye are 44 px and 8 px apart', async ({ page }) => {
        await openCard(page, scheme, '1');
        const arrow = (await ring(page).locator('.place-page__opens').boundingBox())!;
        const eye = (await ring(page).getByRole('button', { name: 'Show players' }).boundingBox())!;
        expect([arrow.width, arrow.height, eye.width, eye.height].every((n) => n >= 44)).toBe(true);
        expect(Math.round(eye.x - (arrow.x + arrow.width))).toBe(8);
        await ring(page).scrollIntoViewIfNeeded();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'pieces', size.width, scheme);
      });

      // Purpose: B, one thing's sheet, where it goes at once.
      test('B: a tap on the Bronze ring opens its sheet with where it goes', async ({ page }) => {
        await openCard(page, scheme, '1');
        await ring(page).locator('.place-page__piece-words').click();
        const sheet = page.getByRole('dialog');
        await expect(sheet.getByText('A plain band of old bronze, on a hook by the cabin door.')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'To a character' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'To the party stash' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: "Edit the piece's words" })).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'one-thing', size.width, scheme);
      });

      // Purpose: C, a count's sheet: "Send all" at the foot's right, under the edit row.
      test('C: the Crate opens its sheet with Send all at the foot’s right', async ({ page }) => {
        await openCard(page, scheme, '1');
        await crate(page).locator('.place-page__opens').click();
        const sheet = page.getByRole('dialog');
        const all = (await sheet.getByRole('button', { name: 'Send all' }).boundingBox())!;
        const edit = (await sheet.getByRole('button', { name: "Edit the piece's words" }).boundingBox())!;
        const body = (await sheet.locator('.hoard-sheet').boundingBox())!;
        expect(all.y).toBeGreaterThanOrEqual(edit.y + edit.height);
        expect(Math.abs(all.x + all.width - (body.x + body.width))).toBeLessThanOrEqual(1);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'count', size.width, scheme);
      });

      // Purpose: D, a sent piece's sheet: where it went, "Take it back", the edit row.
      test('D: once sent, the ring’s sheet says where it went, with Take it back', async ({ page }) => {
        await openCard(page, scheme, 'sent');
        await expect(ring(page).getByText(/Sent to Wren/)).toBeVisible();
        await ring(page).locator('.place-page__piece-words').click();
        const sheet = page.getByRole('dialog');
        await expect(sheet.getByText('Sent to Wren of the Lantern Wardens.')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Take it back' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'To a character' })).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'sent', size.width, scheme);
      });
    });
  }
}

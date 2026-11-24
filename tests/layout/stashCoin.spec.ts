// Coin in the party stash (K13; pu-3, pu-5; mockup pack/07 frames PC6 and PC6b, approved 2026-11-13; its place first
// on pack/08 PK4, ap-6), in a real browser at 375 px and on a landscape tablet, light and dark. Purposes:
//   1. The stash's coin row sits first above the lists, the same row as a character's coin line (amounts and a
//      chevron), with nothing to tap on it but itself; with none it reads "No coin".
//   2. Its sheet "Party stash's coin" lists every coin the setting names (0 shown as 0) and one row, Take….
//   3. "Take coin": the stash's amount under each coin, the accent naming the amount, a refusal under the row with
//      the warning sign, and the toast in the log line's words with Undo.
//   4. Messy coin (long names, 999) wraps without sideways scrolling; offline, Take… stays a row and explains.
//   5. (fixme, ⚑ 8 of #66) Two long-named coins at once: the accent's label stays inside its button.
//   Every scene: no sideways scrolling, every target at least 44 px, readable text, no serious accessibility problem.
// The pictures it saves (deviceScaleFactor 2) are the as-built pictures beside PC6, PC6b and PK4 in the pull request.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;

async function openStash(page: Page, query: string) {
  await page.goto(`/layout.html?as=player&${query}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’s pack' })).toBeAttached();
  await page.getByRole('button', { name: /^Party stash/ }).click();
  await expect(page.getByRole('heading', { name: 'Loose' })).toBeVisible();
}

const stashCoin = (page: Page) => page.getByRole('region', { name: 'Party stash' }).getByRole('button', { name: /^Coin: / });

async function openTake(page: Page) {
  await stashCoin(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Take…' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Take coin' })).toBeVisible();
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.name} ${scheme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, colorScheme: scheme });

      const scenes: { name: string; query: string; open: (page: Page) => Promise<void> }[] = [
        {
          name: 'stash-coin-row',
          query: 'stash=1&coin=1',
          open: async (page) => {
            const row = stashCoin(page);
            await expect(row).toHaveText('40 herons, 12 bits');
            const box = (await row.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(43.5);
            // First above the lists.
            const loose = (await page.getByRole('heading', { name: 'Loose' }).boundingBox())!;
            expect(box.y).toBeLessThan(loose.y);
          },
        },
        {
          name: 'stash-coin-none',
          query: 'coin=1',
          open: async (page) => {
            await expect(stashCoin(page)).toHaveText('No coin');
          },
        },
        {
          name: 'stash-coin-sheet',
          query: 'stash=1&coin=1',
          open: async (page) => {
            await stashCoin(page).click();
            const sheet = page.getByRole('dialog');
            await expect(sheet.getByRole('heading', { name: 'Party stash’s coin' })).toBeVisible();
            await expect(sheet.locator('.book-line')).toHaveText(['Crowns 0', 'Herons 40', 'Bits 12']);
            await expect(sheet.getByRole('button', { name: 'Take…' })).toBeVisible();
          },
        },
        {
          name: 'stash-coin-take',
          query: 'stash=1&coin=1',
          open: async (page) => {
            await openTake(page);
            const sheet = page.getByRole('dialog');
            await expect(sheet.getByText('The stash has 40.')).toBeVisible();
            await sheet.getByRole('textbox', { name: 'Herons' }).fill('10');
            await expect(sheet.getByRole('button', { name: 'Take 10 herons' })).toBeVisible();
          },
        },
        {
          name: 'stash-coin-refused',
          query: 'stash=1&coin=1',
          open: async (page) => {
            await openTake(page);
            const sheet = page.getByRole('dialog');
            await sheet.getByRole('textbox', { name: 'Herons' }).fill('55');
            await sheet.getByRole('button', { name: 'Take 55 herons' }).click();
            await expect(sheet.getByRole('alert')).toHaveText('The stash has 40 herons.');
            await expect(sheet.getByRole('alert').locator('.warning-sign')).toBeVisible();
          },
        },
        {
          name: 'stash-coin-taken',
          query: 'stash=1&coin=1',
          open: async (page) => {
            await openTake(page);
            const sheet = page.getByRole('dialog');
            await sheet.getByRole('textbox', { name: 'Herons' }).fill('10');
            await sheet.getByRole('button', { name: 'Take 10 herons' }).click();
            const toast = page.locator('.toast');
            await expect(toast).toContainText('Wren of the Lantern Wardens took 10 herons from the stash');
            await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
            await expect(stashCoin(page)).toHaveText('30 herons, 12 bits');
          },
        },
        {
          name: 'stash-coin-messy',
          query: 'stash=1&coin=messy',
          open: async (page) => {
            await expect(stashCoin(page)).toContainText('999 heron marks');
            await openTake(page);
            await page.getByRole('dialog').getByRole('textbox', { name: 'Heron marks' }).fill('999');
            const go = page.getByRole('dialog').locator('.purse-sheet__go');
            await expect(go).toBeVisible();
            expect(await go.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          },
        },
        {
          name: 'stash-coin-offline',
          query: 'stash=1&coin=1',
          open: async (page) => {
            await page.context().setOffline(true);
            await expect(page.getByText('As it was when you were last online.')).toBeVisible();
            await stashCoin(page).click();
            await page.getByRole('dialog').getByRole('button', { name: 'Take…' }).click();
            await expect(page.locator('.toast')).toContainText('You’re offline. Taking from the stash needs the party’s latest, so it waits until you’re back.');
            await expect(page.getByRole('dialog').getByRole('heading', { name: 'Party stash’s coin' })).toBeVisible();
          },
        },
      ];
      // Purpose: with two long-named coins typed at once, the accent's label stays inside the button at 375 px. Known to
      // fail: the shared Coin sheet keeps its amount on one line (the lead's rule, 2026-11-14), so it runs past the
      // edge; ⚑ 8 of #66 asks whether to let it wrap (as K12's Take does), shorten it, or leave it.
      test.fixme('stash-coin-two-long: the accent naming two long coins stays inside its button', async ({ page }) => {
        await openStash(page, 'stash=1&coin=messy');
        await openTake(page);
        const sheet = page.getByRole('dialog');
        await sheet.getByRole('textbox', { name: 'Moon-silver crowns of the Old Causeway' }).fill('1');
        await sheet.getByRole('textbox', { name: 'Heron marks' }).fill('999');
        const go = sheet.locator('.purse-sheet__go');
        await expect(go).toBeVisible();
        expect(await go.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      });

      for (const scene of scenes) {
        test(`${scene.name}: no sideways scrolling, taps at least 44px, readable text, accessible`, async ({ page }) => {
          await openStash(page, scene.query);
          await scene.open(page);
          await page.screenshot({ path: `test-results/layout-screens/${scene.name}-${size.width}-${scheme}.png` });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        });
      }
    });
  }
}

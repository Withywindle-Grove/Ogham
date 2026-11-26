// Coin in the party stash (K13; pu-3, pu-5; mockup pack/07 frames PC6 and PC6b, approved 2026-11-13; its place first
// on pack/08 PK4, ap-6), in a real browser at 375 px and on a landscape tablet, light and dark. Purposes:
//   1. The stash's coin row sits first above the lists, the same row as a character's coin line (amounts and a
//      chevron), with nothing to tap on it but itself; with none it reads "No coin".
//   2. Its sheet "Party stash's coin" lists every coin the setting names (0 shown as 0) and one row, Take….
//   3. "Take coin": the stash's amount under each coin, the accent naming the amount, a refusal under the row with
//      the warning sign, and the toast in the log line's words with Undo.
//   4. Messy coin (long names, 999) wraps without sideways scrolling; offline, Take… stays a row and opens the
//      blocked-action pop-up (⚑ 7, re-ruled "A" 25 Nov).
//   5. Two long-named coins at once: the accent's label wraps inside its button and stays inside it (⚑ 8 of #66, ruled
//      2026-11-26, "Let it wrap").
//   6. Offline with Take coin already open (the network dropped while it was open), a tap on its accent opens the same
//      blocked-action pop-up as Take…, not a toast: beside the accent on a tablet, from the foot on a phone, the sheet
//      still open under it (Home Two's audit of #66, finding 1, picked by Francis 2026-11-26).
//   Every scene: no sideways scrolling, every target at least 44 px, readable text, no serious accessibility problem.
// The pictures it saves (deviceScaleFactor 2) are the as-built pictures beside PC6, PC6b and PK4 in the pull request.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

// Playwright spells an expected failure `test.fail(title, body)`; the fix-branch guard reads `.fails` (bq-6). So a test
// written before its fix goes through `it`: `it.fails` is Playwright's expected failure, and `it` alone a plain test.
type Body = (args: { page: Page }) => Promise<void>;
const it = Object.assign((title: string, body: Body) => test(title, body), { fails: (title: string, body: Body) => test.fail(title, body) });

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
            const take = page.getByRole('dialog', { name: 'Party stash’s coin' }).getByRole('button', { name: 'Take…' });
            await take.click();
            // ⚑ 7, re-ruled "A" 25 Nov: the blocked-action pop-up over the coin sheet, which stays open under it; under
            // the row on a tablet, from the foot on a phone (opened from inside a sheet, it keeps its own form).
            const why = page.getByRole('dialog', { name: 'You’re offline' });
            await expect(why).toContainText('Taking from the stash needs the party’s latest, so it waits until you’re back.');
            await expect(why).toHaveClass(/dialog--sheet/);
            await expect(page.locator('.toast')).toHaveCount(0);
            await expect(page.getByRole('dialog', { name: 'Party stash’s coin' })).toBeAttached();
            // The phone's sheet slides up (200 ms): measured once it has come to rest.
            await why.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
            const card = (await why.boundingBox())!;
            if (size.width >= 700) {
              await expect(why).toHaveClass(/dialog--anchored/);
              const row = (await take.boundingBox())!;
              expect(card.y).toBeGreaterThanOrEqual(row.y + row.height);
            } else {
              expect(card.y + card.height).toBeCloseTo(size.height, 0);
            }
          },
        },
      ];
      // Purpose: with two long-named coins typed at once, the accent's label wraps inside the button and stays inside it,
      // at every size: the shared Coin sheet's accent wraps when it doesn't fit on one line, as K12's Take does (⚑ 8 of
      // #66, ruled 2026-11-26: "Let it wrap").
      it.fails('stash-coin-two-long: the accent naming two long coins stays inside its button', async ({ page }) => {
        await openStash(page, 'stash=1&coin=messy');
        await openTake(page);
        const sheet = page.getByRole('dialog');
        await sheet.getByRole('textbox', { name: 'Moon-silver crowns of the Old Causeway' }).fill('1');
        await sheet.getByRole('textbox', { name: 'Heron marks' }).fill('999');
        const go = sheet.locator('.purse-sheet__go');
        await expect(go).toBeVisible();
        expect(await go.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        // The button itself stays inside the sheet.
        const card = (await sheet.boundingBox())!;
        const box = (await go.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
        await page.screenshot({ path: `test-results/layout-screens/stash-coin-two-long-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });

      it('stash-coin-take-offline: the open Take coin sheet’s accent opens the blocked-action pop-up, not a toast', async ({ page }) => {
        await openStash(page, 'stash=1&coin=1');
        await openTake(page);
        const sheet = page.getByRole('dialog', { name: 'Take coin' });
        await sheet.getByRole('textbox', { name: 'Herons' }).fill('10');
        await page.context().setOffline(true);
        await expect(page.getByText('As it was when you were last online.')).toBeVisible();
        const go = sheet.getByRole('button', { name: 'Take 10 herons' });
        await go.click();
        const why = page.getByRole('dialog', { name: 'You’re offline' });
        await expect(why).toContainText('Taking from the stash needs the party’s latest, so it waits until you’re back.');
        await expect(why).toHaveClass(/dialog--sheet/);
        await expect(page.locator('.toast')).toHaveCount(0);
        await expect(sheet).toBeAttached();
        await expect(stashCoin(page)).toHaveText('40 herons, 12 bits');
        // The phone's sheet slides up (200 ms): measured once it has come to rest.
        await why.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
        const card = (await why.boundingBox())!;
        if (size.width >= 700) {
          // Beside the accent it came from (below it, else above), never over it.
          await expect(why).toHaveClass(/dialog--anchored/);
          const button = (await go.boundingBox())!;
          expect(card.y >= button.y + button.height - 0.5 || card.y + card.height <= button.y + 0.5).toBe(true);
        } else {
          expect(card.y + card.height).toBeCloseTo(size.height, 0);
        }
        await page.screenshot({ path: `test-results/layout-screens/stash-coin-take-offline-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
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

// Take from the party stash (K12; pk-2, pk-3; mockup pack/08 frames PK4b and PK7b, approved 2026-11-14, ap-6), in a
// real browser at 375 px and on a landscape tablet, light and dark. Purposes:
//   1. The stash's screen with Take on every row, a stack's "Take" sheet with a refusal under the row, and the toast
//      after a take that puts the taker over the limit: no sideways scrolling, every target at least 44 px, readable
//      text, no serious accessibility problem.
//   2. A long name on a stack of 999 wraps beside its Take, which stays on the screen, at least 44 px; on the sheet it
//      wraps inside the accent.
//   3. Offline, Take stays a button and a tap opens the blocked-action pop-up saying why it waits: under the button on
//      a tablet, from the foot on a phone (⚑ 7, re-ruled "A" 25 Nov).
//   4. The over-limit toast carries its warning on a line of its own under the words, with the warning sign, and Undo.
//   5. Offline with a stack's Take sheet already open (the network dropped while it was open), a tap on its accent opens
//      the same blocked-action pop-up as a row's Take, not a toast: beside the accent on a tablet, from the foot on a
//      phone, the Take sheet still open under it (Home Two's audit of #66, finding 1, picked by Francis 2026-11-26).
// The pictures it saves (deviceScaleFactor 2) are the as-built pictures beside PK4b and PK7b in the pull request.
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

async function openStash(page: Page) {
  await page.goto('/layout.html?as=player&stash=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’s pack' })).toBeAttached();
  await page.getByRole('button', { name: /^Party stash/ }).click();
  await expect(page.getByRole('heading', { name: 'Loose' })).toBeVisible();
}

const BEADS = 'Glass trade beads from the drowned market at the edge of the long fen';

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.name} ${scheme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, colorScheme: scheme });

      const scenes: { name: string; open: (page: Page) => Promise<void> }[] = [
        {
          name: 'stash-take-rows',
          open: async (page) => {
            const take = page.getByRole('button', { name: `Take ${BEADS}` });
            await expect(take).toBeVisible();
            const box = (await take.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(43.5);
            expect(box.x + box.width).toBeLessThanOrEqual(size.width);
          },
        },
        {
          name: 'stash-take-sheet',
          open: async (page) => {
            await page.getByRole('button', { name: `Take ${BEADS}` }).click();
            const sheet = page.getByRole('dialog', { name: 'Take' });
            await expect(sheet.getByText('The stash has 999.')).toBeVisible();
            await sheet.getByRole('textbox', { name: BEADS }).fill('1000');
            await sheet.getByRole('button', { name: 'Take' }).click();
            await expect(sheet.getByRole('alert')).toHaveText('The stash has 999.');
            await sheet.getByRole('textbox', { name: BEADS }).fill('2');
            const go = sheet.getByRole('button', { name: `Take ${BEADS} ×2` });
            await expect(go).toBeVisible();
            // The long name wraps inside the accent: nothing runs past its edge.
            expect(await go.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          },
        },
        {
          name: 'stash-take-one',
          open: async (page) => {
            await page.getByRole('button', { name: 'Take Silver ewer' }).click();
            await expect(page.locator('.toast')).toContainText(/^Wren of the Lantern Wardens took Silver ewer\. Load /);
            await expect(page.locator('.toast__warning')).toHaveCount(0);
          },
        },
        {
          name: 'stash-take-over',
          open: async (page) => {
            await page.getByRole('button', { name: 'Take Iron-bound reed chest' }).click();
            const toast = page.locator('.toast');
            await expect(toast).toContainText('Wren of the Lantern Wardens took Iron-bound reed chest.');
            const warning = toast.locator('.toast__warning');
            await expect(warning).toContainText(/^Over the limit: /);
            await expect(warning.locator('.warning-sign')).toBeVisible();
            // The warning is a line of its own, under the words.
            const words = (await toast.locator('.toast__text').boundingBox())!;
            expect((await warning.boundingBox())!.y).toBeGreaterThan(words.y + 4);
            await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
          },
        },
        {
          name: 'stash-take-offline',
          open: async (page) => {
            await page.context().setOffline(true);
            await expect(page.getByText('As it was when you were last online.')).toBeVisible();
            const take = page.getByRole('button', { name: 'Take Silver ewer' });
            await take.click();
            // ⚑ 7, re-ruled "A" 25 Nov: the blocked-action pop-up, under the button on a tablet, from the foot on a phone.
            const why = page.getByRole('dialog', { name: 'You’re offline' });
            await expect(why).toContainText('Taking from the stash needs the party’s latest, so it waits until you’re back.');
            await expect(why).toHaveClass(/dialog--sheet/);
            await expect(page.locator('.toast')).toHaveCount(0);
            await expect(page.getByRole('dialog', { name: 'Take' })).toHaveCount(0);
            // The phone's sheet slides up (200 ms): measured once it has come to rest.
            await why.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
            const card = (await why.boundingBox())!;
            if (size.width >= 700) {
              await expect(why).toHaveClass(/dialog--anchored/);
              const button = (await take.boundingBox())!;
              expect(card.y).toBeGreaterThanOrEqual(button.y + button.height);
            } else {
              expect(card.y + card.height).toBeCloseTo(size.height, 0);
            }
          },
        },
      ];
      it.fails('stash-take-sheet-offline: the open sheet’s accent opens the blocked-action pop-up, not a toast', async ({ page }) => {
        await openStash(page);
        await page.getByRole('button', { name: `Take ${BEADS}` }).click();
        const sheet = page.getByRole('dialog', { name: 'Take' });
        await sheet.getByRole('textbox', { name: BEADS }).fill('2');
        await page.context().setOffline(true);
        await expect(page.getByText('As it was when you were last online.')).toBeVisible();
        const go = sheet.getByRole('button', { name: `Take ${BEADS} ×2` });
        await go.click();
        const why = page.getByRole('dialog', { name: 'You’re offline' });
        await expect(why).toContainText('Taking from the stash needs the party’s latest, so it waits until you’re back.');
        await expect(why).toHaveClass(/dialog--sheet/);
        await expect(page.locator('.toast')).toHaveCount(0);
        await expect(sheet).toBeAttached();
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
        await page.screenshot({ path: `test-results/layout-screens/stash-take-sheet-offline-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      for (const scene of scenes) {
        test(`${scene.name}: no sideways scrolling, taps at least 44px, readable text, accessible`, async ({ page }) => {
          await openStash(page);
          await scene.open(page);
          await page.screenshot({ path: `test-results/layout-screens/${scene.name}-${size.width}-${scheme}.png` });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        });
      }
    });
  }
}

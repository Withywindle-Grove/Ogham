// New on the Pack tab (K20b of docs/plans/dec-6-the-whole-pack-tab.md; page 45's FD1, FD3, FD6, FD8, FD8b, FD9, FD9b,
// FD10, FD10b, FD11, FD11b, approved 2026-11-26; PK2, PK3 of page 08, approved 2026-11-14), in a real browser on the
// layout page (`?finds=…`: the GM's Add item on Wren, and `window.__findArrives` / `window.__gmUndoesFind` to add one or
// take it back while the page is open). What it checks, in plain words:
//   1. With one find, the card stands first on a phone (above the load) and heads the right column on a tablet; the new
//      row carries "New" and stands first under its group; no sideways scrolling, every target 44 px, readable text, no
//      serious accessibility problem, in light and dark.
//   2. A long name wraps and its "New" stays on the name's last line, never alone on a line of its own.
//   3. "Got it" takes away the card and every tag at once, with no toast; the rows stay.
//   4. A find that arrives while she is reading the list (its card growing above, its new row coming in at the head of
//      its group) does not move the row under her eye, the one in the middle of the screen (p45-19).
//   5. The GM's Undo before Got it: the row and its tag go, the card stays with the quiet line, and "Got it" stays
//      where it was (p45-25).
//   6. A sheet open about the thing the GM takes back closes by itself; a sheet about another thing stays (p45-26).
//   7. Offline, a tap on "Got it" writes nothing and shows the box under the card (FD9).
//   8. "and N more" brings the new rows into view and clears nothing (p45-16, p45-9).
//   9. A find onto a stack she carries: the card says "River pearls ×2, now 8" and the whole stack carries the tag (p45-22).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;

async function openPack(page: Page, finds: string, theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`/layout.html?as=player&coin=1&finds=${finds}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
}

const card = (page: Page) => page.locator('.find-card').first();
const gotIt = (page: Page) => page.getByRole('button', { name: /^Got it/ });
const row = (page: Page, name: string) => page.locator('.pack__item').filter({ has: page.locator('.pack__name', { hasText: name }) }).first();

for (const size of SIZES) {
  test.describe(`${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of ['light', 'dark'] as const) {
      // Purpose 1.
      test(`one find (${theme}): the card's place, the tag, and the screen's checks`, async ({ page }) => {
        await openPack(page, '1', theme);
        await expect(card(page)).toBeVisible();
        await expect(card(page).getByRole('heading', { name: 'New in your pack' })).toBeVisible();
        const ring = row(page, 'Bronze ring');
        await expect(ring.locator('.pack__new')).toHaveText('New');
        // First in its group.
        const group = page.locator('.pack__group').filter({ has: ring });
        await expect(group.locator('.pack__item').first()).toHaveText(/Bronze ring/);
        const c = (await card(page).boundingBox())!;
        const load = (await page.locator('.pack__load').first().boundingBox())!;
        const list = (await page.locator('.pack__list').boundingBox())!;
        if (size.name === 'phone') {
          // First on a phone: above the load and the lists.
          expect(c.y + c.height).toBeLessThanOrEqual(load.y);
        } else {
          // The head of the right column on a tablet: beside the list, above the load.
          expect(c.x).toBeGreaterThanOrEqual(list.x + list.width);
          expect(c.y + c.height).toBeLessThanOrEqual(load.y);
        }
        await page.screenshot({ path: `test-results/layout-screens/k20b-one-find-${theme}-${size.width}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }

    // Purpose 3.
    test('"Got it" takes the card and every tag away at once, with no toast', async ({ page }) => {
      await openPack(page, 'many');
      await expect(page.locator('.pack__new')).toHaveCount(6);
      await gotIt(page).click();
      await expect(page.locator('.find-card')).toHaveCount(0);
      await expect(page.locator('.pack__new')).toHaveCount(0);
      await expect(page.locator('.toast')).toHaveCount(0);
      await expect(row(page, 'Bronze ring')).toBeVisible();
    });

    // Purpose 5.
    test('the GM’s Undo before Got it: the row goes, the card keeps its quiet line, and Got it stays put', async ({ page }) => {
      await openPack(page, '1');
      await page.evaluate(() => (window as unknown as { __findArrives: (n: string) => Promise<void> }).__findArrives('Moon opals'));
      await expect(row(page, 'Moon opals')).toBeVisible();
      const before = (await gotIt(page).boundingBox())!;
      const cardBefore = (await card(page).boundingBox())!;
      expect(await page.evaluate(() => (window as unknown as { __gmUndoesFind: () => Promise<string> }).__gmUndoesFind())).toBe('ok');
      await expect(card(page).getByText('Your GM took back the Moon opals.')).toBeVisible();
      await expect(page.locator('.pack__name', { hasText: 'Moon opals' })).toHaveCount(0);
      const after = (await gotIt(page).boundingBox())!;
      const cardAfter = (await card(page).boundingBox())!;
      expect(Math.round(after.y - cardAfter.y)).toBe(Math.round(before.y - cardBefore.y));
      expect(Math.round(cardAfter.height)).toBe(Math.round(cardBefore.height));
      await gotIt(page).click();
      await expect(page.locator('.find-card')).toHaveCount(0);
    });

    // Purpose 6.
    test('a sheet about the thing taken back closes; a sheet about another thing stays', async ({ page }) => {
      await openPack(page, '1');
      await page.evaluate(() => (window as unknown as { __findArrives: (n: string) => Promise<void> }).__findArrives('Moon opals'));
      await row(page, 'Moon opals').locator('.pack__row-main').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __gmUndoesFind: () => Promise<string> }).__gmUndoesFind())).toBe('ok');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(card(page).getByText('Your GM took back the Moon opals.')).toBeVisible();
      // Another thing's sheet stays open when a find is taken back.
      await page.evaluate(() => (window as unknown as { __findArrives: (n: string) => Promise<void> }).__findArrives('Eel trap'));
      await expect(row(page, 'Eel trap')).toBeVisible();
      await row(page, 'Chalk').locator('.pack__row-main').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __gmUndoesFind: () => Promise<string> }).__gmUndoesFind())).toBe('ok');
      await expect(card(page).getByText('Your GM took back the Eel trap.')).toBeVisible();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    // Purpose 7.
    test('offline, Got it writes nothing and the box explains under the card', async ({ page, context }) => {
      await openPack(page, '1');
      await context.setOffline(true);
      await gotIt(page).click();
      await expect(page.getByText('You’re offline. Got it waits until you’re back.', { exact: false })).toBeVisible();
      await expect(card(page)).toBeVisible();
      await expect(row(page, 'Bronze ring').locator('.pack__new')).toBeVisible();
      await page.screenshot({ path: `test-results/layout-screens/k20b-offline-${size.width}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      await context.setOffline(false);
      await expect(page.getByText('You’re offline. Got it waits until you’re back.', { exact: false })).toHaveCount(0);
    });

    // Purpose 9.
    test('a find onto a stack: the whole stack carries the tag, and the card says what arrived and the new count', async ({ page }) => {
      await openPack(page, 'two');
      await expect(card(page).getByText(', now 8')).toBeVisible();
      await expect(row(page, 'River pearls').locator('.pack__new')).toBeVisible();
      await page.screenshot({ path: `test-results/layout-screens/k20b-stack-${size.width}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    // Purpose 8.
    test('"and N more" brings the new rows into view and clears nothing', async ({ page }) => {
      await openPack(page, 'many');
      await page.screenshot({ path: `test-results/layout-screens/k20b-many-${size.width}.png`, fullPage: true });
      await page.getByRole('button', { name: /^and \d+ more/ }).click();
      const firstNew = page.locator('.pack__list .pack__new').first();
      await expect(firstNew).toBeInViewport();
      await expect(page.locator('.pack__new')).toHaveCount(6);
      await expect(card(page)).toBeAttached();
    });
  });
}

test.describe('phone, 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // Purpose 2.
  test('a long name wraps and its "New" stays with its last word', async ({ page }) => {
    await openPack(page, 'long');
    const name = row(page, 'The Old Lantern').locator('.pack__name');
    const tag = name.locator('.pack__new');
    await expect(tag).toBeVisible();
    const lines = await name.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = [...range.getClientRects()].map((r) => Math.round(r.top));
      return [...new Set(tops)].length;
    });
    expect(lines).toBeGreaterThan(1);
    // The tag shares its line with the name's last word: the last word's box and the tag's overlap in height.
    const together = await name.evaluate((el) => {
      const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /Tides/.test(n.textContent ?? ''))!;
      const range = document.createRange();
      const at = text.textContent!.indexOf('Tides');
      range.setStart(text, at);
      range.setEnd(text, at + 5);
      const word = range.getBoundingClientRect();
      const tag = el.querySelector('.pack__new')!.getBoundingClientRect();
      return tag.top < word.bottom && tag.bottom > word.top;
    });
    expect(together).toBe(true);
    await page.screenshot({ path: 'test-results/layout-screens/k20b-long-name-375.png', fullPage: true });
  });

  // Purpose 4.
  test('a find that arrives while she reads the list does not move the row under her eye', async ({ page }) => {
    await openPack(page, '1');
    const chalk = row(page, 'Chalk');
    // The row under her eye: in the middle of the screen, the list scrolled down to it.
    await chalk.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const before = (await chalk.boundingBox())!;
    await page.evaluate(() => (window as unknown as { __findArrives: (n: string) => Promise<void> }).__findArrives('Moon opals'));
    await expect(card(page).getByText('Moon opals')).toBeAttached();
    await expect(row(page, 'Moon opals')).toBeAttached();
    const after = (await chalk.boundingBox())!;
    expect(Math.round(after.y)).toBe(Math.round(before.y));
  });
});

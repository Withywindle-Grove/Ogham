// The find card on the Player tab (K18c of docs/specs/scene-pack.md, piece E; page 51's 51-1 A and 51-2 A, approved
// 2026-11-28, l4-4, l4-5; page 45's FD1b and FD10b, approved 2026-11-26, p45-2, p45-19), in a real browser on the layout
// page (`?finds=1`: the GM has sent Wren a Bronze ring; `none`, nothing yet, with `window.__findArrives` to send one
// while the page is open; `&longName=1`, Wren's name made long). What it checks, in plain words:
//   1. On a phone the card stands above the head, even with a long name, and the name wraps whole under it; no sideways
//      scrolling, readable text, every target 44 px, no serious accessibility problem, in light and dark (51-1 A).
//   2. On a tablet the card comes first in the right column, then the notices box, then the column's first section
//      (Scores where the character has them; this one starts with Movement) (51-2 A).
//   3. On a tablet the left column does not move when the card arrives (p45-19).
//   4. On a phone, a card that arrives while she has scrolled down keeps the row under her eye where it was (p45-19);
//      at the very top it comes in where she sees it (FD10b).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 1180, height: 820 };

async function openPlayer(page: Page, finds: string, extra = '', theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`/layout.html?as=player&finds=${finds}${extra}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await expect(page.locator('.player-head')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const card = (page: Page) => page.locator('.find-card').first();
const arrives = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __findArrives: (n: string) => Promise<void> }).__findArrives(n), name);

test.describe('the find card on the Player tab (K18c)', () => {
  for (const theme of ['light', 'dark'] as const) {
    // Purpose 1.
    test(`on a phone stands above the head, with a long name (${theme})`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await openPlayer(page, '1', '&longName=1', theme);
      await expect(card(page)).toBeVisible();
      const box = (await card(page).boundingBox())!;
      const head = (await page.locator('.player-head').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(head.y);
      await expect(page.locator('.player-head').getByText('Wren Fenward of the Seven Drowned Cairns, called the Unbowed')).toBeVisible();
      await page.screenshot({ path: `test-results/layout-screens/k18c-phone-${theme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    // Purpose 2.
    test(`on a tablet comes first in the right column, then the notices box, then the rest (${theme})`, async ({ page }) => {
      await page.setViewportSize(TABLET);
      await openPlayer(page, '1', '', theme);
      await expect(card(page)).toBeVisible();
      const right = (await page.locator('.player__right').boundingBox())!;
      const box = (await card(page).boundingBox())!;
      const notices = (await page.locator('.player__right .player__notices').boundingBox())!;
      const scores = (await page.locator('.player__right .sheet__section').first().boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(right.x);
      expect(box.y + box.height).toBeLessThanOrEqual(notices.y);
      expect(notices.y + notices.height).toBeLessThanOrEqual(scores.y);
      await page.screenshot({ path: `test-results/layout-screens/k18c-tablet-${theme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }

  // Purpose 3.
  test('on a tablet the left column does not move when the card arrives', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await openPlayer(page, 'none');
    await expect(page.locator('.player__right .player__notices')).toBeVisible();
    const head = page.locator('.player-head');
    const before = (await head.boundingBox())!;
    await arrives(page, 'Bronze ring');
    await expect(card(page)).toBeVisible();
    expect(await head.boundingBox()).toEqual(before);
  });

  // Purpose 4.
  test('on a phone the row under her eye stays put when the card arrives; at the top the card comes in where she sees it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openPlayer(page, 'none');
    // At the very top: the card comes in above the head, which moves down for it.
    const head = page.locator('.player-head');
    const top = (await head.boundingBox())!;
    await arrives(page, 'Bronze ring');
    await expect(card(page)).toBeVisible();
    expect((await head.boundingBox())!.y).toBeGreaterThan(top.y);
    // Scrolled down: the next find grows the card, and the row in the middle of the screen keeps its place.
    await page.evaluate(() => window.scrollTo(0, 400));
    // The element in the middle of the screen: the row her eye is on.
    await page.evaluate(() => document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.setAttribute('data-eye', ''));
    const target = page.locator('[data-eye]');
    const was = (await target.boundingBox())!;
    await arrives(page, 'Silver key');
    await expect(card(page).getByText('Silver key')).toBeVisible();
    const now = (await target.boundingBox())!;
    expect(Math.abs(now.y - was.y)).toBeLessThanOrEqual(1);
  });
});

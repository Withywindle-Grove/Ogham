// The player's In stock answer and Buy it's toast (TC13 piece C; docs/specs/town-ask-buy.md, "Piece C"; frames TW4a step
// 3 and PK10b), in a real browser on the layout page's invented coin (`?as=player&coin=1&bought=1|long`: the GM's "In
// stock" waiting for Wren of the Lantern Wardens' reply, a reed rope at 2 herons, or a thing named at length at 999
// herons). Each test saves its screen under test-results/layout-screens/buy-*.png, to set beside TW4a and PK10b. What it
// checks, in plain words:
//   * the answer card: "For you", "In stock: <thing>" (wrapping, never cut), "<price>. At <place>.", Buy it as the card's
//     one accent and Leave it, each at least 44 px with at least 8 px between;
//   * after Buy it, the toast says the cost is not spent yet, and keeps "Spend <amount>" and Undo whole: both on the
//     screen, inside the toast, at least 44 px tall and apart, with a long name and 999 herons, under 600 px and from it;
//   * Spend opens the Spend sheet over the Scene with the amount and What for filled in, and one accent;
//   * nothing scrolls sideways, and axe finds no serious problem, at 375 px and tablet width, light and dark, and at
//     375 px with Larger text.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const LONG = 'A bundle of tallow candles wrapped in oilcloth for the Lantern Warden';

async function openScene(page: Page, bought: '1' | 'long', larger = false) {
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=player&coin=1&bought=${bought}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(answer(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const answer = (page: Page) => page.getByRole('article', { name: "The GM's answer" });

/** A built picture, once the faces have loaded and anything sliding in has stopped (the toast's bar runs on). */
async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const settling = document.getAnimations().filter((a) => !(a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && a.effect.target.closest('.toast')));
    await Promise.all(settling.map((a) => a.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: `test-results/layout-screens/buy-${name}.png` });
}

/** Buy it, then the toast's two buttons measured against the toast and the screen. */
async function buy(page: Page, spend: string) {
  await answer(page).getByRole('button', { name: 'Buy it' }).click();
  const toast = page.locator('.toast');
  await expect(toast.getByRole('button', { name: spend })).toBeVisible();
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
  return toast.evaluate((el, label) => {
    const box = (e: Element) => e.getBoundingClientRect();
    const buttons = [...el.querySelectorAll('button')];
    const spendButton = buttons.find((b) => b.textContent?.trim() === label)!;
    const undo = buttons.find((b) => b.textContent?.trim() === 'Undo')!;
    const [t, s, u] = [box(el), box(spendButton), box(undo)];
    return {
      toast: { left: t.left, right: t.right, width: t.width },
      spend: { left: s.left, right: s.right, top: s.top, bottom: s.bottom, height: s.height, scrollWidth: spendButton.scrollWidth, clientWidth: spendButton.clientWidth },
      undo: { left: u.left, right: u.right, top: u.top, bottom: u.bottom, height: u.height },
      screen: document.documentElement.clientWidth,
    };
  }, spend);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`Buy it (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose (TW4a step 3): the card's words and its two buttons, Buy it the one accent, 44 px and 8 px apart.
      test('the answer card: For you, In stock, the price and the place, Buy it and Leave it', async ({ page }) => {
        await openScene(page, '1');
        const card = answer(page);
        await expect(card.getByText('For you')).toBeVisible();
        await expect(card.getByText('In stock: Reed rope')).toBeVisible();
        await expect(card.getByText('2 herons. At The Reed Market.')).toBeVisible();
        await expect(card.locator('.button-primary')).toHaveCount(1);
        const buyIt = (await card.getByRole('button', { name: 'Buy it' }).boundingBox())!;
        const leave = (await card.getByRole('button', { name: 'Leave it' }).boundingBox())!;
        expect(buyIt.height).toBeGreaterThanOrEqual(44);
        expect(leave.height).toBeGreaterThanOrEqual(44);
        expect(leave.x - (buyIt.x + buyIt.width)).toBeGreaterThanOrEqual(8);
        await shot(page, `card-${size.width}-${scheme}`);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PK10b, tr-13): a long name and 999 herons: the heading wraps, and the toast keeps Spend and Undo whole.
      test('a long name at 999 herons: the card wraps, the toast keeps Spend 999 herons and Undo whole', async ({ page }) => {
        await openScene(page, 'long');
        const heading = answer(page).getByText(`In stock: ${LONG}`);
        await expect(heading).toBeVisible();
        const lines = await heading.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
        if (size.width < 600) expect(lines).toBeGreaterThan(1);
        await expect(answer(page).getByText('999 herons. At The Reed Market.')).toBeVisible();
        await shot(page, `card-long-${size.width}-${scheme}`);
        const m = await buy(page, 'Spend 999 herons');
        await expect(page.locator('.toast__text')).toHaveText(`Wren of the Lantern Wardens bought ${LONG}. Its cost, 999 herons, is not spent yet.`);
        // Whole: on the screen and inside the toast, its label not cut.
        expect(m.toast.left).toBeGreaterThanOrEqual(0);
        expect(m.toast.right).toBeLessThanOrEqual(m.screen);
        for (const b of [m.spend, m.undo]) {
          expect(b.left).toBeGreaterThanOrEqual(m.toast.left);
          expect(b.right).toBeLessThanOrEqual(m.toast.right);
          expect(b.height).toBeGreaterThanOrEqual(44);
        }
        expect(m.spend.scrollWidth).toBeLessThanOrEqual(m.spend.clientWidth);
        // Spend first, Undo after it, with room between (on one line, or Undo under it).
        const apart = m.undo.top >= m.spend.bottom ? m.undo.top - m.spend.bottom : m.undo.left - m.spend.right;
        expect(apart).toBeGreaterThanOrEqual(8);
        await shot(page, `toast-long-${size.width}-${scheme}`);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PK10b, sb5-5): Spend opens the Spend sheet over the Scene, the amount and What for filled in, one accent.
      test('Spend 2 herons opens the Spend sheet filled in', async ({ page }) => {
        await openScene(page, '1');
        await buy(page, 'Spend 2 herons');
        await page.locator('.toast').getByRole('button', { name: 'Spend 2 herons' }).click();
        const sheet = page.getByRole('dialog', { name: 'Spend' });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByRole('textbox', { name: 'Herons' })).toHaveValue('2');
        await expect(sheet.getByLabel('What for')).toHaveValue('Reed rope');
        await expect(sheet.locator('.button-primary')).toHaveCount(1);
        await expect(sheet.getByRole('button', { name: 'Spend 2 herons' })).toBeVisible();
        await shot(page, `spend-${size.width}-${scheme}`);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

// Purpose: with Larger text at 375 px, the card's buttons and the toast's Spend and Undo stay whole and on the screen.
test.describe('Buy it with Larger text (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('the long card and its toast', async ({ page }) => {
    await openScene(page, 'long', true);
    const m = await buy(page, 'Spend 999 herons');
    expect(m.toast.right).toBeLessThanOrEqual(m.screen);
    for (const b of [m.spend, m.undo]) {
      expect(b.left).toBeGreaterThanOrEqual(m.toast.left);
      expect(b.right).toBeLessThanOrEqual(m.toast.right);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    expect(m.spend.scrollWidth).toBeLessThanOrEqual(m.spend.clientWidth);
    await shot(page, 'toast-long-375-larger');
    expect(await layoutProblems(page)).toEqual([]);
  });
});

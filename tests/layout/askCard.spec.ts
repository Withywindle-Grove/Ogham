// The GM's ask card with the toggle (TC13 piece B; docs/specs/town-ask-buy.md, "Piece B"; ap-14, frame TW8g; Price…,
// frame TW4c), in a real browser on the layout page's invented harbour (`?placePage=spot&session=running&asks=1|long`:
// Wren of the Lantern Wardens' asks waiting, each on "?": the eel trap with its chance, a reed rope that reads "Always",
// a spyglass not on the list, and with `long` a thing named at length). What it checks, in plain words:
//   * the card's heading wraps; "Price…", "Stocked?" and the toggle keep one line, right-justified, the toggle last;
//   * each target is at least 44 px with at least 8 px between Price… and the toggle, and the toggle's focus ring is
//     never painted over by its neighbours;
//   * the card takes no accent (Move on keeps it), and shows no Hit, Miss or note;
//   * the chance as the stock table writes it (the die's glyph and "3-in-6"), "Always", or the place only;
//   * the asks waiting stack as rows without overlap;
//   * Price… opens its pop-up with Send price as its one accent;
//   * nothing scrolls sideways, and axe finds no serious problem, at 375 px and tablet width, light and dark, and at
//     375 px with Larger text.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, asks: '1' | 'long', larger = false) {
  // mn-1: the campaign menu folded to its rail, as the stored choice says (as waitingPanel.spec.ts).
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=gm&placePage=spot&session=running&asks=${asks}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.place-page__name')).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await expect(panel(page).locator('.waiting-open .request--gm')).toBeVisible();
}

const panel = (page: Page) => page.getByRole('region', { name: 'Waiting for you' });
const card = (page: Page) => panel(page).locator('.waiting-open');

/** The open card's answer row, measured: each part's box, the card's content edge, and the heading's lines. */
async function measure(page: Page) {
  return card(page).evaluate((open) => {
    const li = open.querySelector('.request--gm')!;
    const row = li.querySelector('.request__stocked')!;
    const box = (el: Element) => el.getBoundingClientRect();
    const price = box(row.querySelector('.stacked-button')!);
    const label = box(row.querySelector('.request__stocked-label')!);
    const toggle = box(row.querySelector('.stock-toggle')!);
    const halves = [...row.querySelectorAll('.stock-toggle__half')].map(box);
    const heading = li.querySelector('.pack__name')!;
    const style = getComputedStyle(li);
    return {
      tops: [price, label, toggle].map((b) => b.top + b.height / 2),
      order: [price.left, label.left, toggle.left],
      rightGap: box(li).right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth) - toggle.right,
      // Never past the card's left edge either: a row too wide for its card would run out at the left.
      leftRoom: price.left - (box(li).left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth)),
      priceToToggle: halves[0]!.left - price.right,
      halfHeights: halves.map((h) => h.height),
      halfWidths: halves.map((h) => h.width),
      halfGap: halves[1]!.left - halves[0]!.right,
      priceHeight: price.height,
      headingLines: Math.round(box(heading).height / parseFloat(getComputedStyle(heading).lineHeight)),
      accents: li.querySelectorAll('.button-primary').length,
    };
  });
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`The ask card (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose (TW8g): the eel trap's card: the heading, "At 3 The Reed Market." with the die's glyph and "3-in-6";
      // Price…, "Stocked?" and the toggle on one line, right-justified, the toggle last; 44 px targets, 8 px apart; no
      // accent, no Hit or Miss, no note; the rows under it stack without overlap.
      test('the card with a chance', async ({ page }) => {
        await openScene(page, '1');
        const open = card(page);
        await expect(open.getByText('Wren of the Lantern Wardens asks for: Eel trap')).toBeVisible();
        await expect(open.locator('.stock-chance')).toHaveText('3-in-6');
        await expect(open.locator('.stock-chance .die-glyph[data-die="6"]')).toBeVisible();
        await expect(open.getByRole('radiogroup', { name: 'Eel trap, stocked today: not decided' })).toBeVisible();
        for (const gone of ['Hit', 'Miss', 'In stock', 'Not here']) await expect(open.getByRole('button', { name: gone, exact: true })).toHaveCount(0);
        await expect(open.getByRole('textbox')).toHaveCount(0);
        const m = await measure(page);
        for (const t of m.tops) expect(Math.abs(t - m.tops[0]!)).toBeLessThanOrEqual(2);
        expect(m.order).toEqual([...m.order].sort((a, b) => a - b));
        expect(Math.abs(m.rightGap)).toBeLessThanOrEqual(1);
        expect(m.leftRoom).toBeGreaterThanOrEqual(-1);
        expect(m.priceToToggle).toBeGreaterThanOrEqual(8);
        expect(m.halfGap).toBeGreaterThanOrEqual(8);
        for (const h of [...m.halfHeights, ...m.halfWidths, m.priceHeight]) expect(h).toBeGreaterThanOrEqual(44);
        expect(m.accents).toBe(0);
        await expect(page.getByRole('button', { name: 'Move on' })).toHaveClass(/button-primary/);
        // The rows waiting under the card never overlap it or each other.
        const boxes = await panel(page).locator('.waiting-open, .waiting-row').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })));
        expect(boxes.length).toBe(3);
        for (let i = 1; i < boxes.length; i += 1) expect(boxes[i]!.top).toBeGreaterThanOrEqual(boxes[i - 1]!.bottom - 1);
        await panel(page).scrollIntoViewIfNeeded();
        await panel(page).screenshot({ path: `test-results/layout-screens/ask-card-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (TW8g): a thing that reads "Always" says so with no glyph; one not on the list shows its place only.
      test('"Always" and no chance', async ({ page }) => {
        await openScene(page, '1');
        await panel(page).getByRole('button', { name: /^Open: .*asks for: Reed rope$/ }).click();
        await expect(card(page).locator('.stock-chance')).toHaveText('Always');
        await expect(card(page).locator('.die-glyph')).toHaveCount(0);
        await panel(page).getByRole('button', { name: /^Open: .*asks for: A spyglass$/ }).click();
        await expect(card(page).getByText('At 3 The Reed Market.', { exact: true })).toBeVisible();
        await expect(card(page).locator('.stock-chance')).toHaveCount(0);
        await panel(page).screenshot({ path: `test-results/layout-screens/ask-card-no-chance-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose: a thing named at length wraps its heading; the answer row still keeps one line, right-justified.
      test('a long name', async ({ page }) => {
        await openScene(page, 'long');
        await panel(page).getByRole('button', { name: /^Open: .*tallow candles/ }).click();
        const m = await measure(page);
        expect(m.headingLines).toBeGreaterThan(1);
        for (const t of m.tops) expect(Math.abs(t - m.tops[0]!)).toBeLessThanOrEqual(2);
        expect(Math.abs(m.rightGap)).toBeLessThanOrEqual(1);
        expect(m.leftRoom).toBeGreaterThanOrEqual(-1);
        await panel(page).screenshot({ path: `test-results/layout-screens/ask-card-long-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: the toggle's focus ring, drawn round a half, is never painted over by "Stocked?" or Price….
      test("the toggle's focus ring is clear", async ({ page }) => {
        await openScene(page, '1');
        const half = card(page).getByRole('radio', { name: 'Not in stock' });
        await half.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowLeft');
        await expect(half).toBeFocused();
        const clear = await half.evaluate((el) => {
          const ring = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const reach = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset));
          const row = el.closest('.request__stocked')!;
          const others = [...row.children].filter((c) => !c.contains(el)).map((c) => c.getBoundingClientRect());
          return style.outlineStyle !== 'none' && others.every((o) => o.right <= ring.left - reach || o.left >= ring.right + reach);
        });
        expect(clear).toBe(true);
      });

      // Purpose (TW4c): Price… opens its pop-up: the pack's price, "Your price, in words", Send price its one accent.
      test('Price… opens its pop-up', async ({ page }) => {
        await openScene(page, '1');
        await card(page).getByRole('button', { name: 'Price…' }).click();
        const pop = page.getByRole('dialog', { name: 'Wren of the Lantern Wardens asks for: Eel trap' });
        await expect(pop).toBeVisible();
        await expect(pop.getByText("The pack's price: 5 herons")).toBeVisible();
        await expect(pop.getByRole('textbox', { name: 'Your price, in words' })).toBeVisible();
        await expect(pop.locator('.button-primary')).toHaveCount(1);
        await pop.getByRole('button', { name: 'Send price' }).click();
        await expect(pop.getByRole('alert')).toHaveText('Type the price, such as "12 gp".');
        await page.waitForTimeout(400);
        await page.screenshot({ path: `test-results/layout-screens/ask-card-price-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      });
    });
  }
}

// Purpose: at 375 px with Larger text the heading wraps and the answer row still keeps one line inside the card.
test.describe('The ask card (375 px, Larger text)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('one line at Larger text', async ({ page }) => {
    await openScene(page, 'long', true);
    for (const name of [/asks for: Eel trap$/, /tallow candles/]) {
      if (!(await card(page).getByText(name).count())) await panel(page).getByRole('button', { name: new RegExp(`^Open: .*${name.source}`) }).click();
      const m = await measure(page);
      for (const t of m.tops) expect(Math.abs(t - m.tops[0]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(m.rightGap)).toBeLessThanOrEqual(1);
      expect(m.leftRoom).toBeGreaterThanOrEqual(-1);
      expect(m.priceToToggle).toBeGreaterThanOrEqual(8);
    }
    await panel(page).screenshot({ path: 'test-results/layout-screens/ask-card-375-larger.png' });
    expect(await layoutProblems(page)).toEqual([]);
    expect(await accessibilityProblems(page)).toEqual([]);
  });
});

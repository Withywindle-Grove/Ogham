// A player's rule buttons on the players' page (December dec-7 piece 3; rp-10 held "until this page": plan
// dec-9-the-players-scene P1; PL1 and Francis's fix of 2026-11-20 put them at the card's top right), in a real browser
// on the layout page's invented harbour (`?placeRules=1`: two open rules with buttons, one with long words).
// What it checks, in plain words:
//   * the buttons sit at the RIGHT of the place's card, over its description, on a phone and a tablet: beside the
//     name where they fit, else on a line of their own under it (as here, with a button of long words);
//   * a long rule's button wraps between words inside the card and keeps a 44 px target, with no sideways scroll;
//   * two buttons at once sit in a row that wraps, 8 px apart;
//   * the splash (pf-12e's icon button, dec-7 piece 2) is the icon alone, square, as tall as a one-line words button,
//     and wrapped words keep the same air above and below.
import { expect, test, type Page } from '@playwright/test';

const campaignRow = (page: Page) => page.getByRole('button', { name: /The Drowned Marches/ });

async function placeLine(page: Page) {
  await page.goto('/layout.html?as=player&placeRules=1');
  await campaignRow(page).click();
  const scene = page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' });
  if (await scene.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await scene.click();
  const first = page.getByRole('button', { name: 'Someone fell in: Falling into the harbour' });
  await first.waitFor();
  await first.scrollIntoViewIfNeeded();
  return {
    line: page.getByRole('region', { name: 'Where you are' }),
    first,
    second: page.getByRole('button', { name: 'Someone is swimming for the breakwater at the turn of the tide: Rowing and swimming' }),
  };
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  test.describe(`a player's rule buttons (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    // Purpose (PL1; Francis's fix, 2026-11-20; ap-16's rule for a head that doesn't fit): the buttons stand at the
    // right of the place's card, not above its name and over its description; a button of long words is never
    // squeezed beside the name: it wraps between words, no taller than its words need.
    test('sit at the right over the description, in a row that wraps 8 px apart, each at least 44 px tall', async ({ page }) => {
      const { line, first, second } = await placeLine(page);
      const description = line.getByText('Black piles, a mooring ring, weed to the waterline.');
      const name = line.getByRole('heading');
      const [d, a, b, l, n] = await Promise.all([description.boundingBox(), first.boundingBox(), second.boundingBox(), line.boundingBox(), name.boundingBox()]);
      if (!d || !a || !b || !l || !n) throw new Error('not drawn');
      // At the right of the card, not above the name, and over the description.
      expect(Math.abs(a.x + a.width - (l.x + l.width))).toBeLessThanOrEqual(1);
      expect(a.y).toBeGreaterThanOrEqual(n.y - 1);
      expect(Math.max(a.y + a.height, b.y + b.height)).toBeLessThanOrEqual(d.y + 1);
      // Each a 44 px target, inside the card.
      for (const box of [a, b]) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(l.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(l.x + l.width + 1);
      }
      // Two at once: beside each other 8 px apart, or wrapped under with the same 8 px between rows, both ending at
      // the card's right.
      const sameRow = Math.abs(a.y - b.y) < 1;
      if (sameRow) expect(Math.round(Math.abs(b.x - (a.x + a.width)))).toBe(8);
      else {
        expect(Math.round(b.y - (a.y + a.height))).toBe(8);
        expect(Math.abs(b.x + b.width - (a.x + a.width))).toBeLessThanOrEqual(1);
      }
      // The long words wrap between words, never inside one: the button is no narrower than its longest word.
      expect(await second.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const lines = await second.evaluate((el) => Math.round((el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingTop) * 2) / parseFloat(getComputedStyle(el).lineHeight)));
      expect(lines).toBeLessThanOrEqual(4);
      // Nothing scrolls sideways.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    // Purpose (dec-7 piece 2; mc-49, mc-49a): the splash is the icon alone, square and as tall as a one-line words
    // button, with no words on screen; the words button's air above and below its words is the same however many lines
    // they wrap to (the lead's nit on #726).
    test('the splash is an icon alone, square, as tall as a one-line words button; wrapped words keep the same air', async ({ page }) => {
      const { first, second } = await placeLine(page);
      const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
      if (!a || !b) throw new Error('not drawn');
      expect(Math.abs(a.width - a.height)).toBeLessThanOrEqual(1);
      expect(a.height).toBeGreaterThanOrEqual(44);
      expect((await first.innerText()).trim()).toBe('');
      expect(await first.locator('svg').getAttribute('viewBox')).toBe('0 0 512 512');
      const air = await second.evaluate((el) => {
        const s = getComputedStyle(el);
        return { top: parseFloat(s.paddingTop), bottom: parseFloat(s.paddingBottom), line: parseFloat(s.lineHeight), edges: parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth) };
      });
      expect(Math.abs(air.top - air.bottom)).toBeLessThan(0.5);
      // One line of words in that air is exactly the icon button's height.
      expect(Math.abs(air.top + air.bottom + air.line + air.edges - a.height)).toBeLessThanOrEqual(1);
      // Wrapped (on a phone), the button grows by whole lines and keeps its air.
      if (b.height > a.height + 1) expect(Math.abs((b.height - a.height) % air.line)).toBeLessThanOrEqual(1);
    });
  });
}

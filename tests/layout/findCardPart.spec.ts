// The find card as a part (K18b of docs/plans/dec-6-the-whole-pack-tab.md; page 45, approved 2026-11-26), in a real
// browser on the gallery's `find-card` section. What it checks, in plain words:
//   * every target on the cards is at least 44 px, and "and N more" stands 8 px above "Got it";
//   * at 375 px nothing on the messy cards is cut or runs past the card;
//   * a one-thing card's "Got it" stands beside its line, and keeps its width while a long coin wraps beside it;
//   * when the GM takes a find back, the card is the same height and "Got it" in the same place as before (p45-25),
//     both where the line was one row and where it carried its own giver and time, and on a card of one thing, which
//     keeps its giver and time under the head once its thing is taken back (FD11b's drawing fix 2).
// The whole gallery's layout and accessibility checks are gallery.spec.ts's. K20b adds tests/layout/findCard.spec.ts
// for the card on the Pack tab.
import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, caption: string) =>
  page.locator('#find-card .gallery__specimen').filter({ has: page.getByText(caption, { exact: true }) }).locator('.find-card').first();

async function box(page: Page, caption: string) {
  const c = card(page, caption);
  await expect(c).toBeVisible();
  const outer = (await c.boundingBox())!;
  const got = (await c.getByRole('button', { name: /^Got it/ }).boundingBox())!;
  return { height: outer.height, gotTop: got.y - outer.y, gotLeft: got.x - outer.x };
}

const BEFORE_AFTER = [
  ['Two finds, before the GM’s Undo (FD11 A)', 'One taken back of two (FD11 B, p45-25): its line quiet in its place; the card’s height holds'],
  ['Two finds, before the GM’s Undo (FD11 A)', 'Both taken back (FD11 C, F8): the card stays until “Got it”'],
  ['Two givers, before the GM’s Undo: each line says its own', 'Two givers, the ring taken back: its quiet line keeps the room its giver’s line took'],
] as const;
// FD11b's drawing fix 2: a card of one thing keeps its giver and time under the head once its thing is taken back.
const ONE_BEFORE_AFTER = [
  ['One thing (FD1, p45-14): “Got it” beside its line', 'One thing, taken back (FD11b B, fix 2): its giver and time under the head'],
  ['Coin alone (FD4b A): “New in your coin”', 'Coin alone, taken back (F8): no “the”; its giver and time under the head'],
] as const;

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`the find card (${size.name}, ${theme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test.beforeEach(async ({ page }) => {
        await page.goto(`/gallery.html?theme=${theme}`);
        await page.locator('#find-card').scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
      });

      // Purpose: every button on the find cards is at least 44 px each way, and "and N more" is 8 px above "Got it".
      test('44 px targets, 8 px between "and N more" and "Got it"', async ({ page }) => {
        for (const button of await page.locator('#find-card .find-card button').all()) {
          const b = (await button.boundingBox())!;
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.width).toBeGreaterThanOrEqual(44);
        }
        const five = card(page, 'Five (FD3b C): the head counts, three lines and “and 2 more”');
        const more = (await five.getByRole('button', { name: /^and 2 more/ }).boundingBox())!;
        const got = (await five.getByRole('button', { name: /^Got it/ }).boundingBox())!;
        expect(Math.round(got.y - (more.y + more.height))).toBe(8);
      });

      // Purpose: nothing on any card is cut or runs past its edge: no part is wider than the card's inside, and no text
      // overflows its box (the messy cards at 375 px most of all).
      test('nothing cut, nothing past the card', async ({ page }) => {
        const problems = await page.locator('#find-card .find-card').evaluateAll((cards) =>
          cards.flatMap((c) => {
            const edge = c.getBoundingClientRect();
            return [...c.querySelectorAll<HTMLElement>('*')]
              .filter((el) => getComputedStyle(el).visibility !== 'hidden')
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && (r.left < edge.left - 0.5 || r.right > edge.right + 0.5 || el.scrollWidth > el.clientWidth + 1);
              })
              .map((el) => `${el.className}: ${el.textContent?.slice(0, 40)}`);
          }),
        );
        expect(problems).toEqual([]);
      });

      // Purpose: on a card of one thing "Got it" stands beside the line, centred on it (p45-14; FD3c C, FD4b B), and a
      // coin at its cap wraps beside it while the button keeps its width.
      test('"Got it" beside a one-thing card\'s line', async ({ page }) => {
        for (const caption of [
          'One thing (FD1, p45-14): “Got it” beside its line',
          'Coin at its cap, two coins on one line (FD4b B): it wraps beside “Got it”',
          'Onto a stack, messy (FD3c C): a long name, ×999 onto 999',
        ]) {
          const c = card(page, caption);
          const line = (await c.locator('.find-card__line').boundingBox())!;
          const got = (await c.getByRole('button', { name: /^Got it/ }).boundingBox())!;
          expect(got.x).toBeGreaterThanOrEqual(line.x + line.width);
          expect(Math.abs(got.y + got.height / 2 - (line.y + line.height / 2)), caption).toBeLessThan(1);
        }
        const plain = (await card(page, 'One thing (FD1, p45-14): “Got it” beside its line').getByRole('button', { name: /^Got it/ }).boundingBox())!;
        const capped = (await card(page, 'Coin at its cap, two coins on one line (FD4b B): it wraps beside “Got it”').getByRole('button', { name: /^Got it/ }).boundingBox())!;
        expect(Math.abs(capped.width - plain.width)).toBeLessThan(1);
      });

      // Purpose (p45-25): when the GM takes a find back the card keeps its height and "Got it" its place, so nothing
      // moves under the player's finger; where the line carried its own giver and time the quiet line holds that room.
      test('the card keeps its height and "Got it" its place when a line turns quiet', async ({ page }) => {
        for (const [before, after] of BEFORE_AFTER) {
          const a = await box(page, before);
          const b = await box(page, after);
          expect(Math.abs(b.height - a.height), `${after}: height`).toBeLessThan(1);
          expect(Math.abs(b.gotTop - a.gotTop), `${after}: "Got it" top`).toBeLessThan(1);
          expect(Math.abs(b.gotLeft - a.gotLeft), `${after}: "Got it" left`).toBeLessThan(1);
        }
      });

      // Purpose (FD11b's drawing fix 2): a card of one thing taken back keeps its giver and time, and holds its height and
      // "Got it"'s place where the quiet words fit one row (a tablet). At 375 px they wrap to two rows beside "Got it",
      // as FD11b B draws them, so the card grows by that one row and no more (the PR's ⚑, with K18b's ⚑ 1).
      test('a card of one thing taken back keeps its giver and time, and its height where its words fit', async ({ page }) => {
        for (const [before, taken] of ONE_BEFORE_AFTER) {
          const after = card(page, taken);
          await expect(after.locator('.find-card__quiet:visible')).toHaveText(['From your GM, just now.']);
          const a = await box(page, before);
          const b = await box(page, taken);
          const row = await after.locator('.find-card__back').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
          const grown = size.width >= 1024 ? 1 : row + 1;
          expect(b.height - a.height, `${taken}: height`).toBeLessThan(grown);
          expect(b.height - a.height, `${taken}: height`).toBeGreaterThan(-1);
          expect(Math.abs(b.gotLeft - a.gotLeft), `${taken}: "Got it" left`).toBeLessThan(1);
          expect(Math.abs(b.gotTop - a.gotTop), `${taken}: "Got it" top`).toBeLessThan(grown / 2 + 0.5);
        }
      });
    });
  }
}

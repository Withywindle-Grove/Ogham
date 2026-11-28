// A town's GM sections set out like the book (pf-18b; page 22, approved 2026-11-18, pf-18c), in a real browser on the
// layout page's invented river town (`?townSections=1`: a section in blocks with a very long list item, a section that
// is one box with a numbered list, a plain-string section, one whose blocks the app can't read, and an empty one). Only
// what an opened fold holds is this piece's; the fold row is the app's as built. What it checks, in plain words:
//   * an opened section in blocks shows the book's sub-heading, its list (the long item wraps inside the card), its
//     bold lead-in and paragraph; a boxed section keeps the box's border, inside the card;
//   * a plain-string section reads paragraph by paragraph, with the same gap between paragraphs as a section in blocks
//     (Francis's fix 1, 2026-11-18);
//   * a section with nothing the app can read keeps its heading and says so in one muted line, at 14 px or more; an
//     empty section keeps its heading and opens to nothing (fix 2);
//   * each opened fold's chevron is drawn on screen, unclipped, overhanging the card's left edge by no more than the
//     page's side margin, and the saved picture takes in that margin so the whole row shows (fix 3);
//   * nothing scrolls sideways and axe finds no serious problem in About the town, at 375 and 1024 px, light and dark.
// It saves a picture of About the town, every section opened, in test-results/layout-screens (CI keeps them as the
// layout-screens artifact) for a person to set against page 22; not compared pixel by pixel.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('not drawn');
  return b;
};

/** The GM's town page with every GM section opened; returns About the town and each fold. */
async function openedSections(page: Page) {
  await page.goto('/layout.html?as=gm&townSections=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  const about = page.locator('.place-facts__about');
  await about.getByRole('heading', { name: 'About the town' }).waitFor();
  const fold = (name: string) => about.locator('details', { has: page.getByText(name, { exact: true }) });
  const folds = { blocks: fold('The Eel and Lantern'), boxed: fold('The ferry families'), plain: fold('A brewing trouble'), empty: fold('Older notes'), unwritten: fold('Still to write') };
  for (const f of Object.values(folds)) {
    await f.locator('summary').click();
    await expect(f).toHaveAttribute('open', '');
  }
  await about.scrollIntoViewIfNeeded();
  return { about, ...folds };
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`a town's GM sections in blocks (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: an opened section in blocks draws the book's look inside the card (the long list item wraps), a boxed
      // section keeps its border, a plain one reads as paragraphs with the blocks' gap, an unreadable one keeps its
      // heading with one muted line, an empty one opens to nothing, and an opened fold's chevron is whole on screen; the
      // page passes the layout and accessibility checks.
      test('opened sections: blocks, a box, plain words, none and empty', async ({ page }) => {
        const { about, blocks, boxed, plain, empty, unwritten } = await openedSections(page);
        const card = await box(about);

        await expect(blocks.getByRole('heading', { name: 'What the house offers' })).toBeVisible();
        await expect(blocks.locator('strong', { hasText: 'The keeper.' })).toBeVisible();
        const long = await box(blocks.getByRole('listitem').filter({ hasText: 'A boat to hire' }));
        const short = await box(blocks.getByRole('listitem').filter({ hasText: 'Hot eel stew' }));
        expect(long.height).toBeGreaterThan(short.height * 1.5);
        expect(long.x + long.width).toBeLessThanOrEqual(card.x + card.width + 1);

        const aside = boxed.locator('.rule-text__box');
        const edge = await aside.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
        expect(edge).toBeGreaterThan(0);
        const asideBox = await box(aside);
        expect(asideBox.x).toBeGreaterThanOrEqual(card.x - 1);
        expect(asideBox.x + asideBox.width).toBeLessThanOrEqual(card.x + card.width + 1);
        await expect(boxed.locator('ol > li')).toHaveCount(4);

        // Fix 1: a plain section's two paragraphs sit as far apart as two paragraphs inside a section in blocks.
        const plainParagraphs = plain.locator('.rule-text > .rule-text__p');
        await expect(plainParagraphs).toHaveText([/^Halewyn owes the ferrymen/, /^If the party lodges/]);
        const gapBetween = async (first: Locator, second: Locator) => {
          const [a, b] = [await box(first), await box(second)];
          return b.y - (a.y + a.height);
        };
        const plainGap = await gapBetween(plainParagraphs.nth(0), plainParagraphs.nth(1));
        const blockGap = await gapBetween(blocks.locator('.rule-text__p', { hasText: 'The keeper.' }), blocks.locator('.rule-text__p', { hasText: 'Anyone asking' }));
        expect(plainGap).toBeGreaterThan(0);
        expect(Math.abs(plainGap - blockGap)).toBeLessThanOrEqual(0.5);

        const none = empty.getByText('The pack gives no words for this section.');
        await expect(none).toBeVisible();
        expect(await none.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
        await expect(about.getByText(/\[\[|"words"|\{/)).toHaveCount(0);

        // Fix 2: an empty section, opened, holds its heading row and nothing else.
        expect(await unwritten.evaluate((el) => [...el.children].map((c) => c.tagName))).toEqual(['SUMMARY']);
        await expect(about.getByText('The pack gives no words for this section.')).toHaveCount(1);

        // Fix 3: each opened fold's chevron (turned a quarter) is on screen, nothing clips it, and it overhangs the card's
        // left edge by no more than the page's side margin, measured below (the card itself holds no padding of its own).
        const chevrons = await about.locator('details[open] > summary .place-card__chevron').evaluateAll((els) =>
          els.map((el) => {
            const clipped = (() => {
              for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
                const cs = getComputedStyle(e);
                if (cs.overflowX !== 'visible' || cs.clipPath !== 'none') return `${e.tagName}.${String(e.className).split(' ')[0]}`;
              }
              return '';
            })();
            return { left: el.getBoundingClientRect().left, clipped };
          }),
        );
        expect(chevrons).toHaveLength(5);
        // The page's real side margin: the padding of the nearest element around the card that has any (the shell's,
        // 16 px on a phone, 32 px on a tablet), not the card's distance from the window's edge (the review's nit 2, #978).
        const margin = await about.evaluate((el) => {
          for (let e = el.parentElement; e; e = e.parentElement) {
            const padding = parseFloat(getComputedStyle(e).paddingLeft);
            if (padding > 0) return padding;
          }
          return 0;
        });
        expect(margin).toBeGreaterThan(0);
        for (const c of chevrons) {
          expect(c.clipped).toBe('');
          expect(c.left).toBeGreaterThanOrEqual(0);
          expect(card.x - c.left).toBeLessThanOrEqual(margin);
        }

        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '.place-facts__about')).toEqual([]);

        // The picture: in a window as tall as the page, so the sticky bars don't cover the opened folds, and taking in
        // the page's side margin on each side, so an opened fold's chevron shows whole (fix 3: only the crop cut it).
        const tall = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: size.width, height: Math.min(tall, 8000) });
        const shot = await box(about);
        const side = Math.min(16, shot.x);
        await page.screenshot({
          path: `test-results/layout-screens/pf-18b-town-sections-${size.width}-${scheme}.png`,
          clip: { x: shot.x - side, y: shot.y, width: Math.min(shot.width + 2 * side, size.width - (shot.x - side)), height: shot.height },
        });
      });
    });
  }
}

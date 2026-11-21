// Francis's five fixes to the Player tab as built (#1070; "Approve with fixes", 2026-11-20, from the as-built pictures),
// each to page M1 (frames M1a, M1e, M1f), on the shared P1-like character (layout.html?as=player&p1=…). Purposes, in
// plain words:
//   1. In the notices sheet, "To finish" is no card: "You can play now." a plain line, each step a row with its chevron
//      and a dotted rule under it (M1e), and a step still opens.
//   2. The right column's section headings (Scores, Saves, Movement, Abilities and traits, Skills, Languages) and Details are small
//      capitals at "At hand"'s size and look, every letter a small capital; the full sheet's own page keeps its own.
//   3. The foot's rows (Abilities, Traits, Notes) are one list: each straight under the last, about 65 px a row on a
//      tablet (M1a) and a phone (M1f), not about 105.
//   4. The languages' words are regular, not bold; the full sheet's own page keeps them bold.
//   5. On a 375 px phone the speed card and the load card sit side by side (M1f), with no sideways scroll, and with 999
//      bundles of reeds ("Can't move") too.
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';
import { openFullSheetFromMenu } from './fullSheetMenu.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openPlayer(page: Page, flag = '1') {
  await page.goto(`/layout.html?as=player&p1=${flag}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.notices-box')).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

const settled = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll('.dialog__backdrop')].every((b) => b.getAnimations({ subtree: true }).every((a) => a.playState !== 'running')));
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** A heading's type as drawn: its size, its capitals and their spacing. */
const typeOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: s.fontSize, caps: s.fontVariantCaps, transform: s.textTransform, family: s.fontFamily, weight: s.fontWeight, spacing: s.letterSpacing };
  });

for (const scheme of SCHEMES) {
  test.describe(`the Player tab's fixes of 20 Nov (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`1. "To finish" in the notices sheet: a plain line and rows with chevrons, no card (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'finish');
        await page.locator('.notices-box').first().click();
        const sheet = page.getByRole('dialog', { name: 'Notices' });
        await sheet.getByRole('button', { name: 'Next' }).click();
        await settled(page);
        const card = sheet.getByRole('region', { name: 'To finish' });
        // No card: no edge, no fill.
        const box = await card.evaluate((el) => {
          const s = getComputedStyle(el);
          return { edge: parseFloat(s.borderTopWidth), fill: s.backgroundColor, padding: parseFloat(s.paddingTop) };
        });
        expect(box).toEqual({ edge: 0, fill: 'rgba(0, 0, 0, 0)', padding: 0 });
        // "You can play now." a plain line, not a heading.
        await expect(card.locator('p', { hasText: /^You can play now\.$/ })).toBeVisible();
        await expect(card.getByRole('heading')).toHaveCount(0);
        // The step a row with its chevron (an icon, never "›") and a dotted rule under it; no boxed button.
        const row = card.locator('.list-row').filter({ hasText: /^Languages$/ });
        await expect(row.locator('.list-row__chevron svg')).toBeVisible();
        await expect(card.getByText('›')).toHaveCount(0);
        expect(await row.evaluate((el) => getComputedStyle(el).borderBottomStyle)).toBe('dotted');
        expect(await card.locator('.button-secondary').count()).toBe(0);
        expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        // The step still opens.
        await card.getByRole('button', { name: /Languages/ }).click();
        await expect(page.getByRole('dialog', { name: 'Languages' })).toBeVisible();
      });

      test(`2. the right column's headings and Details: "At hand"'s small capitals (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const atHand = await typeOf(page, '[aria-label="At hand"] .pack__group-title');
        expect(atHand.caps).toBe('small-caps');
        expect(atHand.transform).toBe('lowercase');
        for (const name of ['Scores', 'Saves', 'Movement', 'Abilities and traits', 'Skills', 'Languages']) {
          const heading = await typeOf(page, `.player section[aria-label="${name}"] > h2.sheet__label, .player section[aria-label="${name}"] .rule-heading h2.sheet__label`);
          expect({ name, ...heading }).toEqual({ name, ...atHand });
        }
        // Details: the words in its fold button take the heading's look.
        expect(await typeOf(page, '.player-details__fold > span')).toEqual(atHand);
        // The heading's word is no taller than "At hand"'s (M1's size; before, a capital twice the small ones).
        const wordHeight = (selector: string) =>
          page.locator(selector).first().evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getBoundingClientRect().height;
          });
        expect(await wordHeight('.player section[aria-label="Languages"] > h2.sheet__label')).toBeLessThanOrEqual((await wordHeight('[aria-label="At hand"] .pack__group-title')) + 0.5);
      });

      test(`3. the foot's rows are one list, about 65 px a row (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const rows = await Promise.all(
          ['Abilities', 'Traits', 'Notes'].map(async (n) => (await page.locator('.player .sheet').locator(`section[aria-label="${n}"] .list-row`).last().boundingBox())!),
        );
        for (let i = 1; i < rows.length; i++) {
          // Straight under the last: no gap, one rule between (the row's own).
          expect(Math.abs(rows[i]!.y - (rows[i - 1]!.y + rows[i - 1]!.height))).toBeLessThanOrEqual(1);
          // About 65 px a row (M1a, M1f), never the 105 it was.
          expect(rows[i]!.y - rows[i - 1]!.y).toBeLessThanOrEqual(72);
        }
        // Only the first keeps a rule above it.
        const tops = await page.locator('.player .sheet > .sheet__section > .row-list').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).borderTopWidth)));
        expect(tops[0]).toBeGreaterThan(0);
        expect(tops.slice(1).every((w) => w === 0)).toBe(true);
        expect(await layoutProblems(page)).toEqual([]);
      });

      test(`4. the languages' words are regular (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const box = page.getByRole('region', { name: 'Languages' }).locator('.sheet__box').first();
        await expect(box).toBeVisible();
        const weights = await box.evaluate((el) => {
          const s = getComputedStyle(el);
          return { weight: s.fontWeight, regular: s.getPropertyValue('--weight-book-text').trim() };
        });
        expect(weights.weight).toBe(weights.regular);
      });
    }

    test(`5. phone: the speed card and the load card side by side (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      for (const flag of ['1', 'heavy']) {
        await openPlayer(page, flag);
        const movement = page.getByRole('region', { name: 'Movement' });
        const cards = movement.locator('.sheet__pair > *');
        await expect(cards).toHaveCount(2);
        const speed = (await cards.nth(0).boundingBox())!;
        const load = (await cards.nth(1).boundingBox())!;
        expect(Math.abs(load.y - speed.y)).toBeLessThanOrEqual(1);
        expect(load.x).toBeGreaterThanOrEqual(speed.x + speed.width);
        expect(load.x + load.width).toBeLessThanOrEqual(375 - 16 + 0.5);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await noSidewaysScroll(page)).toBe(true);
      }
    });
  });
}

test('the full sheet’s own page keeps its headings and its bold language boxes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openPlayer(page);
  await openFullSheetFromMenu(page);
  const heading = await typeOf(page, 'section[aria-label="Scores"] h2.sheet__label');
  expect(heading.transform).toBe('none');
  expect(heading.caps).toBe('small-caps');
  const box = page.getByRole('region', { name: 'Languages' }).locator('.sheet__box').first();
  await expect(box).toBeVisible();
  expect(await box.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('700');
});

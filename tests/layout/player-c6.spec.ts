// dec-13 C6, first half (sb-2, md-1, ic-3; frames P1 and P2 of december/14, approved 2026-11-14; icons page 20, frame
// IC1): At hand's stacked buttons on the Player screen, in a real browser, on the shared P1-like character with its
// weapons with modes and a wand (layout.html ?as=player&p1=modes; src/testing/layoutP1Character.ts).
// Purposes:
//   Every stacked button in At hand (Quiver and Wield on the bow, Grip and Wield on the long-named axe, Wield on the
//   knife, Use on the wand, Use on the pinned trait) is a 44 px target at least, 88 px wide at least, all one size, its
//   word on one line under its icon, the last at its row's right edge, 8 px between a pair; nothing reaches past At hand
//   and the page never scrolls sideways; at 1180 and 375 px, in light and dark.
//   The axe's long name wraps rather than being cut (beside its two buttons on a tablet; on a phone the buttons sit
//   under it, dec-14 row 6, tests/layout/playerAuditRows.spec.ts).
//   Each icon is drawn in its button's own text colour, so it holds in dark mode as the word does.
//   Edit, with the quill, is on the cards of Your characters, not the Player tab (tfr-4; M1's second frame, approved
//   2026-11-19; moved here on Francis's yes of 20 Nov 2026): the stacked button, 44 by 88 px at least, at the card's
//   right, inside the card, at 1180 and 375 px.
//   The weapon in hand's block (C14; ?p1=weapon) carries Grip and Attack as stacked buttons: one size, 44 by 88 px at
//   least, 8 px apart, on their own line under the name at the block's right, inside the block (second half).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=modes');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'At hand' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wield Heron bow' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      test(`At hand's stacked buttons are one size, at their rows' right, inside At hand (${size.width} px)`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const atHand = page.getByRole('region', { name: 'At hand' });
        const names = ['Quiver of Heron bow', 'Wield Heron bow', 'Grip of Hand axe of the Seven Cairns, twice reforged', 'Wield Hand axe of the Seven Cairns, twice reforged', 'Wield Eel knife', 'Use a charge of Heron wand'];
        for (const name of names) await expect(atHand.getByRole('button', { name, exact: true })).toBeVisible();

        const facts = await atHand.evaluate((section) => {
          const outer = section.getBoundingClientRect();
          return [...section.querySelectorAll<HTMLElement>('.stacked-button')].map((b) => {
            const box = b.getBoundingClientRect();
            const row = (b.closest('.pack__row, .list-row') ?? b.parentElement!).getBoundingClientRect();
            const word = b.querySelector('span')!;
            const icon = b.querySelector('svg')!;
            const lineHeight = parseFloat(getComputedStyle(word).lineHeight) || 20;
            return {
              name: b.getAttribute('aria-label') ?? b.textContent ?? '',
              width: box.width,
              height: box.height,
              right: box.right,
              left: box.left,
              rowRight: row.right,
              outerLeft: outer.left,
              outerRight: outer.right,
              oneLine: word.getBoundingClientRect().height <= lineHeight * 1.5,
              iconAbove: icon.getBoundingClientRect().bottom <= word.getBoundingClientRect().top + 1,
              iconColour: getComputedStyle(icon).fill === 'currentcolor' || getComputedStyle(icon).color === getComputedStyle(b).color,
            };
          });
        });
        expect(facts.length).toBeGreaterThanOrEqual(names.length);
        const width = facts[0]!.width;
        for (const f of facts) {
          expect(f.height, f.name).toBeGreaterThanOrEqual(44);
          expect(f.width, f.name).toBeGreaterThanOrEqual(88);
          // Every button one size (sb-2).
          expect(Math.abs(f.width - width), f.name).toBeLessThanOrEqual(1);
          expect(f.oneLine, f.name).toBe(true);
          expect(f.iconAbove, f.name).toBe(true);
          expect(f.iconColour, f.name).toBe(true);
          expect(f.left, f.name).toBeGreaterThanOrEqual(f.outerLeft - 0.5);
          expect(f.right, f.name).toBeLessThanOrEqual(f.outerRight + 0.5);
        }
        // A pair: the mode button, 8 px, then its action at the row's right edge.
        const quiver = facts.find((f) => f.name === 'Quiver of Heron bow')!;
        const wield = facts.find((f) => f.name === 'Wield Heron bow')!;
        expect(Math.round(wield.left - quiver.right)).toBe(8);
        expect(Math.abs(wield.right - wield.rowRight)).toBeLessThanOrEqual(1);

        // The long name wraps; it's never cut.
        const axe = atHand.locator('.pack__name', { hasText: 'Hand axe of the Seven Cairns' });
        const cut = await axe.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis');
        expect(cut).toBe(false);

        const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(scrolls).toBe(false);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[aria-label="At hand"]')).toEqual([]);
      });

      test(`the weapon in hand's Grip and Attack are stacked, one size, at the block's right (${size.width} px)`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto('/layout.html?as=player&p1=weapon');
        await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
        const region = page.getByRole('region', { name: 'Weapon in hand' });
        await expect(region).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const grip = region.getByRole('button', { name: /^Grip of / });
        const attack = region.getByRole('button', { name: /^Attack with / });
        for (const b of [grip, attack]) await expect(b).toHaveClass(/stacked-button/);
        const [g, a, name, block] = await Promise.all([grip.boundingBox(), attack.boundingBox(), region.locator('.pack__row-main').boundingBox(), region.locator('.weapon-in-hand').boundingBox()]);
        for (const b of [g!, a!]) {
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.width).toBeGreaterThanOrEqual(88);
          expect(b.x).toBeGreaterThanOrEqual(block!.x - 0.5);
          expect(b.x + b.width).toBeLessThanOrEqual(block!.x + block!.width + 0.5);
        }
        expect(Math.abs(g!.width - a!.width)).toBeLessThanOrEqual(1);
        expect(Math.round(a!.x - (g!.x + g!.width))).toBe(8);
        // Their own line under the name (P1 draws two stacked buttons so), at the block's right.
        expect(g!.y).toBeGreaterThanOrEqual(name!.y + name!.height - 0.5);
        expect(block!.x + block!.width - (a!.x + a!.width)).toBeLessThan(24);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[aria-label="Weapon in hand"]')).toEqual([]);
      });
    });
  }
}

for (const size of SIZES) {
  test(`on Your characters, Edit is the stacked button with the quill, at the card's right (${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    await expect(page.locator('.player').getByRole('button', { name: /^Edit/ })).toHaveCount(0);
    if (size.width < 600) await page.locator('.top-row').getByRole('button', { name: 'Menu' }).click();
    else await page.getByRole('button', { name: 'Character options' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Your characters', exact: true }).click();
    const edit = page.getByRole('button', { name: /^Edit / }).first();
    await expect(edit).toBeVisible();
    await expect(edit).toHaveClass(/stacked-button/);
    await expect(edit).toHaveText('Edit');
    const box = (await edit.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(88);
    const card = (await edit.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " character-card ")][1]').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
    expect(box.x).toBeGreaterThan(card.x + card.width / 2);
    expect(await layoutProblems(page)).toEqual([]);
  });
}

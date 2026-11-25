// dec-14 player audit, batch F (docs/plans/dec-14-player-audit-fixes.md).
// Row 6 (frame 38-6 of december page 38, approved 2026-11-24; ruled "3 every size pack included") on the test
// character with two-button rows (`layout.html?as=player&p1=modes`: Quiver and Wield on the bow, Grip and Wield on the
// long-named axe; Wield alone on the knife, Use alone on the wand). Purposes:
//   6a. On a phone a two-button row's words take the row's full width and its two buttons sit under them, at the row's
//       right, 8 px apart, 8 px or more under the words; at standard text and at Larger text.
//   6b. On a phone a one-button row is unchanged: its button beside the name, on the name's line.
//   6c. The Pack tab's own At hand rows (the same row part) do the same on a phone.
//   6d. On a tablet nothing changes: a two-button row keeps its buttons beside the words.
//   6e. No sideways scroll at 375 px, no serious accessibility problem; light and dark.
// Row 7a (page 39, frames 39-4 to 39-6, approved 2026-11-24, A2) on the plain test character (`?p1=1`). Purposes:
//   7a-1. The armour class tile's line names the score in full, the setting's own long name, then its figure
//         ("Nimbleness +1"), never "AC", "from" or the short name; on a tablet, a phone, and a phone at Larger text.
//   7a-2. The line is never cut: it wraps if it must (no ellipsis, nothing hidden), and nothing in it is under 14 px.
//   (A score that adds nothing leaves no line: no test character has one, so explain.test.ts covers it.)
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 1180, height: 820 };
const SCHEMES = ['light', 'dark'] as const;

async function openModes(page: Page) {
  await page.goto('/layout.html?as=player&p1=modes');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'At hand' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wield Heron bow' }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** A row's words, its buttons and the row itself, measured. */
async function rowFacts(row: Locator) {
  return row.evaluate((el) => {
    const box = (e: Element) => e.getBoundingClientRect();
    const main = el.querySelector('.pack__row-main')!;
    const name = el.querySelector('.pack__name')!;
    const buttons = [...el.children].filter((c) => c !== main && c.matches('button')).map(box);
    return { row: box(el), main: box(main), name: box(name), buttons };
  });
}

const rowOf = (scope: Locator, name: string) => scope.locator('.pack__row').filter({ has: scope.page().locator('.pack__name', { hasText: name }) }).first();

const noSpill = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** 6a: the words the full width, the two buttons under them at the right, 8 px apart. */
async function expectButtonsUnder(row: Locator) {
  const f = await rowFacts(row);
  expect(f.buttons.length).toBe(2);
  expect(Math.abs(f.main.width - f.row.width)).toBeLessThanOrEqual(1);
  const [first, second] = f.buttons as [DOMRect, DOMRect];
  for (const b of [first, second]) expect(b.top).toBeGreaterThanOrEqual(f.main.bottom - 0.5);
  expect(first.top - f.name.bottom).toBeGreaterThanOrEqual(8 - 0.5);
  expect(Math.abs(first.top - second.top)).toBeLessThanOrEqual(1);
  expect(Math.round(second.left - first.right)).toBe(8);
  expect(Math.abs(second.right - f.row.right)).toBeLessThanOrEqual(1);
}

/** 6b and 6d: the buttons beside the words, on the name's line. */
async function expectButtonsBeside(row: Locator, count: number) {
  const f = await rowFacts(row);
  expect(f.buttons.length).toBe(count);
  for (const b of f.buttons) {
    expect(b.left).toBeGreaterThanOrEqual(f.main.right - 0.5);
    expect(b.top).toBeLessThan(f.name.bottom);
  }
}

for (const scheme of SCHEMES) {
  test.describe(`row 6: two buttons on a row (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const text of ['standard', 'larger'] as const) {
      test(`6a, 6b. on a phone, a two-button row's buttons go under its words; one button stays beside (${text} text, ${scheme})`, async ({ page }) => {
        test.fail();
        if (text === 'larger') await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
        await page.setViewportSize(PHONE);
        await openModes(page);
        const atHand = page.getByRole('region', { name: 'At hand' });
        await expectButtonsUnder(rowOf(atHand, 'Heron bow'));
        await expectButtonsUnder(rowOf(atHand, 'Hand axe of the Seven Cairns'));
        await expectButtonsBeside(rowOf(atHand, 'Eel knife'), 1);
        await expectButtonsBeside(rowOf(atHand, 'Heron wand'), 1);
        expect(await noSpill(page)).toBe(true);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[aria-label="At hand"]')).toEqual([]);
      });
    }

    test(`6c. the Pack tab's own At hand rows do the same on a phone (${scheme})`, async ({ page }) => {
      test.fail();
      await page.setViewportSize(PHONE);
      await openModes(page);
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
      const pack = page.locator('.pack');
      await expect(pack.getByRole('button', { name: 'Quiver of Heron bow' })).toBeVisible();
      await expectButtonsUnder(rowOf(pack, 'Heron bow'));
      await expectButtonsUnder(rowOf(pack, 'Hand axe of the Seven Cairns'));
      await expectButtonsBeside(rowOf(pack, 'Eel knife'), 1);
      await expectButtonsBeside(rowOf(pack, 'Heron wand'), 1);
      expect(await noSpill(page)).toBe(true);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test(`6d. on a tablet a two-button row keeps its buttons beside its words (${scheme})`, async ({ page }) => {
      await page.setViewportSize(TABLET);
      await openModes(page);
      const atHand = page.getByRole('region', { name: 'At hand' });
      await expectButtonsBeside(rowOf(atHand, 'Heron bow'), 2);
      await expectButtonsBeside(rowOf(atHand, 'Hand axe of the Seven Cairns'), 2);
      await expectButtonsBeside(rowOf(atHand, 'Eel knife'), 1);
      expect(await noSpill(page)).toBe(true);
    });
  });
}

const AC_SIZES = [
  { name: 'tablet', size: TABLET, larger: false },
  { name: 'phone', size: PHONE, larger: false },
  { name: 'phone, Larger text', size: PHONE, larger: true },
] as const;

for (const scheme of SCHEMES) {
  test.describe(`row 7a: the armour class line in whole words (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const at of AC_SIZES) {
      test(`7a. "Nimbleness +1", whole and never cut (${at.name}, ${scheme})`, async ({ page }) => {
        test.fail();
        if (at.larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
        await page.setViewportSize(at.size);
        await page.goto('/layout.html?as=player&p1=1');
        await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
        const vitals = page.getByRole('region', { name: 'Vitals' });
        await expect(vitals).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const line = vitals.getByRole('button', { name: /^Armour class / }).locator('.stat-tile__caption');
        await expect(line).toHaveText('Nimbleness +1');
        const facts = await line.evaluate((el) => {
          const s = getComputedStyle(el);
          return { cut: el.scrollWidth > el.clientWidth + 1 || s.textOverflow === 'ellipsis' || !['none', ''].includes(s.webkitLineClamp), size: parseFloat(s.fontSize) };
        });
        expect(facts.cut).toBe(false);
        expect(facts.size).toBeGreaterThanOrEqual(14);

        expect(await noSpill(page)).toBe(true);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, 'section[aria-label="Vitals"]')).toEqual([]);
      });
    }
  });
}

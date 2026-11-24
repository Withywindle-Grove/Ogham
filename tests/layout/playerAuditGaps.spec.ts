// Batch A of plan dec-14-player-audit-fixes (page 38 of december, approved 2026-11-24): the Player tab's tight gaps.
// Row 2 (frames 38-2), on the shared P1-like characters (`layout.html?as=player&p1=…`; src/testing/layoutP1Character.ts).
// Purposes, each a plain sentence:
//   2a. With a long weapon name the weapon in hand's buttons, on their own line, sit 8 px or more under the words.
//   2b. With a short weapon name (one button, beside the name) nothing moves: the button stays on the name's line.
//   2c. The ⓘ beside "Abilities and traits" sits 8 px or more above the first pinned box.
//   2d. With nothing pinned there is no ⓘ, and the list starts 4 px under the heading, its top edge the double rule
//       row 4 added (4a checks the 8 px under that rule).
//   2e. At Larger text both gaps still hold.
// 2a to 2d on a tablet and at 375 px, light and dark; the page never scrolls sideways.
// Row 4 (frame 38-4), "Use" off the heading's rule:
//   4a. With a plain row first, "Abilities and traits" takes At hand's double rule and the first row's Use starts 8 px or
//       more below it.
//   4b. With pinned boxes first, no rule is added: the heading is as 38-2 draws it, the first pinned box has no rule
//       above it, and the plain row after the pins (Beacon call, unpinned) shows on its own hairline, not a double rule
//       (plan dec-14, "Not drawn together").
//   4c. Scores, Saves and Movement keep bare headings: no double rule under them.
// 4a to 4c on a tablet and at 375 px (one column), light and dark. With no traits at all the section isn't drawn
// (`PlayerTraits` returns nothing), so there is no heading to rule.
// Row 9 (frame 38-9), "Hit points" in the headings' hand:
//   9a. On the Player tab the hit points box's label has a section heading's face, weight, size, small capitals, spacing
//       and case (text-transform).
//   9b. Nothing in it is under 14 px, at 0 and at 999 hit points too, and the page never scrolls sideways.
//   9c. At Larger text it still matches the headings.
//   9d. The hit points box elsewhere (the gallery; the full sheet on its own page) keeps its own small, spaced-out label.
//       (The full sheet beside the Magic tab draws no hit points box.)
// 9a and 9b on a tablet and at 375 px, light and dark.
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openPlayer(page: Page, p1: string) {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Weapon in hand' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** The type of the Player tab's hit points label and of its "Scores" heading, side by side. */
async function hpAndHeading(page: Page) {
  const pick = (at: ReturnType<Page['locator']>) =>
    at.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, weight: s.fontWeight, size: s.fontSize, variant: s.fontVariantCaps, spacing: s.letterSpacing, transform: s.textTransform };
    });
  return {
    hp: await pick(page.locator('.player__pane--play .hp-box > .stat-tile__label')),
    heading: await pick(page.getByRole('region', { name: 'Scores', exact: true }).getByRole('heading', { name: 'Scores' })),
  };
}

async function openPlayerAs(page: Page, p1: string) {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player .hp-box')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const noSpill = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test.describe(`${size.name}, ${scheme}`, () => {
      test.use({ colorScheme: scheme });

      test(`2a. a long weapon's buttons sit 8 px under its words (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'weapon');
        const region = page.getByRole('region', { name: 'Weapon in hand' });
        const words = (await region.locator('.weapon-in-hand .pack__row-main').boundingBox())!;
        const actions = (await region.locator('.weapon-in-hand__actions').boundingBox())!;
        expect(actions.y - (words.y + words.height)).toBeGreaterThanOrEqual(8 - 0.5);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`2b. a short weapon's one button stays beside its name (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, '1');
        const region = page.getByRole('region', { name: 'Weapon in hand' });
        const name = (await region.getByRole('button', { name: /^Reed spear/ }).boundingBox())!;
        const attack = (await region.getByRole('button', { name: 'Attack with Reed spear' }).boundingBox())!;
        expect(attack.y).toBeLessThan(name.y + name.height);
        expect(attack.x).toBeGreaterThan(name.x);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`2c. the ⓘ sits 8 px above the first pinned box (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'pins');
        const list = page.getByRole('region', { name: 'Abilities and traits' });
        await expect(list.locator('.pinned-box--block')).toBeVisible();
        const info = (await list.getByRole('button', { name: 'About moving pinned ones' }).boundingBox())!;
        const first = (await list.locator('.pinned-box').first().boundingBox())!;
        expect(first.y - (info.y + info.height)).toBeGreaterThanOrEqual(8 - 0.5);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`2d. with nothing pinned, no ⓘ and the heading as built (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, '1');
        const list = page.getByRole('region', { name: 'Abilities and traits' });
        await expect(list).toBeVisible();
        await expect(list.getByRole('button', { name: 'About moving pinned ones' })).toHaveCount(0);
        const heading = (await list.getByRole('heading', { name: 'Abilities and traits' }).boundingBox())!;
        const next = list.locator('.row-list').first();
        const box = (await next.boundingBox())!;
        expect(Math.round(box.y - (heading.y + heading.height))).toBe(4);
        expect(await next.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('double');
      });

      test(`9a/9b. "Hit points" in the headings' hand, at 11, 0 and 999 (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const p1 of ['1', 'bare', 'packless']) {
          await openPlayerAs(page, p1);
          const { hp, heading } = await hpAndHeading(page);
          expect(hp, p1).toEqual(heading);
          expect(hp.transform, p1).toBe(heading.transform);
          expect(hp.variant).toBe('small-caps');
          expect(parseFloat(hp.size)).toBeGreaterThanOrEqual(14);
          const sizes = await page.locator('.player .hp-box').evaluate((box) =>
            Array.from(box.querySelectorAll<HTMLElement>('*'))
              .filter((n) => n.textContent?.trim())
              .map((n) => parseFloat(getComputedStyle(n).fontSize)),
          );
          expect(Math.min(...sizes), p1).toBeGreaterThanOrEqual(14);
          expect(await noSpill(page)).toBeLessThanOrEqual(0);
        }
      });

      test(`4a. over a plain row the heading takes the double rule and Use starts 8 px below it (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, '1');
        const list = page.getByRole('region', { name: 'Abilities and traits' }).locator('.row-list').first();
        const rule = await list.evaluate((el) => {
          const s = getComputedStyle(el);
          return { style: s.borderTopStyle, width: parseFloat(s.borderTopWidth) };
        });
        expect(rule).toEqual({ style: 'double', width: 3 });
        const top = (await list.boundingBox())!;
        const use = (await list.getByRole('button', { name: /^Use / }).first().boundingBox())!;
        expect(use.y - (top.y + rule.width)).toBeGreaterThanOrEqual(8 - 0.5);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`4b. with pinned boxes first no rule is added (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'pins');
        const section = page.getByRole('region', { name: 'Abilities and traits' });
        await expect(section.locator('.pinned-box--block')).toBeVisible();
        const styles = await section.evaluate((el) =>
          Array.from(el.querySelectorAll<HTMLElement>(':scope > *, :scope .row-list')).map((n) => getComputedStyle(n).borderTopStyle),
        );
        expect(styles).not.toContain('double');
        // The first pinned box has no rule above it: nothing between the heading's row and the box draws a top border.
        const firstBox = section.locator('.pinned-box').first();
        const above = await firstBox.evaluate((box) => {
          const tops: string[] = [];
          for (let n: HTMLElement | null = box.parentElement; n && !n.matches('.sheet__section'); n = n.parentElement) tops.push(getComputedStyle(n).borderTopStyle);
          const head = box.closest('.sheet__section')!.firstElementChild as HTMLElement;
          return { tops, headBottom: getComputedStyle(head).borderBottomStyle };
        });
        expect(above.tops.filter((t) => t !== 'none'), 'a rule above the first pinned box').toEqual([]);
        expect(above.headBottom).toBe('none');
        // The plain row after the pins (Beacon call, unpinned): shown, on its own hairline, not a double rule.
        const plain = section.locator('.pinned-list + .row-list');
        await expect(plain).toBeVisible();
        await expect(plain.getByRole('button', { name: 'Use Beacon call' })).toBeVisible();
        expect(await plain.evaluate((el) => getComputedStyle(el).borderTopStyle)).not.toBe('double');
        const pins = (await section.locator('.pinned-list').boundingBox())!;
        const row = (await plain.boundingBox())!;
        expect(row.y).toBeGreaterThanOrEqual(pins.y + pins.height);
        expect(await noSpill(page)).toBeLessThanOrEqual(0);
      });

      test(`4c. Scores, Saves and Movement keep bare headings (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, '1');
        for (const name of ['Scores', 'Saves', 'Movement']) {
          const section = page.getByRole('region', { name, exact: true });
          await expect(section).toBeVisible();
          const doubles = await section.evaluate((el) =>
            Array.from(el.querySelectorAll<HTMLElement>(':scope > *')).filter((n) => getComputedStyle(n).borderTopStyle === 'double').length,
          );
          expect(doubles, name).toBe(0);
        }
      });
    });
  }
}

test(`2e. at Larger text both gaps hold: the weapon's buttons and the ⓘ 8 px clear (tablet, light)`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.setViewportSize({ width: 1180, height: 820 });
  await openPlayer(page, 'weapon');
  const region = page.getByRole('region', { name: 'Weapon in hand' });
  const words = (await region.locator('.weapon-in-hand .pack__row-main').boundingBox())!;
  const actions = (await region.locator('.weapon-in-hand__actions').boundingBox())!;
  expect(actions.y - (words.y + words.height)).toBeGreaterThanOrEqual(8 - 0.5);
  await openPlayer(page, 'pins');
  const list = page.getByRole('region', { name: 'Abilities and traits' });
  const info = (await list.getByRole('button', { name: 'About moving pinned ones' }).boundingBox())!;
  const first = (await list.locator('.pinned-box').first().boundingBox())!;
  expect(first.y - (info.y + info.height)).toBeGreaterThanOrEqual(8 - 0.5);
});

test(`9c. at Larger text "Hit points" still matches the headings (phone, light)`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.setViewportSize({ width: 375, height: 812 });
  await openPlayerAs(page, '1');
  const { hp, heading } = await hpAndHeading(page);
  expect(hp).toEqual(heading);
  expect(await noSpill(page)).toBeLessThanOrEqual(0);
});

test(`9d. the hit points box elsewhere keeps its small, spaced-out label (gallery, full sheet)`, async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  const label = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, spacing: parseFloat(s.letterSpacing), transform: s.textTransform };
    });
  await page.goto('/gallery.html');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  const gallery = await label('#players-standard .hp-box > .stat-tile__label');
  expect(gallery.size).toBe('14px');
  expect(gallery.spacing).toBeGreaterThan(0);
  expect(gallery.transform).toBe('none');
  // The full sheet on its own page: from a phone's menu.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/layout.html?as=player&full=1');
  await page.getByRole('button', { name: /The Fen Ledger/ }).click();
  await page.locator('.top-row').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Level' })).toBeVisible();
  const sheet = page.locator('.hp-box > .stat-tile__label').filter({ visible: true });
  await expect(sheet.first()).toBeVisible();
  expect(await sheet.first().evaluate((el) => el.closest('.player') === null)).toBe(true);
  expect(await sheet.first().evaluate((el) => getComputedStyle(el).fontSize)).toBe('14px');
});

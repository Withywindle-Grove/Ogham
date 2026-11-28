// The place card's detail rows (spec scene-pack, piece B, #205; sf-6b, sf-24, l4-2; page 44, DT1, DT2, approved
// 2026-11-26 as redrawn), on the layout page's wreck (`layout.html?as=gm&placePage=wreck&details=…`;
// src/testing/layoutHarness.tsx), in a real browser at 1024 px and 375 px, light and dark, and with Larger text at 375 px.
// Test pictures under test-results/layout-screens/details-*.png, to be set beside frames 44-5 and 44-6. Purposes:
//   DT1 B, DT2 B. Each piece that names a creature or a thing carries its full row under it; the shown crate says "Only
//        you see these details.", the hidden pieces "Only you see this."; a tap on a row opens its one pop-up.
//   DT1 A, DT2 A. The fold opened: the book's words, then "Stat lines" with the Eel and Old Harl's short row ("Same stat
//        line as the Ferryman."), then the quiet line; no eye on it.
//   DT1 C, DT2 C. Old Harl with a block of his own keeps his own line.
//   44-5 B, 44-7. With &sf8, the hoards: the Crate carries "Lamp oil ×8", the Bronze ring its row; no "Items" in the fold.
//   Messy: a long name, ×999 and a creature no pack has ("Not in your packs: a creature ×2"), with nothing cut.
// Each: nothing scrolls sideways, no tap target under 44 px, no text under 14 px, and axe finds no serious problem.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function open(page: Page, scheme: 'light' | 'dark', details: string, larger = false) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=gm&placePage=wreck&session=running&details=${details}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('button', { name: 'Mud crab: read it' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const shot = (page: Page, frame: string, width: number, scheme: string) => page.screenshot({ path: `test-results/layout-screens/details-${frame}-${width}-${scheme}.png`, fullPage: true });
const foldRow = (page: Page) => page.getByRole('button', { name: /From the book, for the GM/ });

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the place card's detail rows (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' });

      // Purpose: DT1 B and DT2 B, each line on the piece that names it, under the label its eye calls for.
      test('each piece carries its row under its label', async ({ page }) => {
        await open(page, scheme, '1');
        for (const name of ['Ferryman', 'Mud crab', 'Lamp oil']) await expect(page.getByRole('button', { name: `${name}: read it` })).toBeVisible();
        await expect(page.getByText('Only you see these details.')).toHaveCount(1);
        await expect(page.getByText('Only you see this.')).toHaveCount(2);
        await expect(page.getByText(/stat line never shows/)).toHaveCount(0);
        // The row stands under its piece, at the card's width, not beside the piece's eye.
        const piece = page.locator('.place-page__piece').filter({ hasText: 'Three men sleep under the sailcloth' });
        const row = page.getByRole('button', { name: 'Ferryman: read it' });
        expect((await row.boundingBox())!.y).toBeGreaterThan((await piece.boundingBox())!.y);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await shot(page, 'pieces', size.width, scheme);
        await row.click();
        await expect(page.getByRole('dialog', { name: 'Ferryman' }).getByText('How many: 3')).toBeVisible();
      });

      // Purpose: DT1 A and DT2 A, the fold ends with only the rows no piece names and the quiet line.
      test('the fold keeps only the rows no piece names', async ({ page }) => {
        await open(page, scheme, '1');
        await foldRow(page).click();
        const fold = page.getByRole('region', { name: 'From the book, for the GM' });
        await expect(fold.getByRole('heading', { name: 'Stat lines' })).toBeVisible();
        await expect(fold.getByRole('button', { name: 'Eel: read it' })).toBeVisible();
        await expect(fold.getByText('Same stat line as the Ferryman.')).toBeVisible();
        await expect(fold.getByText('The other stat lines and the items are on their own rows.')).toBeVisible();
        await expect(fold.getByRole('button', { name: /Show players|Hide from players/ })).toHaveCount(0);
        await fold.getByRole('button', { name: 'Old Harl: read it' }).scrollIntoViewIfNeeded();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await shot(page, 'fold', size.width, scheme);
        await fold.getByRole('button', { name: 'Old Harl: read it' }).click();
        await expect(page.getByRole('dialog', { name: 'Old Harl' }).getByRole('heading', { name: 'Ferryman' })).toBeVisible();
      });

      // Purpose: DT1 C and DT2 C, Old Harl with a block of his own keeps his own full line in the fold.
      test('a character with a block of his own keeps his line', async ({ page }) => {
        await open(page, scheme, 'own');
        await foldRow(page).click();
        const harl = page.getByRole('region', { name: 'From the book, for the GM' }).getByRole('button', { name: 'Old Harl: read it' });
        await expect(harl).toContainText('Level');
        await expect(page.getByText('Same stat line as the Ferryman.')).toHaveCount(0);
        await harl.scrollIntoViewIfNeeded();
        await shot(page, 'own', size.width, scheme);
      });

      // Purpose: 44-5 B and 44-7, a hoard's things on the hoard's piece: the Crate carries "Lamp oil ×8", the Bronze
      // ring its own row, and the fold has no "Items" group left.
      test("a hoard's things stand on the hoard's piece", async ({ page }) => {
        await open(page, scheme, '1&sf8=1');
        await expect(page.getByRole('button', { name: 'Lamp oil: read it' })).toContainText('Lamp oil ×8');
        await expect(page.getByRole('button', { name: 'Bronze ring: read it' })).toBeVisible();
        await foldRow(page).click();
        await expect(page.getByRole('region', { name: 'From the book, for the GM' }).getByRole('heading', { name: 'Items' })).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        await page.getByRole('button', { name: 'Lamp oil: read it' }).scrollIntoViewIfNeeded();
        await shot(page, 'hoards', size.width, scheme);
      });
    });
  }
}

// Purpose: messy data at 375 px, with Larger text too: a long name and ×999 wrap whole, a creature no pack has says so
// by its words, and nothing is cut or scrolls sideways.
for (const scheme of ['light', 'dark'] as const) {
  for (const larger of [false, true]) {
    test(`messy rows stay whole (375 px, ${scheme}${larger ? ', Larger text' : ''})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await open(page, scheme, 'messy', larger);
      await expect(page.getByText('Not in your packs: a creature ×2')).toBeVisible();
      const long = page.getByRole('button', { name: /^Ferryman of the Nine Drowned Tides and the Long Sedge Causeway: read it$/ });
      await expect(long).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      await long.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/layout-screens/details-messy${larger ? '-larger' : ''}-375-${scheme}.png`, fullPage: true });
    });
  }
}

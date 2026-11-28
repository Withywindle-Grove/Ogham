// What a person carries (dec5-gaps F, #192; G-228; page 50, approved by Francis 2026-11-28 with findings 1, 5 and 6), on
// the layout page's wreck with Mother Sedge on it (`layout.html?as=gm&placePage=wreck&carries=…`; src/testing/
// layoutHarness.tsx), in a real browser at 1024 px and 375 px, light and dark. Test pictures under
// test-results/layout-screens/carries-*.png, to be set beside page 50's frames. Purposes, in plain words:
//   50-1, 50-2 A. Her piece says "Only you see this." and "Carries: warden’s lantern, iron key."; after her stat line on
//        a tablet, above it on a phone (finding 5).
//   50-1, 50-2 B. Her words open her sheet: the place over her name, "Carries", a row a thing with its note, the edit
//        row; no "Send all" and no accent (finding 1).
//   50-2 C. A thing's row opens its sheet: To a character, To the party stash, no edit row.
//   50-2 D. After a send to Wren, her row says "Sent to Wren." and her line "Carries: iron key. Warden’s lantern sent to
//        Wren of the Lantern Wardens.".
//   50-3 A. Sent at another place: her line says so, and her sheet lists it under "Sent before".
//   50-4 A to D. A long name, ×999 and a thing not in the packs (no id, finding 6); everything sent, "Carries nothing now."
// Each: nothing scrolls sideways, no tap target under 44 px, no text under 14 px, and axe finds no serious problem.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SEDGE = /^A tall woman in a salt-stiff coat/;
const WREN = 'Wren of the Lantern Wardens';

async function open(page: Page, scheme: 'light' | 'dark', carries: string) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  await page.goto(`/layout.html?as=gm&placePage=wreck&session=running&carries=${carries}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.person-carries')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Her piece's lines in order, as drawn: her words, the label, her stat line and her Carries line. */
const linesOf = (page: Page) =>
  page.locator('.place-page__piece').filter({ has: page.locator('.person-carries') }).locator('.place-page__piece-words > span').allTextContents();

async function shot(page: Page, frame: string, width: number, scheme: string) {
  // A phone's sheet rises from the foot: the picture waits until it has.
  // Only animations that end (a looping one never does), and never more than a second.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))),
      new Promise((done) => setTimeout(done, 1000)),
    ]),
  );
  await page.screenshot({ path: `test-results/layout-screens/carries-${frame}-${width}-${scheme}.png` });
}

// Purpose: 50-1's toast at 375 px, with Larger text too: a send from her sheet (the long lantern to Wren) shows its toast
// above the sheet without covering the sheet's title or its ✕, and the sheet with its rows stays whole.
for (const scheme of ['light', 'dark'] as const) {
  for (const larger of [false, true]) {
    test(`a send's toast stands clear of her sheet (375 px, ${scheme}${larger ? ', Larger text' : ''})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
      await open(page, scheme, 'messy');
      await page.getByRole('button', { name: SEDGE }).click();
      const lantern = 'The Hooded Lantern of the Nine Drowned Wardens of Saltwick Quay';
      await page.getByRole('dialog', { name: /Mother Sedge$/ }).getByText(lantern).click();
      await page.getByRole('dialog', { name: new RegExp(`${lantern}$`) }).getByText('To a character').click();
      await page.getByRole('dialog', { name: 'Send to' }).getByText(WREN).click();
      const toast = page.locator('.toast').filter({ hasText: `${lantern} sent to ${WREN}.` });
      await expect(toast).toBeVisible();
      const sheet = page.getByRole('dialog', { name: /Mother Sedge$/ });
      await expect(sheet.getByText(`Sent to ${WREN}.`)).toBeVisible();
      // The toast's box ends above the sheet's title and its ✕.
      const toastBox = (await toast.boundingBox())!;
      for (const part of [sheet.getByRole('heading', { name: 'Mother Sedge' }), sheet.getByRole('button', { name: 'Close' })]) {
        const box = (await part.boundingBox())!;
        expect(toastBox.y + toastBox.height <= box.y || box.y + box.height <= toastBox.y).toBe(true);
      }
      expect(await layoutProblems(page)).toEqual([]);
      await shot(page, `toast${larger ? '-larger' : ''}`, 375, scheme);
    });
  }
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`what a person carries (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      // Purpose: 50-1 and 50-2 A, her piece with the label and the Carries line, placed by the device (finding 5).
      test('her piece says what she carries, placed for the device', async ({ page }) => {
        await open(page, scheme, '1');
        const lines = await linesOf(page);
        const carries = 'Carries: warden’s lantern, iron key.';
        expect(lines.slice(1)).toEqual(size.name === 'phone' ? ['Only you see this.', carries, 'The stat line never shows (NPC: Mother Sedge).'] : ['Only you see this.', 'The stat line never shows (NPC: Mother Sedge).', carries]);
        await page.locator('.person-carries').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await shot(page, 'piece', size.width, scheme);
      });

      // Purpose: 50-1 and 50-2 B and C, her sheet and a thing's sheet, with no Send all and no accent on hers.
      test('her sheet lists her things; a thing’s sheet sends it', async ({ page }) => {
        await open(page, scheme, '1');
        await page.getByRole('button', { name: SEDGE }).click();
        const sheet = page.getByRole('dialog', { name: /Mother Sedge$/ });
        await expect(sheet.getByText('Warden’s lantern', { exact: true })).toBeVisible();
        await expect(sheet.getByText('On a cord at her neck')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Send all' })).toHaveCount(0);
        await expect(sheet.locator('.button-primary, .stacked-button--primary')).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await shot(page, 'sheet', size.width, scheme);
        await sheet.getByText('Warden’s lantern', { exact: true }).click();
        const one = page.getByRole('dialog', { name: /Warden’s lantern$/ });
        await expect(one.getByText('To the party stash')).toBeVisible();
        await expect(one.getByText(/Edit the piece/)).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'thing', size.width, scheme);
      });

      // Purpose: 50-2 D, after a send to Wren: her row and her line say where it went.
      test('after a send, her row and her line say where it went', async ({ page }) => {
        await open(page, scheme, 'sent');
        await expect(page.locator('.person-carries')).toHaveText(`Carries: iron key. Warden’s lantern sent to ${WREN}.`);
        await page.getByRole('button', { name: SEDGE }).click();
        await expect(page.getByRole('dialog', { name: /Mother Sedge$/ }).getByText(`Sent to ${WREN}.`)).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'sent', size.width, scheme);
      });

      // Purpose: 50-3 A, sent at another place: her line says so and her sheet lists it under "Sent before".
      test('a thing sent at another place reads under Sent before', async ({ page }) => {
        await open(page, scheme, 'before');
        await expect(page.locator('.person-carries')).toHaveText(`Carries: iron key. Warden’s lantern sent to ${WREN}.`);
        await page.getByRole('button', { name: SEDGE }).click();
        const sheet = page.getByRole('dialog', { name: /Mother Sedge$/ });
        await expect(sheet.getByText(`Sent before: Warden’s lantern, to ${WREN}, at 1. The jetty.`)).toBeVisible();
        await expect(sheet.getByText('Warden’s lantern', { exact: true })).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'before', size.width, scheme);
      });

      // Purpose: 50-4 A and C, a long name, ×999 and a thing not in the packs, with no id on screen (finding 6).
      test('a long name, a count of 999 and a thing not in the packs', async ({ page }) => {
        await open(page, scheme, 'messy');
        await page.getByRole('button', { name: SEDGE }).click();
        const sheet = page.getByRole('dialog', { name: /Mother Sedge$/ });
        await expect(sheet.getByText('The Hooded Lantern of the Nine Drowned Wardens of Saltwick Quay')).toBeVisible();
        await expect(sheet.getByText('Oil flask ×999')).toBeVisible();
        await expect(sheet.getByText('One thing she carries isn’t in your packs.')).toBeVisible();
        await expect(page.getByText(/reed-moon-bell/)).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await shot(page, 'messy', size.width, scheme);
      });

      // Purpose: 50-4 B and D, everything sent: each row says where, and her line "Carries nothing now.".
      test('everything sent: Carries nothing now', async ({ page }) => {
        await open(page, scheme, 'all');
        await expect(page.locator('.person-carries')).toHaveText('Carries nothing now.');
        await page.locator('.person-carries').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await shot(page, 'all-piece', size.width, scheme);
        await page.getByRole('button', { name: SEDGE }).click();
        const sheet = page.getByRole('dialog', { name: /Mother Sedge$/ });
        await expect(sheet.getByText('Sent to the party stash.')).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'all', size.width, scheme);
      });
    });
  }
}

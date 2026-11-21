// The Player tab's pop-ups in the book's format (tfb-1, tfb-2, 2026-11-19; plan test-feedback-2026-11-19 row C8; page
// M2, approved 2026-11-19 with fixes), on the shared P1-like character (layout.html?as=player&p1=1; Brannoch Fenward,
// src/testing/layoutP1Character.ts), in a real browser on a phone (375 px) and a tablet held sideways (1180 px), in
// light and dark. Purposes, in plain words:
//   1. A pop-up you only read (a save's) has the book's red heading, in capitals, in the book label's colour at 4.5 to 1
//      or more on the pop-up's ground, and ends with a plain "Got it" at the right, which closes it; its ✕ stays.
//   2. A pop-up you act in (Hit points) has the same red heading and keeps Set and Cancel, with no "Got it".
//   3. A status's pop-up sets "Source" as the book's labelled line and has no "Only the GM changes the time left.".
//   4. The Quiver has the red heading and its kind's name in the book's bold, with no "Got it"; the name starts at the
//      row's left and the button ends at its right (M2o), not both centred in the middle of the row.
//   5. On the tablet, the foot's Abilities or Traits row opens its list as a pop-up to read: "Got it" at its foot.
// Each: nothing runs past the screen, no target under 44 px, no text under 14 px (layoutProblems).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

async function openPlayer(page: Page, width: number, height: number, scheme: 'light' | 'dark', p1 = '1') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** The heading's look: its colour against the card's ground, its case, its size. */
async function heading(dialog: Locator) {
  return dialog.locator('.dialog__head .dialog__title').evaluate((title) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const [R, G, B] = [r!, g!, b!].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * R! + 0.7152 * G! + 0.0722 * B!;
    };
    const card = title.closest('.dialog')!;
    const [a, b] = [lum(rgb(getComputedStyle(title).color)), lum(rgb(getComputedStyle(card).backgroundColor))].sort((x, y) => y - x);
    return {
      book: title.classList.contains('book-heading'),
      upper: getComputedStyle(title).textTransform,
      size: parseFloat(getComputedStyle(title).fontSize),
      contrast: (a! + 0.05) / (b! + 0.05),
    };
  });
}

/** "Got it" sits at the foot, at the right, after everything else in the card. */
async function gotItAtFoot(dialog: Locator) {
  const got = dialog.getByRole('button', { name: 'Got it' });
  await expect(got).toBeVisible();
  await expect(got).toHaveClass('button-secondary');
  const at = await got.evaluate((button) => {
    const card = button.closest('.dialog')!.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    return { right: card.right - b.right, last: button.closest('.dialog__got-it') === button.closest('.dialog')!.lastElementChild };
  });
  expect(at.last).toBe(true);
  expect(at.right).toBeLessThan(40);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a save's pop-up reads in the book's format and ends with Got it (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      const tile = page.getByRole('button', { name: /: where it comes from$/ }).filter({ hasText: 'Mire' }).first();
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      const dialog = page.getByRole('dialog').last();
      await expect(dialog).toBeVisible();
      const look = await heading(dialog);
      expect(look.book).toBe(true);
      expect(look.upper).toBe('uppercase');
      expect(look.size).toBeGreaterThanOrEqual(20);
      expect(look.contrast).toBeGreaterThanOrEqual(4.5);
      await gotItAtFoot(dialog);
      expect(await layoutProblems(page)).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c8-save-${size.width}-${scheme}.png` });
      await dialog.getByRole('button', { name: 'Got it' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test(`Hit points keeps Set and Cancel under the red heading, no Got it (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Hit points 11 of 16\. Type a value$/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Hit points' });
      await expect(dialog.getByRole('button', { name: 'Set' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Got it' })).toHaveCount(0);
      const look = await heading(dialog);
      expect(look.book).toBe(true);
      expect(look.contrast).toBeGreaterThanOrEqual(4.5);
      expect(await layoutProblems(page)).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c8-hp-${size.width}-${scheme}.png` });
    });

    test(`a status's pop-up: the red heading, Source as a labelled line, no line on the GM (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Chilled, .*Details$/ }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Chilled' });
      await expect(dialog).toBeVisible();
      expect((await heading(dialog)).book).toBe(true);
      await expect(dialog.locator('.book-line .book-label').first()).toHaveText('Source');
      await expect(dialog.getByText('Only the GM changes the time left.')).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Got it' })).toHaveCount(0);
      expect(await layoutProblems(page)).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/tf-c8-status-${size.width}-${scheme}.png` });
    });

    test(`the Quiver: the red heading, the kind in the book's bold, no Got it (${size.name}, ${scheme})`, async ({ page }) => {
      await openPlayer(page, size.width, size.height, scheme, 'modes');
      const atHand = page.getByRole('region', { name: 'At hand' });
      await atHand.getByRole('button', { name: 'Quiver of Heron bow' }).click();
      const quiver = page.getByRole('dialog', { name: 'Quiver' });
      await expect(quiver).toBeVisible();
      expect((await heading(quiver)).book).toBe(true);
      expect(Number(await quiver.locator('.pick-row__name').first().evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
      const ends = await quiver.locator('.pick-row').first().evaluate((row) => {
        const r = row.getBoundingClientRect();
        const name = row.querySelector('.pick-row__name')!.getBoundingClientRect();
        const pick = row.querySelector('.pick-row__pick')!.getBoundingClientRect();
        return { left: name.left - r.left, right: r.right - pick.right };
      });
      expect(ends.left).toBeLessThan(2);
      expect(ends.right).toBeLessThan(2);
      await expect(quiver.getByRole('button', { name: 'Got it' })).toHaveCount(0);
      expect(await layoutProblems(page)).toEqual([]);
      await quiver.screenshot({ path: `test-results/layout-screens/tf-c8-quiver-${size.width}-${scheme}.png` });
    });
  }
}

for (const scheme of ['light', 'dark'] as const) {
  test(`on a tablet, the foot's list row opens a pop-up to read, with Got it (${scheme})`, async ({ page }) => {
    await openPlayer(page, 1180, 820, scheme);
    const row = page.locator('.player__right .list-row').filter({ hasText: /^(Abilities|Traits)/ }).first();
    await row.scrollIntoViewIfNeeded();
    const name = (await row.locator('.list-row__title').textContent())!.trim();
    await row.click();
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    expect((await heading(dialog)).book).toBe(true);
    await gotItAtFoot(dialog);
    expect(await layoutProblems(page)).toEqual([]);
    await dialog.screenshot({ path: `test-results/layout-screens/tf-c8-list-1180-${scheme}.png` });
  });
}

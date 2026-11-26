// K22's screens (batch K2: K22c, K22d, K22e; page 33, approved 2026-11-21), in a real browser on a phone (375 px) and
// a tablet held sideways (1180 px), in light and dark, on layout.html?k22=1 (Wren's Bronze ring, unidentified, and the
// Hooded lantern with nine hidden facts, a long true name and 999 charges). Purposes, in plain words:
//   1. The GM's sheet in the view shows "Reveal…" and "Edit what players see…" each at least 44 px high; the form
//      opens in its own form, the Sheet: from the foot on a phone, centred on a tablet; "Save" at least 44 px high; long
//      words grow the fields with nothing cut. No sideways scrolling, no text under 14 px, no small targets, no serious
//      accessibility problem.
//   2. The Reveal pop-up opens in the same form; each fact row is at least 56 px high, its "Tell" at least 44 px, with
//      at least 8 px between two "Tell"s; after a tap the toast is clear of every row and of "Tell them everything" on a
//      tablet, and above the sheet's top edge on a phone.
//   3. Nine facts: the list scrolls, the title and "Tell them everything" stay on screen.
//   4. Sam's sheet of the ring: its face, its look and "What you notice", laid out as cleanly.
//   5. Home Two's audit of #50 (Francis's picks, 26 Nov): on a phone the toast after "Tell them everything" on nine facts
//      sits above the sheet, never over its title or ✕ (finding 1); with everything told the list still takes focus
//      and axe finds nothing (finding 2); a toast still up when "What players see" opens sits above that form, not on
//      its fields (finding 3); "Its charges / Not set yet" is a tap that opens the blocked-action pop-up in its own
//      form, whole on screen, and its ✕ closes it alone (findings 4 and 5).
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openInView(page: Page, width: number, height: number, scheme: 'light' | 'dark', extra = '') {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height });
  await page.goto(`/layout.html?as=gm&k22=1${extra}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await page.getByRole('button', { name: "Open Wren of the Lantern Wardens's pack" }).click();
  await expect(page.getByRole('note')).toBeVisible();
}

/** The pop-up's form as K22b and K22i draw it: from the foot on a phone, centred on a tablet; whole on screen. */
async function expectSheetForm(dialog: Locator, width: number, height: number) {
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  if (width < 700) {
    await expect(dialog).toHaveClass(/dialog--sheet/);
    expect(Math.abs(box.y + box.height - height)).toBeLessThanOrEqual(1);
  } else {
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(2);
  }
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the GM's rows and "What players see" (${size.name}, ${scheme})`, async ({ page }) => {
      await openInView(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Bronze ring/ }).click();
      const sheet = page.getByRole('region', { name: 'Bronze ring' });
      for (const name of ['Reveal…', 'Edit what players see…']) expect((await sheet.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `test-results/layout-screens/k22-gm-sheet-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);

      await sheet.getByRole('button', { name: 'Edit what players see…' }).click();
      const form = page.getByRole('dialog', { name: 'What players see' });
      await page.screenshot({ path: `test-results/layout-screens/k22-form-open-${size.width}-${scheme}.png` });
      await expectSheetForm(form, size.width, size.height);
      expect((await form.getByRole('button', { name: 'Save' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Long words: the fields grow, nothing cut.
      await form.getByLabel('Appears as').fill('A hooded lantern of green glass, with a ring for the hand, and a shutter that sticks');
      await form.getByLabel('What you notice').fill('Cold to the hand, and no smell of oil. The glass is sea-green and thick as a bottle’s foot; held to the ear it hums, low, like a shell. The shutter sticks, and the ring is worn bright on one side only.');
      for (const label of ['Appears as', 'What you notice']) {
        const cut = await form.getByLabel(label).evaluate((el) => el.scrollHeight - el.clientHeight);
        expect(cut).toBeLessThanOrEqual(1);
      }
      await page.screenshot({ path: `test-results/layout-screens/k22-form-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`the Reveal pop-up, its rows and its toast (${size.name}, ${scheme})`, async ({ page }) => {
      await openInView(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Bronze ring/ }).click();
      await page.getByRole('region', { name: 'Bronze ring' }).getByRole('button', { name: 'Reveal…' }).click();
      const popup = page.getByRole('dialog', { name: 'Reveal' });
      await page.screenshot({ path: `test-results/layout-screens/k22-reveal-open-${size.width}-${scheme}.png` });
      await expectSheetForm(popup, size.width, size.height);
      const rows = popup.locator('.reveal-popup__row');
      const tells = popup.locator('.reveal-popup__tell');
      for (let i = 0; i < (await rows.count()); i++) expect((await rows.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(56);
      const boxes = await Promise.all((await tells.all()).map((t) => t.boundingBox()));
      for (const [i, box] of boxes.entries()) {
        expect(box!.height).toBeGreaterThanOrEqual(44);
        if (i > 0) expect(box!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height)).toBeGreaterThanOrEqual(8);
      }
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      await popup.getByRole('button', { name: 'Tell That it’s cursed' }).click();
      const toast = page.locator('.toast-host .toast');
      await expect(toast).toContainText('Told Wren of the Lantern Wardens: the Bronze ring is cursed.');
      const toastBox = (await toast.boundingBox())!;
      if (size.width < 700) {
        // Just above the sheet's top edge (K22i 3).
        expect(toastBox.y + toastBox.height).toBeLessThanOrEqual((await popup.boundingBox())!.y + 0.5);
      } else {
        // At the screen's foot, clear of every row and of the accent (K22e, pick 10).
        for (const row of await popup.locator('.reveal-popup__list > li').all()) expect(overlaps(toastBox, (await row.boundingBox())!)).toBe(false);
        expect(overlaps(toastBox, (await popup.getByRole('button', { name: 'Tell them everything' }).boundingBox())!)).toBe(false);
      }
      await page.screenshot({ path: `test-results/layout-screens/k22-reveal-told-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
    });

    test(`nine facts scroll between the title and the foot (${size.name}, ${scheme})`, async ({ page }) => {
      await openInView(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Hooded lantern/ }).click();
      await page.getByRole('region', { name: 'Hooded lantern' }).getByRole('button', { name: 'Reveal…' }).click();
      const popup = page.getByRole('dialog', { name: 'Reveal' });
      await expect(popup.locator('.reveal-popup__list > li')).toHaveCount(9);
      for (const part of [popup.getByRole('heading', { name: 'Reveal' }), popup.getByRole('button', { name: 'Tell them everything' })]) {
        const box = (await part.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
      await expect(popup.getByText('999 of 999 left')).toBeAttached();
      await page.screenshot({ path: `test-results/layout-screens/k22-reveal-nine-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`with everything told, the list still takes focus and axe finds nothing (${size.name}, ${scheme})`, async ({ page }) => {
      await openInView(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /^Hooded lantern/ }).click();
      await page.getByRole('region', { name: 'Hooded lantern' }).getByRole('button', { name: 'Reveal…' }).click();
      const popup = page.getByRole('dialog', { name: 'Reveal' });
      await popup.getByRole('button', { name: 'Tell them everything' }).click();
      await expect(popup.getByText('Nothing is left hidden.')).toBeVisible();
      const list = popup.getByRole('list', { name: 'What is hidden' });
      await expect(list).toHaveAttribute('tabindex', '0');
      await list.focus();
      await expect(list).toBeFocused();
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`"Its charges / Not set yet" opens the blocked-action pop-up in its own form (${size.name}, ${scheme})`, async ({ page }) => {
      await openInView(page, size.width, size.height, scheme, '&k22charges=unset');
      await page.getByRole('button', { name: /^Hooded lantern/ }).click();
      await page.getByRole('region', { name: 'Hooded lantern' }).getByRole('button', { name: 'Reveal…' }).click();
      const popup = page.getByRole('dialog', { name: 'Reveal' });
      const row = popup.getByRole('button', { name: 'Its charges: Not set yet' });
      await expect(row).toBeVisible();
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(56);
      await row.click();
      const why = page.getByRole('dialog', { name: 'Set its charges first' });
      await expect(why).toContainText('Players › Inventory › Whose pack');
      await expectSheetForm(why, size.width, size.height);
      const box = (await why.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height + 0.5);
      await page.screenshot({ path: `test-results/layout-screens/k22-charges-unset-${size.width}-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await why.getByRole('button', { name: 'Close' }).click();
      await expect(why).toHaveCount(0);
      await expect(popup).toBeVisible();
    });

    test(`Sam's sheet of the untold ring (${size.name}, ${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/layout.html?as=player&k22=1');
      await page.getByRole('button', { name: /The Drowned Marches/ }).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
      await page.getByRole('button', { name: /^Bronze ring/ }).click();
      const sheet = page.getByRole('region', { name: 'Bronze ring' });
      await expect(sheet).toContainText('A plain band of old bronze.');
      await expect(sheet).toContainText('What you notice. Cold to the touch, even by the fire.');
      await expect(sheet).not.toContainText('Drowned Bell');
      await page.screenshot({ path: `test-results/layout-screens/k22-player-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
}

// On a phone only: the two places a toast met a phone sheet in Home Two's audit of #50 (findings 1 and 3).
for (const scheme of ['light', 'dark'] as const) {
  test(`the toast after "Tell them everything" on nine facts sits above the sheet, clear of its title and ✕ (phone, ${scheme})`, async ({ page }) => {
    await openInView(page, 375, 812, scheme);
    await page.getByRole('button', { name: /^Hooded lantern/ }).click();
    await page.getByRole('region', { name: 'Hooded lantern' }).getByRole('button', { name: 'Reveal…' }).click();
    const popup = page.getByRole('dialog', { name: 'Reveal' });
    await popup.getByRole('button', { name: 'Tell them everything' }).click();
    const toast = page.locator('.toast-host .toast');
    await expect(toast).toContainText('everything about The Old Lantern of the Drowned and of the Nine Tides');
    await expect(popup.getByText('Nothing is left hidden.')).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    expect(toastBox.y).toBeGreaterThanOrEqual(0);
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual((await popup.boundingBox())!.y + 0.5);
    for (const part of [popup.getByRole('heading', { name: 'Reveal' }), popup.getByRole('button', { name: 'Close' })]) expect(overlaps(toastBox, (await part.boundingBox())!)).toBe(false);
    await page.screenshot({ path: `test-results/layout-screens/k22-reveal-nine-told-375-${scheme}.png` });
    expect(await layoutProblems(page)).toEqual([]);
  });

  test(`a toast still up when "What players see" opens sits above the form, off its fields (phone, ${scheme})`, async ({ page }) => {
    await openInView(page, 375, 812, scheme);
    await page.getByRole('button', { name: /^Bronze ring/ }).click();
    const sheet = page.getByRole('region', { name: 'Bronze ring' });
    await sheet.getByRole('button', { name: 'Reveal…' }).click();
    const popup = page.getByRole('dialog', { name: 'Reveal' });
    await popup.getByRole('button', { name: 'Tell That it’s cursed' }).click();
    const toast = page.locator('.toast-host .toast');
    await expect(toast).toContainText('the Bronze ring is cursed');
    await popup.getByRole('button', { name: 'Close' }).click();
    await sheet.getByRole('button', { name: 'Edit what players see…' }).click();
    const form = page.getByRole('dialog', { name: 'What players see' });
    await expect(form).toBeVisible();
    await expect(toast).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual((await form.boundingBox())!.y + 0.5);
    await page.screenshot({ path: `test-results/layout-screens/k22-form-toast-375-${scheme}.png` });
  });
}

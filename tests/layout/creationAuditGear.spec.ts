// Same-name purchases as one row on creation's Gear step (plan dec-15 row 2; caf-1 to caf-3, caf-10; page 41 frames
// 41-2-gear-merged and 41-2-fix-gear-undo-last, approved 2026-11-24 with fixes), in a real browser on a phone (375 px)
// and a tablet held sideways (1180 px), in light and dark. Purposes, in plain words:
//   1. Three Bog slings and a Reed rope bought show as two rows, "Bog sling ×3, 4 gp 5 sp" with "Put back one" and
//      "Reed rope, 1 gp" with "Put back"; the rows' buttons are 44 px tall and 8 px apart; nothing runs past the screen,
//      nothing is under 14 px, and it passes the accessibility check.
//   2. Beside Undo last a quiet line, 14 px, names what it takes back, "Last bought: Reed rope"; a long name wraps there,
//      beside the button, with no sideways scroll.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

/** Guided creation in The Fen Muster to the Gear step, the coin left at its average. */
async function toGear(page: Page) {
  await page.getByRole('button', { name: /The Fen Muster/ }).click();
  await page.getByRole('button', { name: 'Create your character' }).click();
  await page.getByRole('button', { name: /^Guided/ }).click();
  const h1 = () => page.getByRole('heading', { level: 1 }).first();
  // A one-of-many pick moves on by itself (ct-1); otherwise Next.
  const pick = async (name: string) => {
    const title = await h1().textContent();
    await page.getByRole('checkbox', { name: `Pick ${name}` }).click();
    await page.waitForTimeout(150);
    if ((await h1().textContent()) === title) await page.getByRole('button', { name: 'Next', exact: true }).click();
  };
  await expect(h1()).toHaveText(/^Scores/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await pick('Bog folk');
  await pick('Lantern Warden');
  if ((await h1().textContent()) === 'Adjust scores') await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(h1()).toHaveText('Who they are');
  await page.getByLabel('Name').first().fill('Tam');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(h1()).toHaveText(/^Gear/);
}

/** Buys one of a thing that doesn't stack from the shop, found by its search. */
async function buy(page: Page, name: string, price: string) {
  await page.getByLabel('Search items').fill(name);
  const money = page.locator('.gear-tally__money');
  const before = await money.textContent();
  await page.getByRole('button', { name: `Buy ${name}, ${price}` }).click();
  // Bought once the coin to spend has moved.
  await expect(money).not.toHaveText(before ?? '');
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Gear: same-name purchases as one row, and Last bought beside Undo last (${size.name}, ${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/layout.html?as=new&gear=1');
      await toGear(page);
      await page.getByRole('button', { name: 'Open The shop' }).click();
      for (let i = 0; i < 3; i++) await buy(page, 'Bog sling', '1 gp 5 sp');
      await buy(page, 'Reed rope', '1 gp');
      await page.getByRole('button', { name: 'Done shopping' }).click();

      const rows = page.locator('.starting-gear__line');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0).locator('span')).toHaveText('Bog sling ×3, 4 gp 5 sp');
      await expect(rows.nth(0).getByRole('button')).toHaveText('Put back one');
      await expect(rows.nth(0).getByRole('button')).toHaveAccessibleName('Put back one Bog sling, 1 gp 5 sp back');
      await expect(rows.nth(1).locator('span')).toHaveText('Reed rope, 1 gp');
      await expect(rows.nth(1).getByRole('button')).toHaveText('Put back');
      const [one, two] = [await rows.nth(0).getByRole('button').boundingBox(), await rows.nth(1).getByRole('button').boundingBox()];
      expect(one!.height).toBeGreaterThanOrEqual(44);
      expect(two!.height).toBeGreaterThanOrEqual(44);
      expect(Math.round(two!.y - (one!.y + one!.height))).toBeGreaterThanOrEqual(8);

      const lastLine = page.locator('.gear-tally__last');
      await expect(lastLine).toHaveText('Last bought: Reed rope');
      const undo = page.getByRole('button', { name: 'Undo last' });
      const [undoBox, lineBox] = [await undo.boundingBox(), await lastLine.boundingBox()];
      // Beside the button, on its row.
      expect(lineBox!.x).toBeGreaterThan(undoBox!.x + undoBox!.width);
      expect(lineBox!.y).toBeLessThan(undoBox!.y + undoBox!.height);
      expect(await lastLine.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await page.locator('.starting-gear__bought').screenshot({ path: `test-results/layout-screens/creation-audit-gear-rows-${size.width}-${scheme}.png` });
      await page.locator('.gear-tally').screenshot({ path: `test-results/layout-screens/creation-audit-gear-last-${size.width}-${scheme}.png` });

      // A long name wraps beside the button (frame 41-2-fix-gear-undo-last-long-name): the words set in place, as the
      // fixture has no long item name.
      await lastLine.evaluate((el) => (el.textContent = 'Last bought: Eel knife of the Seventh Sluice-Gate, tarred twice'));
      const wrapped = await lastLine.boundingBox();
      expect(wrapped!.x).toBeGreaterThan(undoBox!.x + undoBox!.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await layoutProblems(page)).toEqual([]);
      await page.locator('.gear-tally').screenshot({ path: `test-results/layout-screens/creation-audit-gear-last-long-${size.width}-${scheme}.png` });

      // Put back one: the row reads ×2.
      await rows.nth(0).getByRole('button').click();
      await expect(rows.nth(0).locator('span')).toHaveText('Bog sling ×2, 3 gp');
    });
  }
}

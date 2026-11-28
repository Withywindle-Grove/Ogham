// Add item and after a purchase (K7 of docs/plans/dec-6-the-whole-pack-tab.md; frame PK10b of
// docs/design/mockups/pack/08-the-pack-tab-whole.html, approved 2026-11-14, ap-7), in a real browser at 375 px and on a
// landscape tablet (1180 px), light and dark, on the layout page's invented coin (`layout.html?as=player&coin=1`).
// Each test saves its screen under test-results/layout-screens/k7-*.png, to set beside PK10b. Purposes:
//   1. Add item, one thing: the two-sided switch, the cost above Where it goes and the button, in the coin words.
//   2. After "Bought", the toast with two actions ("Spend 4 herons" first, Undo at the right where it can undo; here
//      the lantern is a new line, so Spend alone): its words wrap inside it, its buttons stay on the screen and 44 px.
//   3. The Spend sheet opened from the toast, with 4 in the Herons box and one accent "Spend 4 herons".
// Each: nothing scrolls sideways, no tap target under 44 px, no text under 14 px, no serious accessibility problem.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;

async function openAddItem(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto('/layout.html?as=player&coin=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toBeAttached();
  await page.getByRole('button', { name: 'Add item' }).first().click();
  await page.getByLabel('Search items').fill('storm');
  await page.getByRole('button', { name: /Storm lantern/ }).click();
  await expect(page.getByLabel('Cost')).toHaveValue('4 herons');
  await page.evaluate(() => document.fonts.ready);
}

async function bought(page: Page) {
  await page.getByRole('button', { name: /^Add to / }).click();
  await expect(page.locator('.toast__text')).toHaveText('Wren of the Lantern Wardens added Storm lantern. Its cost, 4 herons, is not spent yet.');
}

/** A built picture, once the book's faces have loaded and a sheet has finished sliding in (the toast's bar runs on). */
async function shot(page: Page, name: string, width: number, scheme: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const settling = document.getAnimations().filter((a) => !(a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && a.effect.target.closest('.toast')));
    await Promise.all(settling.map((a) => a.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: `test-results/layout-screens/k7-${name}-${width}-${scheme}.png` });
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`K7 (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('Add item, one thing: the switch, the cost above Where it goes and the button', async ({ page }) => {
        await openAddItem(page, scheme);
        const how = page.getByRole('group', { name: 'How does Wren of the Lantern Wardens get it?' });
        await expect(how).toHaveClass(/button-row--switch/);
        const cost = (await page.getByLabel('Cost').boundingBox())!;
        const where = (await page.getByRole('radiogroup', { name: 'Where it goes' }).boundingBox())!;
        const add = (await page.getByRole('button', { name: /^Add to / }).boundingBox())!;
        expect(cost.y + cost.height).toBeLessThanOrEqual(where.y + 1);
        expect(cost.y + cost.height).toBeLessThanOrEqual(add.y + 1);
        await shot(page, 'add-item', size.width, scheme);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      test('after Bought: the toast says the cost is not spent and offers Spend 4 herons, on the screen', async ({ page }) => {
        await openAddItem(page, scheme);
        await bought(page);
        const toast = page.locator('.toast');
        const spend = toast.getByRole('button', { name: 'Spend 4 herons' });
        await expect(spend).toBeVisible();
        const box = (await toast.boundingBox())!;
        const button = (await spend.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width);
        await shot(page, 'toast', size.width, scheme);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      test('Spend 4 herons opens the Spend sheet with the amount filled in and one accent', async ({ page }) => {
        await openAddItem(page, scheme);
        await bought(page);
        await page.locator('.toast').getByRole('button', { name: 'Spend 4 herons' }).click();
        const sheet = page.getByRole('dialog', { name: 'Spend' });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByRole('textbox', { name: 'Herons' })).toHaveValue('4');
        // What for is the thing's name (Francis, 26 Nov, ⚑ 3 on #108).
        await expect(sheet.getByLabel('What for')).toHaveValue('Storm lantern');
        await expect(sheet.locator('.button-primary')).toHaveCount(1);
        await expect(sheet.getByRole('button', { name: 'Spend 4 herons' })).toBeVisible();
        await sheet.getByLabel('What for').scrollIntoViewIfNeeded();
        await shot(page, 'spend', size.width, scheme);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

// The toast with both of its actions (K7): bought arrows join Wren's reed arrows, so Undo stands beside Spend.
for (const size of SIZES) {
  test.describe(`K7 toast with Spend and Undo (${size.name}, ${size.width} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const scheme of ['light', 'dark'] as const) {
      test(`${scheme}: Spend first, Undo at the right, both on the screen and 44 px`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('/layout.html?as=player&coin=1');
        await page.getByRole('button', { name: /The Drowned Marches/ }).click();
        await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
        await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toBeAttached();
        await page.getByRole('button', { name: 'Add item' }).first().click();
        await page.getByLabel('Search items').fill('reed arrows');
        await page.getByRole('region', { name: 'Add an item' }).getByRole('button', { name: /Reed arrows/ }).click();
        await page.getByRole('button', { name: 'One more' }).click();
        await page.getByRole('button', { name: /^Add to / }).click();
        await expect(page.locator('.toast__text')).toHaveText('Wren of the Lantern Wardens added Reed arrows ×2. Its cost, 2 bits, is not spent yet.');
        const toast = page.locator('.toast');
        const spend = (await toast.getByRole('button', { name: 'Spend 2 bits' }).boundingBox())!;
        const undo = (await toast.getByRole('button', { name: 'Undo' }).boundingBox())!;
        const box = (await toast.boundingBox())!;
        expect(spend.x).toBeLessThan(undo.x);
        expect(undo.x + undo.width).toBeLessThanOrEqual(box.x + box.width);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        expect(Math.min(spend.height, undo.height)).toBeGreaterThanOrEqual(44);
        await shot(page, 'toast-undo', size.width, scheme);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }
  });
}

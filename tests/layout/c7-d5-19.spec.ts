// The burden's levels as a pop-up in the GM's character overview and creation's Gear step (d5-19, 2026-11-20; row C7
// of plan test-feedback-2026-11-19; the pop-up is frame M2h of december/26, approved 2026-11-19 with fixes), in a real
// browser on a phone (375 px) and a tablet held sideways (1180 px), in light and dark. Purposes, in plain words:
//   1. In the GM's overview of Wren (itself a pop-up), a tap on the burden opens the "Burden" pop-up over it. The
//      pop-up keeps its own form, the Sheet in the book's format as on the Player tab, not the overview's card; the
//      overview stays open and its load doesn't move; nothing opens in place; nothing runs past the screen, nothing is
//      under 14 px, and it passes the accessibility check. Escape closes the Burden pop-up alone and focus is back on
//      the burden.
//   2. In creation's Gear step (?gear=1, a kit taken), the same tap opens the same pop-up in the same form, and the
//      step under it doesn't move; Escape closes it and focus is back on the burden.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

/** Where a part of the page sits, rounded: the page under the pop-up must keep it. */
const placeOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  return box && { x: Math.round(box.x), y: Math.round(box.y), height: Math.round(box.height) };
};

/** The smallest text in the pop-up, in px. */
const smallestText = (dialog: Locator) =>
  dialog.evaluate((el) => Math.min(...[...el.querySelectorAll<HTMLElement>('p, td, th, caption, span, h2')].filter((n) => n.textContent?.trim()).map((n) => parseFloat(getComputedStyle(n).fontSize))));

async function setUp(page: Page, width: number, height: number, scheme: 'light' | 'dark', url: string) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto(url);
}

/** Guided creation in The Fen Muster to the Gear step, with the Warden's kit taken (the load shows a tier). */
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
  await page.getByRole('checkbox', { name: "Pick Warden's kit" }).click();
}

/** The Burden pop-up in its own form: the Sheet, in the book's format (red heading, "Got it"), as on the Player tab. */
async function expectBurden(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Burden' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/\bdialog--sheet\b/);
  await expect(dialog).toHaveClass(/\bdialog--book\b/);
  await expect(dialog.getByRole('button', { name: 'Got it' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Burden by weight' })).toBeVisible();
  await expect(dialog.locator('.book-table__marked')).toHaveCount(1);
  await expect(page.locator('.pack__explain')).toHaveCount(0);
  return dialog;
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`GM's overview: the burden opens its levels in a pop-up of its own form, over the overview (${size.name}, ${scheme})`, async ({ page }) => {
      await setUp(page, size.width, size.height, scheme, '/layout.html?as=gm');
      await page.getByRole('button', { name: /The Drowned Marches/ }).click();
      await page.getByRole('button', { name: /^Wren of the Lantern Wardens\b.*\. Details$/ }).click();
      const overview = page.getByRole('dialog', { name: 'Wren of the Lantern Wardens' });
      const tier = overview.locator('.pack__tier');
      await expect(tier).toBeVisible();
      await expect(tier).toHaveAttribute('aria-haspopup', 'dialog');
      await tier.scrollIntoViewIfNeeded();
      const load = await placeOf(overview.locator('.pack__load'));
      await tier.click();
      const dialog = await expectBurden(page);
      await expect(overview).toBeVisible();
      await expect(overview).not.toHaveClass(/\bdialog--book\b/);
      expect(await placeOf(overview.locator('.pack__load'))).toEqual(load);
      expect(await smallestText(dialog)).toBeGreaterThanOrEqual(14);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '.dialog--book')).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/c7-d5-19-overview-${size.width}-${scheme}.png` });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(overview).toBeVisible();
      await expect(tier).toBeFocused();
    });

    test(`Creation's Gear step: the burden opens the same pop-up and the step doesn't move (${size.name}, ${scheme})`, async ({ page }) => {
      await setUp(page, size.width, size.height, scheme, '/layout.html?as=new&gear=1');
      await toGear(page);
      const tier = page.locator('.gear-tally__load .pack__tier');
      await expect(tier).toHaveText('Light, speed 125');
      await expect(tier).toHaveAttribute('aria-haspopup', 'dialog');
      await tier.scrollIntoViewIfNeeded();
      const load = await placeOf(page.locator('.gear-tally__load'));
      await tier.click();
      const dialog = await expectBurden(page);
      expect(await placeOf(page.locator('.gear-tally__load'))).toEqual(load);
      expect(await smallestText(dialog)).toBeGreaterThanOrEqual(14);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      await dialog.screenshot({ path: `test-results/layout-screens/c7-d5-19-gear-${size.width}-${scheme}.png` });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(tier).toBeFocused();
    });
  }
}

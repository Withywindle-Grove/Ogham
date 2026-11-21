// Rows C2 and C3 of docs/plans/test-feedback-2026-11-19.md (tfh-1 to tfh-6; page M2, frames M2l to M2o, approved
// 2026-11-19): the Player tab's At hand pop-up and the Quiver, in a real browser, on the shared P1-like character
// (`layout.html?as=player&p1=…`). Purposes:
//   A weapon in hand's name opens its pop-up: the Attack view's rolls, the Pin star beside ✕, then Give to…, Put in…,
//   Hide from At hand and Drop, each row with its icon at the left and a 44 px target, 8 px apart at least; nothing in
//   it under 14 px; nothing past the pop-up's edges, and the page never scrolls sideways.
//   A long weapon name wraps in the pop-up's head and still leaves the star and ✕ their 44 px.
//   The Quiver lists only the kinds carried (the Heron bow's reed arrows, not its bone arrows), with no line over or
//   under its rows; a wand's pop-up says its charges and keeps to the same shape.
//   The Quiver's rows are plain (frame M2o; Francis on #1069's ⚑ 2, 2026-11-19): no box, wash or edge on the row, a
//   dotted rule under it, its button at the right, 44 px tall, and only a picked row's button washed.
// At 375 px (a phone) and 1024 px (a tablet).
import { expect, test, type Locator, type Page } from '@playwright/test';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const;

async function openPlayer(page: Page, p1: string, size: (typeof SIZES)[number]) {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Every text in the pop-up is 14 px or more; nothing passes its edges; the page does not scroll sideways. */
async function fits(page: Page, dialog: Locator) {
  const smallest = await dialog.evaluate((root) =>
    Math.min(...[...root.querySelectorAll('*')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())).map((el) => parseFloat(getComputedStyle(el).fontSize))),
  );
  expect(smallest).toBeGreaterThanOrEqual(14);
  const outer = (await dialog.boundingBox())!;
  for (const inner of await dialog.locator('button, .list-row, .roll-row').all()) {
    const box = await inner.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(outer.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

for (const size of SIZES) {
  test(`a weapon in hand opens its At hand pop-up: the rolls, the star, four rows with their icons (${size.name}, ${size.width} px)`, async ({ page }) => {
    await openPlayer(page, '1', size);
    await page.getByRole('region', { name: 'Weapon in hand' }).getByRole('button', { name: /^Reed spear/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Reed spear' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.roll-row').first()).toBeVisible();
    await expect(dialog.getByText(/\b(Slot|Hands|Value|Weight)\b/)).toHaveCount(0);
    const rows = dialog.locator('.at-hand-popup .list-row--icon');
    await expect(rows.locator('.list-row__title')).toHaveText(['Give to…', 'Put in…', 'Hide from At hand', 'Drop']);
    await expect(rows.locator('.list-row__icon svg')).toHaveCount(4);
    // The words are plain, as frame PK8 draws them, not the Reminders' bold names.
    expect(await rows.first().locator('.list-row__title').evaluate((el) => getComputedStyle(el).fontWeight)).toBe('400');
    // Read in one go, so a sheet still sliding up on a phone can't move between two reads.
    const boxes = await dialog.evaluate((root) => [...root.querySelectorAll('.at-hand-popup .list-row--icon button')].map((b) => b.getBoundingClientRect()).map((r) => ({ y: r.y, height: r.height })));
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
    for (const [a, b] of boxes.slice(1).map((b, i) => [boxes[i]!, b] as const)) expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 0.5);
    // The star beside ✕, each a 44 px target, 8 px apart at least.
    const star = (await dialog.getByRole('button', { name: 'Pin to top' }).boundingBox())!;
    const close = (await dialog.getByRole('button', { name: 'Close' }).boundingBox())!;
    for (const b of [star, close]) expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    expect(close.x - (star.x + star.width)).toBeGreaterThanOrEqual(8 - 0.5);
    await fits(page, dialog);
  });

  test(`a long weapon name wraps in the pop-up's head and leaves the star and ✕ whole (${size.name}, ${size.width} px)`, async ({ page }) => {
    await openPlayer(page, 'weapon', size);
    await page.getByRole('region', { name: 'Weapon in hand' }).getByRole('button', { name: /^Hooked eel-spear/ }).click();
    const dialog = page.getByRole('dialog', { name: /^Hooked eel-spear/ });
    await expect(dialog).toBeVisible();
    for (const name of ['Pin to top', 'Close']) {
      const box = (await dialog.getByRole('button', { name }).boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    await fits(page, dialog);
  });

  test(`the Quiver lists only the kinds carried; a wand's pop-up says its charges (${size.name}, ${size.width} px)`, async ({ page }) => {
    await openPlayer(page, 'modes', size);
    const atHand = page.getByRole('region', { name: 'At hand' });
    await atHand.getByRole('button', { name: 'Quiver of Heron bow' }).click();
    const quiver = page.getByRole('dialog', { name: 'Quiver' });
    await expect(quiver).toBeVisible();
    await expect(quiver.getByRole('checkbox')).toHaveCount(1);
    await expect(quiver.getByText('Reed arrows')).toBeVisible();
    await expect(quiver.getByText('Bone arrows')).toHaveCount(0);
    await expect(quiver.getByText(/Each shot uses one|Out of a kind/)).toHaveCount(0);
    // The row as M2o draws it: plain, whether or not it is picked; only the picked button carries the wash.
    const look = await quiver.locator('.pick-row').first().evaluate((row) => {
      const s = getComputedStyle(row);
      const button = row.querySelector('.pick-row__pick')!;
      const b = button.getBoundingClientRect();
      const body = row.querySelector('.pick-row__body')!.getBoundingClientRect();
      return {
        background: s.backgroundColor,
        start: s.borderInlineStartWidth,
        top: s.borderTopWidth,
        under: s.borderBottomStyle,
        picked: button.getAttribute('aria-checked') === 'true',
        buttonWash: getComputedStyle(button).backgroundColor,
        height: b.height,
        beside: b.x >= body.x + body.width - 0.5,
      };
    });
    expect(look.background).toBe('rgba(0, 0, 0, 0)');
    expect(look.start).toBe('0px');
    expect(look.top).toBe('0px');
    expect(look.under).toBe('dotted');
    expect(look.height).toBeGreaterThanOrEqual(44);
    expect(look.beside).toBe(true);
    // The bow's one carried kind is the one in use: its row unwashed, its button washed.
    expect(look.picked).toBe(true);
    expect(look.buttonWash).not.toBe('rgba(0, 0, 0, 0)');
    await fits(page, quiver);
    await quiver.getByRole('button', { name: 'Close' }).click();
    await expect(quiver).toHaveCount(0);
    await atHand.getByRole('button', { name: /^Heron wand/ }).click();
    const wand = page.getByRole('dialog', { name: 'Heron wand' });
    await expect(wand.getByText('Charges 5 left')).toBeVisible();
    await expect(wand.getByRole('button', { name: 'Unpin' })).toBeVisible();
    await expect(wand.locator('.at-hand-popup .list-row--icon .list-row__title')).toHaveText(['Give to…', 'Drop']);
    await fits(page, wand);
  });
}

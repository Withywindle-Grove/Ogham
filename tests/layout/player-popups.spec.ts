// Two small pop-ups of the Player screen built to the rules in force (plan test-feedback-2026-11-19, rows A1 and A2;
// Francis's test notes, items 2 and 3; no frame draws either pop-up), on the shared P1-like character
// (layout.html?as=player&p1=1), in WebKit on a phone (375 px) and a tablet held sideways (1180 px). Purposes, in plain
// words:
//   1. In the Portrait pop-up, once a picture is chosen, "Change portrait" and "Remove portrait" sit side by side at one
//      height and in one size of words (p2p-16, 2026-11-18: controls side by side in one row share one height).
//   2. In the Portrait pop-up, the circle is centred and 128 px (twice `--space-8`), and Change and Remove end at the
//      same right edge as Save portrait below them (Francis on the built picture, 19 Nov: "top buttons and bottom
//      button should be aligned right. Portrait circle should be centered and larger."); the buttons block is
//      centred under the circle, its middle the circle's, while the title and ✕ keep the pop-up's full width (Francis
//      on the next pictures, 19 Nov: "keep relative positions and center").
//   3. In the Hit points pop-up, "Set" and "Cancel" measure one height (p2p-16), Set first, in one row directly under
//      the number box, the pair ending at the box's right edge (Francis, 19 Nov: "the buttons should be under the
//      fillable box"). "Max hit points" draws the same form and foot (`HpFoot` in HpInPlace.tsx).
//   4. On a tablet the Hit points pop-up is no wider than its content: no empty area right of the box (Francis, 19 Nov:
//      "why is the box so wide? ... too much blank space at the top right"); on a phone its column (label, box, Set
//      and Cancel) is centred in the sheet as one group, the label still starting where the box starts.
//   5. Both pop-ups fit a 375 px phone with nothing under 14 px and no sideways scroll, in light and dark.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

// A small picture, made in the page itself, given to the pop-up's file input as a player's photo would be.
async function choosePicture(dialog: Locator) {
  await dialog.locator('input[type="file"]').evaluate(async (input: HTMLInputElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#6b8f71';
    context.fillRect(0, 0, 64, 64);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const files = new DataTransfer();
    files.items.add(new File([blob], 'lantern.png', { type: 'image/png' }));
    input.files = files.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function openPortrait(page: Page) {
  await page.getByRole('button', { name: /^Add a portrait for Brannoch/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Portrait' });
  await expect(dialog).toBeVisible();
  await choosePicture(dialog);
  await expect(dialog.getByRole('button', { name: 'Remove portrait' })).toBeVisible();
  await settled(page);
  return dialog;
}

async function openHitPoints(page: Page) {
  await page.getByRole('button', { name: /^Hit points 11 of 16\. Type a value$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Hit points' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  return dialog;
}

// On a phone a sheet slides up from the bottom: wait until it has stopped before measuring or taking its picture.
async function settled(page: Page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.dialog__backdrop')].every((b) => b.getAnimations({ subtree: true }).every((a) => a.playState !== 'running')));
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  test(`the Portrait pop-up's Change and Remove share one height and one size of words (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    const dialog = await openPortrait(page);
    await expect(dialog.locator('.portrait-picker__change')).toHaveText('Change portrait');
    // Both read in one go: on a phone the sheet may still be sliding up, so two separate reads would see two tops.
    const [a, b] = await dialog.locator('.portrait-picker__actions').evaluate((row) =>
      [row.querySelector('.portrait-picker__change')!, row.querySelector('button')!].map((node) => ({ height: node.getBoundingClientRect().height, top: node.getBoundingClientRect().top, font: getComputedStyle(node).fontSize })),
    ) as [{ height: number; top: number; font: string }, { height: number; top: number; font: string }];
    expect(await dialog.locator('.portrait-picker__actions button').textContent()).toBe('Remove portrait');
    expect(Math.abs(a.height - b.height), `Change ${a.height} px, Remove ${b.height} px`).toBeLessThanOrEqual(0.5);
    expect(a.height, 'a 44 px tap').toBeGreaterThanOrEqual(43.5);
    expect(a.font).toBe(b.font);
    // Side by side, the two share a row (one height is about the row, so check they are in one).
    expect(Math.abs(a.top - b.top)).toBeLessThanOrEqual(0.5);
    await page.screenshot({ path: `test-results/layout-screens/player-popup-portrait-${size.width}-light.png` });
  });

  test(`the Portrait pop-up's circle is centred and larger, and its buttons block is centred under it, Change and Remove ending where Save portrait ends (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    const dialog = await openPortrait(page);
    const m = await dialog.evaluate((card) => {
      const box = (el: Element) => el.getBoundingClientRect();
      const style = getComputedStyle(card);
      const c = box(card);
      const contentLeft = c.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      const contentRight = c.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      const circle = box(card.querySelector('.portrait-picker__chosen > .portrait')!);
      const change = box(card.querySelector('.portrait-picker__change')!);
      const remove = box(card.querySelector('.portrait-picker__actions > button')!);
      const save = box(card.querySelector('.dialog__actions > .button-primary')!);
      const head = box(card.querySelector('.dialog__head')!);
      return {
        contentLeft,
        contentRight,
        circle: { left: circle.left, right: circle.right, width: circle.width, height: circle.height },
        blockLeft: Math.min(change.left, save.left),
        removeRight: remove.right,
        saveRight: save.right,
        headLeft: head.left,
        // The head reaches a step past the padding on purpose (Dialog.css, its negative inline-end margin).
        headRight: head.right + parseFloat(getComputedStyle(card.querySelector('.dialog__head')!).marginRight),
      };
    });
    expect(m.circle.width, 'twice --space-8').toBeCloseTo(128, 0);
    expect(m.circle.height).toBeCloseTo(128, 0);
    const middle = (m.contentLeft + m.contentRight) / 2;
    const circleMiddle = (m.circle.left + m.circle.right) / 2;
    expect(Math.abs(circleMiddle - middle), 'the circle centred in the pop-up').toBeLessThanOrEqual(1);
    expect(Math.abs(m.removeRight - m.saveRight), `Remove ends at ${m.removeRight}, Save portrait at ${m.saveRight}`).toBeLessThanOrEqual(1);
    const blockMiddle = (m.blockLeft + m.saveRight) / 2;
    expect(Math.abs(blockMiddle - circleMiddle), `the buttons block's middle ${blockMiddle}, the circle's ${circleMiddle}`).toBeLessThanOrEqual(1);
    // The title and ✕ stay where they were: across the pop-up's whole width.
    expect(Math.abs(m.headLeft - m.contentLeft), 'the title at the left').toBeLessThanOrEqual(1);
    expect(Math.abs(m.headRight - m.contentRight), 'the ✕ at the right').toBeLessThanOrEqual(1);
  });

  test(`the Hit points pop-up's Set and Cancel share one height, in one row directly under the box, Set first (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    const dialog = await openHitPoints(page);
    const measured = await dialog.evaluate((card) => {
      const read = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
      };
      const style = getComputedStyle(card);
      const contentLeft = card.getBoundingClientRect().left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      const contentRight = card.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      const foot = card.querySelector('.dialog__actions')!;
      return {
        contentLeft,
        contentRight,
        form: read(card.querySelector('form')!),
        label: read(card.querySelector('form > label')!),
        head: { right: card.querySelector('.dialog__head')!.getBoundingClientRect().right + parseFloat(getComputedStyle(card.querySelector('.dialog__head')!).marginRight) },
        gap: parseFloat(getComputedStyle(card.querySelector('form')!).rowGap),
        input: read(card.querySelector('input')!),
        foot: read(foot),
        buttons: [...foot.querySelectorAll(':scope > button')].map((b) => ({ ...read(b), text: b.textContent })),
      };
    });
    expect(measured.buttons.map((b) => b.text)).toEqual(['Set', 'Cancel']);
    const [set, cancel] = measured.buttons as [(typeof measured.buttons)[number], (typeof measured.buttons)[number]];
    expect(Math.abs(set.height - cancel.height), `Set ${set.height} px, Cancel ${cancel.height} px`).toBeLessThanOrEqual(0.5);
    expect(set.height, 'a 44 px tap').toBeGreaterThanOrEqual(43.5);
    expect(Math.abs(set.top - cancel.top), 'side by side in one row').toBeLessThanOrEqual(0.5);
    expect(set.right, 'Set before Cancel').toBeLessThan(cancel.left);
    expect(cancel.left - set.right, '8 px between').toBeGreaterThanOrEqual(7.5);
    // Directly under the box: the next line down, one gap below it, in the box's own column.
    expect(Math.abs(measured.foot.top - measured.input.bottom - measured.gap), 'directly under the box').toBeLessThanOrEqual(1);
    expect(Math.abs(measured.foot.left - measured.input.left), 'the foot starts where the box starts').toBeLessThanOrEqual(1);
    expect(Math.abs(measured.foot.right - measured.input.right), 'the foot is as wide as the box').toBeLessThanOrEqual(1);
    expect(Math.abs(cancel.right - measured.input.right), `Cancel ends at ${cancel.right}, the box at ${measured.input.right}`).toBeLessThanOrEqual(1);
    expect(set.left, "Set within the box's column").toBeGreaterThanOrEqual(measured.input.left - 0.5);
    if (size.width >= 700) {
      // On a tablet the pop-up is no wider than its content: the box's column reaches the card's right edge.
      expect(Math.abs(measured.contentRight - measured.input.right), `the box ends at ${measured.input.right}, the pop-up's edge at ${measured.contentRight}`).toBeLessThanOrEqual(1);
    }
    // The column is one group centred in the pop-up (on a tablet it fills it), the label starting where the box starts.
    const formMiddle = (measured.form.left + measured.form.right) / 2;
    const cardMiddle = (measured.contentLeft + measured.contentRight) / 2;
    expect(Math.abs(formMiddle - cardMiddle), `the column's middle ${formMiddle}, the pop-up's ${cardMiddle}`).toBeLessThanOrEqual(1);
    expect(Math.abs(measured.label.left - measured.input.left), 'the label left-aligned with the box').toBeLessThanOrEqual(1);
    expect(Math.abs(measured.head.right - measured.contentRight), 'the title and ✕ across the whole pop-up').toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/layout-screens/player-popup-hit-points-${size.width}-light.png` });
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the two pop-ups at 375 px (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    test(`Portrait and Hit points fit a phone (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openPlayer(page);
      const portrait = await openPortrait(page);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      // The built pictures (no frame draws these pop-ups; they're approved from these), kept in the layout run's artifacts.
      await page.screenshot({ path: `test-results/layout-screens/player-popup-portrait-375-${scheme}.png` });
      await portrait.getByRole('button', { name: 'Close' }).click();
      await expect(portrait).toHaveCount(0);
      await openHitPoints(page);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/layout-screens/player-popup-hit-points-375-${scheme}.png` });
    });
  });
}

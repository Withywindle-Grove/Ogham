import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

// A table sheet on an iPad held sideways (1180×820, touch; fix-sheet-replacing-on-ipad). Purpose: once a sheet has
// opened beside its button it stays put: it doesn't slide after opening, tapping rows never moves it (± 1 px, every
// frame after each tap), a screen that shrinks and grows back (Safari's toolbar) moves it at most once and it then
// holds still, and it stays whole on the screen. Francis's iPad showed the Face table jumping on every tap.
// Desktop WebKit has no home bar, so the iPad's 20 px home-bar inset (env(safe-area-inset-bottom)) is added to the
// sheet's height cap by hand; without it the loop never starts on a desktop.
test('a table sheet stays where it opened through taps and a toolbar change, whole on screen', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await context.newPage();
  /** The open sheet's top on each of the next frames (a jump or a loop shows as more than one value). */
  const topsOverFrames = (p: Page, frames = 24): Promise<number[]> =>
    p.evaluate(
      (n) =>
        new Promise<number[]>((resolve) => {
          const tops: number[] = [];
          const step = () => {
            const card = document.querySelector('[role="dialog"][aria-modal="true"]');
            tops.push(card ? Math.round(card.getBoundingClientRect().top) : -1);
            if (tops.length >= n) resolve(tops);
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
      frames,
    );
  await page.goto('/gallery.html?theme=light&sheet=1');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.dialog--anchored { max-height: calc(100dvh - var(--sheet-top, var(--gutter)) - var(--gutter) - 20px) !important; }' });
  const open = page.getByRole('button', { name: 'Open the long table' });
  await open.scrollIntoViewIfNeeded();
  await open.tap();
  const sheet = page.getByRole('dialog', { name: 'Marsh finds' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveClass(/dialog--anchored/);
  const onScreen = async (height: number) => {
    const box = (await sheet.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
  };
  // Opened: it holds still from the first frame.
  const opened = await topsOverFrames(page);
  const start = opened[0]!;
  for (const top of opened) expect(Math.abs(top - start)).toBeLessThanOrEqual(1);
  await onScreen(820);
  // Rows tapped: it never moves.
  for (const n of [3, 5, 8]) {
    await sheet.getByRole('radio', { name: new RegExp(`^${n} `) }).tap();
    for (const top of await topsOverFrames(page)) expect(Math.abs(top - start)).toBeLessThanOrEqual(1);
    await onScreen(820);
  }
  // The toolbar shows (40 px less screen), then hides: each time it settles within a few frames and holds still.
  for (const height of [780, 820]) {
    await page.setViewportSize({ width: 1180, height });
    const tops = (await topsOverFrames(page)).slice(4);
    for (const top of tops) expect(Math.abs(top - tops[0]!)).toBeLessThanOrEqual(1);
    await onScreen(height);
  }
  await context.close();
});

// Purpose (review of #666, Important 1): an iPad turned from sideways (1180×820) to upright (820×1180) with a table
// sheet open places the sheet again beside its button, once: it stays whole on the screen, inside both sides, and
// usable (taller than 200 px, never collapsed to a sliver). The 20 px home-bar inset above, added to the height cap
// by hand, stands in for the iPad's: the real rule is `.dialog--anchored` in src/ui/Dialog.css.
test('a table sheet open when the iPad is turned upright stays whole on screen and usable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/gallery.html?theme=light&sheet=1');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.dialog--anchored { max-height: calc(100dvh - var(--sheet-top, var(--gutter)) - var(--gutter) - 20px) !important; }' });
  const open = page.getByRole('button', { name: 'Open the long table' });
  await open.scrollIntoViewIfNeeded();
  await open.tap();
  const sheet = page.getByRole('dialog', { name: 'Marsh finds' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveClass(/dialog--anchored/);
  await page.setViewportSize({ width: 820, height: 1180 });
  // A few frames for the resize and the size watch to settle.
  await page.evaluate(() => new Promise<void>((resolve) => { let n = 0; const step = () => (++n >= 6 ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); }));
  const box = (await sheet.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(820);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(1180);
  expect(box.height).toBeGreaterThan(200);
  // Still usable: a row can be ticked (a long table's rows are radios named range first since #786).
  const row = sheet.getByRole('radio', { name: /^2 / });
  await row.tap();
  await expect(row).toBeChecked();
  await context.close();
});

// Purpose (second review of #666): a short sheet opened low on an upright iPad (820×1180) sits above its button, its
// height cap measured from there; turned sideways (1180×820), its button still low, it is placed again from its whole
// height, not from the old cap's cut-down one, so it is as tall as it was upright (it fits the sideways screen; less
// the 20 px home bar at most), whole on screen, wholly above or below its button, and a row can still be ticked. The 20 px inset
// stands in for the iPad's home bar, as above (`.dialog--anchored` in src/ui/Dialog.css).
test('a short sheet opened low on an upright iPad keeps its height when turned sideways', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 820, height: 1180 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/gallery.html?theme=light&sheet=1');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.dialog--anchored { max-height: calc(100dvh - var(--sheet-top, var(--gutter)) - var(--gutter) - 20px) !important; }' });
  const open = page.getByRole('button', { name: 'Open the short table' });
  // Low on the screen, both ways up: with ?sheet=1 the gallery fixes this button 120 px above the bottom.
  await open.tap();
  const sheet = page.getByRole('dialog', { name: 'Pond trinkets' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveClass(/dialog--anchored/);
  const frames = () => page.evaluate(() => new Promise<void>((resolve) => { let n = 0; const step = () => (++n >= 6 ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); }));
  await frames();
  const upright = (await sheet.boundingBox())!;
  const button = (await open.boundingBox())!;
  // Opened above its button.
  expect(upright.y + upright.height).toBeLessThanOrEqual(button.y + 1);
  await page.setViewportSize({ width: 1180, height: 820 });
  await frames();
  const box = (await sheet.boundingBox())!;
  const anchor = (await open.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(upright.height - 21);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1180);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(820);
  // Beside its button: wholly above it or wholly below it, when the button is on screen.
  if (anchor.y >= 0 && anchor.y + anchor.height <= 820) expect(box.y + box.height <= anchor.y + 1 || box.y >= anchor.y + anchor.height - 1).toBe(true);
  const row = sheet.getByRole('radio', { name: /^2 / });
  await row.tap();
  await expect(row).toBeChecked();
  await context.close();
});

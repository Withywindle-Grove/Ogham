// A skipped First spells reached by Back (L5; mockup 23-H3, approved 2026-11-21; Francis's two fixes of 2026-11-27),
// in a real browser on a phone (375 px), light and dark, with a long class name (?as=new&gear=1&skipped=1). Purposes,
// in plain words:
//   1. The why-line, "A Warden of the Seventeen Drowned Lanterns has no spells to pick.", is at body size in ink (the
//      page's own text colour and size), not small and muted.
//   2. "Nothing to choose here" sits on the same row as Back and Next, at its left, at 375 px too: the three share one
//      middle, the hint ends before Back, Back comes before Next; both buttons are 44 px tall and 8 px apart.
//   3. At the Larger text size the three still share that row, the buttons still 44 px and 8 px apart.
//   4. Nothing runs past the screen, and it passes the accessibility check.
// The picture of the whole screen is kept with the test's output (the PR's built pictures). Every name is invented.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const h1 = (page: Page) => page.getByRole('heading', { level: 1 }).first();
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click();
const back = (page: Page) => page.getByRole('button', { name: 'Back to the step before' }).click();

/** Guided creation in The Fen Muster at level 2 to First spells, Back, level 1, Next past it to Gear, then Back onto it. */
async function toSkippedFirstSpells(page: Page) {
  await page.getByRole('button', { name: /The Fen Muster/ }).click();
  await page.getByRole('button', { name: 'Create your character' }).click();
  await page.getByRole('button', { name: /^Guided/ }).click();
  // A one-of-many pick moves on by itself (ct-1); otherwise Next.
  const pick = async (name: string) => {
    const title = await h1(page).textContent();
    await page.getByRole('checkbox', { name: `Pick ${name}` }).click();
    await page.waitForTimeout(150);
    if ((await h1(page).textContent()) === title) await next(page);
  };
  await expect(h1(page)).toHaveText(/^Scores/);
  await next(page);
  await pick('Bog folk');
  await pick('Warden of the Seventeen Drowned Lanterns');
  if ((await h1(page).textContent()) === 'Adjust scores') await next(page);
  await expect(h1(page)).toHaveText('Who they are');
  await page.getByLabel('Name').first().fill('Tam');
  await page.getByRole('button', { name: 'More starting level' }).click();
  await next(page);
  await expect(h1(page)).toHaveText('First spells');
  await back(page);
  await expect(h1(page)).toHaveText('Who they are');
  await page.getByRole('button', { name: 'Less starting level' }).click();
  await next(page);
  await expect(h1(page)).toHaveText(/^Gear/);
  await back(page);
  await expect(h1(page)).toHaveText('First spells');
}

/** The foot: "Nothing to choose here" at the left of Back and Next, the three on one row; 44 px buttons, 8 px apart. */
async function footOnOneRow(page: Page, at: string) {
  const m = await page.evaluate(() => {
    const foot = document.querySelector('.creation-step__foot') as HTMLElement;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
    };
    const button = (name: string) => box([...foot.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === name)!);
    return { hint: box(foot.querySelector('.creation-step__hint')!), hintText: (foot.querySelector('.creation-step__hint')!.textContent ?? '').trim(), back: button('Back'), next: button('Next') };
  });
  expect(m.hintText).toBe('Nothing to choose here');
  const middle = (b: { top: number; bottom: number }) => (b.top + b.bottom) / 2;
  expect(Math.abs(middle(m.hint) - middle(m.back)), `the hint on the buttons' row (${at})`).toBeLessThan(2);
  expect(Math.abs(middle(m.back) - middle(m.next)), `Back and Next on one row (${at})`).toBeLessThan(2);
  expect(m.hint.right, `the hint at the left of Back (${at})`).toBeLessThanOrEqual(m.back.left);
  expect(m.back.height, at).toBeGreaterThanOrEqual(44);
  expect(m.next.height, at).toBeGreaterThanOrEqual(44);
  expect(m.next.left - m.back.right, `Back and Next 8 px apart (${at})`).toBeGreaterThanOrEqual(8 - 0.5);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`a skipped First spells: the why-line in ink at body size, the hint beside Back and Next on one row (375 px, ${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/layout.html?as=new&gear=1&skipped=1');
    await toSkippedFirstSpells(page);
    await page.evaluate(() => document.fonts.ready);

    const why = page.locator('.creation-step__why .guided-instruction');
    await expect(why).toHaveText('A Warden of the Seventeen Drowned Lanterns has no spells to pick.');
    const style = await why.evaluate((el) => {
      const body = getComputedStyle(document.body);
      const own = getComputedStyle(el);
      return { color: own.color, size: own.fontSize, bodyColor: body.color, bodySize: body.fontSize };
    });
    expect(style.color, 'the why-line in ink').toBe(style.bodyColor);
    expect(style.size, 'the why-line at body size').toBe(style.bodySize);

    await footOnOneRow(page, 'Standard text');
    // At the Larger text size (the device's largest, 1.25) the three still share the row; the hint wraps its words.
    await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '1.25'));
    await footOnOneRow(page, 'Larger text');
    await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '1'));

    expect(await layoutProblems(page)).toEqual([]);
    expect(await accessibilityProblems(page)).toEqual([]);
    // The class pick's Undo toast gone first, so the picture shows the step alone.
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 15_000 });
    await page.screenshot({ path: test.info().outputPath(`l5-skipped-375-${scheme}.png`) });
  });
}

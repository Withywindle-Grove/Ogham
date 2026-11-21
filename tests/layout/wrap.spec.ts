// Wrapping and fitting guards at 375 px (m5b-wrap-guards). The screens Design sent back for wrapping or fitting (gate
// walk 2026-11-05, the 2026-11-06 creation rework, the gallery reviews) are opened at a 375 px phone and checked for
// a word squeezed to a letter a line, text past the screen's side and text cut by a box that hides overflow
// (`wrapProblems`), beside the usual `layoutProblems`. Catches, with where each was noted, in
// docs/status/2026-11-09-m5b-wrap-guards.md.
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';
import { wrapProblems } from './wrapChecks.ts';

const campaignRow = (page: Page) => page.getByRole('button', { name: /The Drowned Marches/ });

async function startGuided(page: Page) {
  await page.goto('/layout.html?as=new');
  await campaignRow(page).click();
  await page.getByRole('button', { name: 'Create your character' }).click();
  await page.getByRole('button', { name: /^Guided/ }).click();
}

async function pick(page: Page, name: string) {
  const title = await page.getByRole('heading', { level: 1 }).first().textContent();
  await page.getByRole('checkbox', { name: `Pick ${name}` }).click();
  await page.waitForTimeout(150);
  if ((await page.getByRole('heading', { level: 1 }).first().textContent()) === title) await page.getByRole('button', { name: 'Next', exact: true }).click();
}

test.describe('wrapping at 375 px', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  // Purpose: the creation Scores step (picture 1, "off centre" and "clipped" tiles) wraps and fits at 375 px, even with
  // two-digit scores.
  test('Scores: no text squeezed, past the side or cut off, with two-digit scores', async ({ page }) => {
    await startGuided(page);
    await expect(page.getByRole('heading', { name: /^Scores|How do you want to build\?/ })).toBeVisible();
    for (const box of await page.locator('.score-tile .typed-stepper__input').all()) await box.fill('18');
    expect(await wrapProblems(page)).toEqual([]);
    expect(await layoutProblems(page)).toEqual([]);
  });

  // Purpose: Adjust scores (picture 3: tiles clipped, the wrapped "was 9 · … →" caption hard to read) wraps and fits.
  test('Adjust scores: no text squeezed, past the side or cut off', async ({ page }) => {
    await startGuided(page);
    await page.getByRole('textbox', { name: 'Strength' }).fill('12');
    await page.getByRole('button', { name: 'Next' }).click();
    await pick(page, 'Marsh folk');
    await page.getByRole('checkbox', { name: 'Pick Lantern Warden' }).click();
    await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
    expect(await wrapProblems(page)).toEqual([]);
    expect(await layoutProblems(page)).toEqual([]);
  });

  // Purpose: Who they are, whose detail rows once squeezed their value to a letter a line beside a long label (2026-11-06
  // rework B), wraps and fits.
  test('Who they are: detail rows keep readable lines', async ({ page }) => {
    await startGuided(page);
    await page.getByRole('textbox', { name: 'Strength' }).fill('12');
    await page.getByRole('button', { name: 'Next' }).click();
    await pick(page, 'Marsh folk');
    await pick(page, 'Lantern Warden');
    await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Who they are' })).toBeVisible();
    expect(await wrapProblems(page)).toEqual([]);
    expect(await layoutProblems(page)).toEqual([]);
  });

  // Purpose: the creation foot (picture 2: the status line and Next cut by the screen's bottom) shows its words whole,
  // with nothing running past the side, on the Class step.
  test('Class step and its foot: nothing squeezed or cut off', async ({ page }) => {
    await startGuided(page);
    await page.getByRole('textbox', { name: 'Strength' }).fill('12');
    await page.getByRole('button', { name: 'Next' }).click();
    await pick(page, 'Marsh folk');
    await expect(page.getByRole('heading', { name: /Class/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await wrapProblems(page)).toEqual([]);
  });

  // Purpose: the component gallery (where Design's picture reviews reject wrapping) has no squeezed or cut text at 375 px,
  // in both themes.
  for (const theme of ['light', 'dark']) {
    test(`gallery (${theme}): nothing squeezed, past the side or cut off`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(`/gallery.html?theme=${theme}`);
      await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
      expect(await wrapProblems(page)).toEqual([]);
    });
  }
});

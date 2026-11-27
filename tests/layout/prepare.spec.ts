// Prepare on a phone (dec-8 C, #925; mockup magic/06, the Prepare frames). Purposes, in plain words, at 375 px in light
// and in dark:
//   * the screen fits: nothing scrolls sideways, every target is at least 44 px, no text under 14 px, nothing squeezed
//     or cut, and no serious accessibility problem (contrast included);
//   * a very long spell name wraps over more than one line beside its stepper, which stays on the name's row at the
//     right, never pushed under it or off the screen; the stepper's − and + are each 44 px, 8 px apart at least;
//   * − on a spell not chosen opens its pop-up (never a disabled button), and the pop-up fits too.
// The world is layout.html's ?magic=1: Wren keeps a spell book with "The long lantern of the drowned abbey…" at level 2.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';
import { wrapProblems } from './wrapChecks.ts';

test.use({ viewport: { width: 375, height: 812 } });

async function openPrepare(page: Page, theme: 'light' | 'dark') {
  if (theme === 'dark') await page.addInitScript(() => localStorage.setItem('grimoire.theme', 'dark'));
  await page.goto('/layout.html?as=player&magic=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('button', { name: 'Magic', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare, For your next rest' }).click();
  const prepare = page.getByRole('dialog', { name: 'Prepare' });
  await expect(prepare.getByText(/^For Wren of the Lantern Wardens’ next rest\./)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return prepare;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test(`Prepare fits a phone (${theme}): no sideways scroll, 44 px targets, 14 px text, nothing cut, accessible`, async ({ page }) => {
      const prepare = await openPrepare(page, theme);
      await expect(prepare.getByRole('group', { name: /^The long lantern/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await wrapProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '.dialog--full')).toEqual([]);
    });

    test(`a long spell name wraps beside its stepper, which keeps 44 px steps 8 px apart (${theme})`, async ({ page }) => {
      const prepare = await openPrepare(page, theme);
      const row = prepare.locator('.list-row--control').filter({ hasText: 'The long lantern' });
      await row.scrollIntoViewIfNeeded();
      const found = await row.evaluate((el) => {
        const title = el.querySelector('.list-row__body')!;
        const words = document.createRange();
        words.selectNodeContents(title.querySelector('.list-row__title') ?? title);
        const lines = new Set([...words.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
        const stepper = el.querySelector('.stepper')!.getBoundingClientRect();
        const body = title.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const [less, more] = [...el.querySelectorAll('.stepper__step')].map((b) => b.getBoundingClientRect());
        return {
          lines,
          besideName: stepper.left >= body.right - 1 && stepper.top < body.bottom && stepper.bottom > body.top,
          onScreen: stepper.right <= window.innerWidth && box.right <= window.innerWidth,
          steps: [less!, more!].map((b) => ({ width: Math.round(b.width), height: Math.round(b.height) })),
          gap: Math.round(more!.left - less!.right),
        };
      });
      expect(found.lines, 'the long name wraps').toBeGreaterThan(1);
      expect(found.besideName, 'the stepper sits beside the name, on its row').toBe(true);
      expect(found.onScreen, 'the stepper stays on the screen').toBe(true);
      for (const step of found.steps) {
        expect(step.width).toBeGreaterThanOrEqual(44);
        expect(step.height).toBeGreaterThanOrEqual(44);
      }
      expect(found.gap).toBeGreaterThanOrEqual(8);
    });

    test(`− on a spell not chosen opens its pop-up, which fits a phone (${theme})`, async ({ page }) => {
      const prepare = await openPrepare(page, theme);
      await prepare.getByRole('button', { name: 'Less Reed whisper' }).click();
      const why = page.getByRole('dialog', { name: "Reed whisper isn't chosen" });
      await expect(why.getByText("Wren of the Lantern Wardens hasn't chosen Reed whisper for the next rest, so there's none to take out.")).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await wrapProblems(page)).toEqual([]);
    });
  });
}

// The Scene's strip (plan dec-9-the-whole-scene S7; page 16, T1, T2, T8; frame R1), in a real browser on the layout
// page's invented harbour (`?placePage=spots&session=running`; `&strip=long` gives the harbour its own procedure of
// seven long-named steps, the longest in the harness). What it checks, in plain words:
//   * the strip has no heading and shows its steps in one row, centred;
//   * on a tablet the words show under each circle, on a phone they don't (each circle is still named);
//   * a step with its pack's text is a tap of 44 px at least that opens the text; the others are not buttons;
//   * nothing scrolls sideways, at 375, 680, 834 and 1024 px, and axe finds no serious problem, in light and dark.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, strip: '' | 'long') {
  await page.goto(`/layout.html?as=gm&placePage=spots&session=running${strip ? `&strip=${strip}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('region', { name: 'Locations' })).toBeVisible();
}

const WIDTHS = [375, 680, 834, 1024] as const;

for (const width of WIDTHS) {
  for (const scheme of ['light', 'dark'] as const) {
    const phone = width < 600;
    test.describe(`the Scene's strip (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: phone ? 812 : 900 }, colorScheme: scheme });

      // Purpose: with the setting's procedure (the app's own five here) the strip shows its steps in one row with no heading, the words under the circles on a tablet and none on a phone.
      test('the procedure in force', async ({ page }) => {
        await openScene(page, '');
        const strip = page.getByRole('group', { name: 'Sequence of play' });
        await expect(strip).toBeVisible();
        const steps = strip.locator('.procedure-strip__step');
        const count = await steps.count();
        expect(count).toBeGreaterThan(0);
        await expect(strip.locator('h1, h2, h3, h4')).toHaveCount(0);
        const tops = new Set<number>();
        for (let i = 0; i < count; i += 1) tops.add(Math.round((await steps.nth(i).locator('.procedure-strip__circle').boundingBox())!.y));
        expect(tops.size).toBe(1);
        const names = strip.locator('.procedure-strip__name');
        if (phone) await expect(names.first()).toBeHidden();
        else await expect(names.first()).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/scene-strip-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: the longest procedure in the harness (seven long names) stays in one row with nothing scrolling sideways; its two steps with text are taps of 44 px at least that open their words; the rest are not buttons.
      test('the longest procedure, with taps', async ({ page }) => {
        await openScene(page, 'long');
        const strip = page.getByRole('group', { name: 'Sequence of play' });
        await expect(strip.locator('.procedure-strip__step')).toHaveCount(7);
        const box = (await strip.boundingBox())!;
        const steps = strip.locator('.procedure-strip__step');
        for (let i = 0; i < 7; i += 1) {
          const step = (await steps.nth(i).boundingBox())!;
          expect(step.x).toBeGreaterThanOrEqual(box.x - 1);
          expect(step.x + step.width).toBeLessThanOrEqual(box.x + box.width + 1);
        }
        const taps = strip.getByRole('button');
        await expect(taps).toHaveCount(2);
        for (let i = 0; i < 2; i += 1) {
          const tap = (await taps.nth(i).boundingBox())!;
          expect(Math.min(tap.width, tap.height)).toBeGreaterThanOrEqual(44);
        }
        expect(await strip.getByRole('img').count()).toBe(5);
        // The step with no icon the app knows shows its number.
        await expect(strip.getByRole('img', { name: 'Wade the shallows' }).locator('.procedure-strip__number')).toHaveText('4');
        await page.screenshot({ path: `test-results/layout-screens/scene-strip-long-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await strip.getByRole('button', { name: 'Moor or cast off: read it' }).click();
        const sheet = page.getByRole('dialog', { name: 'Moor or cast off' });
        await expect(sheet.getByText(/Tie off at the posts/)).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/scene-strip-text-${width}-${scheme}.png` });
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

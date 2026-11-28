// The Pin star on a spell's sheet on the Magic tab (ticket #164; spec docs/specs/player-sitting.md, piece 3; pss-6,
// psb-4), at 375 px, light and dark. The world is layout.html's ?magic=1: Wren keeps "The long lantern of the drowned
// abbey…" ready at level 2, a name long enough to wrap in the sheet's head. Purposes, each a plain sentence:
//   1. The spell's sheet carries the Pin star beside ✕, on the head's line, a 44 px target 8 px from ✕ at least, empty
//      and not pressed; the long name wraps beside them, never under or over them.
//   2. A tap pins the spell: the star is filled and pressed, the toast says "<name> pinned to the top".
//   3. Nothing spills sideways, and the page's layout and accessibility checks find nothing, pinned or not.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

test.use({ viewport: { width: 375, height: 812 } });

async function openLongSpell(page: Page, scheme: 'light' | 'dark') {
  if (scheme === 'dark') await page.addInitScript(() => localStorage.setItem('grimoire.theme', 'dark'));
  await page.goto('/layout.html?as=player&magic=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('button', { name: 'Magic', exact: true }).click();
  await page.getByRole('button', { name: /^The long lantern/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /^The long lantern/ });
  await expect(sheet).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The sheet slides up from the foot: measure once it has come to rest.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  return sheet;
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test(`1-3. the Pin star beside ✕ on a spell's sheet, and a tap pins it (375 px, ${scheme})`, async ({ page }) => {
      const sheet = await openLongSpell(page, scheme);
      const star = sheet.getByRole('button', { name: 'Pin to top' });
      const close = sheet.getByRole('button', { name: 'Close' });
      await expect(star).toHaveAttribute('aria-pressed', 'false');
      const [s, c] = [(await star.boundingBox())!, (await close.boundingBox())!];
      expect(Math.round(s.width), 'the star is 44 px wide').toBeGreaterThanOrEqual(44);
      expect(Math.round(s.height), 'the star is 44 px tall').toBeGreaterThanOrEqual(44);
      expect(Math.abs(s.y - c.y), 'the star sits on ✕’s line').toBeLessThanOrEqual(2);
      expect(Math.round(c.x - (s.x + s.width)), 'the star is beside ✕, 8 px apart at least').toBeGreaterThanOrEqual(8);
      const title = (await sheet.locator('.dialog__title, h2').first().boundingBox())!;
      expect(title.x + title.width, 'the long name stays left of the star').toBeLessThanOrEqual(s.x + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`magic-pin-star-${scheme}-empty.png`) });

      await star.click();
      const unpin = sheet.getByRole('button', { name: 'Unpin' });
      await expect(unpin).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(/^The long lantern.* pinned to the top$/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`magic-pin-star-${scheme}-pinned.png`) });
    });
  });
}

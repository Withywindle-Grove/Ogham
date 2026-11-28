// dec-13 C8 (docs/plans/dec-13-the-player-screen.md; pin-2, Francis 2026-11-15), as changed by row P3 of plan
// test-feedback-2026-11-19 (euf-3; page 28, approved 2026-11-20): a pinned trait no longer moves to At hand; it is a
// block first in the right column's list, "Abilities and traits", on the shared P1-like character
// (`layout.html?as=player&p1=1`, src/testing/layoutP1Character.ts, Brannoch Fenward). The trait is pinned through the
// screen here, so the shared character itself (and every other row's pictures) stays as it is.
// Purposes: the trait's sheet has the pin star beside ✕, a 44 px target; pinned, the trait is a block in the list,
// its name led by the star, and not in At hand; nothing spills sideways at 375 px; its Use is a 44 px target.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

const list = (page: Page) => page.getByRole('region', { name: 'Abilities and traits' });

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(list(page).getByRole('button', { name: 'Use Steady flame' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of SIZES) {
  test(`a pinned trait is a block in Abilities and traits, not At hand (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);

    await list(page).getByRole('button', { name: /^Steady flame/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Steady flame' });
    const star = sheet.getByRole('button', { name: 'Pin to top' });
    await expect(star).toBeVisible();
    expect((await star.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await star.click();
    await expect(sheet).toHaveCount(0);

    const block = list(page).locator('.pinned-box--block');
    const row = block.getByRole('button', { name: /^Steady flame/ });
    await expect(row).toBeVisible();
    // The star leads the name, as frame P1 draws "★ Horn charge".
    await expect(row.locator('.list-row__title .pinned-mark')).toBeVisible();
    // Each thing once: not At hand, and one Use Steady flame on the screen.
    await expect(page.getByRole('region', { name: 'At hand' }).getByRole('button', { name: 'Use Steady flame' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Use Steady flame' })).toHaveCount(1);
    expect((await block.getByRole('button', { name: 'Use Steady flame' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    // Nothing spills sideways.
    const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(spill).toBeLessThanOrEqual(0);
  });
}

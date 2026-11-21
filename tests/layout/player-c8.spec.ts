// dec-13 C8 (docs/plans/dec-13-the-player-screen.md; pin-2, Francis 2026-11-15; frame P1 and P2, approved ps-9
// 2026-11-14): a pinned trait shows in At hand with the small filled star and leaves Traits, on the shared P1-like
// character (`layout.html?as=player&p1=1`, src/testing/layoutP1Character.ts, Brannoch Fenward). The trait is pinned
// through the screen here, so the shared character itself (and every other row's pictures) stays as it is.
// Purposes: the trait's sheet has the pin star beside ✕, a 44 px target; pinned, the trait's row sits inside At hand,
// after the items, its name led by the star (frame P1) and nothing spilling sideways at 375 px; Traits no longer lists it
// (each thing once); its Use is a 44 px target.
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

// The traits with uses (a tablet's full sheet beside has its own "Traits", the ones without uses).
const traitsList = (page: Page) => page.getByRole('region', { name: 'Traits' }).filter({ has: page.getByRole('button', { name: 'Use Steady flame' }) });

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(traitsList(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of SIZES) {
  test(`a pinned trait moves to At hand with its star and leaves Traits (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);

    await traitsList(page).getByRole('button', { name: /^Steady flame/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Steady flame' });
    const star = sheet.getByRole('button', { name: 'Pin to top' });
    await expect(star).toBeVisible();
    expect((await star.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await star.click();
    await expect(sheet).toHaveCount(0);

    const atHand = page.getByRole('region', { name: 'At hand' });
    const row = atHand.getByRole('button', { name: /^Steady flame/ });
    await expect(row).toBeVisible();
    // The star leads the name, as frame P1 draws "★ Horn charge" (the review's nit of 19 Nov 2026).
    await expect(row.locator('.list-row__title .pinned-mark')).toBeVisible();
    await expect(row.locator('.list-row__sub .pinned-mark')).toHaveCount(0);
    // After the items: the eel knife's row comes before the trait's.
    const after = await page.evaluate(() => {
      const section = document.querySelector('section[aria-label="At hand"]');
      const items = section?.querySelector('.pack__item');
      const trait = Array.from(section?.querySelectorAll('.list-row') ?? []).find((r) => r.textContent?.includes('Steady flame'));
      return !!items && !!trait && !!(items.compareDocumentPosition(trait) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(after).toBe(true);
    // Each thing once: the traits with uses (its only one) have gone, and Use Steady flame is At hand's alone.
    await expect(traitsList(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Use Steady flame' })).toHaveCount(1);
    expect((await atHand.getByRole('button', { name: 'Use Steady flame' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    // Nothing spills sideways.
    const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(spill).toBeLessThanOrEqual(0);
  });
}

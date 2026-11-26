// dec-13 C9 (docs/plans/dec-13-the-player-screen.md; ps-9, frames P1 and P2 of december/14, approved 2026-11-14): the
// light in At hand, on the shared P1-like character (`layout.html?as=player&p1=1`, src/testing/layoutP1Character.ts).
// Purposes:
//   The lit storm lantern sits inside At hand, after its item rows (and before any pinned trait, frame P1), and the
//   screen has no "Light" heading.
//   Its line reads "Lit, 4 turns left. 3 refills left"; its name (it opens the lantern's sheet), its ring (the tap,
//   "Put out"; lt-1), Keep lit's toggle and Refill are 44 px targets
//   at least, and the light's block stays inside At hand's width at 375 px (no sideways scroll).
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'At hand' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of SIZES) {
  test(`the lit light sits in At hand with no Light heading (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    const atHand = page.getByRole('region', { name: 'At hand' });
    const light = atHand.locator('.light-block--at-hand');
    await expect(light).toBeVisible();
    await expect(light.getByText('Lit, 4 turns left. 3 refills left')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Light', exact: true })).toHaveCount(0);

    // After At hand's item rows (frame P1: bow, lantern, wand, pinned trait): the light follows the last item row.
    const afterItems = await atHand.evaluate((section) => {
      const block = section.querySelector('.light-block--at-hand');
      const rows = section.querySelectorAll('.pack__item');
      const lastRow = rows[rows.length - 1];
      return !!block && !!lastRow && (lastRow.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(afterItems).toBe(true);

    // 44 px targets (t44-1): the name, the ring, Keep lit's toggle, Refill.
    const name = light.getByRole('button', { name: 'Storm lantern', exact: true });
    expect((await name.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    for (const target of [light.getByRole('button', { name: 'Put out Storm lantern' }), light.getByRole('switch', { name: 'Keep lit' }), light.getByRole('button', { name: 'Refill' })]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Inside At hand's width, and no sideways scroll on the page.
    const [outer, inner] = await Promise.all([atHand.boundingBox(), light.boundingBox()]);
    expect((inner?.x ?? 0) + (inner?.width ?? 0)).toBeLessThanOrEqual((outer?.x ?? 0) + (outer?.width ?? 0) + 0.5);
    const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(scrolls).toBe(false);
  });
}

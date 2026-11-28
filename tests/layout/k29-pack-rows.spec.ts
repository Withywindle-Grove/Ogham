// The Pack tab's rows and group heads in the book's dress (K29, fix round 4; frame PK1 of pack/08, approved 2026-11-14),
// on the shared Pack character (layout.html?as=player&stash=1). Purposes, in plain words:
//   1. A row with only its name ("Chalk", "Rushlights ×4") has its name centred in the row: the space above it and the
//      space below it differ by 2 px at most, as PK1 draws "Bog sling" (Home One's audit, finding 1).
//   2. A row with a line under its name ("Glow wand", "Magic, 10 coins") keeps its layout as built: the name 4 px under
//      the row's top.
//   3. A group's head ("Carried") is 32 px tall at least, so its first row stands clear of it ("Heads 32 px, rest as
//      built", Francis, 26 Nov 2026, ⚑ 20).
// At a phone's 375 px and a tablet held sideways, 1180 px.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

async function openPack(page: Page) {
  await page.goto('/layout.html?as=player&stash=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.locator('.pack-dress .pack__row-main').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

// The space above and below a row's name, inside the row's button.
async function nameSpace(page: Page, name: RegExp) {
  const row = page.locator('.pack-dress .pack__row-main').filter({ has: page.locator('.pack__name', { hasText: name }) }).first();
  await expect(row).toBeVisible();
  return row.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const words = el.querySelector('.pack__name')!.getBoundingClientRect();
    return { above: words.top - box.top, below: box.bottom - words.bottom, lines: el.querySelectorAll('.pack__sub').length };
  });
}

for (const width of [375, 1180]) {
  test(`a row with only its name has it centred; a two-line row keeps its layout (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await openPack(page);
    for (const name of [/^Chalk/, /^Rushlights/]) {
      const { above, below, lines } = await nameSpace(page, name);
      expect(lines).toBe(0);
      expect(Math.abs(above - below), `${name}: ${above} above, ${below} below`).toBeLessThanOrEqual(2);
    }
    const twoLines = await nameSpace(page, /^Glow wand/);
    expect(twoLines.lines).toBe(1);
    expect(Math.round(twoLines.above)).toBe(4);
  });

  test(`a group's head is 32 px tall at least (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await openPack(page);
    const head = page.locator('.pack-dress .pack__group-head').filter({ has: page.getByRole('heading', { name: /^Carried/ }) });
    const height = await head.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(32);
  });
}

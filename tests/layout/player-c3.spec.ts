// dec-13 C3 (docs/plans/dec-13-the-player-screen.md; ps-8, ps-10; frame P1 and P2, approved ps-9 2026-11-14): the level
// block on the Player screen's left, and every score box one size, on the shared P1-like character
// (`layout.html?as=player&p1=1`, src/testing/layoutP1Character.ts, Brannoch Fenward).
// Also: the experience sits on the title's line from a tablet's width up (P1) and under it on a phone (P2); the lead's
// ruling, 2026-11-15.
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  // The P1 character's campaign row opens the Player screen, as ruleHeading.spec.ts opens it.
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player-level')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of SIZES) {
  test(`the level block reads as frame P1 draws it, and every score box is one size (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);

    // The level block: one row, the class beside the level, the experience, its bar and the company; no chevron, and
    // the tap stays (tfr-2, C6; page M1, approved 2026-11-19).
    const level = page.locator('.player-level');
    await expect(level).toBeVisible();
    const row = level.getByRole('button', { name: /, level \d+.*: how it's worked out$/ });
    await expect(row).toBeVisible();
    await expect(row.locator('.list-row__chevron')).toHaveCount(0);
    // Only that row: a skill's row on the same tab keeps its chevron (tfr-2; the local review of #1068).
    await expect(page.getByRole('region', { name: 'Skills' }).locator('.list-row__chevron').first()).toBeVisible();
    // A 44 px target at least (t44-1).
    const box = await row.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    // It sits on the left, directly above Details (ps-8): the level block's place is followed by Details' place (each
    // part is drawn into its own slot; the Details region is "Details" or, before C4, "Details and backstory").
    const order = await page.evaluate(() => {
      const slot = document.querySelector('.player-level')?.closest('.player__slot');
      const details = document.querySelector('.player__pane--play [aria-label^="Details"]');
      if (!slot || !details) return 'missing';
      let next = slot.nextElementSibling;
      // Slots draw no box of their own (display: contents), so an empty one is skipped by its having no words.
      while (next && !next.contains(details) && !next.textContent?.trim()) next = next.nextElementSibling;
      return next === details || next?.contains(details) ? 'directly above' : `then ${next?.className ?? 'nothing'}`;
    });
    expect(order).toBe('directly above');

    // Every score box one size (ps-10), with or without a modifier under its number.
    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.score-row .stat-tile')).map((t) => {
        const r = t.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}`;
      }),
    );
    expect(sizes.length).toBe(6);
    expect(new Set(sizes).size).toBe(1);

    // The Saves row reads five tiles, as P1 draws five (the P1 character's own five; the lead, 2026-11-15).
    await expect(page.locator('.save-tiles .stat-tile')).toHaveCount(5);

    // No accent on this screen from this row (the frames draw none).
    expect(await level.locator('.button-primary, [data-accent]').count()).toBe(0);
  });
}

// Purpose: from a tablet's width up the experience reads on the title's line, after it, with the bar under them and the
// company under the bar (frame P1); on a phone the experience sits under the title (frame P2). The lead's ruling,
// 2026-11-15.
for (const size of [
  { ...SIZES[0], inline: true },
  { ...SIZES[1], inline: false },
]) {
  test(`the experience is ${size.inline ? "on the title's line" : 'under the title'} (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    const level = page.locator('.player-level');
    const title = (await level.locator('.list-row__title').boundingBox())!;
    const xp = (await level.locator('.player-level__line').first().boundingBox())!;
    const bar = (await level.locator('.player-level__bar').boundingBox())!;
    const company = (await level.locator('.player-level__company').boundingBox())!;
    if (size.inline) {
      // One line: the experience starts after the title ends and their boxes share the line.
      expect(xp.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(xp.y).toBeLessThan(title.y + title.height);
      expect(xp.y + xp.height).toBeGreaterThan(title.y);
    } else {
      // Stacked: the experience starts under the title, at its left edge.
      expect(xp.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
      expect(Math.abs(xp.x - title.x)).toBeLessThanOrEqual(1);
    }
    // Either way the bar is under the words and the company under the bar, all inside the screen.
    expect(bar.y).toBeGreaterThanOrEqual(Math.max(title.y + title.height, xp.y + xp.height) - 1);
    expect(company.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    for (const b of [title, xp, bar, company]) expect(b.x + b.width).toBeLessThanOrEqual(size.width);
  });
}

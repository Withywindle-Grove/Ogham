// The GM's view as the player: a player-only button's pop-up, and the view's bar on a phone (page 32, M3f, M3f2, M3j,
// approved 2026-11-21; rows C15d and pg32-match of plans/test-feedback-2026-11-19.md), on P1's Brannoch (Sam's) with a
// change waiting (layout.html?as=gm&p1=finish), in a real browser on a phone (375 px) and a tablet held sideways
// (1180 px), in light and dark. Purposes, in plain words:
//   1. "Take back" in the notices opens "Only Sam can take back this change": on a tablet the centred pop-up, on a phone
//      the sheet from the foot, the screen's width; its foot is "Go to Waiting for approval" (the place its words name,
//      audit fix 1) then "Got it", both plain and 44 px high, 8 px apart (stacked at the right on a phone, ft-1). Its title is the Plain title (audit fix 4): ink,
//      sentence case, 20 px, not the book's red capitals. No sideways scrolling, no text under 14 px, no serious
//      accessibility problem.
//   2. On a phone the view's top row carries only ⋯ at the right (M3j); on a tablet it keeps the GM's Log, ✉ and
//      Reference (M3c).
//   3. At 375 px Take back's foot stacks ("Go to Waiting for approval" over "Got it"), and the two buttons are one
//      width, the wider one's, at the right, so the stack looks intended (ft-1 as Francis ruled on 24 Nov: every stacked
//      foot alike).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openView(page: Page, width: number, height: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=gm&p1=finish');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await page.getByRole('button', { name: "View Brannoch Fenward’s sheet" }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByRole('note')).toHaveAttribute('aria-label', /^Sam’s view of /);
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`Take back's stacked foot at 375 px: both buttons one width, at the right (${scheme})`, async ({ page }) => {
    await openView(page, 375, 812, scheme);
    await page.getByRole('button', { name: /notice/ }).first().click();
    await page.getByRole('button', { name: /^Take back / }).click();
    const pop = page.getByRole('dialog', { name: 'Only Sam can take back this change' });
    await expect(pop).toBeVisible();
    await pop.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const foot = pop.locator('.dialog__got-it');
    await expect(foot).toHaveClass(/dialog__actions--stacked/);
    const right = (await foot.boundingBox())!;
    const [go, got] = await foot.locator('button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    expect(Math.abs(go!.width - got!.width)).toBeLessThanOrEqual(0.5);
    for (const b of [go!, got!]) expect(Math.abs(right.x + right.width - b.right)).toBeLessThanOrEqual(1);
    expect(got!.top - go!.bottom).toBeGreaterThanOrEqual(8 - 0.5);
    // Not stretched to the foot's left edge: the stack's column is the wider button's.
    expect(go!.left - right.x).toBeGreaterThan(8);
    await page.screenshot({ path: `test-results/layout-screens/gm-view-popup-stacked-375-${scheme}.png`, fullPage: false });
    expect(await layoutProblems(page)).toEqual([]);
  });
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Take back's pop-up in the view (${size.name}, ${scheme})`, async ({ page }) => {
      await openView(page, size.width, size.height, scheme);
      await page.getByRole('button', { name: /notice/ }).first().click();
      await page.getByRole('button', { name: /^Take back / }).click();
      const pop = page.getByRole('dialog', { name: 'Only Sam can take back this change' });
      await expect(pop).toBeVisible();
      await pop.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const box = await pop.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight };
      });
      if (size.width < 600) {
        // The sheet from the foot, the screen's width.
        expect(Math.abs(box.bottom - box.h)).toBeLessThanOrEqual(1);
        expect(box.right - box.left).toBeGreaterThanOrEqual(box.w - 1);
      } else {
        // Centred, across and down.
        expect(Math.abs((box.left + box.right) / 2 - box.w / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs((box.top + box.bottom) / 2 - box.h / 2)).toBeLessThanOrEqual(1);
      }
      const foot = pop.locator('.dialog__got-it button');
      await expect(foot).toHaveText(['Go to Waiting for approval', 'Got it']);
      const title = pop.getByRole('heading', { name: 'Only Sam can take back this change' });
      const look = await title.evaluate((el) => {
        const css = getComputedStyle(el);
        const why = getComputedStyle(el.closest('.dialog')!);
        return { transform: css.textTransform, size: css.fontSize, color: css.color, card: why.color };
      });
      expect(look.transform).toBe('none');
      expect(look.size).toBe('20px');
      // Ink: the card's own text colour, not the book's red.
      expect(look.color).toBe(look.card);
      const [go, got] = await foot.evaluateAll((els) => els.map((el) => ({ ...el.getBoundingClientRect().toJSON(), cls: el.className })));
      for (const b of [go!, got!]) {
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.cls).toContain('button-secondary');
      }
      // Side by side, 8 px apart; on a phone the longer "Go to Waiting for approval" doesn't fit one row with Got it, so
      // the foot stacks at the right (ft-1), 8 px apart.
      const stacked = await pop.locator('.dialog__got-it').evaluate((el) => el.classList.contains('dialog__actions--stacked'));
      if (stacked) expect(got!.top - go!.bottom).toBeGreaterThanOrEqual(8);
      else expect(got!.left - go!.right).toBeGreaterThanOrEqual(8);
      if (size.width >= 600) expect(stacked).toBe(false);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-popup-${size.width}-${scheme}.png`, fullPage: false });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`the view's top row: only ⋯ on a phone, Log, ✉ and Reference on a tablet (${size.name}, ${scheme})`, async ({ page }) => {
      await openView(page, size.width, size.height, scheme);
      const end = page.locator('.top-row__end').first();
      const names = await end.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      if (size.width < 600) expect(names).toEqual(['Character options']);
      else expect(names).toEqual(['Log', 'Messages', 'Reference', 'Character options']);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-bar-${size.width}-${scheme}.png`, fullPage: false });
      expect(await layoutProblems(page)).toEqual([]);
    });
  }
}

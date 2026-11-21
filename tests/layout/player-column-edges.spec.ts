// Row H3 of docs/plans/test-feedback-2026-11-19.md (item 29; fb-6 of 20 Nov): the Player tab on a landscape tablet or a
// desktop window. Two checks:
// 1. The left rail never scrolls on its own: it is as tall as what it holds, and every tab can be reached (item 29).
//    What Francis saw beside the rail's icons was the fold handle's pill (lr-4, P32), not a scroll bar; this pins that
//    the rail itself still has none.
// 2. The play column scrolls on its own (m4b retest; 06, Player), so it clips what reaches its edge. Every box in it
//    keeps its left and right borders inside that edge, with room to spare, so no rounding or scroll bar cuts them
//    (fb-6: "right border is cut off").
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

const P1_CAMPAIGN = /The Storm Lantern Road/;

/** Opens the P1-like character (Brannoch Fenward, with his class's figures) at a size, folded or open, at a text size. */
async function openPlayer(page: Page, size: { width: number; height: number }, folded: boolean, larger: boolean) {
  await page.setViewportSize(size);
  await page.addInitScript(
    ([fold, big]) => {
      localStorage.setItem('grimoire.navCollapsed', fold ? 'yes' : 'no');
      if (big) localStorage.setItem('grimoire.textSize', 'larger');
    },
    [folded, larger] as const,
  );
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: P1_CAMPAIGN }).click();
  await expect(page.locator('.player-level')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.player--wide > .player__side')).toBeVisible();
}

const RAIL_SIZES = [
  { name: 'ipad-landscape', width: 1024, height: 768, larger: false },
  { name: 'ipad-landscape-larger-text', width: 1024, height: 768, larger: true },
  { name: 'ipad-air-landscape', width: 1180, height: 820, larger: false },
  { name: 'short-window', width: 1024, height: 500, larger: true },
] as const;

for (const size of RAIL_SIZES) for (const folded of [true, false]) {
  // The rail has no scroll bar of its own: neither it nor its tabs scroll, it is as tall as what it holds, and every
  // tab is on screen and is what a tap at its centre lands on.
  test(`the left rail never scrolls on its own (${size.name}, ${size.width}×${size.height}, ${folded ? 'folded' : 'open'})`, async ({ page }) => {
    await openPlayer(page, size, folded, size.larger);
    const rail = await page.evaluate(() => {
      const side = document.querySelector<HTMLElement>('.player--wide > .player__side')!;
      const nav = side.querySelector<HTMLElement>('.section-nav')!;
      const scrolls = (el: HTMLElement) => /auto|scroll/.test(`${getComputedStyle(el).overflowX} ${getComputedStyle(el).overflowY}`);
      return {
        scrollers: [side, nav, ...Array.from(nav.querySelectorAll<HTMLElement>('*'))].filter(scrolls).map((el) => el.className),
        sideHeight: side.clientHeight,
        sideContent: side.scrollHeight,
        navTaller: nav.scrollHeight - nav.clientHeight,
      };
    });
    expect(rail.scrollers).toEqual([]);
    expect(rail.sideContent).toBeLessThanOrEqual(rail.sideHeight + 1);
    expect(rail.navTaller).toBeLessThanOrEqual(1);

    const tabs = page.locator('.player__side .section-nav__tab');
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);
    const viewport = page.viewportSize()!;
    for (const tab of await tabs.all()) {
      const box = (await tab.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      const hit = await tab.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!at && el.contains(at);
      });
      expect(hit).toBe(true);
    }
  });
}

const COLUMN_SIZES = [
  { name: 'ipad-landscape', width: 1024, height: 768, larger: false },
  { name: 'ipad-landscape-larger-text', width: 1024, height: 768, larger: true },
  { name: 'ipad-air-landscape', width: 1180, height: 820, larger: false },
  { name: 'desktop', width: 1400, height: 900, larger: false },
] as const;

for (const size of COLUMN_SIZES) for (const folded of [true, false]) {
  // Every box in the play column (hit points, the armour class and attack tiles, At hand's rows, the buttons) keeps
  // its left and right borders at least 2 px inside the column's clipping edge, so none is cut off.
  test(`every box in the play column keeps its borders inside the column (${size.name}, ${size.width}×${size.height}, ${folded ? 'folded' : 'open'})`, async ({ page }) => {
    await openPlayer(page, size, folded, size.larger);
    await expect(page.locator('.player__pane--play .hp-box')).toBeVisible();
    await expect(page.locator('.player__pane--play .vitals .stat-tile').first()).toBeVisible();
    const cut = await page.evaluate(() => {
      const pane = document.querySelector<HTMLElement>('.player--wide > .player__pane--play')!;
      const outer = pane.getBoundingClientRect();
      // The clipping edge: the column's padding box, without its scroll bar.
      const left = outer.left + pane.clientLeft;
      const right = left + pane.clientWidth;
      const problems: string[] = [];
      for (const el of Array.from(pane.querySelectorAll<HTMLElement>('*'))) {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue;
        const name = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
        if (parseFloat(style.borderRightWidth) > 0 && right - box.right < 2) problems.push(`${name}'s right border has ${(right - box.right).toFixed(2)} px`);
        if (parseFloat(style.borderLeftWidth) > 0 && box.left - left < 2) problems.push(`${name}'s left border has ${(box.left - left).toFixed(2)} px`);
      }
      return problems.slice(0, 10);
    });
    expect(cut).toEqual([]);
  });
}

// The play column's own scroll bar, between the two columns, is fully transparent (Francis, 20 Nov, on H3's ⚑ 1: "It
// should be fully transparent"), and the column still scrolls under the wheel.
test('the play column scrolls with a fully transparent scroll bar (short-window, 1024×500, folded)', async ({ page }) => {
  await openPlayer(page, { width: 1024, height: 500 }, true, true);
  const pane = page.locator('.player--wide > .player__pane--play');
  const bar = await pane.evaluate((el) => {
    const clear = /^(transparent|rgba\(0, 0, 0, 0\))$/;
    if (CSS.supports('scrollbar-color', 'transparent transparent')) {
      const parts = getComputedStyle(el).scrollbarColor.trim().split(/\s+(?![^(]*\))/);
      return { how: 'scrollbar-color', value: parts.join(' '), clear: parts.length === 2 && parts.every((p) => clear.test(p)) };
    }
    // A browser without `scrollbar-color` (Safari before it, older Chromium) draws the bar from `::-webkit-scrollbar`
    // rules: the column's thumb and track must both be transparent.
    const rules = Array.from(document.styleSheets).flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return []; // another site's sheet can't be read
      }
    });
    // A style rule has `cssRules` too (for nested rules), so it is checked first, then any group (`@supports`, `@media`).
    const flat = (list: CSSRule[]): CSSStyleRule[] =>
      list.flatMap((r) => (r instanceof CSSStyleRule ? [r] : 'cssRules' in r ? flat(Array.from((r as CSSGroupingRule).cssRules)) : []));
    const parts = ['thumb', 'track'].map((part) =>
      flat(rules).some((r) => r.selectorText.includes(`.player__pane--play::-webkit-scrollbar-${part}`) && clear.test(r.style.backgroundColor)),
    );
    return { how: '::-webkit-scrollbar', value: parts.join(' '), clear: parts.every(Boolean) };
  });
  expect(bar.clear, `${bar.how}: ${bar.value}`).toBe(true);

  const room = await pane.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(room).toBeGreaterThan(0);
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

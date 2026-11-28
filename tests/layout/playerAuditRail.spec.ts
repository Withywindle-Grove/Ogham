// Batch B of plan dec-14-player-audit-fixes (page 38 of december, frames 38-1, approved 2026-11-24): the rail's tabs and
// the handle. Ruled 7a: the shared parts (SectionNav, DividerHandle) change on every screen that places them, so the
// GM's campaign screen is checked beside the Player tab.
// Purposes, each a plain sentence:
//   1a. On a tablet held sideways, folded and open, each rail tab is at least 44 px wide and 8 px or more from the next
//       (the Player tab, a caster's four tabs, and the GM's campaign screen).
//   1b. The handle's tap area is 8 px or more from the nearest tab, folded and open.
//   1c. The handle is drawn as a grip, 24 by 44 px, with the arrow inside it in Ink at 16 px; the grip's edge is 3 to 1
//       or better against what is actually painted behind the grip, in light and in dark, on the Player tab and the GM's
//       campaign screen. The arrow sits a hairline back from the way it points, so it looks centred (approval fix,
//       25 Nov). With Larger text the arrow still sits inside the grip, across and down.
//   1d. On a tablet held upright the tabs in their row are 8 px or more apart.
//   1e. The phone's tab bar (375 px) and a phone on its side (the short 600 to 1023 px bar) keep their tabs touching,
//       unchanged, and neither scrolls sideways.
//   1f. The keyboard's focus ring still goes round the grip, not the whole tall tap zone.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { layoutProblems } from './checks.ts';

const SIDEWAYS = { width: 1180, height: 820 };

type Who = { name: string; url: string; row: RegExp; nav: string; tabs: number };
const PLAYER: Who = { name: 'the Player tab', url: '/layout.html?as=player&p1=1', row: /The Storm Lantern Road/, nav: 'Main', tabs: 3 };
const CASTER: Who = { name: "a caster's four tabs", url: '/layout.html?as=player&magic=1', row: /The Drowned Marches/, nav: 'Main', tabs: 4 };
const GM: Who = { name: "the GM's campaign screen", url: '/layout.html?as=gm', row: /The Drowned Marches/, nav: 'Campaign sections', tabs: 3 };

async function open(page: Page, who: Who, folded: boolean) {
  await page.addInitScript((value) => localStorage.setItem('grimoire.navCollapsed', value), folded ? 'yes' : 'no');
  await page.goto(who.url);
  await page.getByRole('button', { name: who.row }).click();
  const nav = page.getByRole('navigation', { name: who.nav });
  await expect(nav.getByRole('button')).toHaveCount(who.tabs);
  if (folded) await expect(nav).toHaveClass(/section-nav--collapsed/);
  else await expect(nav).not.toHaveClass(/section-nav--collapsed/);
  await page.evaluate(() => document.fonts.ready);
  return nav;
}

const boxes = async (nav: ReturnType<Page['getByRole']>) => {
  const tabs = nav.getByRole('button');
  const out = [];
  for (let i = 0; i < (await tabs.count()); i++) out.push((await tabs.nth(i).boundingBox())!);
  return out;
};

type Box = { x: number; y: number; width: number; height: number };
/** The room between each tab and the one after it: below it in a column, beside it in a row. */
const gaps = (tabs: Box[], axis: 'down' | 'across') =>
  tabs.slice(1).map((tab, i) => {
    const before = tabs[i]!;
    return axis === 'down' ? tab.y - (before.y + before.height) : tab.x - (before.x + before.width);
  });

/** Contrast between two CSS colours (rgb or rgba, taken as opaque), by the WCAG formula. */
function contrast(a: string, b: string) {
  const lum = (css: string) => {
    const [r = 0, g = 0, bl = 0] = (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

for (const who of [PLAYER, CASTER, GM]) {
  for (const folded of [true, false]) {
    const state = folded ? 'folded' : 'open';
    test.describe(`${who.name}, ${state}, sideways`, () => {
      test.use({ viewport: SIDEWAYS });

      test(`1a. each rail tab is 44 px wide or more and 8 px from the next (${who.name}, ${state})`, async ({ page }) => {
        const nav = await open(page, who, folded);
        const tabs = await boxes(nav);
        for (const tab of tabs) expect(tab.width).toBeGreaterThanOrEqual(44 - 0.5);
        for (const gap of gaps(tabs, 'down')) expect(gap).toBeGreaterThanOrEqual(8 - 0.5);
        expect(await layoutProblems(page)).toEqual([]);
      });

      test(`1b. the handle's tap area is 8 px or more from the nearest tab (${who.name}, ${state})`, async ({ page }) => {
        const nav = await open(page, who, folded);
        const zone = (await page.getByRole('button', { name: folded ? 'Show the menu' : 'Fold the menu' }).boundingBox())!;
        const right = Math.max(...(await boxes(nav)).map((tab) => tab.x + tab.width));
        expect(zone.x - right).toBeGreaterThanOrEqual(8 - 0.5);
      });
    });
  }
}

for (const scheme of ['light', 'dark'] as const) {
  for (const folded of [true, false]) {
    const state = folded ? 'folded' : 'open';
    test.describe(`the grip, ${state}, ${scheme}`, () => {
      test.use({ viewport: SIDEWAYS, colorScheme: scheme });

      for (const who of [PLAYER, GM]) {
        test(`1c. the handle is a 24 by 44 grip, its arrow inside in Ink at 16 px, its edge 3 to 1 on the page (${who.name}, ${state}, ${scheme})`, async ({ page }) => {
          await open(page, who, folded);
          const handle = page.getByRole('button', { name: folded ? 'Show the menu' : 'Fold the menu' });
          const grip = handle.locator('.divider-handle__pill');
          const box = (await grip.boundingBox())!;
          expect([Math.round(box.width), Math.round(box.height)]).toEqual([24, 44]);
          const arrow = (await handle.locator('.divider-handle__arrow').boundingBox())!;
          expect(arrow.x).toBeGreaterThanOrEqual(box.x);
          expect(arrow.x + arrow.width).toBeLessThanOrEqual(box.x + box.width);
          // The optical nudge: a hairline back from the way it points (◀ open: right; ▶ folded: left).
          const off = arrow.x + arrow.width / 2 - (box.x + box.width / 2);
          expect(off).toBeCloseTo(folded ? -1 : 1, 0);
          const look = await page.evaluate(() => {
            const grip = document.querySelector('.divider-handle__pill')!;
            const arrow = document.querySelector('.divider-handle__arrow')!;
            const probe = document.createElement('span');
            probe.style.color = 'var(--ink)';
            document.body.append(probe);
            const ink = getComputedStyle(probe).color;
            // The control line (--line-control, 1.5 px) as this browser draws it: Chrome draws it 1 px, WebKit 1.5.
            probe.style.borderTop = 'var(--line-control) solid';
            const line = getComputedStyle(probe).borderTopWidth;
            const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--line-control'));
            probe.remove();
            // What is painted just outside the grip's edge: the first element under that point, the handle aside,
            // with a fill of its own; else the page's root.
            const r = grip.getBoundingClientRect();
            const handle = grip.closest('.divider-handle')!;
            const opaque = (el: Element) => {
              const c = getComputedStyle(el).backgroundColor;
              return c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
            };
            const under = document.elementsFromPoint(r.left - 2, r.top + r.height / 2).find((el) => !handle.contains(el) && opaque(el));
            const behind = getComputedStyle(under ?? document.documentElement).backgroundColor;
            const g = getComputedStyle(grip);
            const a = getComputedStyle(arrow);
            return { edge: g.borderTopColor, edgeWidth: g.borderTopWidth, line, token, behind, arrowColour: a.color, arrowSize: a.fontSize, ink };
          });
          // The grip's edge is the 1.5 px control line, drawn as wide as this browser draws that line.
          expect(look.token).toBeGreaterThanOrEqual(1.5);
          expect(parseFloat(look.edgeWidth)).toBeGreaterThanOrEqual(1);
          expect(look.edgeWidth).toBe(look.line);
          expect(contrast(look.edge, look.behind)).toBeGreaterThanOrEqual(3);
          expect(look.arrowColour).toBe(look.ink);
          expect(look.arrowSize).toBe('16px');
        });
      }

      test(`1f. the keyboard's focus ring goes round the grip (${state}, ${scheme})`, async ({ page }) => {
        const nav = await open(page, PLAYER, folded);
        await nav.getByRole('button').last().focus();
        await page.keyboard.press('Tab');
        const handle = page.getByRole('button', { name: folded ? 'Show the menu' : 'Fold the menu' });
        await expect(handle).toBeFocused();
        const ring = await handle.locator('.divider-handle__pill').evaluate((el) => {
          const s = getComputedStyle(el);
          return { style: s.outlineStyle, width: s.outlineWidth };
        });
        expect(ring.style).toBe('solid');
        expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
        expect(await handle.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
      });
    });
  }
}

// Approval fix (25 Nov): with Larger text (set before the page loads) the arrow grows with the text and must still
// sit inside the grip, across and down, folded and open, on the Player tab and the GM's campaign screen.
test.describe('the grip with Larger text', () => {
  test.use({ viewport: SIDEWAYS });

  for (const who of [PLAYER, GM]) {
    for (const folded of [true, false]) {
      const state = folded ? 'folded' : 'open';
      test(`1c. with Larger text the arrow is inside the grip on both axes (${who.name}, ${state})`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
        await open(page, who, folded);
        const handle = page.getByRole('button', { name: folded ? 'Show the menu' : 'Fold the menu' });
        const box = (await handle.locator('.divider-handle__pill').boundingBox())!;
        const arrow = (await handle.locator('.divider-handle__arrow').boundingBox())!;
        expect(arrow.x).toBeGreaterThanOrEqual(box.x);
        expect(arrow.x + arrow.width).toBeLessThanOrEqual(box.x + box.width);
        expect(arrow.y).toBeGreaterThanOrEqual(box.y);
        expect(arrow.y + arrow.height).toBeLessThanOrEqual(box.y + box.height);
      });
    }
  }
});

test.describe('upright', () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  for (const who of [PLAYER, CASTER, GM]) {
    test(`1d. the tabs in their row are 8 px or more apart (${who.name})`, async ({ page }) => {
      const nav = await open(page, who, false);
      const tabs = await boxes(nav);
      for (const tab of tabs) expect(Math.abs(tab.y - tabs[0]!.y)).toBeLessThanOrEqual(1);
      for (const gap of gaps(tabs, 'across')) expect(gap).toBeGreaterThanOrEqual(8 - 0.5);
      expect(await layoutProblems(page)).toEqual([]);
    });
  }
});

for (const size of [
  { name: 'a phone', width: 375, height: 812 },
  { name: 'a phone on its side', width: 812, height: 375 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const who of [PLAYER, GM]) {
      test(`1e. the tab bar's tabs still touch (${size.name}, ${who.name})`, async ({ page }) => {
        await page.goto(who.url);
        await page.getByRole('button', { name: who.row }).click();
        const nav = page.getByRole('navigation', { name: who.nav });
        await expect(nav.getByRole('button').first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const tabs = await boxes(nav);
        for (const gap of gaps(tabs, 'across')) expect(Math.abs(gap)).toBeLessThanOrEqual(0.5);
        await expect(page.locator('.divider-handle')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      });
    }
  });
}

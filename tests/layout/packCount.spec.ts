// The count on the Pack's icon (K19b of docs/specs/scene-pack.md, piece D; page 45's FD7, approved 2026-11-26; p45-10),
// in a real browser on the layout page (`?finds=1`: the GM has sent Wren a Bronze ring; `hundred`: a hundred things).
// What it checks, in plain words:
//   1. On the Player tab, the Pack's tab carries its mark at the icon's upper right, read "Pack, 1 new", in its own
//      place and on screen (a phone: inside its tab; a tablet's rail: inside the rail, clear of the other tabs and of
//      the fold's handle); the mark is 20 px tall and its figure 14 px bold; the tab
//      stays a 44 px target; no sideways scrolling, readable text and no serious accessibility problem: on a phone's
//      tab bar at 375 px and a tablet's rail, in light and dark, and with Larger text.
//   2. Past 99 the mark reads "99+" and still sits in its own place, on a phone and a tablet.
//   3. "Got it" on the Pack takes the mark away.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;

async function openPlayer(page: Page, finds: string, theme: 'light' | 'dark' = 'light', larger = false) {
  await page.emulateMedia({ colorScheme: theme });
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=player&finds=${finds}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens' }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

/** The mark's box, its tab's and its icon's, and its figure's size and weight. */
async function markOn(page: Page) {
  const tab = nav(page).getByRole('button', { name: /^Pack, \d+ new$/ });
  const mark = tab.locator('.section-nav__badge');
  await expect(mark).toBeVisible();
  const style = await mark.evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), weight: Number(getComputedStyle(el).fontWeight) }));
  return { tab: (await tab.boundingBox())!, mark: (await mark.boundingBox())!, icon: (await tab.locator('.section-nav__icon').boundingBox())!, text: await mark.textContent(), ...style };
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * The mark stays in its own place: on a phone inside its tab (never reaching the next one); on a tablet, whose rail may
 * be folded to its icons (FD7 draws the mark past the icon's tile there), inside the rail's column and clear of the
 * fold's handle (its drawn grip) and of every other tab. Everywhere a tap on the mark is a tap on the Pack's tab.
 */
async function markInPlace(page: Page, m: Awaited<ReturnType<typeof markOn>>) {
  const tabs = await nav(page).getByRole('button').all();
  for (const other of tabs) {
    const box = (await other.boundingBox())!;
    if (box.x === m.tab.x && box.y === m.tab.y) continue;
    expect(overlaps(m.mark, box)).toBe(false);
  }
  // A tap on the mark's middle is a tap on the Pack's tab (the mark is not a target of its own, FD7).
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') ?? null, { x: m.mark.x + m.mark.width / 2, y: m.mark.y + m.mark.height / 2 });
  expect(hit).toMatch(/^Pack, \d+ new$/);
  const pill = page.locator('.divider-handle__pill');
  if (await pill.count()) {
    expect(overlaps(m.mark, (await pill.boundingBox())!)).toBe(false);
    const side = (await page.locator('.player__side').boundingBox())!;
    expect(m.mark.x + m.mark.width).toBeLessThanOrEqual(side.x + side.width);
  } else {
    expect(m.mark.x).toBeGreaterThanOrEqual(m.tab.x);
    expect(m.mark.x + m.mark.width).toBeLessThanOrEqual(m.tab.x + m.tab.width);
  }
  expect(m.mark.y).toBeGreaterThanOrEqual(0);
}

for (const size of SIZES) {
  test.describe(`${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const [theme, larger] of [
      ['light', false],
      ['dark', false],
      ['light', true],
    ] as const) {
      // Purpose 1.
      test(`one find (${theme}${larger ? ', Larger text' : ''}): the mark on the Pack's icon, in its own place`, async ({ page }) => {
        await openPlayer(page, '1', theme, larger);
        await expect(nav(page).getByRole('button', { name: 'Pack, 1 new' })).toBeVisible();
        const m = await markOn(page);
        expect(m.text).toBe('1');
        await page.screenshot({ path: `test-results/layout-screens/k19b-count-${theme}${larger ? '-larger' : ''}-${size.width}.png` });
        // At the icon's upper right, 20 px tall, its figure 14 px bold (FD7).
        expect(m.mark.x + m.mark.width / 2).toBeGreaterThan(m.icon.x + m.icon.width / 2);
        expect(m.mark.y).toBeLessThan(m.icon.y + m.icon.height / 2);
        expect(Math.round(m.mark.height)).toBeGreaterThanOrEqual(20);
        expect(m.size).toBeGreaterThanOrEqual(14);
        expect(m.weight).toBeGreaterThanOrEqual(700);
        await markInPlace(page, m);
        expect(m.tab.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }

    // Purpose 2.
    test('past 99 the mark reads "99+", in its own place', async ({ page }) => {
      test.setTimeout(60_000);
      await openPlayer(page, 'hundred');
      await expect(nav(page).getByRole('button', { name: 'Pack, 100 new' })).toBeVisible({ timeout: 20_000 });
      const m = await markOn(page);
      expect(m.text).toBe('99+');
      await page.screenshot({ path: `test-results/layout-screens/k19b-count-99-${size.width}.png` });
      await markInPlace(page, m);
      expect(await layoutProblems(page)).toEqual([]);
    });

    // Purpose 3.
    test('"Got it" on the Pack takes the mark away', async ({ page }) => {
      await openPlayer(page, '1');
      await nav(page).getByRole('button', { name: 'Pack, 1 new' }).click();
      await page.getByRole('button', { name: /^Got it/ }).click();
      await expect(nav(page).getByRole('button', { name: 'Pack', exact: true })).toBeVisible();
      await expect(nav(page).locator('.section-nav__badge')).toHaveCount(0);
    });
  });
}

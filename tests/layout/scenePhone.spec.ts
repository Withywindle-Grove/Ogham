// The Scene on a phone (plan dec-9-the-whole-scene S16; page 16, T8a to T8c, T9d, T9e; st-6), at 375 px in a real
// browser on the layout page's invented harbour (`?placePage=spots|spot`, `&session=running|paused`, `&daylight=1` for
// what is left of the light, `&outdoors=1` for a day-by-day mode, `&waiting=4` for Waiting for you). What it checks:
//   * in a dark mode (the harbour's dungeon) the sun's line is gone and Light is the only light fact (⚑ 1 on #958);
//   * the GM's band, outdoors: with Next day (T8a) or Resume session (T8c) beside the date, what is left of the light
//     stands on a line of its own under the date and under the button, one line, at the band's left; icon buttons under it;
//   * the players' band has no button, so their light stays beside the date (T9d);
//   * Waiting for you comes before the place (T8b), and Move on is fixed above the tab bar, there still at the foot of
//     the page, with nothing of the page left hidden under it;
//   * at Larger text and with the longest place name the same holds; nothing scrolls sideways, every tap is 44 px, and
//     axe finds no serious problem, in light and dark. Each test saves its picture.
// The players' paused line under the date (T9e) is checked in playersTop.spec.ts; the facts two by two, the icon
// buttons' row and the band's session states in sceneBand.spec.ts; the strip as icons in sceneStrip.spec.ts.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

type Box = { x: number; y: number; width: number; height: number };

async function openScene(page: Page, as: 'gm' | 'player', query: string, larger = false) {
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=${as}&${query}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  if (as === 'player') await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('group', { name: 'Scene facts' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;

/** How many lines an element's text takes. */
const lines = (locator: Locator) => locator.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));

/**
 * The date line's `<p>` is `display: contents` on a phone (SceneBand.css, S16) so its parts join the band's grid; in
 * some engines that drops an element from the accessibility tree. Purpose: the date and what is left of the light are
 * both still in the band's accessibility tree, with their words.
 */
async function dateAndLightInTree(page: Page) {
  const band = page.locator('.scene-band');
  const [date, light] = await Promise.all([band.locator('.scene-band__date').innerText(), band.locator('.scene-band__light').innerText()]);
  expect(date.trim().length).toBeGreaterThan(0);
  expect(light.trim().length).toBeGreaterThan(0);
  const tree = await band.ariaSnapshot();
  expect(tree).toContain(date.trim());
  expect(tree).toContain(light.trim());
}

/** The visible accent buttons on the page (one accent a screen). */
const accents = (page: Page) => page.locator('.button-primary:visible');

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the Scene on a phone (375 px, ${scheme})`, () => {
    test.use({ viewport: { width: 375, height: 812 }, colorScheme: scheme });

    for (const larger of [false, true]) {
      const text = larger ? ', Larger text' : '';

      // Purpose (T8a, outdoors: the sun's line shows only outside a dark mode): beside Next day, what is left of the
      // light takes a line of its own under the date and the button, on one line at the band's left, and the icon
      // buttons come under it; the date stays on one line.
      test(`the GM's band: the light on its own line${text}`, async ({ page }) => {
        await openScene(page, 'gm', 'placePage=spots&session=running&daylight=1&outdoors=1', larger);
        const band = page.locator('.scene-band');
        const light = band.locator('.scene-band__light');
        await expect(light).toHaveText('2 hours of light left.');
        const [date, next, lit, tool, whole] = await Promise.all([box(band.locator('.scene-band__date')), box(page.getByRole('button', { name: 'Next day' })), box(light), box(page.getByRole('group', { name: 'Quick actions' })), box(band)]);
        expect(lit.y).toBeGreaterThanOrEqual(date.y + date.height - 1);
        expect(lit.y).toBeGreaterThanOrEqual(next.y + next.height - 1);
      await dateAndLightInTree(page);
        expect(Math.abs(lit.x - date.x)).toBeLessThan(2);
        expect(lit.x).toBeGreaterThanOrEqual(whole.x);
        expect(await lines(light)).toBe(1);
        expect(await lines(band.locator('.scene-band__date'))).toBe(1);
        expect(tool.y).toBeGreaterThanOrEqual(lit.y + lit.height - 1);
        await page.screenshot({ path: `test-results/layout-screens/scene-phone-gm-light-${larger ? 'larger-' : ''}${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }

    // Purpose (⚑ 1 on #958, "yes, b", 2026-11-18; page 16's T2 overtaken): in a dark mode (a dungeon) the sun's line
    // ("N hours of light left") is gone from the band, for the GM and the players, and Light is the only light fact.
    for (const as of ['gm', 'player'] as const) {
      test(`underground, no sun's line in the ${as}'s band`, async ({ page }) => {
        await openScene(page, as, 'placePage=spots&session=running&daylight=1');
        await expect(page.locator('.scene-band__light')).toHaveCount(0);
        await expect(page.locator('.scene-band')).not.toContainText('of light left');
        await expect(page.getByRole('group', { name: 'Scene facts' })).toContainText('torch');
      });
    }

    // Purpose (T8c): paused, Resume session is the one accent beside the date and the light still has its own line
    // under the date and the button.
    test("the GM's band paused: the light under Resume session", async ({ page }) => {
      await openScene(page, 'gm', 'placePage=spots&session=paused&daylight=1&outdoors=1');
      const resume = page.getByRole('button', { name: 'Resume session' });
      await expect(resume).toHaveClass(/button-primary/);
      await expect(accents(page)).toHaveCount(1);
      const light = page.locator('.scene-band__light');
      const [lit, button] = await Promise.all([box(light), box(resume)]);
      expect(lit.y).toBeGreaterThanOrEqual(button.y + button.height - 1);
      expect(await lines(light)).toBe(1);
      await page.screenshot({ path: `test-results/layout-screens/scene-phone-gm-paused-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    // Purpose (T9d): the players' band has no button, so the light stays on the date's line, beside it.
    test("the players' band: the light beside the date", async ({ page }) => {
      await openScene(page, 'player', 'placePage=spots&session=running&daylight=1&outdoors=1');
      const band = page.locator('.scene-band');
      await expect(band.getByRole('button', { name: 'Next day' })).toHaveCount(0);
      const [date, lit] = await Promise.all([box(band.locator('.scene-band__date')), box(band.locator('.scene-band__light'))]);
      expect(lit.x).toBeGreaterThan(date.x + date.width - 1);
      expect(Math.abs(lit.y + lit.height / 2 - (date.y + date.height / 2))).toBeLessThan(6);
      await page.screenshot({ path: `test-results/layout-screens/scene-phone-player-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    // Purpose (T8b): Waiting for you comes before the place; Move on is fixed just above the tab bar, still there at the
    // foot of the page, and the page's last part ends above it, never hidden under it.
    test('Waiting for you before the place, Move on above the tab bar', async ({ page }) => {
      await openScene(page, 'gm', 'placePage=spot&session=running&daylight=1&waiting=4');
      const waiting = page.getByRole('region', { name: 'Waiting for you' });
      const place = page.getByRole('region', { name: 'Where the party is' });
      await expect(waiting).toBeVisible();
      const [w, p] = await Promise.all([box(waiting), box(place)]);
      expect(w.y + w.height).toBeLessThanOrEqual(p.y + 1);
      const bar = page.locator('.place-page__bar');
      const move = bar.getByRole('button', { name: 'Move on' });
      await expect(move).toBeVisible();
      const tabs = page.getByRole('navigation', { name: 'Campaign sections' });
      // Move on itself stands wholly above the tab bar and close over it (within its bar's padding and a little more:
      // the bar is placed by the --tab-bar token, the tab bar is as tall as its contents).
      const overTabs = async () => {
        const [m, t] = await Promise.all([box(move), box(tabs)]);
        return t.y - (m.y + m.height);
      };
      for (const at of ['top', 'foot'] as const) {
        if (at === 'foot') {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          // The bar settles once the scroll has: poll the gap instead of waiting a fixed time.
          await expect.poll(overTabs, { message: 'Move on settles above the tab bar after the scroll' }).toBeLessThanOrEqual(16);
        }
        const gap = await overTabs();
        expect(gap, `Move on above the tab bar, at the page's ${at}`).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(16);
      }
      // The page's last part ends above the bar at the foot of the page.
      const lastBottom = await page.locator('.place-page').evaluate((el) => {
        const parts = [...el.children].filter((c) => !c.classList.contains('place-page__bar'));
        return Math.max(...parts.map((c) => c.getBoundingClientRect().bottom));
      });
      expect(lastBottom).toBeLessThanOrEqual((await box(bar)).y + 1);
      await page.screenshot({ path: `test-results/layout-screens/scene-phone-waiting-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    // Purpose (p2p-20; page 24, TF1b): outdoors, folded, the band keeps the heading with the fold mark at its right, the
    // date with Next day, the light on its own line, the due Weather's one line under the light, and the icon buttons
    // under that (`&weather=due`); the facts and the strip are gone, and nothing scrolls sideways, with the longest place
    // name too.
    for (const name of ['', '&name=long']) {
      test(`the GM's band folded, outdoors${name ? ', the longest place name' : ''}`, async ({ page }) => {
        await openScene(page, 'gm', `placePage=spots&session=running&daylight=1&outdoors=1&weather=due${name}`);
        await page.getByRole('button', { name: 'Fold the top away' }).click();
        await expect(page.getByRole('group', { name: 'Scene facts' })).toHaveCount(0);
        await expect(page.getByRole('group', { name: 'Sequence of play' })).toHaveCount(0);
        const band = page.locator('.scene-band');
        const [heading, mark, next, lit, tool] = await Promise.all([box(band.getByRole('heading')), box(page.getByRole('button', { name: 'Show the top' })), box(page.getByRole('button', { name: 'Next day' })), box(band.locator('.scene-band__light')), box(page.getByRole('group', { name: 'Quick actions' }))]);
        expect(heading.x + heading.width).toBeLessThanOrEqual(mark.x + 1);
        expect(mark.y + mark.height).toBeLessThanOrEqual(next.y + 1);
        expect(lit.y).toBeGreaterThanOrEqual(next.y + next.height - 1);
        expect(await lines(band.locator('.scene-band__light'))).toBe(1);
        const due = band.locator('.scene-band__due-line');
        await expect(due).toHaveText(['Weather: To roll']);
        const line = await box(due);
        expect(line.y).toBeGreaterThanOrEqual(lit.y + lit.height - 1);
        expect(tool.y).toBeGreaterThanOrEqual(line.y + line.height - 1);
        expect(await lines(due)).toBe(1);
        await page.screenshot({ path: `test-results/layout-screens/scene-phone-folded${name ? '-long' : ''}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }

    // Purpose (messy data): with the longest place name the band keeps the light on its own line and nothing scrolls
    // sideways.
    test('the longest place name', async ({ page }) => {
      await openScene(page, 'gm', 'placePage=spots&session=running&daylight=1&outdoors=1&name=long');
      const [lit, next] = await Promise.all([box(page.locator('.scene-band__light')), box(page.getByRole('button', { name: 'Next day' }))]);
      expect(lit.y).toBeGreaterThanOrEqual(next.y + next.height - 1);
      await page.screenshot({ path: `test-results/layout-screens/scene-phone-long-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  });
}

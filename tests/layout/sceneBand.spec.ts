// The Scene's band, facts row and session states (plan dec-9-the-whole-scene S1, S4, S9; page 16 T1, T3a, T3b, T8a),
// in a real browser on the layout page's invented harbour (`?placePage=spots`, with `&session=running|paused`). What it
// checks, in plain words:
//   * with no session yet the heading says so, Start session is the page's one accent, and there is no facts row;
//   * while a session runs the heading names the place and the turn, Next turn carries no accent, the facts show, each
//     value on one line, four across on a tablet and two by two on a phone;
//   * paused, Resume session is the one accent and the heading has no count;
//   * controls side by side in the band share one height, 52 px (p2p-16; page 23, frame LA1): the icon buttons, Next
//     turn (or Start, Resume) and the menu button; the same in town and downtime (`?town=town|downtime`: Advance time
//     or Next day, Depart, the menu button); the check names the controls that must really sit side by side;
//   * the top folds (p2p-20; page 24, TF1, TF1b): the fold mark before the menu button (Q3; a phone: the heading's right)
//     hides the facts, the strip and the tables row, keeps the band and Waiting for you, and a due fact as one line;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, in light and dark.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, session: '' | 'running' | 'paused') {
  await page.goto(`/layout.html?as=gm&placePage=spots${session ? `&session=${session}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.getByRole('region', { name: 'Locations' })).toBeVisible();
}

/** The visible accent buttons on the page (one accent a screen). */
const accents = (page: Page) => page.locator('.button-primary:visible');

/** The band's one height for its controls (p2p-16; page 23, frame LA1). */
const BAND_CONTROL = 52;

/**
 * The band's controls (its icon buttons, Next turn or Start or Resume, the menu button), row by row: two controls are
 * in one row when they overlap top to bottom. Each row gives its controls' names and their heights, to the pixel.
 */
async function bandRows(page: Page) {
  // The menu button stands outside the actions' box beside the fold mark (Q3), so both boxes are read.
  return page.locator('.scene-band').first().evaluate((band) => {
    const controls = [...band.querySelectorAll<HTMLElement>('.scene-band__actions button, .scene-band__menu button')]
      .map((el) => ({ name: el.getAttribute('aria-label') ?? el.textContent ?? '', box: el.getBoundingClientRect() }))
      .filter((c) => c.box.width > 0)
      .sort((a, b) => a.box.top - b.box.top);
    const rows: { names: string[]; heights: number[]; tops: number[]; bottom: number }[] = [];
    for (const c of controls) {
      const row = rows.at(-1);
      if (row && c.box.top < row.bottom - 1) {
        row.names.push(c.name);
        row.heights.push(Math.round(c.box.height));
        row.tops.push(Math.round(c.box.top));
        row.bottom = Math.max(row.bottom, c.box.bottom);
      } else rows.push({ names: [c.name], heights: [Math.round(c.box.height)], tops: [Math.round(c.box.top)], bottom: c.box.bottom });
    }
    return rows.map(({ names, heights, tops }) => ({ names, heights, tops }));
  });
}

/**
 * One height in a row (p2p-16): every control of the band stands 52 px high, and the controls that sit side by side
 * (one row) start on one line, so they share one height from top to bottom. `together` names the groups that must
 * really be side by side, so the check never passes on controls that each sit on a line of their own.
 */
async function expectOneHeight(page: Page, names: readonly string[], together: readonly (readonly string[])[] = []) {
  const rows = await bandRows(page);
  expect(rows.flatMap((r) => r.names)).toEqual(expect.arrayContaining([...names]));
  for (const row of rows) {
    expect(row, `the row of ${row.names.join(', ')}`).toEqual({ names: row.names, heights: row.names.map(() => BAND_CONTROL), tops: row.names.map(() => row.tops[0]) });
  }
  for (const group of together) {
    const row = rows.find((r) => r.names.includes(group[0]!));
    expect(row?.names ?? [], `side by side: ${group.join(', ')}`).toEqual(expect.arrayContaining([...group]));
  }
  return rows;
}

/** The layout page's invented quay between expeditions (`?town=town|downtime`), a session running. */
async function openQuay(page: Page, town: 'town' | 'downtime') {
  await page.goto(`/layout.html?as=gm&town=${town}`);
  await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
  await expect(page.getByRole('button', { name: 'Depart' })).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Scene's band (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: before the first session the band says "No session yet", Start session is the one accent, and no facts show.
      test('no session yet', async ({ page }) => {
        await openScene(page, '');
        await expect(page.getByRole('heading', { name: 'No session yet' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start session' })).toHaveClass(/button-primary/);
        // ic-4 (S17): it reads "Start" with the campfire beside it.
        await expect(page.getByRole('button', { name: 'Start session' })).toHaveText('Start');
        await expect(page.getByRole('button', { name: 'Start session' }).locator('svg')).toHaveCount(1);
        await expect(accents(page)).toHaveCount(1);
        await expect(page.getByRole('group', { name: 'Scene facts' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Next turn' })).toHaveCount(0);
        // p2p-16 (LA1): Start and the menu button stand one height, side by side on a tablet. On a phone the menu
        // button sits on a line of its own under Start today, so no two controls are side by side there: each still
        // measures 52 px.
        await expectOneHeight(page, ['Start session', 'Time options'], size.name === 'tablet' ? [['Start session', 'Time options']] : []);
        await page.screenshot({ path: `test-results/layout-screens/scene-band-none-${size.width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: while a session runs the heading names the place and the turn, the facts show on one line each here (their tiles hold them; a value may take two lines only where one would overrun its tile, T12), and Next turn is plain.
      test('a session running', async ({ page }) => {
        await openScene(page, 'running');
        await expect(page.getByRole('heading', { name: /, turn 1$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next turn' })).toHaveClass(/button-secondary/);
        await expect(accents(page)).toHaveCount(1);
        const facts = page.getByRole('group', { name: 'Scene facts' });
        await expect(facts).toBeVisible();
        const tiles = facts.getByRole('button');
        const count = await tiles.count();
        expect(count).toBeGreaterThan(0);
        // Each value whole on one line at these widths (never cut short); two by two on a phone, side by side at least
        // two across on a tablet (four where the band is wide enough).
        const lefts = new Set<number>();
        for (let i = 0; i < count; i += 1) {
          const value = tiles.nth(i).locator('.scene-fact__value');
          const fit = await value.evaluate((el) => ({ lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), cut: el.scrollWidth > el.clientWidth + 1 }));
          expect(fit).toEqual({ lines: 1, cut: false });
          lefts.add(Math.round((await tiles.nth(i).boundingBox())!.x));
        }
        if (size.name === 'phone') expect(lefts.size).toBe(Math.min(count, 2));
        else expect(lefts.size).toBeGreaterThanOrEqual(Math.min(count, 2));
        await page.screenshot({ path: `test-results/layout-screens/scene-band-running-${size.width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (S2, S3; page 16 T6b, T8a; p2p-16, page 23 LA1): the band's icon buttons are 52 px squares 8 px apart,
      // icon only and never the accent; on a tablet they sit left of Next turn on its line, on a phone on a row of their
      // own under the date; controls side by side share one height (the icon buttons, Next turn and the menu button on
      // a tablet; Next turn and the menu button on a phone); the menu opens with its items, each with an icon, and
      // nothing scrolls sideways.
      test('the icon buttons and the menu', async ({ page }) => {
        await openScene(page, 'running');
        const tools = page.getByRole('group', { name: 'Quick actions' });
        await expect(tools).toBeVisible();
        const buttons = tools.getByRole('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
        const boxes = [];
        for (let i = 0; i < count; i += 1) {
          const box = (await buttons.nth(i).boundingBox())!;
          expect(Math.round(box.width)).toBe(BAND_CONTROL);
          expect(Math.round(box.height)).toBe(BAND_CONTROL);
          await expect(buttons.nth(i)).not.toHaveClass(/button-primary/);
          boxes.push(box);
        }
        for (let i = 1; i < boxes.length; i += 1) expect(Math.round(boxes[i]!.x - (boxes[i - 1]!.x + boxes[i - 1]!.width))).toBe(8);
        // p2p-16 (LA1): one height in a row. On a tablet the band's controls are all one row; on a phone Next turn and
        // the menu button are one row and the icon buttons the next.
        const rows = await expectOneHeight(page, ['Encounter check', 'Next turn', 'Time options'], [size.name === 'tablet' ? ['Encounter check', 'Next turn', 'Time options'] : ['Next turn', 'Time options']]);
        const sideBySide = rows.find((r) => r.names.includes('Next turn'))!.names;
        expect(sideBySide.includes('Encounter check')).toBe(size.name === 'tablet');
        const menu = (await page.getByRole('button', { name: 'Time options' }).boundingBox())!;
        expect(Math.round(menu.width)).toBe(BAND_CONTROL);
        const next = (await page.getByRole('button', { name: 'Next turn' }).boundingBox())!;
        const date = (await page.locator('.scene-band__date-line').boundingBox())!;
        if (size.name === 'phone') {
          expect(boxes[0]!.y).toBeGreaterThanOrEqual(date.y + date.height - 1);
          expect(boxes[0]!.y).toBeGreaterThanOrEqual(next.y + next.height - 1);
        } else {
          expect(boxes.at(-1)!.x + boxes.at(-1)!.width).toBeLessThanOrEqual(next.x);
          expect(Math.abs(boxes[0]!.y + boxes[0]!.height / 2 - (next.y + next.height / 2))).toBeLessThan(8);
        }
        await page.getByRole('button', { name: 'Time options' }).click();
        const panel = page.locator('.more-menu__panel');
        await expect(panel.getByRole('button', { name: 'Advance by…' })).toBeVisible();
        await expect(panel.getByRole('button', { name: 'Reminders' })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/scene-band-tools-${size.width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: paused, the page stays as left with Resume session as the one accent and no count in the heading.
      test('paused', async ({ page }) => {
        await openScene(page, 'paused');
        await expect(page.getByRole('button', { name: 'Resume session' })).toHaveClass(/button-primary/);
        // ic-4 (S17): it reads "Resume" with the campfire beside it.
        await expect(page.getByRole('button', { name: 'Resume session' })).toHaveText('Resume');
        await expect(page.getByRole('button', { name: 'Resume session' }).locator('svg')).toHaveCount(1);
        await expect(accents(page)).toHaveCount(1);
        await expect(page.getByRole('heading', { name: /turn \d+$/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Show details/ })).toHaveCount(0);
        // S2: no icon buttons while paused (T3b).
        await expect(page.getByRole('group', { name: 'Quick actions' })).toHaveCount(0);
        // p2p-16 (LA1): Resume and the menu button stand one height, side by side on a tablet (on a phone the menu
        // button sits on a line of its own under Resume today; each still measures 52 px).
        await expectOneHeight(page, ['Resume session', 'Time options'], size.name === 'tablet' ? [['Resume session', 'Time options']] : []);
        await page.screenshot({ path: `test-results/layout-screens/scene-band-paused-${size.width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (p2p-20; page 24, TF1 and TF1b, approved 2026-11-18 with the fix; Q3, F3 a): the fold mark is a plain
      // framed 52 px square, 8 px before the menu button, which is the band's last (on a phone at the heading's right); a tap folds away
      // the facts, the strip and the encounter tables' row and keeps the band whole (the heading, Next turn, the icon
      // buttons); a fact that needs the GM (here the dark Light) stays as one line in the band under the date; "Waiting
      // for you" never folds; a second tap brings the top back.
      test('the top folds', async ({ page }) => {
        await page.goto('/layout.html?as=gm&placePage=spot&session=running&waiting=4');
        await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
        const facts = page.getByRole('group', { name: 'Scene facts' });
        const strip = page.getByRole('group', { name: 'Sequence of play' });
        const tablesRow = page.locator('.encounter-row, .encounter-row__none');
        const waiting = page.getByRole('region', { name: 'Waiting for you' });
        await expect(facts).toBeVisible();
        await expect(strip).toBeVisible();
        await expect(tablesRow).toHaveCount(1);
        await expect(waiting).toBeVisible();
        const fold = page.getByRole('button', { name: 'Fold the top away' });
        await expect(fold).toHaveAttribute('aria-expanded', 'true');
        await expect(fold).not.toHaveClass(/button-primary/);
        await expect(accents(page)).toHaveCount(1);
        const band = page.locator('.scene-band');
        const [mark, menu, heading, whole] = await Promise.all([fold.boundingBox(), page.getByRole('button', { name: 'Time options' }).boundingBox(), band.getByRole('heading').boundingBox(), band.boundingBox()]);
        await page.screenshot({ path: `test-results/layout-screens/scene-band-fold-open-${size.width}-${scheme}.png` });
        expect([Math.round(mark!.width), Math.round(mark!.height)]).toEqual([BAND_CONTROL, BAND_CONTROL]);
        if (size.name === 'tablet') {
          // Q3 (F3 a): before the menu button, 8 px from it, one top (one height in a row, p2p-16); the menu is at the
          // band's far right.
          expect(Math.round(menu!.x - (mark!.x + mark!.width))).toBe(8);
          expect(Math.round(mark!.y)).toBe(Math.round(menu!.y));
          expect(Math.abs(menu!.x + menu!.width - (whole!.x + whole!.width))).toBeLessThan(2);
        } else {
          // At the band's far right.
          expect(Math.abs(mark!.x + mark!.width - (whole!.x + whole!.width))).toBeLessThan(2);
          // TF1b: at the heading's right, on its row, over the menu button's column.
          expect(mark!.y).toBeLessThan(heading!.y + heading!.height);
          expect(mark!.y + mark!.height).toBeGreaterThan(heading!.y);
          expect(heading!.x + heading!.width).toBeLessThanOrEqual(mark!.x + 1);
          expect(mark!.y + mark!.height).toBeLessThanOrEqual(menu!.y + 1);
        }

        await fold.click();
        const show = page.getByRole('button', { name: 'Show the top' });
        await expect(show).toHaveAttribute('aria-expanded', 'false');
        await expect(facts).toHaveCount(0);
        await expect(strip).toHaveCount(0);
        await expect(tablesRow).toHaveCount(0);
        // The band stays whole, and Waiting for you never folds.
        await expect(band.getByRole('heading', { name: /, turn 1$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next turn' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Quick actions' })).toBeVisible();
        await expect(waiting).toBeVisible();
        // The dark Light stays as one line in the band, with its warning sign, under the date (and over the icon buttons
        // on a phone).
        const due = band.locator('.scene-band__due-line');
        await expect(due).toHaveText(['No light']);
        await expect(due.locator('svg')).toHaveCount(1);
        const [line, date, tools, bandNow] = await Promise.all([due.boundingBox(), band.locator('.scene-band__date').boundingBox(), page.getByRole('group', { name: 'Quick actions' }).boundingBox(), band.boundingBox()]);
        expect(line!.y).toBeGreaterThanOrEqual(date!.y + date!.height - 1);
        expect(line!.y + line!.height).toBeLessThanOrEqual(bandNow!.y + bandNow!.height);
        if (size.name === 'phone') expect(tools!.y).toBeGreaterThanOrEqual(line!.y + line!.height - 1);
        expect(Math.round(line!.height)).toBeLessThan(2 * 24);
        await page.screenshot({ path: `test-results/layout-screens/scene-band-fold-folded-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);

        await show.click();
        await expect(facts).toBeVisible();
        await expect(strip).toBeVisible();
        await expect(tablesRow).toHaveCount(1);
        await expect(band.locator('.scene-band__due')).toHaveCount(0);
      });

      // Purpose (p2p-16; page 23 LA1, on S5's band): in town (Advance time, Depart, the menu button) and in downtime
      // (Next day, Depart, the menu button) every control of the band stands 52 px high, none grown by its label; on a
      // tablet the three sit side by side in one row, one height; on a phone the worded buttons wrap where they must,
      // and whichever sit side by side share one height.
      for (const quay of [
        { town: 'town', step: 'Advance time' },
        { town: 'downtime', step: 'Next day' },
      ] as const) {
        test(`one height in ${quay.town === 'town' ? 'town' : 'downtime'}`, async ({ page }) => {
          await openQuay(page, quay.town);
          const names = [quay.step, 'Depart', 'Time options'];
          await expectOneHeight(page, names, size.name === 'tablet' ? [names] : []);
        });
      }
    });
  }
}

// Purpose (mc-39b, changed by that ruling: "a fact's value never wraps", superseding T12's two lines; tv-1 as the lead
// corrected it, 2026-11-15): in a narrow tile a value stays on ONE line inside its tile. One that overruns at the large size drops one
// step (data-fit="smaller"); one that still overruns is cut with an ellipsis. The whole value stays in the tile's name.
// The tile is narrowed and the value's words set by the test (the harbour's own facts fit their tiles at these widths).
test.describe('a fact value in a narrow tile (1024 px)', () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test('keeps one line inside its tile: one step smaller, then cut', async ({ page }) => {
    await openScene(page, 'running');
    const tile = page.getByRole('group', { name: 'Scene facts' }).getByRole('button').first();
    await expect(tile).toBeVisible();
    // Each value is set with a new width, so the tile's resize measures it again (its fit lands a frame or two later).
    let width = 148;
    const measure = () =>
      tile.evaluate((el) => {
        const value = el.querySelector('.scene-fact__value-text') as HTMLElement;
        const style = getComputedStyle(value);
        const box = value.getBoundingClientRect();
        const tileBox = el.getBoundingClientRect();
        return {
          lines: Math.round(box.height / parseFloat(style.lineHeight)),
          inside: box.right <= tileBox.right + 0.5,
          smaller: value.dataset.fit === 'smaller',
          cut: value.scrollWidth > value.clientWidth + 1 && style.textOverflow === 'ellipsis',
          size: parseFloat(style.fontSize),
        };
      });
    const fit = async (words: string) => {
      width += 3;
      await tile.evaluate(
        (el, [text, px]) => {
          (el as HTMLElement).style.width = `${px}px`;
          (el.querySelector('.scene-fact__value-text') as HTMLElement).textContent = text as string;
        },
        [words, width] as const,
      );
    };
    await fit('Fair');
    await expect.poll(measure).toMatchObject({ lines: 1, inside: true, smaller: false, cut: false });
    await fit('Ash’s torch, half burnt');
    await expect.poll(measure).toMatchObject({ lines: 1, inside: true, smaller: true });
    expect((await measure()).size).toBeGreaterThanOrEqual(16);
    await fit('A grey, drowning rain that comes sideways off the lantern coast');
    await expect.poll(measure).toMatchObject({ lines: 1, inside: true, smaller: true, cut: true });
  });
});

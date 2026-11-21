// The full sheet revised (plan m5b-sheet-revised A; earlier: m5b-players-screens-standard D), in a real browser, on gate
// check 64's character (layout.html ?full=1: a level 3 Lantern Warden with six scores on the invented fixture pack).
// Purposes:
//   On a phone 375 px wide the six score tiles sit in two rows of three, each inside the sheet, and the sheet is one
//   column: the left column's name and tiles first, then the sections in the ruled order.
//   On a tablet in portrait (820 px) the sheet has two columns, side by side: who and how hurt on the left, the
//   sections on the right in the ruled order.
//   On a landscape tablet the play column and the sheet beside it share no section: Skills, Saves and Scores are the
//   right column's alone, Level and Details the left's (dec-13 C1, ps-2), there's no second sheet column, and the
//   right column's sections come in ps-2's order. Details is named as P1 draws it (dec-13 C4).
// Written without being run in this session (no browser there); CI's layout job runs it.
import { expect, test, type Page } from '@playwright/test';

async function openFullCharacter(page: Page) {
  await page.goto('/layout.html?as=player&full=1');
  await page.getByRole('button', { name: /The Fen Ledger/ }).click();
}

/** Opens the full sheet from the Player screen's menu (a phone's ≡, a tablet's ⋯). */
async function openSheetFromMenu(page: Page) {
  await openFullCharacter(page);
  if (page.viewportSize()!.width < 600) await page.locator('.top-row').getByRole('button', { name: 'Menu' }).click();
  else await page.getByRole('button', { name: 'Character options' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Level' })).toBeVisible();
}

/** The sections of the right column the ruled order names, in the order the page has them. */
const RULED = ['Level', 'Saves', 'Scores', 'Movement', 'Languages', 'Skills', 'Abilities', 'Traits', 'Magic', 'Details and backstory', 'Notes'];
const inRuledOrder = (names: string[]) => names.filter((n) => RULED.includes(n)).sort((a, b) => RULED.indexOf(a) - RULED.indexOf(b));

test('the six score tiles sit in two rows of three at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSheetFromMenu(page);
  const scores = page.getByRole('region', { name: 'Scores' });
  await expect(scores).toBeVisible();
  const boxes = await scores.locator('.score-row > .stat-tile').evaluateAll((tiles) => tiles.map((t) => t.getBoundingClientRect()).map((b) => ({ top: Math.round(b.top), left: b.left, right: b.right })));
  expect(boxes).toHaveLength(6);
  const rows = [...new Set(boxes.map((b) => b.top))];
  expect(rows).toHaveLength(2);
  for (const top of rows) expect(boxes.filter((b) => b.top === top)).toHaveLength(3);
  // Nothing past the screen's edge.
  for (const b of boxes) expect(b.right).toBeLessThanOrEqual(375);
});

test('on a phone the sheet is one column: the name and tiles, then the sections in the ruled order, top to bottom', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSheetFromMenu(page);
  await expect(page.locator('.sheet__columns--split')).toHaveCount(0);
  const vitals = (await page.locator('.sheet__vitals').boundingBox())!;
  const tops = await page.locator('.sheet__column > section[aria-label]').evaluateAll((sections) => sections.map((s) => ({ name: s.getAttribute('aria-label') ?? '', top: s.getBoundingClientRect().top + window.scrollY })));
  // The left column's content is above the first section, and the sections run down the page in the ruled order.
  expect(tops[0]!.top).toBeGreaterThan(vitals.y);
  expect(tops.map((t) => t.name)).toEqual(inRuledOrder(tops.map((t) => t.name)));
  for (let i = 1; i < tops.length; i++) expect(tops[i]!.top).toBeGreaterThan(tops[i - 1]!.top);
  // The removed blocks are not there.
  for (const gone of ['Combat', 'Advancement', 'Identity']) await expect(page.getByRole('region', { name: gone })).toHaveCount(0);
});

test('on a tablet in portrait the sheet has two columns side by side, the left holding the name and the tiles', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openSheetFromMenu(page);
  const columns = page.locator('.sheet__columns--split > .sheet__column');
  await expect(columns).toHaveCount(2);
  const [left, right] = [(await columns.nth(0).boundingBox())!, (await columns.nth(1).boundingBox())!];
  expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1);
  expect(left.y).toBeLessThanOrEqual(right.y + 1);
  await expect(columns.nth(0).getByRole('heading', { level: 1 })).toBeVisible();
  const names = await columns.nth(1).locator(':scope > section[aria-label]').evaluateAll((sections) => sections.map((s) => s.getAttribute('aria-label') ?? ''));
  expect(names).toEqual(inRuledOrder(names));
  expect(names).toEqual(expect.arrayContaining(['Level', 'Saves', 'Scores', 'Skills', 'Details and backstory', 'Notes']));
  // Nothing past the screen's edge.
  expect(left.x).toBeGreaterThanOrEqual(0);
  expect(right.x + right.width).toBeLessThanOrEqual(820);
});

test('on a landscape tablet the play column and the sheet beside it share no section', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openFullCharacter(page);
  // The sheet's rows beside, with no heading (tfr-4): Notes is the last.
  await expect(page.locator('.player__right').getByRole('button', { name: 'Notes' })).toBeVisible();
  // Wait for the sheet to load, as openSheetFromMenu does; without it the test read the sheet while still 'Opening…' (a race).
  await expect(page.getByRole('region', { name: 'Level' })).toBeVisible();
  const names = (selector: string) =>
    page.locator(selector).evaluate((root) =>
      [...root.querySelectorAll('section')]
        .map((s) => s.getAttribute('aria-label') ?? (s.getAttribute('aria-labelledby') ? document.getElementById(s.getAttribute('aria-labelledby')!)?.textContent?.trim() : null))
        .filter((n): n is string => !!n),
    );
  const play = await names('.player--wide > .player__pane');
  const sheet = await names('.player--wide > .player__aside');
  // The two columns (dec-13 C1, ps-2): the level block and Details are the left's, the scores, saves and skills the right's.
  expect(sheet).toEqual(expect.arrayContaining(['Scores', 'Saves', 'Skills']));
  // The play column's heading is "Details", as P1 draws it (C4); the full sheet's own page keeps "Details and backstory".
  expect(play).toEqual(expect.arrayContaining(['Level', 'Details']));
  expect(sheet).not.toContain('Details');
  expect(sheet).not.toContain('Details and backstory');
  expect(play).not.toContain('Skills');
  expect(play).not.toContain('Saves');
  expect(play).not.toContain('Scores');
  // "Traits" heads both: on the play column the traits with a Use, on the sheet the kindred's traits as rows (A+B kept
  // the play column's heading "Traits", its ⚑ 4).
  expect(play.filter((n) => sheet.includes(n) && n !== 'Traits')).toEqual([]);
  // Beside the Player screen the sheet is the right column only (the play column is the left): no second column, no
  // left column's name and tiles, and the sections in the ruled order.
  await expect(page.locator('.player__aside .sheet__vitals')).toHaveCount(0);
  await expect(page.locator('.player__aside .sheet__columns--split')).toHaveCount(0);
  // The right column's order (ps-2): scores, saves, movement and load, the traits with uses, skills, languages, then
  // the rest of the full sheet.
  const BESIDE = ['Scores', 'Saves', 'Movement', 'Traits', 'Skills', 'Languages', 'Abilities', 'Magic', 'Notes'];
  const order = sheet.filter((n, i) => BESIDE.includes(n) && sheet.indexOf(n) === i);
  expect(order).toEqual([...order].sort((a, b) => BESIDE.indexOf(a) - BESIDE.indexOf(b)));
});

/** Each row of tiles under `rows` (tiles sharing a top): each tile's height, its label's words and lines, and whether the label sits inside it. */
async function tileRows(page: Page, rows: string) {
  return page.locator(rows).evaluateAll((grids) =>
    grids.map((grid) => {
      const tiles = [...grid.querySelectorAll(':scope > .stat-tile')].map((t) => {
        const label = t.querySelector('.stat-tile__label')!;
        const box = t.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(label).lineHeight) || 20;
        // Each word's own boxes: a word broken inside itself has boxes on more than one line.
        const node = label.firstChild;
        const text = label.textContent ?? '';
        const broken: string[] = [];
        if (node && node.nodeType === Node.TEXT_NODE) {
          for (const m of text.matchAll(/\S+/g)) {
            const range = document.createRange();
            const at = m.index ?? 0;
            range.setStart(node, at);
            range.setEnd(node, at + m[0].length);
            const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top / 4)));
            if (tops.size > 1) broken.push(m[0]);
          }
        }
        return {
          top: Math.round(box.top),
          height: Math.round(box.height),
          text,
          labelLines: Math.round(label.getBoundingClientRect().height / lineHeight),
          broken,
          // Nothing of the label past its own box or its tile.
          inside: label.scrollWidth <= label.clientWidth + 1 && label.getBoundingClientRect().right <= box.right + 0.5,
        };
      });
      return [...new Set(tiles.map((t) => t.top))].map((top) => tiles.filter((t) => t.top === top));
    }),
  );
}

// Gate finding F8 (2026-11-10, Design's answers): Save tiles show the pack's short name (else the name's first word),
// Score tiles the full name; a label never breaks inside a word, the row taking fewer columns instead. Purposes:
//   At 375 px no label in a Score or Save row breaks inside a word or runs past its tile, a long label wraps between
//   words, and the tiles in a row keep one height, a Score tile with no modifier line included.
//   A word too wide for five saves across makes that row three and two; one too wide for three scores across makes
//   two columns.
//   On the real sheet the Score and Save tiles keep whole words and one height per row.
test('F8: at 375 px tile labels never break inside a word, rows re-flow instead and keep one height', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const rows of ['#players-standard .save-tiles', '#full-sheet-standard .score-row', '#molecules .save-tiles']) {
    const grids = await tileRows(page, rows);
    expect(grids.length).toBeGreaterThan(0);
    for (const row of grids.flat()) {
      expect(new Set(row.map((t) => t.height)).size, `${rows}: ${row.map((t) => `${t.text} ${t.height}`).join(', ')}`).toBe(1);
      for (const t of row) {
        expect(t.broken, `${t.text}: no word broken`).toEqual([]);
        expect(t.inside, `${t.text} inside its tile`).toBe(true);
      }
    }
    for (const t of grids.flat(2).filter((t) => t.text.length >= 20)) expect(t.labelLines, `${t.text} wraps`).toBeGreaterThan(1);
  }
  // The long save ("Breath of the drowned") makes its row three and two; the long score name makes two columns.
  const saveRows = await tileRows(page, '#players-standard .save-tiles');
  expect(saveRows.at(-1)!.map((row) => row.length)).toEqual([3, 2]);
  const scoreRows = await tileRows(page, '#full-sheet-standard .score-row');
  expect(scoreRows.at(-1)!.map((row) => row.length)).toEqual([2, 1]);
});

test('F8: on the sheet at 375 px the Score and Save tiles keep whole words and one height per row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSheetFromMenu(page);
  const rows = (await tileRows(page, '.score-row, .save-tiles')).flat();
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(new Set(row.map((t) => t.height)).size).toBe(1);
    for (const t of row) {
      expect(t.broken, `${t.text}: no word broken`).toEqual([]);
      expect(t.inside, `${t.text} inside its tile`).toBe(true);
    }
  }
});

// Purpose (review of #592): switching the text size to Larger while the page is open re-measures the rows (the row's
// width doesn't change, only the words do), so no word breaks or runs past its tile at the new size.
test('F8: switching to Larger text live re-flows the rows; no label runs past its tile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.gallery__controls').getByRole('button', { name: 'Larger', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale'))).toBe('1.25');
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  for (const rows of ['#players-standard .save-tiles', '#full-sheet-standard .score-row']) {
    for (const row of (await tileRows(page, rows)).flat()) {
      expect(new Set(row.map((t) => t.height)).size, `${rows}: one height`).toBe(1);
      for (const t of row) {
        expect(t.broken, `${t.text}: no word broken at Larger`).toEqual([]);
        expect(t.inside, `${t.text} inside its tile at Larger`).toBe(true);
      }
    }
  }
});

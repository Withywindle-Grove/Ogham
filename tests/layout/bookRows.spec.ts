// Creation's tapped tables keep their banding (dec-10 D and E; #780's review). Purpose: in a real browser, a table
// whose rows are its own children (the name table, a kindred's knacks) and one whose rows sit in cells beside their ⓘ
// (rolled spells) both band every second row in the book's band colour, and the rows between stay unbanded; a later
// rule once cleared the band on the first kind.
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fails.ts';

test.use({ viewport: { width: 375, height: 812 } });

test("every second row of a tapped table takes the book's band, whatever draws its rows", async ({ page }) => {
  await page.goto('/gallery.html?theme=light');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  const tables = await page.evaluate(() => {
    const band = (inside: Element) => {
      const probe = document.createElement('div');
      probe.style.background = 'var(--book-band)';
      inside.appendChild(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    };
    // The background a row shows: its own, or its cell's when it is see-through inside one.
    const shown = (child: Element) => {
      const row = child.matches('.option-row') ? child : child.querySelector('.option-row')!;
      const own = getComputedStyle(row).backgroundColor;
      return own === 'rgba(0, 0, 0, 0)' ? getComputedStyle(child).backgroundColor : own;
    };
    return [...document.querySelectorAll('#creation-who .table-sheet__rows, #tapped-tables .table-sheet__rows')].map((rows) => {
      const children = [...rows.children].filter((c) => !c.querySelector('[aria-checked="true"]') && !c.matches('[aria-checked="true"]'));
      const odd = children.filter((c) => [...rows.children].indexOf(c) % 2 === 0).map(shown);
      const even = children.filter((c) => [...rows.children].indexOf(c) % 2 === 1).map(shown);
      return { label: rows.getAttribute('aria-label'), band: band(rows), odd, even };
    });
  });
  expect(tables.map((t) => t.label)).toEqual(expect.arrayContaining(['Stone kin knacks', 'First whispers']));
  expect(tables.length).toBeGreaterThanOrEqual(3);
  for (const t of tables) {
    expect(t.even.length, `${t.label}: an unpicked even row`).toBeGreaterThan(0);
    for (const colour of t.even) expect(colour, `${t.label}: even rows banded`).toBe(t.band);
    for (const colour of t.odd) expect(colour, `${t.label}: odd rows unbanded`).not.toBe(t.band);
  }
});

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    // Purpose (the lead on #786): a tapped table's range column takes one width, its widest range, figures on one line,
    // so every result starts at the same place down the table ("1 to 2" and "11 to 12" alike), on a phone and a tablet.
    test("every result of a tapped table starts at the same x, and every range stays on one line", async ({ page }) => {
      await page.goto('/gallery.html?theme=light');
      await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const tables = await page.evaluate(() =>
        [...document.querySelectorAll('#creation-long-tables .table-sheet__long, #creation-long-tables .table-sheet__rows, #tapped-tables .table-sheet__rows, #creation-gear .book-tap-table .table-sheet__rows, #creation-gear .table-sheet__long')].map((rows) => {
          const bodies = [...rows.querySelectorAll('.option-row--compact')].map((row) => ({
            left: Math.round(row.querySelector('.option-row__body')!.getBoundingClientRect().left - row.getBoundingClientRect().left),
            // The range's own text lines (its box stretches with a two-line row, so its height says nothing).
            rangeLines: (() => {
              const text = document.createRange();
              text.selectNodeContents(row.querySelector('.option-row__range')!);
              return new Set([...text.getClientRects()].map((r) => Math.round(r.top))).size;
            })(),
            range: row.querySelector('.option-row__range')!.textContent,
          }));
          return { label: rows.getAttribute('aria-label') ?? rows.className, lefts: [...new Set(bodies.map((b) => b.left))], wrapped: bodies.filter((b) => b.rangeLines > 1).map((b) => b.range) };
        }),
      );
      expect(tables.length).toBeGreaterThanOrEqual(4);
      for (const t of tables) {
        expect(t.lefts, `${t.label}: results start at one x`).toHaveLength(1);
        expect(t.wrapped, `${t.label}: ranges on one line`).toEqual([]);
      }
    });
  });
}

// Gear's pick table in its sheet (cts-1, cts-3, cts-7; mockup creation/final 24, frames TS1, TS2 and TS4). Purposes:
//   At 375 px with 20 rows, Take these stays in view at the sheet's foot while the rows scroll under it, and the foot's
//   words keep to two lines.
//   The pick table's row on the step keeps what was taken to two lines, then "…", and Open or Change stays a 44 px tap.
//   On a tablet the sheet takes the screen's width (up to 1,024 px), its rows one column under 24.
//   Every row and the − square are 44 px taps, 8 px apart at least.
async function openPickSheet(page: Page) {
  await page.goto('/gallery.html?theme=light');
  await page.evaluate(() => document.fonts.ready);
  const open = page.getByRole('button', { name: 'Open the pick table' });
  await open.scrollIntoViewIfNeeded();
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Travelling odds: pick up to 4' });
  await expect(sheet).toBeVisible();
  return sheet;
}

const lineCount = (el: Locator) =>
  el.evaluate((node) => {
    const style = getComputedStyle(node);
    return Math.round(node.getBoundingClientRect().height / parseFloat(style.lineHeight));
  });

test.describe('the pick table on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Take these stays in view while 20 rows scroll; the foot keeps to two lines', async ({ page }) => {
    const sheet = await openPickSheet(page);
    const take = sheet.getByRole('button', { name: 'Take these' });
    await expect(take).toBeInViewport();
    // The rows are longer than the sheet: it scrolls, and the foot stays at its bottom.
    const scroll = await sheet.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    const before = (await take.boundingBox())!;
    await sheet.evaluate((el) => el.scrollBy(0, 600));
    const after = (await take.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    await expect(take).toBeInViewport();
    // The last row comes into view above the foot, never under it.
    await sheet.evaluate((el) => el.scrollBy(0, 10_000));
    const last = (await sheet.getByRole('checkbox', { name: /^20 / }).boundingBox())!;
    const foot = (await sheet.locator('.table-sheet__pick-foot').boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(foot.y + 1);
    // What is marked keeps to two lines; Take these sits at the right, inside the sheet.
    expect(await lineCount(sheet.locator('.table-sheet__pick-line'))).toBeLessThanOrEqual(2);
    const card = (await sheet.boundingBox())!;
    expect(after.x + after.width).toBeLessThanOrEqual(card.x + card.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test("every row and its − square are 44 px taps, 8 px apart", async ({ page }) => {
    const sheet = await openPickSheet(page);
    const rows = sheet.getByRole('checkbox');
    expect(await rows.count()).toBe(20);
    for (const box of await rows.evaluateAll((all) => all.map((r) => r.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    const less = sheet.getByRole('button', { name: /^Put back one 1: Reed rope$/ });
    const lessBox = (await less.boundingBox())!;
    const rowBox = (await sheet.getByRole('checkbox', { name: /^1 Reed rope/ }).boundingBox())!;
    expect(lessBox.width).toBeGreaterThanOrEqual(44);
    expect(lessBox.height).toBeGreaterThanOrEqual(44);
    expect(lessBox.x - (rowBox.x + rowBox.width)).toBeGreaterThanOrEqual(8 - 0.5);
  });

  test("the pick table's row keeps what was taken to two lines, its action a 44 px tap", async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    await page.evaluate(() => document.fonts.ready);
    const row = page.locator('#creation-gear').getByRole('button', { name: /^Change Travelling odds: pick up to 4 \(4 of 4 picked/ });
    await row.scrollIntoViewIfNeeded();
    expect(await lineCount(row.locator('.detail-row__note'))).toBeLessThanOrEqual(2);
    const action = (await row.locator('.detail-row__action').boundingBox())!;
    expect(action.height).toBeGreaterThanOrEqual(44);
    // The words are whole for a screen reader, even where the screen cuts them.
    expect(await row.getAttribute('aria-label')).toContain('Bone needles ×6');
  });
});

test.describe('the pick table on a tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("the sheet takes the screen's width, one column under 24 rows, Take these in view", async ({ page }) => {
    const sheet = await openPickSheet(page);
    const card = (await sheet.boundingBox())!;
    // Full width (cts-7): the screen's, less the page's gutters at most.
    expect(card.width).toBeGreaterThanOrEqual(1024 - 2 * 24);
    const lefts = await sheet.getByRole('checkbox').evaluateAll((all) => [...new Set(all.map((r) => Math.round(r.getBoundingClientRect().left)))]);
    expect(lefts).toHaveLength(1);
    await expect(sheet.getByRole('button', { name: 'Take these' })).toBeInViewport();
  });
});

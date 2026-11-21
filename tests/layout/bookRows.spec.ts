// Creation's tapped tables keep their banding (dec-10 D and E; #780's review). Purpose: in a real browser, a table
// whose rows are its own children (the name table, a kindred's knacks) and one whose rows sit in cells beside their ⓘ
// (rolled spells) both band every second row in the book's band colour, and the rows between stay unbanded; a later
// rule once cleared the band on the first kind.
import { expect, test } from '@playwright/test';

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
        [...document.querySelectorAll('#creation-long-tables .table-sheet__long, #creation-long-tables .table-sheet__rows, #tapped-tables .table-sheet__rows, #creation-gear .book-tap-table .table-sheet__rows')].map((rows) => {
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

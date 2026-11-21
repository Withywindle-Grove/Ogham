// The review's figures in the book's type at a phone's width (cs-40a, Francis 2026-11-13). Purpose: at 375 px, on the
// gallery's messy data (a long armour name, "unarmoured", "Nimbleness +0"), no line of a tile breaks inside a word, and
// a label stays on one line with its figure, now that the figures go two across under 600 px.
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

for (const theme of ['light', 'dark'] as const) {
  test(`review tiles at 375 px keep every word whole (${theme})`, async ({ page }) => {
    await page.goto(`/gallery.html?theme=${theme}`);
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate(() => {
      const broken: string[] = [];
      const together: Record<string, number> = {};
      const tiles = [...document.querySelectorAll('#creation-review .creation-review__tiles:not(.creation-review__tiles--saves) .stat-tile')];
      for (const tile of tiles) {
        const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? '';
          // A word drawn on two lines has two boxes (an ellipsis cut is one box, and allowed).
          for (const match of text.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
            if (lines.size > 1) broken.push(match[0]);
          }
          // A label and its figure ("Nimbleness +0") on one line.
          for (const phrase of ['Nimbleness +0', 'Nimbleness −3']) {
            const at = text.indexOf(phrase);
            if (at < 0) continue;
            const range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, at + phrase.length);
            together[phrase] = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
          }
        }
      }
      return { tiles: tiles.length, broken, together };
    });
    expect(found.tiles).toBeGreaterThan(0);
    expect(found.broken).toEqual([]);
    expect(found.together).toEqual({ 'Nimbleness +0': 1, 'Nimbleness −3': 1 });
  });
}

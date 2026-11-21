// The marching order's heading words (fix-marching-order-wrap; on the GM's Scene at 834 px "Marching order" broke in
// the middle of a word). In a real browser on the layout page's invented harbour with a party of five, as the GM.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';

// Purpose: on the GM's Scene the words "Marching order" wrap between words only, or not at all, at a phone (375 px),
// the tablet held upright (834 px) and the tablet held sideways (1024 px); never a word broken in the middle. It keeps
// a picture of the card at each width (test-results/layout-screens).
test('"Marching order" never breaks inside a word, at 375, 834 and 1024 px', async ({ page }) => {
  const problems: string[] = [];
  for (const width of [375, 834, 1024]) {
    await page.setViewportSize({ width, height: 1112 });
    await page.goto('/layout.html?as=gm&placePage=spot&session=running&party=five');
    await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
    await expect(page.getByRole('list', { name: 'Marching order, front to back' })).toBeVisible();
    // The book's faces loaded first: a fallback font wraps the words elsewhere.
    await page.evaluate(() => document.fonts.ready);
    await page.locator('section.marching').first().screenshot({ path: `test-results/layout-screens/marching-words-${width}.png` });
    const found = await page.evaluate(() => {
      const broken: string[] = [];
      let seen = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        const at = text.indexOf('Marching order');
        const el = node.parentElement;
        if (at < 0 || !el || el.closest('[hidden], [aria-hidden=true], .visually-hidden')) continue;
        // Each word on its own: its letters' boxes all sit on one line.
        for (const [from, to] of [[at, at + 8], [at + 9, at + 14]] as const) {
          const range = document.createRange();
          range.setStart(node, from);
          range.setEnd(node, to);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
          if (rects.length === 0) continue;
          seen += 1;
          const lines = new Set(rects.map((r) => Math.round(r.top / 4))).size;
          if (lines > 1) broken.push(`"${text.slice(from, to)}" in ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} over ${lines} lines`);
        }
      }
      // The card's heading must be there to check.
      if (seen === 0) broken.push('no "Marching order" on screen');
      return broken;
    });
    problems.push(...found.map((one) => `${width} px: ${one}`));
  }
  expect(problems).toEqual([]);
});

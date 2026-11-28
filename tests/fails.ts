// Playwright's `test`, with `test.fails` as another name for its `test.fail` (a test that must fail). On a fix- branch
// the failing test comes first, marked `.fails` (bq-6), and the guard (scripts/guard-tests.mjs) knows that mark by
// Vitest's name; this lets a layout check be written the same way, then the fix removes `.fails` alone.
// Its `page` also waits for the web fonts on every layout or gallery page it opens (`fontsAfterDrawing`), so the layout
// specs take `test` from here, never from '@playwright/test'.
import { test as base, type Page } from '@playwright/test';

/**
 * Waits until the page has drawn, then until every web font it declares has loaded (retro of loop 2, finding 4).
 * `document.fonts.ready` alone, straight after `goto`, resolves at once: React has drawn nothing yet, so no font has
 * been asked for; the fonts start at the first layout, and until they come the fallback font wraps text differently
 * (the map card's title moved its row 38 px). Loading every declared face, not only the ones drawn so far, also covers
 * a face first used after a tap. For a page opened outside the `page` fixture (a context of its own), call it by hand.
 */
export async function fontsAfterDrawing(page: Page): Promise<void> {
  await page.locator('#root > *').first().waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const loads: Promise<FontFace>[] = [];
    document.fonts.forEach((face) => loads.push(face.load()));
    await Promise.all(loads);
    await document.fonts.ready;
  });
}

const own = base.extend({
  // `provide` is Playwright's `use` (renamed: the React hooks lint takes `use` for a hook).
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      if (/\/(layout|gallery)\.html/.test(url)) await fontsAfterDrawing(page);
      return response;
    };
    await provide(page);
  },
});

export const test = Object.assign(own, { fails: own.fail });

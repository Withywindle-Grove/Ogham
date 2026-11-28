// The Player screen whole, for Francis's look before the dec-13 stack goes to main (rvw-14: pictures once per whole
// screen). It opens the shared P1-like character (layout.html?as=player&p1=1; src/testing/layoutP1Character.ts) and
// saves one full-page picture per size and scheme to test-results/layout-screens/player-whole-<name>.png. Purpose, in
// plain words: at a phone, an upright tablet and a landscape tablet, in light and dark, and once at Larger text, the
// screen opens with the character's name on it, and its whole page is kept as a picture. It checks nothing else: the
// rows' own specs check the parts.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { P1_CHARACTER } from '../../src/testing/layoutP1Character.ts';

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

// A full-page picture with every sticky and fixed part let go (the top row, the phone's tab bar), so each stands where
// the page puts it and none covers the page's middle (as townPage.spec.ts takes its pictures). On a tablet held sideways
// the left column also scrolls inside itself when taller than the screen (the plan keeps it so); the picture lets that
// go too, so the column is drawn to its foot (the level block and Details) and not cut at the screen's height.
async function letGo(page: Page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(el);
      if (['sticky', 'fixed'].includes(style.position)) {
        el.style.position = 'relative';
        el.style.inset = 'auto';
      }
      if (el.classList.contains('player__pane--play') && ['auto', 'scroll'].includes(style.overflowY)) {
        el.style.maxHeight = 'none';
        el.style.overflowY = 'visible';
      }
    }
  });
}

const SHOTS = [
  { name: '375-light', width: 375, height: 812, scheme: 'light', larger: false },
  { name: '375-dark', width: 375, height: 812, scheme: 'dark', larger: false },
  { name: '820-light', width: 820, height: 1180, scheme: 'light', larger: false },
  { name: '820-dark', width: 820, height: 1180, scheme: 'dark', larger: false },
  { name: '1180-light', width: 1180, height: 820, scheme: 'light', larger: false },
  { name: '1180-dark', width: 1180, height: 820, scheme: 'dark', larger: false },
  { name: '820-light-larger', width: 820, height: 1180, scheme: 'light', larger: true },
] as const;

for (const shot of SHOTS) {
  test.describe(`the Player screen whole (${shot.name})`, () => {
    test.use({ colorScheme: shot.scheme });

    // Purpose: the screen opens with the character's name, and the whole page is saved as a picture.
    test(`player-whole-${shot.name}`, async ({ page }) => {
      await page.setViewportSize({ width: shot.width, height: shot.height });
      if (shot.larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
      await openPlayer(page);
      await expect(page.getByText(P1_CHARACTER).first()).toBeVisible();
      await letGo(page);
      await page.screenshot({ path: `test-results/layout-screens/player-whole-${shot.name}.png`, fullPage: true });
    });
  });
}

// Purpose: on a tablet held sideways, the whole-screen picture shows the left column to its foot: the level block and
// Details, last in the left column (C1, C3, C4), lie inside the left column's drawn box, not cut off below it.
test('the sideways picture shows the left column whole, the level block and Details included', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openPlayer(page);
  await letGo(page);
  const pane = await page.locator('.player__pane--play').boundingBox();
  expect(pane).not.toBeNull();
  for (const name of ['Level', 'Details']) {
    const part = await page.getByRole('region', { name, exact: true }).boundingBox();
    expect(part, name).not.toBeNull();
    expect(part!.y + part!.height, name).toBeLessThanOrEqual(pane!.y + pane!.height + 1);
  }
});

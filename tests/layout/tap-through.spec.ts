// A tap outside a pop-up only closes it (fix-tap-through; players' feedback via Francis, 2026-11-24: "clicking out of a
// pop up doesn't open a new pop up unless pressed again"; 06 rule 12). On the shared P1-like character
// (layout.html?as=player&p1=1), in a real browser, on a phone (375 px) and a tablet held sideways (1180 px). Purposes,
// in plain words:
//   1. With the Hit points pop-up open, a tap on the dimmed page right over the portrait's button closes the pop-up and
//      does nothing else: the Portrait pop-up does not open. A second, separate tap there opens it. By touch (the
//      bug: the pop-up went on the finger's press and the same tap's click landed on the button beneath) and by mouse
//      (which already behaved, and must keep doing so).
//   2. A drag that starts inside the pop-up and ends on the dimmed page leaves it open.
import { expect, test, type Page } from '@playwright/test';

// Playwright spells an expected failure `test.fail(title, body)`; the fix-branch guard reads `.fails` (bq-6). So the
// touch tests go through `it`: `it.fails` is Playwright's expected failure, and `it` alone is a plain test.
type Body = (args: { page: Page }) => Promise<void>;
const it = Object.assign((title: string, body: Body) => test(title, body), { fails: (title: string, body: Body) => test.fail(title, body) });

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

// On a phone a sheet slides up from the bottom: wait until it has stopped before tapping beside it.
async function settled(page: Page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.dialog__backdrop')].every((b) => b.getAnimations({ subtree: true }).every((a) => a.playState !== 'running')));
}

async function openHitPoints(page: Page) {
  await page.getByRole('button', { name: /^Hit points 11 of 16\. Type a value$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Hit points' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await settled(page);
  return dialog;
}

/** The middle of the portrait's button, checked to be on the dimmed page (not under the pop-up's card). */
async function portraitSpot(page: Page) {
  const box = (await page.getByRole('button', { name: /^Add a portrait for Brannoch/ }).boundingBox())!;
  const spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('dialog__backdrop') ?? false, spot), 'the spot is on the dimmed page').toBe(true);
  return spot;
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  test.describe(`${size.name} (${size.width} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('by mouse, a tap outside the pop-up only closes it; a second tap opens what lies under it', async ({ page }) => {
      await openPlayer(page);
      await openHitPoints(page);
      const spot = await portraitSpot(page);
      await page.mouse.click(spot.x, spot.y);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // Give a stray click time to land and a pop-up time to open, then check none did.
      await page.waitForTimeout(300);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.mouse.click(spot.x, spot.y);
      await expect(page.getByRole('dialog', { name: 'Portrait' })).toBeVisible();
    });

    test('a drag that starts inside the pop-up and ends on the dimmed page leaves it open', async ({ page }) => {
      await openPlayer(page);
      const dialog = await openHitPoints(page);
      const spot = await portraitSpot(page);
      const title = (await dialog.locator('.dialog__title').boundingBox())!;
      await page.mouse.move(title.x + 4, title.y + title.height / 2);
      await page.mouse.down();
      await page.mouse.move(spot.x, spot.y, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Portrait' })).toHaveCount(0);
    });
  });

  test.describe(`${size.name} (${size.width} px), touch`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

    it.fails('by touch, a tap outside the pop-up only closes it; a second tap opens what lies under it', async ({ page }) => {
      await openPlayer(page);
      await openHitPoints(page);
      const spot = await portraitSpot(page);
      await page.touchscreen.tap(spot.x, spot.y);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.waitForTimeout(300);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.touchscreen.tap(spot.x, spot.y);
      await expect(page.getByRole('dialog', { name: 'Portrait' })).toBeVisible();
    });
  });
}

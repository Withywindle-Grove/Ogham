// Row C1 of plans/test-feedback-2026-11-19.md (tfn-1, tfn-2; mockup page M1, frames M1a to M1f, approved 2026-11-19
// with fixes): the Player tab's notices box and its sheet, in a real browser. Purposes, each a test below:
//   1. With "No light" standing (The Weary Causeway), nothing sits above the head: the two columns start level, the
//      box at the top of the right column glows, and the first row of score boxes starts level with the hit points
//      box when the character has scores (the P1 character, whose box stays quiet with nothing in it).
//   2. The box with nothing is quiet and with something lit, and the two stay apart with the hue taken away: the lit
//      box's edge is heavier and its words bold (never the glow alone).
//   3. The box opens the notices one at a time: "No light" with its light, the sheet on screen, inside 375 px.
//   4. The weather roll can be entered from the sheet: the box for the dice and Enter roll, the roll's notice then gone.
//   5. "Opening…" and the offline line are not in the box (the screen's own lines stay where they are).
//   6. A change waiting for the GM and a long level title (p1=bare): the head, its line and the box stay inside the
//      screen; the change is in the sheet. (A long name and nine statuses: player-c2.spec.ts's messy test.)
//   7. Two notices (p1=finish): "1 of 2", Next and Back; "To finish"'s step opens as a Sheet, its own form on the
//      Player tab before C1, over the Notices sheet, on screen and inside 375 px.
//   8. Turning a tablet moves the box (the right's top to under the head's line): an open Notices sheet stays open and
//      a half-typed weather roll stays typed.
//   Each at a 375 px phone and a 1180 px tablet where it says so, in light and dark, with the shared checks (no
//   sideways scroll, 44 px targets, nothing under 14 px, axe).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function open(page: Page, url: string, campaign: RegExp) {
  await page.goto(url);
  await page.getByRole('button', { name: campaign }).click();
  await expect(page.locator('.notices-box')).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

const boxOf = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

/** Every pop-up has finished coming up (a phone's sheet slides up from the bottom). */
const settled = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll('.dialog__backdrop')].every((b) => b.getAnimations({ subtree: true }).every((a) => a.playState !== 'running')));

/** The sheet sits inside the screen, its every part too. */
async function onScreen(page: Page, width: number, height: number) {
  await settled(page);
  const sheet = await boxOf(page, '[role="dialog"][aria-label="Notices"]');
  expect(sheet.x).toBeGreaterThanOrEqual(-0.5);
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(width + 0.5);
  expect(sheet.y).toBeGreaterThanOrEqual(-0.5);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(height + 0.5);
}

for (const scheme of SCHEMES) {
  test.describe(`the notices box (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test(`tablet: with "No light" the columns start level and the box at the right's top glows (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await open(page, '/layout.html?as=player', /The Weary Causeway/);
      const box = page.locator('.player__right .notices-box');
      await expect(box).toHaveClass(/notices-box--lit/);
      // Nothing above the head in the left column: the head and the box start level.
      const [head, notices] = [await boxOf(page, '.player-head'), (await box.boundingBox())!];
      expect(Math.abs(head.y - notices.y)).toBeLessThanOrEqual(1);
      await expect(page.locator('.player__pane--play .no-light')).toHaveCount(0);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '.player')).toEqual([]);
    });

    test(`tablet: the box over Scores, quiet with nothing; the first score boxes level with hit points (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await open(page, '/layout.html?as=player&p1=1', /The Storm Lantern Road/);
      const box = page.locator('.player__right .notices-box');
      await expect(box).toHaveText('No notices');
      await expect(box).not.toHaveClass(/notices-box--lit/);
      const notices = (await box.boundingBox())!;
      const scores = await boxOf(page, ".player__right .sheet__section[aria-label='Scores']");
      expect(notices.y + notices.height).toBeLessThanOrEqual(scores.y + 0.5);
      const hp = await boxOf(page, '.player__pane--play .hp-box');
      const score = await boxOf(page, '.player__right .score-row .stat-tile');
      expect(Math.abs(score.y - hp.y)).toBeLessThanOrEqual(1);
      // A tap with nothing opens "Nothing new." (never a dead button).
      await box.click();
      await expect(page.getByRole('dialog', { name: 'Notices' }).getByText('Nothing new.')).toBeVisible();
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
    });

    test(`lit and quiet stay apart with the hue taken away: a heavier edge and bold words (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      const look = async () =>
        page.locator('.notices-box').evaluate((el) => {
          const s = getComputedStyle(el);
          const patch = getComputedStyle(el.querySelector('.notices-box__patch')!);
          return { edge: parseFloat(s.borderTopWidth), weight: Number(s.fontWeight), glow: patch.boxShadow !== 'none' };
        });
      await open(page, '/layout.html?as=player&p1=1', /The Storm Lantern Road/);
      const quiet = await look();
      await open(page, '/layout.html?as=player&p1=bare', /The Storm Lantern Road/);
      const lit = await look();
      expect(quiet.glow).toBe(false);
      expect(lit.glow).toBe(true);
      expect(lit.edge).toBeGreaterThan(quiet.edge);
      expect(lit.weight).toBeGreaterThan(quiet.weight);
    });

    for (const size of SIZES) {
      test(`"No light" in the sheet with its light, the sheet on screen (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, '/layout.html?as=player', /The Weary Causeway/);
        await page.locator('.notices-box').click();
        const sheet = page.getByRole('dialog', { name: 'Notices' });
        await expect(sheet.getByText('No light', { exact: true })).toBeVisible();
        await onScreen(page, size.width, size.height);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
        await page.screenshot({ path: `test-results/c1/no-light-${size.name}-${scheme}.png` });
      });

      test(`the weather roll is entered from the sheet, and its notice goes (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, '/layout.html?as=player', /The Wet Road/);
        await page.screenshot({ path: `test-results/c1/tab-${size.name}-${scheme}.png` });
        await page.locator('.notices-box').click();
        const sheet = page.getByRole('dialog', { name: 'Notices' });
        const roll = sheet.getByLabel('Weather due: roll d6');
        await expect(roll).toBeVisible();
        await onScreen(page, size.width, size.height);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
        await page.screenshot({ path: `test-results/c1/weather-${size.name}-${scheme}.png` });
        await roll.fill('3');
        await sheet.getByRole('button', { name: 'Enter roll' }).click();
        await expect(page.getByLabel('Weather due: roll d6')).toHaveCount(0);
      });

      test(`a waiting change and a long title: the head and the box inside the screen (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, '/layout.html?as=player&p1=bare', /The Storm Lantern Road/);
        await expect(page.locator('.notices-box')).toHaveText('1 notice');
        for (const r of await page.locator('.player-head *, .notices-box').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) expect(r).toBeLessThanOrEqual(size.width);
        expect(await layoutProblems(page)).toEqual([]);
        await page.screenshot({ path: `test-results/c1/head-${size.name}-${scheme}.png` });
        await page.locator('.notices-box').click();
        await expect(page.getByRole('dialog', { name: 'Notices' }).getByText('Waiting for your GM: Muscle 15 → 16')).toBeVisible();
        await onScreen(page, size.width, size.height);
        await page.screenshot({ path: `test-results/c1/waiting-${size.name}-${scheme}.png` });
      });
    }

    for (const size of SIZES) {
      test(`two notices, Next and Back; "To finish"'s step opens as a Sheet over the Notices sheet, on screen (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, '/layout.html?as=player&p1=finish', /The Storm Lantern Road/);
        await expect(page.locator('.notices-box')).toHaveText('2 notices');
        await page.locator('.notices-box').click();
        const sheet = page.getByRole('dialog', { name: 'Notices' });
        await expect(sheet.getByText('1 of 2')).toBeVisible();
        await expect(sheet.getByText('Waiting for your GM: Muscle 15 → 16')).toBeVisible();
        await sheet.getByRole('button', { name: 'Next' }).click();
        await expect(sheet.getByText('2 of 2')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Next' })).toHaveCount(0);
        await expect(sheet.getByRole('button', { name: 'Back' })).toBeVisible();
        await onScreen(page, size.width, size.height);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
        await page.screenshot({ path: `test-results/c1/finish-${size.name}-${scheme}.png` });
        // The step keeps its own form, a Sheet, as on the Player tab before (no centred card), over the Notices sheet.
        await sheet.getByRole('region', { name: 'To finish' }).getByRole('button', { name: /Languages/ }).click();
        const step = page.getByRole('dialog', { name: 'Languages' });
        await expect(step).toBeVisible();
        await expect(step).toHaveClass(/dialog--sheet/);
        await expect(page.getByRole('dialog', { name: 'Notices' })).toBeVisible();
        await settled(page);
        const box = (await step.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
        expect(box.y).toBeGreaterThanOrEqual(-0.5);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height + 0.5);
        await page.screenshot({ path: `test-results/c1/finish-step-${size.name}-${scheme}.png` });
      });
    }

    test(`"Opening…" and the offline line are never in the box (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[0].width, height: SIZES[0].height });
      await open(page, '/layout.html?as=player&p1=messy', /The Storm Lantern Road/);
      await page.locator('.notices-box').click();
      const sheet = page.getByRole('dialog', { name: 'Notices' });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('Opening…')).toHaveCount(0);
      await expect(sheet.getByText(/offline/)).toHaveCount(0);
    });
  });
}

test('turning a tablet keeps the Notices sheet open and the typed weather roll', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await open(page, '/layout.html?as=player', /The Wet Road/);
  await expect(page.locator('.player__right .notices-box')).toBeVisible();
  await page.locator('.notices-box').click();
  await page.getByRole('dialog', { name: 'Notices' }).getByLabel('Weather due: roll d6').fill('4');
  // Upright: one column, the box under the head's line.
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.locator('.player-head .notices-box')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Notices' }).getByLabel('Weather due: roll d6')).toHaveValue('4');
  // And back again.
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(page.locator('.player__right .notices-box')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Notices' }).getByLabel('Weather due: roll d6')).toHaveValue('4');
});

// The Scene in the GM's view as the player (page 32, M3i, approved 2026-11-21; row C15f of
// plans/test-feedback-2026-11-19.md), and the player-only pop-ups that open from inside a sheet (C15d's, owed here by
// the review of #36), in a real browser on a phone (375 px) and a tablet held sideways (1180 px), in light and dark.
// Purposes, in plain words:
//   1. Scene on Wren in the view (layout.html?as=gm&placePage=spot&ways=1&activities=1&viewScene=1) is the players'
//      Scene: no title in the top row on a tablet, the band saying whose it is, the jetty's card with "Where to?" and
//      its ways, Activities, the marching order, and Sam’s waiting request in the prompt slot; no Recently log lines
//      (⚑ 52, ruled 2026-11-24). No sideways scrolling,
//      no text under 14 px, no small targets, no serious accessibility problem.
//   2. The request's Cancel opens "Only Sam can take back this request": the sheet from the foot on a phone, centred on
//      a tablet, "Go to Waiting for you" then "Got it", both plain and 44 px high, 8 px apart.
//   3. A secret activity's sheet in the view (layout.html?as=gm&viewPopUps=activity): its "Who acts?" chips are the
//      player's (Sam's two, never the GM's own Ash) and lay out cleanly, and Ask the GM opens "Only Sam can send this request" in its own form over the sheet (a pop-up opened
//      from inside a sheet keeps its own form: CLAUDE.md), whole on screen.
//   4. A town's Where you stay in the view (layout.html?as=gm&viewPopUps=stay): Stay here opens "Only Sam can choose
//      where … stays" in its own form over the stay sheet, whole on screen.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const WREN = 'Wren of the Lantern Wardens';

async function setUp(page: Page, width: number, height: number, scheme: 'light' | 'dark', url: string) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await page.goto(url);
}

async function openScene(page: Page, width: number, height: number, scheme: 'light' | 'dark') {
  await setUp(page, width, height, scheme, '/layout.html?as=gm&placePage=spot&ways=1&activities=1&viewScene=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await page.getByRole('button', { name: `Open ${WREN}’ scene` }).click();
  await expect(page.getByRole('note')).toHaveAttribute('aria-label', /^Sam’s view of /);
  await expect(page.getByRole('article', { name: 'Sent to the GM' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** The read-only pop-up's form: the sheet from the foot on a phone, centred on a tablet; its foot's buttons. */
async function checkReadingPopUp(pop: Locator, width: number, foot: string[]) {
  await expect(pop).toBeVisible();
  await pop.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = await pop.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight };
  });
  expect(box.top).toBeGreaterThanOrEqual(0);
  if (width < 600) {
    expect(Math.abs(box.bottom - box.h)).toBeLessThanOrEqual(1);
    expect(box.right - box.left).toBeGreaterThanOrEqual(box.w - 1);
  } else {
    expect(Math.abs((box.left + box.right) / 2 - box.w / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs((box.top + box.bottom) / 2 - box.h / 2)).toBeLessThanOrEqual(1);
  }
  const buttons = pop.locator('.dialog__got-it button');
  await expect(buttons).toHaveText(foot);
  const rects = await buttons.evaluateAll((els) => els.map((el) => ({ ...el.getBoundingClientRect().toJSON(), cls: el.className })));
  for (const b of rects) {
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.cls).toContain('button-secondary');
  }
  if (rects.length === 2) expect(rects[1]!.left - rects[0]!.right).toBeGreaterThanOrEqual(8);
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the Scene in the view (${size.name}, ${scheme})`, async ({ page }) => {
      await openScene(page, size.width, size.height, scheme);
      // The jetty's card with its ways, and Activities: the player's page, not the GM's place page.
      await expect(page.getByRole('heading', { name: 'Where to?' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Activities' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
      // No Recently log lines in the view of Sam's Scene (⚑ 52, ruled 2026-11-24).
      await expect(page.getByRole('region', { name: 'Recently' })).toHaveCount(0);
      // No title in the top row on a tablet: the band says whose Scene it is (M3i).
      if (size.width >= 600) await expect(page.locator('.top-row__title:not(:empty)')).toHaveCount(0);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-scene-${size.width}-${scheme}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`Cancel on Sam's request in the view (${size.name}, ${scheme})`, async ({ page }) => {
      await openScene(page, size.width, size.height, scheme);
      await page.getByRole('article', { name: 'Sent to the GM' }).getByRole('button', { name: 'Cancel' }).click();
      const pop = page.getByRole('dialog', { name: 'Only Sam can take back this request' });
      await checkReadingPopUp(pop, size.width, ['Go to Waiting for you', 'Got it']);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-scene-cancel-${size.width}-${scheme}.png`, fullPage: false });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`a secret activity's sheet and its Ask the GM in the view (${size.name}, ${scheme})`, async ({ page }) => {
      await setUp(page, size.width, size.height, scheme, '/layout.html?as=gm&viewPopUps=activity');
      await page.getByRole('button', { name: /^Sing low, / }).click();
      const sheet = page.getByRole('dialog', { name: 'Sing low' });
      const who = sheet.getByRole('group', { name: "Who's acting" });
      await expect(who.getByRole('button')).toHaveText(['✓ Wren of the Lantern Wardens', 'Bree the Lantern Bearer of the Lower Sluices']);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-who-acts-${size.width}-${scheme}.png`, fullPage: false });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await sheet.getByRole('button', { name: 'Ask the GM' }).click();
      const pop = page.getByRole('dialog', { name: 'Only Sam can send this request' });
      await checkReadingPopUp(pop, size.width, ['Go to Waiting for you', 'Got it']);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-ask-gm-${size.width}-${scheme}.png`, fullPage: false });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    test(`Stay here in the view (${size.name}, ${scheme})`, async ({ page }) => {
      await setUp(page, size.width, size.height, scheme, '/layout.html?as=gm&viewPopUps=stay');
      await page.getByRole('button', { name: 'Where you stay' }).click();
      const sheet = page.getByRole('dialog', { name: 'Where you stay' });
      await sheet.getByRole('radio', { name: /The Lantern Rest/ }).click();
      await sheet.getByRole('button', { name: 'Stay here' }).click();
      const pop = page.getByRole('dialog', { name: `Only Sam can choose where ${WREN} stays` });
      await checkReadingPopUp(pop, size.width, ['Got it']);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `test-results/layout-screens/gm-view-stay-${size.width}-${scheme}.png`, fullPage: false });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
}

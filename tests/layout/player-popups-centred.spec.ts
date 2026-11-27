// The Player tab's pop-ups on a tablet, centred and fitted to their content (row fb-7 of
// docs/plans/dec-player-popups-centred.md; rulings fb7-1 to fb7-6, 2026-11-20; page 31, frames FB7b to FB7h, approved
// 2026-11-20), on the shared stand-in character (layout.html?as=player&p1=1), in WebKit. Purposes, in plain words:
//   1. On a tablet held sideways, a pop-up opened from the left column, from the right column, from a row's words, from
//      its chevron and from the keyboard has its middle at the screen's middle, across and down (± 1 px).
//   2. A pop-up opened from inside another on the tab is centred too.
//   3. A pop-up that holds little is 440 px wide; one with a long line is 720 px and its lines wrap; one in between is
//      as wide as its longest line; none is under 440 or over 720, but Hit points, which is no wider than its content
//      (under 440) and centred; Max hit points too.
//   4. A pop-up's width does not change when a row in it is tapped (a trait's use, a thing At hand's Give to…, an
//      ability opened from the Abilities list); Notes opens at 720 px, empty, and keeps that width
//      when a long note is added (the scope check of 2026-11-20, Francis: "B").
//   5. At 1024 × 768 and on a tablet held upright (820 × 1180) a pop-up is centred and keeps the screen's margins.
//   6. On a phone (375 px) the sheet is at the bottom, the screen's width, as before.
//   7. On a screen outside the tab's scope (the Pack tab) a Sheet is still placed beside the button that opened it.
//   8. In dark mode a pop-up is centred and fitted the same way.
//   9. The players' travel pop-up on the Scene (sf-15; page 44, PU1): centred on a tablet, a sheet from the foot on a
//      phone (sf-28); a long name wraps, 999 turns fits, "Got it" is plain; light and dark.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openPlayer(page: Page, width: number, height: number, p1 = '1') {
  await page.setViewportSize({ width, height });
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** The pop-up's box, and the screen's size. */
async function boxOf(dialog: Locator) {
  await expect(dialog).toBeVisible();
  // The phone's sheet slides up (200 ms): measured once it has come to rest.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, screenWidth: window.innerWidth, screenHeight: window.innerHeight };
  });
}

async function expectCentred(dialog: Locator, what: string) {
  const b = await boxOf(dialog);
  expect(Math.abs((b.left + b.right) / 2 - b.screenWidth / 2), `${what}: its middle across`).toBeLessThanOrEqual(1);
  expect(Math.abs((b.top + b.bottom) / 2 - b.screenHeight / 2), `${what}: its middle down`).toBeLessThanOrEqual(1);
  await expect(dialog, `${what}: never placed beside its button`).not.toHaveClass(/dialog--anchored/);
  return b;
}

const skillRow = (page: Page) => page.getByRole('region', { name: 'Skills' }).locator('.list-row').filter({ hasText: /^Hark/ });

test.describe('on a tablet held sideways (1180 × 820)', () => {
  test.beforeEach(async ({ page }) => {
    await openPlayer(page, 1180, 820);
  });

  test("a pop-up from the left column, the right column, a row's words, its chevron and the keyboard is centred", async ({ page }) => {
    // The left column: a status ring.
    await page.getByRole('button', { name: /^Chilled, .*Details$/ }).first().click();
    await expectCentred(page.getByRole('dialog', { name: 'Chilled' }), 'a status, from the left column');
    await page.keyboard.press('Escape');

    // The right column: a skill row, by its words.
    const row = skillRow(page);
    await row.scrollIntoViewIfNeeded();
    await row.locator('.list-row__title').click();
    await expectCentred(page.getByRole('dialog', { name: 'Hark' }), "a skill, by its row's words");
    await page.keyboard.press('Escape');

    // The same row, by its chevron.
    await row.locator('.list-row__chevron').click();
    await expectCentred(page.getByRole('dialog', { name: 'Hark' }), 'a skill, by its chevron');
    await page.keyboard.press('Escape');

    // From the keyboard, after a tap elsewhere on the page (the last tap used to win over the focus).
    await page.getByRole('region', { name: 'Vitals' }).click({ position: { x: 4, y: 4 } });
    await row.locator('.list-row__body').focus();
    await page.keyboard.press('Enter');
    await expectCentred(page.getByRole('dialog', { name: 'Hark' }), 'a skill, from the keyboard');
  });

  test('a pop-up opened from inside another is centred too', async ({ page }) => {
    const list = page.locator('.player__right .list-row').filter({ hasText: /^(Abilities|Traits)/ }).first();
    await list.scrollIntoViewIfNeeded();
    const name = (await list.locator('.list-row__title').textContent())!.trim();
    await list.click();
    const first = page.getByRole('dialog', { name });
    await expectCentred(first, `the ${name} list`);
    await first.locator('button.list-row__body, .list-row__body').first().click();
    await expect(page.getByRole('dialog')).toHaveCount(2);
    await expectCentred(page.getByRole('dialog').last(), `an entry opened from the ${name} list`);
  });

  test('a pop-up that holds little is 440 px; Hit points keeps its own width under 440, centred', async ({ page }) => {
    await page.getByRole('button', { name: /^Chilled, .*Details$/ }).first().click();
    const status = await expectCentred(page.getByRole('dialog', { name: 'Chilled' }), 'a status');
    expect(status.width, 'a status, little in it: 440').toBeCloseTo(440, 0);
    await page.screenshot({ path: 'test-results/layout-screens/fb7-status-1180.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Hit points 11 of 16\. Type a value$/ }).click();
    const hp = await expectCentred(page.getByRole('dialog', { name: 'Hit points' }), 'Hit points');
    expect(hp.width, 'Hit points no wider than its content').toBeLessThan(440);
    await page.screenshot({ path: 'test-results/layout-screens/fb7-hit-points-1180.png' });
  });

  test("a pop-up's width does not change when a row in it is tapped", async ({ page }) => {
    // A trait with uses: its use mark tapped changes what it says, not its width.
    await page.getByRole('button', { name: /^Steady flame/ }).first().click();
    const trait = page.getByRole('dialog', { name: 'Steady flame' });
    const before = await boxOf(trait);
    await trait.getByRole('button', { name: /^Use|●/ }).first().click();
    const after = await boxOf(trait);
    expect(after.width, 'the trait, a use tapped').toBeCloseTo(before.width, 0);
    expect(after.left).toBeCloseTo(before.left, 0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The weapon in hand, a thing At hand: Give to… opened over it and closed again leaves it as wide as it was.
    await page.getByRole('button', { name: /^Reed spear/ }).first().click();
    const spear = page.getByRole('dialog', { name: 'Reed spear' });
    const spearBefore = await expectCentred(spear, 'a thing At hand');
    await spear.getByRole('button', { name: /^Give to/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    const spearAfter = await boxOf(spear);
    expect(spearAfter.width, 'a thing At hand, Give to… tapped').toBeCloseTo(spearBefore.width, 0);
    expect(spearAfter.left).toBeCloseTo(spearBefore.left, 0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The Abilities list: an ability tapped in it opens over it, centred; closed with Got it, the list keeps its width.
    // (The stand-in's abilities carry no uses and no Pin star yet, row P4; a use is checked on the trait above.)
    const abilities = page.locator('.player__right .list-row').filter({ hasText: /^Abilities/ }).first();
    await abilities.scrollIntoViewIfNeeded();
    await abilities.click();
    const list = page.getByRole('dialog', { name: 'Abilities' });
    const listBefore = await expectCentred(list, 'the Abilities list');
    await list.locator('.list-row__body').first().click();
    await expect(page.getByRole('dialog')).toHaveCount(2);
    const entry = page.getByRole('dialog').last();
    await expectCentred(entry, 'an ability, from the list');
    await entry.getByRole('button', { name: 'Got it' }).click();
    while ((await page.getByRole('dialog').count()) > 1) await page.keyboard.press('Escape');
    const listAfter = await boxOf(list);
    expect(listAfter.width, 'the Abilities list, an ability opened and closed').toBeCloseTo(listBefore.width, 0);
    expect(listAfter.left).toBeCloseTo(listBefore.left, 0);
  });

  test('Notes opens at 720 px when empty, and keeps that width when a long note is added', async ({ page }) => {
    // The scope check of 2026-11-20 (Francis: "B"): Notes always takes the most, so adding a note never widens it.
    const notesRow = page.locator('.player__right .list-row').filter({ hasText: /^Notes/ }).first();
    await notesRow.scrollIntoViewIfNeeded();
    await notesRow.click();
    const notes = page.getByRole('dialog', { name: 'Notes' });
    const empty = await expectCentred(notes, 'Notes, empty');
    expect(empty.width, 'Notes, empty: 720').toBeCloseTo(720, 0);
    await notes.locator('textarea').first().fill('The lantern goes out if it is carried over running water: ask before the ford, and again before the weir.');
    await notes.getByRole('button', { name: 'Add' }).click();
    await expect(notes.locator('.sheet__note')).toHaveCount(1);
    const added = await expectCentred(notes, 'Notes, a long note added');
    expect(added.width, 'Notes, a long note added: still 720').toBeCloseTo(720, 0);
    await page.screenshot({ path: 'test-results/layout-screens/fb7-notes-1180.png' });
  });
});

test.describe('fit to content, on characters with longer words (1180 × 820)', () => {
  test('a pop-up with a long name takes the most, 720 px, and its name wraps', async ({ page }) => {
    await openPlayer(page, 1180, 820, 'modes');
    await page.getByRole('button', { name: /^Hand axe of the Seven Cairns/ }).first().click();
    const axe = page.getByRole('dialog').last();
    const a = await expectCentred(axe, 'a weapon with a long name');
    expect(a.width, 'the most: 720').toBeCloseTo(720, 0);
    const title = await axe.locator('.dialog__title').evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    expect(title, 'its long name wraps at 720').toBeGreaterThan(1.5);
    await page.screenshot({ path: 'test-results/layout-screens/fb7-long-name-1180.png' });
  });

  test('a longer skill is between 440 and 720 px, as wide as its longest line', async ({ page }) => {
    await openPlayer(page, 1180, 820, 'skills');
    const forage = page.getByRole('button', { name: /^Forage .*: where it comes from$/ }).first();
    await forage.scrollIntoViewIfNeeded();
    await forage.click();
    const skill = await expectCentred(page.getByRole('dialog', { name: 'Forage' }), 'a skill');
    expect(skill.width, 'more than the least').toBeGreaterThan(440);
    expect(skill.width, 'less than the most').toBeLessThan(720);
    // As wide as its longest line: the widest thing in it, at its own width, fills the card's content box.
    const fit = await page.getByRole('dialog', { name: 'Forage' }).evaluate((card) => {
      const cs = getComputedStyle(card);
      const inner = card.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const widest = Math.max(
        ...[...card.children].map((c) => {
          const clone = c.cloneNode(true) as HTMLElement;
          clone.style.cssText = 'position:absolute;inline-size:max-content;visibility:hidden';
          card.appendChild(clone);
          const w = clone.getBoundingClientRect().width;
          clone.remove();
          return w;
        }),
      );
      return { inner, widest };
    });
    expect(Math.abs(fit.inner - fit.widest), `the card's inside ${fit.inner}, its longest line ${fit.widest}`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/layout-screens/fb7-skill-between-1180.png' });
  });
});

for (const size of [
  { name: 'a 1024 px tablet', width: 1024, height: 768 },
  { name: 'a tablet held upright', width: 820, height: 1180 },
] as const) {
  test(`on ${size.name} a pop-up is centred and keeps the screen's margins`, async ({ page }) => {
    await openPlayer(page, size.width, size.height);
    const row = skillRow(page);
    await row.scrollIntoViewIfNeeded();
    await row.locator('.list-row__chevron').click();
    const b = await expectCentred(page.getByRole('dialog', { name: 'Hark' }), 'a skill');
    expect(b.left, 'the left margin').toBeGreaterThanOrEqual(16 - 0.5);
    expect(b.right, 'the right margin').toBeLessThanOrEqual(size.width - 16 + 0.5);
    expect(b.width).toBeGreaterThanOrEqual(440 - 0.5);
    expect(b.width).toBeLessThanOrEqual(720 + 0.5);
    await page.screenshot({ path: `test-results/layout-screens/fb7-skill-${size.width}.png` });
  });
}

test('on a phone the sheet is at the bottom, the screen\'s width, as before', async ({ page }) => {
  await openPlayer(page, 375, 812);
  const row = skillRow(page);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const dialog = page.getByRole('dialog', { name: 'Hark' });
  const b = await boxOf(dialog);
  expect(b.left).toBeCloseTo(0, 0);
  expect(b.width).toBeCloseTo(375, 0);
  expect(b.bottom).toBeCloseTo(812, 0);
  await page.screenshot({ path: 'test-results/layout-screens/fb7-skill-375.png' });
});

test('outside the tab (the Pack tab) a Sheet is still placed beside its button', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto('/layout.html?as=player');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await page.getByRole('button', { name: /Quilted coat/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Quilted coat' });
  await expect(dialog).toHaveClass(/dialog--anchored/);
  await expect(dialog).not.toHaveClass(/dialog--centred/);
});

test('in dark mode a pop-up is centred and fitted the same way', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPlayer(page, 1180, 820, 'skills');
  const forage = page.getByRole('button', { name: /^Forage .*: where it comes from$/ }).first();
  await forage.scrollIntoViewIfNeeded();
  await forage.click();
  const b = await expectCentred(page.getByRole('dialog', { name: 'Forage' }), 'a skill, dark');
  expect(b.width).toBeGreaterThan(440);
  expect(b.width).toBeLessThan(720);
  await page.screenshot({ path: 'test-results/layout-screens/fb7-skill-between-1180-dark.png' });
});

// A fresh page of its own: the stand-in with no most hit points recorded, so the vitals offer "Set max".
test('Max hit points (no most recorded) keeps its own width under 440, centred', async ({ page }) => {
  await openPlayer(page, 1180, 820, '1&maxhp=none');
  await page.getByRole('button', { name: 'Set max' }).click();
  const max = await expectCentred(page.getByRole('dialog', { name: 'Max hit points' }), 'Max hit points');
  expect(max.width, 'Max hit points no wider than its content').toBeLessThan(440);
  await page.screenshot({ path: 'test-results/layout-screens/fb7-max-hit-points-1180.png' });
});

// The players' travel pop-up on the Scene (sf-15; page 44, PU1 B, C and E; sf-28), on the layout page's invented
// harbour with messy data (&ways=messy): a long far end's name and a way of 999 turns.
async function openWays(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=player&placePage=spot&session=running&ways=messy');
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const LONG_PLACE = '4. The water stair under the customs house, by the tarred door';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the players' travel pop-up (${scheme})`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' });

    // Purpose (sf-15, PU1 B and C): on a tablet a tap on a way opens its pop-up in the middle of the screen, titled with
    // the way and the place; a long name wraps inside it, "Takes" stands before 999 turns, and "Got it" sits at the
    // foot's right, plain, and closes it.
    test('on a tablet: centred, a long name wraps, 999 turns fits, a plain Got it', async ({ page }) => {
      await openWays(page, 1180, 820);
      await page.getByRole('button', { name: `Climbing, 999 turns, to ${LONG_PLACE}` }).click();
      const dialog = page.getByRole('dialog', { name: `Climbing to ${LONG_PLACE}` });
      const b = await expectCentred(dialog, 'the travel pop-up');
      const title = await dialog.locator('.dialog__title').boundingBox();
      expect(title!.x + title!.width, 'the title inside the card').toBeLessThanOrEqual(b.right + 0.5);
      const lineHeight = await dialog.locator('.dialog__title').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      expect(title!.height, 'the long title wraps').toBeGreaterThan(lineHeight * 1.5);
      await expect(dialog.locator('.move-summary dt')).toHaveText('Takes');
      await expect(dialog.locator('.move-summary dd')).toHaveText('999 turns.');
      const takes = await dialog.locator('.move-summary dd').boundingBox();
      expect(takes!.x + takes!.width).toBeLessThanOrEqual(b.right + 0.5);
      const gotIt = dialog.getByRole('button', { name: 'Got it' });
      await expect(gotIt).toHaveClass(/button-secondary/);
      const g = (await gotIt.boundingBox())!;
      expect(g.height).toBeGreaterThanOrEqual(44);
      expect(b.right - (g.x + g.width), 'Got it at the right').toBeLessThan(40);
      await page.screenshot({ path: `test-results/layout-screens/players-travel-1180-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await gotIt.click();
      await expect(dialog).toHaveCount(0);
    });

    // Purpose (sf-15, PU1 E; sf-28): on a phone the same pop-up is a sheet from the foot, the screen's width, its long
    // title wrapping inside it, and nothing scrolls sideways.
    test('on a phone: a sheet from the foot', async ({ page }) => {
      await openWays(page, 375, 812);
      const button = page.getByRole('button', { name: `Climbing, 999 turns, to ${LONG_PLACE}` });
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const dialog = page.getByRole('dialog', { name: `Climbing to ${LONG_PLACE}` });
      const b = await boxOf(dialog);
      expect(b.left).toBeCloseTo(0, 0);
      expect(b.width).toBeCloseTo(375, 0);
      expect(b.bottom).toBeCloseTo(812, 0);
      const title = await dialog.locator('.dialog__title').boundingBox();
      expect(title!.x + title!.width).toBeLessThanOrEqual(375);
      await page.screenshot({ path: `test-results/layout-screens/players-travel-375-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  });
}

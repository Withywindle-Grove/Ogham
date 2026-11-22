// The Player screen brought to frame P1 (Francis's approval of 19 Nov 2026 with its fixes; `dec13-fix-p1-departures`), on
// the shared P1-like character (layout.html?as=player&p1=1). Purposes, in plain words:
//   1. On a tablet held sideways the menu starts folded to icons (mn-1); opened, it shows its three sections in words,
//      "Player", "Scene", "Pack", as P1 draws them.
//   2. The tiles' labels are plain case (no small capitals), and the hit points box keeps its small-capitals label.
//   3. The pinned knife's rolls with their die glyphs, the trait's pips and the Movement card fit a 375 px phone with no
//      sideways scroll and nothing under 14 px, in light and dark.
// The two fixes of the same approval (`dec-13-p1-fixes`):
//   4. Every row's name on the Player screen is in the book's bold (the bold token's weight), as P1 draws "Shortbow",
//      "Second wind", "Listen", "Fighter, level 2", "Weapon skills": At hand's items and its lit light, the traits, the
//      skills, the level line and the sheet's rows after Skills, on a tablet held sideways and on a phone.
//   5. (The "Full character sheet" heading's size: the heading left the Player tab, tfr-4; its test went on Francis's yes
//      of 20 Nov 2026.)
//   6. Off the Player screen the same rows keep the book's regular weight: the Pack tab's At hand, and the full sheet's
//      own page (opened from the menu's "Full character sheet"; the tab's row is gone, tfr-5), whose bar keeps its page
//      heading.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';
import { openFullSheetFromMenu } from './fullSheetMenu.ts';

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('Opening…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

test('the folded menu opens to its three sections in words (tablet held sideways)', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openPlayer(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  // Folded (mn-1): icons only, no words drawn.
  await expect(page.getByRole('button', { name: 'Show the menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Show the menu' }).click();
  await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeVisible();
  for (const name of ['Player', 'Scene', 'Pack']) await expect(nav.getByRole('button', { name }).getByText(name, { exact: true })).toBeVisible();
});

test('the tiles’ labels are plain case; the hit points label keeps its small capitals', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openPlayer(page);
  const variant = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontVariantCaps);
  expect(await variant('.vitals .stat-row .stat-tile__label')).toBe('normal');
  expect(await variant('.score-row .stat-tile__label')).toBe('normal');
  expect(await variant('.save-tiles .stat-tile__label')).toBe('normal');
});

// A row's name as it is drawn (the item's, the light's or a list row's), and the weight it is set in, beside the book's
// bold token as read in the same place.
const NAME = '.pack__name, .light-block__name, .list-row__title';
async function nameWeight(row: Locator) {
  const name = row.locator(NAME).first();
  await expect(name).toBeVisible();
  return name.evaluate((el) => {
    const style = getComputedStyle(el);
    return { weight: style.fontWeight, bold: style.getPropertyValue('--weight-book-name').trim(), regular: style.getPropertyValue('--weight-book-text').trim() };
  });
}

// The rows P1 draws bold, found by their names on the shared test character (P1's "Shortbow" is the knife here, "Second
// wind" the flame, "Listen" Hark, "Fighter, level 2" the Lantern Warden; the foot's Abilities, Traits and Notes).
function playerRows(page: Page) {
  const atHand = page.getByRole('region', { name: 'At hand' });
  return [
    atHand.getByRole('button', { name: /^Eel knife/ }),
    atHand.locator('.light-block--at-hand').filter({ has: page.locator('.light-block__name', { hasText: /^Storm lantern/ }) }),
    page.locator('.list-row').filter({ hasText: /^Steady flame/ }).first(),
    page.getByRole('region', { name: 'Skills' }).locator('.list-row').filter({ hasText: /^Hark/ }),
    page.locator('.list-row').filter({ hasText: /^Lantern Warden, level 3/ }),
    // The sheet's rows after Skills, on a phone too (tfr-5).
    ...['Abilities', 'Traits', 'Notes'].map((n) => page.locator('.player .sheet--beside .list-row').filter({ has: page.locator('.list-row__title', { hasText: new RegExp(`^${n}$`) }) })),
  ];
}

for (const size of [
  { name: 'tablet held sideways', width: 1180, height: 820, phone: false },
  { name: 'phone', width: 375, height: 812, phone: true },
] as const) {
  test(`every row's name is in the book's bold, as P1 draws them (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    for (const row of playerRows(page)) {
      const { weight, bold } = await nameWeight(row);
      expect(bold).toBe('700');
      expect(weight, await row.innerText()).toBe(bold);
    }
  });
}

test('off the Player screen the rows keep the book’s regular weight: the Pack tab, and the full sheet’s own page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openPlayer(page);
  // The full sheet's own page (from the menu): its bar keeps the page's heading, and its skill rows stay regular.
  await openFullSheetFromMenu(page);
  const skills = page.getByRole('region', { name: 'Skills' });
  await expect(skills).toBeVisible();
  await expect(page.locator('.top-row__title', { hasText: /^Full sheet$/ })).toBeVisible();
  await expect(page.locator('.sheet__pane-title')).toHaveCount(0);
  const onPage = await nameWeight(skills.locator('.list-row').filter({ hasText: /^Hark/ }));
  expect(onPage.weight).toBe(onPage.regular);
  // The Pack tab's At hand.
  await page.getByRole('button', { name: /^Back to / }).first().click();
  await expect(page.getByRole('region', { name: 'Vitals' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  const knife = page.locator('.pack__item').filter({ hasText: /^Eel knife/ }).first();
  const onPack = await nameWeight(knife);
  expect(onPack.weight).toBe(onPack.regular);
});

// tf-A5 (the test feedback of 19 Nov 2026, item 11): the experience bar is the experience over the next level's figure,
// as the line beside it reads (P1 and P2 draw 60 % under "2,400 of 4,000"). Brannoch is level 3 with 3,400 of 6,000.
//   7. On the Player screen the bar's filled width matches the line's two numbers, and is never empty above 0
//      experience, on a tablet held sideways and on a phone; the full sheet's own page draws the same figure.
async function barAgainstLine(bar: Locator, line: Locator) {
  const [have, of] = ((await line.innerText()).match(/[\d,]+/g) ?? []).map((n) => Number(n.replace(/,/g, '')));
  const drawn = await bar.evaluate((el) => (el.firstElementChild as HTMLElement).getBoundingClientRect().width / el.clientWidth);
  return { drawn, read: have! / of! };
}

for (const size of [
  { name: 'tablet held sideways', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const) {
  test(`the experience bar fills to the line's two numbers (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page);
    const level = page.locator('.player-level');
    const line = level.locator('.player-level__line').first();
    await expect(line).toHaveText('3,400 of 6,000 experience');
    const { drawn, read } = await barAgainstLine(level.locator('.player-level__bar'), line);
    expect(drawn).toBeGreaterThan(0);
    expect(Math.abs(drawn - read)).toBeLessThanOrEqual(0.01);
  });
}

test('the full sheet’s own page draws the same experience bar as the Player screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openPlayer(page);
  await openFullSheetFromMenu(page);
  const level = page.getByRole('region', { name: 'Level' }).filter({ has: page.locator('.advancement__bar') }).first();
  await expect(level).toBeVisible();
  const line = level.locator('.list-row__sub');
  await expect(line).toHaveText('3,400 of 6,000 experience');
  const { drawn, read } = await barAgainstLine(level.locator('.advancement__bar'), line);
  expect(drawn).toBeGreaterThan(0);
  expect(Math.abs(drawn - read)).toBeLessThanOrEqual(0.01);
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the P1 fixes at 375 px (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    test(`rolls with glyphs, pips and the Movement card fit a phone (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openPlayer(page);
      const knife = page.getByRole('region', { name: 'At hand' }).getByRole('button', { name: /^Eel knife/ });
      await expect(knife.locator('.roll-figures__roll')).toHaveText(['d20 +3', 'd4']);
      await expect(page.locator('.use-pips').first()).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}

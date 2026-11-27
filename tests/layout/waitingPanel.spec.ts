// "Waiting for you" as the one working panel (S8a of docs/plans/dec-9-the-whole-scene.md; st-1, wy-1; page 16, T2, T6b
// and T8b), in a real browser on the layout page's invented harbour (`?placePage=spot&session=running`, with
// `&waiting=4|6` encounters waiting, the second with a long name). What it checks, in plain words:
//   * four waiting: the first whole, three one-line rows, the count "1 of 4"; six: the first whole, two rows and "3 more",
//     "1 of 6";
//   * a row's title stays on one line, cut short with an ellipsis rather than wrapping or running past the row;
//   * the open encounter's Done is the page's one accent; Move on is plain;
//   * the encounter's one card (sf-4; page 44, EN1 B, EN4 C): its three answers on one row, each at least 88 px wide,
//     at 375 px too (a card too narrow for that, the 680 px right column, stands them one under another); "Change…" opens the table's pop-up (a sheet from the foot on a phone, centred elsewhere) with the
//     picked row ticked, no accent in it, and no layout or contrast problem;
//   * nothing waiting: "Nothing waits." (on a tablet, at a spot and at a place that holds spots; a phone leaves the
//     empty panel out);
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem, in light and dark, at 375, 680,
//     834 and 1024 px.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openScene(page: Page, waiting: 0 | 2 | 4 | 6) {
  // mn-1: the campaign menu folded to its rail, as the stored choice says (as placeHead.spec.ts).
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  await page.goto(`/layout.html?as=gm&placePage=spot&session=running${waiting ? `&waiting=${waiting}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.place-page__name')).toBeVisible();
  // The panel's own list (players' items) read, so the pictures show it whole.
  await expect(page.getByText('Opening…')).toHaveCount(0);
}

const panel = (page: Page) => page.getByRole('region', { name: 'Waiting for you' });

/**
 * A full-page picture with the page's sticky top row at the top, where it is: a full-page capture otherwise draws it
 * part-way down, across the band (a capture artifact, the lead, 2026-11-15). Unstuck for the shot only.
 */
async function shoot(page: Page, name: string) {
  const unstick = await page.addStyleTag({ content: '.top-row { position: static !important; }' });
  await page.screenshot({ path: `test-results/layout-screens/${name}.png`, fullPage: true });
  await unstick.evaluate((el) => (el as HTMLElement).remove());
}
/** The visible accent buttons on the page (one accent a screen). */
const accents = (page: Page) => page.locator('.button-primary:visible');

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'two columns from', width: 680, height: 1000 },
  { name: 'upright iPad', width: 834, height: 1194 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`Waiting for you (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose (T2): four waiting draw the first whole and three one-line rows, "1 of 4"; a long title stays on one
      // line; the open one's Done is the one accent.
      test('four waiting', async ({ page }) => {
        await openScene(page, 4);
        const box = panel(page);
        await expect(box.locator('.waiting-card__count')).toHaveText('1 of 4');
        await expect(box.locator('.waiting-open')).toHaveCount(1);
        await expect(box.locator('.waiting-row')).toHaveCount(3);
        await expect(box.getByRole('region', { name: /^Encounter waiting, / })).toHaveCount(1);
        await expect(box.getByRole('region', { name: /^Encounter waiting, / }).getByRole('button', { name: 'Done' })).toHaveClass(/button-primary/);
        await expect(accents(page)).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Move on' })).toHaveClass(/button-secondary/);
        // Each row's title on one line, never past its row.
        const titles = box.locator('.waiting-row__title');
        for (let i = 0; i < (await titles.count()); i += 1) {
          const fit = await titles.nth(i).evaluate((el) => ({ lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), inside: el.getBoundingClientRect().right <= el.closest('.waiting-row')!.getBoundingClientRect().right }));
          expect(fit).toEqual({ lines: 1, inside: true });
        }
        await box.scrollIntoViewIfNeeded();
        await shoot(page, `waiting-four-${size.width}-${scheme}`);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (T6b): past four, the first whole, two rows, then "N more" in the fourth place, "1 of 6"; a tap on it
      // opens the first it holds.
      test('six waiting', async ({ page }) => {
        await openScene(page, 6);
        const box = panel(page);
        await expect(box.locator('.waiting-card__count')).toHaveText('1 of 6');
        await expect(box.locator('.waiting-row:not(.waiting-row--more)')).toHaveCount(2);
        await expect(box.getByRole('button', { name: '3 more' })).toBeVisible();
        await shoot(page, `waiting-six-${size.width}-${scheme}`);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await box.getByRole('button', { name: '3 more' }).click();
        await expect(box.locator('.waiting-card__count')).toHaveText('4 of 6');
        await expect(accents(page)).toHaveCount(1);
      });

      // Purpose (S8b; T2, T8b; sf-4, EN1 B and EN4 C): a mix of kinds: an encounter whole, as its one card ("An
      // encounter", its words, the picked line with Change…, then Reveal…, Message… and Done on one row, each at least
      // 88 px wide, Done the one accent; no Start), then the check the band's Encounter check put on the card as a row
      // with its Hit; no card outside the panel. Change… opens the table's pop-up with the row ticked.
      test('a mix of kinds (T2)', async ({ page }) => {
        await openScene(page, 2);
        await page.getByRole('group', { name: 'Quick actions' }).getByRole('button', { name: 'Encounter check' }).click();
        const box = panel(page);
        await expect(box.getByRole('button', { name: /^Hit, Encounter check, now/ })).toBeVisible();
        await expect(box.locator('.waiting-card__count')).toHaveText('1 of 3');
        const open = box.getByRole('region', { name: /^Encounter waiting, / });
        await expect(open.getByRole('heading', { name: 'An encounter' })).toBeVisible();
        await expect(open.getByRole('button', { name: 'Done' })).toHaveClass(/button-primary/);
        await expect(open.getByRole('button', { name: 'Start' })).toHaveCount(0);
        await expect(open.getByRole('button', { name: 'View' })).toHaveCount(0);
        await expect(accents(page)).toHaveCount(1);
        await expect(page.locator('section[aria-label="Due"]')).toHaveCount(0);
        // The three answers on one row, each at least the stacked button's 88 px, wherever the card has the room (a phone
        // too); in a narrower card (the right column at 680 px) one under another, each the card's width.
        const answers = await open.locator('.stacked-group > .stacked-button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), width: r.width })));
        const cardWidth = (await open.boundingBox())!.width;
        expect(answers.length).toBe(3);
        for (const a of answers) expect(a.width).toBeGreaterThanOrEqual(88);
        if (cardWidth >= 280) expect(answers.map((a) => a.top)).toEqual(Array(answers.length).fill(answers[0]!.top));
        else for (const a of answers) expect(Math.abs(a.width - cardWidth)).toBeLessThanOrEqual(1);
        if (size.width === 375) expect(cardWidth).toBeGreaterThanOrEqual(280);
        await shoot(page, `waiting-mix-${size.width}-${scheme}`);
        await box.screenshot({ path: `test-results/layout-screens/waiting-encounter-card-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        // Change… opens the table's pop-up, the row picked before ticked: a sheet from the foot on a phone, centred
        // elsewhere, with no accent of its own.
        await open.getByRole('button', { name: /^Change…/ }).click();
        const pop = page.getByRole('dialog', { name: 'On the water' });
        await expect(pop).toBeVisible();
        await expect(pop.getByRole('radio', { name: /Bog lurkers/ })).toHaveAttribute('aria-checked', 'true');
        await expect(pop.locator('.button-primary')).toHaveCount(0);
        // Where it settles, once its slide in has ended.
        const where = () => pop.boundingBox().then((b) => (size.name === 'phone' ? Math.abs(b!.y + b!.height - size.height) : Math.abs(b!.x + b!.width / 2 - size.width / 2)));
        await expect.poll(where).toBeLessThanOrEqual(2);
        if (scheme === 'light') await page.screenshot({ path: `test-results/layout-screens/waiting-change-${size.width}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      });

      // Purpose: nothing waiting reads "Nothing waits." on a tablet; a phone leaves the empty panel out (page 11, 4b).
      test('nothing waits', async ({ page }) => {
        await openScene(page, 0);
        if (size.name === 'phone') await expect(panel(page)).toHaveCount(0);
        else await expect(panel(page).getByText('Nothing waits.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Move on' })).toHaveClass(/button-primary/);
        await shoot(page, `waiting-none-${size.width}-${scheme}`);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (the approval's fix 5, 2026-11-18): at a place that holds spots, the plain Scene, nothing waiting still
      // reads "Nothing waits." on a tablet, first in the right column above Locations; a phone leaves it out (T8a).
      test('nothing waits, at a place with spots', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
        await page.goto('/layout.html?as=gm&placePage=spots&session=running&daylight=1');
        await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
        await expect(page.getByRole('region', { name: 'Locations' })).toBeVisible();
        await expect(page.getByText('Opening…')).toHaveCount(0);
        // The approval's fix 1 (the fixture) and ⚑ 1 ruled ("yes, b", 2026-11-18): in a dungeon the sun's line is gone,
        // and the Light fact (the party's lit torch) is the only light fact.
        await expect(page.locator('.scene-band__light')).toHaveCount(0);
        await expect(page.getByRole('group', { name: 'Scene facts' })).not.toContainText('No light');
        if (size.name === 'phone') {
          await expect(panel(page)).toHaveCount(0);
          return;
        }
        await expect(panel(page).getByText('Nothing waits.')).toBeVisible();
        if (size.width >= 1024) {
          const [waits, spots] = await Promise.all([panel(page).boundingBox(), page.getByRole('region', { name: 'Locations' }).boundingBox()]);
          expect(waits!.y + waits!.height).toBeLessThanOrEqual(spots!.y + 0.5);
        }
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

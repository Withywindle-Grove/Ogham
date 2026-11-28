// The players' place card (plan dec-9-the-players-scene, P4; page 24 PL1b to PL1d, set 9's PR1 to PR7c, page 01 frame
// 7b), in a real browser on the layout page's invented harbour (`?placeCard=1`; `bare` the Area never shown, `messy`
// long names and 999; `gm` the GM's Knowledge with its eyes). What it checks, in plain words:
//   * the two cards stand in the page's columns (one column on a phone, the Location first), the Area's rows each a
//     44 px target; nothing scrolls sideways and axe finds no serious problem, in light and dark;
//   * a known Location opens its shown pieces in the standard sheet, and the Rules row its list;
//   * the GM's eye on a section is a 44 px switch, and a tap shares it (its line and the count change);
//   * on the players' Scene itself (ppf-6; `?as=player&placePage=spot&ways=1&picture=1`): the Location's card at the
//     left, "1. The jetty" under the trail, the shown picture a small square button at the head's right, level with the
//     name, that opens it whole; the Area's card at the right, "Shared, turn N." where a step is known (ppf-6 a), each
//     known Location's first shown piece on one line under its name (ppf-4), however long; at 375 px and on a tablet,
//     light and dark, with long names (`ways=messy`). Each saves its picture.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

/** The players' Scene at the jetty, its picture shown, with the ways of `ways` (`1`, or `messy` for long names). */
async function openPlayersScene(page: Page, ways: '1' | 'messy') {
  await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
  await page.goto(`/layout.html?as=player&placePage=spot&session=running&ways=${ways}&picture=1`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('heading', { name: 'Marching order' })).toBeVisible();
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the players' place card (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the Location's card and the Area's stand in their columns, every row a 44 px target, and pass the checks,
      // with the Area shown, never shown, and with long names and 999.
      test('both cards, in each state', async ({ page }) => {
        for (const state of ['1', 'bare', 'messy']) {
          await page.goto(`/layout.html?placeCard=${state}`);
          const location = page.getByRole('region', { name: /^Where you are: / });
          await location.waitFor();
          const left = await location.boundingBox();
          const area = page.locator('.players-area');
          await expect(area).toBeVisible();
          const right = await area.boundingBox();
          // One column on a phone, the Location first; two side by side on a tablet.
          if (size.name === 'phone') expect(right!.y).toBeGreaterThan(left!.y);
          else expect(right!.x).toBeGreaterThan(left!.x);
          // ppf-6 (a): a step is known, so a shared section names its turn.
          if (state !== 'bare') await expect(area.getByText('Shared, turn 9.')).toBeVisible();
          for (const box of await Promise.all((await area.getByRole('button').all()).map((b) => b.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(await layoutProblems(page), state).toEqual([]);
          expect(await accessibilityProblems(page), state).toEqual([]);
        }
      });

      // Purpose: a known Location opens the standard sheet with its shown pieces; the Rules row opens its list, headed by
      // place when two places have rules.
      test('opens a known Location and the Rules list', async ({ page }) => {
        await page.goto('/layout.html?placeCard=1');
        await page.getByRole('button', { name: /2\. The Wreck/ }).click();
        const sheet = page.getByRole('dialog', { name: '2. The Wreck' });
        await expect(sheet.getByText(/A cog on her side/)).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await sheet.getByRole('button', { name: 'Close' }).click();
        await page.getByRole('button', { name: /^Rules: / }).click();
        const list = page.getByRole('dialog', { name: /Rules/ });
        await expect(list.locator('.players-rules__heading')).toHaveCount(2);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: the GM's eye is a 44 px switch beside each section; a tap shares the section and the count follows.
      test("the GM's eyes on Knowledge", async ({ page }) => {
        await page.goto('/layout.html?placeCard=gm');
        const sheet = page.getByRole('dialog', { name: 'The Drowned Harbour: Knowledge' });
        await sheet.waitFor();
        const eyes = sheet.getByRole('switch');
        await expect(eyes).toHaveCount(3);
        for (const box of await Promise.all((await eyes.all()).map((e) => e.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
        await expect(sheet.getByText('1 of 3 sections shared.')).toBeVisible();
        await eyes.nth(1).click();
        await expect(sheet.getByText('2 of 3 sections shared.')).toBeVisible();
        await expect(sheet.getByText('Shared with the players, turn 9.')).toHaveCount(2);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (ppf-6, ppf-4, ppf-1): on the players' Scene the Location's card stands at the left with the trail, its
      // numbered name and the picture as a small square button level with the name at the head's right, a tap opening
      // it whole; the Area's card at the right, headed by the Area's name, each known Location's first shown piece on
      // one line under it; with long names too. Nothing scrolls sideways, every tap is 44 px, axe finds nothing.
      for (const ways of ['1', 'messy'] as const) {
        test(`on the players' Scene (${ways === '1' ? 'the jetty' : 'long names'})`, async ({ page }) => {
          await openPlayersScene(page, ways);
          const left = page.locator('.players-page__column[data-column="left"]');
          const right = page.locator('.players-page__column[data-column="right"]');
          const location = left.getByRole('region', { name: 'Where you are: 1. The jetty' });
          await expect(location).toBeVisible();
          await expect(location.getByRole('navigation', { name: 'Where this is' })).toContainText('The Drowned Harbour');
          const picture = location.getByRole('button', { name: 'Open the picture of 1. The jetty' });
          await expect(picture.locator('img')).toBeVisible();
          await page.screenshot({ path: `test-results/layout-screens/players-place-card-page-${ways}-${size.width}-${scheme}.png`, fullPage: true });
          const [nameBox, pictureBox, cardBox] = await Promise.all([location.locator('.players-place__name').boundingBox(), picture.boundingBox(), location.boundingBox()]);
          // Square, a tap's size, at the card's right padding: level with the name beside it where the head has room
          // (a tablet), else on the line under the name, still at the right (the head's rule for its buttons, ap-16).
          expect(Math.abs(pictureBox!.width - pictureBox!.height)).toBeLessThanOrEqual(1);
          expect(pictureBox!.height).toBeGreaterThanOrEqual(44);
          const inset = await location.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight) + parseFloat(getComputedStyle(el).borderRightWidth));
          expect(Math.abs(cardBox!.x + cardBox!.width - inset - (pictureBox!.x + pictureBox!.width))).toBeLessThanOrEqual(1);
          if (size.name === 'tablet') {
            expect(Math.abs(pictureBox!.y - nameBox!.y)).toBeLessThanOrEqual(1);
            expect(pictureBox!.x).toBeGreaterThan(nameBox!.x + nameBox!.width - 1);
          } else expect(pictureBox!.y).toBeGreaterThanOrEqual(nameBox!.y);
          // The Area's card: the Area's name, and each known Location's line on one line, cut with an ellipsis.
          const area = right.locator('.players-area');
          await expect(area.getByRole('heading', { name: 'The Drowned Harbour' })).toBeVisible();
          const subs = area.locator('.list-row__sub');
          await expect(subs.first()).toBeVisible();
          for (const sub of await subs.all()) {
            const one = await sub.evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) || 0, wraps: getComputedStyle(el).whiteSpace }));
            expect(one.wraps).toBe('nowrap');
            if (one.line) expect(one.height).toBeLessThanOrEqual(one.line + 1);
          }
          for (const box of await Promise.all((await area.getByRole('button').all()).map((b) => b.boundingBox()))) expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
          await picture.click();
          const whole = page.getByRole('dialog', { name: 'The picture of 1. The jetty' });
          await expect(whole.locator('img')).toBeVisible();
          expect(await accessibilityProblems(page)).toEqual([]);
        });
      }
    });
  }
}

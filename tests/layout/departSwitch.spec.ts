// The Depart sheet's "Exploration method" (plan scene-point-to-point B7, p2p-5; page 24, DP1 and DP1b, approved
// 2026-11-18). It replaces scene-test-small-fixes' rule (the two-sided switch hugging its two sides, page 16's T6): the
// choice now has three sides, the setting's two ways and Point to point, sharing the row's width with no blank space at
// its right. In a real browser on the layout page's invented quay (`?town=town`, two ways of exploring). What it checks,
// in plain words:
//   * the switch's frame is as wide as the sheet's field, and its sides fill it in one row: the first starts at its
//     left, the last ends at its right, with no gap between;
//   * each side is a 44 px tap at least, and no side's words break onto a second line;
//   * nothing scrolls sideways and axe finds no serious problem, at 375 px and on a tablet, in light and dark.
import { expect } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';
import { openDepartWhere } from './depart.ts';

for (const width of [375, 834] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Depart sheet's method (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1200 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (B7): the three sides of "Exploration method" share the row's width, as DP1 and DP1b draw them.
      test('the three sides share the row', async ({ page }) => {
        await page.goto('/layout.html?as=gm&town=town');
        await page.getByRole('button', { name: /The Reedmouth Quay/ }).click();
        await page.getByRole('button', { name: 'Depart' }).click();
        const sheet = page.getByRole('dialog', { name: /Depart$/ });
        await expect(sheet).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const how = sheet.getByRole('group', { name: 'Exploration method' });
        await expect(how).toHaveClass(/button-row--switch/);
        const sides = how.getByRole('button');
        await expect(sides).toHaveText(['Market town', 'Under the quay', 'Point to point']);
        const frame = (await how.boundingBox())!;
        const field = (await how.locator('xpath=..').boundingBox())!;
        // The frame is the field's width.
        expect(Math.abs(frame.width - field.width)).toBeLessThanOrEqual(1);
        const edge = await how.evaluate((el) => parseFloat(getComputedStyle(el).borderInlineStartWidth));
        const boxes = await Promise.all([0, 1, 2].map(async (i) => (await sides.nth(i).boundingBox())!));
        // Each side a tap of 44 px at least, its words on one line (a side no taller than the tallest single-line one).
        for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
        const oneLine = await sides.evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 1));
        expect(oneLine).toBe(true);
        // The sides fill the frame: rows of sides with no blank space at the right (one row where they fit).
        const rows = new Map<number, typeof boxes>();
        for (const box of boxes) rows.set(Math.round(box.y), [...(rows.get(Math.round(box.y)) ?? []), box]);
        // The quay's three sides fit one row, at 375 px too (DP1b).
        expect(rows.size).toBe(1);
        for (const row of rows.values()) {
          const left = Math.min(...row.map((b) => b.x));
          const right = Math.max(...row.map((b) => b.x + b.width));
          expect(Math.abs(left - (frame.x + edge))).toBeLessThanOrEqual(1);
          expect(Math.abs(frame.x + frame.width - edge - right)).toBeLessThanOrEqual(1);
        }
        await page.screenshot({ path: `test-results/layout-screens/depart-method-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}

// The Depart list as one view (sf-2; plan dec-scene-feedback C2; page 44, DP3 and DP3b, approved 2026-11-26; N4). On
// the layout page's quay with `?places=marches`: the isle's two Areas, an Area with a long name and thirteen places,
// and a region pack with no Location. What it checks, in plain words:
//   * a long Area name wraps inside the list, and its thirteen places come in number order, none first;
//   * a pack unfolds where it stands: its Areas 16 px in from the pack's edge, their places' words 40 px in; its count
//     is its places to pick;
//   * every row and every fold mark is a 44 px tap; nothing scrolls sideways and axe finds no serious problem, at 375
//     px and on a tablet (1024 px), in light and dark.
for (const width of [375, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Depart list (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1400 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (sf-2; DP3 A, C, D; DP3b): as it opens, a long Area's thirteen places in order, and a pack unfolded in place.
      test('the groups, a long Area and a pack unfolded in place', async ({ page }) => {
        test.setTimeout(90_000); // three pictures and three axe runs
        const picker = await openDepartWhere(page, 'marches');
        // As it opens: Recently visited names the Wreck's Area; that Area, the one last played, open; the others folded.
        await expect(picker.getByRole('region', { name: 'Recently visited' }).locator('.depart-pick__row')).toHaveText(['2. The WreckThe Drowned Harbour']);
        await expect(picker.getByRole('button', { name: 'Fold The Drowned Harbour', exact: true })).toBeVisible();
        await expect(picker.getByRole('button', { name: 'Show The Shingle Beach', exact: true })).toBeVisible();
        await expect(picker.getByRole('button', { name: 'Show The Drowned Harbour and the Wrecks of the Outer Bar', exact: true })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/depart-list-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);

        // C: the long name wraps inside the list; thirteen places in number order, the one with no number first.
        const long = 'The Drowned Harbour and the Wrecks of the Outer Bar';
        await picker.getByRole('button', { name: 'Fold The Drowned Harbour', exact: true }).click();
        await picker.getByRole('button', { name: `Show ${long}`, exact: true }).click();
        const area = picker.getByRole('region', { name: long, exact: true });
        const words = ['The Old Mooring', ...['The Anchorage', 'The Jetty', 'The Wreck', 'The Breakwater', 'The Customs Shed', 'The Sea Cave', 'The Sluice', 'The Net Loft', 'The Chain Tower', 'The Salt Pans', 'The Sea Gate', 'The Outer Mole'].map((name, n) => `${n}. ${name}`)];
        await expect(area.locator('.depart-pick__words')).toHaveText(words);
        const heading = area.getByRole('heading', { name: long });
        const lineHeight = await heading.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2);
        if (width === 375) expect((await heading.boundingBox())!.height).toBeGreaterThan(lineHeight * 1.5);
        const box = (await picker.boundingBox())!;
        const head = (await area.locator('.depart-pick__head').boundingBox())!;
        expect(head.x + head.width).toBeLessThanOrEqual(box.x + box.width + 1);
        await page.screenshot({ path: `test-results/layout-screens/depart-list-long-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);

        // D: a pack unfolded in place; its Areas 16 px in from its edge, their places 24 px more (40 px).
        await picker.getByRole('button', { name: `Fold ${long}`, exact: true }).click();
        await picker.getByRole('button', { name: 'Show The Reed Marches' }).click();
        await picker.getByRole('button', { name: 'Show Moss Landing' }).click();
        const packs = picker.getByRole('region', { name: 'From your packs' });
        const edge = (await packs.locator('.depart-pick__pack').boundingBox())!.x;
        const moss = picker.getByRole('region', { name: 'Moss Landing', exact: true });
        expect(Math.round((await moss.locator('.depart-pick__area').boundingBox())!.x - edge)).toBe(16);
        // The words, not the empty tick column before them (the review of #124).
        const placeWords = moss.locator('.depart-pick__words');
        await expect(placeWords).toHaveCount(3);
        for (const words of await placeWords.all()) expect(Math.round((await words.boundingBox())!.x - edge)).toBe(40);
        // The pack's count is its places to pick, 4 + 3 + 45, not its Region and Areas (DP3 A, D).
        await expect(packs.getByText('52 places', { exact: true })).toBeVisible();
        await expect(moss.locator('.depart-pick__words')).toHaveText(['The Ford', '1. The Drowned Jetty', '2. The Reeve’s Post']);
        await expect(picker.getByRole('region', { name: 'Thornwater' }).getByText('45 places')).toBeVisible();
        await expect(picker.getByRole('button', { name: /Back/ })).toHaveCount(0);
        for (const tap of await picker.locator('.depart-pick__row, .depart-pick__fold').all()) expect((await tap.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `test-results/layout-screens/depart-list-pack-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (sf-2; DP3 B, E): a search names each row's Area at its right (under the name on a phone); nothing found
      // says so and offers Other….
      test('a search, and nothing found', async ({ page }) => {
        const picker = await openDepartWhere(page, 'isle');
        const search = picker.getByRole('textbox', { name: 'Search places by name or map number' });
        await search.fill('1');
        const found = picker.getByRole('region', { name: 'Places found' });
        await expect(found.locator('.depart-pick__where')).toHaveText(['The Drowned Harbour', 'The Shingle Beach', 'The Drowned Harbour']);
        const row = (await found.locator('.depart-pick__row').first().boundingBox())!;
        const where = (await found.locator('.depart-pick__where').first().boundingBox())!;
        // At the row's right on a tablet; under the name on a phone.
        if (width === 375) expect(where.y).toBeGreaterThan(row.y + 16);
        else expect(Math.abs(where.x + where.width - (row.x + row.width))).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `test-results/layout-screens/depart-list-search-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await search.fill('quay');
        await expect(picker.getByText('No place matches “quay”.')).toBeVisible();
        await expect(picker.getByRole('button', { name: 'Other… use “quay” as a new place' })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/depart-list-none-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

// The Depart list reopened, and Other… with no name (sf-2; the audit's findings 1 and 3). On a phone's and a tablet's
// own height, so a row low in the list is off screen unless it is brought into view. What it checks, in plain words:
//   * reopened after a pack's place is picked, the list opens that place's pack and Area only (not the Area last
//     played as well: 06 "else"), and the ticked row is on screen;
//   * Other… with no name typed: Set place stays a button and a tap says why in a pop-up; closing it leaves the typed-
//     name step and the list open, and nothing picked; axe finds no serious problem.
for (const [width, height] of [[375, 667], [1024, 768]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the Depart list reopened (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (the audit's finding 1): reopened, only the ticked place's pack and Area are open, its row on screen.
      test("a pack's place, ticked and in view", async ({ page }) => {
        const picker = await openDepartWhere(page, 'marches');
        await picker.getByRole('button', { name: 'Show The Reed Marches' }).click();
        await picker.getByRole('button', { name: 'Show Moss Landing' }).click();
        await picker.getByRole('button', { name: 'The Ford', exact: true }).click();
        const sheet = page.getByRole('dialog', { name: /Depart$/ });
        await sheet.getByRole('button', { name: 'Where?: The Ford' }).click();
        const again = page.getByRole('dialog', { name: /Where\?$/ });
        await again.getByRole('textbox', { name: 'Search places by name or map number' }).waitFor();
        await expect(again.getByRole('button', { name: 'Show The Drowned Harbour', exact: true })).toBeVisible();
        await expect(again.locator('.depart-pick__fold[aria-expanded="true"]')).toHaveCount(2);
        await expect(again.getByRole('region', { name: 'Moss Landing', exact: true }).getByRole('button', { name: 'The Ford', pressed: true })).toBeInViewport();
        await page.screenshot({ path: `test-results/layout-screens/depart-list-reopened-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);

        // A place low in a long Area (Thornwater's 45th, past its first 40 rows): listed, ticked and brought on screen.
        await again.getByRole('textbox', { name: 'Search places by name or map number' }).fill('reach 45');
        await again.getByRole('button', { name: '1044. Thornwater reach 45' }).click();
        await sheet.getByRole('button', { name: 'Where?: 1044. Thornwater reach 45' }).click();
        const third = page.getByRole('dialog', { name: /Where\?$/ });
        await third.getByRole('textbox', { name: 'Search places by name or map number' }).waitFor();
        await expect(third.getByRole('button', { name: 'Show The Drowned Harbour', exact: true })).toBeVisible();
        await expect(third.getByRole('button', { name: /^Show \d+ more/ })).toHaveCount(0);
        await expect(third.getByRole('region', { name: 'Thornwater', exact: true }).getByRole('button', { name: '1044. Thornwater reach 45', pressed: true })).toBeInViewport();
        await page.screenshot({ path: `test-results/layout-screens/depart-list-reopened-long-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (the audit's finding 3; hard rule 7): with no name typed, Set place says why and picks nothing.
      test('Set place with no name says why', async ({ page }) => {
        const picker = await openDepartWhere(page, 'isle');
        await picker.getByRole('button', { name: /^Other… a place/ }).click();
        await picker.getByRole('button', { name: 'Set place' }).click();
        const why = page.getByRole('dialog', { name: "Can't set the place" });
        await expect(why).toBeVisible();
        await expect(why.getByText('Type a name first.')).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/depart-other-empty-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(why).toHaveCount(0);
        await expect(picker.getByRole('textbox', { name: "A place that isn't listed" })).toBeVisible();
        await picker.getByRole('button', { name: 'Set place' }).click();
        await why.getByRole('button', { name: /Close/ }).click();
        await expect(why).toHaveCount(0);
        await expect(picker.getByRole('textbox', { name: "A place that isn't listed" })).toBeVisible();
        await picker.getByRole('button', { name: 'Back to the list' }).click();
        await picker.getByRole('button', { name: 'Close' }).click();
        await expect(page.getByRole('dialog', { name: /Depart$/ }).getByRole('button', { name: 'Where?: Pick a Location' })).toBeVisible();
      });
    });
  }
}

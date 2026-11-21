// The place page's head (5b's round; the lead, 2026-11-14), in a real browser on the layout page's invented harbour
// (`?placePage=spots&session=running`, with `&name=long` for the longest name and `&name=word` for one over-long
// word). What it checks, in plain words:
//   * the place's name breaks only between words; a single word wider than its whole line breaks (the lead,
//     2026-11-14), so nothing runs past the card and the page never scrolls sideways;
//   * with the campaign menu folded to its rail (mn-1, Francis 2026-11-14: folded by default, now in this stack; set
//     here through the stored choice either way), the page has two columns from 680 px (ap-16); the card's
//     own width decides the head: where the name's column keeps its floor (13 rem) the rule's button and Move on sit at
//     its right (p2p-10; page 23's LA1; page 11's frames 1a and 6, page 16's T1), as on a tablet (1024 px); else on a
//     line of their own straight under the name, at the right (page 16, T12 A), as on an upright iPad (834 px) and at
//     680 px. There is no line under the name any more (B3), so they never stand under a description. (B3's plan asks
//     for beside at 834 px too: there the name would get 138 px, and the frame's own "Anchorage" needs 156 at the
//     heading's size, so it would break inside the word. A question for Francis in B3's pull request.) Never a bar
//     on a tablet;
//   * with the menu open at 1024 px, the same rule, the words still whole (a picture for the lead): its card is
//     narrower than an upright iPad's, so the buttons still go under the name there;
//   * on a phone they are in the bar at the foot (frame 4b, T8a) and the name takes the card's whole width;
//   * nothing scrolls sideways, every tap is 44 px, and axe finds no serious problem;
//   * the Location's card below the head, redrawn by B3 (its own block at the foot of this file);
//   * the trail's Locations panel and reading ahead, B2 (the last block).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openPlace(page: Page, name: '' | 'long' | 'word', menu: 'folded' | 'open' = 'folded') {
  // mn-1: the campaign menu folded to its rail or open, as the stored choice says ('yes' folded, 'no' open; nothing
  // stored is folded since mn-1).
  await page.addInitScript((kept) => localStorage.setItem('grimoire.navCollapsed', kept), menu === 'folded' ? 'yes' : 'no');
  await page.goto(`/layout.html?as=gm&placePage=spots&session=running${name ? `&name=${name}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await expect(page.locator('.place-page__name')).toBeVisible();
  // The place's tables load after it: wait for them, so the pictures show the page whole.
  await expect(page.getByText('What the tide left').first()).toBeVisible();
}

/** Whether any word of the name is split across two lines. */
const wordSplit = (page: Page) =>
  page.locator('.place-page__name').evaluate((el) => {
    const text = el.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) return 'no text node';
    const words = (text.textContent ?? '').split(' ');
    let at = 0;
    for (const word of words) {
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + word.length);
      const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      if (tops.size > 1) return word;
      at += word.length + 1;
    }
    return null;
  });

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'two columns from', width: 680, height: 1000 },
  { name: 'upright iPad', width: 834, height: 1194 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  test.describe(`the place card's head (${size.name}, ${size.width} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    // Purpose: with the longest name, no word is split; on a tablet (the menu folded, mn-1) the actions sit beside the
    // name with its column at its floor, or (a narrower card) on their own line under the name and its line at the
    // right, never in a bar; on a phone they are in the bar with the name the card's whole width.
    test('the longest name: whole words, the actions beside, under or in the bar', async ({ page }) => {
      await openPlace(page, 'long');
      // The rule's button loads after the name: wait for it, so the head is measured whole.
      await expect(page.getByRole('button', { name: 'Someone fell in' }).first()).toBeVisible();
      expect(await wordSplit(page)).toBeNull();
      const words = (await page.locator('.place-page__title-words').boundingBox())!;
      const row = (await page.locator('.place-page__title-row').boundingBox())!;
      const inHead = page.locator('.place-page__title-row .place-page__head-actions');
      const bar = page.locator('.place-page__bar');
      if (size.width > 599) {
        await expect(inHead).toHaveCount(1);
        await expect(bar).toHaveCount(0);
        if (size.width >= 680) await expect(page.locator('.place-page--two .place-page__side')).toBeVisible();
        const actions = (await inHead.boundingBox())!;
        const under = (await page.locator('.place-page__title-row--under').count()) > 0;
        test.info().annotations.push({ type: 'head', description: `${size.width} px: ${under ? 'under the name (T12 A)' : 'beside the name (LA1)'}, card ${Math.round(row.width)} px, actions ${Math.round(actions.width)} px` });
        // As approved (the lead, 2026-11-14): beside at 1024 px with the menu folded, under at 834 and 680 px; under, they
        // stand straight under the name (no line between since B3: p2p-10, the fault "under the description").
        expect(under).toBe(size.width < 1024);
        if (under) {
          expect(actions.y).toBeGreaterThanOrEqual(words.y + words.height - 1);
          expect(Math.abs(actions.x + actions.width - (row.x + row.width))).toBeLessThanOrEqual(1);
          expect(Math.abs(words.width - row.width)).toBeLessThanOrEqual(1);
          const name = (await page.locator('.place-page__name').boundingBox())!;
          expect(Math.abs(name.y + name.height - (words.y + words.height))).toBeLessThanOrEqual(1);
        } else {
          expect(Math.round(words.width)).toBeGreaterThanOrEqual(208);
          expect(actions.x).toBeGreaterThanOrEqual(words.x + words.width - 1);
          expect(actions.y).toBeLessThan(words.y + 8);
          // At the card's right edge, level with the name's first line.
          expect(Math.abs(actions.x + actions.width - (row.x + row.width))).toBeLessThanOrEqual(1);
        }
        // No line under the name (p2p-10): the name is the head's only words, but the ground's line in a day mode.
        await expect(page.locator('.place-page__title-words p')).toHaveCount(0);
      } else {
        await expect(inHead).toHaveCount(0);
        await expect(bar).toHaveCount(1);
        await expect(bar.getByRole('button', { name: 'Move on' })).toBeVisible();
        expect(Math.abs(words.width - row.width)).toBeLessThanOrEqual(1);
      }
      await page.screenshot({ path: `test-results/layout-screens/place-head-long-${size.width}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });

    // Purpose: the frames' own name ("The Drowned Harbour") keeps its words whole too.
    test('the frames’ name: whole words', async ({ page }) => {
      await openPlace(page, '');
      expect(await wordSplit(page)).toBeNull();
    });
  });
}

// Purpose: with the campaign menu open at 1024 px the card is narrower, so the head's buttons go under the name and its
// line (T12 A), every word of the longest name whole (a picture for the lead).
test.describe('the menu open (1024 px)', () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test('the buttons under the name, words unbroken', async ({ page }) => {
    await openPlace(page, 'long', 'open');
    await expect(page.getByRole('button', { name: 'Someone fell in' }).first()).toBeVisible();
    expect(await wordSplit(page)).toBeNull();
    await expect(page.locator('.place-page__title-row--under .place-page__head-actions')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/layout-screens/place-head-long-1024-menu-open.png', fullPage: true });
  });
});

// Purpose (the lead, 2026-11-14): a single word wider than its whole line breaks, so the page never scrolls sideways
// at 375 px, and at 1024 px the head's buttons stay inside the card.
for (const size of [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
] as const) {
  test.describe(`one over-long word in the name (${size.width} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test('breaks inside the line; nothing runs past the card', async ({ page }) => {
      await openPlace(page, 'word');
      await expect(page.getByRole('button', { name: 'Someone fell in' }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const card = (await page.locator('.place-page__card').first().boundingBox())!;
      const name = (await page.locator('.place-page__name').boundingBox())!;
      expect(name.x + name.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
      if (size.width >= 600) {
        const actions = (await page.locator('.place-page__title-row .place-page__head-actions').boundingBox())!;
        expect(actions.x + actions.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
      }
      await page.screenshot({ path: `test-results/layout-screens/place-head-word-${size.width}.png`, fullPage: true });
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}

// The Location's card redrawn (plan scene-point-to-point B3; p2p-10 to p2p-12, p2p-14; page 23, LA1 and LA4 B,
// approved 2026-11-18), at the jetty (`?placePage=spot&session=running`) with two of its five pieces shown, as LA1.
// Purpose, in plain words: on a phone and on a tablet the card has no "Pieces" heading, no "Players see", no Rename
// and no calls line; the description comes first with the words naming other pieces bold and underlined; the check's
// card gives the pack's sentence with its die; the count and Hide all stand at the foot beside "+ Piece", every one
// of them 44 px tall and in one row on the tablet; Notes is one folded row of 44 px with nothing of the notes showing,
// and opened it holds the source line; Move on carries the footprints; nothing scrolls sideways, and axe finds no
// serious problem.
for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  test.describe(`the Location's card (${size.name}, ${size.width} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test('the book’s format, the count at the foot, Notes folded whole', async ({ page }) => {
      // Two shows and a wait for their toast to go before the picture: more than the default 30 s under load.
      test.setTimeout(60_000);
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
      await page.goto('/layout.html?as=gm&placePage=spot&session=running');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      await expect(page.getByRole('heading', { name: '1. The jetty' })).toBeVisible();
      const card = page.locator('.place-page__card');
      const description = card.getByRole('button', { name: 'Edit piece: Black piles, a mooring ring, weed to the waterline.' });
      await expect(description).toBeVisible();
      // LA1's state: the description and one more piece shown.
      for (const words of ['Black piles, a mooring ring, weed to the waterline.', 'Green copper; the fourth ring along is new iron, set this month.']) {
        await page.locator('.place-page__piece').filter({ has: page.getByRole('button', { name: `Edit piece: ${words}` }) }).getByRole('button', { name: 'Show players' }).click();
      }
      await expect(card.getByText('2 of 5 shown')).toBeVisible();
      await expect(card.getByRole('button', { name: 'Hide all' })).toBeVisible();
      // No heading "Pieces", no Players see, no Rename, no calls line, no kind word.
      await expect(card.getByRole('heading', { name: 'Pieces' })).toHaveCount(0);
      await expect(card.getByText(/Players see|Rename for players|Calls to adventure/)).toHaveCount(0);
      await expect(card.getByText(/^(Description|Exit|Other|Treasure)\.$/)).toHaveCount(0);
      // The description first, its named words bold and underlined.
      await expect(card.locator('.place-page__pieces .place-page__piece-words').first()).toHaveAttribute('aria-label', 'Edit piece: Black piles, a mooring ring, weed to the waterline.');
      const marked = description.locator('.place-page__named');
      await expect(marked).toHaveText(['mooring ring', 'weed']);
      const look = await marked.first().evaluate((el) => ({ weight: Number(getComputedStyle(el).fontWeight), line: getComputedStyle(el).textDecorationLine }));
      expect(look.weight).toBeGreaterThanOrEqual(700);
      expect(look.line).toContain('underline');
      // The check's card: the pack's sentence, its die drawn.
      const sentence = card.locator('.place-page__check-sentence');
      await expect(sentence).toHaveText('Roll d6 for an encounter each time the party rows to a new Location.');
      await expect(sentence.locator('.die-glyph--d6')).toHaveCount(1);
      // The foot: + Piece at the left, the count and Hide all at the right, each control 44 px tall; one row on a tablet.
      const foot = card.locator('.place-page__foot');
      const [add, count, hide, f] = await Promise.all([
        foot.getByRole('button', { name: '+ Piece' }).boundingBox(),
        foot.getByText('2 of 5 shown').boundingBox(),
        foot.getByRole('button', { name: 'Hide all' }).boundingBox(),
        foot.boundingBox(),
      ]);
      if (!add || !count || !hide || !f) throw new Error('not drawn');
      for (const box of [add, hide]) expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
      expect(Math.abs(add.x - f.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(hide.x + hide.width - (f.x + f.width))).toBeLessThanOrEqual(1);
      expect(count.x + count.width).toBeLessThanOrEqual(hide.x);
      if (size.name === 'tablet') expect(Math.abs(add.y + add.height / 2 - (hide.y + hide.height / 2))).toBeLessThanOrEqual(1);
      // "+ Piece" and "Hide all" are the stacked button, an icon above the word (LA1, LA4; Francis 2026-11-19: "Yes, as
      // the frame"), the two at one height; "+ Picture" (no picture yet), a word button, takes that height beside them.
      for (const name of ['+ Piece', 'Hide all']) {
        const button = foot.getByRole('button', { name });
        await expect(button).toHaveClass(/stacked-button/);
        const [icon, word] = await Promise.all([button.locator('svg').boundingBox(), button.locator('span').boundingBox()]);
        if (!icon || !word) throw new Error('not drawn');
        expect(icon.y + icon.height).toBeLessThanOrEqual(word.y + 1);
      }
      expect(Math.abs(add.height - hide.height)).toBeLessThanOrEqual(1);
      const picture = await foot.getByRole('button', { name: '+ Picture' }).boundingBox();
      if (!picture) throw new Error('not drawn');
      expect(Math.abs(picture.height - add.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(picture.y - add.y)).toBeLessThanOrEqual(1);
      // Notes: one folded row, 44 px, the word alone; opened, the source line inside.
      const notes = card.getByRole('button', { name: 'Notes' });
      await expect(notes).toHaveText('Notes');
      expect(Math.round((await notes.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
      // Move on carries the footprints (in the head on a tablet, in the bar on a phone).
      const moveOn = page.getByRole('button', { name: 'Move on' });
      await expect(moveOn).toHaveCount(1);
      expect(await moveOn.locator('svg ellipse').count()).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      // A picture of the page for the pull request, once the last toast has gone (it would cover the card).
      await expect(page.locator('.toast-host').getByRole('button', { name: 'Undo' })).toHaveCount(0, { timeout: 12_000 });
      // Tall enough that the page needs no scrolling, so the fixed top bar never lies over the card in the picture.
      await page.setViewportSize({ width: size.width, height: 3000 });
      await page.locator('.place-page').screenshot({ path: `test-results/layout-screens/location-card-${size.width}.png` });
      await notes.click();
      await expect(card.getByText('From your adventure: The Reed Marches, p. 38.')).toBeVisible();
      await card.screenshot({ path: `test-results/layout-screens/location-card-notes-${size.width}.png` });
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}

// The trail and reading ahead (plan scene-point-to-point B2; p2p-8, p2p-9; page 23, LA2 to LA4, approved 2026-11-18;
// the driver's ruling "A", 2026-11-19), at the jetty with the places typed as the rulings name them
// (`?placePage=spot&session=running&kinds=p2p`: the island a Region, the harbour an Area, its spots Locations, one of
// them named at length). Purpose, in plain words: the Region in the trail is plain words; a tap on the Area opens the
// Locations panel, the Area's row first, then the party's own row (marked, washed, no tap), then each Location; every
// row that opens is at least 44 px; the long name wraps and its line stays on one line, cut; a Location opened from it
// is read ahead, the line at the very top of the card ("Reading ahead. The party is at 1. The jetty."), "Back to the
// party" at its right on a tablet and in the fixed bar on a phone (at Move on's height), no Move on anywhere; a tap on an
// eye opens the pop-up that says the party isn't here; nothing scrolls sideways, and axe finds no serious problem.
for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  test.describe(`the trail's panel and reading ahead (${size.name}, ${size.width} px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test('the Locations panel, then a Location read ahead', async ({ page }) => {
      test.setTimeout(60_000);
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
      await page.goto('/layout.html?as=gm&placePage=spot&session=running&kinds=p2p');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      await expect(page.getByRole('heading', { name: '1. The jetty' })).toBeVisible();
      const trail = page.getByRole('navigation', { name: 'Where it sits' });
      await expect(trail.getByText('Saltwick Island')).toBeVisible();
      await expect(trail.getByRole('button', { name: 'Saltwick Island' })).toHaveCount(0);
      await trail.getByRole('button', { name: 'The Drowned Harbour' }).click();

      // The panel (LA2).
      const panel = page.getByRole('dialog', { name: 'The Drowned Harbour: Locations' });
      await expect(panel).toBeVisible();
      const long = panel.locator('.list-row').filter({ hasText: 'Landing Stage' });
      await expect(long.locator('.list-row__sub')).toHaveText(/^Worn steps down into the water/);
      const titles = await panel.locator('.list-row__title').allTextContents();
      expect(titles.slice(0, 3)).toEqual(['The Drowned Harbour', '1. The jetty', '2. The wreck']);
      const here = panel.locator('.place-page__panel-here');
      await expect(here.getByText('The party is here.')).toBeVisible();
      await expect(here.getByRole('button')).toHaveCount(0);
      // The long name wraps; its line is one line, cut with "…".
      const [title, sub] = await Promise.all([long.locator('.list-row__title').boundingBox(), long.locator('.list-row__sub').boundingBox()]);
      if (!title || !sub) throw new Error('not drawn');
      const lineHeight = await long.locator('.list-row__sub').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height);
      expect(Math.round(sub.height)).toBeLessThanOrEqual(Math.ceil(lineHeight) + 1);
      expect(await long.locator('.list-row__sub').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      expect(title.height).toBeGreaterThan(sub.height * 1.5);
      for (const box of await panel.locator('.list-row__body').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(Math.round(box)).toBeGreaterThanOrEqual(44);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await page.screenshot({ path: `test-results/layout-screens/place-panel-${size.width}.png` });

      // Reading ahead at the breakwater (LA3, LA4 A).
      await panel.getByRole('button', { name: /^3\. The breakwater/ }).click();
      await expect(page.getByRole('heading', { name: '3. The breakwater' })).toBeVisible();
      const card = page.locator('.place-page__card');
      const line = card.locator('.place-page__ahead');
      await expect(line.getByRole('status')).toHaveText('Reading ahead. The party is at 1. The jetty.');
      await expect(page.getByRole('button', { name: 'Move on' })).toHaveCount(0);
      const back = page.getByRole('button', { name: 'Back to the party' });
      await expect(back).toHaveCount(1);
      const [lineBox, trailBox, backBox] = await Promise.all([line.boundingBox(), card.getByRole('navigation', { name: 'Where it sits' }).boundingBox(), back.boundingBox()]);
      if (!lineBox || !trailBox || !backBox) throw new Error('not drawn');
      expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(trailBox.y + 1);
      if (size.name === 'phone') {
        await expect(page.locator('.place-page__bar').getByRole('button', { name: 'Back to the party' })).toBeVisible();
        expect(Math.round(backBox.height)).toBeGreaterThanOrEqual(48);
      } else {
        await expect(line.getByRole('button', { name: 'Back to the party' })).toBeVisible();
        expect(backBox.x + backBox.width).toBeLessThanOrEqual(lineBox.x + lineBox.width + 0.5);
        expect(Math.round(backBox.height)).toBeGreaterThanOrEqual(44);
      }
      await expect(card.getByText('0 of 3 shown')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
      await page.screenshot({ path: `test-results/layout-screens/reading-ahead-${size.width}.png`, fullPage: true });

      // A tap on an eye explains (the driver's ruling "A").
      await card.getByRole('button', { name: 'Show players' }).first().click();
      const why = page.getByRole('dialog', { name: "The party isn't here" });
      await expect(why).toBeVisible();
      await expect(why.getByText("You're reading ahead. Show and change what is here once the party arrives.")).toBeVisible();
      // On a phone the sheet slides up from the bottom: the picture waits for it to stop moving (two reads 100 ms apart
      // agree; the page's own endless glows rule out waiting on every animation).
      await expect
        .poll(async () => {
          const a = await why.boundingBox();
          await page.waitForTimeout(100);
          const b = await why.boundingBox();
          return !!a && !!b && a.y === b.y;
        })
        .toBe(true);
      await page.screenshot({ path: `test-results/layout-screens/reading-ahead-eye-${size.width}.png` });
      await why.getByRole('button', { name: /Close/ }).click();

      // Back to the party.
      await back.click();
      await expect(page.getByRole('heading', { name: '1. The jetty' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Move on' })).toHaveCount(1);
    });
  });
}

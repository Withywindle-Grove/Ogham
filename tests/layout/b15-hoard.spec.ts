// B15's built screens beside page 30 (HM1 to HM5, approved by Francis 2026-11-20), on the layout page's invented wreck
// (`layout.html?as=gm&placePage=wreck`, with `&b15=sent` or `&b15=shown`; src/testing/layoutHarness.tsx), in a real
// browser at 1024 px and 375 px, light and dark. Test pictures only (Francis, 2026-11-21): each test saves its screen
// under test-results/layout-screens/b15-*.png, to be set beside the approved frame. Purposes, in plain words:
//   HM1. The GM's place card at the wreck shows the Strongbox in the book's words with an arrow that opens it, and the
//        Lantern of the Drowned as its own piece, both hidden.
//   HM2. A tap on the Strongbox opens its hoard: the book's line, a row a thing with its count (coin a row like any
//        other), Send all.
//   HM3. Once the hoard is sent to Wren, the GM's eye on the lantern's piece shows it and says so in a toast.
//   HM4. Wren's player, once the piece is shown, reads the lantern by its real name on the Pack and in its sheet.
//   HM5. The hoard after everything is sent (to Wren, Ash and the party stash): each row says where it went, and Send
//        all is gone.
// Each: nothing scrolls sideways, no tap target under 44 px, no text under 14 px (layoutProblems).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const NAME = 'Lantern of the Drowned';

async function open(page: Page, scheme: 'light' | 'dark', who: 'gm' | 'player', b15: '' | 'sent' | 'shown') {
  await page.emulateMedia({ colorScheme: scheme });
  // The campaign menu folded to its rail, as stored (mn-1), as the place page's other checks open it.
  await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'yes'));
  await page.goto(`/layout.html?as=${who}&placePage=wreck&session=running${b15 ? `&b15=${b15}` : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
}

async function openCard(page: Page, scheme: 'light' | 'dark', b15: '' | 'sent' | 'shown') {
  await open(page, scheme, 'gm', b15);
  await expect(page.locator('.place-page__name')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Strongbox\. / })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** The screen as a person sees it (the window, not the whole page: the fixed bars stay in place), `focus` in its middle. */
async function shot(page: Page, frame: string, width: number, scheme: string, focus?: Locator) {
  if (focus) await focus.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `test-results/layout-screens/b15-${frame}-${width}-${scheme}.png` });
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`B15 (${size.name}, ${size.width} px, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      // Purpose: HM1, the card with the hoard as one piece that opens, and the magic item's truth as its own piece.
      test('HM1: the card shows the Strongbox and the lantern’s truth, both hidden', async ({ page }) => {
        await openCard(page, scheme, '');
        const truth = page.locator('.place-page__piece').filter({ hasText: NAME });
        await expect(truth).toHaveCount(1);
        await expect(truth.getByRole('button', { name: 'Show players' })).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'hm1', size.width, scheme, truth);
      });

      // Purpose: HM2, the hoard's sheet: its things with their counts and one Send all.
      test('HM2: a tap on the Strongbox opens its hoard with counts and Send all', async ({ page }) => {
        await openCard(page, scheme, '');
        await page.getByRole('button', { name: /^Strongbox\. / }).click();
        await expect(page.getByRole('button', { name: 'Send all' })).toBeVisible();
        await expect(page.getByText('240 herons', { exact: true })).toBeVisible();
        await expect(page.getByText('Moon opals ×2')).toBeVisible();
        await expect(page.getByText('Swords ×4')).toBeVisible();
        await expect(page.getByText('Daggers ×5')).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'hm2', size.width, scheme);
      });

      // Purpose: HM3, the GM's eye on the lantern's piece, after the hoard went to Wren, shows it with a toast.
      test('HM3: the eye on the lantern’s piece shows it and says so', async ({ page }) => {
        await openCard(page, scheme, 'sent');
        const truth = page.locator('.place-page__piece').filter({ hasText: NAME });
        await truth.getByRole('button', { name: 'Show players' }).click();
        await expect(page.getByText(/Shown to the players: Lantern of the Drowned/)).toBeVisible();
        await expect(truth.getByRole('button', { name: 'Hide from players' })).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'hm3', size.width, scheme, truth);
      });

      // Purpose: HM4, the player who holds the lantern reads its real name and what it does, once shown.
      test('HM4: Wren’s player reads the lantern by its real name', async ({ page }) => {
        await open(page, scheme, 'player', 'shown');
        await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
        await expect(page.getByText(NAME).first()).toBeVisible();
        await expect(page.getByText('Hooded lantern')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'hm4-pack', size.width, scheme);
        await page.getByText(NAME).first().click();
        await expect(page.getByText(/burns no oil/).first()).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'hm4-sheet', size.width, scheme);
      });

      // Purpose: HM5, the hoard after everything was sent: each row says where it went, and there is no Send all.
      test('HM5: the hoard once all is sent says where each thing went', async ({ page }) => {
        await openCard(page, scheme, 'sent');
        await page.getByRole('button', { name: /^Strongbox\. / }).click();
        await expect(page.getByText(/Sent to Wren of the Lantern Wardens/).first()).toBeVisible();
        await expect(page.getByText('Sent to Ash').first()).toBeVisible();
        await expect(page.getByText('In the party stash').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Send all' })).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        await shot(page, 'hm5', size.width, scheme);
      });

      // Purpose (impeccable audit 7, Francis picked 2026-11-24): the card and the hoard's sheet name the Location as
      // page 30 draws it, "2. The Wreck", not "2. The wreck".
      test('the Location is named "The Wreck", as page 30 draws it', async ({ page }) => {
        await openCard(page, scheme, '');
        await expect(page.locator('.place-page__name')).toHaveText('2. The Wreck');
      });

      // Purpose (impeccable audit 1, Francis picked 2026-11-24): Escape closes the hoard's sheet and puts focus back on
      // the Strongbox piece that opened it, so a keyboard user carries on where they were.
      test('Escape closes the hoard and puts focus back on the Strongbox', async ({ page }) => {
        await openCard(page, scheme, '');
        const box = page.locator('.place-page__piece-words').filter({ hasText: 'Strongbox.' });
        await box.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Send all' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Send all' })).toHaveCount(0);
        await expect(box).toBeFocused();
      });

      // Purpose (impeccable audit 6, Francis picked 2026-11-24): a focused row of the hoard's sheet wears the whole
      // focus ring, its four sides inside the sheet, not two full-width rules with the sides cut off.
      test('a focused row of the hoard wears the whole focus ring', async ({ page }) => {
        await openCard(page, scheme, '');
        // By the keyboard, as the ring is for: the sheet opens with focus on its first row.
        await page.locator('.place-page__piece-words').filter({ hasText: 'Strongbox.' }).focus();
        await page.keyboard.press('Enter');
        const row = page.locator('.hoard-sheet .list-row__body').first();
        await expect(row).toBeFocused();
        const ring = await row.evaluate((el) => {
          const style = getComputedStyle(el);
          const width = parseFloat(style.outlineWidth);
          const out = width + parseFloat(style.outlineOffset);
          const box = el.getBoundingClientRect();
          // The nearest box that clips (the sheet's scrolling body): the ring must fit inside its padding box.
          let clip = el.parentElement;
          while (clip && getComputedStyle(clip).overflowY === 'visible' && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
          const c = clip!.getBoundingClientRect();
          const inner = { left: c.left + clip!.clientLeft, right: c.left + clip!.clientLeft + clip!.clientWidth };
          return { style: style.outlineStyle, width, left: box.left - out >= inner.left, right: box.right + out <= inner.right };
        });
        expect(ring).toEqual({ style: 'solid', width: expect.any(Number), left: true, right: true });
        expect(ring.width).toBeGreaterThanOrEqual(2);
      });
    });
  }
}

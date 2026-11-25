// A player's tap on a fact (plan dec-9-the-players-scene P10; page 18, PL8) and the players' map (P5; 01-08, 01-08c,
// PL1, PL5b), in a real browser on the layout page's invented harbour. What it checks, in plain words:
//   * the Encounter check's and the Light fact's pop-ups: their labelled lines in the book's faces, nothing cut or
//     scrolling sideways, every tap 44 px, axe content; the Light pop-up's "Light" button at its foot's right, on the
//     card's inner edge as every pop-up's foot buttons; "Which light?" a step inside the same pop-up (Back, Escape
//     back, one ✕), and focus back on the Light fact once lit, by keyboard;
//   * the shared map: first in the right column (under the left one on a phone), its picture and its title, no tools
//     cut, the pop-up opening on a tap;
//   * at 375, 834 and 1024 px, in light and dark. Each test saves its picture.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openHarbour(page: Page, map: boolean, several = false) {
  await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
  await page.goto(`/layout.html?as=player&placePage=spots&session=running${map ? '&map=shown' : ''}${several ? '&lights=several' : ''}`);
  await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  await expect(page.getByRole('group', { name: 'Scene facts' })).toBeVisible();
}

for (const width of [375, 834, 1024] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`a player's facts and map (${width} px, ${scheme})`, () => {
      test.use({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: 'reduce' });

      // Purpose (PL8): the Encounter check opens its pop-up with "When." and "Chance." as the book's labelled lines,
      // and nothing in it is cut or scrolls sideways.
      test('the Encounter check pop-up', async ({ page }) => {
        await openHarbour(page, false);
        await page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Encounter check:/ }).click();
        const pop = page.getByRole('dialog', { name: 'Encounter check' });
        await expect(pop.getByText('When.')).toBeVisible();
        await expect(pop.getByText('Chance.')).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-fact-check-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL8): the Light fact opens its pop-up with the group's light as a labelled line.
      test('the Light pop-up', async ({ page }) => {
        await openHarbour(page, false);
        const light = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:/ });
        test.skip((await light.count()) === 0, 'no Light fact on this page');
        await light.click();
        await expect(page.getByRole('dialog', { name: 'Light' }).locator('.book-label').first()).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-fact-light-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (PL8): the Light pop-up ends with the player's "Light" button (the torch over the word) at the right, a
      // 44 px target, nothing cut; with several lights it turns the same card to the pick (the next test).
      test('the Light pop-up’s Light button', async ({ page }) => {
        await openHarbour(page, false);
        const light = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:/ });
        await light.click();
        const pop = page.getByRole('dialog', { name: 'Light' });
        const button = pop.getByRole('button', { name: 'Light', exact: true });
        await expect(button).toBeVisible();
        const box = (await button.boundingBox())!;
        const card = (await pop.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        // At the foot's right, as PL8 draws it: its right edge on the card's inner edge, where every pop-up's foot
        // buttons end (the card's right less its padding).
        const inner = await pop.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight) + parseFloat(getComputedStyle(el).borderRightWidth));
        expect(Math.abs(card.x + card.width - inner - (box.x + box.width))).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `test-results/layout-screens/players-fact-light-button-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (the audit of #86, picks 1 and 3, by keyboard): with several lights, Light turns the same pop-up to the
      // step "Which light?" (one card, one ✕, Back, the pop-up's own faces), focus on its first light; Escape goes back
      // with focus on Light; a pick lights it, the pop-up closes, and focus is back on the Light fact naming the light.
      test('the Light pop-up’s pick step, by keyboard', async ({ page }) => {
        await openHarbour(page, false, true);
        const fact = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:/ });
        await fact.focus();
        await page.keyboard.press('Enter');
        const pop = page.getByRole('dialog', { name: 'Light' });
        await expect(pop.getByRole('button', { name: 'Light', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        const pick = page.getByRole('dialog', { name: 'Which light?' });
        await expect(pick.getByRole('button', { name: /^Rushlights/ })).toBeFocused();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(pick.getByRole('button', { name: 'Close' })).toHaveCount(1);
        expect((await pick.getByRole('button', { name: 'Back' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await pick.evaluate((el) => el.closest('.dialog__backdrop')?.classList.contains('book-faces'))).toBe(true);
        for (const option of await pick.getByRole('button', { name: /^(Rushlights|Reed lamps)/ }).all()) expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `test-results/layout-screens/players-fact-light-pick-${width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(pop.getByRole('button', { name: 'Light', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:.*rushlight/i })).toBeFocused();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `test-results/layout-screens/players-fact-light-lit-${width}-${scheme}.png` });
      });

      // Purpose (pick 1, by keyboard): with one light, Enter on Light lights it, the pop-up closes, and focus is back on
      // the Light fact, which names the lit light.
      test('focus back on the Light fact once lit', async ({ page }) => {
        await openHarbour(page, false);
        const fact = page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:/ });
        await fact.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog', { name: 'Light' }).getByRole('button', { name: 'Light', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByText('Lit a rushlight.')).toBeVisible();
        await expect(page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Light:.*rushlight/i })).toBeFocused();
      });

      // Purpose (P5; PL1, PL5b): the shared map stands first in the right column with its picture and title; a tap on
      // it opens the pop-up.
      test('the shared map', async ({ page }) => {
        await openHarbour(page, true);
        const right = page.locator('.players-page__column[data-column="right"]');
        const map = right.getByRole('region', { name: 'The map' });
        await expect(map.locator('img')).toBeVisible();
        await expect(map.locator('.map-tools > .map-tools__title')).toHaveText('The Drowned Harbour, the harbour chart');
        expect(await right.locator('> *').first().locator('.map-card').count()).toBe(1);
        await map.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/layout-screens/players-map-${width}-${scheme}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await map.locator('img').click();
        await expect(page.getByRole('dialog', { name: /The map/ })).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/players-map-open-${width}-${scheme}.png` });
      });
    });
  }
}

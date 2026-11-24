// The harness world that reaches every step of guided creation (?as=new&creation=full; row test-creation-world), and
// the harness's send and slow flags, in a real browser on a phone (375 px). Test tooling: no screen changes here.
// Purposes, in plain words:
//   1. In the new world, guided creation walks every step a setting can give, in order, and each step's heading shows:
//      Method, Scores, Kindred, Class, Patron, Adjust scores, Who they are (with the hit points row and Roll for a name
//      from the kindred's name table), First spells, Gear (with the given gear's pick sheet and the kindred's trinket
//      sheet), Languages, Weapon skills, the kindred's backgrounds, Details (with a table sheet of its own), and the
//      review.
//   2. With &send=refuse, Send to the GM on the review comes back refused while online: the "Not sent" sheet opens and
//      the foot says it couldn't send, not that the device is offline.
//   3. With &send=offline, the same send fails as a dropped connection does: the "Not sent" sheet opens and the foot
//      says the device is offline.
//   4. With &slow=1, the database's answers wait long enough that creation's loading state shows its line (the
//      review's "Opening the review…", whose loads are never kept from earlier), and the walk still reaches the review.
// Every name is invented (hard rule 2).
import { expect, test, type Page } from '@playwright/test';

/** Couldn't send / offline: the review's foot after a send that didn't go (CreationReview.tsx). */
const SEND_FAILED = "Couldn't send it to your GM. Nothing is lost.";
const SEND_OFFLINE = "You're offline. Nothing is saved until you're back: keep this screen open, then try again.";

const h1 = (page: Page) => page.getByRole('heading', { level: 1 }).first();
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click();

/**
 * A pick on a one-of-many step moves to the next step at once, with an Undo toast (ct-1): the one thing the app
 * guarantees, so there is no Next tap and no fixed wait. `then` is the heading of the step it leads to.
 */
async function pick(page: Page, name: string, then: string | RegExp) {
  await page.getByRole('checkbox', { name: `Pick ${name}` }).click();
  await expect(h1(page)).toHaveText(then);
}

/** Opens a sheet by its button, checks it shows under its name, and closes it. */
async function openSheet(page: Page, button: RegExp, sheet: RegExp) {
  await page.getByRole('button', { name: button }).click();
  const dialog = page.getByRole('dialog', { name: sheet });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** From the campaign list to the review, through every step; each step's heading checked as it opens. */
async function walkToReview(page: Page, { slow = false } = {}) {
  await page.getByRole('button', { name: /The Fen Census/ }).click();
  await page.getByRole('button', { name: 'Create your character' }).click();
  await page.getByRole('button', { name: /^Guided/ }).click();

  // Method: each player chooses.
  await expect(h1(page)).toHaveText('How do you want to build?');
  // Method is a pick that waits for Next; it is not one of the one-of-many steps that move on by themselves.
  await page.getByRole('checkbox', { name: 'Pick Kindred, then calling' }).click();
  await next(page);
  await expect(h1(page)).toHaveText(/^Scores/);

  // Scores: a Lore for the Reed Witch, a Wit giving one extra language.
  await expect(h1(page)).toHaveText(/^Scores/);
  await page.getByLabel('Wit', { exact: true }).fill('10');
  await page.getByLabel('Lore', { exact: true }).fill('13');
  await next(page);

  await expect(h1(page)).toHaveText('Kindred');
  await pick(page, 'Stone kin', 'Class');
  await expect(h1(page)).toHaveText('Class');
  await pick(page, 'Reed Witch', 'Patron');
  await expect(h1(page)).toHaveText('Patron');
  // Patron: the pick stays on the step with an Undo toast, and Next moves on.
  await page.getByRole('checkbox', { name: 'Pick The Drowned Lamp' }).click();
  await next(page);
  await expect(h1(page)).toHaveText('Adjust scores');
  await next(page);

  // Who they are: the hit points row, and Roll for a name opening the kindred's name table.
  await expect(h1(page)).toHaveText('Who they are');
  await expect(page.getByRole('button', { name: 'Raise Hit points' })).toBeVisible();
  await openSheet(page, /^Roll for a name$/, /^Stone kin names$/);
  await page.getByLabel('Name', { exact: true }).fill('Tam');
  await page.getByRole('checkbox', { name: 'Pick Reed' }).click();
  await next(page);

  // First spells: two from the list, one rolled from the table (its row tapped), two of level 0.
  await expect(h1(page)).toHaveText('First spells');
  await page.getByRole('checkbox', { name: 'Pick Reed whisper' }).click();
  await page.getByRole('checkbox', { name: 'Pick Mire grip' }).click();
  await page.getByRole('radio', { name: /Damp wick/ }).click();
  await page.getByRole('checkbox', { name: 'Pick Frog chorus' }).click();
  await page.getByRole('checkbox', { name: 'Pick Dry boots' }).click();
  await next(page);

  // Gear: the given gear's pick sheet and the trinket (keepsake) sheet.
  await expect(h1(page)).toHaveText('Gear');
  await openSheet(page, /^Open Odds and ends/, /^Odds and ends: pick up to 2$/);
  await openSheet(page, /^Open Trinket/, /^Trinket$/);
  await next(page);

  await expect(h1(page)).toHaveText('Languages');
  await page.getByRole('checkbox', { name: 'Pick Reedspeak' }).click();
  await next(page);

  await expect(h1(page)).toHaveText('Weapon skills');
  await page.getByRole('checkbox', { name: 'Pick Eel knife' }).click();
  await next(page);

  await expect(h1(page)).toHaveText('Stone kin backgrounds');
  // A rolled book that stays on its step until Next (not one of the one-of-many steps).
  await page.getByRole('checkbox', { name: 'Pick 1–2: Causeway mason' }).click();
  await next(page);
  await expect(h1(page)).toHaveText('Details');

  // Details: one of its tables as a sheet.
  await expect(h1(page)).toHaveText('Details');
  await openSheet(page, /^Open Looks/, /Looks/);
  await next(page);
  // With &slow=1 the review's four loads each wait 600 ms: past 300 ms, its loading line shows first.
  if (slow) await expect(page.locator('.creation-loading__line')).toHaveText('Opening the review…');

  // The review, named after the character, with Send to the GM.
  await expect(h1(page)).toHaveText('Tam');
  await expect(page.getByRole('button', { name: 'Send to the GM' })).toBeVisible();
}

test.describe('the creation world (?creation=full) and the send and slow flags', () => {
  test.setTimeout(120_000);
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('guided creation reaches every step, each with its heading', async ({ page }) => {
    await page.goto('/layout.html?as=new&creation=full');
    await walkToReview(page);
  });

  for (const [flag, foot, notFoot] of [
    ['refuse', SEND_FAILED, SEND_OFFLINE],
    ['offline', SEND_OFFLINE, SEND_FAILED],
  ] as const) {
    test(`send=${flag}: the review shows its own not-sent state`, async ({ page }) => {
      await page.goto(`/layout.html?as=new&creation=full&send=${flag}`);
      await walkToReview(page);
      await page.getByRole('button', { name: 'Send to the GM' }).click();
      const sheet = page.getByRole('dialog', { name: 'Not sent' });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Try again' })).toBeVisible();
      await sheet.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      // Still on the review, its foot saying why.
      await expect(h1(page)).toHaveText('Tam');
      await expect(page.getByText(foot)).toBeVisible();
      await expect(page.getByText(notFoot)).toHaveCount(0);
    });
  }

  test('slow=1: creation shows its loading line', async ({ page }) => {
    test.setTimeout(50_000); // about twice its measured run (23.5 s)
    await page.goto('/layout.html?as=new&creation=full&slow=1');
    await walkToReview(page, { slow: true });
  });
});

// The key journeys (docs/06 "Key journeys", ruled 2026-10-25): each one clicked through in a real browser, counting
// taps and screen changes against its budget. A change that goes over budget fails the build. Journeys whose screens
// aren't built yet are written as pending (test.fixme) with their budgets, and switch on when those screens land:
// remove the fixme and fill in the steps.
//   A tap is any click or selection the person makes; typing isn't counted.
//   A screen change is the page's main heading (h1) changing; a sheet or dialog over the page isn't one.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { departStart } from './depart.ts';

interface Budget {
  taps: number;
  screens: number;
}

/** Counts a journey's taps and screen changes. */
class Journey {
  taps = 0;
  screens = 0;
  private screen = '';
  constructor(private readonly page: Page) {}

  private async heading(): Promise<string> {
    return this.page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '');
  }

  /** Where the journey starts: taps to get here aren't counted. */
  async start() {
    this.screen = await this.heading();
  }

  private async after() {
    this.taps += 1;
    await this.page.waitForTimeout(50);
    const now = await this.heading();
    if (now !== this.screen) {
      this.screens += 1;
      this.screen = now;
    }
  }

  async tap(target: Locator) {
    await target.click();
    await this.after();
  }

  async pick(select: Locator, label: string) {
    await select.selectOption({ label });
    await this.after();
  }

  expectWithin(budget: Budget) {
    expect.soft(this.taps, `taps (budget ${budget.taps})`).toBeLessThanOrEqual(budget.taps);
    expect(this.screens, `screen changes (budget ${budget.screens})`).toBeLessThanOrEqual(budget.screens);
  }
}

const campaignRow = (page: Page) => page.getByRole('button', { name: /The Drowned Marches/ });

async function playerScreen(page: Page) {
  await page.goto('/layout.html?as=player');
  await campaignRow(page).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens' }).first()).toBeVisible();
}

/**
 * The GM's Scene tab (the console's Explore): the GM's campaign opens on it (ruled 2026-10-29), no tap needed. A new
 * campaign's band reads "No session yet" (st-2); `session` starts one first (S9: Next turn needs a session running).
 */
async function gmScene(page: Page, session = false) {
  await page.goto('/layout.html?as=gm');
  await campaignRow(page).click();
  await expect(page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: 'Scene' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'No session yet' })).toBeVisible();
  if (session) {
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page.getByRole('button', { name: 'Start session' })).toHaveCount(0);
  }
}

async function pack(page: Page) {
  await playerScreen(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toBeVisible();
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  test.describe(`key journeys (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('1. Start a session (GM): 1 tap, 0 screen changes', async ({ page }) => {
      // Start session on the GM console (ruled 2026-10-29, D20; no "Time since last session?" question).
      await gmScene(page);
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: 'Start session' }));
      // The band's session line names it (S1; on a phone the top bar names the campaign and the line is hidden, T8a).
      await expect(page.getByRole('button', { name: 'Start session' })).toHaveCount(0);
      if (size.name !== 'phone') await expect(page.getByText('Session 1.')).toBeVisible();
      journey.expectWithin({ taps: 1, screens: 0 });
    });

    test('2. Turn, nothing due (GM): 1 tap, 0 screen changes', async ({ page }) => {
      // Next turn (the fallback Dungeon mode has no checks, so nothing falls due).
      await gmScene(page, true);
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeVisible();
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: 'Next turn' }));
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
      journey.expectWithin({ taps: 1, screens: 0 });
    });

    test('3. Turn, a check due (GM): 3 taps, 0 screen changes', async ({ page }) => {
      // Next turn → a modifier → outcome on the reminder card (M5 step 6; ruled 2026-10-29: the ±1 chips sit on the
      // check's line, one tap). The harness's GM reminder is a check every 2 turns, so the second turn brings it.
      await gmScene(page, true);
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: 'Next turn' }));
      const due = page.getByRole('region', { name: 'Due' });
      await journey.tap(due.getByRole('button', { name: '+1 face, Wandering check' }));
      await expect(due.getByText('Roll 1d6, on 1–2')).toBeVisible();
      await journey.tap(due.getByRole('button', { name: 'Miss, Wandering check' }));
      await expect(page.getByText('Wandering check: a miss, next at turn 5')).toBeVisible();
      journey.expectWithin({ taps: 3, screens: 0 });
    });

    test.fixme('4. Take damage (player): 2 taps, 0 screen changes', async () => {
      // The HP sheet with quick chips (component patterns 1): HP → chip (applies at once, Undo toast);
      // typed: HP → digits → "Take N damage".
    });

    test('5. Light a torch (player): 1–2 taps, 0 screen changes', async ({ page }) => {
      // Light (→ pick if more than one light; M5 step 7). Wren carries one light, rushlights, so it's one tap: the
      // light's ring over "Light", in At hand (lt-2, lt-4; page 35).
      await playerScreen(page);
      const journey = new Journey(page);
      await journey.start();
      const atHand = page.getByRole('region', { name: 'At hand' });
      await journey.tap(atHand.getByRole('button', { name: /^Light / }));
      // Once lit, the light sits in At hand with no Light heading (dec-13 C9, frames P1 and P2), its line there.
      await expect(page.getByRole('region', { name: 'At hand' }).locator('.light-block--at-hand').getByText('Lit, 6 turns left')).toBeVisible();
      await expect(page.getByText('Lit a rushlight.')).toBeVisible();
      journey.expectWithin({ taps: 2, screens: 0 });
    });

    test('6a. Give a single item (player): 4 taps, 1 screen change', async ({ page }) => {
      await pack(page);
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: /^Chalk/ }));
      await journey.tap(page.getByRole('button', { name: 'Give to…' }));
      // The Party stash is first and chosen (ruled 2026-10-23), so choosing the person is already done.
      await journey.tap(page.getByRole('dialog', { name: 'Give Chalk' }).getByRole('button', { name: 'Give to Party stash' }));
      // It's left the pack; the Pack's Party stash row (K11) counts one more.
      await expect(page.getByRole('button', { name: /^Chalk/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Party stash/ })).toContainText('2 things');
      journey.expectWithin({ taps: 4, screens: 1 });
    });

    test('6b. Give part of a stack (player): 5 taps, 1 screen change', async ({ page }) => {
      await pack(page);
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: /^Reed arrows/ }));
      await journey.tap(page.getByRole('button', { name: 'Give to…' }));
      const give = page.getByRole('dialog', { name: 'Give Reed arrows' });
      await journey.tap(give.getByRole('button', { name: 'Less how many' }));
      await journey.tap(give.getByRole('radio', { name: /^Party stash/ }));
      await journey.tap(give.getByRole('button', { name: 'Give 17 to Party stash' }));
      await expect(page.getByText('Gave Reed arrows ×17 to Party stash')).toBeVisible();
      journey.expectWithin({ taps: 5, screens: 1 });
    });

    test.fixme('7. Do an activity (GM): 4 taps, 0 screen changes', async () => {
      // M5b, day modes only (Act… in turn modes is in the parking lot, DG12): activity → who → outcome.
    });

    test('8. Write a log note (anyone): 3 taps plus typing, 0 screen changes', async ({ page }) => {
      await playerScreen(page);
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: 'Log', exact: true }));
      await journey.tap(page.getByRole('button', { name: 'Write a note' }));
      await page.getByLabel('Note', { exact: true }).fill('The ferryman wanted two rations.');
      await journey.tap(page.getByRole('button', { name: 'Save note' }));
      await expect(page.getByText('The ferryman wanted two rations.').first()).toBeVisible();
      journey.expectWithin({ taps: 3, screens: 0 });
    });

    test.fixme('9. Show a picture (GM): 2 taps, 0 screen changes', async () => {
      // M8b, with Handouts (D26): Send → Send.
    });

    test('10. End the expedition with a full rest (GM): 3 taps, 0 screen changes', async ({ page }) => {
      // ⋯ → End expedition (summary with Undo, no confirm) → Full rest (ruled 2026-10-29, D22). No dungeon-exit
      // rule here, so no escape rolls (they arrive in M5 step 12).
      await gmScene(page, true);
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
      const journey = new Journey(page);
      await journey.start();
      await journey.tap(page.getByRole('button', { name: 'Time options' }));
      await journey.tap(page.getByRole('button', { name: 'End expedition' }));
      // The card's line, not the toast's "Expedition ended. Took 10 minutes." (S19).
      await expect(page.getByText('Took 10 minutes.', { exact: true })).toBeVisible();
      await journey.tap(page.getByRole('button', { name: 'Full rest' }));
      await expect(page.getByText('Rest and day abilities are back.')).toBeVisible();
      journey.expectWithin({ taps: 3, screens: 0 });
    });

    // M5 step 11, places per group (plain tests, not numbered journeys). The GM and the player can't share one page's
    // fake world, so the two sides are tested apart: the GM's side clicked through from Start expedition, and the
    // player's side on a seeded expedition whose place is already shown.
    test('Places: the GM starts at a typed place and shows players (375 px phone, tablet)', async ({ page }) => {
      await gmScene(page, true);
      // Through the picker (pull request 2): Where? opens it; Other… takes a typed name.
      await page.getByRole('button', { name: 'Depart' }).click();
      await page.getByRole('button', { name: /^Where\?:/ }).click();
      await page.getByRole('button', { name: /^Other…/ }).click();
      await page.getByRole('textbox', { name: "A place that isn't listed" }).fill('The Moth Gallery');
      await page.getByRole('button', { name: 'Set place' }).click();
      await departStart(page);
      await expect(page.getByRole('heading', { name: 'The Moth Gallery' }).first()).toBeVisible();
      // B16: no "Only you see this" on the GM's card.
      await expect(page.getByText('Only you see this')).toHaveCount(0);
      // M5b g2 (B1): a place is pieces. + Piece alone at first; add one, then show it with its eye button.
      await page.getByRole('button', { name: '+ Piece' }).click();
      await page.getByLabel('What players will see').fill('A low vaulted hall, knee-deep in black water');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('0 of 1 shown')).toBeVisible();
      const eye = page.getByRole('button', { name: 'Show players' });
      const box = await eye.boundingBox();
      expect(box && Math.round(box.width) >= 44 && Math.round(box.height) >= 44).toBe(true);
      await eye.click();
      await expect(page.getByRole('button', { name: 'Hide from players' })).toBeVisible();
      await expect(page.getByText('1 of 1 shown')).toBeVisible();
    });

    test('Places: a player sees the place the GM has shown on Scene (375 px phone, tablet)', async ({ page }) => {
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Lantern Hall/ }).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      const where = page.getByRole('region', { name: 'Where you are' });
      await expect(where.getByRole('heading', { name: 'The Moth Gallery' })).toBeVisible();
      await expect(where.getByText('Dusty frames line the walls and a draught stirs the cobwebs.')).toBeVisible();
      await expect(where.getByText('A narrow stair down, to the west')).toBeVisible();
      // The GM's notes and a hidden piece never reach the player.
      await expect(page.getByText('A loose flagstone.')).toHaveCount(0);
      await expect(page.getByText('Moth wings swept into one corner')).toHaveCount(0);
    });

    test('Combined GM turn: 2 taps on a miss, 4 on a hit', async ({ page }) => {
      // Re-budgeted 2026-10-30 (06, Key journeys): Next turn (1) + the check's Hit or Miss (1) + on a hit the
      // table pick and row (2), on the Explore screen, never leaving it. No activity: Act… left turn modes (DG12).
      // M5b step 2: the hit queues its Encounter waiting card by itself (no extra tap). With ?tables=1 the harness's
      // wandering check names a table, so it's the likely one at the top of Which table?.
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
      const miss = new Journey(page);
      await miss.start();
      await miss.tap(page.getByRole('button', { name: 'Next turn' }));
      await miss.tap(page.getByRole('region', { name: 'Due' }).getByRole('button', { name: 'Miss, Wandering check' }));
      await expect(page.getByText('Wandering check: a miss, next at turn 5')).toBeVisible();
      miss.expectWithin({ taps: 2, screens: 0 });

      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 4' })).toBeVisible();
      const hit = new Journey(page);
      await hit.start();
      await hit.tap(page.getByRole('button', { name: 'Next turn' }));
      // Since S8b the check is a row of "Waiting for you" (its one button is Hit), the reminder's card the open item.
      await hit.tap(page.getByRole('region', { name: 'Waiting for you' }).getByRole('button', { name: 'Hit, Wandering check' }));
      await hit.tap(page.getByRole('dialog', { name: 'Wandering check, Hit' }).getByRole('button', { name: /^Mortal/ }));
      await hit.tap(page.getByRole('dialog', { name: 'Mortal' }).getByRole('radio', { name: /Pilgrims lost/ }));
      await expect(page.getByText(/^Rolled: 1–4, Pilgrims lost/)).toBeVisible();
      hit.expectWithin({ taps: 4, screens: 0 });
      await page.getByRole('dialog', { name: 'Mortal' }).getByRole('button', { name: 'Back' }).click();
      await page.getByRole('dialog', { name: 'Wandering check, Hit' }).getByRole('button', { name: 'Close' }).click();
      // Since sf-4 one encounter is one card: the panel's open card is "An encounter", reading the picked row's words.
      const waiting = page.getByRole('region', { name: 'Waiting for you' });
      await expect(waiting.getByRole('heading', { name: 'An encounter' })).toBeVisible();
      await expect(waiting.locator('.waiting-encounter__line')).toHaveText(/Pilgrims lost/);
    });

    // M7 journeys (ruled 2026-10-29, E47; 06, Key journeys).
    test.fixme('18. Award XP (GM): 3 taps, 0 screen changes', async () => {
      // M7: Award now → (one change: a chip or a line) → Award N XP.
    });

    test.fixme('19. Level up (player): 3 taps, no typing, 0 screen changes', async () => {
      // M7: ▲ Ready to level → HP roll tile → Confirm.
    });

    test.fixme('20. Cast a spell (player): 1 tap instant, 3 with a sheet, 0 screen changes', async () => {
      // M7: Cast; or Cast → the sheet's choice → Cast.
    });

    test.fixme('21. Prepare with Same as yesterday (player): 2 taps, 0 screen changes', async () => {
      // M7: Prepare › → Same as yesterday.
    });
  });
}

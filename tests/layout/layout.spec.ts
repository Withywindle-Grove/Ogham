// Layout checks in a real browser (WebKit) at phone, Split View, tablet portrait and tablet landscape widths.
// Each screen is opened on layout.html (the real screens against the stand-in database) and checked for:
//   * no sideways scrolling;
//   * every button, link and box at least 44px tall (hard rule 7);
//   * body text at least 16px and nothing under 14px (hard rule 7; type scale ruled 2026-10-25);
//   * no serious or critical accessibility problems (axe: WCAG 2.1 A and AA rules);
// plus the two-pane layouts appearing only on a landscape tablet. A screenshot of each is saved in
// test-results/layout-screens for a person to look at (not compared pixel by pixel).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';
import { departStart } from './depart.ts';

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'split-view', width: 507, height: 900 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'tablet-landscape', width: 1180, height: 820 },
] as const;
const WIDE = 1024;
// Creation's two columns (final drafts A10): the list and the open entry side by side from 700 px (`CREATION_SPLIT`).
const CREATION_SPLIT = 700;

type Scene = { name: string; open: (page: Page, wide: boolean) => Promise<void> };

const campaignRow = (page: Page) => page.getByRole('button', { name: /The Drowned Marches/ });

// The campaign's menu (final drafts A11, slice E; Design on #549): on a phone (under 600 px) ≡ opens the drawer, which
// holds the campaign's items, and the ⋯ keeps only a screen's own options; wider, the ⋯ holds them.
async function campaignMenu(page: Page) {
  if (page.viewportSize()!.width < 600) await page.locator('.top-row').getByRole('button', { name: 'Menu' }).click();
  else await page.getByRole('button', { name: 'Character options' }).click();
}

// This device (theme, text size): on a phone in the drawer's foot, unfolded from the person's row; wider, in the ⋯.
async function deviceMenu(page: Page) {
  await campaignMenu(page);
  if (page.viewportSize()!.width < 600) await page.locator('.nav-drawer__person').click();
}

// The GM's campaign opens on Scene (ruled 2026-10-29); Players is one tap away.
const gmTab = (page: Page, name: 'Scene' | 'Rules' | RegExp) =>
  page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name });
const gmPlayers = (page: Page) => gmTab(page, /^Players/).click();

// Guided creation's pick steps (M5b step 0c): the row's Pick button "Pick <name>"; a one-of-many Pick moves on by
// itself (ct-1), an N-of-many step waits for Next.
async function chooseOption(page: Page, name: string) {
  const title = await page.getByRole('heading', { level: 1 }).first().textContent();
  await page.getByRole('checkbox', { name: `Pick ${name}` }).click();
  await page.waitForTimeout(150);
  if ((await page.getByRole('heading', { level: 1 }).first().textContent()) === title) await page.getByRole('button', { name: 'Next', exact: true }).click();
}

// Wren's full sheet scrolled to its Magic section (layout.html ?magic=1 or ?magic=empty; sr-4).
async function openMagic(page: Page, wide: boolean, magic: '1' | 'empty') {
  await page.goto(`/layout.html?as=player&magic=${magic}`);
  await campaignRow(page).click();
  if (!wide) {
    await campaignMenu(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
  }
  const section = page.getByRole('region', { name: 'Magic' });
  await expect(section).toBeVisible();
  // On a phone (and beside the Player screen, plan D) the section starts folded to its fold row: open it.
  await openSheetFold(section);
  await section.scrollIntoViewIfNeeded();
}

// A full-sheet section folded to its fold row (FoldedGroup's <details>; Design on #558): open it in place.
async function openSheetFold(section: Locator) {
  const folded = section.locator(':scope > details.creation-fold:not([open]) > summary');
  if (await folded.count()) await folded.click();
}

// Wren's full sheet on its own (not beside the Player screen): from ⋯ below a landscape tablet.
async function openFullSheet(page: Page, combat = false) {
  await page.goto(`/layout.html?as=player${combat ? '&combat=1' : ''}`);
  await campaignRow(page).click();
  await campaignMenu(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
  // The full sheet revised (plan m5b-sheet-revised A): the right column opens with Level; there is no Combat block.
  await expect(page.getByRole('region', { name: 'Level' })).toBeVisible();
}

// A new player's guided creation up to the class step: Strength 12, then the race. `extra` adds harness switches
// (e.g. "&alignments=1").
async function guidedToClass(page: Page, extra = '') {
  await page.goto(`/layout.html?as=new${extra}`);
  await campaignRow(page).click();
  await page.getByRole('button', { name: 'Create your character' }).click();
  await page.getByRole('button', { name: /^Guided/ }).click();
  await page.getByRole('textbox', { name: 'Strength' }).fill('12');
  await page.getByRole('button', { name: 'Next' }).click();
  await chooseOption(page, 'Marsh folk');
  await expect(page.getByRole('heading', { name: /Class/ })).toBeVisible();
}

// The GM's Rules tab → Setting rules' "Change rules for this campaign": the Optional rules group, every category open.
async function openOptionalRules(page: Page) {
  await page.goto('/layout.html?as=gm');
  await campaignRow(page).click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await page.getByRole('button', { name: 'Optional rules, 1 changed' }).click();
  await page.getByRole('button', { name: 'Change rules for this campaign' }).click();
  // Each source's group opens (lr-7) with every rule showing (tf-5).
  await expect(page.locator('.campaign-rules .rule-row').first()).toBeVisible();
}

/** A fold row on the Pack (plan m5b-players-screens-standard C): its summary, and the details it opens. */
const foldRow = (page: Page, label: string) => page.locator('details.creation-fold', { has: page.locator('.creation-fold__label', { hasText: label }) });

async function openPack(page: Page, extra = '') {
  await page.goto(`/layout.html?as=player${extra}`);
  await campaignRow(page).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toBeVisible();
}

/** Text size "Larger" on this device (ruled 2026-10-23: checked on the Pack and Player screens). */
const larger = (page: Page) => page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));

/** A Fen trek campaign of the harness (M5b gate), on Scene: the GM's opens there; a player taps Scene. */
async function openFenTrek(page: Page, as: 'gm' | 'player', name: RegExp) {
  await page.goto(`/layout.html?as=${as}`);
  await page.getByRole('button', { name }).click();
  if (as === 'player') await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
  // A player's heading names the last place shown to them (S15, mc-50: Heron Rise), else the mode; the GM's names the mode.
  await expect(page.getByRole('heading', { name: as === 'player' ? /^(Heron Rise|Fen trek), day/ : /^Fen trek/ }).first()).toBeVisible();
}

const SCENES: Scene[] = [
  {
    name: 'player-larger',
    open: async (page) => {
      await larger(page);
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens' }).first()).toBeVisible();
    },
  },
  {
    // The single top row (2026-10-23): a long campaign name in the back link ends in "…", no sideways scrolling.
    name: 'long-campaign-name-larger',
    open: async (page) => {
      await larger(page);
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Long Night Ferry/ }).click();
      const back = page.getByRole('button', { name: '‹ The Long Night Ferry Across the Seven Drowned Lanterns of Old Reedmouth' });
      await expect(back).toBeVisible();
      // One line, however long the name: it's cut short with "…" rather than wrapping.
      expect((await back.boundingBox())!.height).toBeLessThan(60);
      await expect(page.getByText('No one is in the ledger yet. Make your first character.')).toBeVisible();
    },
  },
  {
    name: 'pack-larger',
    open: async (page) => {
      await larger(page);
      await openPack(page);
      await page.getByRole('button', { name: /Quilted coat/ }).click();
    },
  },
  {
    name: 'pack',
    open: async (page) => {
      await openPack(page);
      // The Party stash is its own screen (K11, pk-4), opened from its row under the coin line: its things under
      // "Loose", with no other groups (N18).
      await page.getByRole('button', { name: /^Party stash/ }).click();
      await expect(page.getByRole('heading', { name: 'Loose' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Silver ewer/ })).toBeVisible();
      // Every row ends in Take (K12, pk-3).
      await expect(page.getByRole('button', { name: 'Take Silver ewer' })).toBeVisible();
    },
  },
  {
    // The Tiny things section (SC-5-2): folded as it starts, after Carried and before Other; a fold row with its summary
    // (plan m5b-players-screens-standard C), saying they don't count where true (pl-1).
    name: 'pack-tiny',
    open: async (page) => {
      await openPack(page, '&tiny=1');
      await expect(foldRow(page, 'Tiny things').locator('.creation-fold__note').first()).toHaveText(/^3 items: /);
      await expect(foldRow(page, 'Tiny things').locator('.creation-fold__detail')).toHaveText("They don't count");
      await expect(foldRow(page, 'Tiny things')).not.toHaveAttribute('open', '');
      await expect(page.getByRole('button', { name: /^Eel hooks/ })).toHaveCount(0);
    },
  },
  {
    // Opened: its things as ordinary rows (a long name, 999 hooks, the needle that sits in the Sack).
    name: 'pack-tiny-open',
    open: async (page) => {
      await openPack(page, '&tiny=1');
      await foldRow(page, 'Tiny things').locator('summary').click();
      await expect(page.getByRole('button', { name: /^Lucky pebble from the drowned causeway/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Fishbone needle/ })).toBeVisible();
    },
  },
  {
    name: 'pack-item',
    open: async (page) => {
      await openPack(page);
      await page.getByRole('button', { name: /Quilted coat/ }).click();
      await expect(page.getByRole('group', { name: 'Item actions' })).toBeVisible();
    },
  },
  {
    name: 'pack-add',
    open: async (page) => {
      await openPack(page);
      await page.getByRole('button', { name: 'Add item' }).click();
      await page.getByLabel('Search items').fill('eel');
      await page.getByRole('button', { name: /Eel trap/ }).click();
      await page.getByRole('button', { name: 'Bought' }).click();
      await expect(page.getByRole('button', { name: 'Add to Wren of the Lantern Wardens’ pack' })).toBeVisible();
    },
  },
  {
    name: 'gm-stash',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      await page.getByRole('button', { name: 'Inventory' }).click();
      await expect(page.getByRole('button', { name: /Silver ewer/ })).toBeVisible();
    },
  },
  {
    // The GM's Scene with a session and an expedition under way, after a turn (M5 step 5).
    name: 'gm-scene',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Start session' }).click();
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
    },
  },
  {
    // The GM's Scene with a check due on the reminder card: Hit, Miss, the −1 / +1 chips and + Modifier on its line.
    name: 'gm-scene-due',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
      await page.getByRole('button', { name: 'Next turn' }).click();
      await page.getByRole('region', { name: 'Due' }).getByRole('button', { name: '+1 face, Wandering check' }).click();
      await expect(page.getByText('Roll 1d6, on 1–2')).toBeVisible();
      // S17 (ic-6): Hit and Miss are stacked buttons with their icons; the faces keep their words.
      for (const name of ['Hit, Wandering check', 'Miss, Wandering check']) {
        await expect(page.getByRole('region', { name: 'Due' }).getByRole('button', { name }).locator('svg')).toHaveCount(1);
      }
      // The approval's fix 2 (2026-11-18): Hit and Miss on a row of their own, −1, +1 and + Modifier on the row below,
      // the buttons sharing a line one height. Where the card is wide enough (a phone, a 1024 px tablet and up) each row
      // is one line; in a narrower column (split view, 820 px) a row may wrap, but never into the other.
      const due = page.getByRole('region', { name: 'Due' });
      const rowOf = async (group: string) => Promise.all((await due.getByRole('group', { name: group }).getByRole('button').all()).map(async (b) => (await b.boundingBox())!));
      const answers = await rowOf('Answer, Wandering check');
      const faces = await rowOf('Change the chance, Wandering check');
      expect(answers).toHaveLength(2);
      expect(faces).toHaveLength(3);
      const width = page.viewportSize()!.width;
      const oneLine = width <= 430 || width >= 1024;
      for (const row of [answers, faces]) {
        for (const b of row) {
          const beside = row.filter((o) => Math.abs(o.y - b.y) < 1);
          for (const o of beside) expect(Math.abs(o.height - b.height)).toBeLessThan(1);
          if (oneLine) expect(Math.abs(b.y - row[0]!.y)).toBeLessThan(1);
        }
      }
      const answersFoot = Math.max(...answers.map((b) => b.y + b.height));
      expect(Math.min(...faces.map((b) => b.y))).toBeGreaterThanOrEqual(answersFoot + 7.5);
    },
  },
  {
    // The GM's Scene with a check due on the reminder card, a modifier added by hand, then a hit (M5 step 6).
    name: 'gm-scene-check',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await expect(page.getByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeVisible();
      await page.getByRole('button', { name: 'Next turn' }).click();
      const due = page.getByRole('region', { name: 'Due' });
      await due.getByRole('button', { name: '+ Modifier, Wandering check' }).click();
      await page.getByLabel('Note (optional)').fill('Noisy armour and a dropped shield on the stair');
      await page.getByRole('dialog', { name: 'Modifier for Wandering check' }).getByRole('button', { name: '+1 face' }).click();
      await expect(due.getByText('Roll 1d6, on 1–2')).toBeVisible();
      await due.getByRole('button', { name: 'Hit, Wandering check' }).click();
      // Since sf-4 the hit is the encounter's one card (no table here, so no row picked yet), its answers below.
      const card = page.getByRole('region', { name: 'Waiting for you' }).getByRole('region', { name: 'Encounter waiting, Wandering check, no row yet' });
      await expect(card.getByRole('heading', { name: 'An encounter' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Done' })).toBeVisible();
    },
  },
  {
    // Encounter tables, full screen (M5b step g3, B2): Which table? from the ⋯ menu (sf-3), every table listed.
    name: 'gm-which-table',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      // The ⋯ menu's first item during an expedition (sf-3, ⚑ 4; page 44, EN7 A).
      await page.getByRole('button', { name: 'Time options' }).click();
      await page.getByRole('button', { name: 'Encounter tables' }).click();
      await page.getByRole('button', { name: /^All 3 tables/ }).click();
      await expect(page.getByRole('dialog', { name: 'Encounter tables' })).toBeVisible();
    },
  },
  {
    // The table, full screen: a d100 table of long rows with Go to number (rows wrap; the box stays reachable), and
    // a tapped row lit.
    name: 'gm-table-long',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      // The ⋯ menu's first item during an expedition (sf-3, ⚑ 4; page 44, EN7 A).
      await page.getByRole('button', { name: 'Time options' }).click();
      await page.getByRole('button', { name: 'Encounter tables' }).click();
      await page.getByRole('button', { name: /^All 3 tables/ }).click();
      await page.getByRole('button', { name: /^The drowned sluices/ }).click();
      const go = page.getByLabel('Go to number');
      await expect(go).toBeVisible();
      await go.fill('57');
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      // The book's tapped table (sf-14): a row is a radio; the tapped row washed and ticked (checked).
      await page.getByRole('radio', { name: /29th sluice/ }).click();
      await expect(page.getByRole('radio', { name: /29th sluice/ })).toHaveAttribute('aria-checked', 'true');
      // Off the box, so the A4 check (no field focused when a screen opens) reads the screen, not this step.
      await page.getByRole('radio', { name: /29th sluice/ }).focus();
    },
  },
  {
    // The table with column chips (the setting's tables print columns).
    name: 'gm-table-columns',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      // The ⋯ menu's first item during an expedition (sf-3, ⚑ 4; page 44, EN7 A).
      await page.getByRole('button', { name: 'Time options' }).click();
      await page.getByRole('button', { name: 'Encounter tables' }).click();
      await page.getByRole('button', { name: /^All 3 tables/ }).click();
      await page.getByRole('button', { name: /^Wilderness of the fen/ }).click();
      await expect(page.getByRole('group', { name: 'Column' })).toBeVisible();
    },
  },
  {
    // Encounter waiting (M5b step 2): two cards on the GM console, newest first, one with a long row (messy data),
    // one with no row yet; since sf-4 the newest is the encounter's one card (Reveal…, Message…, Done), the older a row
    // with its Done.
    name: 'gm-encounter-waiting',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      for (const roll of [true, false]) {
        await page.getByRole('button', { name: 'Next turn' }).click();
        await page.getByRole('button', { name: 'Next turn' }).click();
        await page.getByRole('region', { name: 'Waiting for you' }).getByRole('button', { name: 'Hit, Wandering check' }).click();
        const which = page.getByRole('dialog', { name: 'Wandering check, Hit' });
        if (roll) {
          await which.getByRole('button', { name: /^Mortal/ }).click();
          await page.getByRole('dialog', { name: 'Mortal' }).getByRole('radio', { name: /Pilgrims lost/ }).click();
          await page.getByRole('dialog', { name: 'Mortal' }).getByRole('button', { name: 'Back' }).click();
        }
        await which.getByRole('button', { name: 'Close' }).click();
        // Since sf-4 the hit has no card of its own to close: it is the encounter's one card, which stays waiting.
      }
      // Since S8b a non-open item is a row: two encounters wait as the open card and one row; the panel counts every item
      // (the two encounters and the GM's reminder), so a lost encounter would change it.
      const panel = page.getByRole('region', { name: 'Waiting for you' });
      await expect(panel.getByRole('region', { name: /^Encounter waiting, / })).toHaveCount(1);
      // The newest (no row yet) is the open card; the older, with the long row, is a row whose button is Done (sf-4).
      await expect(panel.getByRole('region', { name: 'Encounter waiting, Wandering check, no row yet' })).toHaveCount(1);
      await expect(panel.getByRole('button', { name: /^Done, Pilgrims lost on the causeway/ })).toHaveCount(1);
      await expect(panel.locator('.waiting-card__count')).toHaveText('1 of 3');
    },
  },
  {
    // An encounter's card with its row picked: the row's full text and its count, read-only (M5b; the fight is M6). Since
    // sf-4 there is no Start: the one card in Waiting for you shows the row whole, with Change… and its answers.
    name: 'gm-encounter-started',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Next turn' }).click();
      await page.getByRole('button', { name: 'Next turn' }).click();
      await page.getByRole('region', { name: 'Waiting for you' }).getByRole('button', { name: 'Hit, Wandering check' }).click();
      await page.getByRole('dialog', { name: 'Wandering check, Hit' }).getByRole('button', { name: /^Mortal/ }).click();
      await page.getByRole('dialog', { name: 'Mortal' }).getByRole('radio', { name: /Pilgrims lost/ }).click();
      await page.getByRole('dialog', { name: 'Mortal' }).getByRole('button', { name: 'Back' }).click();
      await page.getByRole('dialog', { name: 'Wandering check, Hit' }).getByRole('button', { name: 'Close' }).click();
      // The panel's open card is the encounter (as in the hit's journey), reading the picked row whole.
      const card = page.getByRole('region', { name: 'Waiting for you' }).getByRole('region', { name: /^Encounter waiting, Wandering check, Mortal: Pilgrims lost/ });
      await expect(card.getByRole('heading', { name: 'An encounter' })).toBeVisible();
      await expect(card.locator('.waiting-encounter__line')).toHaveText(/^Pilgrims lost on the causeway with a lame mule/);
      await expect(card.getByText('How many: 999')).toBeVisible();
      await expect(card.getByRole('button', { name: /^Change…/ })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Done' })).toBeVisible();
    },
  },
  {
    // Table library ›, the library full screen with a pin button on each row (prep).
    name: 'gm-tables-library',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&tables=1');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Table library ›' }).click();
      await page.getByRole('button', { name: /^Pin The drowned sluices/ }).click();
      await expect(page.getByRole('button', { name: /^Unpin The drowned sluices/ })).toBeVisible();
    },
  },
  {
    // The GM's Scene after End expedition and a full rest: the summary, the healing prompt per character.
    name: 'gm-scene-ended',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Start session' }).click(); // S9: Next turn needs a session running
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Time options' }).click();
      await page.getByRole('button', { name: 'End expedition' }).click();
      await page.getByRole('button', { name: 'Full rest' }).click();
      await expect(page.getByText('Rest and day abilities are back.')).toBeVisible();
    },
  },
  {
    // The end card just after End expedition, answered Yes (S19; page 16, T11b, T11d): the two-sided switch at the
    // row's right, Staying a while? with Start downtime and Not yet, Full rest the accent, Done; Undo in the card's head.
    name: 'gm-scene-end-card-staying',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Start session' }).click();
      await page.getByRole('button', { name: 'Depart' }).click();
      await departStart(page);
      await page.getByRole('button', { name: 'Time options' }).click();
      await page.getByRole('button', { name: 'End expedition' }).click();
      const card = page.getByRole('region', { name: 'Expedition ended' });
      await card.getByRole('group', { name: 'In a safe place?' }).getByRole('button', { name: 'Yes' }).click();
      await expect(card.getByRole('button', { name: 'Not yet' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Undo ending the expedition' })).toBeVisible();
    },
  },
  {
    // The GM's Scene with the marching order, a character's overview open (M5 step 8): HP, light, Keep lit, moves.
    name: 'gm-scene-overview',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: /^Wren of the Lantern Wardens\b.*\. Details$/ }).click();
      await expect(page.getByRole('dialog', { name: 'Wren of the Lantern Wardens' }).getByRole('button', { name: /^Walk beside|A row of their own/ }).first()).toBeVisible();
    },
  },
  {
    // The player's Scene: the marching order's Saved orders, with Save as… (M5 step 8, DG8; circles since S12, with
    // Saved orders on the card itself).
    name: 'player-scene-saved-orders',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await page.getByRole('button', { name: 'Saved orders' }).click();
      await expect(page.getByRole('dialog', { name: 'Saved orders' }).getByRole('textbox', { name: 'Save as…' })).toBeVisible();
    },
  },
  {
    // The GM's Scene after a split (M5 step 8, DG14): the Split the party pop-up used once, then the focus chips.
    name: 'gm-scene-groups',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Split party' }).click();
      const dialog = page.getByRole('dialog', { name: 'Split the party' });
      await dialog.getByRole('group', { name: "Wren of the Lantern Wardens’ group" }).getByRole('button', { name: 'New group' }).click();
      await expect(page.getByText('Wren of the Lantern Wardens is in Group 2')).toBeVisible();
      await dialog.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('group', { name: 'Group in focus' })).toBeVisible();
      // S17's split state: Change groups and Join up are both there, and at least 44 px tall.
      for (const name of ['Change groups', 'Join up']) {
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    },
  },
  {
    // The player's Scene: the Split the party pop-up (M5 step 8, DG14).
    name: 'player-scene-split',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await page.getByRole('button', { name: 'Split party' }).click();
      await expect(page.getByRole('dialog', { name: 'Split the party' }).getByRole('button', { name: 'New group' }).first()).toBeVisible();
    },
  },
  {
    // The GM's Scene: Ash's overview with three statuses (a long name ×12, a level, a secret timer), then + Status
    // (M5 step 9; wide since the M5 gate, B6): the How long chip row with Until removed pressed, a family row,
    // effects under the names, then Other… with its units and Hide time left.
    name: 'gm-scene-statuses',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: /^Ash, .*Bog-sickness/ }).click();
      const card = page.getByRole('dialog', { name: 'Ash' });
      await expect(card.getByText("Time left is the GM's")).toHaveCount(0);
      await expect(card.getByText(/hidden from players/)).toBeVisible();
      await card.getByRole('button', { name: 'Add a status to Ash' }).click();
      const add = page.getByRole('dialog', { name: 'Add a status to Ash' });
      const howLong = add.getByRole('group', { name: 'How long' });
      await expect(howLong.getByRole('button', { name: 'Until removed' })).toHaveAttribute('aria-pressed', 'true');
      await expect(add.getByRole('button', { name: 'Bog rot, 2 kinds' })).toBeVisible();
      await expect(add.getByText('Slow and sore until a proper rest.')).toBeVisible();
      await howLong.getByRole('button', { name: 'Other…' }).click();
      await add.getByRole('group', { name: 'Timer' }).getByRole('button', { name: 'Turns' }).click();
      await expect(add.getByRole('switch', { name: /Hide time left/ })).toBeVisible();
    },
  },
  {
    // + Status's family view (B6): the pack's kinds, a long name and a long effect beside Add.
    name: 'gm-scene-status-family',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: /^Ash, .*Bog-sickness/ }).click();
      await page.getByRole('dialog', { name: 'Ash' }).getByRole('button', { name: 'Add a status to Ash' }).click();
      const add = page.getByRole('dialog', { name: 'Add a status to Ash' });
      await add.getByRole('button', { name: 'Bog rot, 2 kinds' }).click();
      await expect(add.getByRole('list', { name: 'Kinds of Bog rot' }).getByRole('button', { name: /^Add Reed cut/ })).toBeVisible();
    },
  },
  {
    // + Status's custom status (B6): Name, What it does, How long, Stacks, and the one accent.
    name: 'gm-scene-status-custom',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: /^Ash, .*Bog-sickness/ }).click();
      await page.getByRole('dialog', { name: 'Ash' }).getByRole('button', { name: 'Add a status to Ash' }).click();
      const add = page.getByRole('dialog', { name: 'Add a status to Ash' });
      await add.getByRole('button', { name: /Custom status…/ }).click();
      await add.getByRole('button', { name: 'Stacks' }).click();
      await expect(add.getByRole('button', { name: 'Stacks' })).toHaveAttribute('aria-pressed', 'true');
      await expect(add.getByRole('button', { name: 'Add to Ash' })).toBeVisible();
    },
  },
  {
    // The player's Scene: a status sheet with levels, opened from a marching tile's overview (M5 step 9; B18).
    name: 'player-scene-status-sheet',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await page.getByRole('button', { name: /^Ash, .*Bog-sickness/ }).click();
      await page.getByRole('dialog', { name: 'Ash' }).getByRole('button', { name: /^Reeling/ }).click();
      await expect(page.getByRole('dialog', { name: 'Reeling' }).getByText('Reeling (now)')).toBeVisible();
    },
  },
  {
    // The GM's status sheet for a secret timer (follow-up to the status rings): the time-left stepper over End it now.
    name: 'gm-scene-status-time',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: /^Ash, .*Bog-sickness/ }).click();
      await page.getByRole('dialog', { name: 'Ash' }).getByRole('button', { name: /^Fen-sight/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Fen-sight' });
      await expect(sheet.getByRole('group', { name: 'turns left' })).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'End it now' })).toBeVisible();
    },
  },
  {
    // The player's table view during an expedition with a rest rule (B18, B5): the Rest fact in the players' top (S15,
    // where the time band's rest marker was) and the Rest button under the marching tiles.
    name: 'player-scene-rest',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Weary Causeway/ }).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await expect(page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Rest: (In \d+|Rest due)/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Rest', exact: true })).toBeVisible();
      // SC-g6-2 (2026-11-03): the group has no light, so each circle (S12) reads "◑ No light" (symbol and words), inside its circle.
      const tiles = page.getByRole('list', { name: 'Marching order, front to back' }).getByRole('button');
      await expect(tiles.first()).toContainText('◑ No light');
      for (const tile of await tiles.all()) {
        const [box, words] = await Promise.all([tile.boundingBox(), tile.getByText('No light').boundingBox()]);
        expect(words!.x + words!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
      }
    },
  },
  {
    // The Compact time strip under the top row on the GM's Players tab during an expedition (M5 step 10, DG2).
    name: 'gm-compact-strip',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Weary Causeway/ }).click();
      await gmPlayers(page);
      await expect(page.getByRole('region', { name: 'Time' }).getByRole('button', { name: 'Next turn' })).toBeVisible();
    },
  },
  {
    // A player with no light in a turn mode: the "No light" reminder (M5 step 10, DG7), in the Player tab's notices box
    // (row C1, tfn-2): the box lit, nothing in the page, the reminder in its sheet; and the page never darkens (the
    // dim was removed at the M5 gate, R3 audit 8).
    name: 'player-no-light',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Weary Causeway/ }).click();
      const box = page.getByRole('button', { name: /^\d+ notices?, open them$/ });
      await expect(box).toBeVisible();
      await expect(box).toHaveClass(/notices-box--lit/);
      await expect(page.getByText('No light', { exact: true })).toHaveCount(0);
      await box.click();
      await expect(page.getByRole('dialog', { name: 'Notices' }).getByText('No light', { exact: true })).toBeVisible();
      await expect(page.locator('html')).not.toHaveAttribute('data-darkness', /.+/);
      await expect(page.locator('.darkness')).toHaveCount(0);
    },
  },
  {
    // The GM's place page's pieces with Edit piece open (M5b g2, B1; dec-7 5b, page 11 frame 7; sf-16, page 44 EP1):
    // each row's arrow opens Edit piece, a 44 px button beside the bare eye (ds-2: no word), the two never overlapping;
    // the form filled in, with Save and Remove this piece.
    name: 'gm-place-edit-piece',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Lantern Hall/ }).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      const text = page.getByRole('button', { name: 'Edit piece: A narrow stair down, to the west' });
      const eye = page.locator('.place-page__piece').filter({ has: text }).getByRole('button', { name: 'Hide from players' });
      const [words, button] = await Promise.all([text.boundingBox(), eye.boundingBox()]);
      expect(words!.height).toBeGreaterThanOrEqual(43.5);
      // Page 11: the bare eye, 44 × 44, pressed while shown, no word.
      expect(Math.round(button!.height)).toBe(44);
      expect(Math.round(button!.width)).toBe(44);
      await expect(eye).toHaveAttribute('aria-pressed', 'true');
      await expect(eye).toHaveText('');
      expect(words!.x + words!.width).toBeLessThanOrEqual(button!.x);
      await text.click();
      await expect(page.getByRole('heading', { name: 'Edit piece' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove this piece' })).toBeVisible();
    },
  },
  {
    // The GM's Where? between expeditions, with recent places as chips (M5 step 10, DG1).
    name: 'gm-where',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Reedmouth Delve/ }).click();
      await page.getByRole('button', { name: 'Start session' }).click(); // p2p-4: Depart shows only while a session runs
      await page.getByRole('button', { name: 'Depart' }).click();
      await expect(page.getByRole('button', { name: /^Where\?:/ })).toBeVisible();
    },
  },
  {
    // The GM's Scene when rest falls due: the rest panel with its rows, Everyone rests / No one rests (B5).
    name: 'gm-scene-rest-panel',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Weary Causeway/ }).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: 'Next turn' }).click();
      // Since S8b the rest is a "Rest is due" item of Waiting for you; its Answer… opens the rest panel as a sheet (ic-4, T6b).
      await page.getByRole('region', { name: 'Waiting for you' }).getByRole('button', { name: 'Answer…, Rest is due' }).click();
      await expect(page.getByRole('dialog', { name: /Rest is due$/ }).getByRole('region', { name: /^Rest due, \d+ of \d+ answered$/ }).getByRole('button', { name: 'Everyone rests' })).toBeVisible();
    },
  },
  {
    // The player's Scene: the time, read only (the players' top, S15: before the first session, "No session yet").
    name: 'player-scene',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await expect(page.getByRole('heading', { name: 'No session yet' })).toBeVisible();
    },
  },
  {
    name: 'sign-in',
    open: async (page) => {
      await page.goto('/layout.html');
      await expect(page.getByLabel('Email')).toBeVisible();
    },
  },
  {
    name: 'picker',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await expect(campaignRow(page)).toBeVisible();
    },
  },
  {
    name: 'player',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens' }).first()).toBeVisible();
    },
  },
  {
    name: 'your-characters',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await campaignMenu(page);
      await page.getByRole('button', { name: 'Your characters', exact: true }).click();
      await expect(page.getByText("Level 1, waiting for your GM's approval.")).toBeVisible();
    },
  },
  {
    // B18: a sent-back character, full screen on its review, with the GM's note pinned and the Resend pop-up.
    name: 'sent-back-review',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await campaignMenu(page);
      await page.getByRole('button', { name: 'Your characters', exact: true }).click();
      await page.getByRole('button', { name: 'Open Moss of the Reed Ferry' }).click();
      await expect(page.getByRole('complementary', { name: 'Note from your GM' })).toBeVisible();
      await page.getByRole('button', { name: 'Send to the GM' }).first().click();
      await expect(page.getByRole('dialog', { name: /things? still to do/ })).toBeVisible();
    },
  },
  {
    // A draft not sent yet (ruled 2026-10-26) opens on its review, with Send to the GM last.
    name: 'draft-review',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await campaignMenu(page);
      await page.getByRole('button', { name: 'Your characters', exact: true }).click();
      await expect(page.getByText('Not sent yet, tap to continue')).toBeVisible();
      await page.getByRole('button', { name: 'Open Rush of the Low Fen Crossing' }).click();
      await expect(page.getByRole('button', { name: 'Send to the GM' }).first()).toBeVisible();
    },
  },
  {
    // B18: the GM's review card (A6) and ticking what needs work.
    name: 'gm-send-back',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      await page.getByRole('button', { name: 'Send back' }).click();
      await expect(page.getByRole('group', { name: 'What needs work (optional)' })).toBeVisible();
    },
  },
  {
    // The full sheet revised (plan m5b-sheet-revised A): two columns on a tablet (beside the Player screen on a
    // landscape one, the right column only), one on a phone, the left column (the HP box, AC, Attack) first.
    name: 'full-sheet',
    open: async (page, wide) => {
      if (wide) {
        await page.goto('/layout.html?as=player');
        await campaignRow(page).click();
        // The sheet's rows beside, with no heading (tfr-4): Notes is the last.
        await expect(page.locator('.player__right').getByRole('button', { name: 'Notes' })).toBeVisible();
      } else await openFullSheet(page);
    },
  },
  {
    // Gate check 64's character (Design, 2026-11-05): a full level 3 Lantern Warden on the invented fixture pack
    // (layout.html ?full=1): saves, movement, a skill, six scores, traits with a drawback and a later-level one, two
    // kinds of magic, the experience bar, bonus and title (the sheet revised: bonus an Abilities row, title by the name).
    name: 'full-character',
    open: async (page, wide) => {
      await page.goto('/layout.html?as=player&full=1');
      await page.getByRole('button', { name: /The Fen Ledger/ }).click();
      if (wide) return void (await expect(page.locator('.player__right').getByRole('button', { name: 'Notes' })).toBeVisible());
      await campaignMenu(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Abilities' })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    // The same sheet on a phone with every section opened in place (sr-7).
    name: 'full-sheet-open',
    open: async (page, wide) => {
      if (wide) return void (await page.goto('/layout.html?as=player'));
      await openFullSheet(page);
      const folded = page.locator('.sheet details.creation-fold:not([open]) > summary');
      while ((await folded.count()) > 0) await folded.first().click();
    },
  },
  {
    // Design asked (2026-11-05): the GM's side menu with the campaign name, as it sits on a landscape tablet (the
    // tabs on narrower screens). The long-name check is its own test (#510).
    name: 'gm-side-menu',
    open: async (page) => {
      // The menu opened on this device before: this scene shows the open column with the campaign's name (folded,
      // the default since mn-1, hides the name).
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      await expect(page.getByRole('navigation', { name: 'Campaign sections' })).toBeVisible();
      await expect(page.getByText('The Drowned Marches').first()).toBeVisible();
    },
  },
  {
    name: 'sheet-edit',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      // Edit is on the cards of Your characters, at every width (tfr-4, row C10; changed on Francis's yes, 20 Nov 2026).
      await campaignMenu(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Your characters', exact: true }).click();
      await page.getByRole('button', { name: /^Edit / }).first().click();
      // Edit on the standard (plan m5b-sheet-revised B5): Scores, Hit points, Level, then Details, and its foot.
      const edit = page.getByRole('form', { name: /^Edit / });
      await expect(edit.getByRole('region', { name: 'Details' })).toBeVisible();
      await expect(edit.getByRole('status', { name: 'Edit status' })).toBeVisible();
    },
  },
  {
    // The log from the top row (2026-10-23): a bottom sheet on a phone, a side panel on a tablet.
    name: 'player-log',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Log', exact: true }).click();
      await page.getByLabel('Verbose: every change, like each HP tick').check();
      await expect(page.getByText("You set Wren of the Lantern Wardens’ HP to 11 (was 14).")).toBeVisible();
    },
  },
  {
    name: 'scene',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await expect(page.getByRole('heading', { name: 'Recently' })).toBeVisible();
    },
  },
  {
    // The ⋯ menu's This device switches at the largest text: every word whole (2026-10-23).
    name: 'this-device-larger',
    open: async (page) => {
      await larger(page);
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await deviceMenu(page);
      await expect(page.getByRole('group', { name: 'Text size' })).toBeVisible();
    },
  },
  {
    name: 'gm-log',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      await page.getByRole('button', { name: 'Log', exact: true }).click();
      await expect(page.getByText('You approved Wren of the Lantern Wardens.')).toBeVisible();
    },
  },
  {
    name: 'library',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await expect(campaignRow(page)).toBeVisible();
      await page.getByRole('button', { name: 'Account and device options' }).click();
      await page.getByRole('button', { name: 'Rules library' }).click();
      await expect(page.getByText('River Rules')).toBeVisible();
    },
  },
  {
    name: 'library-convert',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await expect(campaignRow(page)).toBeVisible();
      await page.getByRole('button', { name: 'Account and device options' }).click();
      await page.getByRole('button', { name: 'Rules library' }).click();
      await page.getByRole('button', { name: 'Convert a book with an AI…' }).click();
      await expect(page.getByRole('button', { name: 'Copy the instructions' })).toBeVisible();
    },
  },
  {
    name: 'library-delete',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await expect(campaignRow(page)).toBeVisible();
      await page.getByRole('button', { name: 'Account and device options' }).click();
      await page.getByRole('button', { name: 'Rules library' }).click();
      // Delete is in the pack's ⋯, never on the row (lr-3).
      await page.getByRole('button', { name: 'More for River Rules' }).click();
      await page.getByRole('button', { name: /^Delete from your library…/ }).click();
      await expect(page.getByRole('button', { name: 'Delete for good' })).toBeVisible();
    },
  },
  {
    // The library by kind (lr-1, lr-2): groups and chips, a long overlay name and description, 999 items, its ⋯ open.
    name: 'library-by-kind',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&library=1');
      await expect(campaignRow(page)).toBeVisible();
      await page.getByRole('button', { name: 'Account and device options' }).click();
      await page.getByRole('button', { name: 'Rules library' }).click();
      await expect(page.getByRole('heading', { name: 'Homebrew: 1' })).toBeVisible();
      await page.getByRole('button', { name: /^More for A Very Long Homebrew/ }).click();
      await expect(page.getByRole('button', { name: /^Export as a pack file/ })).toBeVisible();
    },
  },
  {
    // Setting rules shows the optional rules read-only (ruled 2026-10-26).
    name: 'gm-optional-rules',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: 'Optional rules, 1 changed' }).click();
      await expect(page.getByRole('group', { name: 'Optional rules for River Rules' })).toBeVisible();
    },
  },
  {
    // They're chosen in Rules for this campaign: one group per source with set-up step 3's rows (lr-7), each saying
    // what it does, its source and when it can change; Reset and Retire at the foot.
    name: 'gm-optional-rules-rows',
    open: async (page) => {
      await openOptionalRules(page);
      await expect(page.locator('.campaign-rules').getByRole('group', { name: 'Armour class' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: "Reset to the books' defaults" })).toBeVisible();
      // Copy the set-up at the foot too (cs-set-1).
      await expect(page.getByRole('button', { name: 'Copy the set-up' })).toBeVisible();
      // An option the app doesn't apply yet (ex-7) shows its "Run by hand ›" link.
      await expect(page.locator('.campaign-rules').getByText('Run by hand ›').first()).toBeVisible();
    },
  },
  {
    name: 'gm-optional-rules-ask',
    open: async (page) => {
      await openOptionalRules(page);
      await page.getByRole('group', { name: 'Lanterns need oil' }).getByRole('button', { name: /Yes/ }).click();
      await expect(page.getByRole('dialog', { name: 'Change Lanterns need oil?' })).toBeVisible();
    },
  },
  {
    name: 'gm-new-entry-kind',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: '+ New homebrew entry' }).click();
      await expect(page.getByRole('group', { name: 'New homebrew entry' })).toBeVisible();
    },
  },
  {
    name: 'gm-entry-editor',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: '+ New homebrew entry' }).click();
      await page.getByRole('button', { name: 'Stat block' }).click();
      const form = page.getByRole('form', { name: 'New stat block' });
      await form.getByLabel('Name', { exact: true }).fill('Mire hag');
      await form.getByRole('button', { name: '+ Add a line' }).click();
      await form.getByRole('button', { name: '+ Add a row' }).click();
      await form.getByRole('button', { name: 'Save' }).click();
      await expect(form.getByRole('alert')).toBeVisible();
    },
  },
  {
    name: 'gm-entry-editor-class',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: '+ New homebrew entry' }).click();
      await page.getByRole('button', { name: 'Class', exact: true }).click();
      const form = page.getByRole('form', { name: 'New class' });
      await form.getByRole('button', { name: /^\+ Add/ }).first().click();
      await expect(form).toBeVisible();
    },
  },
  {
    name: 'gm-entry-editor-spell',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: '+ New homebrew entry' }).click();
      await page.getByRole('button', { name: 'Spell', exact: true }).click();
      const form = page.getByRole('form', { name: 'New spell' });
      await form.getByRole('button', { name: /^\+ Add/ }).first().click();
      await expect(form).toBeVisible();
    },
  },
  {
    name: 'gm-entry-editor-option',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: '+ New homebrew entry' }).click();
      await page.getByRole('button', { name: 'Optional rule', exact: true }).click();
      const form = page.getByRole('form', { name: 'New optional rule' });
      await form.getByRole('button', { name: '+ Add a row' }).click();
      await expect(form).toBeVisible();
    },
  },
  {
    name: 'gm-entry-editor-table',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: '+ New homebrew entry' }).click();
      await page.getByRole('button', { name: 'Table', exact: true }).click();
      const form = page.getByRole('form', { name: 'New table' });
      await form.getByRole('button', { name: '+ Add a row' }).click();
      await expect(form).toBeVisible();
    },
  },
  {
    name: 'gm-rules-browser',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: 'Browse these rules' }).click();
      await page.getByText('Stat blocks: 1').click();
      await page.getByRole('button', { name: 'Bog lurker' }).click();
      await expect(page.getByRole('article', { name: 'Bog lurker' })).toBeVisible();
    },
  },
  {
    name: 'gm-rules-versions',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: 'Browse these rules' }).click();
      await page.getByText('Classes: 1').click();
      await page.getByRole('button', { name: /^Lantern Warden/ }).click();
      await page.getByRole('button', { name: 'See the River Rules version' }).click();
      await expect(page.getByRole('button', { name: 'Use this version' })).toBeVisible();
    },
  },
  {
    name: 'player-rules-formula',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await campaignMenu(page);
      await page.getByRole('button', { name: 'Setting rules' }).click();
      await page.getByText('Spells: 1').click();
      await page.getByRole('button', { name: /^Glimmer/ }).click();
      await expect(page.getByRole('group', { name: 'Work out at level' })).toBeVisible();
    },
  },
  {
    name: 'player-rules',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await campaignMenu(page);
      await page.getByRole('button', { name: 'Setting rules' }).click();
      await page.getByText('Classes: 1').click();
      await page.getByRole('button', { name: /^Lantern Warden/ }).click();
      await expect(page.getByRole('article', { name: 'Lantern Warden' })).toBeVisible();
    },
  },
  {
    name: 'gm-retired',
    open: async (page) => {
      // The menu opened on this device before: folded (the default since mn-1) hides the Retired banner on a landscape
      // tablet, and this scene checks the banner.
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
      await page.goto('/layout.html?as=gm');
      await page.getByText('Retired: 1').click();
      await page.getByRole('button', { name: /The Old Fen Road/ }).click();
      await expect(page.getByRole('button', { name: 'Bring back' })).toBeVisible();
    },
  },
  {
    name: 'gm-retire-confirm',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await page.getByRole('button', { name: 'Retire campaign…' }).click();
      await expect(page.getByRole('button', { name: 'Retire', exact: true })).toBeVisible();
    },
  },
  {
    name: 'gm-players',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      await expect(page.getByRole('button', { name: 'Invite a player' })).toBeVisible();
    },
  },
  {
    name: 'gm-companies',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();
      await expect(page.getByLabel('Company for Wren of the Lantern Wardens')).toBeVisible();
    },
  },
  {
    name: 'gm-rules',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      // Character fields is a group in Rules for this campaign (N20, ruled 2026-10-28), opened here to check it.
      await page.getByRole('button', { name: /^Character fields/ }).click();
      await expect(page.getByRole('button', { name: '+ Add a field' })).toBeVisible();
    },
  },
  {
    // Set-up step 2 on the shell (lr-5): packs by kind with chips, the long overlay picked without its base, so the
    // hint says what Next needs.
    name: 'new-campaign-packs',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&library=1');
      await page.getByRole('button', { name: '+ Start a new campaign (as GM)' }).click();
      await page.getByLabel('Campaign name').fill('The Lantern Road');
      await page.getByRole('button', { name: 'Next: setting rules' }).click();
      await page.getByRole('checkbox', { name: /^Pick A Very Long Homebrew/ }).click();
      await expect(page.getByRole('status', { name: 'Step status' })).toContainText('needs River Rules');
    },
  },
  {
    // Set-up step 3 (lr-6): the ruleKey clash callout, River Rules' group open with every rule (tf-5), the overlay folded.
    name: 'new-campaign-options',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&library=1');
      await page.getByRole('button', { name: '+ Start a new campaign (as GM)' }).click();
      await page.getByLabel('Campaign name').fill('The Lantern Road');
      await page.getByRole('button', { name: 'Next: setting rules' }).click();
      await page.getByRole('checkbox', { name: 'Pick River Rules' }).click();
      await page.getByRole('checkbox', { name: /^Pick A Very Long Homebrew/ }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('group', { name: 'Choice for ac style' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Armour class' })).toBeVisible();
    },
  },
  {
    name: 'new-campaign-time',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: '+ Start a new campaign (as GM)' }).click();
      await page.getByLabel('Campaign name').fill('The Lantern Road');
      await page.getByRole('button', { name: 'Next: setting rules' }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('group', { name: 'Encumbrance' })).toBeVisible();
    },
  },
  {
    name: 'create-character',
    open: async (page) => {
      await page.goto('/layout.html?as=new');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Create your character' }).click();
      // With setting rules that have classes, the way comes first (M4b): freeform here, guided below.
      await page.getByRole('button', { name: /^Freeform/ }).click();
      await expect(page.getByLabel('Name')).toBeVisible();
    },
  },
  {
    // M5b step 0c: on a phone the class's entry is a sheet with Pick at its foot; from 700 px (final drafts A10, an iPad
    // upright too) the panel beside the list.
    name: 'guided-class-detail',
    open: async (page) => {
      await guidedToClass(page);
      await page.getByRole('button', { name: /^Lantern Warden/ }).click();
      const split = (page.viewportSize()?.width ?? 0) >= CREATION_SPLIT;
      await expect(split ? page.getByRole('complementary', { name: 'Lantern Warden' }) : page.getByRole('dialog', { name: 'Lantern Warden' })).toBeVisible();
    },
  },
  {
    // An unmet class requirement (m5b-0c, ruled 2026-11-02): the row shows the shortfall and the special-approval note; Next goes on.
    name: 'guided-unmet-requirement',
    open: async (page) => {
      await page.goto('/layout.html?as=new');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Create your character' }).click();
      await page.getByRole('button', { name: /^Guided/ }).click();
      await page.getByRole('textbox', { name: 'Strength' }).fill('8');
      await page.getByRole('button', { name: 'Next' }).click();
      await chooseOption(page, 'Marsh folk');
      // Rows needing the GM's approval fold after the open ones (retest 2): the fold row opens them.
      await page.locator('.creation-fold__summary', { hasText: /the GM's approval$/ }).first().click();
      await expect(page.getByText("Needs the GM's special approval").first()).toBeVisible();
      // Pick → Next (ct-1): the pick goes on to Adjust scores, flagged in its toast.
      await page.getByRole('checkbox', { name: 'Pick Lantern Warden' }).click();
      await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
    },
  },
  {
    // "Who they are" after guided steps, on the creation step shell (m5b-0c slice 3): Back, the fields, Next.
    name: 'guided-who',
    open: async (page) => {
      // With the setting's alignments, so the alignment rows show their one-line blurbs (cr-12).
      await guidedToClass(page, '&alignments=1');
      await chooseOption(page, 'Lantern Warden');
      // The layout world has the trade as data (m5b-0c), so Adjust scores sits between Class and "Who are they?".
      await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Who they are' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Back to the step before', exact: true })).toBeVisible();
      await expect(page.getByText('Bends with the current, keeps the old ways.')).toBeVisible();
    },
  },
  {
    // The creation review (m5b-0c slice 7, cr-18): one section per step with Change ›, the To finish box, Save and
    // leave, Send to the GM. Reached by naming the character and putting off whatever follows.
    name: 'guided-review',
    open: async (page) => {
      await guidedToClass(page);
      await chooseOption(page, 'Lantern Warden');
      // Adjust scores (the layout world has the trade as data): Next to Who they are.
      await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('textbox', { name: 'Name' }).fill('Rush of the Low Fen Crossing');
      const hp = page.getByRole('textbox', { name: 'Hit points' });
      if (await hp.count()) await hp.fill('5');
      await page.getByRole('button', { name: 'Next' }).click();
      const send = page.getByRole('button', { name: 'Send to the GM' });
      for (let i = 0; i < 8 && !(await send.isVisible()); i++) {
        const later = page.getByRole('button', { name: 'Decide later' });
        await (await later.isVisible() ? later : page.getByRole('button', { name: 'Next' })).click();
        await page.waitForTimeout(150);
      }
      await expect(send).toBeVisible();
      // Save and leave is in the app bar's More (final drafts A1).
      await expect(page.locator('.creation-step__bar--app').getByRole('button', { name: 'More', exact: true })).toBeVisible();
    },
  },
  {
    // Today's weather (M5b): due, as a player sees it on Scene (Enter roll) …
    name: 'weather-due-scene',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Wet Road/ }).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await expect(page.getByLabel('Roll d6 for the weather')).toBeVisible();
    },
  },
  {
    // … and the same prompt in the Player tab's notices box (row C1, tfn-2): open the box, the roll is in its sheet.
    name: 'weather-due-urgent',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Wet Road/ }).click();
      await page.getByRole('button', { name: /^\d+ notices?, open them$/ }).click();
      await expect(page.getByRole('dialog', { name: 'Notices' }).getByLabel('Weather due: roll d6')).toBeVisible();
    },
  },
  {
    // In, with a long result and four tags: opened from the players' Weather fact (S15; the icon beside the date went
    // with the old head), in the Weather sheet (T6).
    name: 'weather-in',
    open: async (page) => {
      await page.goto('/layout.html?as=player');
      await page.getByRole('button', { name: /The Dry Ford/ }).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Scene' }).click();
      await page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Weather/ }).click();
      await expect(page.getByRole('dialog', { name: /Weather$/ }).getByText('Mired.', { exact: true })).toBeVisible();
    },
  },
  {
    // The GM's weather while it's due: the players roll it, the GM can enter it instead (S10: in the Weather fact's sheet).
    name: 'weather-gm',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Wet Road/ }).click();
      await page.getByRole('group', { name: 'Scene facts' }).getByRole('button', { name: /^Weather/ }).click();
      await expect(page.getByText('The players roll it; you can enter it instead.')).toBeVisible();
    },
  },
  // The wilderness (M5b gate, plan m5b-5 build order 2), on the fixture pack's Fen trek (layoutHarness.tsx).
  ...(['light', 'dark'] as const).flatMap((theme): Scene[] => [
    {
      // The players' wilderness screen: the budget card's points, Around you, the button group (Cut reeds, Scout
      // ahead · 3 points, Force march), What we know; a long character name.
      name: `player-wilderness${theme === 'dark' ? '-dark' : ''}`,
      open: async (page) => {
        if (theme === 'dark') await page.addInitScript(() => localStorage.setItem('grimoire.theme', 'dark'));
        await openFenTrek(page, 'player', /The Long Fen Road/);
        await expect(page.getByRole('button', { name: 'Force march' })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Cut reeds/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /^What we know/ })).toBeVisible();
      },
    },
  ]),
  {
    // The same at the largest text size.
    name: 'player-wilderness-larger',
    open: async (page) => {
      await larger(page);
      await openFenTrek(page, 'player', /The Long Fen Road/);
      await expect(page.getByRole('button', { name: 'Force march' })).toBeVisible();
    },
  },
  {
    // What we know, popped out: the place shown with its description.
    name: 'player-what-we-know',
    open: async (page) => {
      await openFenTrek(page, 'player', /The Long Fen Road/);
      await page.getByRole('button', { name: /^What we know/ }).click();
      await expect(page.getByRole('dialog', { name: 'What we know' }).getByText('Heron Rise')).toBeVisible();
    },
  },
  {
    // During camp the button group swaps for the camp steps (fire lit, Reed has eaten, the watches set).
    name: 'player-camp',
    open: async (page) => {
      await openFenTrek(page, 'player', /The Reed Camp/);
      await expect(page.getByText('Set watches').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /^Cut reeds/ })).toHaveCount(0);
    },
  },
  ...(['light', 'dark'] as const).flatMap((theme): Scene[] => [
    {
      // The GM's day: the budget card with Move…, the Lost card, and an Encounter waiting card.
      name: `gm-wilderness-day${theme === 'dark' ? '-dark' : ''}`,
      open: async (page) => {
        if (theme === 'dark') await page.addInitScript(() => localStorage.setItem('grimoire.theme', 'dark'));
        await openFenTrek(page, 'gm', /The Long Fen Road/);
        await expect(page.getByRole('button', { name: 'Move…' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Lost' })).toBeVisible();
        await expect(page.getByRole('region', { name: /^Encounter waiting, / })).toBeVisible();
      },
    },
  ]),
  {
    // The GM's camp: every step, with who hasn't eaten.
    name: 'gm-camp',
    open: async (page) => {
      await openFenTrek(page, 'gm', /The Reed Camp/);
      await expect(page.getByText('Set watches').first()).toBeVisible();
    },
  },
  {
    // The location view (dec-7 5b, page 11 frames 4a to 4c, replacing bq-4's Open card for the GM): the place's page
    // stands on the page at every width; on a phone Move on is in its own bar above the tab bar.
    name: 'gm-location-sheet',
    open: async (page) => {
      await openFenTrek(page, 'gm', /The Long Fen Road/);
      const card = page.getByRole('region', { name: 'Where the party is' });
      await expect(card.getByRole('heading', { name: 'Heron Rise' })).toBeVisible();
      if (page.viewportSize()!.width < 600) await expect(page.locator('.place-page__bar').getByRole('button', { name: 'Move on' })).toBeVisible();
    },
  },
  {
    // The players' side: the shown place as an Open card, its sheet with the description shown (phone); on the page
    // on a tablet.
    name: 'player-location-sheet',
    open: async (page) => {
      await openFenTrek(page, 'player', /The Long Fen Road/);
      if (page.viewportSize()!.width < 600) {
        await page.getByRole('button', { name: /^Where you are: Heron Rise/ }).click();
        await expect(page.getByRole('dialog', { name: 'Where you are' }).getByText(/grey herons/)).toBeVisible();
      } else await expect(page.getByRole('region', { name: 'Where you are' })).toBeVisible();
    },
  },
  {
    // The empty state (bq-4, S6; dec-7 5b, frame 2b): no place yet reads "Where are we?" with Set place, at every width.
    name: 'gm-place-empty',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Wet Road/ }).click();
      await expect(page.getByRole('heading', { name: 'Where are we?' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Set place' })).toBeVisible();
    },
  },
  {
    // The GM's place page at a place that holds spots (dec-7 5b, page 11 frames 1a, 2a, 4a, 8): Locations (p2p-1, was Spots here) as plain
    // rows, Knowledge and Rules, Tables; Move on above the tab bar on a phone.
    name: 'gm-place-page-spots',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&placePage=spots');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      await expect(page.getByRole('region', { name: 'Locations' }).getByText('5. The sea cave')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Tables' }).getByText('On the water')).toBeVisible();
    },
  },
  {
    // At a spot inside it (frames 1b, 4b, 5): the trail, Waiting for you with "Nothing waits.", the jetty's Tables. The
    // places typed as p2p-1 names them (B2, `&kinds=p2p`): the island a Region (plain words), the harbour an Area (a
    // tap that opens its Locations panel).
    name: 'gm-place-page-spot',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&placePage=spot&kinds=p2p');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      await expect(page.getByRole('navigation', { name: 'Where it sits' }).getByRole('button', { name: 'The Drowned Harbour' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '1. The jetty' })).toBeVisible();
      await expect(page.getByRole('button', { name: /From the book, for the GM/ })).toBeVisible();
    },
  },
  {
    // The jetty's book text for the GM opened in place (gt-1; page 15 BT1, home B; the whole Scene's S14): its list and
    // its boxed aside, under the row, above Knowledge and Rules.
    name: 'gm-place-page-book-text',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&placePage=spot');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      await page.getByRole('button', { name: /From the book, for the GM/ }).click();
      await expect(page.getByRole('region', { name: 'From the book, for the GM' }).getByText('If the party asks the ferrymen about the ring.')).toBeVisible();
    },
  },
  {
    // The map wanted (S13, page 11 frames 2c and 4d): the harbour's card asks for it under the head: the map's
    // title, the file's name and "+ Map".
    name: 'gm-place-page-map-wanted',
    open: async (page) => {
      await page.goto('/layout.html?as=gm&placePage=spots&map=wanted');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      await expect(page.getByText('harbour-chart.png')).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Map' })).toBeVisible();
    },
  },
  {
    // The map added (S13, frames 1a and 4a): in the harbour's card, its zoom and its eye; on a phone, "The map".
    name: 'gm-place-page-spots-map',
    open: async (page) => {
      await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
      await page.goto('/layout.html?as=gm&placePage=spots&map=added');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      if (page.viewportSize()!.width < 600) await expect(page.getByRole('button', { name: 'The map' })).toBeVisible();
      else await expect(page.getByRole('region', { name: 'The map' }).getByRole('switch', { name: 'The map shown to the players' })).toBeVisible();
    },
  },
  {
    // At a spot (S13, frames 1b and 4b): the place's map in the right column under "Waiting for you"; on a phone, "The
    // map" in the card.
    name: 'gm-place-page-spot-map',
    open: async (page) => {
      await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
      await page.goto('/layout.html?as=gm&placePage=spot&map=added');
      await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      if (page.viewportSize()!.width < 600) await expect(page.getByRole('button', { name: 'The map' })).toBeVisible();
      else await expect(page.getByRole('region', { name: 'The map' }).getByRole('switch', { name: 'The map shown to the players' })).toBeVisible();
    },
  },
  {
    // Move… on the GM's day: route, terrain, place name, the cost and the checks it sets off.
    name: 'gm-move',
    open: async (page) => {
      await openFenTrek(page, 'gm', /The Long Fen Road/);
      await page.getByRole('button', { name: 'Move…' }).click();
      await expect(page.getByRole('dialog', { name: 'Move the party' })).toBeVisible();
    },
  },
  {
    name: 'guided-creation',
    open: async (page) => {
      await page.goto('/layout.html?as=new');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Create your character' }).click();
      await page.getByRole('button', { name: /^Guided/ }).click();
      await expect(page.getByRole('heading', { name: /^Scores|How do you want to build\?/ })).toBeVisible();
      // Gate walk 2026-11-06: scrolled to the end, the foot's hint and Next sit wholly on the screen with room under
      // them (the shell's bottom room, plus the home bar's on a device), never cut off at the bottom edge.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const height = page.viewportSize()!.height;
      const nextBox = (await page.getByRole('button', { name: 'Next' }).boundingBox())!;
      const hintBox = (await page.getByRole('status', { name: 'Step status' }).boundingBox())!;
      expect(nextBox.y).toBeGreaterThanOrEqual(0);
      expect(nextBox.y + nextBox.height).toBeLessThanOrEqual(height - 32);
      expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(height - 32);
    },
  },
  {
    // Adjust scores (m5b-0c, cr-11): the rule's three buttons per tile, the bank line, the foot.
    name: 'guided-adjust',
    open: async (page) => {
      await page.goto('/layout.html?as=new');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Create your character' }).click();
      await page.getByRole('button', { name: /^Guided/ }).click();
      await page.getByRole('textbox', { name: 'Strength' }).fill('12');
      await page.getByRole('button', { name: 'Next' }).click();
      await chooseOption(page, 'Marsh folk');
      await page.getByRole('checkbox', { name: 'Pick Lantern Warden' }).click();
      await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
    },
  },
  {
    // tf-9: New message's Attach and Send sit together, their bottoms level with the field's, inside the screen.
    name: 'gm-message-compose',
    open: async (page) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: /^Messages/ }).first().click();
      await page.getByRole('button', { name: 'New message' }).click();
      const field = (await page.getByRole('textbox', { name: 'Message', exact: true }).boundingBox())!;
      const attach = (await page.getByRole('button', { name: 'Attach' }).boundingBox())!;
      const send = (await page.getByRole('button', { name: 'Send' }).boundingBox())!;
      const width = page.viewportSize()!.width;
      expect(Math.abs(attach.y + attach.height - (send.y + send.height))).toBeLessThanOrEqual(1);
      expect(send.x + send.width).toBeLessThanOrEqual(width);
      // Beside the field on a wide screen: level with its foot; under it on a phone.
      if (send.y < field.y + field.height) expect(Math.abs(send.y + send.height - (field.y + field.height))).toBeLessThanOrEqual(1);
      else expect(send.y).toBeGreaterThanOrEqual(field.y + field.height);
    },
  },
  {
    // tf-10: the GM reference; on a wide screen the list is 220 px at the left under its two headings.
    name: 'gm-reference',
    open: async (page, wide) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.getByRole('button', { name: 'Reference', exact: true }).click();
      const panels = page.getByRole('navigation', { name: 'Panels' });
      await expect(panels.getByRole('heading', { name: 'From the rules' })).toBeVisible();
      await expect(panels).not.toContainText(/\bpack\b/);
      if (wide) expect(Math.round((await panels.boundingBox())!.width)).toBe(220);
    },
  },
];

for (const size of SIZES) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const wide = size.width >= WIDE;

    for (const scene of SCENES) {
      test(`${scene.name}: no sideways scrolling, taps at least 44px, readable text, accessible`, async ({ page }) => {
        await scene.open(page, wide);
        await page.screenshot({ path: `test-results/layout-screens/${scene.name}-${size.width}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        // A4 (M5 gate): no screen opens with the cursor in a text field (so no keyboard pops up by itself).
        const focused = await page.evaluate(() => {
          // A field that brings up the keyboard: a text area, an editable block, or an input you type into (a
          // checkbox the scene's own steps tapped doesn't count).
          const el = document.activeElement as HTMLElement | null;
          const typed = el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'].includes(el.type);
          return el && (typed || el.tagName === 'TEXTAREA' || el.isContentEditable) ? el.outerHTML.slice(0, 120) : null;
        });
        expect(focused).toBeNull();
      });
    }

    // M5b step 1 follow-up, build order 7 (06 "Wilderness day"): on a landscape tablet the GM's day controls sit left
    // and the location view right; narrower, they stack with the place below the travel card, on a phone too (the
    // place's page, dec-7 5b, frame 4c).
    test(`the GM's wilderness day puts the place ${size.width >= 1024 ? 'beside' : 'below'} the day controls`, async ({ page }) => {
      await page.goto('/layout.html?as=gm');
      await page.getByRole('button', { name: /The Wet Road/ }).click();
      const travel = await page.getByRole('region', { name: "The party's travel" }).boundingBox();
      const where = page.getByRole('region', { name: 'Where the party is' });
      const place = await where.boundingBox();
      expect(travel && place).toBeTruthy();
      if (size.width >= 1024) expect(travel!.x + travel!.width).toBeLessThanOrEqual(place!.x);
      else expect(travel!.y + travel!.height).toBeLessThanOrEqual(place!.y);
    });

    // The GM's place page on a phone (dec-7 5b, the #785 review): the Undo toast rises above Move on's bar, never over it.
    if (size.width < 600) {
      test("the place page's Undo toast sits above Move on's bar", async ({ page }) => {
        await page.goto('/layout.html?as=gm&placePage=spots');
        await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
        await page.getByRole('button', { name: 'Hide from players' }).first().click();
        const toast = page.locator('.toast').filter({ hasText: /Hidden from the party/ });
        await expect(toast).toBeVisible();
        const [box, bar] = await Promise.all([toast.boundingBox(), page.locator('.place-page__bar').boundingBox()]);
        expect(box && bar).toBeTruthy();
        expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
      });
    }

    test(`Add item opens ${wide ? 'beside the pack, in the right-hand column' : 'over the whole screen'}`, async ({ page }) => {
      await openPack(page);
      await page.getByRole('button', { name: 'Add item' }).click();
      const adding = await page.getByRole('region', { name: 'Add an item' }).boundingBox();
      if (wide) {
        const pack = await page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' }).boundingBox();
        expect(adding && pack).toBeTruthy();
        expect(pack!.x + pack!.width).toBeLessThanOrEqual(adding!.x);
      } else {
        await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toHaveCount(0);
      }
    });
    for (const scheme of size.width < 600 ? (['light', 'dark'] as const) : []) {
      test(`the bottom tabs are solid, not see-through (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await openPack(page);
        const tabs = page.getByRole('navigation', { name: 'Main' });
        const background = await tabs.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(background).not.toBe('rgba(0, 0, 0, 0)');
        expect(background).not.toBe('transparent');
      });
    }

    // Same sections everywhere (2026-10-23): bottom tabs on a phone, tabs at the top on a tablet in portrait, the
    // left column on a tablet in landscape; the same names, order and icons.
    const where = wide ? 'a column on the left' : size.width >= 600 ? 'tabs above the content' : 'tabs at the bottom';
    const placed = async (page: Page, label: string, names: (string | RegExp)[], content: RegExp | string) => {
      const nav = page.getByRole('navigation', { name: label });
      // The fold is the divider handle beside the column (lr-4), never a row in it; tabs at the top or bottom have none.
      await expect(nav.getByRole('button')).toHaveText(names);
      expect(await nav.locator('svg:visible').count()).toBe(names.length);
      if (wide) await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeVisible();
      else await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeHidden();
      const box = (await nav.boundingBox())!;
      const main = (await page.getByRole('heading', { name: content }).first().boundingBox())!;
      if (wide) expect(box.x + box.width).toBeLessThanOrEqual(main.x);
      else if (size.width >= 600) expect(box.y + box.height).toBeLessThanOrEqual(main.y);
      else expect(Math.round(box.y + box.height)).toBe(size.height);
    };

    test(`the GM's sections are ${where}: Scene, Players, Rules${size.width < 600 ? ', Log' : ''}`, async ({ page }) => {
      // The menu opened on this device before (mn-1: folded is the default for anyone who hasn't chosen).
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await expect(gmTab(page, 'Scene')).toHaveAttribute('aria-current', 'page');
      await gmPlayers(page);
      // On a phone (Design on #549) the GM's bar adds Log, and what waits is a badge (its figure before the name).
      const names = size.width < 600 ? ['Scene', /^(\d+\+?)?Players$/, 'Rules', 'Log'] : ['Scene', /^Players(, \d+ waiting)?$/, 'Rules'];
      await placed(page, 'Campaign sections', names, 'Players and characters');
    });

    // On a phone (under 600 px) the player's tab bar adds Log (final drafts A11, slice E; mockup creation/17).
    const playerTabs = size.width < 600 ? ['Player', 'Scene', 'Pack', 'Log'] : ['Player', 'Scene', 'Pack'];
    test(`the player's sections are ${where}: ${playerTabs.join(', ')}`, async ({ page }) => {
      // The menu opened on this device before (mn-1: folded is the default for anyone who hasn't chosen).
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await placed(page, 'Main', playerTabs, /^Hit points$|Wren of the Lantern Wardens/);
    });

    // B15 (M5 gate), lr-4 (2026-11-02): on a landscape tablet the divider between the GM's column and the page is the
    // handle: a 44 px-wide zone on the column's edge with a quiet pill at mid-height. A tap folds the column to icons,
    // giving the console the width; it stays folded after a reload; a drag short of half changes nothing.
    if (wide) {
      test("the divider folds the GM's column to icons, stays folded after a reload, and a short drag does nothing", async ({ page }) => {
        // The menu opened on this device before (mn-1: folded is the default for anyone who hasn't chosen). Only on the
        // first load: the reload below must find the fold the handle kept.
        await page.addInitScript(() => {
          if (localStorage.getItem('grimoire.navCollapsed') === null) localStorage.setItem('grimoire.navCollapsed', 'no');
        });
        await page.goto('/layout.html?as=gm');
        await campaignRow(page).click();
        const nav = page.getByRole('navigation', { name: 'Campaign sections' });
        const open = (await nav.boundingBox())!;
        const handle = page.getByRole('button', { name: 'Fold the menu' });
        const zone = (await handle.boundingBox())!;
        expect(Math.round(zone.width)).toBe(44);
        // The zone straddles the column's right edge, beside the tabs, not over them (8 px clear: playerAuditRail.spec.ts).
        expect(zone.x).toBeGreaterThanOrEqual(open.x + open.width - 1);
        const pill = (await handle.locator('.divider-handle__pill').boundingBox())!;
        // The grip (plan dec-14 row 1, frame 38-1): 24 by 44.
        expect([Math.round(pill.width), Math.round(pill.height)]).toEqual([24, 44]);
        // A drag left by a quarter of the column: nothing happens.
        const midX = zone.x + zone.width / 2;
        const midY = pill.y + pill.height / 2;
        await page.mouse.move(midX, midY);
        await page.mouse.down();
        await page.mouse.move(midX - open.width / 4, midY, { steps: 4 });
        await page.mouse.up();
        await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeVisible();
        await handle.click();
        await expect(page.getByRole('button', { name: 'Show the menu' })).toBeVisible();
        const folded = (await nav.boundingBox())!;
        expect(folded.width).toBeLessThan(open.width);
        await expect(nav.getByRole('button', { name: 'Rules' })).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        await page.reload();
        await campaignRow(page).click();
        await expect(page.getByRole('button', { name: 'Show the menu' })).toBeVisible();
      });

      test("the divider folds the player's column too", async ({ page }) => {
        // The menu opened on this device before (mn-1: folded is the default for anyone who hasn't chosen).
        await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
        await page.goto('/layout.html?as=player');
        await campaignRow(page).click();
        const nav = page.getByRole('navigation', { name: 'Main' });
        const open = (await nav.boundingBox())!;
        await page.getByRole('button', { name: 'Fold the menu' }).click();
        await expect(page.getByRole('button', { name: 'Show the menu' })).toBeVisible();
        expect((await nav.boundingBox())!.width).toBeLessThan(open.width);
        expect(await layoutProblems(page)).toEqual([]);
      });

      // mn-1 (Francis, 2026-11-14): someone who has never chosen sees the menu folded to its icons, the GM and a
      // player alike, and the handle opens it.
      for (const who of ['gm', 'player'] as const) {
        test(`a new ${who === 'gm' ? 'GM' : 'player'} sees the menu folded to its icons, and the handle opens it`, async ({ page }) => {
          await page.goto(`/layout.html?as=${who}`);
          await campaignRow(page).click();
          const nav = page.getByRole('navigation', { name: who === 'gm' ? 'Campaign sections' : 'Main' });
          await expect(nav).toHaveClass(/section-nav--collapsed/);
          const folded = (await nav.boundingBox())!;
          expect(await layoutProblems(page)).toEqual([]);
          await page.getByRole('button', { name: 'Show the menu' }).click();
          await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeVisible();
          expect((await nav.boundingBox())!.width).toBeGreaterThan(folded.width);
        });
      }
    }

    test('the log opens full screen from the top row, and closing it keeps the place', async ({ page }) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
      // The page stays where it was behind the log. (An item no longer opens inline under its row: since plan
      // m5b-players-screens-standard C it opens as a Sheet over the page at every width, so the Pack is left as it is.)
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.getByRole('button', { name: 'Log', exact: true }).click();
      const scrolled = await page.evaluate(() => window.scrollY);
      const panel = (await page.getByRole('dialog', { name: 'Log' }).boundingBox())!;
      expect(Math.round(panel.x)).toBe(0);
      expect(Math.round(panel.y)).toBe(0);
      expect(Math.round(panel.width)).toBe(size.width);
      expect(Math.round(panel.height)).toBe(size.height);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog', { name: 'Log' })).toHaveCount(0);
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolled)).toBeLessThanOrEqual(1);
    });

    test('at the largest text, the This device switches show every word whole', async ({ page }) => {
      await larger(page);
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      await deviceMenu(page);
      for (const group of ['Theme', 'Text size']) {
        const cut = await page
          .getByRole('group', { name: group })
          .getByRole('button')
          .evaluateAll((buttons) => buttons.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
        expect(cut).toEqual([]);
      }
    });

    test(`the full sheet is ${wide ? 'beside the Player screen, without repeating it' : 'its rows, not its page, on the Player screen'}`, async ({ page }) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      // The Player screen's HP figure (its tap types a value, ruled 2026-11-08).
      const hp = page.getByRole('button', { name: /^Hit points .*(Type a value|Type them)$/ });
      // The sheet's rows beside, with no heading (tfr-4).
      const sheet = page.locator('.player__right');
      await expect(hp).toBeVisible();
      if (wide) {
        await expect(sheet).toBeVisible();
        // No party list on the Player screen: it lives on Scene (dec-13 C1, ps-4).
        await expect(page.getByRole('heading', { name: 'The party' })).toHaveCount(0);
        // The name and portrait show once, on the left; the sheet doesn't repeat them.
        await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens' })).toHaveCount(1);
        // Nothing the play column shows is repeated (ruled 2026-10-26): no second HP or AC, no second Combat heading.
        await expect(sheet.getByRole('button', { name: /^Hit points/ })).toHaveCount(0);
        await expect(sheet.getByRole('button', { name: /^(AC|Armour class) / })).toHaveCount(0);
        await expect(sheet.getByRole('heading', { name: 'Combat' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Combat' })).toHaveCount(0);
        const left = await hp.boundingBox();
        const right = await sheet.boundingBox();
        expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
      } else {
        // On a phone the rows stand where the one row "Full character sheet" was (tfr-5); the page itself is the menu's.
        await expect(page.getByRole('button', { name: 'Full character sheet' })).toHaveCount(0);
        await expect(page.locator('.player .sheet--beside').getByRole('button', { name: 'Notes' })).toBeVisible();
      }
    });

    // Hit points in place (ruled 2026-11-08, mockup players/04 C): the figure at the left, − and + together at the right,
    // 56 px squares 8 px apart; a tap applies at once with the toast; the figure's tap opens the typing Sheet.
    test('hit points in place: the figure left, − and + at the right, 56 px and 8 px apart', async ({ page }) => {
      await page.goto('/layout.html?as=player');
      await campaignRow(page).click();
      const box = page.getByRole('group', { name: 'Hit points' });
      await expect(box).toBeVisible();
      const figure = (await box.getByRole('button', { name: /^Hit points .*Type a value$/ }).boundingBox())!;
      const minus = (await box.getByRole('button', { name: 'Take 1 damage' }).boundingBox())!;
      const plus = (await box.getByRole('button', { name: 'Heal 1' }).boundingBox())!;
      for (const square of [minus, plus]) {
        expect(Math.round(square.width)).toBeGreaterThanOrEqual(56);
        expect(Math.round(square.height)).toBeGreaterThanOrEqual(56);
      }
      expect(minus.x).toBeGreaterThanOrEqual(figure.x + figure.width);
      expect(plus.x - (minus.x + minus.width)).toBeGreaterThanOrEqual(7.5);
      expect(Math.abs(minus.y - plus.y)).toBeLessThan(1);
      await box.getByRole('button', { name: 'Take 1 damage' }).click();
      await expect(page.getByText(/^Took 1 damage, /)).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      await box.getByRole('button', { name: /^Hit points .*Type a value$/ }).click();
      await expect(page.getByRole('dialog', { name: 'Hit points' })).toBeVisible();
      expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
    });

    // The Tome sign-in (mockup brand/01 option A; Design on #561, superseding N1 only on a screen at least 700 px tall):
    // the wordmark block starts about a third of the way down, and the email field is still on the first screen. Every
    // size here is that tall; a short screen keeps N1 (below).
    test('sign-in: the wordmark starts about a third of the way down, and the email field is on the first screen', async ({ page }) => {
      await page.goto('/layout.html');
      const mark = (await page.locator('.wordmark--welcome').boundingBox())!;
      expect(mark.y).toBeGreaterThan(size.height * 0.25);
      expect(mark.y).toBeLessThan(size.height * 0.36);
      const email = (await page.getByLabel('Email').boundingBox())!;
      expect(email.y + email.height).toBeLessThanOrEqual(size.height);
    });
  });
}

// N1 (M4b re-test, 2026-10-28), kept for a short screen (Design's ruling on #561: under 700 px tall): on a phone the
// sign-in sat a third of the way down and the keyboard covered the name and the email field. On a short screen it
// sits high: the field is in the top part of the screen.
for (const size of [{ name: 'short phone', width: 375, height: 667 }]) {
  test.describe(`sign-in on a ${size.name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test('sign-in sits high, so the name and the email field stay above the keyboard', async ({ page }) => {
      await page.goto('/layout.html');
      const email = (await page.getByLabel('Email').boundingBox())!;
      expect(email.y + email.height).toBeLessThan(size.height * 0.45);
    });
  });
}

// The sticky top row (ruled 2026-10-23), at the largest text: scroll a long page and the row stays at the top with
// the back link, Log and ⋯, whole and uncovered; the screen's title has scrolled away; Log and ⋯ work from it and
// the page keeps its place. Phone landscape too, the shortest screen.
// A tap where the button is on screen. (Playwright's click scrolls a button "into view" first, and treats one in the
// sticky row as needing it; a finger doesn't.)
const tap = async (page: Page, button: ReturnType<Page['locator']>) => {
  const box = (await button.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

for (const size of [...SIZES, { name: 'phone-landscape', width: 844, height: 390 }]) {
  test.describe(`${size.name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    // On a phone (slice E; Design on #549) the back link is ≡, Log is in the tab bar and the drawer holds the ⋯'s
    // items, so the row holds ≡ (and ✉).
    const phone = size.width < 600;
    test(`the top row stays at the top of a long page, with ${phone ? '≡ (Log in the tab bar, no ⋯)' : 'the back link, Log and ⋯'}`, async ({ page }) => {
      await larger(page);
      await openPack(page);
      // A long Pack: room below to scroll on a tall iPad.
      await page.evaluate(() => document.querySelector('.player')!.append(Object.assign(document.createElement('div'), { style: 'height: 1500px' })));
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const scrolled = await page.evaluate(() => window.scrollY);
      expect(scrolled).toBeGreaterThan(0);

      const row = page.locator('.top-row');
      const bar = (await row.boundingBox())!;
      expect(Math.round(bar.y)).toBe(0);
      // The title is the standard bar's (plan A1; the Pack's own heading is for screen readers only since slice C).
      const title = (await row.locator('.top-row__title', { hasText: 'Wren of the Lantern Wardens’ pack' }).boundingBox())!;
      expect(title.y + title.height).toBeLessThanOrEqual(bar.y + bar.height);

      const back = phone ? row.getByRole('button', { name: 'Menu' }) : row.getByRole('button', { name: /^‹/ });
      const log = phone ? page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log' }) : row.getByRole('button', { name: 'Log', exact: true });
      const more = row.getByRole('button', { name: 'Character options' });
      if (phone) await expect(row.getByRole('button', { name: 'Log', exact: true })).toHaveCount(0);
      if (phone) await expect(more).toHaveCount(0);
      const inRow = phone ? [back] : [back, log, more];
      const boxes = await Promise.all(inRow.map(async (b) => (await b.boundingBox())!));
      for (const box of boxes) {
        expect(box.height).toBeGreaterThanOrEqual(43.5);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      }
      // Side by side, not overlapping; and nothing on the page shows over them.
      for (let i = 1; i < boxes.length; i++) expect(boxes[i - 1]!.x + boxes[i - 1]!.width).toBeLessThanOrEqual(boxes[i]!.x);
      const covered = await row.evaluate((el) =>
        [...el.querySelectorAll('button')].filter((b) => {
          const r = b.getBoundingClientRect();
          return !el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }).length,
      );
      expect(covered).toBe(0);

      await tap(page, log);
      await expect(page.getByRole('dialog', { name: 'Log' })).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog', { name: 'Log' })).toHaveCount(0);
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolled)).toBeLessThanOrEqual(1);

      if (phone) {
        // ≡ opens the drawer over the page, which keeps its place.
        await tap(page, back);
        await expect(page.getByRole('dialog', { name: /The Drowned Marches/ })).toBeVisible();
        await page.keyboard.press('Escape');
        expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolled)).toBeLessThanOrEqual(1);
        return;
      }
      await tap(page, more);
      await expect(page.getByRole('group', { name: 'Text size' })).toBeVisible();
      // Its options are 48 px rows with no gaps, each with its symbol beside the words (ruled 2026-10-26).
      const rows = await page.locator('.more-menu__item').evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const symbol = el.querySelector('.more-menu__symbol')!.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height, symbolInside: symbol.left >= r.left && symbol.right < r.right, words: (el.textContent ?? '').trim().length };
        }),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.height).toBeGreaterThanOrEqual(48);
        expect(row.symbolInside).toBe(true);
        expect(row.words).toBeGreaterThan(0);
      }
      expect(Math.round(rows[1]!.top - rows[0]!.bottom)).toBe(0);
      // The whole menu can be reached: it ends on screen, and its last option scrolls into view inside it.
      // ⋯ is a Sheet on these screens since the standard (plan m5b-players-screens-standard A1).
      const menu = page.getByRole('dialog', { name: 'More' });
      expect(Math.round((await menu.boundingBox())!.y + (await menu.boundingBox())!.height)).toBeLessThanOrEqual(size.height);
      const last = menu.getByRole('button').last();
      await last.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
      const lastBox = (await last.boundingBox())!;
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(size.height);
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolled)).toBeLessThanOrEqual(1);
    });

    // What sticks below the bar sits under it, never behind it (2026-10-23).
    const barBottom = async (page: Page) => {
      const bar = (await page.locator('.top-row').boundingBox())!;
      return bar.y + bar.height;
    };
    const longer = (page: Page, selector: string) =>
      page.evaluate((sel) => document.querySelector(sel)!.append(Object.assign(document.createElement('div'), { style: 'height: 2000px' })), selector);

    test('Add item’s search stays just below the bar as the list scrolls', async ({ page }) => {
      await larger(page);
      await openPack(page);
      await page.getByRole('button', { name: 'Add item' }).click();
      await longer(page, '[aria-label="Add an item"]');
      await page.evaluate(() => window.scrollTo(0, 900));
      const search = (await page.getByLabel('Search items').boundingBox())!;
      expect(search.y).toBeGreaterThanOrEqual((await barBottom(page)) - 1);
      expect(search.y + search.height).toBeLessThanOrEqual(size.height);
    });

    if (size.width >= WIDE) {
      test('the landscape tab column and the GM’s side column stay below the bar', async ({ page }) => {
        await openPack(page);
        await longer(page, '.player');
        await page.evaluate(() => window.scrollTo(0, 900));
        const tabs = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
        expect(tabs.y).toBeGreaterThanOrEqual((await barBottom(page)) - 1);

        await page.goto('/layout.html?as=gm');
        await campaignRow(page).click();
        await gmPlayers(page);
        await expect(page.getByRole('heading', { name: 'Players and characters' })).toBeVisible();
        await longer(page, '.gm');
        await page.evaluate(() => window.scrollTo(0, 900));
        const side = (await page.locator('.gm__side').boundingBox())!;
        expect(side.y).toBeGreaterThanOrEqual((await barBottom(page)) - 1);
      });
    } else {
      // Plan m5b-players-screens-standard D: Edit moved to the sheet's foot, beside Back; the bar keeps Log and ⋯.
      test('on the full sheet, the bar stays at the top and Edit sits in the foot beside Back', async ({ page }) => {
        await larger(page);
        await page.goto('/layout.html?as=player');
        await campaignRow(page).click();
        await campaignMenu(page);
        await page.getByRole('dialog').getByRole('button', { name: 'Full character sheet', exact: true }).click();
        await longer(page, '.sheet');
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const row = page.locator('.top-row');
        expect(Math.round((await row.boundingBox())!.y)).toBe(0);
        await expect(row.getByRole('button', { name: 'Edit' })).toHaveCount(0);
        const foot = page.locator('.sheet__foot');
        const edit = (await foot.getByRole('button', { name: 'Edit' }).boundingBox())!;
        const back = (await foot.getByRole('button', { name: 'Back', exact: true }).boundingBox())!;
        expect(edit.height).toBeGreaterThanOrEqual(43.5);
        expect(back.x + back.width).toBeLessThanOrEqual(edit.x);
        expect(edit.x + edit.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      });
    }
  });
}

// The landscape rule for list-and-detail screens (ruled 2026-10-24): the list on the left, about a third (06, landscape rule);
// the right side never empty; item details as a centred card.
test.describe('landscape tablet (1180×820): the Pack', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  // Since the players' screens took the standard (plan m5b-players-screens-standard A4) an item opens as a Sheet: on a
  // tablet beside what was tapped, whole on screen.
  test("the player's Pack keeps the load on the right, and an item opens as a sheet, whole on screen", async ({ page }) => {
    // The menu opened on this device before: the "right half" measure below is taken beside the open menu (folded, the
    // default since mn-1, moves both columns left and the load's column then starts at 587 px, just short of half).
    await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
    await page.goto('/layout.html?as=player');
    await page.getByRole('button', { name: /The Drowned Marches/ }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
    const summary = (await page.locator('.player__aside .pack__summary').boundingBox())!;
    expect(summary.x).toBeGreaterThan(1180 / 2);
    await page.getByRole('button', { name: /Quilted coat/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Quilted coat' });
    await expect(dialog).toHaveClass(/dialog--sheet/);
    const card = (await dialog.boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(1180);
    expect(card.y + card.height).toBeLessThanOrEqual(820);
  });

  // The same rule with the menu folded (the default since mn-1; review of #848): measured against the rule itself
  // (docs/06, the landscape rule), not the half-screen line: the load starts right of the list column, and the list
  // column is about a third (06, landscape rule): within 3 px of it, since the folded rail grew by 12 px (plan dec-14
  // row 1, frame 38-1: 44 px tabs and the handle 8 px clear) and the list gives up 2/5 of that.
  test("the player's Pack with the menu folded keeps the list about a third (06, landscape rule) and the load to its right", async ({ page }) => {
    await page.goto('/layout.html?as=player');
    await page.getByRole('button', { name: /The Drowned Marches/ }).click();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveClass(/section-nav--collapsed/);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
    const summary = (await page.locator('.player__aside .pack__summary').boundingBox())!;
    const list = (await page.locator('.player__pane').boundingBox())!;
    expect(list.width).toBeGreaterThanOrEqual(1180 / 3 - 3);
    expect(summary.x).toBeGreaterThanOrEqual(list.x + list.width);
  });

  test("the GM's Inventory lists whose pack on the left (the Party stash first) and shows that pack on the right", async ({ page }) => {
    await page.goto('/layout.html?as=gm');
    await page.getByRole('button', { name: /The Drowned Marches/ }).click();
    await gmPlayers(page);
    await page.getByRole('button', { name: 'Inventory' }).click();
    const whose = page.getByRole('group', { name: 'Whose pack' });
    await expect(whose.getByRole('button').first()).toHaveText('Party stash');
    const list = (await whose.boundingBox())!;
    const title = (await page.getByRole('heading', { name: 'Party stash' }).boundingBox())!;
    expect(list.width).toBeGreaterThan(1180 / 6);
    expect(title.x).toBeGreaterThan(list.x + list.width);
  });
});

// What the folded rail keeps (mn-2, ap-17; mockup december/16, frame T13): at 1024 px, folded, the GM's rail keeps the
// campaign's sigil at its top (a 44 px tap named with the campaign that opens the menu) and, for a retired campaign, a
// Retired mark under it whose pop-up has the banner's words and Bring back. A 60-character name and a sigil picture
// (?railSigil=1) must not push the rail wider than its icons or the page sideways.
test.describe('landscape tablet (1024×768): what the folded rail keeps', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  // The stand-in files' address serves an invented sigil picture, so the sigil shows as a picture, not a letter.
  const SIGIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#5b3a29"/><path d="M12 8h16v22l-8-5-8 5z" fill="#e8d9b5"/></svg>';
  const open = async (page: Page, retired: boolean) => {
    await page.route('https://files.example/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: SIGIL }));
    await page.goto('/layout.html?as=gm&railSigil=1');
    if (retired) {
      await page.getByText('Retired: 1').click();
      await page.getByRole('button', { name: /The Old Fen Road/ }).click();
    } else await campaignRow(page).click();
    await expect(page.getByRole('navigation', { name: 'Campaign sections' })).toHaveClass(/section-nav--collapsed/);
  };
  const atLeastATap = (box: { width: number; height: number }) => {
    expect(box.width).toBeGreaterThanOrEqual(43.5);
    expect(box.height).toBeGreaterThanOrEqual(43.5);
  };

  test('folded, the sigil heads the rail, a 44 px tap named with the campaign, and opens the menu', async ({ page }) => {
    await open(page, false);
    const sigil = page.getByRole('button', { name: 'The Drowned Marches of the Lantern Coast: open the menu' });
    await expect(sigil).toBeVisible();
    await expect(sigil.locator('img')).toBeVisible();
    const box = (await sigil.boundingBox())!;
    atLeastATap(box);
    const nav = (await page.getByRole('navigation', { name: 'Campaign sections' }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
    // A live campaign has no Retired mark.
    await expect(page.getByRole('button', { name: /^Retired campaign/ })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/layout-screens/mn2-folded-1024.png' });
    expect(await layoutProblems(page)).toEqual([]);
    expect(await accessibilityProblems(page)).toEqual([]);
    await sigil.click();
    await expect(page.getByRole('button', { name: 'Fold the menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the campaign sigil' })).toBeVisible();
    await expect(sigil).toHaveCount(0);
    await page.screenshot({ path: 'test-results/layout-screens/mn2-opened-1024.png' });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`folded and retired (${scheme}): the Retired mark under the sigil, a 60-character name, nothing overflows`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, true);
      const sigil = page.getByRole('button', { name: /: open the menu$/ });
      const name = (await sigil.getAttribute('aria-label'))!.replace(/: open the menu$/, '');
      expect(name).toHaveLength(60);
      const mark = page.getByRole('button', { name: 'Retired campaign: read more' });
      await expect(mark).toHaveText('Retired');
      await expect(mark.locator('svg')).toBeVisible();
      // The lock is drawn, not an empty mark.
      expect(await mark.locator('svg').locator('path, rect').count()).toBeGreaterThan(0);
      const [s, m, nav, side, main] = await Promise.all([
        sigil.boundingBox(),
        mark.boundingBox(),
        page.getByRole('navigation', { name: 'Campaign sections' }).boundingBox(),
        page.locator('.gm__side').boundingBox(),
        page.locator('.gm__main').boundingBox(),
      ]);
      atLeastATap(s!);
      atLeastATap(m!);
      // The sigil, then the mark, then the sections; all inside the rail, the rail left of the page.
      expect(s!.y + s!.height).toBeLessThanOrEqual(m!.y);
      expect(m!.y + m!.height).toBeLessThanOrEqual(nav!.y);
      for (const part of [s!, m!]) expect(part.x + part.width).toBeLessThanOrEqual(side!.x + side!.width);
      expect(side!.x + side!.width).toBeLessThanOrEqual(main!.x);
      // The rail stays as narrow as its icons and the handle's zone: the mark doesn't widen it past two taps.
      expect(side!.width).toBeLessThanOrEqual(88);
      await page.screenshot({ path: `test-results/layout-screens/mn2-retired-folded-1024-${scheme}.png` });
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);

      // A tap on the mark: the small pop-up with the banner's words and Bring back, whole on screen.
      await mark.click();
      const popUp = page.getByRole('dialog', { name: 'Retired campaign' });
      await expect(popUp).toBeVisible();
      await expect(popUp.getByText(/Everyone can still read it, but nothing in it can change\./)).toBeVisible();
      await expect(popUp.getByRole('button', { name: 'Bring back' })).toBeVisible();
      const card = (await popUp.boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(1024);
      expect(card.y + card.height).toBeLessThanOrEqual(768);
      expect(await accessibilityProblems(page)).toEqual([]);
      await page.screenshot({ path: `test-results/layout-screens/mn2-popup-1024-${scheme}.png` });

      // Closed again, the sigil opens the menu: the heading and the banner with its Bring back, as before.
      await page.keyboard.press('Escape');
      await expect(popUp).toHaveCount(0);
      await sigil.click();
      const banner = page.getByRole('note', { name: 'Retired campaign' });
      await expect(banner).toBeVisible();
      await expect(banner.getByRole('button', { name: 'Bring back' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retired campaign: read more' })).toHaveCount(0);
      expect(await layoutProblems(page)).toEqual([]);
      await page.screenshot({ path: `test-results/layout-screens/mn2-retired-opened-1024-${scheme}.png` });
    });
  }
});

// M5 gate fix (gate items 7, 8): on the iPad in landscape the Player screen's column scrolls on its own; a pop-up
// opened from it (+ Status, a skill's details) opens over the whole screen, centred and uncovered, not inside the column.
// Since plan m5b-players-screens-standard D the skills sit in the sheet beside the column (folded), so the skill's
// details are opened from there.
test.describe('landscape tablet (1024×768): pop-ups on the Player screen', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  const overTheScreen = async (page: Page, name: string | RegExp) => {
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    // A Sheet since the standard (plan m5b-players-screens-standard A4): beside what was tapped, whole on screen.
    await expect(dialog).toHaveClass(/dialog--sheet/);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1024);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(768);
    // Nothing covers it: near each corner (inside the rounding) and its middle, the pop-up is what's there.
    const uncovered = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const points = [[r.left + 24, r.top + 24], [r.right - 24, r.top + 24], [r.left + 24, r.bottom - 24], [r.right - 24, r.bottom - 24], [r.left + r.width / 2, r.top + r.height / 2]];
      return points.every(([x, y]) => el.contains(document.elementFromPoint(x!, y!)));
    });
    expect(uncovered).toBe(true);
    // It opens on the page itself, not inside the column (desktop WebKit draws it whole either way; Safari on the
    // iPad clipped it to the column, so this is what guards the fix).
    expect(await dialog.evaluate((el) => el.closest('.player__pane') === null)).toBe(true);
  };

  // C1 (M5 gate): a player has no + Status (the GM's), so only a skill's details are checked here.
  test('a skill’s details fit on screen, nothing clipped by the column; the player has no + Status', async ({ page }) => {
    await page.goto('/layout.html?as=player&skills=1');
    await campaignRow(page).click();
    const skills = page.locator('.player__aside').getByRole('region', { name: 'Skills' });
    await expect(skills).toBeVisible();
    await expect(page.locator('.player__pane').getByRole('region', { name: 'Skills' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Add a status to / })).toHaveCount(0);
    await openSheetFold(skills);
    // Skills sit low in the sheet, so it's scrolled first, as on the iPad.
    const skill = skills.getByRole('button', { name: /^Hide in reeds/ });
    await skill.scrollIntoViewIfNeeded();
    await skill.click();
    await overTheScreen(page, 'Hide in reeds');
  });
});

// Encounter tables, full screen (M5b step g3, B2) at 375px: long rows wrap (no sideways scroll), and the Go to number
// box stays on screen and usable on a d100 table.
test.describe('phone (375×667): the table, full screen', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  for (const name of ['gm-which-table', 'gm-table-long', 'gm-table-columns', 'gm-tables-library']) {
    test(`${name}: fits at 375px, taps at least 44px, accessible`, async ({ page }) => {
      await SCENES.find((s) => s.name === name)!.open(page, false);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
  test('Go to number stays reachable at the top of a long table', async ({ page }) => {
    await SCENES.find((s) => s.name === 'gm-table-long')!.open(page, false);
    const box = await page.getByLabel('Go to number').boundingBox();
    expect(box).toBeTruthy();
    await page.getByLabel('Go to number').scrollIntoViewIfNeeded();
    await page.getByLabel('Go to number').fill('99');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.getByRole('radio', { name: /50th sluice/ })).toBeInViewport();
  });
});

// An encounter table's page in the book's tapped table (sf-14; page 44, ET1): capped at 640 px on a tablet, the whole
// width at 375 px; every row a 44 px tap; a long row wraps, never cut; light and dark.
for (const size of [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 375, height: 667 },
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${size.name} ${theme}: an encounter table's page (sf-14)`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
      test('the tapped table is capped at 640 px, its rows 44 px taps, long rows wrapped', async ({ page }) => {
        await SCENES.find((s) => s.name === 'gm-table-long')!.open(page, size.width >= WIDE);
        const table = page.locator('.table-rows__book');
        await expect(table).toBeVisible();
        const box = (await table.boundingBox())!;
        expect(box.width).toBeLessThanOrEqual(640);
        if (size.name === 'phone') expect(box.width).toBeGreaterThan(300);
        for (const row of await table.getByRole('radio').all()) {
          const r = (await row.boundingBox())!;
          if (r.height > 0) expect(r.height).toBeGreaterThanOrEqual(44);
          expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        }
        expect(await layoutProblems(page)).toEqual([]);
      });
    });
  }
}

// The back link at 375 px (gate walk, Francis 2026-11-05): "‹ Your campaigns" was cut to "‹ Your campaig…"; on a
// phone it reads "‹ Campaigns", whole, never ellipsised. From slice E the campaign screen's top level has ≡ and the
// campaign's name instead (the drawer's Your campaigns goes back), so the link is checked on Rules library, which keeps it.
test.describe('phone (375×667): the back link and ≡', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test('the campaign screen has ≡ and its name; a screen outside it reads "‹ Campaigns" in full', async ({ page }) => {
    await page.goto('/layout.html?as=gm');
    await campaignRow(page).click();
    await expect(page.locator('.top-row').first().getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(page.locator('.top-row__back')).toHaveCount(0);
    await expect(page.locator('.top-row__title').first()).not.toBeEmpty();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Your campaigns' }).click();
    await page.getByRole('button', { name: 'Account and device options' }).click();
    await page.getByRole('button', { name: 'Rules library' }).click();
    const back = page.locator('.top-row__back').first();
    await expect(back).toHaveText('‹ Campaigns');
    expect(await back.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});

// Score tiles (m5b-0c second test, PR D, 2026-11-02): the number field 64 px and never shrinking, so a two-digit score
// never clips; −, the number and + on one line; every tile the same height; room for four 212 px tiles on a row on an
// iPad in landscape (1024); two per row on a phone (ruled B, 2026-11-02: 4 px between the controls, the tiles'
// exception to the 8 px rule), every control still at least 44 px.
// On a phone, from the creation rework (cw-11, mockup creation/12): one ability per row, the name and the stepper in line.
// The column fills the screen (Design on #555): three across on an iPad upright, four past 1000 px.
for (const size of [{ width: 1024, height: 768, perRow: 4 }, { width: 820, height: 1180, perRow: 3 }, { width: 375, height: 667, perRow: 1 }]) {
  test.describe(`score tiles at ${size.width}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test('a two-digit score never clips; the controls stay on one line; the tiles are one height', async ({ page }) => {
      await SCENES.find((s) => s.name === 'guided-creation')!.open(page, size.width >= WIDE);
      for (const box of await page.locator('.score-tile .typed-stepper__input').all()) await box.fill('18');
      const tiles = await page.locator('.score-tile').evaluateAll((els) =>
        els.map((tile) => {
          const input = tile.querySelector('input')!;
          const controls = [...tile.querySelectorAll('.score-tile__value .typed-stepper > *')];
          const tops = controls.map((el) => Math.round(el.getBoundingClientRect().top));
          const inside = controls.every((el) => el.getBoundingClientRect().left >= tile.getBoundingClientRect().left && el.getBoundingClientRect().right <= tile.getBoundingClientRect().right);
          const smallest = Math.min(...controls.map((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)));
          return { top: Math.round(tile.getBoundingClientRect().top), width: tile.getBoundingClientRect().width, height: tile.getBoundingClientRect().height, input: input.getBoundingClientRect().width, clips: input.scrollWidth > input.clientWidth + 1, tops, inside, smallest };
        }),
      );
      expect(tiles.length).toBeGreaterThan(0);
      for (const tile of tiles) {
        if (size.perRow > 1) expect(tile.width).toBeGreaterThanOrEqual(211.5);
        expect(Math.round(tile.input)).toBe(64);
        expect(tile.inside).toBe(true);
        expect(tile.smallest).toBeGreaterThanOrEqual(43.5);
        expect(tile.clips).toBe(false);
        expect(tile.tops.length).toBe(3);
        expect(new Set(tile.tops).size).toBe(1);
        expect(Math.round(tile.height)).toBe(Math.round(tiles[0]!.height));
      }
      // How many tiles a row holds: on a phone one each, one under the other; wider, the grid's columns (the layout
      // world has only two scores).
      if (size.perRow === 1) expect(new Set(tiles.map((t) => t.top)).size).toBe(tiles.length);
      else expect(await page.locator('.score-tiles').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(size.perRow);
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}

// Purpose: a very long campaign name must not make the iPad's side menu tall: the name takes at most two lines
// (ending in "…"), the Scene / Players / Rules list doesn't move down past that, and the name is still the button's
// accessible name (ruled 2026-11-05).
for (const width of [1024, 1180]) {
  test.describe(`landscape tablet (${width}px): a 60-character campaign name in the side menu`, () => {
    test.use({ viewport: { width, height: 820 } });

    test('the name takes at most two lines and the section list stays near the top', async ({ page }) => {
      const long = 'The Lanterns of the Seven Drowned Marches and Their Kin XXX';
      expect(long.length).toBeGreaterThanOrEqual(58);
      // The menu opened on this device before (mn-1: folded is the default, and the folded column hides the name).
      await page.addInitScript(() => localStorage.setItem('grimoire.navCollapsed', 'no'));
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await page.locator('.gm__side .campaign-heading__name').click();
      await page.locator('#campaign-rename').fill(long);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const name = page.getByRole('button', { name: long });
      await expect(name).toBeVisible();
      const m = await name.locator('.campaign-heading__text').evaluate((el) => {
        const line = parseFloat(getComputedStyle(el).lineHeight);
        return { height: el.getBoundingClientRect().height, line, clipped: el.scrollHeight > el.clientHeight + 1 };
      });
      // Two lines of text, plus the 44 px tap height as a floor (a short name is one line).
      expect(m.height).toBeLessThanOrEqual(Math.max(m.line * 2, 44) + 1);
      expect(m.clipped).toBe(true);
      expect(await name.getAttribute('title')).toBe('Rename the campaign');
      const scene = (await gmTab(page, 'Scene').boundingBox())!;
      const nameBox = (await name.boundingBox())!;
      expect(scene.y).toBeLessThanOrEqual(nameBox.y + Math.max(m.line * 2, 44) + 120);
      const rules = (await gmTab(page, 'Rules').boundingBox())!;
      expect(rules.y).toBeLessThan(scene.y + 3 * 80);
    });
  });
}

// Purpose: the Rules tab draws every group with one indent, and the actions on one pack row share one size.
test.describe('landscape tablet (1180px): Rules tab consistency', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test("every group's title starts at the same left edge", async ({ page }) => {
    await openOptionalRules(page);
    const lefts = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.campaign-rules__group .campaign-rules__name, .campaign-rules__group .rule-group__title')];
      return els.map((el) => Math.round(el.getBoundingClientRect().left));
    });
    expect(lefts.length).toBeGreaterThan(1);
    expect(new Set(lefts).size).toBe(1);
  });

  test("a pack row's actions use one text size", async ({ page }) => {
    await page.goto('/layout.html?as=gm');
    await campaignRow(page).click();
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Remove .* from this campaign$/ }).first()).toBeVisible();
    const rows = await page.locator('.setting-rules__actions').evaluateAll((rows) =>
      rows.filter((row) => row.querySelector('[aria-label^="Remove "]')).map((row) => [...row.querySelectorAll('button, label')].map((el) => getComputedStyle(el).fontSize)),
    );
    const packRows = rows.filter((sizes) => sizes.length > 1);
    expect(packRows.length).toBeGreaterThan(0);
    for (const sizes of packRows) expect(new Set(sizes)).toEqual(new Set(['16px']));
  });
});

// Purpose: at phone width the Rules tab draws the same as on a tablet: every group's title starts at one left edge,
// every action on a pack's row and under Setting rules uses the small size, and an empty group's "· none" follows
// its title inline (wrapping as words, never pushed to the right edge or left alone on a line).
test.describe('phone (390px): Rules tab consistency', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every group's title starts at the same left edge", async ({ page }) => {
    await openOptionalRules(page);
    const lefts = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.campaign-rules__group .campaign-rules__name, .campaign-rules__group .rule-group__title')];
      return els.map((el) => Math.round(el.getBoundingClientRect().left));
    });
    expect(lefts.length).toBeGreaterThan(1);
    expect(new Set(lefts).size).toBe(1);
  });

  test('every action under Setting rules uses the small size', async ({ page }) => {
    await page.goto('/layout.html?as=gm');
    await campaignRow(page).click();
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Browse these rules' })).toBeVisible();
    // A pack's row (What's in it, Optional rules, Update from a new file, Sheet layout…, Remove…) and the list's
    // foot (Browse these rules, + New homebrew entry).
    const sizes = await page.locator('.setting-rules__actions').evaluateAll((rows) =>
      rows
        .filter((row) => row.querySelector('[aria-label^="Remove "]') || /Browse these rules|New homebrew entry/.test(row.textContent ?? ''))
        .flatMap((row) => [...row.querySelectorAll('button, label')].map((el) => `${el.textContent?.trim()}: ${getComputedStyle(el).fontSize}`)),
    );
    expect(sizes.some((s) => s.startsWith('Browse these rules'))).toBe(true);
    expect(sizes.some((s) => s.startsWith('+ New homebrew entry'))).toBe(true);
    for (const size of sizes) expect(size).toMatch(/: 16px$/);
  });

  test("an empty group's summary follows its title inline", async ({ page }) => {
    await openOptionalRules(page);
    const head = page.locator('.campaign-rules .rule-group__head--empty').first();
    await expect(head).toHaveText('Optional rules: Fen Rules, none');
    // A longer pack name (as a real one can be), so the title wraps at this width.
    const m = await head.evaluate((h) => {
      h.querySelector('.rule-group__title')!.textContent = 'Optional rules, Fen Rules of the Drowned Marches';
      const range = document.createRange();
      range.selectNodeContents(h.querySelector('.rule-group__title')!);
      const lines = [...range.getClientRects()];
      const last = lines[lines.length - 1]!;
      const count = h.querySelector('.rule-group__count')!;
      const rects = [...count.getClientRects()];
      return { titleLines: new Set(lines.map((r) => Math.round(r.top))).size, lastRight: last.right, lastTop: last.top, lastBottom: last.bottom, countLeft: rects[0]!.left, countTop: rects[0]!.top, countLines: new Set(rects.map((r) => Math.round(r.top))).size, headLeft: h.getBoundingClientRect().left };
    });
    expect(m.titleLines).toBeGreaterThan(1);
    // "· none" is one piece, never a "·" alone at a line's end.
    expect(m.countLines).toBe(1);
    // It follows the title's last word on its line, or starts the next line under the title (never at the right edge).
    const sameLine = m.countTop >= m.lastTop - 2 && m.countTop < m.lastBottom && m.countLeft < m.lastRight + 16;
    const nextLine = m.countTop >= m.lastBottom - 2 && m.countLeft < m.headLeft + 80;
    expect(sameLine || nextLine).toBe(true);
  });
});

// Purpose (Francis's phone test, 2026-11-09): tapping an "Optional rules: <pack>" group open on a phone lands on its
// first item: the group's heading sits at the top, just under the sticky top row, even though the group above folds
// at the same moment (one open at a time on a phone).
test.describe('phone (390px): a Rules group tapped open lands on its heading', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the opened group's heading is at the scroller's top, its first rule in view", async ({ page }) => {
    await page.goto('/layout.html?as=gm');
    await campaignRow(page).click();
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    // A topic group above opens first, so opening the pack's group folds it (the page would shift).
    await page.locator('.campaign-rules__toggle').first().click();
    await expect(page.locator('.campaign-rules__toggle').first()).toHaveAttribute('aria-expanded', 'true');
    const head = page.getByRole('button', { name: /^Optional rules: River Rules/ });
    await head.scrollIntoViewIfNeeded();
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.campaign-rules__toggle').first()).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(100);
    const m = await head.evaluate((h) => {
      const group = h.closest('.campaign-rules__group')!;
      const row = group.querySelector('.rule-row')!;
      return {
        headTop: group.getBoundingClientRect().top,
        topRowBottom: document.querySelector('.top-row')!.getBoundingClientRect().bottom,
        rowTop: row.getBoundingClientRect().top,
        rowBottom: row.getBoundingClientRect().bottom,
        viewport: window.innerHeight,
      };
    });
    expect(Math.abs(m.headTop - m.topRowBottom)).toBeLessThanOrEqual(2);
    expect(m.rowTop).toBeGreaterThan(m.headTop);
    expect(m.rowTop).toBeLessThan(m.viewport);
  });
});

// Purpose (R3-1, mockup creation/final/10): Roll for a name is one plain button, at least 44 px tall, its die glyph
// and words on one line, inside its stage at 375 px (the fold row it replaced is gone).
test.describe('creation Roll for a name button', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test('the button is a 44 px target with its die beside the words, and no fold row is left', async ({ page }) => {
    await page.goto('/gallery.html');
    const button = page.getByRole('button', { name: 'Roll for a name' }).first();
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const glyph = (await button.locator('svg').boundingBox())!;
    expect(glyph.y).toBeGreaterThanOrEqual(box.y);
    expect(glyph.y + glyph.height).toBeLessThanOrEqual(box.y + box.height);
    const stage = (await page.locator('.name-roll').first().locator('xpath=..').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
    await expect(page.locator('.name-roll .creation-fold__summary')).toHaveCount(0);
  });
});

// Purpose (creation follow-up, 2026-11-07): on an iPad upright creation shows one bar too: the app's row (sheet icon,
// ⋯) hides while a creation step is on screen, and creation's ⋯ carries the menu.
test.describe('creation one bar on a tablet upright', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('the app’s top row is hidden; creation’s bar has Back and More', async ({ page }) => {
    await guidedToClass(page);
    const bar = page.locator('.creation-step__bar--app');
    await expect(bar.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'More', exact: true })).toBeVisible();
    await expect(page.locator('.top-row').first()).toBeHidden();
  });
});

// Purpose (cw-11, plan m5b-creation-rework slice A1): on a phone upright and on its side, scrolled to the end, a
// creation step's foot (the hint, Back and Next) sits wholly on the screen, Next included; the step's top row has a
// worded Leave and no ‹, and no creation step's text draws ‹ or › on Class. A2: the app's back link is hidden
// while creating, and the status line starts at the foot's left.
for (const size of [{ width: 375, height: 667 }, { width: 667, height: 375 }]) {
  test.describe(`creation foot and top row at ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });
    test('Next is wholly on the screen at the end; the app bar (← Back, More with Leave) at the top; no ‹ or ›', async ({ page }) => {
      await guidedToClass(page);
      // Creation's app bar (final drafts A1): ← Back at the left, Leave inside More at the right.
      const bar = page.locator('.creation-step__bar--app');
      await expect(bar.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
      // One bar (final draft 9): on a phone the app's row is hidden, and ⋯ opens a sheet ending in the one exit.
      await expect(page.locator('.top-row').first()).toBeHidden();
      await bar.getByRole('button', { name: 'More', exact: true }).click();
      const more = page.getByRole('dialog', { name: 'More' });
      await expect(more.getByRole('button', { name: /^(Leave|Save and leave)/ })).toBeVisible();
      await more.getByRole('button', { name: 'Close', exact: true }).click();
      // While creating, the app's "‹ <campaign>" link hides (Design, 2026-11-06): Leave does its job.
      await expect(page.locator('.top-row__back').first()).toBeHidden();
      // The status line sits at the foot's left, never floating right (mockup creation/13).
      const hint = page.getByRole('status', { name: 'Step status' });
      const hintBox = (await hint.boundingBox())!;
      const footBox = (await page.locator('.creation-step__foot').boundingBox())!;
      expect(hintBox.x - footBox.x).toBeLessThan(2);
      expect(await hint.evaluate((el) => getComputedStyle(el).textAlign)).toBe('start');
      const text = await page.locator('.creation-step').innerText();
      expect(text).not.toMatch(/[‹›]/);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const next = (await page.getByRole('button', { name: 'Next', exact: true }).boundingBox())!;
      const back = (await page.getByRole('button', { name: 'Back to the step before' }).boundingBox())!;
      expect(next.y).toBeGreaterThanOrEqual(0);
      expect(next.y + next.height).toBeLessThanOrEqual(size.height);
      expect(next.x + next.width).toBeLessThanOrEqual(size.width);
      expect(back.y + back.height).toBeLessThanOrEqual(size.height);
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}

// Purpose: on Who they are at phone width, the foot's Back button keeps the secondary button's side padding (its
// word never touches its border).
test.describe('phone (390px): Who they are, Back', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Back's word has room inside its border", async ({ page }) => {
    await guidedToClass(page);
    await chooseOption(page, 'Lantern Warden');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Who they are' })).toBeVisible();
    const m = await page.locator('.creation-step__foot-back').evaluate((b) => {
      const cs = getComputedStyle(b);
      const range = document.createRange();
      range.selectNodeContents(b);
      const text = range.getBoundingClientRect();
      const box = b.getBoundingClientRect();
      return { left: text.left - box.left, right: box.right - text.right, pad: parseFloat(cs.paddingLeft) };
    });
    expect(m.pad).toBeGreaterThan(0);
    expect(m.left).toBeGreaterThanOrEqual(m.pad - 1);
    expect(m.right).toBeGreaterThanOrEqual(m.pad - 1);
  });
});

// The Magic section (sr-4) on a phone, an iPad in portrait and in landscape, with spells (a very long name, three
// tabs) and with none picked: the section stays inside the screen, every target in it is 44 px tall, no text in it
// is under 14 px, and it has no serious accessibility problems. (The page as a whole isn't checked here: on a phone
// the Combat tiles above it run 2 px wide, sheet order 4's to fix.) A picture of each is saved for review.
const magicSection = 'section[aria-label="Magic"]';
for (const size of [{ width: 375, height: 812 }, { width: 834, height: 1194 }, { width: 1024, height: 768 }]) {
  for (const magic of ['1', 'empty'] as const) {
    test.describe(`Magic section at ${size.width}px (${magic === '1' ? 'with spells' : 'none picked'})`, () => {
      test.use({ viewport: size });
      test('fits, 44 px targets, 14 px text, accessible', async ({ page }) => {
        await openMagic(page, size.width >= WIDE, magic);
        const section = page.locator(magicSection);
        await section.screenshot({ path: `test-results/layout-screens/sheet-magic-${magic}-${size.width}.png` });
        const problems = await section.evaluate((root) => {
          const out: string[] = [];
          const edge = root.getBoundingClientRect();
          if (edge.right > window.innerWidth + 0.5) out.push(`section runs ${Math.round(edge.right - window.innerWidth)} px past the screen`);
          for (const el of root.querySelectorAll<HTMLElement>('button')) {
            const box = el.getBoundingClientRect();
            if (box.height < 43.5) out.push(`"${el.textContent}" is ${Math.round(box.height)} px tall`);
            if (box.right > edge.right + 0.5) out.push(`"${el.textContent}" runs past the section`);
          }
          for (const el of root.querySelectorAll<HTMLElement>('*')) {
            if (!el.textContent?.trim()) continue;
            const size = parseFloat(getComputedStyle(el).fontSize);
            if (size < 14 && el.getBoundingClientRect().width > 1) out.push(`"${el.textContent.slice(0, 30)}" is ${size} px`);
          }
          return out;
        });
        expect(problems).toEqual([]);
        expect(await accessibilityProblems(page, magicSection)).toEqual([]);
      });
    });
  }
}

// The full sheet revised (plan m5b-sheet-revised A; it replaced sheet order 4's Combat block): on an iPad in portrait
// the sheet has two columns, the left one (the HP box, AC and Attack) beside the rest, the AC and Attack tiles inside
// it; on a phone one column, the left column's parts above Level, and no section folded to a row. On both, no caption
// has a separator dot (plan m5b-players-screens-standard D: commas), each caption stays inside its tile, and the
// page fits.
for (const size of [{ width: 834, height: 1194 }, { width: 375, height: 812 }]) {
  test.describe(`the full sheet's order at ${size.width}px`, () => {
    test.use({ viewport: size });
    test('the left column holds its tiles, captions have no "·" and stay in their tile, the page fits', async ({ page }) => {
      await openFullSheet(page, true);
      const left = (await page.locator('.sheet__vitals').boundingBox())!;
      const tiles = await page.locator('.sheet__vitals .stat-tile').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
      expect(tiles).toHaveLength(2);
      for (const tile of tiles) {
        expect(tile.left).toBeGreaterThanOrEqual(left.x - 0.5);
        expect(tile.right).toBeLessThanOrEqual(left.x + left.width + 0.5);
      }
      const captions = await page.locator('.sheet .stat-tile__caption').evaluateAll((els) =>
        els.map((el) => {
          const tile = el.closest('.stat-tile')!.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return { text: el.textContent ?? '', inside: box.left >= tile.left - 0.5 && box.right <= tile.right + 0.5 };
        }),
      );
      expect(captions.length).toBeGreaterThan(0);
      for (const c of captions) {
        expect(c.text).not.toContain('·');
        expect(c.inside, c.text).toBe(true);
      }
      const level = (await page.getByRole('region', { name: 'Level' }).boundingBox())!;
      // This fixture's character has no saves or scores: Movement is the next section after Level.
      const saves = (await page.getByRole('region', { name: 'Movement' }).boundingBox())!;
      if (size.width >= 600) {
        // Two columns: Level and Movement to the right of the left column, Movement under Level.
        expect(level.x).toBeGreaterThanOrEqual(left.x + left.width);
        expect(Math.abs(saves.x - level.x)).toBeLessThanOrEqual(1);
        expect(saves.y).toBeGreaterThan(level.y);
      } else {
        // One column: the left column's parts first, Level under them; no section folds to a row any more.
        expect(level.y).toBeGreaterThanOrEqual(left.y + left.height);
        expect(Math.abs(level.x - left.x)).toBeLessThanOrEqual(1);
        await expect(page.locator('.sheet details.creation-fold')).toHaveCount(0);
      }
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  });
}

// On a phone (sr-4): the very long spell name wraps inside its row; the tabs read "Spell book: 5", "Prepared: 3",
// "Glamours: 2"; a tab shows its kind's spells, and a row opens its spell's entry.
test.describe('Magic section tabs at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('the long name wraps in its row, Glamours shows its spells, a row opens its spell', async ({ page }) => {
    await openMagic(page, false, '1');
    const section = page.getByRole('region', { name: 'Magic' });
    const sectionBox = (await section.boundingBox())!;
    const long = (await section.getByRole('button', { name: /^The long lantern of the drowned abbey/ }).boundingBox())!;
    expect(long.x + long.width).toBeLessThanOrEqual(sectionBox.x + sectionBox.width + 0.5);
    await expect(section.getByRole('group', { name: 'Kinds of magic' }).getByRole('button')).toHaveText(['Spell book: 5', 'Prepared: 3', 'Glamours: 2']);
    await section.getByRole('button', { name: 'Glamours: 2' }).click();
    await section.getByRole('button', { name: /^Heron hush/ }).click();
    await expect(page.getByRole('dialog', { name: 'Heron hush' })).toBeVisible();
  });
});

// Purpose (retest 2, Francis 2026-11-07): on a tablet only Race and Class keep two columns (the list and the open
// entry); Adjust shows its tiles with no scores strip; every other step is one widened column, at 820 and at 1180.
for (const width of [820, 1180]) {
  test.describe(`creation columns at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });
    test('Class keeps the entry beside the list; Adjust has no strip; Who they are is one column', async ({ page }) => {
      await guidedToClass(page, '&alignments=1');
      await page.getByRole('button', { name: /^Lantern Warden/ }).click();
      const side = page.locator('.creation-step__side');
      await expect(side.getByRole('complementary', { name: 'Lantern Warden' })).toBeVisible();
      const list = (await page.locator('.creation-step__content').boundingBox())!;
      const entry = (await side.boundingBox())!;
      expect(entry.x).toBeGreaterThan(list.x + list.width - 1);
      await side.getByRole('button', { name: 'Close' }).click();
      await chooseOption(page, 'Lantern Warden');
      await expect(page.getByRole('heading', { name: 'Adjust scores' })).toBeVisible();
      await expect(page.locator('.scores-strip')).toHaveCount(0);
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Who they are' })).toBeVisible();
      await expect(side).toHaveCount(0);
      // The one column fills the width (Design on #555, P20: no empty sides): the content takes the step's whole width,
      // and the step the screen's, less the page's padding.
      const step = (await page.locator('.creation-step').boundingBox())!;
      const content = (await page.locator('.creation-step__content').boundingBox())!;
      expect(content.width).toBeGreaterThan(step.width - 4);
      expect(step.width).toBeGreaterThan(width - 140);
      // Running text keeps the reading measure: the step's line is no wider than about 65 characters.
      const line = (await page.locator('.creation-step .guided-instruction').first().boundingBox())!;
      if (width >= 1180) expect(line.width).toBeLessThan(step.width - 100);
    });
  });
}

// The GM's Players tab on an iPad in landscape (plan m5b-sheet-revised 12; Francis's iPad test): after scrolling to the
// end, the last element (the Inventory row) is whole inside the screen with room under it, not cut off by the screen's
// bottom edge. The room is the tab's bottom padding (GmCampaign.css).
for (const size of [
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
]) {
  test.describe(`the GM's Players tab at ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test('scrolled to the end, its last row is whole on screen with room under it', async ({ page }) => {
      await page.goto('/layout.html?as=gm');
      await campaignRow(page).click();
      await gmPlayers(page);
      const inventory = page.getByRole('button', { name: 'Inventory' });
      await expect(inventory).toBeVisible();
      // As far down as the page goes (a short page stays where it is).
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      const box = (await inventory.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      // Whole inside the screen, and at least 16 px (the room the padding gives) between its bottom and the screen's.
      expect(box.y + box.height).toBeLessThanOrEqual(size.height - 16);
      // Nothing sits over it: the point at its middle is the row itself (or inside it).
      const covered = await inventory.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!top && !el.contains(top) && top !== el;
      });
      expect(covered).toBe(false);
    });
  });
}

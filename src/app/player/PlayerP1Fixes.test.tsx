// @vitest-environment jsdom
// The Player screen brought to frame P1 of december/14 (Francis's approval of 19 Nov 2026, with its fixes; plan dec-13,
// rows C10, C15 and the ten fixes of `dec13-fix-p1-departures`). Against the shared P1-like character (Brannoch, as the
// layout page's ?p1=1 makes him). Invented names only. Purposes:
//   0. The sample's weapon in hand reads a small to-hit sum ("d20 +3"), not the class's 18 read as a bonus ("+20").
//   2. The armour class and attack tiles are labelled in whole words, "Armour class" and "Attack", and the Player
//      screen's tile labels are drawn in plain case (no small capitals).
//   3. A score whose modifier is nothing reads "+0" under it, and is heard with it (tfr-3, which reversed fix 3 of
//      19 Nov 2026 on Francis's yes; row C11 of the test feedback, page M1).
//   3a. A score with a change waiting for the GM keeps its modifier under it, and the tile says nothing of the change
//      (page M1, frame M1g: his fix of 19 Nov 2026); the notices box says it (row C1).
//   3b. The full sheet's own page shows the same "+0" (one block, built once).
//   4. In the top row the Log comes before Messages (P1's order).
//   5. The Movement card reads the speed with its unit, large, and one line: the speed's name and the fight's figure.
//   6. The load's line says "coins’ weight", and its card is left-aligned and upright (not italic, not centred).
//   7. A pinned weapon not in hand shows its two rolls with their die glyphs ("d20 +3", "d4"), not "+20, 1d4".
//   8. A trait with uses shows its pips before "1 of 1 left".
//   9. On a landscape tablet the full sheet's foot never names a trait with uses (it is in the list above).
// Row P3 (page 28, approved 2026-11-20; pg28-3, ⚑ 26):
//   P3a. A pinned ability without uses leaves its foot row's line; the row still opens every one, the pinned one marked
//        with the star; it stands in the right column's list as a row, whose pop-up (its entry) moves it.
//   P3b. With every one of a foot row's names pinned, the row stays and its line says where they went.
// Row P4 (euf-2; page 26's fix 1, drawn on page 28's frame M4e):
//   P4a. An ability's entry opened from the Player tab carries the Pin star beside ✕; a tap pins it (an ability with no
//        uses, from the screen), and pinned it reads "Unpin" and stands in the right column's list.
//   P4b. The full sheet's own page carries no star on an entry (pins are the Player tab's).
// The review's nits of 19 Nov 2026 (P1 again):
//   2a. The Attack tile signs its figure when the rules read the attack as a bonus ("+1"), and a screen reader hears it.
//   5.  The sample says its speed as P1 does: "120 paces", "Speed, 40 paces in a fight".
//   6a. The tier's name keeps a 44 px wide target, short as it is.
//   7a, 7b. A pinned weapon's and a pinned trait's star leads its name (P1's "★ Shortbow", "★ Horn charge").
//   8a. A trait row's pips are drawn in ink, as P1 draws them.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../../core/files.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN } from '../../testing/layoutP1Character.ts';
import { Root } from '../App.tsx';
import { forgetCampaignSetting } from '../campaignSetting.ts';
import { openFullSheetFromMenu } from '../../testing/openFullSheet.ts';

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
// The stylesheets as written (the test run leaves CSS out), read as creationRetest3.test.tsx reads parts.css.
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const playerCss = fs.readFileSync('./src/app/PlayerScreen.css', 'utf8');
const packCss = fs.readFileSync('./src/app/PackScreen.css', 'utf8');
const partsCss = fs.readFileSync('./src/ui/parts.css', 'utf8');

/** A landscape tablet: the media queries for 1024 px and up match (two columns, the full sheet's foot beside). */
function landscape() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: /min-width:\s*(1024|700|600)px/.test(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }));
}

/** Brannoch, as the layout page's ?p1=1 makes him. */
async function brannoch() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  await addP1Character(world, { gm, sam, fenPack });
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  await screen.findByRole('region', { name: 'Vitals' });
  return { user };
}

/** The CSS rule bodies for an exact selector. */
const ruleOf = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('the Player screen brought to frame P1', () => {
  // Purpose 0.
  it('reads a small to-hit sum on the weapon in hand, not the class figure read as a bonus', async () => {
    await brannoch();
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    const hit = [...block.querySelectorAll('.weapon-in-hand__roll')].map((r) => r.textContent)[0];
    expect(hit).toBe('d20 +3 to hit');
  });

  // Purpose 2.
  it('labels the armour class and attack tiles in whole words, drawn in plain case', async () => {
    await brannoch();
    const vitals = screen.getByRole('region', { name: 'Vitals' });
    expect([...vitals.querySelectorAll('.stat-row .stat-tile__label')].map((l) => l.textContent)).toEqual(['Armour class', 'Attack']);
    // The tiles' labels (armour class and attack, scores, saves); the hit points box keeps its small-capitals label (P1).
    const rule = ruleOf(playerCss, '.player .book-type :is(.stat-row, .score-row, .save-tiles) .stat-tile__label');
    expect(rule).toMatch(/font-variant:\s*normal/);
    expect(rule).toMatch(/font-family:\s*var\(--font-book-text\)/);
    expect(rule).toMatch(/letter-spacing:\s*0/);
  });

  // Purpose 2a.
  it('signs the Attack tile’s figure when the rules read the attack as a bonus, and says it so', async () => {
    await brannoch();
    const vitals = screen.getByRole('region', { name: 'Vitals' });
    const attack = within(vitals).getByRole('button', { name: /^Attack / });
    expect(attack.querySelector('.stat-tile__value')!.textContent).toBe('+1');
    expect(attack.getAttribute('aria-label')).toBe("Attack +1: how it's worked out");
  });

  // Purpose A3 (test feedback of 19 Nov 2026, item 5): the Attack box's small line and its pop-up read the same
  // figures; the line in plain case, a capital on its first word only (dec-14 row 7b), each pop-up row with its own.
  // The sample's setting names no AC style, so both read the scores' modifiers (the pop-up's old lines, A4); a setting
  // with a style reads the totals (sheetCombat.test.tsx).
  it('reads the Attack box’s small line as its pop-up does, in plain case', async () => {
    const { user } = await brannoch();
    const vitals = screen.getByRole('region', { name: 'Vitals' });
    const attack = within(vitals).getByRole('button', { name: /^Attack / });
    expect(attack.querySelector('.stat-tile__caption')!.textContent).toBe('Melee +2, missile +1');
    await user.click(attack);
    const sheet = within(await screen.findByRole('dialog', { name: 'Attack' }));
    expect(sheet.getByText('Melee +2 from Muscle')).toBeTruthy();
    expect(sheet.getByText('Missile +1 from Nimbleness')).toBeTruthy();
  });

  // Purpose 3.
  it('shows "+0" under a score whose modifier is nothing, and says it', async () => {
    await brannoch();
    const lore = await screen.findByRole('button', { name: /^Lore 9/ });
    expect(lore.textContent).toBe('Lore9+0');
    expect(lore.getAttribute('aria-label')).toBe('Lore 9, +0 save bonus: where it comes from');
    // Heard as the others are, with its column's words.
    expect(screen.getByRole('button', { name: /^Muscle 15/ }).getAttribute('aria-label')).toBe('Muscle 15, +2 melee: where it comes from');
    // A score with a modifier keeps it.
    expect(screen.getByRole('button', { name: /^Muscle 15/ }).textContent).toBe('Muscle15+2');
  });

  // Purpose 3b.
  it('shows "+0" under that score on the full sheet’s own page too', async () => {
    const { user } = await brannoch();
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    const scores = within(screen.getByRole('region', { name: 'Scores' }));
    expect(scores.getByRole('button', { name: /^Lore 9/ }).textContent).toBe('Lore9+0');
    expect(scores.getByRole('button', { name: /^Muscle 15/ }).textContent).toBe('Muscle15+2');
  });

  // Purpose 3a.
  it('keeps a score’s modifier while a change to it waits for the GM, and says nothing of the change on the tile', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    await addP1Character(world, { gm, sam, fenPack, head: 'bare' });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    // Muscle 15 → 16 waits: the notices box says so (row C1).
    await user.click(await screen.findByRole('button', { name: '1 notice, open them' }));
    expect(within(await screen.findByRole('dialog', { name: 'Notices' })).getByText('Waiting for your GM: Muscle 15 → 16')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    const muscle = screen.getByRole('button', { name: /^Muscle 15/ });
    expect(muscle.textContent).toBe('Muscle15+2');
    expect(muscle.getAttribute('aria-label')).not.toMatch(/waiting/);
    expect(screen.queryByText(/16 waiting/)).toBeNull();
  });

  // Purpose 4.
  it('puts the Log before Messages in the top row', async () => {
    await brannoch();
    const names = [...document.querySelectorAll('.top-row__end button')].map((b) => b.getAttribute('aria-label'));
    const log = names.indexOf('Log');
    const messages = names.findIndex((n) => n?.startsWith('Messages'));
    expect(log).toBeGreaterThanOrEqual(0);
    expect(log).toBeLessThan(messages);
  });

  // Purpose 5. The sample says its speed as P1 does (the review's nit of 19 Nov 2026): "120 paces", named "Speed".
  it('reads the speed with its unit, large, and one line under it: the speed’s name and the fight’s figure', async () => {
    await brannoch();
    const speed = await screen.findByRole('button', { name: /^Speed 120.*: how it's worked out$/ });
    expect(speed.querySelector('.sheet__card-figure')!.textContent).toBe('120 paces');
    expect(speed.querySelector('.auth__meta')!.textContent).toBe('Speed, 40 paces in a fight');
  });

  // Purpose 6.
  it('says the load in coins’ weight, left-aligned and upright', async () => {
    await brannoch();
    const load = document.querySelector('.pack__load--once')!;
    expect(load).not.toBeNull();
    expect(load.querySelector('.auth__meta')!.textContent).toMatch(/^\d[\d,]* of 1,200 coins’ weight$/);
    expect(ruleOf(packCss, '.pack__load--once')).toMatch(/align-items:\s*stretch/);
    const tier = ruleOf(packCss, '.pack__load--once .pack__tier');
    expect(tier).toMatch(/font-style:\s*normal/);
    expect(tier).toMatch(/text-align:\s*start/);
  });

  // Purpose 6a: with no side padding, a short tier's name ("Light") still keeps a 44 px wide target.
  it('keeps the tier’s name a 44 px wide target', () => {
    expect(ruleOf(packCss, '.pack__load--once .pack__tier')).toMatch(/min-inline-size:\s*var\(--tap\)/);
  });

  // Purpose 7.
  it('draws a pinned weapon’s rolls with their die glyphs, not "+20, 1d4"', async () => {
    await brannoch();
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    const knife = within(atHand).getByRole('button', { name: /^Eel knife/ });
    const rolls = [...knife.querySelectorAll('.roll-figures__roll')];
    expect(rolls.map((r) => r.textContent)).toEqual(['d20 +3', 'd4']);
    expect(rolls.map((r) => r.querySelector('svg.die-glyph') !== null)).toEqual([true, true]);
    expect(knife.textContent).not.toMatch(/\+20|1d4/);
  });

  // Purpose 7a: the pinned knife's star leads its name, as P1 draws "★ Shortbow"; a screen reader still hears the name
  // first, then "pinned".
  it('puts a pinned weapon’s star before its name', async () => {
    await brannoch();
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    const knife = within(atHand).getByRole('button', { name: /^Eel knife, pinned/ });
    const name = knife.querySelector('.pack__name')!;
    expect(name.firstElementChild?.classList.contains('pinned-mark')).toBe(true);
    expect(knife.querySelector('.pack__sub .pinned-mark')).toBeNull();
  });

  // Purpose 7b: a pinned trait has its star before its name too (P1's "★ Horn charge"), and its pips in ink; since row
  // P3 it is a block in the right column's list, not At hand.
  it('puts a pinned trait’s star before its name', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const id = await addP1Character(world, { gm, sam, fenPack });
    world.tables.character_play.find((p) => p.actor_id === id)!.pins = [{ kind: 'trait', key: 'Steady flame' }];
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const list = await screen.findByRole('region', { name: 'Abilities and traits' });
    const row = await within(list).findByRole('button', { name: /^Steady flame, pinned/ });
    expect(row.querySelector('.list-row__title')!.firstElementChild?.classList.contains('pinned-mark')).toBe(true);
    expect(row.querySelector('.list-row__sub .pinned-mark')).toBeNull();
    expect(row.querySelector('.use-pips--ink')).not.toBeNull();
  });

  // Purpose 8.
  it('shows the pips before a trait’s "1 of 1 left"', async () => {
    await brannoch();
    const row = await screen.findByRole('button', { name: /^Steady flame/ });
    const sub = row.querySelector('.list-row__sub') ?? row;
    const pips = sub.querySelector('.use-pips');
    expect(pips?.textContent?.trim()).toBe('●');
    expect(sub.textContent?.replace(/\s+/g, ' ').trim()).toBe('● 1 of 1 left, back each day');
  });

  // Purpose 8a: the Traits rows' pips are drawn in ink, as P1 draws them (the ink pips, a named variant of the use pips);
  // the trait chips keep theirs in the accent colour.
  it('draws a trait row’s pips in ink', async () => {
    await brannoch();
    const row = await screen.findByRole('button', { name: /^Steady flame/ });
    expect(row.querySelector('.use-pips.use-pips--ink')).not.toBeNull();
    const ink = ruleOf(partsCss, '.use-pips--ink');
    expect(ink).toMatch(/color:\s*var\(--ink\)/);
    expect(ruleOf(partsCss, '.use-pips--ink .use-pips__spent')).toMatch(/color:\s*var\(--ink\)/);
  });

  // Purpose 9.
  it('never names a trait with uses in the full sheet’s foot', async () => {
    landscape();
    await brannoch();
    // The foot's Abilities row keeps the abilities without uses, and leaves out Steady flame (in the Traits section).
    const abilities = await screen.findByRole('button', { name: /^Abilities/ });
    expect(abilities.textContent).toMatch(/Oath of light/);
    expect(abilities.textContent).not.toMatch(/Steady flame/);
    expect(screen.getByRole('button', { name: 'Use Steady flame' })).toBeTruthy();
  });

  // Purpose P3a: a pinned ability without uses leaves its foot row's line, the row still opening it with the star; it is
  // a row in the right column's list, and its entry moves it.
  it('takes a pinned ability out of the foot row’s line and into the list, its entry moving it', async () => {
    landscape();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const id = await addP1Character(world, { gm, sam, fenPack });
    world.tables.character_play.find((p) => p.actor_id === id)!.pins = [
      { kind: 'trait', key: 'Steady flame' },
      { kind: 'trait', key: 'Oath of light' },
    ];
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const list = await screen.findByRole('region', { name: 'Abilities and traits' });
    const row = await within(list).findByRole('button', { name: 'Oath of light, pinned' });
    expect(row.closest('.pinned-box')?.classList.contains('pinned-box--block')).toBe(false);
    // The foot's Abilities row no longer names it; it still opens it, with the star.
    const abilities = await screen.findByRole('button', { name: /^Abilities/ });
    expect(abilities.textContent).not.toMatch(/Oath of light/);
    await user.click(abilities);
    const opened = await screen.findByRole('dialog', { name: 'Abilities' });
    expect(within(opened).getByRole('button', { name: /^Oath of light.*, pinned$/ })).toBeTruthy();
    await user.click(within(opened).getByRole('button', { name: 'Close' }));
    // Its own pop-up (the entry) ends with Move up, the last pinned one having no Move down.
    await user.click(row);
    const entry = await screen.findByRole('dialog', { name: 'Oath of light' });
    expect(within(entry).queryByRole('button', { name: 'Move down' })).toBeNull();
    await user.click(within(entry).getByRole('button', { name: 'Move up' }));
    await vi.waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === id)!.pins).toEqual([
      { kind: 'trait', key: 'Oath of light' },
      { kind: 'trait', key: 'Steady flame' },
    ]));
  });

  // Purpose P3b: with every name in a foot row pinned, the row stays and its line says where they went.
  it('keeps a foot row whose every name is pinned, its line saying so', async () => {
    landscape();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const id = await addP1Character(world, { gm, sam, fenPack });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const traitsRow = await screen.findByRole('button', { name: /^Traits/ });
    const names = traitsRow.querySelector('.list-row__sub')!.textContent!.split(', ');
    cleanup();
    world.tables.character_play.find((p) => p.actor_id === id)!.pins = names.map((key) => ({ kind: 'trait', key }));
    render(<Root db={world.db} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const after = await screen.findByRole('button', { name: /^Traits/ });
    // Frame M4h's words exactly (the review's finding 6 on #23).
    await vi.waitFor(() => expect(after.querySelector('.list-row__sub')?.textContent).toBe('All pinned: they are in the list above'));
  });

  // Purpose P4a: an ability's entry on the Player tab carries the star; a tap pins it, and pinned it reads "Unpin".
  it('pins an ability without uses from its entry’s star', async () => {
    landscape();
    const { user } = await brannoch();
    await user.click(await screen.findByRole('button', { name: /^Abilities/ }));
    const list = await screen.findByRole('dialog', { name: 'Abilities' });
    await user.click(within(list).getByRole('button', { name: /^Oath of light/ }));
    const entry = await screen.findByRole('dialog', { name: 'Oath of light' });
    const star = within(entry).getByRole('button', { name: 'Pin to top' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await user.click(star);
    expect(await screen.findByText('Oath of light pinned to the top')).toBeTruthy();
    await vi.waitFor(() => expect(world.tables.character_play[0]!.pins).toEqual([{ kind: 'trait', key: 'Oath of light' }]));
    await vi.waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Oath of light' })).getByRole('button', { name: 'Unpin' }).getAttribute('aria-pressed')).toBe('true'));
    expect(await within(screen.getByRole('region', { name: 'Abilities and traits' })).findByRole('button', { name: 'Oath of light, pinned' })).toBeTruthy();
  });

  // Purpose P4b: the full sheet's own page carries no star on an entry.
  it('puts no star on an entry of the full sheet’s own page', async () => {
    const { user } = await brannoch();
    await openFullSheetFromMenu(user);
    const abilities = await screen.findByRole('region', { name: 'Abilities' });
    await user.click(within(abilities).getByRole('button', { name: /^Oath of light/ }));
    const entry = await screen.findByRole('dialog', { name: 'Oath of light' });
    expect(within(entry).queryByRole('button', { name: 'Pin to top' })).toBeNull();
  });
});

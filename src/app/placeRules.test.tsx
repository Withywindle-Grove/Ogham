// @vitest-environment jsdom
// A place's rules and its own check on screen (December dec-7 piece 3; rg-5, mc-51, mc-49a, mc-39b, pf-12d; mockups
// 01-04-rules, 01-04b-rules-toggle-off, 02-20-players-rule-aid, 02-22-players-rule-sheet, 02-23-rules-open-and-closed).
// Invented places and words only, on the stand-in database. What it checks, in plain words:
//   * the GM's place card has a Rules button at a place whose pack gives rules; the sheet lists the stand-in check
//     first with its toggle on and a sentence naming what it stands in for, then the place's other rules, the one the
//     pack keeps for the GM closed and saying so;
//   * switching the stand-in off happens at once, says the setting's check applies here, is logged, and Undo puts it
//     back; a player then reads no place check (the setting's holds);
//   * a tap on an eye opens a rule to players at once, with Undo;
//   * a player at the shown spot gets the open rule's button; a tap opens the rule in the book's words with nothing
//     to run; a rule the pack keeps for the GM never reaches their device until the GM opens it, and closing an eye
//     takes a rule away again;
//   * before the place is shown to them, a player reads no rules and no place check;
//   * a rule or check of a place the party sits in but was never shown (the harbour) comes under the shown place's own
//     name, and the harbour's name and id never reach the player (⚑ b, ruled 2026-11-13); once the harbour itself has
//     been shown to them, its name may come with its rule;
//   * a rule's button that names an icon of the set (pf-12e) is that icon alone, its words its label; an unknown icon
//     or plain words fall back to the generic mark with the words showing (dec-7 piece 2).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { runCommand } from '../core/commands.ts';
import { forgetPackPlaces, loadGroupPlaces, loadScenePlaces, setPlace, showPiece } from '../modules/expedition/placePlay.ts';
import { loadPlayersCheck, loadPlayersRules, setRuleEye } from '../modules/expedition/placeRules.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { PlaceCard, PlaceLine } from './PlaceCard.tsx';
import { PlaceRuleButtons, ruleButtonLook, useLastGoodRules } from './PlaceRules.tsx';
import type { PlayersRule, RuleButton } from '../modules/expedition/placeRules.ts';
import { createAppRegistry } from './commandRegistry.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const registry = createAppRegistry();
let world: FakeWorld;
let gmId: string;
let playerId: string;
let campaign: string;
const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } }) as CurrentUser;

const HARBOUR = {
  id: 'drowned-harbour',
  name: 'The Drowned Harbour',
  type: 'region',
  playerView: { text: 'A silted harbour of five spots, crossed by boat or by swimming.' },
  encounterCheck: { name: 'Encounters on the water', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, tableId: 'harbour-encounters' },
  rules: [
    {
      id: 'falling-in',
      name: 'Falling into the harbour',
      button: 'Someone fell in',
      text: { blocks: [{ p: 'A character in the water is cold at once.' }, { table: { title: 'Hauled out', columns: ['By', 'Takes'], rows: [['A rope from the jetty', '1 turn']] } }, { source: 'p. 40' }] },
    },
    { id: 'tidewife-bargain', name: 'What the Tidewife’s bargain costs', gmOnly: true, button: 'The bargain', text: 'A name, given freely, and never asked back.' },
  ],
};
const JETTY = { id: 'the-jetty', name: '1 The jetty', type: 'site', parentId: 'drowned-harbour', playerView: { text: 'Black piles, a mooring ring, weed to the waterline.' } };

function seed() {
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gmId, campaign_id: null, name: 'The Reed Marches', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'cp-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, priority: 1 });
  for (const data of [HARBOUR, JETTY]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: data.id, name: data.name, data });
}

/** The party at the jetty (a pack place, its description hidden); `shown` shows the description to the party. */
async function atTheJetty(shown: boolean) {
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  const trip = started.data!.id;
  const moved = await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: 'the-jetty', name: '1 The jetty', data: JETTY } });
  if (!moved.ok) throw new Error(moved.message);
  let row = (await loadGroupPlaces(world.db, campaign, trip))!.get(1)!;
  if (shown) {
    const done = await runCommand(registry, world.db, gm(), showPiece, { campaignId: campaign, row, piece: row.pieces[0]! });
    if (!done.ok) throw new Error(done.message);
    row = (await loadGroupPlaces(world.db, campaign, trip))!.get(1)!;
  }
  return { trip, row };
}

const asPlayer = async <T,>(read: () => Promise<T>): Promise<T> => {
  world.signInAs(playerId);
  try {
    return await read();
  } finally {
    world.signInAs(gmId);
  }
};

beforeEach(() => {
  world = createFakeDb();
  gmId = world.addPerson('priya@lantern.example', 'Priya');
  playerId = world.addPerson('ash@lantern.example', 'Ash');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  world.addMember(campaign, playerId, 'player');
  world.addCharacter(campaign, 'Wren the Ferrywarden', { ownerId: playerId, approval: 'approved' });
  world.signInAs(gmId);
  forgetPackPlaces();
  seed();
});
afterEach(cleanup);

function gmCard(row: Awaited<ReturnType<typeof atTheJetty>>['row']) {
  return render(
    <ToastHost>
      <PlaceCard
        db={world.db}
        user={gm()}
        campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }}
        group={1}
        groupLabel={null}
        row={row}
        checks={[{ id: 'wandering', name: 'Wandering encounters', every: { value: 2, unit: 'turn' }, when: null, chance: { die: 'd6', on: [1] }, byTerrain: false, terrainChance: null, onlyAt: null, onHit: { tableId: 'river-wanderers', tableChoices: [], columns: [], regionTables: false, note: null }, modifiers: [], secret: true, alsoWhen: [], note: null }]}
        recent={[]}
        onChanged={() => undefined}
      />
    </ToastHost>,
  );
}

describe("the GM's Rules sheet (01-04, 02-23)", () => {
  it('lists the stand-in check first with its toggle on, then the other rules, the GM-only one closed and saying so', async () => {
    const { row } = await atTheJetty(false);
    gmCard(row);
    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Rules' }));
    const toggle = await sheet.findByRole('switch', { name: /Encounters on the water/ });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(sheet.getByText('The Drowned Harbour’s own rule. It stands in for the setting’s Wandering encounters while the party is here.'.replace(/’/g, "'"))).toBeTruthy();
    expect(sheet.getByText("This place's other rules")).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Close to players: Falling into the harbour' }).getAttribute('aria-pressed')).toBe('true');
    expect(sheet.getByRole('button', { name: 'The GM’s alone: What the Tidewife’s bargain costs'.replace('GM’s', "GM's") }).getAttribute('aria-pressed')).toBe('false');
    expect(sheet.getAllByText('The book keeps this for the GM.')).toHaveLength(1);
    // A tap on a rule's name opens it in the book's words: its table and its source.
    await userEvent.click(sheet.getByRole('button', { name: /^Falling into the harbour/ }));
    const rule = within(await screen.findByRole('dialog', { name: 'Falling into the harbour' }));
    expect(rule.getByText('A character in the water is cold at once.')).toBeTruthy();
    expect(rule.getByRole('table').textContent).toContain('Hauled out');
    expect(rule.getByText('p. 40')).toBeTruthy();
  });

  it("switching the stand-in off is at once, says the setting's check applies, is logged, and Undo puts it back", async () => {
    const { row } = await atTheJetty(true);
    gmCard(row);
    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Rules' }));
    await userEvent.click(await sheet.findByRole('switch', { name: /Encounters on the water/ }));
    // The pack's own name for its check keeps its capital (review of a5e54923).
    expect(await screen.findByText("The Drowned Harbour's Encounters on the water is off. The setting's Wandering encounters applies here.")).toBeTruthy();
    await waitFor(() => expect(sheet.getByRole('switch', { name: /Encounters on the water/ }).getAttribute('aria-checked')).toBe('false'));
    expect(sheet.getByText('Not in force.')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'placeRule.inForce')).toHaveLength(1);
    // While it is off, a player reads no place check: the setting's own is in force.
    expect(await asPlayer(() => loadPlayersCheck(world.db, campaign))).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(sheet.getByRole('switch', { name: /Encounters on the water/ }).getAttribute('aria-checked')).toBe('true'));
    // The harbour was never shown to the party: its check comes under the jetty's name (⚑ b, ruled 2026-11-13).
    expect(await asPlayer(() => loadPlayersCheck(world.db, campaign))).toEqual([{ group: 1, placeName: '1 The jetty', eachMove: true, every: null, chance: { die: 'd6', on: [1] } }]);
  });

  it('a tap on an eye closes a rule to players at once, with Undo', async () => {
    const { row } = await atTheJetty(true);
    gmCard(row);
    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Rules' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Close to players: Falling into the harbour' }));
    expect(await screen.findByText('Closed to players: Falling into the harbour')).toBeTruthy();
    expect(await asPlayer(() => loadPlayersRules(world.db, campaign))).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await asPlayer(() => loadPlayersRules(world.db, campaign)))?.map((r) => r.name)).toEqual(['Falling into the harbour']));
  });

  // Purpose (rp-3): a rule the pack keeps for the GM shows the crossed eye and can't be opened: a tap explains in a
  // pop-up, nothing is switched, and the database refuses it too; the player never receives it.
  it("a rule the pack keeps for the GM can't be opened: a tap explains, and the database refuses it", async () => {
    const { row } = await atTheJetty(true);
    gmCard(row);
    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Rules' }));
    await userEvent.click(sheet.getByRole('button', { name: "The GM's alone: What the Tidewife’s bargain costs" }));
    expect(await screen.findByText('The book keeps this for the GM: players never see it.')).toBeTruthy();
    expect(world.tables.place_rule_switches).toEqual([]);
    const forced = await runCommand(registry, world.db, gm(), setRuleEye, { campaignId: campaign, packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'tidewife-bargain', open: true });
    expect(forced).toMatchObject({ ok: false, message: 'The book keeps this for the GM: players never see it.' });
    expect(JSON.stringify(await asPlayer(() => loadPlayersRules(world.db, campaign)))).not.toContain('Tidewife');
  });
});

describe("a player's rule button and sheet (02-20, 02-22)", () => {
  it("shows the open rule's button at the shown spot; its sheet is the book's words with nothing to run", async () => {
    await atTheJetty(true);
    const [scene, rules] = await asPlayer(() => Promise.all([loadScenePlaces(world.db, campaign), loadPlayersRules(world.db, campaign)]));
    // The GM's own rule never reaches the player's device: not its name, not its words. Nor does the name or id of the
    // harbour, which the party was never shown (⚑ b, ruled 2026-11-13): its rules come under the jetty's name.
    for (const secret of ['Tidewife', 'given freely', 'Drowned Harbour', 'drowned-harbour', 'falling-in']) expect(JSON.stringify(rules)).not.toContain(secret);
    expect(rules!.map((r) => r.placeName)).toEqual(['1 The jetty']);
    render(<PlaceLine place={scene!.get(1)!} rules={rules!} />);
    expect(screen.queryByRole('button', { name: /The bargain/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Someone fell in: Falling into the harbour' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Falling into the harbour' }));
    expect(sheet.getByText('1 The jetty. Rules')).toBeTruthy();
    expect(sheet.getByText('A character in the water is cold at once.')).toBeTruthy();
    // No eye, no toggle, nothing that runs: the only button is the ✕.
    expect(sheet.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
  });

  // Purpose (rp-8; mockup december/10, RC1b): the GM closes a rule a player has open; the sheet stays, its words go at
  // once and "Your GM has closed this rule." shows with no Back; the GM opens it again and the words come back.
  it('a rule closed while its sheet is open: the sheet stays, says so, and the words come back when reopened', async () => {
    await atTheJetty(true);
    const read = () => asPlayer(() => loadPlayersRules(world.db, campaign)).then((r) => r ?? []);
    const view = render(<PlaceRuleButtons rules={await read()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Someone fell in: Falling into the harbour' }));
    expect(within(await screen.findByRole('dialog', { name: 'Falling into the harbour' })).getByText('A character in the water is cold at once.')).toBeTruthy();
    await runCommand(registry, world.db, gm(), setRuleEye, { campaignId: campaign, packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'falling-in', open: false });
    view.rerender(<PlaceRuleButtons rules={await read()} />);
    const closed = within(screen.getByRole('dialog', { name: 'Falling into the harbour' }));
    expect(closed.getByText('Your GM has closed this rule.')).toBeTruthy();
    expect(closed.queryByText('A character in the water is cold at once.')).toBeNull();
    expect(closed.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Someone fell in/ })).toBeNull();
    await runCommand(registry, world.db, gm(), setRuleEye, { campaignId: campaign, packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'falling-in', open: true });
    view.rerender(<PlaceRuleButtons rules={await read()} />);
    expect(within(screen.getByRole('dialog', { name: 'Falling into the harbour' })).getByText('A character in the water is cold at once.')).toBeTruthy();
    expect(screen.queryByText('Your GM has closed this rule.')).toBeNull();
  });

  // Purpose: two rules with buttons give two buttons, each opening its own rule, a very long name included (the
  // wrapping itself is checked in a real browser, tests/layout/placeRules.spec.ts).
  it('two rule buttons each open their own rule, a very long name included', async () => {
    const rule = (name: string, button: string): PlayersRule => ({ group: 1, placeName: '1 The jetty', name, button, blocks: [{ kind: 'p', lead: '', text: `The words of ${name}.` }] });
    const long = 'What happens to a character who falls between the jetty piles at the turn of the spring tide';
    render(
      <div style={{ width: '375px' }}>
        <PlaceRuleButtons rules={[rule('Falling into the harbour', 'Someone fell in'), rule(long, 'Someone slipped between the piles at the turn of the tide')]} />
      </div>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[1]!.className).toContain('place-rule-buttons__button');
    await userEvent.click(screen.getByRole('button', { name: `Someone slipped between the piles at the turn of the tide: ${long}` }));
    expect(within(await screen.findByRole('dialog', { name: long })).getByText(`The words of ${long}.`)).toBeTruthy();
  });

  // Purpose (review of #726): a failed read of the rules (null) keeps the last good list, so an open sheet keeps its
  // words rather than saying the GM closed the rule.
  it("a failed read keeps an open sheet's words", async () => {
    await atTheJetty(true);
    const good = (await asPlayer(() => loadPlayersRules(world.db, campaign))) ?? [];
    function Kept({ rules }: { rules: readonly PlayersRule[] | null }) {
      return <PlaceRuleButtons rules={useLastGoodRules(rules)} />;
    }
    const view = render(<Kept rules={good} />);
    await userEvent.click(screen.getByRole('button', { name: 'Someone fell in: Falling into the harbour' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Falling into the harbour' }));
    view.rerender(<Kept rules={null} />);
    expect(sheet.getByText('A character in the water is cold at once.')).toBeTruthy();
    expect(screen.queryByText('Your GM has closed this rule.')).toBeNull();
  });

  it('a rule the GM closes stops reaching the player', async () => {
    await atTheJetty(true);
    const done = await runCommand(registry, world.db, gm(), setRuleEye, { campaignId: campaign, packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'falling-in', open: false });
    expect(done.ok).toBe(true);
    expect(await asPlayer(() => loadPlayersRules(world.db, campaign))).toEqual([]);
  });

  it('before the place is shown to them, a player reads no rules and no place check (mc-39b: the setting’s holds)', async () => {
    await atTheJetty(false);
    expect(await asPlayer(() => loadPlayersRules(world.db, campaign))).toEqual([]);
    expect(await asPlayer(() => loadPlayersCheck(world.db, campaign))).toEqual([]);
  });

  it('a region shown to the group earlier lends its rule its own name; one never shown does not', async () => {
    const { trip } = await atTheJetty(true);
    expect((await asPlayer(() => loadPlayersRules(world.db, campaign)))?.map((r) => r.placeName)).toEqual(['1 The jetty']);
    // The GM moves the party to the harbour itself and shows it, then back to the jetty and shows that.
    for (const data of [HARBOUR, JETTY]) {
      const moved = await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: data.id, name: data.name, data } });
      if (!moved.ok) throw new Error(moved.message);
      const row = (await loadGroupPlaces(world.db, campaign, trip))!.get(1)!;
      if (row.pieces[0] && !row.pieces[0].shown) await runCommand(registry, world.db, gm(), showPiece, { campaignId: campaign, row, piece: row.pieces[0] });
    }
    const rules = await asPlayer(() => loadPlayersRules(world.db, campaign));
    expect(rules?.map((r) => r.placeName)).toEqual(['The Drowned Harbour']);
  });

  it('a player can’t read or set the GM’s switches', async () => {
    await atTheJetty(true);
    await runCommand(registry, world.db, gm(), setRuleEye, { campaignId: campaign, packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'falling-in', open: true });
    const read = await asPlayer(async () => world.db.from('place_rule_switches').select('id'));
    expect(read.data).toEqual([]);
    const set = await asPlayer(() => runCommand(registry, world.db, { id: playerId, roles: { [campaign]: 'player' } } as CurrentUser, setRuleEye, { campaignId: campaign, packId: 'pack-reed', entryId: 'drowned-harbour', ruleId: 'tidewife-bargain', open: true }));
    expect(set.ok).toBe(false);
  });
});

describe("a rule's button as an icon (dec-7 piece 2; mc-49, mc-49a, pf-12c, pf-12e)", () => {
  const rule = (name: string, button: RuleButton): PlayersRule => ({ group: 1, placeName: '1 The jetty', name, button, blocks: [{ kind: 'p', lead: '', text: `The words of ${name}.` }] });

  // Purpose: a button that names an icon of the set reaches the player through the database's read and shows that icon
  // alone (filled, no words on screen), its words its label, and a tap opens the rule's sheet.
  it('an icon button reaches the player and opens the rule, its words only its label', async () => {
    const entry = world.tables.library_entries.find((e) => e.id === 'entry-drowned-harbour')!;
    entry.data = { ...HARBOUR, rules: [{ ...HARBOUR.rules[0], button: { icon: 'water-splash', words: 'Someone fell in' } }, HARBOUR.rules[1]] };
    await atTheJetty(true);
    const rules = (await asPlayer(() => loadPlayersRules(world.db, campaign)))!;
    expect(rules.map((r) => r.button)).toEqual([{ icon: 'water-splash', words: 'Someone fell in' }]);
    render(<PlaceRuleButtons rules={rules} />);
    const button = screen.getByRole('button', { name: 'Someone fell in: Falling into the harbour' });
    expect(button.className).toContain('place-rule-buttons__icon');
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 512 512');
    await userEvent.click(button);
    expect(within(await screen.findByRole('dialog', { name: 'Falling into the harbour' })).getByText('A character in the water is cold at once.')).toBeTruthy();
  });

  // Purpose: an object button's words pass the players' link-mark strip as JSON text: a label with a quote or a
  // backslash stays escaped and reads back whole; an unclosed mark at the end of the words swallows the JSON's closing
  // (the strip drops up to a "]" or a space), and the player then gets no button, never raw JSON.
  it("an object button survives the link-mark strip, or shows no button when the strip breaks it", async () => {
    const entry = world.tables.library_entries.find((e) => e.id === 'entry-drowned-harbour')!;
    const withWords = (words: string) => {
      entry.data = { ...HARBOUR, rules: [{ ...HARBOUR.rules[0], button: { icon: 'water-splash', words } }, HARBOUR.rules[1]] };
      return asPlayer(() => loadPlayersRules(world.db, campaign)).then((r) => r!.map((rule) => rule.button));
    };
    await atTheJetty(true);
    expect(await withWords('Ask [[npc:old-ferris|"Old" Ferris \\ the boatman]]')).toEqual([{ icon: 'water-splash', words: 'Ask "Old" Ferris \\ the boatman' }]);
    expect(await withWords('Ask [[npc:old-ferris')).toEqual([null]);
    render(<PlaceRuleButtons rules={[{ group: 1, placeName: '1 The jetty', name: 'Falling into the harbour', blocks: [], button: null }]} />);
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  // Purpose: words that name an icon of the set are that icon, labelled with the rule's name; an icon with no words is
  // labelled with the rule's name too.
  it("labels an icon with the rule's name when the button gives no other words", () => {
    render(<PlaceRuleButtons rules={[rule('Eel run', 'hourglass'), rule('Low tide', { icon: 'crystal-ball', words: '' })]} />);
    for (const name of ['Eel run', 'Low tide']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('place-rule-buttons__icon');
      expect(button.textContent).toBe('');
    }
  });

  // Purpose: an icon the app's set doesn't have falls back to the generic mark with the button's words showing (the
  // rule's name when it gives none); plain words keep that fallback, as before.
  it('falls back to the generic mark with its words for an unknown icon or plain words', () => {
    render(<PlaceRuleButtons rules={[rule('Eel run', { icon: 'lantern-moth', words: 'The eels are running' }), rule('Low tide', { icon: 'lantern-moth', words: '' }), rule('Mudflats', 'Stuck in the mud')]} />);
    for (const [label, shown] of [['The eels are running: Eel run', 'The eels are running'], ['Low tide', 'Low tide'], ['Stuck in the mud: Mudflats', 'Stuck in the mud']]) {
      const button = screen.getByRole('button', { name: label });
      expect(button.className).toContain('place-rule-buttons__button');
      expect(button.textContent).toBe(shown);
    }
  });

  // Purpose: an icon button and a words button share one row (rp-10's place, under the description, left), icon first
  // as the pack lists it.
  it('puts an icon button and a words button in one row, in the pack’s order', () => {
    const { container } = render(<PlaceRuleButtons rules={[rule('Falling into the harbour', { icon: 'water-splash', words: 'Someone fell in' }), rule('Rowing and swimming', 'Someone is swimming')]} />);
    const rows = container.querySelectorAll('.place-rule-buttons');
    expect(rows).toHaveLength(1);
    expect([...rows[0]!.children].map((b) => b.className.split(' ').pop())).toEqual(['place-rule-buttons__icon', 'place-rule-buttons__button']);
  });

  // Purpose: the look is decided by the set alone: words naming a set icon, an object's icon in the set, or else words.
  it('decides the look from the app’s set', () => {
    expect(ruleButtonLook('water-splash', 'Falling in')).toEqual({ icon: 'water-splash', words: 'Falling in' });
    expect(ruleButtonLook('camp', 'Making camp')).toEqual({ icon: null, words: 'camp' });
    expect(ruleButtonLook({ icon: 'hourglass', words: 'Time runs' }, 'Tide')).toEqual({ icon: 'hourglass', words: 'Time runs' });
    expect(ruleButtonLook({ icon: 'search', words: '' }, 'Tide')).toEqual({ icon: null, words: 'Tide' });
  });
});

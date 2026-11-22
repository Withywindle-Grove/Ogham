// @vitest-environment jsdom
// The players' Activities (plan dec-9-the-players-scene, row P6; ruling mc-45a; frames 01-08, 01-08e, 01-08j,
// approved 2026-11-12). Invented actions only. What it checks, in plain words:
//   * only the actions whose rule the pack carries are listed, in the pack's order and words;
//   * a pack with no such rules has no block at all (01-08e);
//   * a tap opens the rule in the rule's sheet, "Activities" over its name, the pack's words and the source;
//   * the sheet is a reading aid: nothing on it rolls, proposes or sends (it has no button but the ✕).
//   * on the party's page a player sees the card at the left under the place's card, and under "Somewhere new" before
//     anything of the place is shown (d5-18); never when the pack has no such rules.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { addPiece, loadGroupPlaces, setPlace, showPiece } from '../modules/expedition/placePlay.ts';
import { activitiesWithRules, type PlayerAction } from '../modules/expedition/playerActions.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { PartyGroups } from './PartyGroups.tsx';
import { activityBlocks, PlayersActivities } from './PlayersScenePage.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  // Each table's setting is its own: the session's kept copy is forgotten.
  forgetCampaignSetting();
});
afterEach(() => cleanup());

const rules = (actions: unknown[]) => ({ exploration: { playerActions: actions } });

const FORCE: PlayerAction = {
  id: 'force',
  name: 'Force a door',
  group: 'Doors',
  text: 'A stuck door may be forced by one character at a time.\n\nEach try takes a turn and is loud.',
  blocks: null,
  source: 'Fen Rules, p. 88',
};
const LISTEN: PlayerAction = { id: 'listen', name: 'Listen', group: 'Doors', text: 'Hold still and listen at the door.', blocks: null, source: null };

describe('which actions are Activities (mc-45a)', () => {
  // Purpose: an action the pack names without rule text is not listed; the rest keep the pack's order and words.
  it('keeps only the actions with rule text, in the pack’s order', () => {
    const found = activitiesWithRules([
      rules([
        { id: 'search', name: 'Search', text: 'Tap the walls for hollow places.' },
        { id: 'wave', name: 'Wave a lantern' },
        { id: 'blank', name: 'Shout', text: '   ' },
        { id: 'force', name: 'Force a door', text: 'Shoulder it.' },
      ]),
    ]);
    expect(found.map((a) => a.name)).toEqual(['Search', 'Force a door']);
  });

  // Purpose: a pack with no such rules gives an empty list, so the page has no block (01-08e).
  it('gives none when the pack lists no actions, or none with rule text', () => {
    expect(activitiesWithRules([])).toEqual([]);
    expect(activitiesWithRules([{ exploration: {} }])).toEqual([]);
    expect(activitiesWithRules([rules([{ id: 'wave', name: 'Wave a lantern' }])])).toEqual([]);
  });
});

describe('the Activities card (P6; 01-08, 01-08e)', () => {
  // Purpose: with no activities the card is absent, with nothing drawn in its place (01-08e).
  it('draws nothing when there are no activities', () => {
    const { container } = render(<PlayersActivities activities={[]} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('region', { name: 'Activities' })).toBeNull();
  });

  // Purpose: the card is headed "Activities" and holds one button per activity, in the given order, named by the pack.
  it('lists each activity as a button, in order, under the heading', () => {
    render(<PlayersActivities activities={[LISTEN, FORCE]} />);
    const card = within(screen.getByRole('region', { name: 'Activities' }));
    expect(card.getByRole('heading', { name: 'Activities' })).toBeTruthy();
    expect(card.getAllByRole('button').map((b) => b.textContent)).toEqual(['Listen', 'Force a door']);
  });

  // Purpose: a long name is shown whole, never cut (messy data; the button wraps between words in the layout check).
  it('shows a long name whole', () => {
    const long = { ...LISTEN, id: 'long', name: 'Listen at the iron-bound door of the Drowned Customs House for a while' };
    render(<PlayersActivities activities={[long]} />);
    expect(screen.getByRole('button', { name: long.name })).toBeTruthy();
  });
});

describe('an activity’s rule (P6; 01-08j)', () => {
  // Purpose: a tap opens the rule in the rule's sheet: "Activities" over the name, the pack's words as paragraphs, and
  // the source as the setting's.
  it('opens the rule with its words and its source', () => {
    render(<PlayersActivities activities={[LISTEN, FORCE]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Force a door' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Force a door' }));
    expect(sheet.getByText('Activities')).toBeTruthy();
    expect(sheet.getByText('A stuck door may be forced by one character at a time.')).toBeTruthy();
    expect(sheet.getByText('Each try takes a turn and is loud.')).toBeTruthy();
    expect(sheet.getByText('From your setting: Fen Rules, p. 88')).toBeTruthy();
  });

  // Purpose: the sheet is a reading aid: no button to roll, propose or send, only the ✕, which closes it.
  it('has no button but the ✕, which closes it', () => {
    render(<PlayersActivities activities={[FORCE]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Force a door' }));
    const dialog = screen.getByRole('dialog', { name: 'Force a door' });
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Purpose: an activity with no source has no source line, and nothing is written in its place.
  it('has no source line when the pack gives none', () => {
    expect(activityBlocks(LISTEN)).toEqual([{ kind: 'p', lead: '', text: 'Hold still and listen at the door.' }]);
    expect(activityBlocks(FORCE).at(-1)).toEqual({ kind: 'source', text: 'From your setting: Fen Rules, p. 88' });
  });
});

describe('an activity’s rule set out in blocks (d5-16; 01-08j)', () => {
  const FORCE_BLOCKS = activitiesWithRules([
    rules([
      {
        id: 'force',
        name: 'Force a door',
        text: {
          blocks: [
            { p: 'A stuck door may be forced by one character at a time.' },
            { p: 'Roll a d6: the door opens on a 1 or a 2.' },
            { table: { title: 'Modifiers', columns: ['When', 'The door opens on'], rows: [['With a crowbar', '1 to 3'], ['An iron-bound door', '1 only']] } },
            { lead: 'Time and noise', text: 'Each try takes a turn and is loud.' },
          ],
        },
        source: 'Fen Rules, p. 88',
      },
    ]),
  ])[0]!;

  // Purpose: a rule in blocks is set out block by block on its sheet: the paragraphs, the titled table under its
  // column headings, the bold lead-in, then the source as the setting's (01-08j).
  it('sets the rule out block by block', () => {
    render(<PlayersActivities activities={[FORCE_BLOCKS]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Force a door' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Force a door' }));
    expect(sheet.getByText('A stuck door may be forced by one character at a time.')).toBeTruthy();
    expect(sheet.getByText('Roll a d6: the door opens on a 1 or a 2.')).toBeTruthy();
    const table = within(sheet.getByRole('table'));
    expect(table.getByText('Modifiers')).toBeTruthy();
    expect(table.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['When', 'The door opens on']);
    expect(table.getByRole('cell', { name: 'An iron-bound door' })).toBeTruthy();
    expect(sheet.getByText('Time and noise.').tagName).toBe('STRONG');
    expect(sheet.getByText('From your setting: Fen Rules, p. 88')).toBeTruthy();
    expect(sheet.getAllByRole('button')).toHaveLength(1);
  });

  // Purpose: the sheet's blocks are the reader's, in the pack's order, with the source last.
  it('draws the blocks in the pack’s order, the source last', () => {
    expect(activityBlocks(FORCE_BLOCKS).map((b) => b.kind)).toEqual(['p', 'p', 'table', 'p', 'source']);
  });
});

const PLACE = 'The Moth Gallery';

/**
 * A table of two on an expedition at a place nobody has been shown yet, the setting's rules listing `actions` (invented)
 * as its common player actions.
 */
async function table(actions: unknown[]) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({ id: 'entry-fen-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', name: 'Fen rules', exploration: { playerActions: actions } } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const users = { gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser, sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser };
  world.signInAs(gm);
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  const registry = createAppRegistry();
  await runCommand(registry, world.db, users.gm, setPlace, { campaignId: campaign, group: 1, name: PLACE, placeId: null, packEntry: null });
  const rowNow = async () => (await loadGroupPlaces(world.db, campaign, started.data!.id))!.get(1)!;
  const placeId = (await rowNow()).place!.id;
  await runCommand(registry, world.db, users.gm, addPiece, { campaignId: campaign, placeId, kind: 'description', text: 'Dusty frames and a draught.' });
  /** The GM taps the first piece's eye. */
  const showFirst = async () => {
    world.signInAs(gm);
    const row = await rowNow();
    expect((await runCommand(registry, world.db, users.gm, showPiece, { campaignId: campaign, row, piece: row.pieces[0]! })).ok).toBe(true);
  };
  /** Sam opens the Scene. */
  const open = () => {
    world.signInAs(sam);
    return render(
      <ToastHost>
        <PartyGroups db={world.db} user={users.sam} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'player', line: null }} />
      </ToastHost>,
    );
  };
  return { showFirst, open };
}

const ACTIONS = [
  { id: 'listen', name: 'Listen', group: 'Doors', text: 'Hold still and listen at the door.', source: 'Fen Rules, p. 87' },
  { id: 'wave', name: 'Wave a lantern', group: 'Light' },
  { id: 'force', name: 'Force a door', group: 'Doors', text: 'Shoulder it. Each try takes a turn and is loud.' },
];

const column = (container: HTMLElement, side: 'left' | 'right') => container.querySelector<HTMLElement>(`.players-page__column[data-column="${side}"]`)!;

describe('Activities on the players’ page (P6; PL1, PL2)', () => {
  // Purpose (PL1, PL5): once something of the place is shown, the card stands at the left under the place's card,
  // with the actions that carry rule text in the pack's order, and a tap opens the rule.
  it('stands at the left under the place once something is shown, and opens a rule', async () => {
    const t = await table(ACTIONS);
    await t.showFirst();
    const { container } = t.open();
    const card = await screen.findByRole('region', { name: 'Activities' });
    const left = column(container, 'left');
    expect(left.contains(card)).toBe(true);
    const place = within(left).getByRole('heading', { name: PLACE });
    expect(place.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['Listen', 'Force a door']);
    fireEvent.click(within(card).getByRole('button', { name: 'Listen' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Listen' }));
    expect(sheet.getByText('Hold still and listen at the door.')).toBeTruthy();
    expect(sheet.getByText('From your setting: Fen Rules, p. 87')).toBeTruthy();
  });

  // Purpose (d5-18, 2026-11-20): before anything of the place is shown the card is there too, at the left under
  // "Somewhere new": Activities belong to the setting, not the place, so it never blinks away at a new Location.
  it('stands under "Somewhere new" before anything of the place is shown', async () => {
    const t = await table(ACTIONS);
    const { container } = t.open();
    const card = await screen.findByRole('region', { name: 'Activities' });
    const left = column(container, 'left');
    expect(left.contains(card)).toBe(true);
    const somewhere = within(left).getByRole('heading', { name: 'Somewhere new' });
    expect(somewhere.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).not.toContain(PLACE);
  });

  // Purpose (01-08e): a pack whose actions carry no rule text gives no block, with nothing in its place.
  it('is absent when the pack carries no rules for any action', async () => {
    const t = await table([{ id: 'wave', name: 'Wave a lantern', group: 'Light' }]);
    await t.showFirst();
    t.open();
    await screen.findByRole('heading', { name: PLACE });
    await screen.findByRole('heading', { name: 'Marching order' });
    expect(screen.queryByRole('region', { name: 'Activities' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Activities' })).toBeNull();
  });
});

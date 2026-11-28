// @vitest-environment jsdom
// dec5-gaps piece F (#192; G-228, dg-10 to dg-16, dg-19; page 50, approved by Francis 2026-11-28 with findings 1, 5,
// 6): what a person carries, on the GM's place page. Seam 2, the parts drawn in a test, on the stand-in database.
// Invented names only (Mother Sedge, Old Harl, Wren, The Customs Shed). In plain words:
//   1. Her piece shows "Only you see this." and her Carries line: after her stat line on a tablet, above it on a phone
//      (finding 5); a person who carries nothing is as today, with no label and no line.
//   2. Her sheet: the place over her name, the piece's words, "Carries", a row a thing with its note, a sent row saying
//      where, the quiet line for a thing not in the packs (no id, finding 6), "Sent before", "Edit the piece's words"
//      last; no "Send all" and no accent (finding 1). A thing's own sheet has no edit row.
//   3. On the place page: her words open her sheet; a thing's row opens its sheet; To a character sends it to Wren with
//      the toast "Warden’s lantern sent to Wren." and Undo; her sheet and her line say so; Take it back returns it.
//   4. A failed read of the GM's log (#197's review S1): a read that worked before keeps its sends, so nothing is offered
//      twice; with none read before, her piece says plain words, naming her (dgc-14), and opens no sheet.
//   5. Piece Q (#228; dgc-5, dgc-6, sb4-12, sb4-13): a "Sent before" line opens that thing's sheet, which says where it
//      went ("Sent to Wren at 4. The Customs Shed, turn 3."); Take it back there returns it to her, her line and her sheet
//      follow, and its toast keeps the pack's capitals and has Undo; a refused Take it back gives the error toast.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { runCommand } from '../core/commands.ts';
import { giveFind } from '../modules/expedition/findSend.ts';
import { carriesUnreadWords, type HeldState } from '../modules/expedition/personHolds.ts';
import type { TurnClock } from '../modules/expedition/placeKnowledge.ts';
import { forgetPackPlaces, loadGroupPlaces, setPlace, type GroupPlace, type Piece } from '../modules/expedition/placePlay.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { createAppRegistry } from './commandRegistry.ts';
import { GmPlacePage } from './GmPlacePage.tsx';
import { FoundThingSheet } from './HoardSheet.tsx';
import { CarriesLine, PersonSheetView } from './PersonSheet.tsx';
import { PieceRow } from './PlaceCard.tsx';
import { SceneWaitingProvider } from './sceneWaiting.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(cleanup);

const SEDGE_WORDS = 'A tall woman in a salt-stiff coat, a lantern on a pole at her side.';
const person = (statLine: string): Piece => ({ id: 'piece-sedge', kind: 'person', text: SEDGE_WORDS, shown: false, shownAt: null, gm: { value: '', trigger: '', statLine }, version: 1 });
const names = { byId: new Map([['npc/mother-sedge', 'Mother Sedge']]), packId: 'pack-reed' };
const linesOf = (item: HTMLElement) => [...item.querySelectorAll('.place-page__piece-words > span')].map((s) => s.textContent);

describe('1. her piece (page 50, finding 5)', () => {
  const line = <CarriesLine lead="Carries:" rest="Warden’s lantern, Iron key." />;

  // Purpose: on a tablet the label comes first, then her stat line, then the Carries line.
  it('puts the Carries line after her stat line on a tablet', () => {
    render(<ul><PieceRow page piece={person('NPC: mother-sedge')} names={names} onToggle={() => {}} onEdit={() => {}} onOpen={() => {}} carries={{ line, first: false }} /></ul>);
    expect(linesOf(screen.getByRole('listitem'))).toEqual([SEDGE_WORDS, 'Only you see this.', 'The stat line never shows (NPC: Mother Sedge).', 'Carries: Warden’s lantern, Iron key.']);
  });

  // Purpose: on a phone the Carries line sits above her stat line, under the label.
  it('puts the Carries line above her stat line on a phone', () => {
    render(<ul><PieceRow page piece={person('NPC: mother-sedge')} names={names} onToggle={() => {}} onEdit={() => {}} onOpen={() => {}} carries={{ line, first: true }} /></ul>);
    expect(linesOf(screen.getByRole('listitem'))).toEqual([SEDGE_WORDS, 'Only you see this.', 'Carries: Warden’s lantern, Iron key.', 'The stat line never shows (NPC: Mother Sedge).']);
  });

  // Purpose: a person who carries nothing is as today: no label, no line, her arrow opens Edit piece.
  it('leaves a person who carries nothing as today', () => {
    render(<ul><PieceRow page piece={person('NPC: mother-sedge')} names={names} onToggle={() => {}} onEdit={() => {}} carries={null} /></ul>);
    expect(linesOf(screen.getByRole('listitem'))).toEqual([SEDGE_WORDS, 'The stat line never shows (NPC: Mother Sedge).']);
    expect(screen.getByRole('button', { name: `Edit piece: ${SEDGE_WORDS}` })).toBeTruthy();
  });
});

describe('2. her sheet, and a thing’s sheet (page 50, findings 1 and 6)', () => {
  const state = (key: string, name: string, note: string | null, sent: HeldState['sent'] = null, qty = 1): HeldState => ({ key, itemId: key, name, qty, note, libraryEntryId: null, sent });
  const nameOf = (id: string) => (id === 'actor-wren' ? 'Wren' : 'someone');

  // Purpose: her sheet in the find sheet's person's dress: rows with notes or where they went, the quiet lines, the edit
  // row last; no "Send all" and no accent button. A "Sent before" line is a row of its own that opens that thing (dgc-5).
  it('lists her things, the quiet lines and the edit row, with no Send all and no accent', async () => {
    const onThing = vi.fn();
    render(
      <PersonSheetView
        name="Mother Sedge"
        over="4. The Customs Shed"
        words={SEDGE_WORDS}
        rows={[
          state('lantern', 'The Hooded Lantern of the Nine Drowned Wardens of Saltwick Quay', 'Carried on a pole', { to: 'actor-wren', placeId: 'shed', eventId: 'e1', seq: 1 }),
          state('oil', 'Oil flask', 'In a crate under the desk', null, 999),
        ]}
        before={[{ thing: state('key', 'Iron key', 'On a cord at her neck', { to: 'actor-wren', placeId: 'watch-house', eventId: 'e0', seq: 0 }), line: 'Sent before: Iron key, to Wren, at 6. The Watch House.' }]}
        missing="One thing Mother Sedge carries isn’t in your packs."
        nameOf={nameOf}
        onThing={onThing}
        onEdit={() => {}}
        onClose={() => {}}
        preview
      />,
    );
    const sheet = screen.getByRole('group', { name: 'Mother Sedge (preview)' });
    expect(within(sheet).getByText('4. The Customs Shed')).toBeTruthy();
    expect(within(sheet).getByText(SEDGE_WORDS)).toBeTruthy();
    expect(within(sheet).getByText('Carries', { selector: 'p' })).toBeTruthy();
    expect(within(sheet).getByText('Sent to Wren.')).toBeTruthy();
    expect(within(sheet).getByText('Oil flask ×999')).toBeTruthy();
    expect(within(sheet).getByText('In a crate under the desk')).toBeTruthy();
    expect(within(sheet).getByText('One thing Mother Sedge carries isn’t in your packs.')).toBeTruthy();
    expect(within(sheet).getByText('Sent before: Iron key, to Wren, at 6. The Watch House.')).toBeTruthy();
    const buttons = within(sheet).getAllByRole('button').map((b) => b.textContent ?? '');
    expect(buttons.at(-1)).toContain("Edit the piece's words");
    expect(buttons.some((b) => b.includes('Send all'))).toBe(false);
    expect(sheet.querySelector('.button-primary, .stacked-button--primary')).toBeNull();
    await userEvent.click(within(sheet).getByText('Oil flask ×999'));
    expect(onThing).toHaveBeenCalledWith(expect.objectContaining({ key: 'oil' }));
    // The "Sent before" line is a button, before the edit row, and opens the thing it names.
    const before = within(sheet).getByRole('button', { name: 'Sent before: Iron key, to Wren, at 6. The Watch House.' });
    await userEvent.click(before);
    expect(onThing).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'key' }));
  });

  // Purpose: a thing's own sheet (TR1's one thing) has no edit row: her sheet has it.
  it('draws a thing’s sheet with no edit row', () => {
    render(<FoundThingSheet hoard={{ name: 'Warden’s lantern', words: 'A lantern on a pole.', rows: [] }} over="Mother Sedge" went={null} onCharacter={() => {}} onStash={() => {}} onTakeBack={() => {}} onClose={() => {}} preview />);
    const sheet = screen.getByRole('group', { name: 'Warden’s lantern (preview)' });
    expect(within(sheet).getByText('To a character')).toBeTruthy();
    expect(within(sheet).getByText('To the party stash')).toBeTruthy();
    expect(within(sheet).queryByText(/Edit the piece/)).toBeNull();
  });
});

describe('3. on the GM’s place page, through the stand-in database', () => {
  const registry = createAppRegistry();
  let world: FakeWorld;
  let gmId: string;
  let campaign: string;
  const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } }) as CurrentUser;
  const SHED = {
    id: 'customs-shed',
    name: 'The Customs Shed',
    key: '4',
    type: 'site',
    playerView: {
      text: 'A low shed of tarred planks, a brazier, a ledger chained to the desk.',
      people: [{ npcId: 'mother-sedge', description: SEDGE_WORDS }, { npcId: 'old-harl', description: 'A ferryman asleep on a coil of rope.' }],
    },
  };
  const WATCH = {
    id: 'watch-house',
    name: 'The Watch House',
    key: '6',
    type: 'site',
    playerView: { text: 'A stone room with a cold hearth and a bench.', people: [{ npcId: 'mother-sedge', description: SEDGE_WORDS }] },
  };
  /** The expedition's step for the "turn N" words: a turn of ten minutes, the expedition started at the clock's 0. */
  const TURNS: TurnClock = { startedAt: 0, step: { value: 1, unit: 'turn' }, units: { turn: 600, hour: 3600, day: 86400 } };
  const entry = (kind: string, id: string, name: string, data: unknown) => world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-reed', kind, pack_entry_id: id, name, data });

  beforeEach(() => {
    world = createFakeDb();
    gmId = world.addPerson('priya@lantern.example', 'Priya');
    campaign = world.addCampaign('The Ash Barrows', gmId);
    const samId = world.addPerson('sam@lantern.example', 'Sam');
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
    world.addMember(campaign, samId, 'player', wren);
    world.signInAs(gmId);
    forgetPackPlaces();
    world.tables.packs.push({ id: 'pack-reed', owner_user_id: gmId, campaign_id: null, name: 'The Reed Marches', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, priority: 1 });
    entry('location', SHED.id, SHED.name, SHED);
    entry('location', WATCH.id, WATCH.name, WATCH);
    entry('item', 'wardens-lantern', 'Warden’s lantern', {});
    entry('item', 'iron-key', 'Iron key', {});
    entry('npc', 'mother-sedge', 'Mother Sedge', {
      id: 'mother-sedge',
      holds: [{ itemId: 'wardens-lantern', note: 'A lantern on a pole' }, { itemId: 'iron-key', note: 'On a cord at her neck' }, { itemId: 'moon-bell' }],
    });
    entry('npc', 'old-harl', 'Old Harl', { id: 'old-harl' });
  });
  afterEach(cleanup);

  async function atShed(): Promise<{ trip: string; row: GroupPlace }> {
    const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
    const trip = started.data!.id;
    const moved = await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: SHED.id, name: SHED.name, data: SHED } });
    if (!moved.ok) throw new Error(moved.message);
    return { trip, row: (await loadGroupPlaces(world.db, campaign, trip))!.get(1)! };
  }
  function page(trip: string, row: GroupPlace, phone = false, turns: TurnClock | null = null) {
    return render(
      <ToastHost>
        <SceneWaitingProvider>
          <GmPlacePage db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }} expeditionId={trip} group={1} groupLabel={null} row={row} checks={[]} recent={[]} phone={phone} turns={turns} onChanged={() => {}} />
        </SceneWaitingProvider>
      </ToastHost>,
    );
  }

  // Purpose: her piece says what she carries; Old Harl, who carries nothing, is as today.
  it('shows her Carries line, and leaves a person who carries nothing as today', async () => {
    const { trip, row } = await atShed();
    page(trip, row);
    expect(await screen.findByText('Warden’s lantern, Iron key.', { exact: false })).toBeTruthy();
    // Since sf-6b (#205) both hidden pieces carry a detail row (each names a person the pack has), so each has the
    // label; only hers has a Carries line.
    expect(screen.getAllByText('Only you see this.')).toHaveLength(2);
    expect(screen.getAllByText(/^Carries/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Edit piece: A ferryman asleep on a coil of rope.' })).toBeTruthy();
    expect(screen.queryByText(/moon-bell/)).toBeNull();
  });

  // Purpose: her words open her sheet; a thing's row opens its sheet; To a character sends it to Wren with the toast and
  // Undo; her sheet and her line say where it went; Take it back returns it, with its toast.
  it('sends a thing she carries to Wren, and takes it back', async () => {
    const user = userEvent.setup();
    const { trip, row } = await atShed();
    const view = page(trip, row);
    await screen.findByText('Warden’s lantern, Iron key.', { exact: false });
    await user.click(screen.getByRole('button', { name: new RegExp(`^${SEDGE_WORDS}`) }));
    const sheet = await screen.findByRole('dialog', { name: '4. The Customs Shed: Mother Sedge' });
    expect(within(sheet).getByText('One thing Mother Sedge carries isn’t in your packs.')).toBeTruthy();
    // Move on is plain while her sheet is open (finding 1, as TR1).
    expect(screen.getByRole('button', { name: 'Move on' }).className).not.toContain('button-primary');
    await user.click(within(sheet).getByText('Warden’s lantern'));
    const one = await screen.findByRole('dialog', { name: 'Mother Sedge: Warden’s lantern' });
    expect(within(one).getByText('A lantern on a pole.')).toBeTruthy();
    await user.click(within(one).getByText('To a character'));
    await user.click(within(await screen.findByRole('dialog', { name: 'Send to' })).getByText('Wren'));
    expect(await screen.findByText('Warden’s lantern sent to Wren.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Undo/ })).toBeTruthy();
    const back = await screen.findByRole('dialog', { name: '4. The Customs Shed: Mother Sedge' });
    expect(await within(back).findByText('Sent to Wren.')).toBeTruthy();
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.'));
    expect(world.tables.inventory_lines.some((l) => l.name === 'Warden’s lantern')).toBe(true);
    // Take it back, from the thing's own sheet.
    await user.click(within(back).getByText('Warden’s lantern'));
    await user.click(within(await screen.findByRole('dialog', { name: 'Mother Sedge: Warden’s lantern' })).getByText('Take it back'));
    expect(await screen.findByText('Taken back from Wren: Warden’s lantern.')).toBeTruthy();
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Warden’s lantern, Iron key.'));
  });

  /** The GM's log reads fail from now on while `down` is true (offline, a blip); every other read is as before. */
  function eventsDown() {
    const state = { down: false };
    const failed: unknown = new Proxy({}, { get: (_, key) => (key === 'then' ? (done: (v: unknown) => void) => done({ data: null, error: { message: 'offline' } }) : () => failed) });
    const real = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => (state.down && table === 'events' ? failed : real(table as never))) as never);
    return state;
  }

  // Purpose (S1): after a good read showed the lantern sent to Wren, a failed read of the log keeps it sent, so her line
  // never reads "warden’s lantern" again and her sheet never offers it a second time.
  it('keeps what was sent when a later read of the log fails', async () => {
    const { trip, row } = await atShed();
    const sent = await runCommand(registry, world.db, gm(), giveFind, { campaignId: campaign, to: world.tables.actors[0]!.id as string, placeId: row.place!.id, things: [{ libraryEntryId: 'entry-wardens-lantern', qty: 1 }], coins: {}, rows: ['held:mother-sedge:wardens-lantern'] });
    expect(sent.ok).toBe(true);
    const down = eventsDown();
    const view = page(trip, row);
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.'));
    down.down = true;
    view.rerender(
      <ToastHost>
        <SceneWaitingProvider>
          <GmPlacePage db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }} expeditionId={trip} group={1} groupLabel={null} row={{ ...row }} checks={[]} recent={[]} onChanged={() => {}} />
        </SceneWaitingProvider>
      </ToastHost>,
    );
    await waitFor(() => expect(vi.mocked(world.db.from).mock.calls.filter(([t]) => t === 'events').length).toBeGreaterThan(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.');
  });

  // Purpose (S1, dgc-14): when the log has never been read, her piece says so in plain words, naming her, and her words
  // open no sheet, so no send is offered on a guess.
  it('says her things can’t be read when the first read of the log fails', async () => {
    const { trip, row } = await atShed();
    eventsDown().down = true;
    const view = page(trip, row);
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe("Couldn't read what Mother Sedge carries. Check your connection and try again."));
    expect(carriesUnreadWords('Mother Sedge')).toBe(view.container.querySelector('.person-carries')?.textContent);
    expect(screen.getByRole('button', { name: `Edit piece: ${SEDGE_WORDS}` })).toBeTruthy();
  });

  /**
   * The lantern sent to Wren at the Shed in turn 3 (twenty minutes in), then the party at the Watch House, where Mother
   * Sedge stands too: her sheet there lists the lantern under "Sent before".
   */
  async function sentAtShedNowAtWatch(): Promise<{ trip: string; row: GroupPlace }> {
    const { trip, row: shed } = await atShed();
    world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 1200;
    const sent = await runCommand(registry, world.db, gm(), giveFind, { campaignId: campaign, to: world.tables.actors[0]!.id as string, placeId: shed.place!.id, things: [{ libraryEntryId: 'entry-wardens-lantern', qty: 1 }], coins: {}, rows: ['held:mother-sedge:wardens-lantern'] });
    if (!sent.ok) throw new Error(sent.message);
    const moved = await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: WATCH.id, name: WATCH.name, data: WATCH } });
    if (!moved.ok) throw new Error(moved.message);
    return { trip, row: (await loadGroupPlaces(world.db, campaign, trip))!.get(1)! };
  }
  const BEFORE = 'Sent before: Warden’s lantern, to Wren, at 4. The Customs Shed.';
  const herSheet = () => screen.findByRole('dialog', { name: '6. The Watch House: Mother Sedge' });

  // Purpose (dgc-5, sb4-13, sb4-12): at another place, a "Sent before" line opens that thing's sheet, which says where it
  // went, the place and the turn; Take it back there returns it to her, her line and her sheet follow, and its toast
  // keeps the pack's capitals and has Undo, which sends it to Wren again.
  it('opens a thing sent before from its line, and takes it back from there', async () => {
    const user = userEvent.setup();
    const { trip, row } = await sentAtShedNowAtWatch();
    const view = page(trip, row, false, TURNS);
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.'));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${SEDGE_WORDS}`) }));
    await user.click(within(await herSheet()).getByRole('button', { name: BEFORE }));
    const one = await screen.findByRole('dialog', { name: 'Mother Sedge: Warden’s lantern' });
    expect(await within(one).findByText('Sent to Wren at 4. The Customs Shed, turn 3.')).toBeTruthy();
    await user.click(within(one).getByText('Take it back'));
    expect(await screen.findByText('Taken back from Wren: Warden’s lantern.')).toBeTruthy();
    expect(world.tables.inventory_lines.some((l) => l.name === 'Warden’s lantern' && !l.undone)).toBe(false);
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Warden’s lantern, Iron key.'));
    // Her sheet follows: the lantern is a row of hers again, and no line says it was sent before.
    await user.click(within(screen.getByRole('dialog', { name: 'Mother Sedge: Warden’s lantern' })).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${SEDGE_WORDS}`) }));
    const again = await herSheet();
    expect(within(again).getByText('Warden’s lantern', { exact: true })).toBeTruthy();
    expect(within(again).queryByText(BEFORE)).toBeNull();
    // Undo on the toast sends it to Wren again, as it was.
    await user.click(screen.getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.'));
    expect(await within(await herSheet()).findByText(BEFORE)).toBeTruthy();
  });

  // Purpose: a Take it back the log refuses (Wren's lantern has changed since) gives the error toast with its reason, and
  // her line still says it went.
  it('a refused Take it back gives the error toast with its reason', async () => {
    const user = userEvent.setup();
    const { trip, row } = await sentAtShedNowAtWatch();
    world.tables.inventory_lines = [];
    const view = page(trip, row);
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.'));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${SEDGE_WORDS}`) }));
    await user.click(within(await herSheet()).getByRole('button', { name: BEFORE }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Mother Sedge: Warden’s lantern' })).getByText('Take it back'));
    expect(await screen.findByText("That's changed since. Undo the later change first.")).toBeTruthy();
    expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: Iron key. Warden’s lantern sent to Wren.');
  });
});

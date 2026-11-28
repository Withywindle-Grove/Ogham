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
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { runCommand } from '../core/commands.ts';
import type { HeldState } from '../modules/expedition/personHolds.ts';
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
  const line = <CarriesLine lead="Carries:" rest="warden’s lantern, iron key." />;

  // Purpose: on a tablet the label comes first, then her stat line, then the Carries line.
  it('puts the Carries line after her stat line on a tablet', () => {
    render(<ul><PieceRow page piece={person('NPC: mother-sedge')} names={names} onToggle={() => {}} onEdit={() => {}} onOpen={() => {}} carries={{ line, first: false }} /></ul>);
    expect(linesOf(screen.getByRole('listitem'))).toEqual([SEDGE_WORDS, 'Only you see this.', 'The stat line never shows (NPC: Mother Sedge).', 'Carries: warden’s lantern, iron key.']);
  });

  // Purpose: on a phone the Carries line sits above her stat line, under the label.
  it('puts the Carries line above her stat line on a phone', () => {
    render(<ul><PieceRow page piece={person('NPC: mother-sedge')} names={names} onToggle={() => {}} onEdit={() => {}} onOpen={() => {}} carries={{ line, first: true }} /></ul>);
    expect(linesOf(screen.getByRole('listitem'))).toEqual([SEDGE_WORDS, 'Only you see this.', 'Carries: warden’s lantern, iron key.', 'The stat line never shows (NPC: Mother Sedge).']);
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
  // row last; no "Send all" and no accent button.
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
        before={['Sent before: Iron key, to Wren, at 6. The Watch House.']}
        missing="One thing she carries isn’t in your packs."
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
    expect(within(sheet).getByText('One thing she carries isn’t in your packs.')).toBeTruthy();
    expect(within(sheet).getByText('Sent before: Iron key, to Wren, at 6. The Watch House.')).toBeTruthy();
    const buttons = within(sheet).getAllByRole('button').map((b) => b.textContent ?? '');
    expect(buttons.at(-1)).toContain("Edit the piece's words");
    expect(buttons.some((b) => b.includes('Send all'))).toBe(false);
    expect(sheet.querySelector('.button-primary, .stacked-button--primary')).toBeNull();
    await userEvent.click(within(sheet).getByText('Oil flask ×999'));
    expect(onThing).toHaveBeenCalledWith(expect.objectContaining({ key: 'oil' }));
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
  function page(trip: string, row: GroupPlace, phone = false) {
    return render(
      <ToastHost>
        <SceneWaitingProvider>
          <GmPlacePage db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }} expeditionId={trip} group={1} groupLabel={null} row={row} checks={[]} recent={[]} phone={phone} onChanged={() => {}} />
        </SceneWaitingProvider>
      </ToastHost>,
    );
  }

  // Purpose: her piece says what she carries; Old Harl, who carries nothing, is as today.
  it('shows her Carries line, and leaves a person who carries nothing as today', async () => {
    const { trip, row } = await atShed();
    page(trip, row);
    expect(await screen.findByText('warden’s lantern, iron key.', { exact: false })).toBeTruthy();
    expect(screen.getAllByText('Only you see this.')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Edit piece: A ferryman asleep on a coil of rope.' })).toBeTruthy();
    expect(screen.queryByText(/moon-bell/)).toBeNull();
  });

  // Purpose: her words open her sheet; a thing's row opens its sheet; To a character sends it to Wren with the toast and
  // Undo; her sheet and her line say where it went; Take it back returns it, with its toast.
  it('sends a thing she carries to Wren, and takes it back', async () => {
    const user = userEvent.setup();
    const { trip, row } = await atShed();
    const view = page(trip, row);
    await screen.findByText('warden’s lantern, iron key.', { exact: false });
    await user.click(screen.getByRole('button', { name: new RegExp(`^${SEDGE_WORDS}`) }));
    const sheet = await screen.findByRole('dialog', { name: '4. The Customs Shed: Mother Sedge' });
    expect(within(sheet).getByText('One thing she carries isn’t in your packs.')).toBeTruthy();
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
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: iron key. Warden’s lantern sent to Wren.'));
    expect(world.tables.inventory_lines.some((l) => l.name === 'Warden’s lantern')).toBe(true);
    // Take it back, from the thing's own sheet.
    await user.click(within(back).getByText('Warden’s lantern'));
    await user.click(within(await screen.findByRole('dialog', { name: 'Mother Sedge: Warden’s lantern' })).getByText('Take it back'));
    expect(await screen.findByText('Taken back from Wren: warden’s lantern.')).toBeTruthy();
    await waitFor(() => expect(view.container.querySelector('.person-carries')?.textContent).toBe('Carries: warden’s lantern, iron key.'));
  });
});

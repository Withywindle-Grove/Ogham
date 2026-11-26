// @vitest-environment jsdom
// The GM's place card (invented words only):
//   B16 (M5 gate): no "Only you see this" (the card is the GM's by construction); "Notes", visibly expandable: a
//   chevron, and the first line written while folded.
//   B1 (M5b g2): a place is a list of pieces. The header counts "N of M pieces shown"; each piece's eye button is
//   labelled "Show players" while hidden and "Hide from players" while shown; a place with no pieces shows "+ Piece"
//   alone; 50 pieces all list (the card grows, the page scrolls); a treasure's value stays on the GM's kind line.
//   Clicked through on the stand-in database: Show, then Undo hides it again; Hide all, then Undo shows exactly what
//   was shown, in the same order; + Piece adds a hidden piece.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { loadGroupPlaces, type GroupPlace, type Piece } from '../modules/expedition/placePlay.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { namedParts, NotesFold, PlaceCard } from './PlaceCard.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => cleanup());

const piece = (id: string, text: string, shown = false, extra: Partial<Piece> = {}): Piece => ({
  id,
  kind: 'exit',
  text,
  shown,
  shownAt: shown ? '2026-11-01T12:00:00Z' : null,
  gm: { value: '', trigger: '', statLine: '' },
  version: 1,
  ...extra,
});

const row = (pieces: Piece[], traps = ''): GroupPlace => ({
  id: 'gp-1',
  campaignId: 'c',
  expeditionId: 'e',
  group: 1,
  placeId: 'p-1',
  shown: false,
  place: {
    id: 'p-1',
    campaignId: 'c',
    name: 'The Moth Gallery',
    description: '',
    notes: { traps, puzzles: '', encounters: '', treasure: '', doors: '' },
    version: 1,
    notesVersion: 1,
  },
  pieces,
});

const gmUser = { id: 'gm', roles: { c: 'gm' } } as unknown as CurrentUser;

function card(place: GroupPlace, db: Db = createFakeDb().db, user: CurrentUser = gmUser, onChanged: () => void = () => undefined) {
  return render(
    <ToastHost>
      <PlaceCard
        db={db}
        user={user}
        campaign={{ id: place.campaignId, name: 'The Ash Barrows', role: 'gm', line: null }}
        group={1}
        groupLabel={null}
        row={place}
        checks={[]}
        recent={[]}
        onChanged={onChanged}
      />
    </ToastHost>,
  );
}

describe('the place card (B16)', () => {
  it('never says "Only you see this"', () => {
    card(row([]));
    expect(screen.queryByText(/Only you see this/)).toBeNull();
    expect(screen.queryByText(/see this/)).toBeNull();
  });

  it('folds the notes under "Notes" with a chevron and the first line written', () => {
    card(row([], 'A loose flagstone by the door.\nIt tilts.'));
    const summary = screen.getByText('Notes').closest('summary') as HTMLElement;
    expect(summary.querySelector('.place-card__chevron')).toBeTruthy();
    expect(summary.textContent).toContain('A loose flagstone by the door.');
    expect(summary.textContent).not.toContain('It tilts.');
    expect(screen.queryByText('Your notes')).toBeNull();
  });

  it('has no "GM screen" button any more (the reference is in the top row)', () => {
    card(row([]));
    expect(screen.queryByRole('button', { name: /GM screen/ })).toBeNull();
  });
});

describe('the place card as pieces (B1)', () => {
  it('counts the shown pieces and labels each eye by what a tap does', () => {
    card(row([piece('a', 'Stairs up, to the north', true), piece('b', 'An archway to the east, dark beyond')]));
    expect(screen.getByText('1 of 2 pieces shown')).toBeTruthy();
    const hide = screen.getByRole('button', { name: 'Hide from players' });
    const show = screen.getByRole('button', { name: 'Show players' });
    expect(hide.className).toContain('place-card__eye--shown');
    expect(show.className).not.toContain('place-card__eye--shown');
    // December 2c: the eye says Shown or Hidden beside its icon (it said nothing before); the label says what a tap does.
    expect(hide.textContent).toBe('Shown');
    expect(show.textContent).toBe('Hidden');
  });

  // Purpose (2c, pf-3; kw-1 (a), 2026-11-15): a piece made from a pack's aspect shows its lead-in before its words as
  // the shared book label (the label colour, regular weight), with a full stop when the lead has none; a piece without
  // a lead reads as before.
  it("shows an aspect's lead-in as the book label before its words", () => {
    card(row([{ ...piece('a', 'A brass lantern with an eel round it.'), lead: 'Sign' }, piece('b', 'An archway to the east')]));
    const lead = screen.getByText('Sign.');
    expect(lead.tagName).toBe('SPAN');
    expect(lead.className).toBe('book-label');
    expect(lead.parentElement?.textContent).toBe('Sign. A brass lantern with an eel round it.');
    expect(screen.getByText('An archway to the east').querySelector('strong')).toBeNull();
  });

  // Purpose (hx-2, 2026-11-15): "Hide all" is offered only while something is shown: none at 0 shown, there at 1 shown.
  it('offers Hide all only while something is shown', () => {
    card(row([piece('a', 'An archway to the east'), piece('b', 'A drain')]));
    expect(screen.queryByRole('button', { name: 'Hide all' })).toBeNull();
    cleanup();
    card(row([piece('a', 'An archway to the east', true), piece('b', 'A drain')]));
    expect(screen.getByRole('button', { name: 'Hide all' })).toBeTruthy();
  });

  it('shows "+ Piece" alone for a place with no pieces', () => {
    card(row([]));
    expect(screen.getByRole('button', { name: '+ Piece' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show players' })).toBeNull();
    expect(screen.queryByText(/pieces? shown/)).toBeNull();
  });

  it('lists all 50 pieces of a crowded place', () => {
    card(row(Array.from({ length: 50 }, (_, i) => piece(`p${i}`, `Piece number ${i + 1}`, i < 3))));
    expect(screen.getAllByRole('button', { name: /^(Show players|Hide from players)$/ })).toHaveLength(50);
    expect(screen.getByText('3 of 50 pieces shown')).toBeTruthy();
  });

  it("keeps a treasure's value on the GM's kind line, beside the words players would see", () => {
    card(row([piece('t', 'A silver seal under a loose flagstone', false, { kind: 'treasure', gm: { value: '40 gp', trigger: '', statLine: '' } })]));
    expect(screen.getByText('Treasure, value stays yours (40 gp)')).toBeTruthy();
  });

  // Purpose: the kind line names the pack's item, creature and character as a person would (Q7), never their ids; on a
  // place the GM made by hand, words no pack knows stay as typed ("asleep", an unknown item id).
  it("names the pack's entries on the kind line, never their ids", async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    world.tables.campaign_packs.push({ campaign_id: campaign, pack_id: 'pack-reed', priority: 1 });
    world.tables.library_entries.push(
      { id: 'e1', pack_id: 'pack-reed', kind: 'item', pack_entry_id: 'silver-arrows', name: 'Silver-tipped arrows', data: {} },
      { id: 'e2', pack_id: 'pack-reed', kind: 'statBlock', pack_entry_id: 'bog-lurker', name: 'Bog lurker', data: {} },
      { id: 'e3', pack_id: 'pack-reed', kind: 'npc', pack_entry_id: 'npc-oswy', name: 'Oswy', data: {} },
    );
    const gm3 = (value: string, statLine: string) => ({ value, trigger: '', statLine });
    const place = row([
      piece('t', 'A quiver under the planks', false, { kind: 'treasure', gm: gm3('40 gp, Item: silver-arrows', '') }),
      piece('c', 'Six humps in the mud', false, { kind: 'person', gm: gm3('', 'bog-lurker ×6 (asleep)') }),
      piece('n', 'A ferryman mends a net', false, { kind: 'person', gm: gm3('', 'NPC: npc-oswy') }),
      piece('u', 'A pouch of something', false, { kind: 'treasure', gm: gm3('3 sp, Item: no-such-thing', '') }),
      piece('a', 'A dog by the fire', false, { kind: 'person', gm: gm3('', 'asleep') }),
    ]);
    card({ ...place, campaignId: campaign }, world.db, { id: gm, roles: { [campaign]: 'gm' } } as unknown as CurrentUser);
    expect(await screen.findByText('Treasure, value stays yours (40 gp, Item: Silver-tipped arrows)')).toBeTruthy();
    expect(screen.getByText('Someone here, the stat line never shows (Bog lurker ×6 (asleep))')).toBeTruthy();
    expect(screen.getByText('Someone here, the stat line never shows (NPC: Oswy)')).toBeTruthy();
    expect(screen.getByText('Treasure, value stays yours (3 sp, Item: no-such-thing)')).toBeTruthy();
    expect(screen.getByText('Someone here, the stat line never shows (asleep)')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/silver-arrows|bog-lurker|npc-oswy/);
  });
});

/** A world with the GM, an expedition under way, the party at the Moth Gallery and its pieces. */
function table() {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.signInAs(gm);
  world.tables.expeditions.push({ id: 'trip', campaign_id: campaign, session_id: null, mode: 'dungeon', started_at: 0, ended_at: null, who_went: [], summary: null, started_by: gm, undone: false, version: 1 });
  world.tables.places.push({ id: 'moth', campaign_id: campaign, name: 'The Moth Gallery', description: '', version: 1, undone: false });
  world.tables.place_notes.push({ id: 'moth', campaign_id: campaign, traps: '', puzzles: '', encounters: '', treasure: '', doors: '', version: 1 });
  world.tables.group_places.push({ id: 'visit', campaign_id: campaign, expedition_id: 'trip', group_number: 1, place_id: 'moth', shown: false, moved_on: false, undone: false, created_at: '2026-11-01T12:00:00Z' });
  const add = (id: string, body: string, position: number) =>
    world.tables.place_pieces.push({ id, campaign_id: campaign, place_id: 'moth', kind: 'exit', body, position, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false });
  add('stairs', 'Stairs up, to the north', 0);
  add('arch', 'An archway to the east', 1);
  add('drain', 'A drain gurgles underfoot', 2);
  const user: CurrentUser = { id: gm, roles: { [campaign]: 'gm' } };
  return { world, campaign, user };
}

/** The card as Scene shows it: reloaded after every change. */
function Live({ db, user, campaignId }: { db: Db; user: CurrentUser; campaignId: string }) {
  const [place, setPlace] = useState<GroupPlace | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    void loadGroupPlaces(db, campaignId, 'trip').then((all) => setPlace(all?.get(1) ?? null));
  }, [db, campaignId, version]);
  if (!place) return null;
  return (
    <PlaceCard db={db} user={user} campaign={{ id: campaignId, name: 'The Ash Barrows', role: 'gm', line: null }} group={1} groupLabel={null} row={place} checks={[]} recent={[]} onChanged={() => setVersion((v) => v + 1)} />
  );
}

const shownNow = (world: ReturnType<typeof createFakeDb>) =>
  world.tables.piece_shows
    .filter((s) => s.shown === true && !s.undone)
    .sort((a, b) => String(a.shown_at).localeCompare(String(b.shown_at)))
    .map((s) => s.piece_id);

describe('showing pieces, clicked through (B1)', () => {
  it('Show, then Undo hides it again', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click((await screen.findAllByRole('button', { name: 'Show players' }))[1]!);
    expect(await screen.findByText('Shown to the party: An archway to the east')).toBeTruthy();
    expect(shownNow(world)).toEqual(['arch']);
    await waitFor(() => expect(screen.getByText('1 of 3 pieces shown')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(shownNow(world)).toEqual([]));
    await waitFor(() => expect(screen.getByText('0 of 3 pieces shown')).toBeTruthy());
  });

  it('Hide all, then Undo shows exactly what was shown, in the same order', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    // Show the drain first, then the stairs: that's the players' order.
    await userEvent.click((await screen.findAllByRole('button', { name: 'Show players' }))[2]!);
    await waitFor(() => expect(screen.getByText('1 of 3 pieces shown')).toBeTruthy());
    await userEvent.click(screen.getAllByRole('button', { name: 'Show players' })[0]!);
    await waitFor(() => expect(screen.getByText('2 of 3 pieces shown')).toBeTruthy());
    expect(shownNow(world)).toEqual(['drain', 'stairs']);
    await userEvent.click(screen.getByRole('button', { name: 'Hide all' }));
    expect(await screen.findByText('Hidden from the party: 2 pieces')).toBeTruthy();
    expect(shownNow(world)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(shownNow(world)).toEqual(['drain', 'stairs']));
  });

  it('+ Piece adds a hidden piece at the end', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click(await screen.findByRole('button', { name: '+ Piece' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clue' }));
    await userEvent.type(screen.getByLabelText('What players will see'), 'Wet footprints to the lectern');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByText('0 of 4 pieces shown')).toBeTruthy());
    expect(world.tables.place_pieces.at(-1)).toMatchObject({ kind: 'clue', body: 'Wet footprints to the lectern', position: 3 });
    expect(screen.getByText('Wet footprints to the lectern')).toBeTruthy();
  });

  // After they're added (M5b g2b): the row's text is the Edit piece button beside the eye; the form opens filled in,
  // Save changes the piece with Undo; Remove this piece retires it with Undo; an empty Save answers in a line;
  // Where now? back to a place visited before brings back what was shown, and the toast counts them.
  it('each row has its Edit piece text button and its eye; tapping the text opens the form filled in', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.querySelectorAll('button')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Edit piece: An archway to the east' }));
    expect(screen.getByRole('heading', { name: 'Edit piece' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit', pressed: true })).toBeTruthy();
    expect((screen.getByLabelText('What players will see') as HTMLInputElement).value).toBe('An archway to the east');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove this piece' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Piece' })).toBeNull();
    // Cancel: the form goes and + Piece is back.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: '+ Piece' })).toBeTruthy();
  });

  it('Save changes the piece (its kind and words) with Undo; a shown piece says who sees it', async () => {
    const { world, campaign, user } = table();
    world.tables.piece_shows.push({ id: 'show-arch', campaign_id: campaign, group_place_id: 'visit', piece_id: 'arch', group_number: 1, shown: true, shown_at: '2026-11-01T12:01:00Z', undone: false });
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit piece: An archway to the east' }));
    expect(screen.getByText('Shown to the party now, players see the change as you save it.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clue' }));
    await userEvent.type(screen.getByLabelText('What players will see'), ', dark beyond');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Piece changed: An archway to the east, dark beyond')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit piece: An archway to the east, dark beyond' })).toBeTruthy());
    expect(world.tables.place_pieces.find((p) => p.id === 'arch')).toMatchObject({ kind: 'clue', body: 'An archway to the east, dark beyond', position: 1 });
    expect(shownNow(world)).toEqual(['arch']);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit piece: An archway to the east' })).toBeTruthy());
    expect(world.tables.place_pieces.find((p) => p.id === 'arch')).toMatchObject({ kind: 'exit', body: 'An archway to the east' });
  });

  it('Save with nothing typed says so and keeps the piece', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit piece: An archway to the east' }));
    await userEvent.clear(screen.getByLabelText('What players will see'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Write what players will see.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Edit piece' })).toBeTruthy();
    expect(world.tables.place_pieces.find((p) => p.id === 'arch')!.body).toBe('An archway to the east');
  });

  it('Remove this piece takes it off the card with Undo; nothing is deleted', async () => {
    const { world, campaign, user } = table();
    world.tables.piece_shows.push({ id: 'show-arch', campaign_id: campaign, group_place_id: 'visit', piece_id: 'arch', group_number: 1, shown: true, shown_at: '2026-11-01T12:01:00Z', undone: false });
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit piece: An archway to the east' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove this piece' }));
    expect(await screen.findByText('Piece removed: An archway to the east')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('0 of 2 pieces shown')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Edit piece: An archway to the east' })).toBeNull();
    expect(world.tables.place_pieces).toHaveLength(3);
    expect(world.tables.place_pieces.find((p) => p.id === 'arch')!.undone).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByText('1 of 3 pieces shown')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Edit piece: An archway to the east' })).toBeTruthy();
  });

  it('Where now? back to a place visited before brings back what was shown, and the toast counts them', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click((await screen.findAllByRole('button', { name: 'Show players' }))[2]!);
    await waitFor(() => expect(screen.getByText('1 of 3 pieces shown')).toBeTruthy());
    await userEvent.click(screen.getAllByRole('button', { name: 'Show players' })[0]!);
    await waitFor(() => expect(screen.getByText('2 of 3 pieces shown')).toBeTruthy());
    const goTo = (name: string) => typePlace(userEvent, name, 'Change place');
    await goTo('The Bone Stair');
    expect(await screen.findByText('The party is at The Bone Stair')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'The Bone Stair' })).toBeTruthy());
    await goTo('The Moth Gallery');
    expect(await screen.findByText('The party is at The Moth Gallery, 2 pieces shown again')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('2 of 3 pieces shown')).toBeTruthy());
    // The new visit's shows, in the old order; the old visit's stand as they were (its own record).
    const here = world.tables.group_places.find((g) => !g.moved_on && !g.undone)!;
    expect(here.id).not.toBe('visit');
    expect(
      world.tables.piece_shows
        .filter((s) => s.group_place_id === here.id && s.shown === true && !s.undone)
        .sort((a, b) => String(a.shown_at).localeCompare(String(b.shown_at)))
        .map((s) => s.piece_id),
    ).toEqual(['drain', 'stairs']);
  });

  it('+ Piece with nothing typed says so instead of adding', async () => {
    const { world, campaign, user } = table();
    render(
      <ToastHost>
        <Live db={world.db} user={user} campaignId={campaign} />
      </ToastHost>,
    );
    await userEvent.click(await screen.findByRole('button', { name: '+ Piece' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Write what players will see.')).toBeTruthy();
    expect(world.tables.place_pieces).toHaveLength(3);
  });
});

// December piece 2c: a place from a pack shows what its entry gives (identity, facts, headed prose, tables, the watch)
// and its notes read with their lead-ins; a pack without those reads as before. Invented pack only.
describe('a place from a pack, as the town page reads it (2c)', () => {
  const packWorld = (data: Record<string, unknown>) => {
    const fake = createFakeDb();
    const gm = fake.addPerson('priya@lantern.example', 'Priya');
    const campaign = fake.addCampaign('The Reed Marches', gm);
    fake.signInAs(gm);
    fake.tables.packs.push({ id: 'pack-reed', owner_user_id: gm, campaign_id: null, name: 'Reed port', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-11T12:00:00Z', extra_meta: {} });
    fake.tables.campaign_packs.push({ campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'Reed port', priority: 1 });
    const entry = (kind: string, id: string, name: string, more: Record<string, unknown>) =>
      fake.tables.library_entries.push({ id: `entry-${kind}-${id}`, pack_id: 'pack-reed', kind, pack_entry_id: id, name, data: { id, name, ...more } });
    entry('location', 'reedmouth', 'Reedmouth', data);
    entry('table', 'reed-rumours', 'Reedmere rumours', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Eels in the well' }] });
    entry('statBlock', 'heron-warden', 'Heron warden', {});
    return fake.db;
  };
  const packRow = (traps = ''): GroupPlace => {
    const base = row([], traps);
    return { ...base, place: { ...base.place!, name: 'Reedmouth', pack: { packId: 'pack-reed', entryId: 'reedmouth', type: 'site', parentId: '', key: '' }, settlement: { size: 'town', population: null } } };
  };
  const town = {
    identity: 'A river town of reed-cutters, held by the [[npc:wardens|Heron Wardens]].',
    facts: [
      { lead: 'Inhabitants', text: '1,100 (a small town).' },
      { lead: 'Ruler', text: 'Warden Halewyn.' },
    ],
    tableIds: ['reed-rumours'],
    gm: { sections: [{ heading: 'The town', text: 'A hundred tarred roofs on stilts.' }, { heading: "The Wardens' grip", text: 'A toll at the quay.' }] },
    settlement: { size: 'town', watch: { text: 'Six Wardens with poles and nets.', leads: [{ lead: 'Arrival on the scene', text: '2d6 rounds.' }], statBlockId: 'heron-warden' } },
  };

  // Purpose: the identity line, the facts as bold lead-ins, the prose folded under its headings, the tables as rows
  // and the watch's box (its stat block by name, never its id); a link shows as its label, never its marks.
  it("shows the entry's identity, facts, prose, tables and watch", async () => {
    card(packRow(), packWorld(town));
    expect(await screen.findByText('A river town of reed-cutters, held by the Heron Wardens.')).toBeTruthy();
    expect(screen.queryByText(/\[\[/)).toBeNull();
    const ruler = screen.getByText('Ruler.');
    expect(ruler.tagName).toBe('STRONG');
    expect(ruler.parentElement?.textContent).toBe('Ruler. Warden Halewyn.');
    expect(screen.getByRole('heading', { name: 'About the town' })).toBeTruthy();
    const fold = screen.getByText("The Wardens' grip").closest('details') as HTMLDetailsElement;
    expect(fold.open).toBe(false);
    const watch = screen.getByRole('group', { name: 'The watch' });
    expect(watch.textContent).toContain('Six Wardens with poles and nets.');
    expect(await screen.findByText('Heron warden')).toBeTruthy();
    expect(watch.textContent).not.toContain('heron-warden');
    // The table opens full screen, for reading.
    await userEvent.click(await screen.findByRole('button', { name: /Reedmere rumours/ }));
    expect(await screen.findByRole('dialog', { name: 'Reedmere rumours' })).toBeTruthy();
    expect(screen.getByText(/Eels in the well/)).toBeTruthy();
  });

  // Purpose (pf-18b, page 22; Francis's fixes of 2026-11-18): an opened GM section in blocks draws the book's look
  // (sub-heading, list, lead-in, box); a plain-string section its paragraphs through the same rule-text part (so the
  // same gap between them); a section the app can't read keeps its heading with one muted line; an empty section keeps
  // its heading and opens to nothing; no raw JSON and no link marks show.
  it('draws a GM section in blocks, a plain one, one with no words, and an empty one', async () => {
    const sections = [
      {
        heading: 'The Eel and Lantern',
        text: { blocks: [{ h: 'What the house offers' }, { list: ['Hot eel stew all day.', 'A dry loft.'] }, { lead: 'The keeper', text: 'Old Marrow.' }, { box: [{ p: 'Ask [[npc:wardens|the Wardens]].' }] }] },
      },
      { heading: 'A brewing trouble', text: 'Halewyn owes the ferrymen.\nSomeone asks for a letter.' },
      { heading: 'Older notes', text: { blocks: [{ words: 'not a block' }] } },
      { heading: 'Still to write', text: '' },
    ];
    card(packRow(), packWorld({ ...town, gm: { sections } }));
    const fold = (await screen.findByText('The Eel and Lantern')).closest('details') as HTMLDetailsElement;
    expect(within(fold).getByRole('heading', { name: 'What the house offers' })).toBeTruthy();
    expect(within(fold).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Hot eel stew all day.', 'A dry loft.']);
    expect(within(fold).getByText('The keeper.').tagName).toBe('STRONG');
    expect(within(fold).getByText('Ask the Wardens.').closest('.rule-text__box')).toBeTruthy();
    const plain = screen.getByText('A brewing trouble').closest('details') as HTMLDetailsElement;
    expect([...plain.querySelectorAll('.rule-text > .rule-text__p')].map((p) => p.textContent)).toEqual(['Halewyn owes the ferrymen.', 'Someone asks for a letter.']);
    const older = screen.getByText('Older notes').closest('details') as HTMLDetailsElement;
    expect(within(older).getByText('The pack gives no words for this section.')).toBeTruthy();
    const unwritten = screen.getByText('Still to write').closest('details') as HTMLDetailsElement;
    expect([...unwritten.children].map((el) => el.tagName)).toEqual(['SUMMARY']);
    expect(screen.getAllByText('The pack gives no words for this section.')).toHaveLength(1);
    expect(screen.queryByText(/\[\[|"words"|blocks/)).toBeNull();
  });

  // Purpose (frame 10): a pack's notes read with a bold lead-in on a label-and-colon line; Edit notes opens the fields.
  it('reads the notes with their lead-ins, and Edit notes opens the fields', async () => {
    card(packRow('Ruler: Warden Halewyn (p. 64).\nThe quay floods each spring.'), packWorld({ gm: { notes: 'flat' } }));
    await userEvent.click(screen.getByText('Notes'));
    const lead = screen.getAllByText('Ruler.').find((el) => el.closest('.place-facts__notes'))!;
    expect(lead.tagName).toBe('STRONG');
    expect(screen.queryByLabelText('Traps')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Edit notes' }));
    expect((screen.getByLabelText('Traps') as HTMLTextAreaElement).value).toBe('Ruler: Warden Halewyn (p. 64).\nThe quay floods each spring.');
  });

  // Purpose (frame 13): a part the pack doesn't give isn't drawn: a hamlet with an identity and flat notes has no
  // empty About, Tables or watch.
  it('draws only the parts the pack gives', async () => {
    card(packRow(), packWorld({ identity: 'Four huts on an island of willow roots.', gm: { notes: 'Only notes.' } }));
    expect(await screen.findByText('Four huts on an island of willow roots.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'About the town' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tables' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'The watch' })).toBeNull();
  });
});

// Plan scene-point-to-point B3 (p2p-10 to p2p-12; page 23, LA1, approved 2026-11-18). In plain words:
//   * no card says "Players see" or offers Rename for players, the town's card included (p2p-11, "Yes, everywhere");
//   * a description's words that name another piece are found as whole words, whatever their case, every time, the
//     longer name first, and the words themselves never change;
//   * on the place page, Notes with nothing written and no source line is not drawn at all.
describe('the Location’s card, redrawn (B3)', () => {
  it('the town’s card has no Players see and no Rename for players', async () => {
    const fake = createFakeDb();
    const gm = fake.addPerson('priya@lantern.example', 'Priya');
    const campaign = fake.addCampaign('The Reed Marches', gm);
    fake.signInAs(gm);
    fake.tables.packs.push({ id: 'pack-reed', owner_user_id: gm, campaign_id: null, name: 'Reed port', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-11T12:00:00Z', extra_meta: {} });
    fake.tables.campaign_packs.push({ campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'Reed port', priority: 1 });
    fake.tables.library_entries.push({ id: 'entry-reedmouth', pack_id: 'pack-reed', kind: 'location', pack_entry_id: 'reedmouth', name: 'Reedmouth', data: { id: 'reedmouth', name: 'Reedmouth', identity: 'A river town of reed-cutters.' } });
    const base = row([piece('a', 'Tarred roofs on stilts.')]);
    card({ ...base, place: { ...base.place!, name: 'Reedmouth', playersName: 'The river town', pack: { packId: 'pack-reed', entryId: 'reedmouth', type: 'site', parentId: '', key: '' } } }, fake.db);
    expect(await screen.findByText('A river town of reed-cutters.')).toBeTruthy();
    expect(screen.queryByText(/Players see/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename for players' })).toBeNull();
    expect(screen.queryByText(/The name goes out with the first piece you show/)).toBeNull();
  });

  it('marks the words of a description that name another piece', () => {
    const marked = (text: string, names: string[]) =>
      namedParts(text, names)
        .filter((p) => p.named)
        .map((p) => p.text);
    const says = 'Black piles, a Mooring ring and a ladder; the ladder is rotten.';
    expect(
      namedParts(says, ['Mooring ring', 'Ladder.'])
        .map((p) => p.text)
        .join(''),
    ).toBe(says);
    expect(marked(says, ['Mooring ring', 'Ladder.'])).toEqual(['Mooring ring', 'ladder', 'ladder']);
    // Whole words only: "ring" names nothing inside "rings" or "string".
    expect(marked('Rings on a string, and one ring.', ['Ring'])).toEqual(['ring']);
    // The longer name wins where two overlap; two spaces between its words still match.
    expect(marked('Rusted iron rings line the wall.', ['Iron', 'Iron rings'])).toEqual(['iron rings']);
    expect(marked('The old  well.', ['Old well'])).toEqual(['old  well']);
    // Nothing to mark: the words as they are; no words: nothing.
    expect(namedParts('A plain wall.', [])).toEqual([{ text: 'A plain wall.', named: false }]);
    expect(namedParts('', ['Wall'])).toEqual([]);
    // A name that reads as a pattern is taken as words.
    expect(marked('A (sealed) door, and a sealed door.', ['(sealed) door'])).toEqual(['(sealed) door']);
  });

  it('the place page’s Notes is absent with nothing written and no source line', () => {
    const base = row([]);
    const fromPack = { ...base.place!, pack: { packId: 'pack-reed', entryId: 'jetty', type: 'area', parentId: '', key: '' } };
    const { container } = render(<NotesFold page place={fromPack} source={null} onSave={() => undefined} />);
    expect(container.textContent).toBe('');
    cleanup();
    render(<NotesFold page place={fromPack} source="From your adventure: The Reed Marches." onSave={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-expanded')).toBe('false');
  });
});

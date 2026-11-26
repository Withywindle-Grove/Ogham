// @vitest-environment jsdom
// The GM's place page (December dec-7 piece 5b; page 11 of the December mockups, frames 1a, 1b, 2a, 2b, 4a to 4c, 5
// to 8; page 12, W1 to W3; approved pg-1). Invented places and words only, on the stand-in database. In plain words:
//   * at a place that holds spots, the page names the place with no line under it (B3), and lists the spots numbered
//     as the key writes them with their own lines, as plain rows: no eye and no count (frame 8); Knowledge and Rules sit
//     side by side; Move on is the accent, with the footprints (⚑ 2); no foot line; "Change place" is gone;
//   * at a spot, the trail names the place it sits in, and never moves the party (B2: a Region is plain words; an Area
//     opens its Locations panel, below); there is no spots list; "Waiting for you" says "Nothing waits." (at a place that holds spots too); the place's own check stands in "Checks here" with its
//     toggle on and the pack's own sentence with its die (p2p-14);
//   * the Location's card in the book's format (B3; p2p-10 to p2p-12, p2p-15; page 23, LA1): no "Pieces" heading, no
//     kind words, no "Players see" or Rename, no calls line; the description first, its words naming other pieces
//     marked; each further piece led by its own word, with a bare eye; the count and Hide all at the foot beside
//     "+ Piece"; Notes folded whole, the source line inside;
//   * Knowledge opens the place's Knowledge sheet; the Rules sheet opens from Rules;
//   * a place made by hand has no Knowledge, no Rules and no foot line; its Move on offers Somewhere else… alone, which
//     opens the picker; with no place yet the card asks "Where are we?" and its button is Set place;
//   * a place's own tables stand in a Tables card at a spot too;
//   * while an encounter card waits, it stands in the page's "Waiting for you" and Move on is plain;
//   * on a phone Move on sits in its own bar, the spots come before "Checks here", and an empty "Waiting for you" is
//     left out;
//   * the page and the pop-ups it opens are drawn in the book's faces, and the faces' scope is not creation's (it changes
//     no part's behaviour);
//   * waiting proposals: one names who and where with the way and "An obstacle."; several are numbered under "N ways
//     proposed"; one "Answer…" button.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { runCommand } from '../core/commands.ts';
import { addPiece, forgetPackPlaces, loadGroupPlaces, setPlace, showPiece, type GroupPlace } from '../modules/expedition/placePlay.ts';
import type { Check } from '../modules/expedition/modes.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { BookFaces } from '../ui/BookFaces.tsx';
import { BookTypeScope, Dialog } from '../ui/Dialog.tsx';
import { Icon, StepIcon } from '../ui/icons.tsx';
import { ICON_SET } from '../ui/iconSet.ts';
import { ProposalsWaiting } from '../ui/MoveOnParts.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { createAppRegistry } from './commandRegistry.ts';
import { byKey, checkLineWords, GmPlacePage, numberedName } from './GmPlacePage.tsx';
import { WaitingForYou, WaitingPanel } from './WaitingForYou.tsx';
import { accentOwner, SceneWaitingProvider, useStripPaused, useWaitingPanel, WaitingSource, type WaitingSourceItem } from './sceneWaiting.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const registry = createAppRegistry();
let world: FakeWorld;
let gmId: string;
let campaign: string;
const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } }) as CurrentUser;
/** A piece's words, from its arrow ("Edit piece: …"; sf-16, the words open nothing). */
const wordsOf = (arrow: HTMLElement): HTMLElement => arrow.closest('li')!.querySelector('.place-page__piece-words') as HTMLElement;

const HARBOUR = {
  id: 'drowned-harbour',
  name: 'The Drowned Harbour',
  type: 'region',
  identity: 'A silted harbour of five spots, crossed by boat or by swimming.',
  playerView: { text: 'Black water, a dry bar, a mast that shows at every tide.' },
  facts: [{ lead: 'Tides', text: 'Two a day; the bar dries at low water.' }],
  // A section of knowledge for the eye (P4, p4s-2).
  gm: { sections: [{ heading: 'What everyone knows', text: 'Nobody crosses at slack water.' }] },
  // The pack's own sentence for its check (p2p-14), word for word.
  encounterCheck: { name: 'Encounter check', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, note: 'Roll d6 for an encounter each time the party rows to a new Location.' },
  tableIds: ['tide-left'],
};
const FERRYMEN = 'The ferrymen moor here and nowhere else, and they notice who does not.';
// The jetty's description names two of its other pieces (p2p-10): "mooring ring" and "ladder", whatever their case.
const JETTY_SAYS = 'Black piles, a Mooring ring and a ladder; the ladder is rotten.';
const JETTY = {
  id: 'the-jetty',
  name: 'The jetty',
  key: '1',
  type: 'site',
  parentId: 'drowned-harbour',
  identity: 'Where the bog road gives out.',
  playerView: {
    text: JETTY_SAYS,
    aspects: [
      { lead: 'Mooring ring', text: 'Green copper; the fourth is new iron.' },
      { lead: 'Ladder', text: 'It goes down to a tarred skiff.' },
    ],
    exits: [{ text: 'A plank walk to the wreck.' }],
  },
  source: 'p. 38',
  tableIds: ['tide-left'],
  // The book's own text for the GM about this place (gt-1): a paragraph, a list, a boxed aside.
  gm: {
    text: {
      blocks: [
        { p: FERRYMEN },
        { list: ['The fourth mooring ring is new iron.', 'The planks of the seaward half are nailed, not pegged.'] },
        { box: [{ p: 'They say the old one went into the water with a boat on it.' }], title: 'If the party asks the ferrymen about the ring' },
      ],
    },
  },
};
const WRECK = { id: 'the-wreck', name: 'The wreck', key: '2', type: 'site', parentId: 'drowned-harbour', identity: 'A cog on her side on the bar.' };
const TIDE = { id: 'tide-left', name: 'What the tide left', die: 'd6', rows: [{ min: 1, max: 6, result: 'A drowned lantern' }] };

function seed() {
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gmId, campaign_id: null, name: 'The Reed Marches', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'cp-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, priority: 1 });
  // The wreck first: the pack's rows come back in no set order, and Spots here must still follow the key.
  for (const data of [HARBOUR, WRECK, JETTY]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: data.id, name: data.name, data });
  world.tables.library_entries.push({ id: 'entry-tide', pack_id: 'pack-reed', kind: 'table', pack_entry_id: TIDE.id, name: TIDE.name, data: TIDE });
}

/** The party at a place: one of the pack's, or one typed by hand. */
async function at(where: 'harbour' | 'jetty' | 'typed') {
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  const trip = started.data!.id;
  const data = where === 'harbour' ? HARBOUR : JETTY;
  const moved =
    where === 'typed'
      ? await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: 'Fenwick Hole', placeId: null, packEntry: null })
      : await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: data.id, name: data.name, data } });
  if (!moved.ok) throw new Error(moved.message);
  return { trip, row: (await loadGroupPlaces(world.db, campaign, trip))!.get(1)! };
}

const SETTING_CHECK: Check = {
  id: 'wandering',
  name: 'Wandering encounters',
  every: { value: 2, unit: 'turn' },
  when: null,
  chance: { die: 'd6', on: [1] },
  byTerrain: false,
  terrainChance: null,
  onlyAt: null,
  onHit: { tableId: 'river-wanderers', tableChoices: [], columns: [], regionTables: false, note: null },
  modifiers: [],
  secret: true,
  alsoWhen: [],
  note: null,
};

/** Encounters waiting, as the strip registers them in "Waiting for you" (S8a): Start is each one's first answer. */
function lurkers(n: number): WaitingSourceItem[] {
  return Array.from({ length: n }, (_, i) => {
    const name = i === 0 ? 'Bog lurker' : `Bog lurker ${i + 1}`;
    return { id: `encounter:${i + 1}`, kind: 'encounter', title: `An encounter waits: ${name}`, actions: [{ id: 'start', label: 'Start', icon: 'crossed-swords' }], card: <section aria-label={`Encounter waiting: ${name}`}>{name}</section> };
  });
}

/** A band with no session running, as SceneTime says it (its Resume session then holds the accent). */
function PausedStrip() {
  useStripPaused(true);
  return null;
}

function page(trip: string, row: GroupPlace | null, opts: { phone?: boolean; waiting?: number; paused?: boolean } = {}) {
  const onChanged = vi.fn();
  const view = render(
    <ToastHost>
      <SceneWaitingProvider>
        {opts.paused && <PausedStrip />}
        {opts.waiting ? <WaitingSource sourceKey="strip" items={lurkers(opts.waiting)} /> : null}
        <GmPlacePage
          db={world.db}
          user={gm()}
          campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }}
          expeditionId={trip}
          group={1}
          groupLabel={null}
          row={row}
          checks={[SETTING_CHECK]}
          recent={[]}
          phone={opts.phone}
          marching={<section aria-label="Marching order">Marching order</section>}
          onChanged={onChanged}
        />
      </SceneWaitingProvider>
    </ToastHost>,
  );
  return { ...view, onChanged };
}

beforeEach(() => {
  world = createFakeDb();
  gmId = world.addPerson('priya@lantern.example', 'Priya');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  world.signInAs(gmId);
  forgetPackPlaces();
  seed();
});
afterEach(cleanup);

describe('the GM’s place page', () => {
  it('at a place that holds spots: its name with no line under it, the spots as plain numbered rows, Knowledge and Rules, Move on, no foot line', async () => {
    const { trip, row } = await at('harbour');
    page(trip, row);
    expect(await screen.findByRole('heading', { name: 'The Drowned Harbour', level: 2 })).toBeTruthy();
    const spots = await screen.findByRole('region', { name: 'Locations' });
    expect(await within(spots).findByText('1. The jetty')).toBeTruthy();
    expect(await within(spots).findByText('Where the bog road gives out.')).toBeTruthy();
    expect(within(spots).getByText('2. The wreck')).toBeTruthy();
    // In the key's order, whatever order the pack's rows come in.
    expect([...spots.querySelectorAll('.place-page__spot-name')].map((n) => n.textContent)).toEqual(['1. The jetty', '2. The wreck']);
    // Frame 8: no eye, no count, nothing to tap.
    expect(within(spots).queryAllByRole('button')).toHaveLength(0);
    expect(within(spots).queryByText(/shown/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Knowledge' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move on' }).className).toContain('button-primary');
    expect(screen.queryByRole('button', { name: /Change place/ })).toBeNull();
    // B3 (p2p-10; LA1's fixes): the pack's line no longer stands under the name, and the card has no foot line with its
    // lone kind word (the source line is inside Notes). Read once the pack's entry is in (its tables follow it).
    expect(await within(await screen.findByRole('region', { name: 'Tables' })).findByText('What the tide left')).toBeTruthy();
    expect(screen.queryByText('A silted harbour of five spots, crossed by boat or by swimming.')).toBeNull();
    expect(screen.queryByText(/Region\. From your adventure/)).toBeNull();
    // Nothing waiting: "Waiting for you" collapses to "Nothing waits." here too (S8; the approval's fix 5, 2026-11-18).
    expect(within(await screen.findByRole('region', { name: 'Waiting for you' })).getByText('Nothing waits.')).toBeTruthy();
  });

  it('at a spot: a Region in the trail is plain words that move nobody; no spots list; Nothing waits; the own check with its toggle', async () => {
    const { trip, row } = await at('jetty');
    const { onChanged, container } = page(trip, row);
    expect(await screen.findByRole('heading', { name: '1. The jetty', level: 2 })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Locations' })).toBeNull();
    expect(within(await screen.findByRole('region', { name: 'Waiting for you' })).getByText('Nothing waits.')).toBeTruthy();
    // The harbour's check stands in here (the chain), on, with the pack's own sentence (p2p-14): word for word, its die
    // drawn, and no sentence of the app's.
    const toggle = await screen.findByRole('switch', { name: 'Encounter check: on every move, 1 in 6.' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    const sentence = container.querySelector('.place-page__check .place-page__check-sentence');
    expect(sentence?.textContent).toBe('Roll d6 for an encounter each time the party rows to a new Location.');
    expect(sentence?.querySelector('.die-glyph--d6')).toBeTruthy();
    expect(screen.queryByText(/own rule\. It stands in for/)).toBeNull();
    // The setting's check doesn't show while the place's stands in.
    expect(screen.queryByText(/Wandering encounters, /)).toBeNull();
    // B2 (p2p-8): the trail never moves the party. The harbour is a Region in this pack, so it is plain words until the
    // Region's own panel (LA2b) is approved: nothing to tap, nothing written.
    const trail = screen.getByRole('navigation', { name: 'Where it sits' });
    expect(within(trail).getByText('The Drowned Harbour')).toBeTruthy();
    expect(within(trail).queryAllByRole('button')).toHaveLength(0);
    expect(onChanged).not.toHaveBeenCalled();
  });

  // Purpose (B3; p2p-10, p2p-11; page 23, LA1): the pieces stand in the book's format with no "Pieces" heading: the
  // description once, first, the words in it that name another piece bold and underlined; each further piece led by
  // its own word in bold, a piece with none by its words alone, and no kind word anywhere; each with its bare eye. The
  // count and Hide all stand at the foot, beside "+ Piece" (hx-2: Hide all only while something is shown). No
  // "Players see" and no Rename for players.
  it('the pieces in the book’s format: the description first with its named words marked, lead words, no kinds, the count at the foot', async () => {
    const user = userEvent.setup();
    const { trip, row } = await at('jetty');
    const view = page(trip, row);
    // sf-16: each piece's words, beside the arrow that opens Edit piece (the words open nothing).
    const description = wordsOf(await screen.findByRole('button', { name: `Edit piece: ${JETTY_SAYS}` }));
    // The whole description reads as the pack wrote it; "Mooring ring" and both "ladder"s are marked.
    expect(description.textContent).toBe(JETTY_SAYS);
    expect([...description.querySelectorAll('strong.place-page__named')].map((n) => n.textContent)).toEqual(['Mooring ring', 'ladder', 'ladder']);
    const ring = wordsOf(screen.getByRole('button', { name: 'Edit piece: Green copper; the fourth is new iron.' }));
    expect(ring.querySelector('strong')?.textContent).toBe('Mooring ring.');
    expect(ring.querySelector('.place-page__named')).toBeNull();
    const exit = wordsOf(screen.getByRole('button', { name: 'Edit piece: A plank walk to the wreck.' }));
    expect(exit.textContent).toBe('A plank walk to the wreck.');
    // No kind word, no "Pieces" heading, no "Players see", no Rename.
    for (const kind of ['Description.', 'Other.', 'Exit.']) expect(screen.queryByText(kind)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pieces' })).toBeNull();
    expect(screen.queryByText(/Players see/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename for players' })).toBeNull();
    expect(screen.queryByText(/The name goes out with the first piece you show/)).toBeNull();
    // The description is the first row, the others in the pack's order.
    const rows = [...document.querySelectorAll('.place-page__pieces .place-page__opens')].map((b) => b.getAttribute('aria-label'));
    expect(rows).toEqual([`Edit piece: ${JETTY_SAYS}`, 'Edit piece: Green copper; the fourth is new iron.', 'Edit piece: It goes down to a tarred skiff.', 'Edit piece: A plank walk to the wreck.']);
    // The count at the foot, beside "+ Piece", after the last piece.
    const foot = document.querySelector('.place-page__foot') as HTMLElement;
    expect(within(foot).getByRole('button', { name: '+ Piece' })).toBeTruthy();
    expect(within(foot).getByText('0 of 4 shown')).toBeTruthy();
    expect(document.querySelector('.place-page__pieces')!.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide all' })).toBeNull();
    const eye = within(description.closest('li') as HTMLElement).getByRole('button', { name: 'Show players' });
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    expect(eye.textContent).toBe('');
    await user.click(eye);
    expect(await screen.findByText(/Shown to the party: Black piles/)).toBeTruthy();
    // Drawn again with the description shown: the count says so, and Hide all stands beside it at the foot.
    const shown = (await loadGroupPlaces(world.db, campaign, trip))!.get(1)!;
    view.unmount();
    page(trip, shown);
    const after = await waitFor(() => {
      const found = document.querySelector('.place-page__foot') as HTMLElement | null;
      if (!found || !within(found).queryByText('1 of 4 shown')) throw new Error('no count yet');
      return found;
    });
    const hide = within(after).getByRole('button', { name: 'Hide all' });
    // Hide all is the stacked button, the closed eye above its word (LA1, LA4; Francis 2026-11-19: "Yes, as the frame").
    expect(hide.classList.contains('stacked-button')).toBe(true);
    const shut = render(<Icon name="eye-shut" />);
    expect(hide.querySelector('svg')!.innerHTML).toBe(shut.container.querySelector('svg')!.innerHTML);
    shut.unmount();
    expect(hide.querySelector('span')!.textContent).toBe('Hide all');
    expect(screen.getAllByRole('button', { name: 'Hide from players' })[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  // Purpose (page 23, LA1 and LA4; Francis 2026-11-19: "Yes, as the frame"): "+ Piece" at the foot is the stacked
  // button, the jigsaw above its word; "+ Picture", while there is no picture, stays a word button beside it.
  it('"+ Piece" at the foot is the stacked button with the jigsaw', async () => {
    const { trip, row } = await at('jetty');
    page(trip, row);
    await screen.findByRole('button', { name: `Edit piece: ${JETTY_SAYS}` });
    const foot = document.querySelector('.place-page__foot') as HTMLElement;
    const add = within(foot).getByRole('button', { name: '+ Piece' });
    expect(add.classList.contains('stacked-button')).toBe(true);
    expect(add.querySelector('svg path')!.getAttribute('d')).toBe(ICON_SET['jigsaw-piece'].d);
    expect(add.querySelector('span')!.textContent).toBe('+ Piece');
    const picture = within(foot).getByRole('button', { name: '+ Picture' });
    expect(picture.classList.contains('stacked-button')).toBe(false);
    expect(picture.closest('.place-page__adds')).toBe(add.closest('.place-page__adds'));
  });

  // Purpose (p2p-10: "as the first piece"): a description the GM added after other pieces still stands first.
  it('a description added after other pieces still stands first', async () => {
    const { trip, row } = await at('jetty');
    const late = { ...row, pieces: [...row.pieces.filter((p) => p.kind !== 'description'), ...row.pieces.filter((p) => p.kind === 'description')] };
    page(trip, late);
    await screen.findByRole('button', { name: `Edit piece: ${JETTY_SAYS}` });
    const first = document.querySelector('.place-page__pieces .place-page__opens');
    expect(first?.getAttribute('aria-label')).toBe(`Edit piece: ${JETTY_SAYS}`);
  });

  // Purpose (⚑ 2, ruled 2026-11-18: "Yes, footprints"): Move on carries the footprints, the app's travel mark, not the
  // map pin; in the head and in the phone's bar.
  it('Move on carries the footprints, not the pin', async () => {
    const { trip, row } = await at('jetty');
    const marks = render(
      <>
        <span data-mark="travel">
          <StepIcon name="travel" size={20} />
        </span>
        <span data-mark="pin">
          <Icon name="pin" size={20} />
        </span>
      </>,
    );
    const travel = marks.container.querySelector('[data-mark="travel"] svg')!.innerHTML;
    const pin = marks.container.querySelector('[data-mark="pin"] svg')!.innerHTML;
    marks.unmount();
    page(trip, row);
    const moveOn = await screen.findByRole('button', { name: 'Move on' });
    expect(moveOn.querySelector('svg')!.innerHTML).toBe(travel);
    expect(moveOn.querySelector('svg')!.innerHTML).not.toBe(pin);
    cleanup();
    const phone = page(trip, row, { phone: true });
    const bar = await waitFor(() => phone.container.querySelector('.place-page__bar') as HTMLElement);
    expect(within(bar).getByRole('button', { name: 'Move on' }).querySelector('svg')!.innerHTML).toBe(travel);
  });

  // Purpose (p2p-15; plan B3): no calls line at a Location, even where an attached adventure has a call to give (the
  // rule behind it, a settlement only, is B19's).
  it('no calls line on the place page, even with a call to give', async () => {
    world.tables.library_entries.push({ id: 'entry-hook', pack_id: 'pack-reed', kind: 'adventureHook', pack_entry_id: 'bell', name: 'The drowned bell', data: { text: 'It rings at low tide.', pays: '', giver: null, order: 0 } });
    const { trip, row } = await at('jetty');
    page(trip, row);
    expect(await within(await screen.findByRole('region', { name: 'Tables' })).findByText('What the tide left')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: /Calls to adventure/ })).toBeNull();
  });

  // Purpose (p2p-12; LA1): Notes is one fully folded row, the word and the plus, no words of the notes showing; a tap
  // opens it, and the pack's source line is inside, with its page.
  it('Notes: folded whole, then opened with the source line inside', async () => {
    const user = userEvent.setup();
    const { trip, row } = await at('jetty');
    page(trip, row);
    const notes = await screen.findByRole('button', { name: 'Notes' });
    expect(notes.textContent).toBe('Notes');
    expect(notes.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/From your adventure/)).toBeNull();
    await user.click(notes);
    expect(notes.getAttribute('aria-expanded')).toBe('true');
    const body = document.getElementById(notes.getAttribute('aria-controls')!) as HTMLElement;
    expect(await within(body).findByText('From your adventure: The Reed Marches, p. 38.')).toBeTruthy();
  });

  it('Knowledge opens the place’s Knowledge sheet, Rules the Rules sheet', async () => {
    const user = userEvent.setup();
    const { trip, row } = await at('harbour');
    page(trip, row);
    // The pack's entry is read once its tables show (they are read from it).
    await within(await screen.findByRole('region', { name: 'Tables' })).findByText('What the tide left');
    await user.click(screen.getByRole('button', { name: 'Knowledge' }));
    const sheet = await screen.findByRole('dialog', { name: /Knowledge/ });
    expect(within(sheet).getByText(/Two a day; the bar dries at low water\./)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: /Close/ }));
    await user.click(screen.getByRole('button', { name: 'Rules' }));
    expect(await screen.findByRole('dialog', { name: /Rules/ })).toBeTruthy();
  });

  // Purpose (P4, p4s-2; frame 7b): the eye on a section shares it with the party at once, with an Undo toast; the
  // section then says so and the foot counts it; Undo takes the share away again.
  it("Knowledge's eye shares a section at once, and Undo takes it back", async () => {
    const user = userEvent.setup();
    const { trip, row } = await at('harbour');
    page(trip, row);
    await within(await screen.findByRole('region', { name: 'Tables' })).findByText('What the tide left');
    await user.click(screen.getByRole('button', { name: 'Knowledge' }));
    const sheet = await screen.findByRole('dialog', { name: /Knowledge/ });
    expect(await within(sheet).findByText('0 of 1 section shared.')).toBeTruthy();
    await user.click(within(sheet).getByRole('switch', { name: 'Share with the players: What everyone knows' }));
    expect(await within(sheet).findByText('1 of 1 section shared.')).toBeTruthy();
    expect(within(sheet).getByText(/^Shared with the players/)).toBeTruthy();
    expect(world.tables.knowledge_shares.filter((k) => k.shared === true && !k.undone)).toHaveLength(1);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(world.tables.knowledge_shares.filter((k) => k.shared === true && !k.undone)).toHaveLength(0));
  });

  it('a place made by hand: no Knowledge, Rules or foot; Move on offers Somewhere else… alone, which opens the picker', async () => {
    const user = userEvent.setup();
    const { trip, row } = await at('typed');
    page(trip, row);
    expect(await screen.findByRole('heading', { name: 'Fenwick Hole', level: 2 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Knowledge' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rules' })).toBeNull();
    expect(screen.queryByText(/From your adventure/)).toBeNull();
    // The setting's check as a plain line (frame 2b).
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toContain('Wandering encounters, 1 in 6');
    // Notes stays, folded, with nothing written: it is where the GM writes them (frame 2b); it opens on the fields.
    const notes = screen.getByRole('button', { name: 'Notes' });
    await user.click(notes);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    await user.click(notes);
    await user.click(screen.getByRole('button', { name: 'Move on' }));
    const sheet = await screen.findByRole('dialog', { name: /where to\?/ });
    expect(within(sheet).getByText(/No ways on from here in your packs/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: /Somewhere else/ }));
    expect(await screen.findByRole('dialog', { name: 'Where now?' })).toBeTruthy();
  });

  it('no place yet: "Where are we?" and Set place', async () => {
    const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
    page(started.data!.id, null);
    expect(await screen.findByRole('heading', { name: 'Where are we?', level: 2 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set place' }).className).toContain('button-primary');
  });

  it('a spot’s own tables stand in a Tables card', async () => {
    const { trip, row } = await at('jetty');
    page(trip, row);
    const tables = await screen.findByRole('region', { name: 'Tables' });
    expect(await within(tables).findByText('What the tide left')).toBeTruthy();
  });

  it('a waiting encounter card stands in the page’s Waiting for you, and Move on is then plain', async () => {
    const { trip, row } = await at('jetty');
    page(trip, row, { waiting: 1 });
    const waiting = await screen.findByRole('region', { name: 'Waiting for you' });
    await waitFor(() => expect(within(waiting).getByRole('region', { name: 'Encounter waiting: Bog lurker' })).toBeTruthy());
    expect(within(waiting).queryByText('Nothing waits.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Move on' }).className).toContain('button-secondary');
  });

  it('on a phone: Move on in its own bar, the spots before Checks here, no empty Waiting for you', async () => {
    const { trip, row } = await at('harbour');
    const { container } = page(trip, row, { phone: true });
    await screen.findByRole('region', { name: 'Locations' });
    const bar = container.querySelector('.place-page__bar');
    expect(bar && within(bar as HTMLElement).getByRole('button', { name: 'Move on' })).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Where the party is' });
    const order = [...card.querySelectorAll('h3')].map((h) => h.textContent);
    expect(order.indexOf('Locations')).toBeLessThan(order.indexOf('Checks here'));
    expect(screen.queryByRole('region', { name: 'Waiting for you' })).toBeNull();
  });

  // Purpose (#958 review; the plan's fix 5): only a phone leaves the empty panel out, so in one column on a wider
  // screen (the day view) "Waiting for you" still says "Nothing waits.".
  it('in one column (the day view), an empty Waiting for you says Nothing waits.', async () => {
    const { trip, row } = await at('harbour');
    render(
      <ToastHost>
        <SceneWaitingProvider>
          <GmPlacePage
            db={world.db}
            user={gm()}
            campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }}
            expeditionId={trip}
            group={1}
            groupLabel={null}
            row={row}
            checks={[SETTING_CHECK]}
            recent={[]}
            oneColumn
            onChanged={vi.fn()}
          />
        </SceneWaitingProvider>
      </ToastHost>,
    );
    await screen.findByRole('region', { name: 'Locations' });
    expect(within(await screen.findByRole('region', { name: 'Waiting for you' })).getByText('Nothing waits.')).toBeTruthy();
  });
});

describe('the book’s text for the GM (gt-1; page 15, home B)', () => {
  // Purpose: a place whose book gives the GM text of its own shows it as one folded row under its description, "From
  // the book, for the GM" with the book's first line and no crossed eye (F17, Q6); a tap opens it in place with its
  // list and boxed aside, and folds it again.
  it('folded to the first line under the description; a tap opens it in place with its list and box', async () => {
    const user = userEvent.setup();
    const { trip, row } = await at('jetty');
    page(trip, row);
    const fold = await screen.findByRole('button', { name: /From the book, for the GM/ });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(within(fold).getByText('The ferrymen moor here and nowhere else, and they notice who does not…')).toBeTruthy();
    // F17 (Q6): the row carries no eye and no "never sent" name; the heading's own words say whose it is.
    expect(within(fold).queryByRole('img')).toBeNull();
    expect(within(fold).queryByLabelText(/never sent/)).toBeNull();
    expect(fold.querySelector('.book-text__chevron')).toBeTruthy();
    // Under the head (no line under the name since B3), before Knowledge and Rules.
    const name = screen.getByRole('heading', { name: '1. The jetty', level: 2 });
    const knowledge = screen.getByRole('button', { name: 'Knowledge' });
    expect(name.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fold.compareDocumentPosition(knowledge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('The fourth mooring ring is new iron.')).toBeNull();
    await user.click(fold);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    const text = screen.getByRole('region', { name: 'From the book, for the GM' });
    expect(within(text).getByText(FERRYMEN)).toBeTruthy();
    expect(within(text).getByRole('list')).toBeTruthy();
    expect(within(text).getByText('The fourth mooring ring is new iron.').tagName).toBe('LI');
    expect(within(text).getByText('If the party asks the ferrymen about the ring')).toBeTruthy();
    // Opened, the first line no longer shows in the row itself.
    expect(within(fold).queryByText(/The ferrymen moor here/)).toBeNull();
    await user.click(fold);
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', { name: 'From the book, for the GM' })).toBeNull();
  });

  // Purpose: a place whose book gives no such text has no row at all (a part with nothing behind it is absent).
  it('a place without it has no row', async () => {
    const { trip, row } = await at('harbour');
    page(trip, row);
    await within(await screen.findByRole('region', { name: 'Tables' })).findByText('What the tide left');
    expect(screen.queryByRole('button', { name: /From the book, for the GM/ })).toBeNull();
  });
});

describe('a piece’s label (cs-41; kw-1 (a), 2026-11-15)', () => {
  // Purpose: every label is one shared rule, `.book-label` in the book's faces stylesheet: the book label's colour and
  // regular weight from the shared tokens (so it switches in dark mode with them); creation keeps no copy of its own.
  it('is one rule in bookFaces.css, the label colour and weight tokens, and no copy elsewhere', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const flat = (path: string) => fs.readFileSync(path, 'utf8').replace(/\s+/g, ' ');
    const rule = /(?:^|[}/])\s*\.book-label \{([^}]*)\}/.exec(flat('src/ui/bookFaces.css'))?.[1] ?? '';
    expect(rule).toContain('color: var(--book-label)');
    expect(rule).toContain('font-weight: var(--weight-book-label)');
    expect(flat('src/ui/creation.css')).not.toMatch(/(?:^|[}/])\s*\.book-label \{/);
    expect(flat('src/app/GmPlacePage.css')).not.toContain('.place-page__lead');
  });
});

describe('one accent (the #785 review)', () => {
  it('while the strip is paused, Move on is plain (Resume session keeps the accent)', async () => {
    const { trip, row } = await at('jetty');
    page(trip, row, { paused: true });
    await screen.findByRole('heading', { name: '1. The jetty', level: 2 });
    expect(screen.getByRole('button', { name: 'Move on' }).className).toContain('button-secondary');
  });

  // Purpose: the redrawn card (B3) keeps one accent: Move on, and nothing else on the card.
  it('the card’s one accent is Move on', async () => {
    const { trip, row } = await at('jetty');
    page(trip, row);
    await screen.findByRole('button', { name: 'Notes' });
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Move on' }).className).toContain('button-primary');
  });

  // Purpose (st-2, page 16): the accent is Start or Resume session while none runs; else the first thing waiting; else
  // Move on; else Start expedition between expeditions; else none (Next turn is never it).
  it('who holds it: the session button while none runs; else what waits; else Move on; else Start expedition; else none', () => {
    expect(accentOwner({ running: false, page: true, waiting: true })).toBe('session');
    expect(accentOwner({ running: false, page: false, waiting: false, between: true })).toBe('session');
    expect(accentOwner({ running: true, page: false, waiting: true })).toBe('waiting');
    expect(accentOwner({ running: true, page: true, waiting: true })).toBe('waiting');
    expect(accentOwner({ running: true, page: true, waiting: false })).toBe('move');
    expect(accentOwner({ running: true, page: false, waiting: false, between: true })).toBe('expedition');
    expect(accentOwner({ running: true, page: false, waiting: false })).toBe('none');
  });
});

describe('the strip’s cards in the page’s slot', () => {
  // Purpose (the #785 review): the cards move between the strip and the page's slot without being drawn again, so an
  // open choice (Which watch?) survives the page coming and going.
  it('keep their state when the page’s slot comes and goes', async () => {
    const user = userEvent.setup();
    function Card() {
      const [picked, setPicked] = useState(false);
      return (
        <button type="button" onClick={() => setPicked(true)}>
          {picked ? 'Picked' : 'Pick a watch'}
        </button>
      );
    }
    // S8a: the card is a source's item, and the page is the panel (one hosting it, as WaitingForYou does).
    function Page() {
      const hosting = useWaitingPanel()?.hosting;
      return <section aria-label="The page">{hosting && <WaitingPanel />}</section>;
    }
    const item: WaitingSourceItem = { id: 'encounter:1', kind: 'encounter', title: 'An encounter waits', actions: [], card: <Card /> };
    const view = (withPage: boolean) => (
      <SceneWaitingProvider>
        <section aria-label="The strip">
          <WaitingSource sourceKey="strip" items={[item]} />
        </section>
        {withPage && <Page />}
      </SceneWaitingProvider>
    );
    const { rerender } = render(view(false));
    await user.click(within(screen.getByRole('region', { name: 'The strip' })).getByRole('button', { name: 'Pick a watch' }));
    // The button keeps the focus the tap gave it as its node moves into the page.
    const picked = screen.getByRole('button', { name: 'Picked' });
    picked.focus();
    rerender(view(true));
    expect(within(screen.getByRole('region', { name: 'The page' })).getByRole('button', { name: 'Picked' })).toBeTruthy();
    expect(document.activeElement).toBe(picked);
    rerender(view(false));
    expect(within(screen.getByRole('region', { name: 'The strip' })).getByRole('button', { name: 'Picked' })).toBeTruthy();
  });
});

describe('Waiting for you, left out while empty', () => {
  // Purpose (the #785 re-review): where the page leaves the card out while empty, a slow read of its own list never
  // hides a waiting encounter card; with nothing in the strip it stays out while it reads (no "Opening…" that goes).
  it('shows while its own list loads when strip cards wait, and stays out when none do', () => {
    const campaignRow = { id: campaign, name: 'The Ash Barrows', role: 'gm' as const, line: null };
    // S8a: the strip's card is a source's item in the same provider (it was the card's `lead` before).
    const card = (count: number) =>
      render(
        <SceneWaitingProvider>
          <WaitingSource sourceKey="strip" items={lurkers(count)} />
          <WaitingForYou db={world.db} user={gm()} campaign={campaignRow} onChanged={() => undefined} quiet />
        </SceneWaitingProvider>,
      ).container.querySelector('section.waiting-card')!;
    // Read at once, before its own list has loaded.
    expect(card(1).hasAttribute('hidden')).toBe(false);
    cleanup();
    expect(card(0).hasAttribute('hidden')).toBe(true);
  });
});

describe('die glyphs (ds-3, mc-39b)', () => {
  it('the own check’s line and each table’s die carry the die glyph', async () => {
    const { trip, row } = await at('jetty');
    page(trip, row);
    const toggle = await screen.findByRole('switch', { name: 'Encounter check: on every move, 1 in 6.' });
    expect(toggle.querySelector('.die-glyph--d6')).toBeTruthy();
    const tables = await screen.findByRole('region', { name: 'Tables' });
    await within(tables).findByText('What the tide left');
    expect(tables.querySelector('.table-item__tag .die-glyph--d6')).toBeTruthy();
  });
});

describe('the book’s faces (po-3)', () => {
  it('the page and its pop-ups take the faces alone; creation’s scope is not set', async () => {
    function Probe() {
      return <p>{useContext(BookTypeScope) ? 'creation scope' : 'not creation'}</p>;
    }
    render(
      <BookFaces>
        <Probe />
        <Dialog label="A pop-up" onClose={() => undefined}>
          <p>Inside</p>
        </Dialog>
      </BookFaces>,
    );
    expect(screen.getByText('not creation')).toBeTruthy();
    const dialog = await screen.findByRole('dialog', { name: 'A pop-up' });
    expect(dialog.closest('.book-faces')).toBeTruthy();
    expect(dialog.closest('.book-type')).toBeNull();
  });
});

describe('proposals that wait (page 12)', () => {
  it('one names who and where, the way, and An obstacle; several are numbered; one Answer… button', async () => {
    const user = userEvent.setup();
    const answer = vi.fn();
    const { rerender } = render(<ProposalsWaiting accent proposals={[{ id: 'a', who: 'Wren', to: 'the sea cave', way: 'Rowing, 2 turns', obstacle: true }]} onAnswer={answer} />);
    expect(screen.getByRole('heading', { name: 'Wren proposes: to the sea cave' })).toBeTruthy();
    expect(screen.getByText('An obstacle.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Answer…' }));
    expect(answer).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Answer…' }).className).toContain('button-primary');
    rerender(
      <ProposalsWaiting
        proposals={[
          { id: 'a', who: 'Wren', to: 'the sea cave', way: 'Rowing, 2 turns', obstacle: true },
          { id: 'b', who: 'Ash', to: 'the wreck', way: 'Rowing, 1 turn', obstacle: false },
          { id: 'c', who: 'Bram', to: 'the breakwater', way: 'Swimming, 999 turns', obstacle: false },
        ]}
        onAnswer={answer}
      />,
    );
    expect(screen.getByRole('heading', { name: '3 ways proposed' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Answer…' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Answer…' }).className).toContain('button-secondary');
  });

  it('none waiting: nothing at all', () => {
    const { container } = render(<ProposalsWaiting proposals={[]} onAnswer={() => undefined} />);
    expect(container.textContent).toBe('');
  });
});

// The map on the page (the whole Scene's S13; mc-58 with the lead's ruling (c): opened whole, as the party has no
// position on a map; page 11's frames 1a, 1b, 2c, 4a, 4b, 4d; the eye, 5m-3). In plain words:
//   * where the pack names a map the campaign hasn't added, a place that holds spots asks for it in its card, under
//     "Players see": the map's title, the file's name and "+ Map";
//   * at a spot, the place's map stands in the right column under "Waiting for you", with the zoom buttons and the eye,
//     and no locate button;
//   * a tap on the map opens it whole, the place's name over "The map", the eye beside the ✕;
//   * the eye shares the map at once, with Undo in the toast; Undo makes it the GM's alone again;
//   * on a phone, "The map" is a button in the card that opens the pop-up; where the map is wanted, its row stands there;
//   * a place made by hand with no map draws nothing of a map.
describe('the map on the GM’s place page (S13, 5m-3)', () => {
  const CHART = { id: 'harbour-chart', file: 'harbour-chart.png', title: 'The Drowned Harbour, the harbour chart', alt: 'A silted harbour and its five spots', locationIds: ['drowned-harbour'] };
  const mapEntry = () => world.tables.library_entries.push({ id: 'entry-chart', pack_id: 'pack-reed', kind: 'map', pack_entry_id: CHART.id, name: CHART.title, data: CHART });
  /** The campaign's copy, added and tied to the place the party is at (its file in the bucket). */
  async function added(row: GroupPlace) {
    world.tables.assets.push({ id: 'asset-chart', campaign_id: campaign, kind: 'map', name: CHART.title, visibility: 'gm' });
    await world.db.storage.from('campaign-files').upload(`${campaign}/asset-chart`, new Blob(['a chart'], { type: 'image/png' }));
    const tied = world.tables.places.find((p) => p.id === row.place!.id)!;
    tied.map_asset_id = 'asset-chart';
  }
  const mapCard = () => screen.findByRole('region', { name: 'The map' });
  async function pictureCame(card: HTMLElement) {
    const img = await waitFor(() => {
      const found = card.querySelector('img.map-picture__img');
      if (!found) throw new Error('no picture yet');
      return found;
    });
    fireEvent.load(img);
  }

  it('a place that holds spots asks for its map in its card, under the head: title, file and + Map', async () => {
    mapEntry();
    const { trip, row } = await at('harbour');
    page(trip, row);
    const title = await screen.findByText(CHART.title);
    const card = title.closest('.place-page__card') as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).getByText('harbour-chart.png')).toBeTruthy();
    expect(within(card).getByRole('button', { name: '+ Map' })).toBeTruthy();
    // Under the head (where "Players see" stood before B3), before Knowledge and Rules (frame 2c).
    const order = [...card.querySelectorAll('.place-page__title-row, .map-wanted, .place-page__pair')].map((n) => n.className.split(' ')[0]);
    expect(order).toEqual(['place-page__title-row', 'map-wanted', 'place-page__pair']);
  });

  it('at a spot, the place’s map stands in the right column under Waiting for you, with the zoom and the eye, no locate', async () => {
    mapEntry();
    const { trip, row } = await at('jetty');
    await added(row);
    page(trip, row);
    const card = await mapCard();
    const side = card.closest('.place-page__side') as HTMLElement;
    expect(side).toBeTruthy();
    const parts = [...side.children].map((n) => n.getAttribute('aria-label') ?? n.querySelector('[aria-label]')?.getAttribute('aria-label'));
    expect(parts.indexOf('Waiting for you')).toBeLessThan(parts.indexOf('The map'));
    expect(parts.indexOf('The map')).toBeLessThan(parts.indexOf('Marching order'));
    await pictureCame(card);
    expect(within(card).getByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(within(card).getByRole('switch', { name: 'The map shown to the players' }).getAttribute('aria-checked')).toBe('false');
    expect(within(card).queryByRole('button', { name: /locate|where the party is/i })).toBeNull();
  });

  it('a tap on the map opens it whole: the place’s name over The map, the eye beside the ✕', async () => {
    const user = userEvent.setup();
    mapEntry();
    const { trip, row } = await at('jetty');
    await added(row);
    page(trip, row);
    const card = await mapCard();
    await pictureCame(card);
    await user.click(card.querySelector('.map-picture') as HTMLElement);
    const popup = await screen.findByRole('dialog', { name: /The map/ });
    expect(within(popup).getByText('The Drowned Harbour')).toBeTruthy();
    expect(within(popup).getByRole('switch', { name: 'The map shown to the players' })).toBeTruthy();
    expect(within(popup).getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('the eye shares the map at once with Undo in the toast; Undo makes it the GM’s alone again', async () => {
    const user = userEvent.setup();
    mapEntry();
    const { trip, row } = await at('jetty');
    await added(row);
    page(trip, row);
    const card = await mapCard();
    await pictureCame(card);
    await user.click(within(card).getByRole('switch', { name: 'The map shown to the players' }));
    expect(await screen.findByText(`Shown to the players: ${CHART.title}`)).toBeTruthy();
    expect(world.tables.assets.find((a) => a.id === 'asset-chart')?.visibility).toBe('all');
    await waitFor(() => expect(within(card).getByRole('switch', { name: 'The map shown to the players' }).getAttribute('aria-checked')).toBe('true'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.assets.find((a) => a.id === 'asset-chart')?.visibility).toBe('gm'));
  });

  // Purpose (#851's review): while whether the players see the map can't be read, no eye is drawn (never a closed one
  // the copy may not have); a retry stands in its place.
  it("the eye isn't drawn when the copy's share can't be read: a retry instead", async () => {
    mapEntry();
    const { trip, row } = await at('jetty');
    await added(row);
    // The copy's row can't be read (its file still comes): the share is unknown.
    world.tables.assets.splice(world.tables.assets.findIndex((a) => a.id === 'asset-chart'), 1);
    page(trip, row);
    const card = await mapCard();
    await pictureCame(card);
    expect(await within(card).findByRole('button', { name: /couldn't be read\. Try again/ })).toBeTruthy();
    expect(within(card).queryByRole('switch', { name: 'The map shown to the players' })).toBeNull();
  });

  it('on a phone, The map is a button in the card that opens the pop-up', async () => {
    const user = userEvent.setup();
    mapEntry();
    const { trip, row } = await at('jetty');
    await added(row);
    page(trip, row, { phone: true });
    await user.click(await screen.findByRole('button', { name: 'The map' }));
    expect(await screen.findByRole('dialog', { name: /The map/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'The map' })).toBeNull();
  });

  it('on a phone, where the map is wanted, its row stands in the card', async () => {
    mapEntry();
    const { trip, row } = await at('harbour');
    page(trip, row, { phone: true });
    expect(await screen.findByRole('button', { name: '+ Map' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'The map' })).toBeNull();
  });

  it('a place made by hand with no map draws nothing of a map', async () => {
    mapEntry();
    const { trip, row } = await at('typed');
    page(trip, row);
    expect(await screen.findByRole('heading', { name: 'Fenwick Hole', level: 2 })).toBeTruthy();
    // Let the map's read settle.
    await waitFor(() => expect(screen.queryByText(CHART.title)).toBeNull());
    expect(screen.queryByRole('region', { name: 'The map' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Map' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'The map' })).toBeNull();
  });
});

describe('the page’s words', () => {
  // Purpose (p2p-3, 2026-11-18): a keyed Location reads "1. The jetty", the number with the app's full stop, and a name
  // that already starts with its key, with or without the stop, is not doubled; a name with no key is left as it is.
  it('numbers a name as "1. The jetty", once', () => {
    expect(numberedName('1', 'The jetty')).toBe('1. The jetty');
    expect(numberedName('1', '1 The jetty')).toBe('1. The jetty');
    expect(numberedName('1', '1. The jetty')).toBe('1. The jetty');
    expect(numberedName('12', '12 The sluice')).toBe('12. The sluice');
    expect(numberedName('1', '10 The mud')).toBe('1. 10 The mud');
    expect(numberedName('1', '1')).toBe('1');
    expect(numberedName(null, 'Fenwick Hole')).toBe('Fenwick Hole');
  });
  it('orders spots by the key, numbers as numbers, those without one last', () => {
    const keyed = (key: string | null, name: string) => ({ key, name });
    expect(byKey([keyed('10', 'j'), keyed(null, 'x'), keyed('2', 'b'), keyed('1', 'a')]).map((p) => p.name)).toEqual(['a', 'b', 'j', 'x']);
  });
  it('says the place’s own check on one line', () => {
    expect(checkLineWords('Encounter check', { every: null, chance: { die: 'd6', on: [1] } }, true)).toBe('Encounter check: on every move, 1 in 6.');
    expect(checkLineWords('Tide watch', { every: { value: 2, unit: 'turns' }, chance: null }, false)).toBe('Tide watch: every 2 turns.');
  });
});

// The trail and reading ahead (plan scene-point-to-point B2; p2p-8, p2p-9; page 23, LA1 to LA4, approved 2026-11-18;
// the driver's ruling "A", 2026-11-19: no working eyes while reading ahead, a pop-up instead, and no migration). An
// invented cove typed as the rulings name the kinds: a Region, an Area in it, and Locations in the Area.
describe('the trail and reading ahead (B2)', () => {
  const LONG = '9. The Harbourmaster’s Landing Stage below the Old Lantern Tower, Seaward Side';
  const LONG_LINE = 'Worn steps down into the water, a bell rope hanging, and a smell of tar that the wind does not shift.';
  const ISLE = { id: 'saltwick', name: 'Saltwick Island', type: 'region' };
  const COVE = {
    id: 'drowned-cove',
    name: 'The Drowned Cove',
    type: 'site',
    parentId: 'saltwick',
    identity: 'A silted cove: black water, a dry bar.',
    playerView: { text: 'Black water and a dry bar.' },
    encounterCheck: { name: 'Encounter check', when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, note: 'Roll d6 for an encounter each time the party rows to a new Location.' },
    // The Area's Knowledge, which its eye shares while reading ahead (ppf-2).
    gm: { sections: [{ heading: 'What the cove knows', text: 'The bar dries at low water.' }] },
  };
  const ANCHORAGE = {
    id: 'anchorage',
    name: 'The Anchorage',
    type: 'area',
    parentId: 'drowned-cove',
    identity: 'Slack water in the lee of the bar.',
    playerView: { text: 'Slack water in the lee of the bar; the boat swings on a mooring buoy.', aspects: [{ lead: 'Mooring buoy', text: 'Tarred cork, with a turn of new rope.' }] },
    tableIds: ['tide-left'],
  };
  const BREAKWATER_SAYS = 'A drowned wall of fitted stone; a boat can thread the gap at its middle.';
  const BREAKWATER = {
    id: 'breakwater',
    key: '3',
    name: 'The Breakwater',
    type: 'area',
    parentId: 'drowned-cove',
    identity: 'A drowned wall of fitted stone.',
    playerView: { text: BREAKWATER_SAYS, aspects: [{ lead: 'Gap', text: 'Two oars wide; the tide runs hard through it.' }] },
    gm: { notes: 'The fourth ring is new iron.', sections: [{ heading: 'The new ring', text: 'Set this month by someone in a hurry.' }] },
    source: 'p. 41',
    rules: [{ id: 'cold-water', name: 'Cold water', text: 'A character in the water is cold at once.' }],
  };
  const JETTY_TOO = { id: 'jetty-too', key: '1', name: 'The Jetty', type: 'area', parentId: 'drowned-cove', identity: 'Black piles and a ladder.' };
  const LANDING = { id: 'landing', key: '9', name: LONG, type: 'area', parentId: 'drowned-cove', identity: LONG_LINE };

  beforeEach(() => {
    for (const data of [ISLE, COVE, ANCHORAGE, BREAKWATER, JETTY_TOO, LANDING]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: data.id, name: data.name, data });
    // A call given by a person at the breakwater (so its Calls line shows there, B19), and a rumours table.
    world.tables.library_entries.push({
      id: 'entry-bell-rope',
      pack_id: 'pack-reed',
      kind: 'adventureHook',
      pack_entry_id: 'bell-rope',
      name: 'The bell rope',
      data: { text: 'Someone rings the bell at low water.', pays: '', giverNpcId: 'oswy', giver: { name: 'Oswy the ferryman', role: 'ferryman', place: '3 The Breakwater' }, order: 0 },
    });
    world.tables.library_entries.push({ id: 'entry-cove-rumours', pack_id: 'pack-reed', kind: 'table', pack_entry_id: 'cove-rumours', name: 'What they say on the bar', data: { uses: ['world.rumours'], die: 'd4', rows: [{ min: 1, max: 4, result: 'The bell rings by itself.', truth: 'false' }] } });
  });

  /** The party moved to one of the cove's places in the expedition `trip` (one is started when none is given). */
  async function partyAt(data: { id: string; name: string }, trip?: string) {
    const id = trip ?? ((await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } }).data.id;
    const moved = await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: data.id, name: data.name, data } });
    if (!moved.ok) throw new Error(moved.message);
    return { trip: id, row: (await loadGroupPlaces(world.db, campaign, id))!.get(1)! };
  }

  /** Opens the cove's panel from the trail, then reads `name` ahead from it. */
  async function readAheadAt(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(await within(await screen.findByRole('navigation', { name: 'Where it sits' })).findByRole('button', { name: 'The Drowned Cove' }));
    const panel = await screen.findByRole('dialog', { name: 'The Drowned Cove: Locations' });
    await user.click(within(panel).getByRole('button', { name }));
    return panel;
  }

  // Purpose (p2p-8; LA2): a tap on the Area in the trail opens the Locations panel, the Area's name over its title; the
  // Area's own row comes first, then the party's own row, marked "The party is here." and not a tap, then every other
  // Location in key order with its one line. The Region stays plain words. Nothing moves the party.
  it('a tap on the Area opens its Locations: the Area, the party’s row with no tap, then each Location by key; nobody moves', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    const visits = world.tables.group_places.length;
    const { onChanged } = page(trip, row);
    const trail = await screen.findByRole('navigation', { name: 'Where it sits' });
    await within(trail).findByRole('button', { name: 'The Drowned Cove' });
    // The Region is plain words (LA2b, its own panel, is a proposal).
    expect(within(trail).getByText('Saltwick Island').tagName).toBe('SPAN');
    expect(within(trail).queryByRole('button', { name: 'Saltwick Island' })).toBeNull();
    await user.click(within(trail).getByRole('button', { name: 'The Drowned Cove' }));
    const panel = await screen.findByRole('dialog', { name: 'The Drowned Cove: Locations' });
    expect(within(panel).getByText('The Drowned Cove', { selector: '.dialog__over, .dialog__over *' })).toBeTruthy();
    await within(panel).findByText(LONG_LINE);
    const titles = [...panel.querySelectorAll('.list-row__title')].map((t) => t.textContent);
    expect(titles).toEqual(['The Drowned Cove', 'The Anchorage', '1. The Jetty', '3. The Breakwater', LONG]);
    expect(within(panel).getByText('A silted cove: black water, a dry bar.')).toBeTruthy();
    // The party's row: marked, washed, its words, and no tap.
    const here = panel.querySelector('.place-page__panel-here') as HTMLElement;
    expect(within(here).getByText('The party is here.')).toBeTruthy();
    expect(within(here).queryAllByRole('button')).toHaveLength(0);
    expect(within(panel).getAllByRole('button', { name: /^(The Drowned Cove|1\. The Jetty|3\. The Breakwater|9\. )/ })).toHaveLength(4);
    // Nothing moved: no new visit, no change reported.
    expect(world.tables.group_places.length).toBe(visits);
    expect(onChanged).not.toHaveBeenCalled();
    await user.click(within(panel).getByRole('button', { name: /Close/ }));
    expect(screen.queryByRole('dialog', { name: 'The Drowned Cove: Locations' })).toBeNull();
  });

  // Purpose (p2p-9; LA3): a Location opened from the panel is read ahead: the card is its own (its name, its pieces in
  // the book's format, every eye closed, "0 of 2 shown"), headed by the line "Reading ahead. The party is at The
  // Anchorage." with "Back to the party"; the head has no Move on and no rule's button; the right column (its Tables)
  // stays the party's. Nothing is written: no place is made for it, no visit, no show.
  it('a Location from the panel is read ahead: its own card, the line with Back to the party, the right column the party’s', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    const before = { places: world.tables.places.length, visits: world.tables.group_places.length, shows: world.tables.piece_shows.length };
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    expect(await screen.findByRole('heading', { name: '3. The Breakwater', level: 2 })).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Reading ahead: 3. The Breakwater' });
    expect(within(card).getByRole('status').textContent).toBe('Reading ahead. The party is at The Anchorage.');
    expect(within(card).getByRole('button', { name: 'Back to the party' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move on' })).toBeNull();
    const description = wordsOf(await within(card).findByRole('button', { name: `Edit piece: ${BREAKWATER_SAYS}` }));
    expect([...description.querySelectorAll('.place-page__named')].map((n) => n.textContent)).toEqual(['gap']);
    expect(within(card).getAllByRole('button', { name: 'Show players' })).toHaveLength(2);
    expect(within(card).queryByRole('button', { name: 'Hide from players' })).toBeNull();
    expect(within(card).getByText('0 of 2 shown')).toBeTruthy();
    // The trail is the read place's, and its Area still opens the panel.
    const trail = within(card).getByRole('navigation', { name: 'Where it sits' });
    expect(within(trail).getByText('3. The Breakwater')).toBeTruthy();
    // The right column stays the party's: the Anchorage's table, which the Breakwater doesn't name.
    expect(await within(await screen.findByRole('region', { name: 'Tables' })).findByText('What the tide left')).toBeTruthy();
    // Knowledge is the read place's.
    await user.click(within(card).getByRole('button', { name: 'Knowledge' }));
    expect(within(await screen.findByRole('dialog', { name: /Knowledge/ })).getByText('The Breakwater')).toBeTruthy();
    expect({ places: world.tables.places.length, visits: world.tables.group_places.length, shows: world.tables.piece_shows.length }).toEqual(before);
  });

  // Purpose (the driver's ruling "A", 2026-11-19): while reading ahead the eyes are drawn as LA3 draws them, and a tap
  // on one opens a pop-up that says the party isn't there (never a disabled button); so do a tap on a piece and on
  // "+ Piece". Nothing is written.
  it('reading ahead, a tap on an eye, a piece or + Piece explains in a pop-up and writes nothing', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    const before = { places: world.tables.places.length, shows: world.tables.piece_shows.length, pieces: world.tables.place_pieces.length };
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    const card = await screen.findByRole('region', { name: 'Reading ahead: 3. The Breakwater' });
    const description = await within(card).findByRole('button', { name: `Edit piece: ${BREAKWATER_SAYS}` });
    for (const tap of [
      within(description.closest('li') as HTMLElement).getByRole('button', { name: 'Show players' }),
      description,
      within(card.querySelector('.place-page__foot') as HTMLElement).getByRole('button', { name: '+ Piece' }),
    ]) {
      await user.click(tap);
      const why = await screen.findByRole('dialog', { name: "The party isn't here" });
      expect(within(why).getByText("You're reading ahead. Show and change what is here once the party arrives.")).toBeTruthy();
      await user.click(within(why).getByRole('button', { name: /Close/ }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: "The party isn't here" })).toBeNull());
    }
    // No form opened, nothing shown, nothing made.
    expect(within(card).queryByRole('group', { name: /Edit piece|\+ Piece/ })).toBeNull();
    expect({ places: world.tables.places.length, shows: world.tables.piece_shows.length, pieces: world.tables.place_pieces.length }).toEqual(before);
  });

  // Purpose (ppf-2, 2026-11-20): reading ahead the Area the party is in, the eye on its Knowledge works, the one thing
  // written there: a tap shares the Area's section with the group at once; nothing else is written.
  it("reading ahead the party's Area, Knowledge's eye shares its section with the group", async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    const before = { places: world.tables.places.length, shows: world.tables.piece_shows.length };
    page(trip, row);
    await readAheadAt(user, /^The Drowned Cove/);
    const card = await screen.findByRole('region', { name: 'Reading ahead: The Drowned Cove' });
    await user.click(within(card).getByRole('button', { name: 'Knowledge' }));
    const sheet = await screen.findByRole('dialog', { name: /Knowledge/ });
    expect(await within(sheet).findByText('0 of 1 section shared.')).toBeTruthy();
    await user.click(within(sheet).getByRole('switch', { name: 'Share with the players: What the cove knows' }));
    expect(await within(sheet).findByText('1 of 1 section shared.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: "The party isn't here" })).toBeNull();
    expect(world.tables.knowledge_shares.filter((k) => k.shared === true && !k.undone).map((k) => [k.group_number, k.entry_id])).toEqual([[1, 'drowned-cove']]);
    expect({ places: world.tables.places.length, shows: world.tables.piece_shows.length }).toEqual(before);
  });

  // Purpose (ppf-2: a Location's Knowledge keeps its own sections; B2's pop-up stays for the rest): reading ahead
  // another Location, its Knowledge's eye explains in the pop-up and shares nothing.
  it("reading ahead another Location, Knowledge's eye explains and shares nothing", async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    const card = await screen.findByRole('region', { name: 'Reading ahead: 3. The Breakwater' });
    await user.click(within(card).getByRole('button', { name: 'Knowledge' }));
    const sheet = await screen.findByRole('dialog', { name: /Knowledge/ });
    expect(within(sheet).queryByText('What the cove knows')).toBeNull();
    await user.click(await within(sheet).findByRole('switch', { name: 'Share with the players: The new ring' }));
    expect(await screen.findByRole('dialog', { name: "The party isn't here" })).toBeTruthy();
    expect(world.tables.knowledge_shares).toEqual([]);
  });

  // Purpose (the local review of #1044, finding 1): while reading ahead the "Checks here" switch writes nothing either:
  // a tap opens the same pop-up, and the check stays as it was.
  it('reading ahead, the check’s switch explains in the pop-up and changes nothing', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    const card = await screen.findByRole('region', { name: 'Reading ahead: 3. The Breakwater' });
    const toggle = await within(card).findByRole('switch', { name: 'Encounter check: on every move, 1 in 6.' });
    const events = world.tables.events.length;
    await user.click(toggle);
    expect(await screen.findByRole('dialog', { name: "The party isn't here" })).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(world.tables.events.length).toBe(events);
  });

  // Purpose (the local review of #1044, finding 2): while reading ahead the notes read as they stand, with no field to
  // type in; "Edit notes" opens the pop-up instead of the fields, so no words are typed that can't be saved.
  it('reading ahead, Notes read only and Edit notes explains', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    const card = await screen.findByRole('region', { name: 'Reading ahead: 3. The Breakwater' });
    await user.click(await within(card).findByRole('button', { name: 'Notes' }));
    expect(within(card).getByText(/The fourth ring is new iron\./)).toBeTruthy();
    expect(within(card).queryAllByRole('textbox')).toHaveLength(0);
    await user.click(within(card).getByRole('button', { name: 'Edit notes' }));
    expect(await screen.findByRole('dialog', { name: "The party isn't here" })).toBeTruthy();
    expect(within(card).queryAllByRole('textbox')).toHaveLength(0);
  });

  // Purpose (the local review of #1044, finding 1): while reading ahead the Rules sheet still reads, but a tap on a
  // rule's eye or on the stand-in check's switch opens the pop-up and writes nothing.
  it('reading ahead, the Rules sheet reads, and its eye and switch explain in the pop-up and write nothing', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    const card = await screen.findByRole('region', { name: 'Reading ahead: 3. The Breakwater' });
    await user.click(within(card).getByRole('button', { name: 'Rules' }));
    const sheet = await screen.findByRole('dialog', { name: /Rules/ });
    expect(await within(sheet).findByText('Cold water')).toBeTruthy();
    const events = world.tables.events.length;
    await user.click(within(sheet).getByRole('button', { name: /players: Cold water/ }));
    const why = await screen.findByRole('dialog', { name: "The party isn't here" });
    await user.click(within(why).getByRole('button', { name: /Close/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: "The party isn't here" })).toBeNull());
    await user.click(within(sheet).getByRole('switch'));
    expect(await screen.findByRole('dialog', { name: "The party isn't here" })).toBeTruthy();
    expect(world.tables.events.length).toBe(events);
  });

  // Purpose (the local review of #1044, finding 1): while reading ahead the Calls sheet still reads, but sending a
  // call opens the pop-up and sends nothing.
  it('reading ahead, sending a call from the Calls sheet explains in the pop-up and sends nothing', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    await user.click(await screen.findByRole('button', { name: /^Calls to adventure/ }));
    await user.click(await screen.findByRole('button', { name: /^The bell rope/ }));
    const hook = await screen.findByRole('dialog', { name: 'The bell rope' });
    expect(within(hook).getByText('Someone rings the bell at low water.')).toBeTruthy();
    await user.click(within(hook).getByRole('button', { name: 'Party' }));
    expect(await screen.findByRole('dialog', { name: "The party isn't here" })).toBeTruthy();
    expect(world.tables.hook_sends).toHaveLength(0);
  });

  // Purpose (the local review of #1044, finding 1): while reading ahead giving a rumour opens the pop-up and gives
  // nothing.
  it('reading ahead, giving a rumour explains in the pop-up and gives nothing', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    await user.click(await screen.findByRole('button', { name: /^Calls to adventure/ }));
    await user.click(await screen.findByRole('button', { name: /^What they say on the bar/ }));
    const table = await screen.findByRole('dialog', { name: 'Rumours' });
    await user.click(within(table).getByRole('button', { name: /The bell rings by itself/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Who hears it?' })).getByRole('button', { name: 'Party' }));
    expect(await screen.findByRole('dialog', { name: "The party isn't here" })).toBeTruthy();
    expect(world.tables.hook_sends).toHaveLength(0);
  });

  // Purpose (p2p-9): "Back to the party" brings the party's own card back, with Move on.
  it('Back to the party returns to the party’s own card', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    await user.click(await screen.findByRole('button', { name: 'Back to the party' }));
    expect(await screen.findByRole('heading', { name: 'The Anchorage', level: 2 })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Where the party is' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Move on' })).toBeTruthy();
  });

  // Purpose (p2p-8; LA2): the Area's own row opens the Area itself, to read.
  it('the Area’s own row reads the Area', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    page(trip, row);
    await readAheadAt(user, /^The Drowned Cove/);
    expect(await screen.findByRole('heading', { name: 'The Drowned Cove', level: 2 })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Edit piece: Black water and a dry bar.' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Reading ahead. The party is at The Anchorage.');
  });

  // Purpose (LA4): on a phone the line keeps its words alone and "Back to the party" sits in the fixed bar at the foot,
  // in Move on's place; the bar has no Move on while reading ahead.
  it('on a phone, Back to the party sits in the fixed bar', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    const { container } = page(trip, row, { phone: true });
    await readAheadAt(user, /^1\. The Jetty/);
    expect(await screen.findByRole('heading', { name: '1. The Jetty', level: 2 })).toBeTruthy();
    const bar = container.querySelector('.place-page__bar') as HTMLElement;
    expect(within(bar).getByRole('button', { name: 'Back to the party' })).toBeTruthy();
    expect(within(bar).queryByRole('button', { name: 'Move on' })).toBeNull();
    const line = container.querySelector('.place-page__ahead') as HTMLElement;
    expect(within(line).queryAllByRole('button')).toHaveLength(0);
    expect(within(line).getByText(/The party is at The Anchorage\./)).toBeTruthy();
  });

  // Purpose (the brief: "the page from the place row if it exists"): a Location the party was at before is read from
  // the campaign's place for it, with a piece the GM added there; read ahead, every eye is closed, even one shown on
  // that earlier visit.
  it('a Location visited before is read from the campaign’s place, its eyes closed', async () => {
    const user = userEvent.setup();
    const first = await partyAt(BREAKWATER);
    await runCommand(registry, world.db, gm(), addPiece, { campaignId: campaign, placeId: first.row.placeId!, kind: 'clue', text: 'A gull’s feather tied to the fourth ring.' });
    const there = (await loadGroupPlaces(world.db, campaign, first.trip))!.get(1)!;
    const shown = await runCommand(registry, world.db, gm(), showPiece, { campaignId: campaign, row: there, piece: there.pieces[0]! });
    if (!shown.ok) throw new Error(shown.message);
    const { trip, row } = await partyAt(ANCHORAGE, first.trip);
    page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    const feather = await screen.findByRole('button', { name: 'Edit piece: A gull’s feather tied to the fourth ring.' });
    expect(within(feather.closest('li') as HTMLElement).getByRole('button', { name: 'Show players' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide from players' })).toBeNull();
    expect(screen.getByText('0 of 3 shown')).toBeTruthy();
  });

  // Purpose: reading ahead ends when the party moves (here, or on another device): the page is the party's again.
  it('the party moving ends reading ahead', async () => {
    const user = userEvent.setup();
    const { trip, row } = await partyAt(ANCHORAGE);
    const view = page(trip, row);
    await readAheadAt(user, /^3\. The Breakwater/);
    await screen.findByRole('heading', { name: '3. The Breakwater', level: 2 });
    const moved = await partyAt(JETTY_TOO, trip);
    view.rerender(
      <ToastHost>
        <SceneWaitingProvider>
          <GmPlacePage
            db={world.db}
            user={gm()}
            campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }}
            expeditionId={trip}
            group={1}
            groupLabel={null}
            row={moved.row}
            checks={[SETTING_CHECK]}
            recent={[]}
            onChanged={vi.fn()}
          />
        </SceneWaitingProvider>
      </ToastHost>,
    );
    expect(await screen.findByRole('heading', { name: '1. The Jetty', level: 2 })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

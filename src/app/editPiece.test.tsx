// @vitest-environment jsdom
// sf-16 (plan dec-scene-feedback; page 44, EP1 and TR1, approved 2026-11-26; ⚑ 7, "Behind the arrow"): Edit piece on
// the GM's place page, on the stand-in database. Invented places and words only. In plain words:
//   * a tap on any piece's words never opens the form (a Treasure piece's words open its find sheet instead);
//   * on a piece with nothing to send, the arrow opens Edit piece at once: the words first, then Kind, then "Remove
//     this piece", and "Save" alone in the foot, the one accent; a Treasure piece's sheet opens it from its edit row;
//   * "Kind" unfolds its seven kinds in place, the picked one ticked, and a pick folds them again;
//   * "Remove this piece" takes the piece off with an Undo toast; Save changes it with an Undo toast;
//   * the X with something changed closes and says "Changes dropped.", whose Undo opens the form again with the words as
//     typed; the X with nothing changed only closes.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { forgetPackPlaces, loadGroupPlaces, PIECE_KIND_WORDS, PIECE_KINDS, setPlace, type GroupPlace } from '../modules/expedition/placePlay.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { createAppRegistry } from './commandRegistry.ts';
import { GmPlacePage } from './GmPlacePage.tsx';
import { SceneWaitingProvider } from './sceneWaiting.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const registry = createAppRegistry();
let world: FakeWorld;
let gmId: string;
let campaign: string;
const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } }) as CurrentUser;

const SAYS = 'Nets hang to dry over a cold brazier.';
const SHED = {
  id: 'net-shed',
  name: 'The net shed',
  key: '3',
  type: 'site',
  playerView: { text: SAYS },
  treasure: [{ text: 'Bronze ring' }],
};

async function atShed(): Promise<{ trip: string; row: GroupPlace }> {
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gmId, campaign_id: null, name: 'The Reed Marches', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'cp-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, priority: 1 });
  world.tables.library_entries.push({ id: 'entry-net-shed', pack_id: 'pack-reed', kind: 'location', pack_entry_id: SHED.id, name: SHED.name, data: SHED });
  const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
  const trip = started.data!.id;
  const moved = await runCommand(registry, world.db, gm(), setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-reed', packEntryId: SHED.id, name: SHED.name, data: SHED } });
  if (!moved.ok) throw new Error(moved.message);
  return { trip, row: (await loadGroupPlaces(world.db, campaign, trip))!.get(1)! };
}

/** The page, read again after each change (as the Scene does), so an edit or a removal shows on the card. */
async function page() {
  const { trip, row } = await atShed();
  function Page() {
    const [now, setNow] = useState(row);
    const changed = () => void loadGroupPlaces(world.db, campaign, trip).then((rows) => setNow(rows!.get(1)!));
    return <GmPlacePage db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }} expeditionId={trip} group={1} groupLabel={null} row={now} checks={[]} recent={[]} onChanged={changed} />;
  }
  render(
    <ToastHost>
      <SceneWaitingProvider>
        <Page />
      </SceneWaitingProvider>
    </ToastHost>,
  );
  // The Treasure piece opens once the setting is read: its words are a button.
  await waitFor(() => expect(piece('Bronze ring').querySelector('button.place-page__piece-words')).not.toBeNull());
}

/** A piece's row on the card, by the words it starts with. */
const piece = (words: string): HTMLElement => [...document.querySelectorAll<HTMLElement>('.place-page__piece')].find((li) => li.textContent?.startsWith(words))!;
const form = (): HTMLElement => screen.getByRole('dialog', { name: 'Edit piece' });
const field = (): HTMLTextAreaElement => within(form()).getByLabelText('What players will see');

beforeEach(() => {
  world = createFakeDb();
  gmId = world.addPerson('priya@lantern.example', 'Priya');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  world.signInAs(gmId);
  forgetPackPlaces();
});
afterEach(cleanup);

describe('Edit piece behind the arrow (sf-16)', () => {
  // Purpose: a tap on any piece's words never opens the form: the description's words do nothing, a Treasure piece's
  // words open its find sheet.
  it("a tap on a piece's words never opens the form", async () => {
    await page();
    await userEvent.click(piece(SAYS).querySelector<HTMLElement>('.place-page__piece-words')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(piece(SAYS)).queryByRole('button', { name: new RegExp(`^${SAYS}`) })).toBeNull();
    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    expect(screen.queryByRole('dialog', { name: 'Edit piece' })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'To the party stash' })).toBeTruthy();
  });

  // Purpose: on a piece with nothing to send, the arrow opens Edit piece at once: the words first, Kind, Remove this
  // piece, and Save alone in the foot, the one accent (no Cancel).
  it('the arrow opens the form at once: the words, Kind, Remove this piece, Save alone in the foot', async () => {
    await page();
    await userEvent.click(within(piece(SAYS)).getByRole('button', { name: `Edit piece: ${SAYS}` }));
    expect(field().value).toBe(SAYS);
    const kind = within(form()).getByRole('button', { name: 'Kind Description' });
    const remove = within(form()).getByRole('button', { name: 'Remove this piece' });
    const save = within(form()).getByRole('button', { name: 'Save' });
    expect(field().compareDocumentPosition(kind) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(kind.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(kind.querySelector('.edit-piece__mark svg')).not.toBeNull();
    expect(kind.querySelectorAll('svg')).toHaveLength(1);
    const foot = save.closest('.dialog__actions') as HTMLElement;
    expect(within(foot).getAllByRole('button')).toEqual([save]);
    expect(form().querySelectorAll('.button-primary, .stacked-button--primary')).toHaveLength(1);
    expect(within(form()).queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  // Purpose: a Treasure piece's sheet opens the same form from its last row.
  it("a Treasure piece's sheet opens the form from its edit row", async () => {
    await page();
    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: "Edit the piece's words" }));
    expect(field().value).toBe('Bronze ring');
    expect(within(form()).getByRole('button', { name: 'Kind Treasure' })).toBeTruthy();
  });

  // Purpose: Kind unfolds its seven kinds in place under its row, the picked one ticked; a pick folds them and is the
  // row's new word; Save stores it with an Undo toast.
  it('Kind unfolds its seven kinds in place; a pick folds them; Save keeps it', async () => {
    await page();
    await userEvent.click(within(piece(SAYS)).getByRole('button', { name: `Edit piece: ${SAYS}` }));
    const kind = within(form()).getByRole('button', { name: 'Kind Description' });
    expect(kind.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(kind);
    expect(kind.getAttribute('aria-expanded')).toBe('true');
    const options = within(form()).getAllByRole('button', { pressed: undefined }).filter((b) => b.classList.contains('edit-piece__option'));
    expect(options.map((o) => o.textContent)).toEqual(PIECE_KINDS.map((k) => PIECE_KIND_WORDS[k]));
    expect(options.filter((o) => o.getAttribute('aria-pressed') === 'true').map((o) => o.textContent)).toEqual(['Description']);
    expect(options[0]!.querySelector('svg')).not.toBeNull();
    expect(options[1]!.querySelector('svg')).toBeNull();
    // In place: inside the form, between the Kind row and Remove this piece; no Back.
    expect(kind.compareDocumentPosition(options[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(options[6]!.compareDocumentPosition(within(form()).getByRole('button', { name: 'Remove this piece' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(form()).queryByRole('button', { name: 'Back' })).toBeNull();
    await userEvent.click(within(form()).getByRole('button', { name: 'Clue' }));
    expect(form().querySelector('.edit-piece__option')).toBeNull();
    expect(within(form()).getByRole('button', { name: 'Kind Clue' }).getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(within(form()).getByRole('button', { name: 'Save' }));
    await screen.findByText(`Piece changed: ${SAYS}`);
    expect(world.tables.place_pieces.find((p) => p.body === SAYS)?.kind).toBe('clue');
    expect(screen.queryByRole('dialog', { name: 'Edit piece' })).toBeNull();
  });

  // Purpose: Remove this piece takes the piece off the card with an Undo toast, and Undo brings it back.
  it('Remove this piece removes it with an Undo toast', async () => {
    await page();
    await userEvent.click(within(piece(SAYS)).getByRole('button', { name: `Edit piece: ${SAYS}` }));
    await userEvent.click(within(form()).getByRole('button', { name: 'Remove this piece' }));
    await screen.findByText(`Piece removed: ${SAYS}`);
    expect(screen.queryByRole('dialog', { name: 'Edit piece' })).toBeNull();
    await waitFor(() => expect(piece(SAYS)).toBeUndefined());
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(piece(SAYS)).toBeTruthy());
  });

  // Purpose: the X with words changed closes the form and says "Changes dropped." with Undo; the Undo opens the form
  // again with the words (and kind) as typed; nothing was saved.
  it('the X with words changed: "Changes dropped.", and Undo opens it again as typed', async () => {
    await page();
    await userEvent.click(within(piece(SAYS)).getByRole('button', { name: `Edit piece: ${SAYS}` }));
    await userEvent.clear(field());
    await userEvent.type(field(), 'Nets, and a cold brazier with a gull on it.');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kind Description' }));
    await userEvent.click(within(form()).getByRole('button', { name: 'Hazard' }));
    await userEvent.click(within(form()).getByRole('button', { name: /Close/ }));
    expect(screen.queryByRole('dialog', { name: 'Edit piece' })).toBeNull();
    await screen.findByText('Changes dropped.');
    expect(world.tables.place_pieces.find((p) => p.body === SAYS)?.kind).toBe('description');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(field().value).toBe('Nets, and a cold brazier with a gull on it.');
    expect(within(form()).getByRole('button', { name: 'Kind Hazard' })).toBeTruthy();
    // Closed and opened again from the arrow, it starts from the piece's own words: the dropped words were used once.
    await userEvent.click(within(form()).getByRole('button', { name: /Close/ }));
    await screen.findByText('Changes dropped.');
    await userEvent.click(within(piece(SAYS)).getByRole('button', { name: `Edit piece: ${SAYS}` }));
    expect(field().value).toBe(SAYS);
  });

  // Purpose: the X with nothing changed only closes: no toast.
  it('the X with nothing changed only closes', async () => {
    await page();
    await userEvent.click(within(piece(SAYS)).getByRole('button', { name: `Edit piece: ${SAYS}` }));
    await userEvent.click(within(form()).getByRole('button', { name: /Close/ }));
    expect(screen.queryByRole('dialog', { name: 'Edit piece' })).toBeNull();
    expect(screen.queryByText('Changes dropped.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});

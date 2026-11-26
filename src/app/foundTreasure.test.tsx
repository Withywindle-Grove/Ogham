// @vitest-environment jsdom
// sf-8 (plan dec-scene-feedback; page 44, TR1 and TR2, approved 2026-11-26): found treasure on the GM's place page, on
// the stand-in database. Invented places and things only. In plain words:
//   * every Treasure piece opens its find sheet from its words and from its arrow, a single thing too;
//   * one thing: its words, then "To a character" and "To the party stash", at once; "Edit the piece's words" last;
//   * a count: a row a thing, the edit row, then "Send all" at the foot, the sheet's one accent, sending every row left;
//   * a sent piece's sheet says where it went, with "Take it back" (no arrow), which runs the send's Undo once with a
//     toast; refused, the blocked-action pop-up says why;
//   * a magic item goes under its plain name.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { forgetPackPlaces, loadGroupPlaces, setPlace, type GroupPlace } from '../modules/expedition/placePlay.ts';
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

const SHED = {
  id: 'net-shed',
  name: 'The net shed',
  key: '3',
  type: 'site',
  playerView: { text: 'Nets hang to dry over a cold brazier.' },
  hoards: [{ name: 'Crate', text: 'Eight flasks of lamp oil, dry.' }],
  treasure: [
    { text: 'Bronze ring', magicItem: { name: 'Ring of the Drowned Bell', text: 'Its wearer is steadier against harm.', noticed: 'Cold to the touch.' } },
    { text: 'Lamp oil', qty: 8, hoard: 'Crate' },
  ],
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

async function page() {
  const { trip, row } = await atShed();
  render(
    <ToastHost>
      <SceneWaitingProvider>
        <GmPlacePage db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }} expeditionId={trip} group={1} groupLabel={null} row={row} checks={[]} recent={[]} onChanged={() => undefined} />
      </SceneWaitingProvider>
    </ToastHost>,
  );
  // The piece opens once the setting is read: its words are a button (every piece has its arrow, sf-16).
  await waitFor(() => expect(piece('Bronze ring').querySelector('button.place-page__piece-words')).not.toBeNull());
}

/** A piece's row on the card, by the words it starts with. */
const piece = (words: string): HTMLElement => [...document.querySelectorAll<HTMLElement>('.place-page__piece')].find((li) => li.textContent?.startsWith(words))!;
const sheet = (): HTMLElement => screen.getByRole('dialog');

beforeEach(() => {
  world = createFakeDb();
  gmId = world.addPerson('priya@lantern.example', 'Priya');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  world.signInAs(gmId);
  forgetPackPlaces();
});
afterEach(cleanup);

describe('found treasure (sf-8)', () => {
  // Purpose: a single thing's piece opens its find sheet from its words: where it goes, then the edit row last.
  it("a single thing's words open its sheet: To a character, To the party stash, the edit row last", async () => {
    await page();
    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    const rows = within(sheet()).getAllByRole('button').map((b) => b.textContent);
    expect(within(sheet()).getByRole('heading', { name: 'Bronze ring' })).toBeTruthy();
    expect(rows.filter((t) => t && /To a character|To the party stash|Edit the piece's words/.test(t))).toEqual(['To a character', 'To the party stash', "Edit the piece's words"]);
    expect(within(sheet()).queryByRole('button', { name: 'Send all' })).toBeNull();
  });

  // Purpose: the arrow before the eye opens the same sheet as the words.
  it('the arrow opens the sheet too', async () => {
    await page();
    await userEvent.click(piece('Bronze ring').querySelector<HTMLElement>('.place-page__opens')!);
    expect(within(sheet()).getByRole('button', { name: 'To the party stash' })).toBeTruthy();
  });

  // Purpose: a sent piece's sheet says where it went and offers "Take it back", with no arrow; a tap runs the send's
  // Undo once, says so in a toast, and the sheet offers where to send it again. The thing went under its plain name.
  it('a sent piece says where it went; Take it back undoes the send once, with a toast', async () => {
    await page();
    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    await userEvent.click(within(sheet()).getByRole('button', { name: 'To the party stash' }));
    await screen.findByText('Put in the party stash: bronze ring.');
    expect(world.tables.inventory_lines.map((l) => l.name)).toEqual(['Bronze ring']);
    await waitFor(() => expect(within(piece('Bronze ring')).getByText('In the party stash')).toBeTruthy());

    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    expect(within(sheet()).getByText('In the party stash.')).toBeTruthy();
    const back = within(sheet()).getByRole('button', { name: 'Take it back' });
    expect(back.querySelector('.list-row__chevron, svg[data-chevron]')).toBeNull();
    expect(within(sheet()).queryByRole('button', { name: 'To the party stash' })).toBeNull();
    await userEvent.click(back);
    await screen.findByText('Taken back from the party stash: bronze ring.');
    expect(world.tables.inventory_lines).toHaveLength(0);
    expect(world.tables.events.filter((e) => e.reverts_event_id).length).toBeGreaterThan(0);
    await waitFor(() => expect(within(sheet()).getByRole('button', { name: 'To the party stash' })).toBeTruthy());
  });

  // Purpose: when the send can't be undone (the thing has changed since), the blocked-action pop-up says why.
  it('Take it back refused: the blocked-action pop-up says why', async () => {
    await page();
    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    await userEvent.click(within(sheet()).getByRole('button', { name: 'To the party stash' }));
    await screen.findByText('Put in the party stash: bronze ring.');
    world.tables.inventory_lines = [];
    await waitFor(() => expect(within(piece('Bronze ring')).getByText('In the party stash')).toBeTruthy());
    await userEvent.click(within(piece('Bronze ring')).getByRole('button', { name: /^Bronze ring/ }));
    await userEvent.click(within(sheet()).getByRole('button', { name: 'Take it back' }));
    const why = await screen.findByRole('dialog', { name: "Can't take it back" });
    expect(within(why).getByText("That's changed since. Undo the later change first.")).toBeTruthy();
  });

  // Purpose: a count's sheet lists a row a thing, then the edit row, then "Send all" at the foot, the sheet's one
  // accent, which sends every row left.
  it('a count: the rows, the edit row, then Send all at the foot, the one accent', async () => {
    await page();
    await userEvent.click(within(piece('Crate')).getByRole('button', { name: /^Crate/ }));
    const all = within(sheet()).getByRole('button', { name: 'Send all' });
    const edit = within(sheet()).getByRole('button', { name: "Edit the piece's words" });
    expect(within(sheet()).getByText('Lamp oil ×8')).toBeTruthy();
    expect(edit.compareDocumentPosition(all) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(all.closest('.dialog__actions')).not.toBeNull();
    expect(sheet().querySelectorAll('.stacked-button--primary, .button-primary')).toHaveLength(1);
    await userEvent.click(all);
    await userEvent.click(within(sheet()).getByRole('button', { name: 'To the party stash' }));
    await screen.findByText('Put in the party stash: 8 lamp oil.');
    expect(world.tables.inventory_lines.map((l) => [l.name, l.qty])).toEqual([['Lamp oil', 8]]);
  });
});

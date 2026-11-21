// @vitest-environment jsdom
// "Add this place's map" (dec-7 5m-2; mockup december/11, frames 2c and 4d): the row a place's page shows where the map
// will stand while the campaign has no copy of the map its pack names. Invented place and map only. In plain words:
//   * the row names the picture wanted (its title, the file's name under it) and has "+ Map";
//   * a file from the device is uploaded as the campaign's map, the GM's alone, tied to the place; the toast says
//     "Map added (hidden): <place>", and its Undo takes the map off again;
//   * once the eye has shared the copy, Undo unties the place and hides the copy from the players again;
//   * a file over the limit is refused in the approved words, nothing is added, and the row stays as it was.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { MAP_TOO_LARGE } from './image.ts';
import { AddPlaceMap, UNDO_UNREAD_WORDS } from './PlaceMap.tsx';

const harbour = { id: 'p-harbour', name: 'The Drowned Harbour', version: 1 };
const chart = { title: 'The Drowned Harbour, the harbour chart', file: 'harbour-chart.png' };

describe('+ Map on a place whose pack names a map', () => {
  let world: FakeWorld;
  let gm: CurrentUser;
  let campaign: string;
  const changed = vi.fn();

  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    campaign = world.addCampaign('The Reed Marches', gmId);
    world.tables.places.push({ id: harbour.id, campaign_id: campaign, name: harbour.name, description: '', pack_id: 'pack-marsh', pack_entry_id: 'harbour', map_asset_id: null, version: 1, undone: false });
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } };
    // The browser's picture reader: every picture here already fits, so it goes as it came.
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 800, close: () => undefined })));
    changed.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const show = () =>
    render(
      <ToastHost>
        <AddPlaceMap db={world.db} user={gm} campaignId={campaign} place={harbour} map={chart} onChanged={changed} />
      </ToastHost>,
    );

  // Purpose: the row names the picture wanted by its title and its file, with "+ Map" beside them (frame 2c).
  it('names the map wanted and its file, with + Map', () => {
    show();
    expect(screen.getByText(chart.title)).toBeTruthy();
    expect(screen.getByText('harbour-chart.png')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Map' })).toBeTruthy();
  });

  // Purpose: the file from the device becomes the campaign's map, hidden and tied; the toast's Undo takes it off.
  it('adds the map hidden, says so, and Undo takes it off', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const asset = world.tables.assets.find((a) => a.kind === 'map');
    expect(asset).toMatchObject({ visibility: 'gm', name: chart.title });
    expect(world.tables.places[0]?.map_asset_id).toBe(asset?.id);
    expect(changed).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
  });

  // Purpose (Francis, "Yes hide", 2026-11-18): undoing + Map after the eye showed the map hides it again: the copy goes
  // back to the GM alone through place.shareMap's own logged change, and the place is untied. What the database sends
  // follows the copy's visibility: a "gm" copy is read by no player, row or file (supabase/tests/dec-7-5m-3-map-eye
  // test 1); this stand-in has no read rule for it, so the test checks the visibility the rule reads and the log line.
  it('Undo after the copy was shown hides it from the players again and unties the place', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const asset = world.tables.assets.find((a) => a.kind === 'map')!;
    // What the eye's place.shareMap does to the copy.
    asset.visibility = 'all';
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
    expect(world.tables.assets.find((a) => a.id === asset.id)?.visibility).toBe('gm');
    expect(world.tables.events.filter((e) => e.type === 'place.shareMap').map((e) => e.target_id)).toEqual([asset.id]);
  });

  // Purpose (#958 review): when Undo can't read whether the map is shown, it changes nothing (the place stays tied, no
  // share is written) and says so, so a shown copy is never left shown on an untied place.
  it('Undo that cannot read whether the map is shown leaves the map tied and says so', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const assetId = world.tables.places[0]?.map_asset_id;
    // The copy's row can't be read (loadMapShown gives null).
    world.tables.assets.splice(world.tables.assets.findIndex((a) => a.id === assetId), 1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("Couldn't check the map. Nothing was undone. Try again.")).toBeTruthy();
    expect(world.tables.places[0]?.map_asset_id).toBe(assetId);
    expect(world.tables.events.filter((e) => e.type === 'place.shareMap')).toEqual([]);
  });

  // Purpose (#958 review): when Undo hides a shown map but finds no tie left to take back, its toast says the map was
  // hidden, not "Nothing to undo.".
  it('Undo that hides the map with no tie left says the map was hidden', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const asset = world.tables.assets.find((a) => a.kind === 'map')!;
    asset.visibility = 'all';
    // The tie's log line is gone (latestChange finds nothing).
    world.tables.events = world.tables.events.filter((e) => e.type !== 'place.setMap');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Map hidden from the players. Nothing else to undo.')).toBeTruthy();
    expect(asset.visibility).toBe('gm');
    expect(screen.queryByText('Nothing to undo.')).toBeNull();
  });

  // Purpose (#958 re-review): when Undo couldn't check the map, its "Try again." toast carries an Undo that tries
  // again; once the map can be read, that Undo unties the place.
  it("Undo's Try again toast has an Undo that tries again", async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const assetId = world.tables.places[0]?.map_asset_id;
    const at = world.tables.assets.findIndex((a) => a.id === assetId);
    const [row] = world.tables.assets.splice(at, 1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText(UNDO_UNREAD_WORDS);
    world.tables.assets.push(row!);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
  });

  // Purpose (#958 re-review): when Undo hides a shown map but can't untie it, its toast says the map was hidden.
  it('Undo that hides the map but cannot untie it says the map was hidden', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const asset = world.tables.assets.find((a) => a.kind === 'map')!;
    asset.visibility = 'all';
    // The place changed since (another map tied by hand), so the untie is refused.
    world.tables.places[0]!.map_asset_id = 'another-map';
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText(/^Map hidden from the players\. /)).toBeTruthy();
    expect(asset.visibility).toBe('gm');
  });

  // Purpose: a map never shown is untied by Undo with no share written (nothing to hide).
  it('Undo of a map never shown writes no share', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File(['a chart'], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'place.shareMap')).toEqual([]);
  });

  // Purpose: a file over the limit is refused in the approved words; nothing is added and "+ Map" stays.
  it('refuses a map over the limit and leaves the row as it was', async () => {
    const user = userEvent.setup();
    show();
    await user.upload(screen.getByLabelText("Choose the map's file: harbour-chart.png"), new File([new Uint8Array(26 * 1024 * 1024)], 'harbour-chart.png', { type: 'image/png' }));
    await screen.findByText(MAP_TOO_LARGE);
    expect(world.tables.assets).toHaveLength(0);
    expect(world.tables.places[0]?.map_asset_id).toBeNull();
    expect(screen.getByRole('button', { name: '+ Map' })).toBeTruthy();
  });
});

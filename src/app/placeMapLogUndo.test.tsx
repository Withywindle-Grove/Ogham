// @vitest-environment jsdom
// The log's Undo of "added a map" (#958 re-review): toasts show one at a time, so once the eye's toast replaces "Map
// added (hidden)", the log's line is the Undo left. It takes the same path as the toast's: a map shown since is hidden
// from the players again first, then the place is untied. Invented place and map only. In plain words:
//   * a shown map: the log's Undo hides it (one place.shareMap line) and unties the place;
//   * a hidden map: the log's Undo unties it and writes no share;
//   * a map that can't be read: the log's Undo changes nothing and says so;
//   * a shown map whose untie is refused: the hide stands, the log says so, and the screen around it reads again.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { addPlaceMap, setPlaceMap } from '../modules/expedition/placeMap.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { LogView } from './LogView.tsx';
import { UNDO_UNREAD_WORDS } from './PlaceMap.tsx';
import { registry } from './services.ts';

const harbour = { id: 'p-harbour', name: 'The Drowned Harbour', version: 1 };

describe("the log's Undo of an added map", () => {
  let world: FakeWorld;
  let gm: CurrentUser;
  let campaign: string;

  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    campaign = world.addCampaign('The Reed Marches', gmId);
    world.tables.places.push({ id: harbour.id, campaign_id: campaign, name: harbour.name, description: '', pack_id: 'pack-marsh', pack_entry_id: 'harbour', map_asset_id: null, version: 1, undone: false });
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } };
  });
  afterEach(cleanup);

  async function addMap(shown: boolean) {
    const added = await runCommand(registry, world.db, gm, addPlaceMap, { campaignId: campaign, place: harbour, title: 'The harbour chart', image: new Blob(['a chart'], { type: 'image/png' }) });
    if (!added.ok) throw new Error(added.message);
    const tied = await runCommand(registry, world.db, gm, setPlaceMap, { campaignId: campaign, place: harbour, assetId: added.value });
    if (!tied.ok) throw new Error(tied.message);
    // What the eye's place.shareMap does to the copy.
    if (shown) world.tables.assets.find((a) => a.id === added.value)!.visibility = 'all';
    return added.value;
  }

  async function undoFromLog(onChanged?: () => void) {
    const user = userEvent.setup();
    render(
      <ToastHost>
        <LogView db={world.db} user={gm} campaignId={campaign} onChanged={onChanged} />
      </ToastHost>,
    );
    await user.click(await screen.findByRole('checkbox', { name: /Verbose/ }));
    await user.click(await screen.findByRole('button', { name: /added a map to/ }));
    await user.click(await screen.findByRole('button', { name: /^Undo: .*added a map to/ }));
  }

  // Purpose (#958 re-review): undoing "added a map" from the log after the eye showed it hides it from the players
  // again (one place.shareMap line) and unties the place, as the toast's Undo does.
  it('a shown map: hides it and unties the place', async () => {
    const assetId = await addMap(true);
    await undoFromLog();
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('gm');
    expect(world.tables.events.filter((e) => e.type === 'place.shareMap').map((e) => e.target_id)).toEqual([assetId]);
  });

  // Purpose: a map never shown is untied from the log with no share written.
  it('a hidden map: unties it and writes no share', async () => {
    await addMap(false);
    await undoFromLog();
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'place.shareMap')).toEqual([]);
  });

  // Purpose (#958 final review): when the log's Undo can't read whether the map is shown, nothing changes (the place
  // stays tied, no share is written) and the log says so.
  it("a map that can't be read: changes nothing and says so", async () => {
    const assetId = await addMap(true);
    // The copy's row can't be read (loadMapShown gives null).
    const [row] = world.tables.assets.splice(world.tables.assets.findIndex((a) => a.id === assetId), 1);
    await undoFromLog();
    expect(await screen.findByText(UNDO_UNREAD_WORDS)).toBeTruthy();
    expect(world.tables.places[0]?.map_asset_id).toBe(assetId);
    expect(row?.visibility).toBe('all');
    expect(world.tables.events.filter((e) => e.type === 'place.shareMap')).toEqual([]);
    expect(world.tables.events.some((e) => e.reverts_event_id)).toBe(false);
  });

  // Purpose (#958 final review): when the log's Undo hides a shown map but the untie is refused, the hide stands, the
  // log says the map was hidden, and the screen around it is told something changed (so the Scene's eye reads again).
  it('a shown map whose untie is refused: hides it, says so and tells the screen', async () => {
    const assetId = await addMap(true);
    // The place changed since (another map tied by hand), so the untie is refused.
    world.tables.places[0]!.map_asset_id = 'another-map';
    const onChanged = vi.fn();
    await undoFromLog(onChanged);
    expect(await screen.findByText(/^Map hidden from the players\. /)).toBeTruthy();
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('gm');
    expect(world.tables.places[0]?.map_asset_id).toBe('another-map');
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });
});

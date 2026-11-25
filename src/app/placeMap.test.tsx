// @vitest-environment jsdom
// "Add this place's map" (dec-7 5m-2; mockup december/11, frames 2c and 4d): the row a place's page shows where the map
// will stand while the campaign has no copy of the map its pack names. Invented place and map only. In plain words:
//   * the row names the picture wanted (its title, the file's name under it) and has "+ Map";
//   * a file from the device is uploaded as the campaign's map, the GM's alone, tied to the place; the toast says
//     "Map added (hidden): <place>", and its Undo takes the map off again;
//   * once the eye has shared the copy, Undo unties the place and hides the copy from the players again;
//   * a file over the limit is refused in the approved words, nothing is added, and the row stays as it was;
//   * (B14 review, 2026-11-24) after the GM undoes the pack map's tie, the place isn't tied again on its own and "+ Map"
//     takes the pack's picture with one tap; a tie that hangs or throws gives way to "+ Map".
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { undoChange } from '../core/undo.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { MAP_TOO_LARGE } from './image.ts';
import { PACK_PICTURE_UNREAD_WORDS } from './packMapTie.ts';
import { AddPlaceMap, PlaceMapPart, TIE_WAIT_MS, UNDO_UNREAD_WORDS } from './PlaceMap.tsx';

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

  // Purpose (B14, p2p-27): when the place's own tie of the pack's picture failed, "+ Map" tries the pack's picture again
  // with no file to pick: the same hidden copy, the same toast and Undo.
  it("after a failed tie, + Map tries the pack's picture again, with no file to pick", async () => {
    const user = userEvent.setup();
    world.tables.packs.push({ id: 'pack-marsh', owner_user_id: gm.id, campaign_id: null, name: 'The Marsh', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' });
    world.files.set('pack-files/pack-marsh/harbour-chart', new Blob(['a chart'], { type: 'image/png' }));
    render(
      <ToastHost>
        <AddPlaceMap db={world.db} user={gm} campaignId={campaign} place={harbour} map={chart} packed="pack-marsh/harbour-chart" onChanged={changed} />
      </ToastHost>,
    );
    await user.click(screen.getByRole('button', { name: '+ Map from the pack' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
    const asset = world.tables.assets.find((a) => a.kind === 'map');
    expect(asset).toMatchObject({ visibility: 'gm', name: chart.title });
    expect(world.tables.places[0]?.map_asset_id).toBe(asset?.id);
    expect(await world.files.get(`${campaign}/${String(asset?.id)}`)?.text()).toBe('a chart');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.places[0]?.map_asset_id).toBeNull());
  });

  // Purpose: when the pack's picture can't be fetched, the toast says so and nothing is added.
  it("says so when the pack's picture can't be fetched, and adds nothing", async () => {
    const user = userEvent.setup();
    render(
      <ToastHost>
        <AddPlaceMap db={world.db} user={gm} campaignId={campaign} place={harbour} map={chart} packed="pack-marsh/harbour-chart" onChanged={changed} />
      </ToastHost>,
    );
    await user.click(screen.getByRole('button', { name: '+ Map from the pack' }));
    await screen.findByText(PACK_PICTURE_UNREAD_WORDS);
    expect(world.tables.assets.some((a) => a.kind === 'map')).toBe(false);
    expect(screen.getByRole('button', { name: '+ Map from the pack' })).toBeTruthy();
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

describe("a place whose pack brought its map's picture (B14, p2p-27)", () => {
  let world: FakeWorld;
  let gm: CurrentUser;
  let campaign: string;
  const place = { id: 'p-harbour', name: 'The Drowned Harbour', version: 1, pack: { packId: 'pack-marsh', entryId: 'harbour', type: 'region', parentId: '', key: '' } };
  const map = { id: 'harbour-chart', file: 'harbour-chart.png', title: 'The harbour chart', alt: 'A silted harbour', locationIds: ['harbour'], source: '' };

  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    campaign = world.addCampaign('The Reed Marches', gmId);
    world.tables.packs.push({ id: 'pack-marsh', owner_user_id: gmId, campaign_id: null, name: 'The Marsh', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' });
    world.tables.campaign_packs.push({ id: 'cp-marsh', campaign_id: campaign, pack_id: 'pack-marsh', option_choices: {}, priority: 1 });
    world.tables.library_entries.push({ id: 'entry-chart', pack_id: 'pack-marsh', kind: 'map', pack_entry_id: map.id, name: map.title, data: { ...map } });
    world.tables.places.push({ id: place.id, campaign_id: campaign, name: place.name, description: '', pack_id: 'pack-marsh', pack_entry_id: 'harbour', map_asset_id: null, version: 1, undone: false });
    world.files.set('pack-files/pack-marsh/harbour-chart', new Blob(['the chart, bundled'], { type: 'image/png' }));
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 800, close: () => undefined })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const open = () =>
    render(
      <ToastHost>
        <PlaceMapPart db={world.db} user={gm} campaignId={campaign} place={place} />
      </ToastHost>,
    );
  const maps = () => world.tables.assets.filter((a) => a.kind === 'map');

  // Purpose (Francis, 2026-11-24: "youre forcing gm to tap when they shouldn't need to"): opening the place shows its map,
  // the copy hidden (its eye closed), with no "+ Map" to tap and no toast.
  it('shows the map, hidden, with no tap', async () => {
    open();
    // The card (its eye waits for the picture, which a test page never draws), and the copy behind it, hidden.
    await screen.findByRole('region', { name: 'The map' });
    expect(screen.queryByRole('button', { name: '+ Map' })).toBeNull();
    expect(screen.queryByText(/^Map added/)).toBeNull();
    expect(maps()).toHaveLength(1);
    expect(maps()[0]).toMatchObject({ visibility: 'gm' });
  });

  // Purpose: opening the place again adds no second copy.
  it('a second open adds no second copy', async () => {
    open();
    await screen.findByRole('region', { name: 'The map' });
    cleanup();
    open();
    await screen.findByRole('region', { name: 'The map' });
    expect(maps()).toHaveLength(1);
  });

  // Purpose: where the pack brought no picture for the map, "+ Map" asks for the file by hand, as before (5m-2).
  it('without the pack\'s picture, + Map asks for the file', async () => {
    world.files.delete('pack-files/pack-marsh/harbour-chart');
    open();
    expect(await screen.findByRole('button', { name: '+ Map' })).toBeTruthy();
    expect(maps()).toHaveLength(0);
  });

  // Purpose: when the pack's picture can't be fetched, the toast says so, nothing is added, and "+ Map" tries again.
  it("says so when the pack's picture can't be fetched, and + Map tries again", async () => {
    const user = userEvent.setup();
    const from = world.db.storage.from.bind(world.db.storage);
    let offline = true;
    (world.db.storage as { from: unknown }).from = (bucket: string) => {
      const real = from(bucket);
      return offline && bucket === 'pack-files' ? { ...real, download: async () => ({ data: null, error: { message: 'offline' } }) } : real;
    };
    open();
    await screen.findByText(PACK_PICTURE_UNREAD_WORDS);
    expect(maps()).toHaveLength(0);
    offline = false;
    await user.click(await screen.findByRole('button', { name: '+ Map from the pack' }));
    await screen.findByRole('region', { name: 'The map' });
    expect(maps()).toHaveLength(1);
  });

  // The pack's picture fetched as `download` gives it (a hang, a throw).
  const packDownload = (download: () => Promise<unknown>) => {
    const from = world.db.storage.from.bind(world.db.storage);
    (world.db.storage as { from: unknown }).from = (bucket: string) => {
      const real = from(bucket);
      return bucket === 'pack-files' ? { ...real, download } : real;
    };
  };

  // Purpose (review, finding 2): after the GM undoes the tie from the log, opening the place again ties nothing on its
  // own (the Undo holds); "+ Map" is there and takes the pack's picture with one tap, no file to pick.
  it("after the tie's Undo, the next open ties nothing and + Map takes the pack's picture", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('region', { name: 'The map' });
    const setLine = world.tables.events.find((e) => e.type === 'place.setMap')!;
    const undone = await runCommand(createAppRegistry(), world.db, gm, undoChange, { campaignId: campaign, eventId: String(setLine.id), authorUserId: gm.id });
    expect(undone.ok).toBe(true);
    cleanup();
    open();
    const add = await screen.findByRole('button', { name: '+ Map from the pack' });
    expect(maps()).toHaveLength(1);
    expect(world.tables.places.find((p) => p.id === place.id)?.map_asset_id).toBeNull();
    await user.click(add);
    await screen.findByRole('region', { name: 'The map' });
    expect(world.tables.places.find((p) => p.id === place.id)?.map_asset_id).toBeTruthy();
  });

  // Purpose (review, finding 3): a fetch of the pack's picture that never ends doesn't leave the slot empty: after the
  // wait, the toast says so and "+ Map" is there to try again.
  it('a hung fetch gives way to + Map after the wait', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Ended when the test is over, so the hung run doesn't stay shared with the next test's open.
    let end = () => undefined as void;
    let asked = false;
    try {
      packDownload(() => {
        asked = true;
        return new Promise((resolve) => (end = () => resolve({ data: null, error: { message: 'offline' } })));
      });
      open();
      // The tie is under way (its fetch asked for), and the slot is empty meanwhile.
      await waitFor(() => expect(asked).toBe(true));
      expect(screen.queryByRole('button', { name: '+ Map from the pack' })).toBeNull();
      await vi.advanceTimersByTimeAsync(TIE_WAIT_MS);
      expect(await screen.findByRole('button', { name: '+ Map from the pack' })).toBeTruthy();
      // The toast follows the row's render (its effect), so it is waited for, not read at once (flaked under load).
      expect(await screen.findByText(PACK_PICTURE_UNREAD_WORDS)).toBeTruthy();
      expect(maps()).toHaveLength(0);
    } finally {
      end();
      vi.useRealTimers();
    }
  });

  // Purpose (audit 2, Francis's words 24 Nov): while the pack's map is being tied, its spot says so in one quiet line,
  // as "+ Map" says "Uploading the map…", instead of standing empty.
  it("while the pack's map is tied, its spot says \"Fetching the pack's map…\"", async () => {
    let end = () => undefined as void;
    let asked = false;
    try {
      packDownload(() => {
        asked = true;
        return new Promise((resolve) => (end = () => resolve({ data: null, error: { message: 'offline' } })));
      });
      open();
      await waitFor(() => expect(asked).toBe(true));
      expect(screen.getByText("Fetching the pack's map…").getAttribute('role')).toBe('status');
    } finally {
      end();
    }
  });

  // Purpose (audit 6, Francis's words 24 Nov): the "+ Map" that adds the pack's own picture at once says where it comes
  // from; the one that asks for a file stays "+ Map".
  it('"+ Map from the pack" adds the pack\'s picture; the file picker\'s stays "+ Map"', async () => {
    const user = userEvent.setup();
    const wanted = { title: map.title, file: map.file };
    render(
      <ToastHost>
        <AddPlaceMap db={world.db} user={gm} campaignId={campaign} place={place} map={wanted} packed="pack-marsh/harbour-chart" onChanged={() => undefined} />
        <AddPlaceMap db={world.db} user={gm} campaignId={campaign} place={place} map={wanted} onChanged={() => undefined} />
      </ToastHost>,
    );
    expect(screen.getByRole('button', { name: '+ Map' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '+ Map from the pack' }));
    await screen.findByText('Map added (hidden): The Drowned Harbour');
  });

  // Purpose (review, finding 3): a tie that throws (here, the fetch) leaves "+ Map" and the toast, not an empty slot.
  it('a tie that throws gives way to + Map', async () => {
    packDownload(() => Promise.reject(new Error('Failed to fetch')));
    open();
    expect(await screen.findByRole('button', { name: '+ Map from the pack' })).toBeTruthy();
    // The toast follows the row's render (its effect): waited for, not read at once (flaked under load, 25 Nov).
    expect(await screen.findByText(PACK_PICTURE_UNREAD_WORDS)).toBeTruthy();
    expect(maps()).toHaveLength(0);
  });

  // Purpose (re-audit New 2b, Francis 25 Nov): a map the pack brought shows no file-name line, there being no file for
  // the GM to find: neither on "+ Map from the pack" nor while "Fetching the pack's map…" shows.
  it('a map the pack brought shows no file-name line, fetching or not', async () => {
    let end = () => undefined as void;
    let asked = false;
    try {
      packDownload(() => {
        asked = true;
        return new Promise((resolve) => (end = () => resolve({ data: null, error: { message: 'offline' } })));
      });
      open();
      await waitFor(() => expect(asked).toBe(true));
      expect(screen.getByText("Fetching the pack's map…")).toBeTruthy();
      expect(screen.queryByText(map.file)).toBeNull();
    } finally {
      end();
    }
    expect(await screen.findByRole('button', { name: '+ Map from the pack' })).toBeTruthy();
    expect(screen.queryByText(map.file)).toBeNull();
  });

  // Purpose (re-audit question, ruled yes 25 Nov): after a failed fetch the row offers "or choose a file…" under the
  // retry; it opens the usual file picker, and the file chosen becomes the place's map.
  it('after a failed fetch, "or choose a file…" opens the file picker and the file becomes the map', async () => {
    const user = userEvent.setup();
    packDownload(async () => ({ data: null, error: { message: 'offline' } }));
    open();
    await screen.findByRole('button', { name: '+ Map from the pack' });
    const picker = screen.getByLabelText(`Choose the map's file: ${map.file}`) as HTMLInputElement;
    const opened = vi.spyOn(picker, 'click');
    await user.click(screen.getByRole('button', { name: 'or choose a file…' }));
    expect(opened).toHaveBeenCalled();
    await user.upload(picker, new File(['the chart, by hand'], 'chart.png', { type: 'image/png' }));
    await screen.findByRole('region', { name: 'The map' });
    expect(maps()).toHaveLength(1);
    const tiedTo = world.tables.places.find((p) => p.id === place.id)?.map_asset_id;
    expect(tiedTo).toBe(maps()[0]?.id);
    expect(await world.files.get(`${campaign}/${String(tiedTo)}`)?.text()).toBe('the chart, by hand');
  });

  // Purpose: "or choose a file…" is only for after a failed fetch: the "+ Map from the pack" an Undo leaves has none.
  it('no "or choose a file…" before any fetch has failed', () => {
    render(
      <ToastHost>
        <AddPlaceMap db={world.db} user={gm} campaignId={campaign} place={place} map={{ title: map.title, file: map.file }} packed="pack-marsh/harbour-chart" onChanged={() => undefined} />
      </ToastHost>,
    );
    expect(screen.getByRole('button', { name: '+ Map from the pack' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'or choose a file…' })).toBeNull();
  });
});

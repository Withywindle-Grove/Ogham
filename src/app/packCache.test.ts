// @vitest-environment jsdom
// The on-device pack cache (perf fix 2b, docs/plans/perf-pack-cache.md), against the stand-in database and an
// in-memory store. Condition 1: a stored copy is one person's, holds exactly what the database sent them, and is
// never served to anyone else. Condition 2: the copy drops when the packs change, when the person changes or signs
// out, and when the cache format changes; and a start where nothing moved downloads nothing.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { loadCurrentUser } from '../core/currentUser.ts';
import { loadCampaignEntries } from '../modules/library/campaignPacks.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { memoryPackStore, type MemoryPackStore } from '../testing/memoryPackStore.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { asOfWords, forgetCampaignSetting, loadCampaignPacksAndEntries, loadCampaignSetting } from './campaignSetting.ts';
import { CACHE_FORMAT, CAMPAIGNS_KEPT, claimDevice, deviceOwner, keepOnlyCampaigns, releaseDevice, storeCampaign, storeSettled, usePackStore } from './packCache.ts';
import { CampaignRules } from './RulesBrowser.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let store: MemoryPackStore;
let gm: string;
let player: string;
let campaignId: string;
/** The pack ids each campaign entry download asked for, in order. */
let downloads: string[][];
/** Tables whose reads fail (offline). */
let broken: Set<string>;
/** Holds the next entry download until released. */
let holdDownload: Promise<void> | null;

function addPack(id: string, name: string, entries: { id: string; kind: string; name: string }[], contentRev = 0) {
  world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: {}, updated_at: '2026-11-01T12:00:00Z', content_rev: contentRev });
  world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaignId, pack_id: id, pack_name: name, option_choices: {}, priority: world.tables.campaign_packs.length + 1 });
  for (const entry of entries) {
    world.tables.library_entries.push({ id: `e-${id}-${entry.id}`, pack_id: id, kind: entry.kind, pack_entry_id: entry.id, name: entry.name, data: { id: entry.id, name: entry.name, category: 'gear' } });
  }
}

const pack = (id: string) => world.tables.packs.find((p) => p.id === id)!;
const storedPackIds = () => [...store.state.packs.values()].map((p) => `${p.userId}:${p.packId}`).sort();
/** Reads through the store, then waits for the store's writes (the app doesn't; the tests look at what was stored). */
const load = async (userId = gm) => {
  const rows = await loadCampaignPacksAndEntries(world.db, userId, campaignId);
  await storeSettled();
  return rows;
};

beforeEach(() => {
  forgetCampaignSetting();
  store = memoryPackStore();
  usePackStore(store);
  world = createFakeDb();
  gm = world.addPerson('wren@lantern.example', 'Wren');
  player = world.addPerson('ash@lantern.example', 'Ash');
  world.signInAs(gm);
  campaignId = world.addCampaign('The Mire Road', gm);
  world.addMember(campaignId, player, 'player');
  addPack('pack-mire', 'Mire Rules', [
    { id: 'reed-lantern', kind: 'item', name: 'Reed lantern' },
    { id: 'bog-lurker', kind: 'monster', name: 'Bog lurker' },
  ]);
  downloads = [];
  broken = new Set();
  holdDownload = null;
  const counted = world.db as unknown as { from: (table: string) => { select: (...args: unknown[]) => unknown } };
  const from = counted.from.bind(counted);
  vi.spyOn(counted, 'from').mockImplementation((table) => {
    const query = from(table) as { select: (...args: unknown[]) => unknown; in?: (column: string, values: string[]) => unknown; then?: unknown };
    if (broken.has(table)) {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'offline' } }), then: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'offline' } }) }) }) } as never;
    }
    return query;
  });
  // The campaign's entries are asked for by campaign (`campaign_library`, hd-2), naming the packs wanted.
  const called = world.db as unknown as { rpc: (name: string, args: Record<string, unknown>) => unknown };
  const rpc = called.rpc.bind(called);
  vi.spyOn(called, 'rpc').mockImplementation((name, args) => {
    if (name !== 'campaign_library') return rpc(name, args);
    downloads.push([...((args.packs ?? []) as string[])].sort());
    const hold = holdDownload;
    return hold ? hold.then(() => rpc(name, args)) : rpc(name, args);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  usePackStore(null);
});

describe('condition 1: one person’s copies, exactly as sent', () => {
  it('the cache key includes the person: a copy stored for someone else is never returned, even for the same campaign and pack', async () => {
    await claimDevice(gm);
    // A copy under another person's id, somehow in the store: not this person's, so it doesn't serve.
    store.state.packs.set('x', { userId: 'someone-else', campaignId, packId: 'pack-mire', contentRev: 0, seenRev: 0, savedAt: '2026-11-01T00:00:00Z', entries: [{ packId: 'pack-mire', kind: 'item', packEntryId: 'forged', name: 'Forged', data: {} }] });
    const rows = await load();
    expect(rows?.entries.map((e) => e.packEntryId)).toEqual(['bog-lurker', 'reed-lantern']);
    expect(downloads).toEqual([['pack-mire']]);
  });

  it('signing in as someone else on the same device deletes the previous person’s copies before the first read', async () => {
    await load();
    expect(storedPackIds()).toEqual([`${gm}:pack-mire`]);
    expect(await deviceOwner()).toBe(gm);
    world.signInAs(player);
    forgetCampaignSetting();
    const rows = await load(player);
    // The player gets only what the database sends a player; nothing of the GM's copy is left or used.
    expect(rows?.entries.map((e) => e.packEntryId)).toEqual(['reed-lantern']);
    expect(storedPackIds()).toEqual([`${player}:pack-mire`]);
    expect(await deviceOwner()).toBe(player);
    expect(downloads).toEqual([['pack-mire'], ['pack-mire']]);
  });

  it('a download that completes after the signed-in person changed is not stored', async () => {
    let release = () => {};
    holdDownload = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loading = load();
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The GM signs out and a player signs in while the GM's download is still arriving.
    await releaseDevice();
    await claimDevice(player);
    release();
    const rows = await loading;
    expect(rows?.entries.length).toBe(2);
    expect(storedPackIds()).toEqual([]);
    expect(await deviceOwner()).toBe(player);
  });

  it('what is stored deep-equals what the database returned for that pack: nothing added, merged or worked out', async () => {
    await load();
    const sent = await loadCampaignEntries(world.db, campaignId, ['pack-mire']);
    const stored = [...store.state.packs.values()].find((p) => p.packId === 'pack-mire');
    expect(stored?.entries).toEqual(sent);
    expect(stored).toMatchObject({ userId: gm, campaignId, contentRev: 0, seenRev: 0 });
  });

  it('only the Dexie adapter imports Dexie, only the cache module loads the adapter, and only the reader stores', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readdirSync: (p: string, o: { recursive: true }) => string[]; readFileSync: (p: string, e: 'utf8') => string };
    const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
    const using = (pattern: RegExp) => files.filter((f) => pattern.test(fs.readFileSync(`src/${f}`, 'utf8'))).map((f) => f.replace(/\\/g, '/'));
    expect(using(/from 'dexie'/)).toEqual(['app/packCacheDexie.ts']);
    expect(using(/packCacheDexie\.ts'/)).toEqual(['app/packCache.ts']);
    expect(using(/\b(storePack|storeCampaign|storeCampaignExtras)\(/).sort()).toEqual(['app/campaignSetting.ts', 'app/packCache.ts']);
    expect(using(/\.(putPack|putCampaign)\(/)).toEqual(['app/packCache.ts']);
  });

  it('a device that refuses storage still gets the setting rules, from the download', async () => {
    store.broken = true;
    const rows = await load();
    expect(rows?.entries.length).toBe(2);
    expect(downloads).toEqual([['pack-mire']]);
  });
});

describe('condition 2: the copy drops when the packs change, the person changes, or the format changes', () => {
  it('a pack attached, then one detached, adds or drops only that pack’s copy; the other is not downloaded again', async () => {
    await load();
    addPack('pack-fen', 'Fen Rules', [{ id: 'eel-charm', kind: 'item', name: 'Eel charm' }]);
    forgetCampaignSetting(campaignId);
    const rows = await load();
    expect(rows?.entries.map((e) => e.packEntryId)).toEqual(['eel-charm', 'bog-lurker', 'reed-lantern']);
    expect(downloads).toEqual([['pack-mire'], ['pack-fen']]);
    expect(storedPackIds()).toEqual([`${gm}:pack-fen`, `${gm}:pack-mire`]);
    world.tables.campaign_packs.splice(world.tables.campaign_packs.findIndex((l) => l.pack_id === 'pack-mire'), 1);
    forgetCampaignSetting(campaignId);
    const after = await load();
    expect(after?.entries.map((e) => e.packEntryId)).toEqual(['eel-charm']);
    expect(storedPackIds()).toEqual([`${gm}:pack-fen`]);
    expect(downloads.length).toBe(2);
  });

  it('a pack whose content stamp moved is downloaded again; the others are not', async () => {
    addPack('pack-fen', 'Fen Rules', [{ id: 'eel-charm', kind: 'item', name: 'Eel charm' }]);
    await load();
    expect(downloads).toEqual([['pack-fen', 'pack-mire']]);
    pack('pack-fen').content_rev = 1;
    world.tables.library_entries.push({ id: 'e-pack-fen-reed-boat', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-boat', name: 'Reed boat', data: { id: 'reed-boat', name: 'Reed boat', category: 'gear' } });
    forgetCampaignSetting(campaignId);
    const rows = await load();
    expect(downloads).toEqual([['pack-fen', 'pack-mire'], ['pack-fen']]);
    expect(rows?.entries.map((e) => e.packEntryId)).toEqual(['eel-charm', 'reed-boat', 'bog-lurker', 'reed-lantern']);
    expect([...store.state.packs.values()].find((p) => p.packId === 'pack-fen')).toMatchObject({ contentRev: 1 });
  });

  it('a moved seen stamp (an item revealed, an exception changed) re-reads the campaign’s packs', async () => {
    await load();
    world.tables.campaign_rules_revs.push({ campaign_id: campaignId, seen_rev: 1 });
    forgetCampaignSetting(campaignId);
    await load();
    expect(downloads).toEqual([['pack-mire'], ['pack-mire']]);
    expect([...store.state.packs.values()][0]).toMatchObject({ seenRev: 1 });
  });

  it('coming back to the app checks the stamps and downloads nothing when nothing moved', async () => {
    await load();
    forgetCampaignSetting(campaignId);
    const rows = await load();
    expect(rows?.entries.length).toBe(2);
    expect(downloads).toEqual([['pack-mire']]);
  });

  it('sign-out deletes every stored copy, and the store belongs to nobody', async () => {
    await load();
    await releaseDevice();
    expect(storedPackIds()).toEqual([]);
    expect(store.state.campaigns.size).toBe(0);
    expect(await deviceOwner()).toBeNull();
  });

  it('a new cache format number deletes the old store on the next start', async () => {
    await load();
    store.state.owner = { userId: gm, format: CACHE_FORMAT - 1 };
    forgetCampaignSetting(campaignId);
    await load();
    expect(downloads).toEqual([['pack-mire'], ['pack-mire']]);
    expect(store.state.owner).toEqual({ userId: gm, format: CACHE_FORMAT });
  });

  it('a campaign no longer in Your campaigns loses its copies; beyond the most recent ones, the oldest goes', async () => {
    await load();
    await keepOnlyCampaigns(gm, ['another-campaign']);
    expect(storedPackIds()).toEqual([]);
    for (let i = 0; i <= CAMPAIGNS_KEPT; i += 1) {
      await storeCampaign({ userId: gm, campaignId: `campaign-${i}`, packs: [], seenRev: 0, savedAt: `2026-11-0${i + 1}T00:00:00Z` });
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const kept = [...store.state.campaigns.keys()].sort();
    expect(kept.length).toBe(CAMPAIGNS_KEPT);
    expect(kept).not.toContain(`${gm}|campaign-0`);
  });
});

describe('offline', () => {
  it('without a stored copy the read fails as today (the screen says it couldn’t load)', async () => {
    broken.add('campaign_packs');
    expect(await load()).toBeNull();
  });

  it('with a stored copy, a failed stamp check serves the copy, marked with when it was saved, and deletes nothing', async () => {
    await load();
    broken.add('campaign_packs').add('campaign_rules_revs');
    forgetCampaignSetting(campaignId);
    const rows = await load();
    expect(rows?.entries.map((e) => e.packEntryId)).toEqual(['bog-lurker', 'reed-lantern']);
    expect(rows?.packs.map((p) => p.packId)).toEqual(['pack-mire']);
    expect(typeof rows?.asOf).toBe('string');
    expect(storedPackIds()).toEqual([`${gm}:pack-mire`]);
    expect(downloads).toEqual([['pack-mire']]);
  });

  it('the setting rules build offline from the stored settings and calendar rows, and carry the date', async () => {
    const online = await loadCampaignSetting(world.db, gm, campaignId);
    expect(online?.asOf).toBeUndefined();
    await storeSettled();
    expect([...store.state.campaigns.values()][0]?.settings).not.toBeNull();
    for (const table of ['campaign_packs', 'campaign_rules_revs', 'campaigns']) broken.add(table);
    forgetCampaignSetting(campaignId);
    const offline = await loadCampaignSetting(world.db, gm, campaignId);
    expect(offline?.items.map((i) => i.packEntryId)).toEqual(['reed-lantern']);
    expect(typeof offline?.asOf).toBe('string');
  });

  it('the quiet line: where the rules are read, offline on a stored copy says "Setting rules as of <date>, offline"; online says nothing', async () => {
    await load();
    const user = (await loadCurrentUser(world.db)) as CurrentUser;
    const campaign = { id: campaignId, name: 'The Mire Road', role: 'gm' as const, sigilAssetId: null, playerCount: 1, outDay: false, activeNight: false };
    const rules = () =>
      createElement(ToastHost, null, createElement(CampaignLog, { db: world.db, user, campaignId, children: null }, createElement(CampaignRules, { db: world.db, campaign: campaign as never, backLabel: 'Back', onBack: () => {} })));
    render(rules());
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
    expect(screen.queryByText(/Setting rules as of/)).toBeNull();
    cleanup();
    broken.add('campaign_packs').add('campaign_rules_revs');
    forgetCampaignSetting(campaignId);
    render(rules());
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
    const saved = [...store.state.campaigns.values()][0]!.savedAt;
    expect(screen.getByRole('status').textContent).toBe(asOfWords(saved));
    expect(asOfWords('2026-11-07T10:00:00Z')).toMatch(/^Setting rules as of .*7, offline$/);
  });
});

// The on-device pack cache (performance report fix 2(b), docs/plans/perf-pack-cache.md; ruled 2026-11-07): each
// campaign's setting rules, stored on the device in IndexedDB (Dexie), per person and per pack, each copy stamped
// with the pack's content stamp and the campaign's seen stamp. The reading itself (which stamps are current, what to
// download, what to store) is `loadCampaignPacksAndEntries` in campaignSetting.ts; this file is the store and its
// rules about whose it is:
//   * one person's copies on a device at a time: the store remembers whose it is (`claimDevice`), and a different
//     person signing in deletes every copy before anything is read or written (hard rule 5: a GM's copy, with its
//     hidden fields, can never be read by a player on the GM's tablet);
//   * a copy is written only for the person the store belongs to at that moment (`storePack`): a download that
//     finishes after the person changed is thrown away;
//   * a new cache format (CACHE_FORMAT) deletes everything; so does sign-out (`releaseDevice`);
//   * a failed read or write (private browsing, storage full or refused, no IndexedDB) is ignored: the app runs on the
//     downloaded copy, as before the cache.
// Only packCacheDexie.ts imports Dexie, and only this file uses it (a source test pins both). Unit tests use
// `memoryPackStore` (src/testing).
import type { CalendarRow, CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { dexiePackStore } from './packCacheDexie.ts';

/**
 * The store's format. A new number deletes every stored copy on the next start (one re-download after that update).
 * 2: entries are read by campaign (`campaign_library`, hd-2): a copy stored under the older read could hold an item
 * another campaign had opened.
 */
export const CACHE_FORMAT = 2;
/** How many campaigns one person keeps on a device: beyond the most recently opened, the oldest go (chosen; rarely reached). */
export const CAMPAIGNS_KEPT = 5;

/** One campaign's small reads, as received: the packs list with its stamps, the settings and the calendar rows. */
export interface StoredCampaign {
  userId: string;
  campaignId: string;
  /** The packs list as the database gave this person, top of the stack first. */
  packs: CampaignPack[];
  seenRev: number;
  /** When the packs list was stored (ISO); what "Setting rules as of <date>" reads, offline. */
  savedAt: string;
  /** When the campaign was last opened on this device (ISO), for CAMPAIGNS_KEPT. */
  openedAt: string;
  /** The campaign's settings as read (null: not stored yet). */
  settings: Record<string, unknown> | null;
  /** The players' calendar rows as received (null: not stored yet; [] when the read returned none). */
  calendarRows: CalendarRow[] | null;
}

/** One pack's entries as the database sent this person, with the stamps they were read under. */
export interface StoredPack {
  userId: string;
  campaignId: string;
  packId: string;
  contentRev: number;
  seenRev: number;
  savedAt: string;
  entries: CampaignEntry[];
}

export interface Owner {
  userId: string;
  format: number;
}

/** The store, as the cache uses it. A Dexie adapter in the app; an in-memory one in unit tests. */
export interface PackStore {
  owner(): Promise<Owner | null>;
  setOwner(owner: Owner | null): Promise<void>;
  getCampaign(userId: string, campaignId: string): Promise<StoredCampaign | undefined>;
  putCampaign(record: StoredCampaign): Promise<void>;
  listCampaigns(userId: string): Promise<StoredCampaign[]>;
  listPacks(userId: string, campaignId: string): Promise<StoredPack[]>;
  putPack(record: StoredPack): Promise<void>;
  dropPack(userId: string, campaignId: string, packId: string): Promise<void>;
  dropCampaign(userId: string, campaignId: string): Promise<void>;
  dropAll(): Promise<void>;
}

/** A store that keeps nothing: where IndexedDB is missing or refused, the app runs on the downloaded copy. */
const noStore: PackStore = {
  owner: async () => null,
  setOwner: async () => undefined,
  getCampaign: async () => undefined,
  putCampaign: async () => undefined,
  listCampaigns: async () => [],
  listPacks: async () => [],
  putPack: async () => undefined,
  dropPack: async () => undefined,
  dropCampaign: async () => undefined,
  dropAll: async () => undefined,
};

let chosen: Promise<PackStore> | null = null;

/** The app's store, opened once; the no-store when the device has no IndexedDB or refuses it. */
function store(): Promise<PackStore> {
  if (!chosen) {
    // No run-time import here: creation's code must ask for no piece while picks are open (lazyScreen.test.tsx); the
    // adapter and Dexie come with the signed-in screens' code (App.tsx reaches this file lazily, so sign-in doesn't).
    chosen = typeof indexedDB === 'undefined' ? Promise.resolve(noStore) : dexiePackStore().catch(() => noStore);
  }
  return chosen;
}

/** Tests: use this store instead of the device's (null: the device's again). */
export function usePackStore(replacement: PackStore | null): void {
  chosen = replacement ? Promise.resolve(replacement) : null;
  chain = Promise.resolve();
}

// Every use of the store runs one after another, so a claim can't interleave with a write for the person before.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: (s: PackStore) => Promise<T>, fallback: T): Promise<T> {
  const next = chain.then(() => store().then(work)).catch(() => fallback);
  chain = next;
  return next;
}

/** Settles once every store write asked for so far is done (tests; the app never waits for a write). */
export function storeSettled(): Promise<void> {
  return chain.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * The store belongs to this person from now on: a different person's copies (or an older format's) are deleted
 * first. Called when someone signs in and before every read, so a shared tablet never serves one person another's.
 */
export function claimDevice(userId: string): Promise<void> {
  return serial(async (s) => {
    const owner = await s.owner();
    if (owner && owner.userId === userId && owner.format === CACHE_FORMAT) return;
    await s.dropAll();
    await s.setOwner({ userId, format: CACHE_FORMAT });
  }, undefined);
}

/** Sign-out: every stored copy goes, and the store belongs to nobody. */
export function releaseDevice(): Promise<void> {
  return serial(async (s) => {
    await s.dropAll();
    await s.setOwner(null);
  }, undefined);
}

/** Whose the store is right now (null: nobody's), for tests and the write guard. */
export function deviceOwner(): Promise<string | null> {
  return serial(async (s) => (await s.owner())?.userId ?? null, null);
}

/** This person's stored copy of a campaign's packs list and small reads, or undefined. */
export function readStoredCampaign(userId: string, campaignId: string): Promise<StoredCampaign | undefined> {
  return serial(async (s) => ((await s.owner())?.userId === userId ? s.getCampaign(userId, campaignId) : undefined), undefined);
}

/** This person's stored pack copies for a campaign (any stamps), or none. */
export function readStoredPacks(userId: string, campaignId: string): Promise<StoredPack[]> {
  return serial(async (s) => ((await s.owner())?.userId === userId ? s.listPacks(userId, campaignId) : []), []);
}

/**
 * Stores a pack's entries exactly as the database sent them, for the person the store belongs to. A download that
 * finished after someone else claimed the device (or after sign-out) is thrown away.
 */
export function storePack(record: StoredPack): Promise<void> {
  return serial(async (s) => {
    if ((await s.owner())?.userId !== record.userId) return;
    await s.putPack(record);
  }, undefined);
}

/**
 * Stores a campaign's packs list and seen stamp (and keeps its settings and calendar rows unless given), marks it
 * opened now, drops stored packs no longer attached, and keeps only the CAMPAIGNS_KEPT most recently opened.
 */
export function storeCampaign(
  record: Omit<StoredCampaign, 'openedAt' | 'settings' | 'calendarRows'> & Partial<Pick<StoredCampaign, 'settings' | 'calendarRows'>>,
): Promise<void> {
  return serial(async (s) => {
    if ((await s.owner())?.userId !== record.userId) return;
    const before = await s.getCampaign(record.userId, record.campaignId);
    const now = new Date().toISOString();
    await s.putCampaign({
      settings: before?.settings ?? null,
      calendarRows: before?.calendarRows ?? null,
      ...record,
      openedAt: now,
    });
    const attached = new Set(record.packs.map((p) => p.packId));
    for (const copy of await s.listPacks(record.userId, record.campaignId)) {
      if (!attached.has(copy.packId)) await s.dropPack(record.userId, record.campaignId, copy.packId);
    }
    const kept = (await s.listCampaigns(record.userId)).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    for (const old of kept.slice(CAMPAIGNS_KEPT)) await s.dropCampaign(record.userId, old.campaignId);
  }, undefined);
}

/** Stores a campaign's settings and calendar rows as read, beside its packs list (nothing without a packs list). */
export function storeCampaignExtras(userId: string, campaignId: string, extras: { settings: Record<string, unknown> | null; calendarRows: CalendarRow[] | null }): Promise<void> {
  return serial(async (s) => {
    if ((await s.owner())?.userId !== userId) return;
    const before = await s.getCampaign(userId, campaignId);
    if (!before) return;
    await s.putCampaign({ ...before, ...extras });
  }, undefined);
}

/** Your campaigns: a campaign no longer listed (left, removed, deleted) loses its stored copies. */
export function keepOnlyCampaigns(userId: string, campaignIds: readonly string[]): Promise<void> {
  const listed = new Set(campaignIds);
  return serial(async (s) => {
    if ((await s.owner())?.userId !== userId) return;
    for (const stored of await s.listCampaigns(userId)) if (!listed.has(stored.campaignId)) await s.dropCampaign(userId, stored.campaignId);
  }, undefined);
}

/** A stored campaign's copies go (tests and the eviction rules). */
export function dropStoredCampaign(userId: string, campaignId: string): Promise<void> {
  return serial(async (s) => {
    if ((await s.owner())?.userId !== userId) return;
    await s.dropCampaign(userId, campaignId);
  }, undefined);
}

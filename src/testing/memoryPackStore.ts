// An in-memory stand-in for the pack cache's store (src/app/packCache.ts), for unit tests: the same interface as the
// Dexie adapter, no IndexedDB. It also counts writes, so a test can say what was stored and what wasn't.
import type { Owner, PackStore, StoredCampaign, StoredPack } from '../app/packCache.ts';

export interface MemoryPackStore extends PackStore {
  /** What the store holds, for assertions. */
  state: { owner: Owner | null; campaigns: Map<string, StoredCampaign>; packs: Map<string, StoredPack> };
  /** How many pack copies were written. */
  packWrites: number;
  /** Set to make every call fail (a device that refuses storage). */
  broken: boolean;
}

const key = (...parts: string[]) => parts.join('|');
const copy = <T>(value: T): T => structuredClone(value);

export function memoryPackStore(): MemoryPackStore {
  const state: MemoryPackStore['state'] = { owner: null, campaigns: new Map(), packs: new Map() };
  const store: MemoryPackStore = {
    state,
    packWrites: 0,
    broken: false,
    owner: async () => {
      if (store.broken) throw new Error('storage refused');
      return state.owner ? { ...state.owner } : null;
    },
    setOwner: async (owner) => {
      if (store.broken) throw new Error('storage refused');
      state.owner = owner ? { ...owner } : null;
    },
    getCampaign: async (userId, campaignId) => {
      if (store.broken) throw new Error('storage refused');
      const found = state.campaigns.get(key(userId, campaignId));
      return found && copy(found);
    },
    putCampaign: async (record) => {
      if (store.broken) throw new Error('storage refused');
      state.campaigns.set(key(record.userId, record.campaignId), copy(record));
    },
    listCampaigns: async (userId) => {
      if (store.broken) throw new Error('storage refused');
      return [...state.campaigns.values()].filter((c) => c.userId === userId).map(copy);
    },
    listPacks: async (userId, campaignId) => {
      if (store.broken) throw new Error('storage refused');
      return [...state.packs.values()].filter((p) => p.userId === userId && p.campaignId === campaignId).map(copy);
    },
    putPack: async (record) => {
      if (store.broken) throw new Error('storage refused');
      store.packWrites += 1;
      state.packs.set(key(record.userId, record.campaignId, record.packId), copy(record));
    },
    dropPack: async (userId, campaignId, packId) => {
      if (store.broken) throw new Error('storage refused');
      state.packs.delete(key(userId, campaignId, packId));
    },
    dropCampaign: async (userId, campaignId) => {
      if (store.broken) throw new Error('storage refused');
      state.campaigns.delete(key(userId, campaignId));
      for (const [k, p] of state.packs) if (p.userId === userId && p.campaignId === campaignId) state.packs.delete(k);
    },
    dropAll: async () => {
      if (store.broken) throw new Error('storage refused');
      state.owner = null;
      state.campaigns.clear();
      state.packs.clear();
    },
  };
  return store;
}

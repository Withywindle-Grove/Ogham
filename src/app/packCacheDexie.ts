// The pack cache's store on the device: IndexedDB through Dexie (02, Local data). Reached only through packCache.ts,
// which the signed-in screens' code holds (App.tsx loads it lazily), so the sign-in screen never downloads Dexie.
// Three tables: whose the store is, each campaign's small reads, and each pack's entries, all keyed by person first.
import Dexie, { type Table } from 'dexie';
import type { Owner, PackStore, StoredCampaign, StoredPack } from './packCache.ts';

type OwnerRow = Owner & { id: 'device' };

type PackDb = Dexie & {
  owner: Table<OwnerRow, string>;
  campaigns: Table<StoredCampaign, [string, string]>;
  packs: Table<StoredPack, [string, string, string]>;
};

/** Opens the device's store (`grimoire-packs`). A schema change here is a new Dexie version that clears the tables. */
export async function dexiePackStore(): Promise<PackStore> {
  const db = new Dexie('grimoire-packs') as PackDb;
  db.version(1).stores({
    owner: 'id',
    campaigns: '[userId+campaignId], userId',
    packs: '[userId+campaignId+packId], [userId+campaignId]',
  });
  await db.open();
  return {
    owner: async () => {
      const row = await db.owner.get('device');
      return row ? { userId: row.userId, format: row.format } : null;
    },
    setOwner: async (owner) => {
      if (owner) await db.owner.put({ id: 'device', ...owner });
      else await db.owner.delete('device');
    },
    getCampaign: (userId, campaignId) => db.campaigns.get([userId, campaignId]),
    putCampaign: async (record) => {
      await db.campaigns.put(record);
    },
    listCampaigns: (userId) => db.campaigns.where('userId').equals(userId).toArray(),
    listPacks: (userId, campaignId) => db.packs.where('[userId+campaignId]').equals([userId, campaignId]).toArray(),
    putPack: async (record) => {
      await db.packs.put(record);
    },
    dropPack: (userId, campaignId, packId) => db.packs.delete([userId, campaignId, packId]),
    dropCampaign: async (userId, campaignId) => {
      await db.transaction('rw', db.campaigns, db.packs, async () => {
        await db.packs.where('[userId+campaignId]').equals([userId, campaignId]).delete();
        await db.campaigns.delete([userId, campaignId]);
      });
    },
    dropAll: async () => {
      await db.transaction('rw', db.owner, db.campaigns, db.packs, async () => {
        await db.packs.clear();
        await db.campaigns.clear();
        await db.owner.clear();
      });
    },
  };
}

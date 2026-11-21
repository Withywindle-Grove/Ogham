// Rulings of 2026-10-29 (supabase/migrations/20261029090000_m4b_rulings_fixes.sql). TEST project only; invented
// content.
//   A1. Items listed in a starting kit count as known to players (kits are player-readable), so they can show at
//       creation: in the kit's items or in a row of one of its rolls.
//   A4. The GM's exceptions (which setting rules win for an entry) are the GM's alone: a player can't read them,
//       nor one for an item they don't know; they get only the exceptions for entries they can read, so their
//       device picks the same winning version. The GM reads them all.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignPacks, preferEntry } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

const ITEMS = [
  { id: 'reed-rope', name: 'Reed rope', category: 'gear', weightCoin: 10 },
  { id: 'bog-charm', name: 'Bog charm', category: 'gear', weightCoin: 1, forSale: false },
  { id: 'glow-wand', name: 'Glow wand', category: 'magic-wand', weightCoin: 1 },
  { id: 'heron-cloak', name: 'Heron cloak', category: 'magic-cloak', weightCoin: 20 },
];
const KITS = [
  {
    id: 'kit-warden',
    name: 'Lantern Warden kit',
    items: [{ itemId: 'bog-charm', qty: 1 }],
    rolls: [{ name: 'Trinket', die: 'd6', rows: [{ min: 1, max: 3, items: [] }, { min: 4, max: 6, items: [{ itemId: 'glow-wand', qty: 1 }] }] }],
  },
];
function readPack(name: string, extra: Record<string, unknown> = {}) {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name, version: '1' }, items: ITEMS, ...extra }));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

let fenPack = '';
let riverPack = '';
const itemsSeenBy = async (person: Person, pack: string) =>
  must(await person.db.from('library_entries').select('pack_entry_id').eq('pack_id', pack).eq('kind', 'item'))
    .map((row) => row.pack_entry_id as string)
    .sort();
const exceptionsSeenBy = async (person: Person) => {
  const { data, error } = await person.db.rpc('campaign_exceptions', { campaign: world.campaignId });
  if (error) throw error;
  return Object.assign({}, ...(data as { overrides: Record<string, string> }[]).map((row) => row.overrides)) as Record<string, string>;
};

beforeAll(async () => {
  world = await buildWorld();
  for (const [name, extra] of [['Fen Goods', { startingKits: KITS }], ['River Goods', {}]] as const) {
    const made = await as(world.gm, importPack, { pack: readPack(name, extra) });
    if (!made.ok) throw new Error(made.message);
    if (name === 'Fen Goods') fenPack = made.value;
    else riverPack = made.value;
    const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
    if (!attached.ok) throw new Error(attached.message);
  }
}, 300_000);
afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('A1: items in a starting kit count as known', () => {
  it("a player reads the items a kit lists (its items and its rolls' rows), not other items that aren't for sale", async () => {
    // Bog charm (not for sale) is in the kit's items; Glow wand (magic) in a row of its roll; Heron cloak in neither.
    expect(await itemsSeenBy(world.playerA, fenPack)).toEqual(['bog-charm', 'glow-wand', 'reed-rope']);
    // The kit makes them known in the campaign, so the same items in another of its setting rules show too.
    expect(await itemsSeenBy(world.playerA, riverPack)).toEqual(['bog-charm', 'glow-wand', 'reed-rope']);
    expect(await itemsSeenBy(world.gm, fenPack)).toEqual(['bog-charm', 'glow-wand', 'heron-cloak', 'reed-rope']);
  });

  it("a kit in another campaign's setting rules doesn't make the item known here", async () => {
    must(await world.admin.from('members').insert({ campaign_id: world.otherCampaignId, user_id: world.outsider.id, base_role: 'player' }).select('user_id'));
    const attached = await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId: riverPack });
    if (!attached.ok) throw new Error(attached.message);
    expect(await itemsSeenBy(world.outsider, riverPack)).toEqual(['reed-rope']);
  });
});

describe("A4: the GM's exceptions are the GM's", () => {
  let riverLink = '';
  beforeAll(async () => {
    riverLink = must(await world.admin.from('campaign_packs').select('id').eq('campaign_id', world.campaignId).eq('pack_id', riverPack).single()).id as string;
    for (const [key, name] of [
      ['item:heron-cloak', 'Heron cloak'],
      ['item:reed-rope', 'Reed rope'],
    ]) {
      const chosen = await as(world.gm, preferEntry, { campaignId: world.campaignId, key: key!, name: name!, campaignPackId: riverLink });
      if (!chosen.ok) throw new Error(chosen.message);
    }
  }, 60_000);

  it("the GM reads every exception; a player can't read an exception for an item they don't know", async () => {
    expect(await exceptionsSeenBy(world.gm)).toEqual({ 'item:heron-cloak': 'Heron cloak', 'item:reed-rope': 'Reed rope' });
    // The player gets the exception for an item they can read (so their device shows the same winner), not the other.
    expect(await exceptionsSeenBy(world.playerA)).toEqual({ 'item:reed-rope': 'Reed rope' });
    expect(JSON.stringify(await exceptionsSeenBy(world.playerB))).not.toContain('Heron cloak');
    // Someone outside the campaign gets nothing.
    expect(await exceptionsSeenBy(world.newcomer)).toEqual({});
  });

  it("a player reads no exceptions from the tables themselves, nor the log lines that name them", async () => {
    expect(must(await world.playerA.db.from('campaign_pack_secrets').select('overrides').eq('campaign_id', world.campaignId))).toEqual([]);
    const links = must(await world.playerA.db.from('campaign_packs').select('overrides').eq('campaign_id', world.campaignId));
    expect(links.length).toBe(2);
    expect(links.every((link) => JSON.stringify(link.overrides) === '{}')).toBe(true);
    const logged = must(await world.playerA.db.from('events').select('after').eq('campaign_id', world.campaignId).eq('type', 'rules.prefer'));
    expect(JSON.stringify(logged)).not.toContain('Heron cloak');
    expect(must(await world.gm.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', 'rules.prefer')).length).toBeGreaterThan(0);
  });

  it("the readable column can't hold an exception: one written there is filed with the GM's", async () => {
    const fenLink = must(await world.admin.from('campaign_packs').select('id').eq('campaign_id', world.campaignId).eq('pack_id', fenPack).single()).id as string;
    must(await world.gm.db.from('campaign_packs').update({ overrides: { 'item:bog-charm': 'Bog charm' } }).eq('id', fenLink).select('id'));
    const link = must(await world.admin.from('campaign_packs').select('overrides').eq('id', fenLink).single());
    expect(link.overrides).toEqual({});
    const secret = must(await world.admin.from('campaign_pack_secrets').select('overrides').eq('id', fenLink).single());
    expect(secret.overrides).toEqual({ 'item:bog-charm': 'Bog charm' });
  });

  it("the app's view of the stack: the GM gets all exceptions, a player only theirs", async () => {
    const gmView = await loadCampaignPacks(asDb(world.gm), world.campaignId);
    const playerView = await loadCampaignPacks(asDb(world.playerA), world.campaignId);
    expect(gmView?.find((p) => p.id === riverLink)?.overrides).toEqual({ 'item:heron-cloak': 'Heron cloak', 'item:reed-rope': 'Reed rope' });
    expect(playerView?.find((p) => p.id === riverLink)?.overrides).toEqual({ 'item:reed-rope': 'Reed rope' });
  });
});

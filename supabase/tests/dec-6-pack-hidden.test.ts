// December step 6, row K27: hidden means hidden for the Pack tab (docs/plans/dec-6-the-whole-pack-tab.md, K27; hard rule
// 5; pu-9, pu-11). Tests on what the database sends, never on what a screen draws. TEST project only; invented names.
// Not run by the cloud session that wrote it (no database there): CI's database job runs it.
//
// Cases already covered elsewhere, not repeated here (named so a reader finds them):
//   1. Another living character's purse, to any player: dec-6a-purse-data.test.ts, "2. who reads a purse": "another
//      player reads nothing of it, by any way of asking" (and "someone outside the campaign reads no purse").
//   2. A purse line's amount, to anyone who can't read that purse: dec-6a-purse-data.test.ts, "7. who sees a purse's
//      log lines" (all three); dec-6b-purse-commands.test.ts, "2. hidden means hidden": "the line on the purse a gift
//      reached is its owner's, not the giver's".
//   3. A give refused to a giver who can't read the purse names no one (pu-11): dec-6b-purse-commands.test.ts, "a give
//      past the cap of a purse the giver can't read names no one…", and "a refusal to someone who can't touch a purse
//      says nothing of what it holds".
//   4. A player's Undo of their own give, refused once the receiver's purse has moved on (pu-11):
//      dec-6b-purse-commands.test.ts, "4. undo": "is refused once the coin has moved on since".
//   5. Another player can't undo someone else's give (a write rule): dec-6b-purse-commands.test.ts, "4. undo": "a player
//      undoes their own give to another player's character…" ("Someone else can't undo it", refused 42501).
//   6. A Down or dead character's purse: read while Down or dead, closed on recovery (dec-6a-purse-data.test.ts, "3. a
//      Down or dead character", all five); taken from while dead, closed once back in play (dec-6b-purse-commands.test.ts,
//      "6. a dead character", and "a player's take from a dead character goes back while it is still dead…").
//   9. A place's Treasure piece and its value: players read no piece row and scene_pieces sends a shown piece's kind and
//      words alone (m5b-place-pieces.test.ts, "a player gets only the shown pieces of their group's place…"); the
//      show and hide lines are the GM's ("the lines are the GM's alone…").
//
// Added here:
//   6. A Down (not dead) character's purse is open to another player's take while Down, and closed once recovered.
//      The pack half (taking from a Down or dead character's pack) is not built: a test to do, row K23.
//   9. A treasure piece's value never reaches a player by the roads not yet pinned: known_places_campaign (a shown
//      treasure) and the log line written when the piece is made.
//   7. Not built: a test to do, row K18.
//   8. An unidentified thing's truth reaches no player before the GM tells (row K22a, built: k22-reveal-hidden.test.ts
//      has the fuller set).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { loadGroupPlaces, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { addItem } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

type Coins = Record<string, number>;
type Answer = { error: { code?: string; message: string } | null };

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A tagged connection for this person, as the app's runCommand makes. */
const tagged = (person: Person, type: string) => taggedDb(person.db as unknown as Db, { type, level: 'simple', requestId: crypto.randomUUID() }) as unknown as Person['db'];
const coinsOf = async (actorId: string) => must(await world.admin.from('purses').select('coins').eq('actor_id', actorId).single()).coins as Coins;
const setCoins = async (actorId: string, coins: Coins) => must(await world.admin.from('purses').update({ coins }).eq('actor_id', actorId).select('id'));
const setActor = async (actorId: string, values: Record<string, unknown>) => must(await world.admin.from('actors').update(values).eq('id', actorId).select('id'));

/** An invented rules set attached to the world's campaign, saying where Down is; null detaches it. */
let rulesPack: string | null = null;
async function setRules(data: Record<string, unknown> | null) {
  if (rulesPack) {
    await world.admin.from('campaign_packs').delete().eq('campaign_id', world.campaignId).eq('pack_id', rulesPack);
    await world.admin.from('packs').delete().eq('id', rulesPack);
    rulesPack = null;
  }
  if (data === null) return;
  rulesPack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Bog rules', version: '0.1', kind: 'setting' }).select('id').single()).id as string;
  must(await world.admin.from('library_entries').insert({ pack_id: rulesPack, kind: 'rulesSet', pack_entry_id: 'bog-rules', name: 'Bog rules', data }).select('id'));
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: rulesPack, created_by: world.gm.id, option_choices: {} }).select('id'));
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await setRules(null);
  await tearDownWorld(world);
}, 60_000);
beforeEach(async () => {
  await setCoins(world.wrenId, { heron: 10 });
  await setCoins(world.ashId, {});
  await setActor(world.ashId, { status: 'active', hp_current: 5 });
});

describe('6. a Down or dead character (2026-10-29): the open half and the closing half', () => {
  afterAll(async () => {
    await setRules(null);
  });

  // Purpose: while a character is Down (at or under the setting's Down mark, not dead), another player may take from
  // its purse; once it recovers, the purse closes again and the take is refused.
  it("a Down character's purse is open to another player's take, and closed once it recovers", async () => {
    await setRules({ death: { at: 0 } });
    await setCoins(world.ashId, { heron: 9 });
    const take = (n: number) =>
      tagged(world.playerA, 'purse.take').rpc('purse_take', { campaign: world.campaignId, from_actor: world.ashId, from_location: null, to_actor: world.wrenId, coins: { heron: n } }) as unknown as Promise<Answer>;
    // Not Down yet: refused.
    expect((await take(1)).error?.code).toBe('42501');
    // Down (0 HP at a Down mark of 0): open.
    await setActor(world.ashId, { hp_current: 0 });
    expect((await take(4)).error).toBeNull();
    // Recovered: closed again.
    await setActor(world.ashId, { hp_current: 1 });
    expect((await take(1)).error?.code).toBe('42501');
    expect([await coinsOf(world.wrenId), await coinsOf(world.ashId)]).toEqual([{ heron: 14 }, { heron: 5 }]);
  });

  // The pack half is not built: may_change_carrier (20261023120000_m4_inventory.sql, unchanged since) lets a player
  // change only their own character's pack or the stash; nothing opens a Down or dead character's pack to the others
  // to take from. (Every member already reads an approved character's pack: inventory lines "read like the carrier".)
  it.todo("a Down or dead character's pack is open to the others to take from, every take logged, and closed once it recovers (row K23)");
});

describe("9. a place's Treasure piece and its value (pg-1, \"Value stays yours\")", () => {
  // Purpose: a treasure piece's value, the GM's alone, reaches no player: not through known_places_campaign once the
  // piece is shown, and not through the log line written when the piece is made; the GM's log line holds it.
  it("a shown treasure's value reaches no player by the places they know or the log", async () => {
    const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Sunken Tithe', created_by: world.gm.id }).select().single());
    const campaignId = campaign.id as string;
    must(
      await world.admin
        .from('members')
        .insert([
          { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
          { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
        ])
        .select(),
    );
    must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Reed the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select('id'));
    const gm = await userOf(world.gm);
    const trip = await ok(runCommand(registry, asDb(world.gm), gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Tithe Barn' }));
    const row = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    // Made as a pack's place makes it, its value the GM's (as m5b-place-pieces.test.ts makes one).
    const coffer = must(
      await world.admin
        .from('place_pieces')
        .insert({ campaign_id: campaignId, place_id: row.placeId, kind: 'treasure', body: 'A tarred coffer under the threshing floor', position: 1, gm_value: 'Ninety crowns and an eel-bone ring' })
        .select('id')
        .single(),
    ).id as string;
    await ok(runCommand(registry, asDb(world.gm), gm, showPiece, { campaignId, row, piece: { id: coffer } }));

    const secret = /Ninety crowns|eel-bone ring/;
    // The shown piece reaches the player as its words.
    const known = must(await world.playerA.db.rpc('known_places_campaign', { campaign: campaignId }));
    expect(JSON.stringify(known)).toContain('A tarred coffer under the threshing floor');
    expect(JSON.stringify(known)).not.toMatch(secret);
    // The same through scene_pieces: the coffer's words are there (so the call found the piece), its value isn't.
    const shown = JSON.stringify(must(await world.playerA.db.rpc('scene_pieces', { campaign: campaignId })));
    expect(shown).toContain('A tarred coffer under the threshing floor');
    expect(shown).not.toMatch(secret);
    // The log: the player's lines hold no value; the GM's line for the piece holds it (so the line was written).
    expect(JSON.stringify(must(await world.playerA.db.from('events').select('*').eq('campaign_id', campaignId)))).not.toMatch(secret);
    const gmLines = must(await world.gm.db.from('events').select('*').eq('campaign_id', campaignId).eq('target_table', 'place_pieces'));
    expect(JSON.stringify(gmLines)).toMatch(secret);
  }, 120_000);
});

describe('7. finds (not built yet)', () => {
  // Not built: the player's find card is row K18 (today a find is a log line only; a coin line on a character's purse
  // is its owner's and the GM's, dec-6a-purse-data.test.ts, "7. who sees a purse's log lines").
  it.todo("a find's card naming coin reaches no one but that character's player and the GM (row K18)");
});

describe('8. an unidentified thing (row K22a)', () => {
  // Purpose: an unidentified thing's true name, bonus or curse reaches no player before the GM tells: not on the line
  // (the database stores its face), not through the campaign's library, not by a plain select, not in the log. The
  // fuller set is k22-reveal-hidden.test.ts; this is the Pack tab's row of K27.
  it("an unidentified thing's true name, bonus or curse reaches no player before the GM tells", async () => {
    const gm = await userOf(world.gm);
    const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Mere rules', version: '0.1', kind: 'setting' }).select('id').single()).id as string;
    must(
      await world.admin
        .from('library_entries')
        .insert([
          { pack_id: pack, kind: 'rulesSet', pack_entry_id: 'mere-rules', name: 'Mere rules', data: { itemCategories: [{ id: 'charm', name: 'Charms', singular: 'Charm', unidentified: true }] } },
          { pack_id: pack, kind: 'item', pack_entry_id: 'eel-charm', name: 'Charm of the Eel King', data: { category: 'charm', appearsAs: 'Knotted cord', bonus: 'Breathe under water', cursed: true, gmOnly: ['bonus', 'cursed'] } },
        ])
        .select('id'),
    );
    must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: pack, created_by: world.gm.id, option_choices: {} }).select('id'));
    const entry = must(await world.admin.from('library_entries').select('id').eq('pack_id', pack).eq('pack_entry_id', 'eel-charm').single()).id as string;
    try {
      const carrier = { campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false };
      const line = await ok(runCommand(registry, asDb(world.gm), gm, addItem, { carrier, item: { libraryEntryId: entry, name: 'x', category: 'x', weightCoin: null, slots: null, stack: 1 }, qty: 1, howGot: 'given' }));
      expect(line).toMatchObject({ name: 'Knotted cord', identified: false });
      const secret = /Eel King|Breathe under water|cursed/;
      for (const player of [world.playerA, world.playerB]) {
        expect(JSON.stringify(must(await player.db.from('inventory_lines').select('*').eq('id', line.id)))).not.toMatch(secret);
        expect(JSON.stringify(must(await player.db.rpc('campaign_library', { campaign: world.campaignId, packs: [pack] })))).not.toMatch(secret);
        expect(must(await player.db.from('library_entries').select('id').eq('id', entry))).toEqual([]);
        expect(JSON.stringify(must(await player.db.from('events').select('*').eq('campaign_id', world.campaignId)))).not.toMatch(secret);
      }
    } finally {
      await world.admin.from('inventory_lines').delete().eq('source_pack_id', pack);
      await world.admin.from('campaign_packs').delete().eq('pack_id', pack);
      await world.admin.from('packs').delete().eq('id', pack);
    }
  }, 120_000);
});

// The map's eye (dec-7 piece 5m-3, built with the whole Scene's S13; supabase/migrations/20261115100000_dec_7_5m_3_map_eye.sql;
// plan docs/plans/dec-7-5-place-page-and-map.md; docs/03, hidden means hidden). TEST project only.
//   Purpose, in plain words:
//   1. Shown: once the GM shares the map, a player of the campaign reads the copy's row and gets a link to its file;
//      an outsider still reads nothing. Hidden again: the player reads nothing of it again.
//   2. Undo of the share puts the copy back to the GM's alone.
//   3. A player can't share it, through the command or straight at the database.
//   4. The share is the GM's log line, named by the database (public.logged_commands knows place.shareMap); a player
//      doesn't read it.
//   5. Today's reach, pinned: a member whose group is at another place reads a shared map too (row and file).
//   6. A GM naming another campaign of theirs can't share this campaign's map (the write is tied to the campaign named).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { assetPath, FILES_BUCKET, forgetFileLinks } from '../../src/core/files.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPlaceMap, setPlaceMap, shareMap } from '../../src/modules/expedition/placeMap.ts';
import { loadGroupPlaces, setPlace } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign with a player, an expedition under way at the Salt Steps, and the GM's map of it, tied, hidden. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Marches', created_by: world.gm.id }).select().single());
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
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Salt Steps' }));
  const place = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!.place!;
  const assetId = await ok(as(world.gm, addPlaceMap, { campaignId, place, title: 'The Salt Steps, a sketch', image: new Blob(['a sketch of steps'], { type: 'image/png' }) }));
  await ok(as(world.gm, setPlaceMap, { campaignId, place, assetId }));
  return { campaignId, assetId };
}

/** What this person reads of the copy: its row, and a link to its file. */
async function reads(person: Person, campaignId: string, assetId: string) {
  forgetFileLinks();
  const row = must(await person.db.from('assets').select('id').eq('id', assetId));
  const link = await person.db.storage.from(FILES_BUCKET).createSignedUrls([assetPath(campaignId, assetId)], 60);
  const file = (link.data ?? []).some((l) => !!l.signedUrl && !l.error);
  return { row: row.length === 1, file };
}
const nothing = { row: false, file: false };
const everything = { row: true, file: true };
const visibilityOf = async (assetId: string) => must(await world.admin.from('assets').select('visibility').eq('id', assetId).single()).visibility as string;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("the map's eye (dec-7 5m-3)", () => {
  it('1. shown, a player reads the copy and its file, an outsider nothing; hidden again, the player nothing', async () => {
    const t = await freshTable();
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
    await ok(as(world.gm, shareMap, { campaignId: t.campaignId, assetId: t.assetId, shown: true }));
    expect(await visibilityOf(t.assetId)).toBe('all');
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(everything);
    expect(await reads(world.outsider, t.campaignId, t.assetId)).toEqual(nothing);
    await ok(as(world.gm, shareMap, { campaignId: t.campaignId, assetId: t.assetId, shown: false }));
    expect(await visibilityOf(t.assetId)).toBe('gm');
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
  });

  it('2. Undo of the share puts the copy back to the GM alone', async () => {
    const t = await freshTable();
    await ok(as(world.gm, shareMap, { campaignId: t.campaignId, assetId: t.assetId, shown: true }));
    const line = must(await world.admin.from('events').select('id').eq('type', 'place.shareMap').eq('target_id', t.assetId).order('seq', { ascending: false }).limit(1).single()).id as string;
    const undone = await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: line, authorUserId: world.gm.id });
    expect(undone.ok, undone.ok ? '' : undone.message).toBe(true);
    expect(await visibilityOf(t.assetId)).toBe('gm');
    expect(await reads(world.playerA, t.campaignId, t.assetId)).toEqual(nothing);
  });

  it("3. a player can't share it, through the command or straight at the database", async () => {
    const t = await freshTable();
    const shared = await as(world.playerA, shareMap, { campaignId: t.campaignId, assetId: t.assetId, shown: true });
    expect(shared.ok).toBe(false);
    await world.playerA.db.from('assets').update({ visibility: 'all' }).eq('id', t.assetId).select('id');
    expect(await visibilityOf(t.assetId)).toBe('gm');
  });

  it("4. the share is the GM's log line, named place.shareMap", async () => {
    const t = await freshTable();
    await ok(as(world.gm, shareMap, { campaignId: t.campaignId, assetId: t.assetId, shown: true }));
    const line = must(await world.admin.from('events').select('type, target_table, audience').eq('target_id', t.assetId).eq('type', 'place.shareMap'));
    expect(line).toEqual([{ type: 'place.shareMap', target_table: 'assets', audience: 'gm' }]);
    expect(must(await world.playerA.db.from('events').select('id').eq('target_id', t.assetId).eq('type', 'place.shareMap'))).toEqual([]);
  });

  // Today's behaviour, pinned so a later change is deliberate (the lead, 2026-11-14): a share reaches every member,
  // so a player whose group is at another place reads the shared map's row and file too (the assets' read rule as it
  // stands; their own Scene shows only their own place's map). Sharing to one group only is Francis's to rule, after
  // 5 December.
  it('5. a member in another group, at another place, reads a shared map (row and file)', async () => {
    const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Marches', created_by: world.gm.id }).select().single());
    const campaignId = campaign.id as string;
    must(
      await world.admin
        .from('members')
        .insert([
          { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
          { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
          { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
        ])
        .select(),
    );
    const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
    const made = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select());
    const moss = toCharacterRef(made.find((row) => row.name === 'Moss of the Bog Lights') as Parameters<typeof toCharacterRef>[0]);
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Salt Steps' }));
    const group = await ok(as(world.gm, chooseGroup, { character: moss, group: null }));
    expect(group).not.toBe(1);
    await ok(as(world.gm, setPlace, { campaignId, group, name: 'The Heron Weir' }));
    const places = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!;
    const steps = places.get(1)!.place!;
    expect(places.get(group)!.place!.name).toBe('The Heron Weir');
    const assetId = await ok(as(world.gm, addPlaceMap, { campaignId, place: steps, title: 'The Salt Steps, a sketch', image: new Blob(['a sketch of steps'], { type: 'image/png' }) }));
    await ok(as(world.gm, setPlaceMap, { campaignId, place: steps, assetId }));
    expect(await reads(world.playerB, campaignId, assetId)).toEqual(nothing);
    await ok(as(world.gm, shareMap, { campaignId, assetId, shown: true }));
    expect(await reads(world.playerB, campaignId, assetId)).toEqual(everything);
  });

  // #851's review: naming another campaign of the GM's, where the GM's check passes, doesn't reach this campaign's
  // map: the write is tied to the campaign named, so it matches no row.
  it("6. a GM can't share a map of one campaign by naming another of theirs", async () => {
    const t = await freshTable();
    const other = must(await world.admin.from('campaigns').insert({ name: 'The Salt Flats', created_by: world.gm.id }).select().single()).id as string;
    must(await world.admin.from('members').insert({ campaign_id: other, user_id: world.gm.id, base_role: 'gm' }).select());
    const shared = await as(world.gm, shareMap, { campaignId: other, assetId: t.assetId, shown: true });
    expect(shared.ok).toBe(false);
    expect(await visibilityOf(t.assetId)).toBe('gm');
  });
});

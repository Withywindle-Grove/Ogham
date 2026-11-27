// Row P14 of docs/plans/dec-9-the-players-scene.md: hidden means hidden for the players' Scene, tested on what the
// DATABASE sends a player, never on what a screen draws (hard rule 5; brief docs/plans/briefs/dec-9-p14-hidden-tests-
// cloud-brief.md). TEST project or CI's local database; invented packs, places and words only.
//
// Most of the plan's table is already proved by earlier tests; those are named in docs/status/2026-11-14-dec-9-p14-
// hidden-tests.md and not repeated here. This file holds only what nothing proved yet:
//   * a link's obstacle (`barrier`: its name, extra time, need for approval, the place it passes and its note) never
//     reaches a player through the ways read, the log or the library, in the group, in another group or outside the
//     campaign; nor the route's pack id or type, nor the passed place's name, check table or note, as far as the ways
//     read and the log go (encounter_check_for_players and place_rules_for_players are not asked here; dec-7-3 tests
//     them) (mc-28a, dp-5; 07 "barrier");
//   * a monster's hit points never reach a player or an outsider, as a row or as a log line (hard rule 5);
//   * a test to do for each case whose read or command isn't built yet, naming the row that builds it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { placeFromPack, type PackPlaceEntry } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadWaysOn } from '../../src/modules/library/waysOn.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let campaign = '';
let adventure = '';
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

const OBSTACLE_NAME = 'The sunken chain';
const OBSTACLE_NOTE = 'A rusted chain lies across the channel; a boat grounds on it unless poled over';
const MILL_GM_NAME = 'The drowned miller’s house';
const WEIR_NAME = 'The weir’s throat';
const WEIR_NOTE = 'The pike-mother nests under the sluice gate';

/** An invented adventure: a landing, a mill across the channel, and the weir the crossing passes. */
const weirPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Weir Hollow', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'wh-landing', name: 'The landing', type: 'area', playerView: { text: 'Mooring posts lean over brown water.' } },
        { id: 'wh-mill', name: MILL_GM_NAME, type: 'area', playerView: { name: 'A mill', text: 'A wheel turns with nothing to grind.' } },
        { id: 'wh-weir', name: WEIR_NAME, type: 'area', encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1, 2] }, tableId: 'weir-things', note: WEIR_NOTE } },
      ],
      routes: [{ id: 'wh-route-landing-mill', from: 'wh-landing', to: 'wh-mill', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 2, unit: 'turn' }] }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

/** Words and ids no player may receive about the crossing: the obstacle whole, the route's pack ids and type, the weir. */
const NEVER_SENT = [OBSTACLE_NAME, OBSTACLE_NOTE, 'barrier', 'extraTurns', 'needsApproval', 'through', 'wh-', 'river', MILL_GM_NAME, WEIR_NAME, WEIR_NOTE, 'weir-things'];

const ways = async (person: Person) => {
  const read = await person.db.rpc('campaign_ways_on', { campaign });
  return (read.data ?? []) as { group_number: number; route_id: string; to_place_id: string | null; to_name: string | null; ways: unknown }[];
};
const logOf = async (person: Person) => JSON.stringify(must(await person.db.from('events').select('type, before, after, reason').eq('campaign_id', campaign)));
const routeRowId = async () =>
  must(await world.admin.from('library_entries').select('id').eq('pack_id', adventure).eq('kind', 'route').eq('pack_entry_id', 'wh-route-landing-mill').single()).id as string;
const locationOf = async (entryId: string): Promise<PackPlaceEntry> => {
  const found = ((await loadCampaignEntries(asDb(world.gm), campaign)) ?? []).find((e) => e.kind === 'location' && e.packId === adventure && e.packEntryId === entryId);
  if (!found) throw new Error(`no location ${entryId}`);
  return found;
};

beforeAll(async () => {
  world = await buildWorld();
  campaign = world.campaignId;
  adventure = await ok(as(world.gm, importPack, { pack: weirPack() }));
  await ok(as(world.gm, attachPack, { campaignId: campaign, packId: adventure }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe("a link's obstacle never reaches a player (mc-28a, dp-5; plan P14, rows 3 and 4)", () => {
  // Purpose: once the landing is shown, a player in the group gets the way across as "Rowing, 2 turns" and nothing
  // more: not the obstacle's name (that comes only after the GM's No, P3b), its note, its extra time, its need for
  // approval or the place it passes; not the route's pack id or type; not the passed place's name, check, table or
  // note. A player in another group and an outsider get no way at all. Neither the log nor the library gives a player
  // any of it, while the GM still reads the obstacle whole on the route.
  it('sends the way and its time alone, to the group only; the obstacle stays the GM’s', async () => {
    // The obstacle, written on the route's row as 07 describes it (the importer isn't what is tested).
    const routeId = await routeRowId();
    must(
      await world.gm.db
        .from('library_entries')
        .update({
          data: {
            from: 'wh-landing', to: 'wh-mill', type: 'river', hidden: false, oneWay: false,
            travel: [{ by: 'row', name: 'Rowing', value: 2, unit: 'turn' }],
            barrier: { name: OBSTACLE_NAME, extraTurns: 3, needsApproval: true, through: 'wh-weir', note: OBSTACLE_NOTE },
          },
        })
        .eq('id', routeId)
        .select('id'),
    );
    const landing = await ok(as(world.gm, placeFromPack, { campaignId: campaign, entry: await locationOf('wh-landing') }));
    await ok(as(world.gm, placeFromPack, { campaignId: campaign, entry: await locationOf('wh-mill') }));
    await ok(as(world.gm, placeFromPack, { campaignId: campaign, entry: await locationOf('wh-weir') }));
    const trip = await ok(as(world.gm, startExpedition, { campaignId: campaign, mode: 'dungeon', placeId: landing.id }));
    // Player B's character goes to a group of its own, which is shown nothing.
    await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId: campaign, ownerUserId: world.playerB.id }, group: null }));
    const visit = (await loadGroupPlaces(asDb(world.gm), campaign, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId: campaign, row: visit, piece: visit.pieces[0]! }));

    // The player in the group: one way, its four fields, and none of the obstacle.
    const rows = await ways(world.playerA);
    expect(rows.map((r) => r.route_id)).toEqual([routeId]);
    expect(Object.keys(rows[0]!).sort()).toEqual(['elsewhere', 'group_number', 'route_id', 'to_area_name', 'to_name', 'to_number', 'to_place_id', 'ways']);
    expect(rows[0]!.ways).toEqual([{ by: 'row', name: 'Rowing', value: 2, unit: 'turn' }]);
    expect(rows[0]).toMatchObject({ to_place_id: null, to_name: null });
    const raw = JSON.stringify(rows) + JSON.stringify(await loadWaysOn(asDb(world.playerA), campaign));
    for (const word of NEVER_SENT) expect(raw, word).not.toContain(word);
    // The extra time is a number, so no word above catches it: no field but the way's own value (2) may carry one.
    // Kept (review nit 4): a narrow check, it fails only if a 3 is sent as a JSON value.
    expect(raw).not.toMatch(/:3[,}]/);

    // Another group, and someone outside the campaign: no way at all.
    expect(await ways(world.playerB)).toEqual([]);
    expect(await ways(world.outsider)).toEqual([]);

    // Nor through the log or the library, for either player; an outsider reads no line of the campaign.
    for (const player of [world.playerA, world.playerB]) {
      const log = await logOf(player);
      for (const word of [OBSTACLE_NAME, OBSTACLE_NOTE, 'barrier', 'extraTurns', 'wh-route', WEIR_NOTE, 'weir-things']) expect(log, word).not.toContain(word);
      expect(must(await player.db.from('library_entries').select('id').eq('pack_id', adventure).eq('kind', 'route'))).toEqual([]);
      expect(must(await player.db.from('library_entry_secrets').select('id').eq('pack_id', adventure))).toEqual([]);
    }
    expect(must(await world.outsider.db.from('events').select('id').eq('campaign_id', campaign))).toEqual([]);

    // The GM still reads the obstacle whole on the route.
    const entries = (await loadCampaignEntries(asDb(world.gm), campaign)) ?? [];
    expect(JSON.stringify(entries.find((e) => e.packId === adventure && e.packEntryId === 'wh-route-landing-mill')?.data)).toContain(OBSTACLE_NOTE);
  });

  it.todo("an obstacle's name reaches the group's players only after the GM's No, and never its note, time or chance (dp-5): the record of an obstacle met is P3b's, not built");
});

describe('a monster’s hit points never reach a player (hard rule 5; plan P14, row 13)', () => {
  // Purpose: a monster's hit points live only in actor_secrets. Set and then changed by the GM, they reach no player
  // (in the group or another) and no outsider, neither as the row nor as a line of the log; the monster's own row,
  // which players may read, carries none. The GM reads both.
  it('stay the GM’s, as a row and as a log line', async () => {
    const monster = must(
      await world.gm.db.from('actors').insert({ campaign_id: campaign, kind: 'monster', name: 'Bog lurker', owner_type: 'gm', approval: 'approved' }).select('id').single(),
    ).id as string;
    must(await world.gm.db.from('actor_secrets').insert({ actor_id: monster, hp_current: 17, hp_max: 19 }).select('actor_id'));
    must(await world.gm.db.from('actor_secrets').update({ hp_current: 7 }).eq('actor_id', monster).select('actor_id'));

    for (const person of [world.playerA, world.playerB, world.outsider]) {
      expect(must(await person.db.from('actor_secrets').select('actor_id').eq('actor_id', monster))).toEqual([]);
      const lines = must(await person.db.from('events').select('target_table, target_id, before, after').eq('campaign_id', campaign));
      expect(lines.filter((l) => l.target_table === 'actor_secrets')).toEqual([]);
      // The monster's own row and its lines carry no hit points. These checks can't fail today: the actors table's own
      // check forbids a monster's hit points there (`kind <> 'monster' or (hp_current is null and hp_max is null)`,
      // 20261019120000_m1_core_tables.sql). The real guards are the two above: no actor_secrets row and no
      // actor_secrets line reach this person. These stay as a tripwire should that check ever be dropped.
      for (const line of lines.filter((l) => l.target_id === monster)) {
        for (const side of [line.before, line.after] as (Record<string, unknown> | null)[]) {
          expect(side?.hp_current ?? null).toBeNull();
          expect(side?.hp_max ?? null).toBeNull();
        }
      }
      const row = must(await person.db.from('actors').select('hp_current, hp_max').eq('id', monster));
      expect(row.every((r) => r.hp_current === null && r.hp_max === null)).toBe(true);
    }

    // The GM reads the row and both its lines.
    expect(must(await world.gm.db.from('actor_secrets').select('hp_current, hp_max').eq('actor_id', monster))).toEqual([{ hp_current: 7, hp_max: 19 }]);
    const gmLines = must(await world.gm.db.from('events').select('target_table, after').eq('campaign_id', campaign).eq('target_table', 'actor_secrets'));
    expect(gmLines.length).toBeGreaterThanOrEqual(2);
  });
});

describe('cases whose read or command is not built yet (plan P14)', () => {
  it.todo("a hidden way out never makes Leave the dungeon's 'leave at once' appear, and nothing sent to players names it (st-9): Leave the dungeon is S11 of docs/plans/dec-9-the-whole-scene.md, not built");
  it.todo("the session line names the region only once it is shown to the group (st-7): the players' top is S1 and S15 of docs/plans/dec-9-the-whole-scene.md, not built (an unshown parent place's name is already never sent: dec-7-3-place-check-and-rules)");
  it.todo("a place's book text for the GM never reaches a player (gt-1): its read is S14 of docs/plans/dec-9-the-whole-scene.md, not built (a pack location's GM notes are already never sent: m8b-0-places-from-packs)");
  it.todo("a given rumour's words reach only its hearers, never its truth or note (rm-1, mc-65): give_rumour is dec-12 E, not on main");
  it.todo("a map, and the pack's map entries, reach players once the GM shares it and not before (mc-37, mc-44a): the share is 5m-3 of docs/plans/dec-7-5-place-page-and-map.md, not built (before any share: dec-7-5m-1-map-kind, dec-7-5m-2-place-map)");
  it.todo("another character's hit points never reach a player when the campaign hides them (mo-2): the database doesn't keep this yet; until M6 they are hidden on the screen only");
  it.todo("the players' top (S15) sends no GM reminder and no secret check result: S15 of docs/plans/dec-9-the-whole-scene.md, not built (the reminders' own reads: m5-reminders)");
});

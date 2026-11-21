// December dec-7 piece 3: a place's own check, and a place's rules open to players (supabase/migrations/
// 20261113120000_dec_7_3_place_check_and_rules.sql; docs/plans/dec-7-linked-spots-screens.md; rulings rg-4, rg-5,
// pf-12b, mc-39b, mc-51, pf-12d). TEST project only; invented packs, places and words. What it checks, in plain words:
//   * hidden means hidden: before the spot is shown, a player reads no rule and no place check; once it is shown, they
//     read the open rules of the spot and of the place it sits in, with link marks as plain labels, and never a rule
//     the pack keeps for the GM (not its name, not its words), nor any of the GM's switches;
//   * a place the party sits in but was never shown (the harbour, from the jetty): its rules and check come under the
//     shown place's name, and its own name and id are never sent; once the harbour has been shown, its name may come
//     (the lead's ruling on ⚑ b, 2026-11-13);
//   * the GM's eye: closing a rule takes it from the player's read at once; Undo brings it back; opening the GM's own
//     rule lets it through; each change is one line in the log, the GM's alone;
//   * the place's check: once shown, a player reads when it is rolled and its chance, never its table or its note;
//     the GM's toggle off gives them none (the setting's holds), and Undo puts it back; a place's check that doesn't
//     say it replaces the setting's gives none;
//   * only the GM sets a switch; only on a location of a pack attached to the campaign; only for a rule the place has
//     (or a place with its own check); never to open a rule the pack keeps for the GM; and a switch's row can change
//     only its value (and Undo's mark);
//   * a link mark with no label reaches the player as its id's words, never the id (rp-5);
//   * every link mark reaches a player as words, never its id, whatever its label holds (a quote, a backslash, a pipe,
//     a bracket, a newline, a non-Latin letter, an emoji, an apostrophe), two on one line, a target with two colons,
//     in a table cell and a list item, in a rule's name and button too; a mark split across two blocks stays text with
//     its id dropped (review of #726, 20261113200000_players_never_get_link_ids.sql);
//   * a player in another group reads nothing of group 1's rules;
//   * a mark typed by hand into a piece (+ Piece, Edit piece) or held in a lead reaches the player as its label only
//     (scene_pieces, known_places_campaign), while the GM reads it as typed; a pack's piece is unchanged;
//   * an object button (pf-12e, dec-7 piece 2) passes the real link-mark strip as JSON text: a quote and a backslash in a
//     label read back whole; an unclosed mark at the end of its words gives the player no button.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { addPiece, editPiece, loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { loadPlayersCheck, loadPlayersRules, setCheckInForce, setRuleEye } from '../../src/modules/expedition/placeRules.ts';
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
const undoLatest = async (type: string) => {
  const eventId = await latestChange(asDb(world.gm), campaignId, type, world.gm.id);
  if (!eventId) throw new Error(`no ${type} line`);
  await ok(as(world.gm, undoChange, { campaignId, eventId, authorUserId: world.gm.id }));
};

/** An invented adventure: a harbour with its own check on each move and three rules, and a jetty inside it. */
const reedPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The Reed Marches', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'saltwick-island', name: 'Saltwick Island', type: 'region', encounterCheck: { every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, tableId: 'island-things' } },
        {
          id: 'drowned-harbour',
          name: 'The Drowned Harbour',
          type: 'region',
          playerView: { text: 'A silted harbour of five spots.' },
          parentId: 'saltwick-island',
          encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, tableId: 'harbour-things', note: 'The eel-mother wakes on a 1.' },
          rules: [
            {
              id: 'falling-in',
              name: 'Falling into the harbour',
              button: 'Someone fell in',
              text: { blocks: [{ p: 'Cold at once. See [[rule:rowing|Rowing and swimming]].' }, { p: 'Roll on [[table:harbour-things]] near [[place:reed-marches:drowned-harbour]].' }] },
            },
            { id: 'rowing', name: 'Rowing and swimming', text: 'A boat crosses in a turn; a swimmer takes three.' },
            { id: 'tidewife-bargain', name: 'The Tidewife bargain', gmOnly: true, text: 'She asks for a name, given freely.' },
          ],
        },
        { id: 'the-jetty', name: '1 The jetty', type: 'site', parentId: 'drowned-harbour', playerView: { text: 'Black piles and a mooring ring.' } },
        { id: 'the-shingle', name: 'The shingle', type: 'site', parentId: 'saltwick-island', playerView: { text: 'Grey stones that shift underfoot.' } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

let packId = '';
let campaignId = '';

beforeAll(async () => {
  world = await buildWorld();
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Marches', created_by: world.gm.id }).select().single());
  campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Wren the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select());
  packId = await ok(as(world.gm, importPack, { pack: reedPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const entryOf = async (id: string) => {
  const entries = (await loadCampaignEntries(asDb(world.gm), campaignId)) ?? [];
  const found = entries.find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === id);
  if (!found) throw new Error(`no ${id}`);
  return { packId, packEntryId: id, name: found.name, data: found.data as Record<string, unknown> };
};
const readAll = async () => JSON.stringify([must(await world.playerA.db.rpc('place_rules_for_players', { campaign: campaignId })), must(await world.playerA.db.rpc('encounter_check_for_players', { campaign: campaignId }))]);

describe("a place's rules and its check, as a player reads them", () => {
  it('reach a player only once the spot is shown, only the open ones, and the GM switches them at once with Undo', async () => {
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('the-jetty') }));

    // Not shown yet: nothing of the harbour's rules or its check reaches the player.
    expect(await loadPlayersRules(asDb(world.playerA), campaignId)).toEqual([]);
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([]);
    expect(await readAll()).not.toContain('Falling');

    // The GM shows the jetty: the open rules of the jetty and of the harbour it sits in, in the pack's order.
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
    const rules = await loadPlayersRules(asDb(world.playerA), campaignId);
    expect(rules?.map((r) => [r.placeName, r.name, r.button])).toEqual([
      ['1 The jetty', 'Falling into the harbour', 'Someone fell in'],
      ['1 The jetty', 'Rowing and swimming', null],
    ]);
    // A link mark reaches the player as its label, or its id's words when it has none: never the id (rp-5).
    expect(rules?.[0]?.blocks).toEqual([
      { kind: 'p', lead: '', text: 'Cold at once. See Rowing and swimming.' },
      { kind: 'p', lead: '', text: 'Roll on harbour things near drowned harbour.' },
    ]);
    // Hidden means hidden: the GM's own rule, not its name nor its words; no switch rows; no table or note of the check.
    const everything = await readAll();
    // The harbour was never shown to the party: its rules and its check come under the jetty's name, and neither the
    // harbour's name nor its id leaves the database (⚑ b, ruled by the lead 2026-11-13).
    for (const secret of ['Tidewife', 'given freely', 'harbour-things', 'eel-mother', 'Drowned Harbour', 'drowned-harbour', 'falling-in']) expect(everything).not.toContain(secret);
    expect(everything).not.toMatch(/\[\[[A-Za-z]+:/);
    expect(must(await world.playerA.db.from('place_rule_switches').select('id'))).toEqual([]);

    // The check in force: on every move, 1 in 6.
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([{ group: 1, placeName: '1 The jetty', eachMove: true, every: null, chance: { die: 'd6', on: [1] } }]);

    // The GM closes a rule: gone from the player's read at once; Undo brings it back.
    await ok(as(world.gm, setRuleEye, { campaignId, packId, entryId: 'drowned-harbour', ruleId: 'rowing', open: false }));
    expect((await loadPlayersRules(asDb(world.playerA), campaignId))?.map((r) => r.name)).toEqual(['Falling into the harbour']);
    await undoLatest('placeRule.eye');
    expect((await loadPlayersRules(asDb(world.playerA), campaignId))?.map((r) => r.name)).toEqual(['Falling into the harbour', 'Rowing and swimming']);

    // The book's GM-only rule can't be opened (rp-3): the command and the database refuse, and the player never gets it,
    // not even if a switch row said open.
    const opened = await as(world.gm, setRuleEye, { campaignId, packId, entryId: 'drowned-harbour', ruleId: 'tidewife-bargain', open: true });
    expect(opened.ok ? '' : opened.message).toBe('The book keeps this for the GM: players never see it.');
    must(await world.admin.from('place_rule_switches').insert({ campaign_id: campaignId, pack_id: packId, entry_id: 'drowned-harbour', rule_id: 'tidewife-bargain', which: 'eye', value: true }).select('id'));
    expect((await loadPlayersRules(asDb(world.playerA), campaignId))?.map((r) => r.name)).toEqual(['Falling into the harbour', 'Rowing and swimming']);
    expect(await readAll()).not.toContain('Tidewife');

    // The toggle off: the player reads no place check (the setting's holds); Undo puts the harbour's back.
    await ok(as(world.gm, setCheckInForce, { campaignId, packId, entryId: 'drowned-harbour', on: false }));
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([]);
    await undoLatest('placeRule.inForce');
    expect((await loadPlayersCheck(asDb(world.playerA), campaignId))?.map((c) => c.placeName)).toEqual(['1 The jetty']);

    // Once the harbour itself has been shown to the party, its rule and its check may carry its name.
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('drowned-harbour') }));
    const atHarbour = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: atHarbour, piece: atHarbour.pieces[0]! }));
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('the-jetty') }));
    const backAtJetty = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    if (!backAtJetty.pieces[0]!.shown) await ok(as(world.gm, showPiece, { campaignId, row: backAtJetty, piece: backAtJetty.pieces[0]! }));
    expect((await loadPlayersRules(asDb(world.playerA), campaignId))?.map((r) => r.placeName)).toEqual(['The Drowned Harbour', 'The Drowned Harbour']);
    expect((await loadPlayersCheck(asDb(world.playerA), campaignId))?.map((c) => c.placeName)).toEqual(['The Drowned Harbour']);

    // The log: one line a change, the GM's alone.
    const lines = must(await world.admin.from('events').select('type, audience').eq('campaign_id', campaignId).in('type', ['placeRule.eye', 'placeRule.inForce']));
    // Exactly two switches were set (an eye closed, the toggle off): the refused opening of the GM-only rule wrote
    // nothing, the row inserted by hand logs under the table's own type, and the two Undos log under the undo's.
    expect(lines.length).toBe(2);
    expect(new Set(lines.map((l) => l.audience))).toEqual(new Set(['gm']));
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', campaignId).in('type', ['placeRule.eye', 'placeRule.inForce']))).toEqual([]);

    // A place whose check doesn't say it replaces the setting's: none for players (the setting's is in force).
    const shingle = await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf('the-shingle') }));
    expect(shingle).toBeTruthy();
    const there = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: there, piece: there.pieces[0]! }));
    expect(await loadPlayersCheck(asDb(world.playerA), campaignId)).toEqual([]);
    expect(await loadPlayersRules(asDb(world.playerA), campaignId)).toEqual([]);
  });

  it('only the GM sets a switch, only on an attached pack, and a switch changes only its value', async () => {
    const refused = await world.playerA.db.rpc('set_place_rule_switch', { campaign: campaignId, pack: packId, entry_id: 'drowned-harbour', rule_id: 'tidewife-bargain', which: 'eye', value: true });
    expect(refused.error).toBeTruthy();
    const insert = await world.playerA.db.from('place_rule_switches').insert({ campaign_id: campaignId, pack_id: packId, entry_id: 'drowned-harbour', rule_id: 'tidewife-bargain', which: 'eye', value: true }).select('id');
    expect(insert.error ?? (insert.data ?? []).length === 0).toBeTruthy();
    const unattached = await world.gm.db.rpc('set_place_rule_switch', { campaign: campaignId, pack: crypto.randomUUID(), entry_id: 'drowned-harbour', rule_id: 'rowing', which: 'eye', value: false });
    expect(unattached.error?.message).toContain('attached pack');
    const row = must(await world.gm.db.rpc('set_place_rule_switch', { campaign: campaignId, pack: packId, entry_id: 'drowned-harbour', rule_id: 'rowing', which: 'eye', value: false })) as unknown as { id: string };
    const changed = await world.gm.db.from('place_rule_switches').update({ rule_id: 'falling-in' }).eq('id', row.id).select('id');
    expect(changed.error?.message).toContain("can't be changed");
    // A switch names a rule the place has, or a place with its own check (review of a5e54923).
    const noRule = await world.gm.db.rpc('set_place_rule_switch', { campaign: campaignId, pack: packId, entry_id: 'drowned-harbour', rule_id: 'no-such-rule', which: 'eye', value: false });
    expect(noRule.error?.message).toContain("That rule isn't in that place.");
    const noCheck = await world.gm.db.rpc('set_place_rule_switch', { campaign: campaignId, pack: packId, entry_id: 'the-jetty', rule_id: 'encounterCheck', which: 'inForce', value: false });
    expect(noCheck.error?.message).toContain('That place has no encounter check of its own.');
  });
});

// Review of #726 (Important 1; rp-5): link marks as players receive them, through 20261113200000's walk of each JSON
// string. A fresh campaign: Player A's character in group 1 at the cove, Player B's in group 2 (nowhere yet).
describe("link marks never reach a player with their id, in rules or pieces", () => {
  it('each mark becomes its label or its id words, in every string of a rule; another group reads nothing', async () => {
    const cove = {
      id: 'mark-cove',
      name: 'Marker Cove',
      type: 'site',
      playerView: { text: 'A cove of painted stakes.' },
      rules: [
        {
          id: 'marked-words',
          name: 'Ask [[npc:name-mark-zq|the Ferryman]]',
          button: 'Call [[npc:button-mark-zq]]',
          text: {
            blocks: [
              { p: 'A [[npc:old-tom-zq|"Old" Tom]] and [[npc:back-slash-zq|Back\\slash]].' },
              { p: 'A [[npc:pipe-one-zq|a|b]] and [[npc:brk-mark-zq|Old [Tom]].' },
              { p: 'A [[npc:nl-mark-zq|Two\nlines]].' },
              { p: 'A [[npc:eel-wife-zq|Ǣlfwaru]] and [[npc:lamp-mark-zq|🏮 Lamp]].' },
              { p: 'Two: [[place:first-mark-zq|First]] and [[place:second-mark-zq]].' },
              { p: "Hook: [[adventureHook:port-pack-zq:archbishop-call-zq|The Archbishop's call]]; bare: [[adventureHook:port-pack-zq:bishop-bare-zq]]." },
              { p: 'Ask [[npc:split-mark-zq' },
              { p: 'id|Split]] now.' },
              { list: ['Item [[table:list-mark-zq|the eel list]]'] },
              { table: { title: 'Marks', columns: ['Who', 'Where'], rows: [['[[npc:cell-mark-zq]]', 'here']] } },
            ],
          },
        },
      ],
    };
    const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Marker Cove', version: '0.1', kind: 'adventure' }, locations: [cove] }));
    if (!read.ok) throw new Error(read.message);
    const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Marked Shore', created_by: world.gm.id }).select().single());
    const markCampaign = campaign.id as string;
    must(
      await world.admin
        .from('members')
        .insert([
          { campaign_id: markCampaign, user_id: world.gm.id, base_role: 'gm' },
          { campaign_id: markCampaign, user_id: world.playerA.id, base_role: 'player' },
          { campaign_id: markCampaign, user_id: world.playerB.id, base_role: 'player' },
        ])
        .select(),
    );
    const pc = (name: string, owner: Person) => ({ campaign_id: markCampaign, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
    const [, moss] = must(await world.admin.from('actors').insert([pc('Wren the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
    const markPack = await ok(as(world.gm, importPack, { pack: read.pack }));
    await ok(as(world.gm, attachPack, { campaignId: markCampaign, packId: markPack }));
    // Moss goes to group 2 before the party sets out, so only group 1 is at the cove.
    must(await world.gm.db.rpc('choose_party_group', { actor: moss!.id, to_group: null }));
    const trip = await ok(as(world.gm, startExpedition, { campaignId: markCampaign, mode: 'dungeon' }));
    const entries = (await loadCampaignEntries(asDb(world.gm), markCampaign)) ?? [];
    const found = entries.find((e) => e.kind === 'location' && e.packId === markPack && e.packEntryId === 'mark-cove');
    if (!found) throw new Error('no cove');
    await ok(as(world.gm, setPlace, { campaignId: markCampaign, group: 1, name: '', packEntry: { packId: markPack, packEntryId: 'mark-cove', name: found.name, data: found.data as Record<string, unknown> } }));
    const visit = (await loadGroupPlaces(asDb(world.gm), markCampaign, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId: markCampaign, row: visit, piece: visit.pieces[0]! }));

    const sent = must(await world.playerA.db.rpc('place_rules_for_players', { campaign: markCampaign })) as Record<string, unknown>[];
    const everything = JSON.stringify(sent);
    expect(everything).toContain('zq');
    for (const id of ['name-mark-zq', 'button-mark-zq', 'old-tom-zq', 'back-slash-zq', 'pipe-one-zq', 'brk-mark-zq', 'nl-mark-zq', 'eel-wife-zq', 'lamp-mark-zq', 'first-mark-zq', 'second-mark-zq', 'port-pack-zq', 'archbishop-call-zq', 'bishop-bare-zq', 'split-mark-zq', 'list-mark-zq', 'cell-mark-zq']) {
      expect(everything).not.toContain(id);
    }
    expect(everything).not.toMatch(/\[\[[A-Za-z]+:/);
    const rules = await loadPlayersRules(asDb(world.playerA), markCampaign);
    expect(rules?.map((r) => [r.name, r.button])).toEqual([['Ask the Ferryman', 'Call button mark zq']]);
    const words = (rules?.[0]?.blocks ?? []).map((b) => (b.kind === 'p' ? b.text : b.kind === 'list' ? b.items.join('/') : b.kind === 'table' ? b.rows.flat().join('/') : ''));
    expect(words).toEqual([
      'A "Old" Tom and Back\\slash.',
      'A a|b and Old [Tom.',
      'A Two\nlines.',
      'A Ǣlfwaru and 🏮 Lamp.',
      'Two: First and second mark zq.',
      "Hook: The Archbishop's call; bare: bishop bare zq.",
      'Ask',
      'id|Split]] now.',
      'Item the eel list',
      'cell mark zq/here',
    ]);

    // Player B's character is in group 2, which is nowhere: nothing of group 1's rules reaches them.
    expect(must(await world.playerB.db.rpc('place_rules_for_players', { campaign: markCampaign }))).toEqual([]);
    expect(await loadPlayersRules(asDb(world.playerB), markCampaign)).toEqual([]);

    // Pieces typed by hand (+ Piece: add_place_piece; Edit piece: edit_place_piece) keep a mark as typed for the GM, and
    // reach the player as the label only, through scene_pieces and known_places_campaign. No command writes a lead by
    // hand (a lead comes from a pack, stripped when the place is made), so a raw lead is put in as the database holds it.
    const added = await ok(as(world.gm, addPiece, { campaignId: markCampaign, placeId: visit.placeId!, kind: 'clue', text: 'Ask [[npc:added-mark-zq|the Ferryman]] at dusk.' }));
    const editedId = await ok(as(world.gm, addPiece, { campaignId: markCampaign, placeId: visit.placeId!, kind: 'exit', text: 'A plain way out.' }));
    const editedRow = must(await world.admin.from('place_pieces').select('id, version').eq('id', editedId).single()) as { id: string; version: number };
    await ok(as(world.gm, editPiece, { campaignId: markCampaign, piece: editedRow, kind: 'exit', text: 'Out past [[place:edited-mark-zq]].' }));
    const leadRow = must(
      await world.admin
        .from('place_pieces')
        .insert({ campaign_id: markCampaign, place_id: visit.placeId!, kind: 'other', body: 'A painted stake.', position: 50, lead: '[[npc:lead-mark-zq|Stakewife]]' })
        .select('id')
        .single(),
    ) as { id: string };
    const now = (await loadGroupPlaces(asDb(world.gm), markCampaign, trip.id))!.get(1)!;
    for (const id of [added, editedId, leadRow.id]) await ok(as(world.gm, showPiece, { campaignId: markCampaign, row: now, piece: now.pieces.find((pc) => pc.id === id)! }));
    // The GM reads the pieces as typed.
    const gmBodies = must(await world.gm.db.from('place_pieces').select('body, lead').in('id', [added, editedId, leadRow.id])) as { body: string; lead: string | null }[];
    expect(JSON.stringify(gmBodies)).toContain('added-mark-zq');
    expect(JSON.stringify(gmBodies)).toContain('edited-mark-zq');
    expect(JSON.stringify(gmBodies)).toContain('lead-mark-zq');
    // The player reads labels and ids' words only; the pack's own piece is unchanged.
    const scene = must(await world.playerA.db.rpc('scene_pieces', { campaign: markCampaign })) as { body: string; lead: string | null }[];
    const known = must(await world.playerA.db.rpc('known_places_campaign', { campaign: markCampaign })) as { body: string; lead: string | null }[];
    for (const rows of [scene, known]) {
      const seen = JSON.stringify(rows);
      for (const id of ['added-mark-zq', 'edited-mark-zq', 'lead-mark-zq']) expect(seen).not.toContain(id);
      expect(seen).not.toMatch(/\[\[[A-Za-z]+:/);
      expect(rows.map((r) => [r.lead ?? '', r.body])).toEqual(
        expect.arrayContaining([
          ['', 'A cove of painted stakes.'],
          ['', 'Ask the Ferryman at dusk.'],
          ['', 'Out past edited mark zq.'],
          ['Stakewife', 'A painted stake.'],
        ]),
      );
    }
  });
});

describe("an icon button through the players' read (dec-7 piece 2, pf-12e)", () => {
  // Purpose: an object button reaches the player as its JSON text through the real link-mark strip
  // (private.plain_link_text): a label holding a quote and a backslash reads back whole, as { icon, words }; an
  // unclosed mark at the end of the words takes the JSON's closing with it, and the player gets no button (never raw
  // JSON, never the mark's id).
  it('reads an object button back whole, and gives no button when an unclosed mark breaks it', async () => {
    const quay = {
      id: 'button-quay',
      name: 'Button Quay',
      type: 'site',
      playerView: { text: 'A quay of tarred bollards.' },
      rules: [
        { id: 'ask-ferris', name: 'Hailing the boatman', button: { icon: 'water-splash', words: 'Ask [[npc:old-ferris-zq|"Old" Ferris \\ the boatman]]' }, text: 'He comes if called twice.' },
        { id: 'open-mark', name: 'The tide bell', button: { icon: 'hourglass', words: 'Ring for [[npc:open-mark-zq' }, text: 'It rings at the turn.' },
      ],
    };
    const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Button Quay', version: '0.1', kind: 'adventure' }, locations: [quay] }));
    if (!read.ok) throw new Error(read.message);
    const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Tarred Quay', created_by: world.gm.id }).select().single());
    const quayCampaign = campaign.id as string;
    must(
      await world.admin
        .from('members')
        .insert([
          { campaign_id: quayCampaign, user_id: world.gm.id, base_role: 'gm' },
          { campaign_id: quayCampaign, user_id: world.playerA.id, base_role: 'player' },
        ])
        .select(),
    );
    must(await world.admin.from('actors').insert({ campaign_id: quayCampaign, kind: 'pc', name: 'Wren the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select());
    const quayPack = await ok(as(world.gm, importPack, { pack: read.pack }));
    await ok(as(world.gm, attachPack, { campaignId: quayCampaign, packId: quayPack }));
    const trip = await ok(as(world.gm, startExpedition, { campaignId: quayCampaign, mode: 'dungeon' }));
    const entries = (await loadCampaignEntries(asDb(world.gm), quayCampaign)) ?? [];
    const found = entries.find((e) => e.kind === 'location' && e.packId === quayPack && e.packEntryId === 'button-quay');
    if (!found) throw new Error('no quay');
    await ok(as(world.gm, setPlace, { campaignId: quayCampaign, group: 1, name: '', packEntry: { packId: quayPack, packEntryId: 'button-quay', name: found.name, data: found.data as Record<string, unknown> } }));
    const visit = (await loadGroupPlaces(asDb(world.gm), quayCampaign, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId: quayCampaign, row: visit, piece: visit.pieces[0]! }));

    const sent = JSON.stringify(must(await world.playerA.db.rpc('place_rules_for_players', { campaign: quayCampaign })));
    for (const id of ['old-ferris-zq', 'open-mark-zq']) expect(sent).not.toContain(id);
    const rules = await loadPlayersRules(asDb(world.playerA), quayCampaign);
    expect(rules?.map((r) => [r.name, r.button])).toEqual([
      ['Hailing the boatman', { icon: 'water-splash', words: 'Ask "Old" Ferris \\ the boatman' }],
      ['The tide bell', null],
    ]);
  });
});

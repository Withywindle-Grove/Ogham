// Runs every case in the shared permission table for real, as that person, against the test project.
// Each case must agree twice: the app's can() and the database's access rules give the same answer.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type Command, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
import { setHp } from '../../src/modules/characters/hp.ts';
import { toClock, toExpedition, toSession } from '../../src/modules/expedition/play.ts';
import { toCheckResult, toReminder } from '../../src/modules/expedition/reminderPlay.ts';
import { toTablePin } from '../../src/modules/expedition/tablePins.ts';
import { toWaitingEncounter } from '../../src/modules/expedition/encounterPlay.ts';
import { forceMarch, toGroupLost, toTravelGroup } from '../../src/modules/expedition/travelPlay.ts';
import { toWeatherRoll } from '../../src/modules/expedition/weatherPlay.ts';
import { toMarchingOrder } from '../../src/modules/expedition/marchingPlay.ts';
import { toCharacterStatus } from '../../src/modules/expedition/statusPlay.ts';
import { answerRequest, loadRequests, sendRequest, toRequest } from '../../src/modules/requests/requests.ts';
import { replyRequest } from '../../src/modules/requests/townRequests.ts';
import { loadSheetChanges } from '../../src/modules/characters/sheetChanges.ts';
import { permissionCases, type CaseWorld, type Who } from '../../src/testing/permissionCases.ts';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

// Account-level changes (your own name) aren't campaign events.
const UNLOGGED = new Set(['profile.rename', 'library.import', 'library.update', 'library.copyHomebrew', 'library.editEntry', 'roll.record', 'rule.skipped', 'library.addPicture']);

let world: World;
let cases: CaseWorld;
// The invented weather pack (M5b cases), made once.
let weatherPack: string | undefined;
const users = {} as Record<Who, CurrentUser>;
const registry = createAppRegistry();

function person(who: Who) {
  return { gm: world.gm, playerA: world.playerA, playerB: world.playerB, outsider: world.outsider, newcomer: world.newcomer }[who];
}

async function characterRef(id: string): Promise<CharacterRef> {
  return toCharacterRef(must(await world.admin.from('actors').select('*').eq('id', id).single()));
}

beforeAll(async () => {
  world = await buildWorld();
  for (const who of ['gm', 'playerA', 'playerB', 'outsider', 'newcomer'] as const) {
    const user = await loadCurrentUser(person(who).db as unknown as Db);
    if (!user) throw new Error(`${who} isn't signed in`);
    users[who] = user;
  }
  cases = {
    campaignId: world.campaignId,
    companyId: world.companyId,
    userId: (who) => person(who).id,
    wren: await characterRef(world.wrenId),
    ash: await characterRef(world.ashId),
    async freshCompany() {
      return must(await world.admin.from('companies').insert({ campaign_id: world.campaignId, name: 'A fresh company' }).select().single()).id;
    },
    async freshCharacter(owner, approval, archived = false) {
      const row = must(
        await world.admin
          .from('actors')
          .insert({
            campaign_id: world.campaignId,
            kind: 'pc',
            name: 'A fresh character',
            owner_type: 'user',
            owner_user_id: person(owner).id,
            approval,
            status: archived ? 'archived' : 'active',
          })
          .select()
          .single(),
      );
      return toCharacterRef(row);
    },
    async freshField() {
      const key = `fresh_${Math.random().toString(36).slice(2, 8)}`;
      const row = must(
        await world.admin
          .from('field_definitions')
          .insert({ campaign_id: world.campaignId, key, label: 'A fresh field', type: 'text' })
          .select()
          .single(),
      );
      return { id: row.id, campaignId: row.campaign_id, key: row.key };
    },
    async freshChange(by) {
      // A fresh approved character (Player B's own when Player B makes the change), and an HP change logged by `by`.
      const character = await this.freshCharacter(by === 'playerB' ? 'playerB' : 'playerA', 'approved');
      const db = taggedDb(person(by).db as unknown as Db, { type: 'character.setHp', level: 'verbose' });
      const changed = await setHp.run(db, users[by], { character, hpCurrent: 9 });
      if (!changed.ok) throw new Error(changed.message);
      const event = must(await world.admin.from('events').select('id').eq('target_id', character.id).eq('type', 'character.setHp').single());
      return { campaignId: world.campaignId, eventId: event.id, authorUserId: person(by).id };
    },
    async freshPack(owner) {
      const made = await person(owner).db.rpc('import_pack', {
        meta: { name: 'A fresh pack', version: '1', kind: 'setting', format_version: 2, source: '', notes: '' },
        entries: [{ kind: 'item', pack_entry_id: 'rope', name: 'Rope', data: { id: 'rope', name: 'Rope' } }],
        replace_pack_id: null,
      });
      if (made.error) throw made.error;
      return { packId: made.data as string, ownerUserId: person(owner).id };
    },
    async freshAttachedPack() {
      const { packId, ownerUserId } = await this.freshPack('gm');
      // On top of the stack, like the app attaches it.
      const links = must(await world.admin.from('campaign_packs').select('priority').eq('campaign_id', world.campaignId));
      const priority = Math.max(0, ...links.map((link) => link.priority as number)) + 1;
      const row = must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, option_choices: {}, priority }).select().single());
      return { campaignPackId: row.id as string, packId, ownerUserId };
    },
    async freshHomebrewEntry() {
      // Straight into the campaign's homebrew pack (made here once, like the app does on first save).
      const found = must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId));
      const packId =
        found[0]?.id ??
        must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, campaign_id: world.campaignId, name: 'Homebrew', kind: 'homebrew' }).select().single()).id;
      if (found.length === 0) must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, priority: 100 }).select());
      const id = `dazed-${crypto.randomUUID().slice(0, 8)}`;
      must(await world.admin.from('library_entries').insert({ pack_id: packId, kind: 'condition', pack_entry_id: id, name: 'Dazed', data: { id, name: 'Dazed' } }).select());
      return id;
    },
    async clockOf(campaignId) {
      return toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
    },
    async freshSession(campaignId) {
      must(await world.admin.from('sessions').update({ ended_at: new Date().toISOString() }).eq('campaign_id', campaignId).is('ended_at', null).select());
      return toSession(must(await world.admin.from('sessions').insert({ campaign_id: campaignId, number: 1 }).select().single()));
    },
    async freshReminder(campaignId) {
      return toReminder(
        must(
          await world.admin
            .from('reminders')
            .insert({ campaign_id: campaignId, label: 'Listen for bog lurkers', kind: 'check', encounter_check: true, every_value: 2, every_unit: 'turn' })
            .select()
            .single(),
        ),
      );
    },
    async onAdventure(campaignId) {
      must(await world.admin.from('campaigns').update({ mode: 'adventure' }).eq('id', campaignId).select());
    },
    async freshTableCampaign() {
      const campaignId = await this.freshCampaign(false);
      const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, campaign_id: campaignId, name: 'Homebrew', kind: 'homebrew' }).select().single());
      must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: pack.id, priority: 100 }).select());
      const table = { id: 'bog-things', name: 'Bog things', die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurkers' }] };
      must(await world.admin.from('library_entries').insert({ pack_id: pack.id, kind: 'table', pack_entry_id: 'bog-things', name: 'Bog things', data: table }).select());
      return campaignId;
    },
    async freshTablePin(campaignId) {
      return toTablePin(must(await world.admin.from('table_pins').insert({ campaign_id: campaignId, table_id: 'bog-things' }).select().single()));
    },
    async freshWaitingEncounter(campaignId) {
      const hit = await this.freshCheckResult(campaignId);
      return toWaitingEncounter(must(await world.admin.from('waiting_encounters').insert({ campaign_id: campaignId, check_result_id: hit.id }).select().single()));
    },
    async freshTravel(group = 1) {
      const expedition = await this.freshExpedition(world.campaignId);
      return toTravelGroup(must(await world.admin.from('travel_groups').insert({ campaign_id: world.campaignId, expedition_id: expedition.id, group_number: group, day: 0, total: 8 }).select().single()));
    },
    async freshMarch(by) {
      // The party together, a fresh day, then this player's own forced march (4 points), tagged as the app tags it.
      await this.party('together');
      const row = await this.freshTravel();
      const db = taggedDb(person(by).db as unknown as Db, { type: 'travel.forceMarch', level: 'simple' });
      const marched = await forceMarch.run(db, users[by], { target: { campaignId: world.campaignId, group: 1, mine: true }, row, added: 4 });
      if (!marched.ok) throw new Error(marched.message);
      const event = must(await world.admin.from('events').select('id').eq('target_id', row.id).eq('type', 'travel.forceMarch').single());
      return { campaignId: world.campaignId, eventId: event.id, authorUserId: person(by).id };
    },
    async freshActivityRun() {
      // Wren with the party, a day started, then Player A's own activity (nothing found, a point spent).
      await this.party('together');
      await this.freshTravel();
      const run = must(
        await world.playerA.db.rpc('apply_activity', {
          campaign: world.campaignId, group_no: 1, activity_id: 'gather-reeds', activity_name: 'Gather reeds', actors: [world.wrenId],
          finder: world.wrenId, rolls: [], outcome: 'done', spend: 1,
        }),
      ) as { id: string };
      return run.id;
    },
    async freshCamp() {
      // The party together, a fresh expedition, the GM's camp for it, and three Sling stones in Wren's pack.
      await this.party('together');
      await this.freshExpedition(world.campaignId);
      const camp = must(await world.gm.db.rpc('open_camp', { campaign: world.campaignId, group_no: 1, day: 0 })) as { id: string };
      const line = await this.freshLine('wren');
      return { campId: camp.id, lineId: line.id };
    },
    async freshLost(open) {
      const expedition = await this.freshExpedition(world.campaignId);
      const campaign = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single());
      const settings = { ...((campaign.settings as Record<string, unknown> | null) ?? {}), gettingLost: open ? 'open' : 'secret' };
      must(await world.admin.from('campaigns').update({ settings }).eq('id', world.campaignId).select('id'));
      return toGroupLost(must(await world.admin.from('group_lost').insert({ campaign_id: world.campaignId, expedition_id: expedition.id, group_number: 1, since_day: 0 }).select().single()));
    },
    async freshCheckResult(campaignId) {
      return toCheckResult(
        must(
          await world.admin
            .from('check_results')
            .insert({ campaign_id: campaignId, check_key: 'gm:listen', name: 'Listen for bog lurkers', source: 'gm', outcome: 'hit' })
            .select()
            .single(),
        ),
      );
    },
    async freshExpedition(campaignId, ended = false) {
      must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('campaign_id', campaignId).is('ended_at', null).eq('undone', false).select());
      const made = must(await world.admin.from('expeditions').insert({ campaign_id: campaignId, mode: 'dungeon' }).select().single());
      if (!ended) return toExpedition(made);
      return toExpedition(must(await world.admin.from('expeditions').update({ ended_at: made.started_at, summary: { seconds: 0 } }).eq('id', made.id).select().single()));
    },
    async freshPlace(shown = false, picture = false, map = false) {
      const expedition = await this.freshExpedition(world.campaignId);
      const name = `The Moth Gallery ${crypto.randomUUID().slice(0, 8)}`;
      // The GM's picture of it (M5b step 1 follow-up), when asked for.
      const image = picture ? (must(await world.admin.from('assets').insert({ campaign_id: world.campaignId, kind: 'place', name, visibility: 'gm' }).select('id').single()).id as string) : null;
      // The GM's map of it (dec-7 5m-2), tied to it, when asked for.
      const mapAsset = map ? (must(await world.admin.from('assets').insert({ campaign_id: world.campaignId, kind: 'map', name, visibility: 'gm' }).select('id').single()).id as string) : null;
      const place = must(await world.admin.from('places').insert({ campaign_id: world.campaignId, name, map_asset_id: mapAsset }).select().single());
      // The picture is a piece of its own kind (ruled B, 2026-11-03), hidden.
      const pictured = image ? must(await world.admin.from('place_pieces').insert({ campaign_id: world.campaignId, place_id: place.id, kind: 'picture', body: 'A picture', asset_id: image, position: -1 }).select('id').single()) : null;
      must(await world.admin.from('place_notes').insert({ id: place.id, campaign_id: world.campaignId }).select());
      const row = must(await world.admin.from('group_places').insert({ campaign_id: world.campaignId, expedition_id: expedition.id, group_number: 1, place_id: place.id }).select().single());
      if (shown) must(await world.admin.from('group_places').update({ shown: true }).eq('id', row.id).select());
      // Its one piece (M5b g2), shown to the party when the place is.
      const piece = must(await world.admin.from('place_pieces').insert({ campaign_id: world.campaignId, place_id: place.id, kind: 'exit', body: 'An archway to the east' }).select().single());
      if (shown) must(await world.admin.from('piece_shows').insert({ campaign_id: world.campaignId, group_place_id: row.id, piece_id: piece.id, group_number: 1 }).select());
      return {
        pieces: [{ id: piece.id as string, kind: 'exit' as const, text: 'An archway to the east', shown, shownAt: null, gm: { value: '', trigger: '', statLine: '' }, version: 1 }],
        id: row.id as string,
        campaignId: world.campaignId,
        expeditionId: expedition.id,
        group: 1,
        placeId: place.id as string,
        shown,
        place: { id: place.id as string, campaignId: world.campaignId, name, description: '', notes: null, version: 1, notesVersion: 1 },
        picture: pictured && image ? { id: pictured.id as string, assetId: image, shown: false, shownAt: null } : null,
      };
    },
    async freshMap() {
      // A map of the GM's (dec-7 5m-3), hidden: the campaign's copy, as + Map stores it.
      return must(await world.admin.from('assets').insert({ campaign_id: world.campaignId, kind: 'map', name: 'The harbour chart', visibility: 'gm' }).select('id').single()).id as string;
    },
    async freshReturnVisit() {
      // The earlier visit, shown and moved on from; then a new visit to the same place with nothing shown.
      const was = await this.freshPlace(true);
      must(await world.admin.from('group_places').update({ moved_on: true }).eq('id', was.id).select());
      const row = must(await world.admin.from('group_places').insert({ campaign_id: world.campaignId, expedition_id: was.expeditionId, group_number: 1, place_id: was.placeId }).select().single());
      return { ...was, id: row.id as string, shown: false, pieces: was.pieces.map((p) => ({ ...p, shown: false, shownAt: null })) };
    },
    async freshPackPlace() {
      const { packId } = await this.freshAttachedPack();
      const packEntryId = `the-reed-inn-${crypto.randomUUID().slice(0, 8)}`;
      const data = {
        id: packEntryId,
        name: 'The Reed Inn',
        type: 'building',
        playerView: { text: 'Smoke and eel stew.' },
        gm: { notes: 'The keeper fences stolen lanterns.', sections: [{ heading: 'The keeper', text: 'Fences stolen lanterns.' }] },
        // A section of Knowledge, for placeKnowledge.eye (P4, p4s-2). A rule and a check of its own, for placeRule.eye and placeRule.inForce (dec-7 piece 3).
        rules: [{ id: 'slick-piles', name: 'Slick piles', text: 'Footing is poor.' }],
        encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] } },
      };
      must(await world.admin.from('library_entries').insert({ pack_id: packId, kind: 'location', pack_entry_id: packEntryId, name: 'The Reed Inn', data }).select());
      return { packId, packEntryId, name: 'The Reed Inn', data };
    },
    async freshIdlePlace() {
      const campaignId = await this.freshCampaign(false);
      const place = must(await world.admin.from('places').insert({ campaign_id: campaignId, name: 'The Drowned Stair' }).select().single());
      must(await world.admin.from('place_notes').insert({ id: place.id, campaign_id: campaignId }).select());
      return { campaignId, placeId: place.id as string };
    },
    async freshMovePlace() {
      const campaignId = await this.freshCampaign(false);
      await this.freshExpedition(campaignId);
      const place = must(await world.admin.from('places').insert({ campaign_id: campaignId, name: 'The Eel Steps' }).select().single());
      must(await world.admin.from('place_notes').insert({ id: place.id, campaign_id: campaignId }).select());
      return { campaignId, placeId: place.id as string };
    },
    async freshAdventureHook() {
      // An adventure pack attached to the campaign with one hook, never sent (dec-12 piece B; invented words).
      const hookId = `ew-bog-bounty-${crypto.randomUUID().slice(0, 8)}`;
      const made = await world.gm.db.rpc('import_pack', {
        meta: { name: 'The eel weirs', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
        entries: [{ kind: 'adventureHook', pack_entry_id: hookId, name: 'Bounty on the Bog lurker', data: { text: 'Nailed to the quay post: a bounty.', pays: 'Ten silver a head', giver: null, order: 0 } }],
        replace_pack_id: null,
      });
      if (made.error) throw made.error;
      const packId = made.data as string;
      const links = must(await world.admin.from('campaign_packs').select('priority').eq('campaign_id', world.campaignId));
      const priority = Math.max(0, ...links.map((link) => link.priority as number)) + 1;
      must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, option_choices: {}, priority }).select());
      return { packId, hookId };
    },
    async freshRumour() {
      // An adventure pack attached to the campaign with one rumours table, never given (dec-12 piece E; invented words).
      const tableId = `ew-quay-rumours-${crypto.randomUUID().slice(0, 8)}`;
      const made = await world.gm.db.rpc('import_pack', {
        meta: { name: 'The eel weirs', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
        entries: [{ kind: 'table', pack_entry_id: tableId, name: 'What they say on the quay', data: { uses: ['world.rumours'], die: 'd4', rows: [{ min: 1, max: 1, result: 'The cog went down with her captain still aboard.', truth: 'true' }] } }],
        replace_pack_id: null,
      });
      if (made.error) throw made.error;
      const packId = made.data as string;
      const links = must(await world.admin.from('campaign_packs').select('priority').eq('campaign_id', world.campaignId));
      const priority = Math.max(0, ...links.map((link) => link.priority as number)) + 1;
      must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, option_choices: {}, priority }).select());
      return { packId, tableId, min: 1, max: 1 };
    },
    async freshCallSend(to: 'party' | 'wren') {
      // A call the GM just sent (P7): a fresh hook, sent to the party or to Wren, so a mark is never a repeat.
      const { packId, hookId } = await this.freshAdventureHook();
      const sent = await world.gm.db.rpc('send_hook', { campaign: world.campaignId, pack: packId, hook_key: hookId, body: 'Nailed to the quay post: a bounty.', pays: '', ...(to === 'wren' ? { to_actor: this.wren.id } : {}) });
      if (sent.error) throw sent.error;
      const row = (Array.isArray(sent.data) ? sent.data[0] : sent.data) as { id: string };
      return { id: row.id, campaignId: world.campaignId, actorId: to === 'wren' ? this.wren.id : null, playerUserId: to === 'wren' ? world.playerA.id : null };
    },
    async freshMessage() {
      const message = must(
        await world.admin
          .from('messages')
          .insert({ campaign_id: world.campaignId, actor_id: this.wren.id, player_user_id: world.playerA.id, from_gm: true, sender_user_id: world.gm.id, body: 'A cold draught from the east.' })
          .select('id')
          .single(),
      );
      return message.id as string;
    },
    async freshRequest() {
      const row = must(
        await world.admin
          .from('requests')
          .insert({ campaign_id: world.campaignId, requester_id: world.playerA.id, actor_id: this.wren.id, kind: 'describe', direction: 'playerAsks', text: 'Pry the idol loose.' })
          .select()
          .single(),
      );
      return toRequest(row as Record<string, unknown>);
    },
    async freshSheetChange() {
      // Player A asks for a Max HP Wren doesn't have yet, as the Edit screen's Send to the GM does.
      // Always a figure Wren doesn't hold now (an earlier case may have approved one; dice tests can pin Math.random).
      const now = must(await world.admin.from('actors').select('hp_max').eq('id', this.wren.id).single()).hp_max as number | null;
      const made = must(await world.playerA.db.rpc('request_sheet_change', { actor: this.wren.id, field: 'hpMax', label: 'Max HP', to_value: (now ?? 100) + 1 }));
      const found = (await loadSheetChanges(world.playerA.db, world.campaignId, { actorId: this.wren.id })) ?? [];
      const change = found.find((c) => c.id === (made as { id: string }).id);
      if (!change) throw new Error('The sheet change was not made.');
      return change;
    },
    async freshOffer() {
      // Wren's Sell… (a coil of rope, to a stall), answered by the GM with an offer, as the app would.
      const row = must(
        await world.admin
          .from('requests')
          .insert({ campaign_id: world.campaignId, requester_id: world.playerA.id, actor_id: this.wren.id, kind: 'sell', direction: 'playerAsks', text: 'Sell Rope to the stall', prompt: { lineId: crypto.randomUUID(), item: 'Rope', qty: 1, of: 1, buyer: 'A stall' } })
          .select('id')
          .single(),
      );
      const answered = must(await world.gm.db.rpc('answer_request', { request: row.id as string, answer: { kind: 'offer', price: '3 gp', note: '' } }));
      return toRequest(answered as unknown as Record<string, unknown>);
    },
    async freshPurchase() {
      // A real purchase through the commands, as dec3-w11b-buy-undo.test.ts's boughtLantern makes it: Player A asks to
      // buy a lantern for Wren, the GM answers In stock, and Player A's Buy it brings the line in as bought (version 1,
      // with Player A's creating event under the reply's request id). Fresh each time, so it is never touched.
      const as = async <I, T, O>(who: Who, command: Command<I, T, O>, input: I): Promise<O> => {
        const done = await runCommand(registry, person(who).db as unknown as Db, users[who], command, input);
        if (!done.ok) throw new Error(done.message);
        return done.value;
      };
      const reload = async (id: string) => (await loadRequests(world.playerA.db as unknown as Db, world.campaignId))!.find((r) => r.id === id)!;
      const asked = await as('playerA', sendRequest, {
        character: this.wren,
        kind: 'buy',
        text: 'Lantern from the stall',
        prompt: { item: 'Lantern', itemId: null, shop: 'The stall', serviceId: 'buy-gear', price: '10 gp' },
      });
      await as('gm', answerRequest, { request: asked, answer: { kind: 'buy', result: 'inStock', price: '10 gp', note: '' } });
      const carrier = await this.carrier('wren');
      await as('playerA', replyRequest, {
        request: await reload(asked.id),
        accept: true,
        buy: { carrier, item: { libraryEntryId: null, name: 'Lantern', category: 'gear', weightCoin: 30, slots: null, stack: 1 }, cost: '10 gp' },
      });
      return reload(asked.id);
    },
    async freshInn() {
      // A fresh expedition at a place marked Safe whose one lodging the GM shows, open.
      const visit = await this.freshPlace();
      const key = 'lodging:the lantern rest';
      must(
        await world.admin
          .from('places')
          .update({ safety: 'safe', town: { [key]: { name: 'The Lantern Rest', kind: 'lodging', shown: true, open: true } } })
          .eq('id', visit.placeId)
          .select('id'),
      );
      return { key, name: 'The Lantern Rest', town: visit.place!.name };
    },
    async freshTownPart(shown = false) {
      // A Safe town made from a pack, the party there on a fresh expedition; a place one level under it, in the town's
      // list as `place:<id>`, with one piece, hidden or (`shown`) shown to the party (a store row, as the GM's show
      // writes it).
      const { packId } = await this.freshAttachedPack();
      const tag = crypto.randomUUID().slice(0, 8);
      const townId = `fenwick-${tag}`;
      const chapelId = `lantern-chapel-${tag}`;
      const expedition = await this.freshExpedition(world.campaignId);
      const town = must(
        await world.admin
          .from('places')
          .insert({ campaign_id: world.campaignId, name: `Fenwick ${tag}`, pack_id: packId, pack_entry_id: townId, safety: 'safe', town: { [`place:${chapelId}`]: { name: 'The Lantern Chapel', kind: 'other', shown: true, open: true } } })
          .select('id')
          .single(),
      );
      const chapel = must(await world.admin.from('places').insert({ campaign_id: world.campaignId, name: `The Lantern Chapel ${tag}`, pack_id: packId, pack_entry_id: chapelId, pack_parent_id: townId }).select('id').single());
      const piece = must(await world.admin.from('place_pieces').insert({ campaign_id: world.campaignId, place_id: chapel.id, kind: 'description', body: 'Candles in green glass.' }).select('id').single());
      const visit = must(await world.admin.from('group_places').insert({ campaign_id: world.campaignId, expedition_id: expedition.id, group_number: 1, place_id: town.id }).select('id').single());
      if (shown) must(await world.admin.from('town_piece_shows').insert({ campaign_id: world.campaignId, group_place_id: visit.id, piece_id: piece.id, group_number: 1 }).select('id'));
      return { visitId: visit.id as string, pieceId: piece.id as string };
    },
    async freshSecretRequest() {
      // A day started for group 1, then Wren's own request to Scout ahead (2 points), as send_request would store it.
      const travel = await this.freshTravel();
      const row = must(
        await world.admin
          .from('requests')
          .insert({
            campaign_id: world.campaignId,
            expedition_id: travel.expeditionId,
            group_number: 1,
            requester_id: world.playerA.id,
            actor_id: this.wren.id,
            kind: 'secretActivity',
            direction: 'playerAsks',
            text: 'Scout ahead',
            prompt: { activityId: 'scout', group: 1, actorIds: [], spend: 2 },
          })
          .select()
          .single(),
      );
      return toRequest(row as Record<string, unknown>);
    },
    async freshAsked(who) {
      const expedition = await this.freshExpedition(world.campaignId);
      const prompt = { roll: { save: 'breath' }, modifiers: [], depth: 0, levelsDown: 1 };
      const asked = who === 'each' ? { requester_id: world.playerA.id, actor_id: this.wren.id } : { requester_id: null, actor_id: null };
      const row = must(
        await world.admin
          .from('requests')
          .insert({ campaign_id: world.campaignId, expedition_id: expedition.id, kind: 'escapeRoll', direction: 'gmAsks', prompt, ...asked })
          .select()
          .single(),
      );
      return toRequest(row as Record<string, unknown>);
    },
    async freshTownCampaign() {
      const id = await this.freshCampaign(false);
      must(await world.admin.from('campaigns').update({ mode: 'adventure' }).eq('id', id).select());
      return id;
    },
    async freshCampaign(retired) {
      const made = must(await world.admin.from('campaigns').insert({ name: 'A fresh campaign', created_by: world.gm.id }).select().single());
      must(await world.admin.from('members').insert({ campaign_id: made.id, user_id: world.gm.id, base_role: 'gm' }).select());
      if (retired) must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', made.id).select());
      return made.id as string;
    },
    async carrier(of) {
      if (of === 'stash') {
        const [stash] = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'));
        return { campaignId: world.campaignId, actorId: null, locationId: stash!.id as string, ownerUserId: null, archived: false };
      }
      const character = of === 'wren' ? this.wren : this.ash;
      return { campaignId: world.campaignId, actorId: character.id, locationId: null, ownerUserId: character.ownerUserId, archived: false };
    },
    async freshFind() {
      // K16b: the GM sends a one-off thing to Player A's character from a fresh place, as the app does (find.give).
      const db = taggedDb(world.gm.db as unknown as Db, { type: 'find.give', level: 'simple', requestId: crypto.randomUUID() }) as unknown as typeof world.gm.db;
      const place = (await this.freshPlace()).placeId!;
      const sent = await db.rpc('give_find', { campaign: world.campaignId, to_actor: world.wrenId, place, things: [{ name: 'A silver hook', qty: 1 }], coins: {}, rows: [] });
      if (sent.error) throw sent.error;
      return sent.data as string;
    },
    async freshCoins(on, coins) {
      // December step 6b: a purse holding exactly this coin; `fallen` is a new character of Player B's who is dead,
      // `archived` a new archived character of Player A's.
      let ref: { campaignId: string; actorId: string | null; locationId: string | null; ownerUserId: string | null; archived: boolean };
      if (on === 'fallen') {
        const fallen = await this.freshCharacter('playerB', 'approved');
        must(await world.admin.from('actors').update({ status: 'dead' }).eq('id', fallen.id).select('id'));
        ref = { campaignId: world.campaignId, actorId: fallen.id, locationId: null, ownerUserId: fallen.ownerUserId, archived: false };
      } else if (on === 'archived') {
        const kept = await this.freshCharacter('playerA', 'approved', true);
        ref = { campaignId: world.campaignId, actorId: kept.id, locationId: null, ownerUserId: kept.ownerUserId, archived: true };
      } else {
        const carrier = await this.carrier(on);
        ref = { campaignId: carrier.campaignId, actorId: carrier.actorId, locationId: carrier.locationId, ownerUserId: carrier.ownerUserId, archived: carrier.archived };
      }
      const purse = ref.actorId ? world.admin.from('purses').update({ coins }).eq('actor_id', ref.actorId) : world.admin.from('purses').update({ coins }).eq('location_id', ref.locationId!);
      expect(must(await purse.select('id'))).toHaveLength(1);
      return { ...ref, downOrDead: on === 'fallen' };
    },
    async freshArmour(on, picked) {
      const carrier = await this.carrier(on);
      const row = must(
        await world.admin
          .from('inventory_lines')
          .insert({
            campaign_id: world.campaignId,
            actor_id: carrier.actorId,
            location_id: carrier.locationId,
            name: 'Glimmer mail',
            category: 'armour',
            weight_coin: 200,
            stack: 1,
            qty: 1,
            how_got: 'found',
            item_data: { slot: 'armour', armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'bark-vest'] } } },
            base_armour_id: picked ? 'reed-coat' : null,
          })
          .select('id')
          .single(),
      );
      return { id: row.id as string, carrier, baseArmourId: picked ? 'reed-coat' : null };
    },
    async freshLine(on, chargesLeft) {
      const carrier = await this.carrier(on);
      const row = must(
        await world.admin
          .from('inventory_lines')
          .insert({ campaign_id: world.campaignId, actor_id: carrier.actorId, location_id: carrier.locationId, name: 'Sling stones', category: 'gear', weight_coin: 1, stack: 20, qty: 3, how_got: 'found', charges_left: chargesLeft ?? null })
          .select('id')
          .single(),
      );
      return { id: row.id as string, carrier };
    },
    async marching(state = {}) {
      const locked = state.locked ?? false;
      const playersReorder = state.playersReorder ?? true;
      // The setting, then a preset to use (made once), then the stored lock (the GM's old function: only the GM
      // writes it; since B11 it stops nobody, which the "locked before the lock went" cases prove on the database).
      const campaign = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single());
      const settings = { ...((campaign.settings as Record<string, unknown> | null) ?? {}), playersReorderMarching: playersReorder };
      must(await world.admin.from('campaigns').update({ settings }).eq('id', world.campaignId).select('id'));
      const read = async () =>
        toMarchingOrder(must(await world.admin.from('marching_orders').select('*').eq('campaign_id', world.campaignId).eq('group_number', 1).single()));
      if (!(await read()).presets.some((p) => p.name === 'Tunnel')) {
        if ((await read()).locked) must(await world.gm.db.rpc('lock_marching_order', { campaign: world.campaignId, lock_it: false }));
        must(await world.gm.db.rpc('set_marching_order', { campaign: world.campaignId, new_rows: [[world.ashId], [world.wrenId]] }));
        must(await world.gm.db.rpc('save_marching_preset', { campaign: world.campaignId, preset_name: 'Tunnel' }));
      }
      // Never in the preset's order, so using it always changes something.
      if (JSON.stringify((await read()).rows) === JSON.stringify([[world.ashId], [world.wrenId]])) {
        must(await world.gm.db.rpc('set_marching_order', { campaign: world.campaignId, new_rows: [[world.wrenId, world.ashId]] }));
      }
      if ((await read()).locked !== locked) must(await world.gm.db.rpc('lock_marching_order', { campaign: world.campaignId, lock_it: locked }));
      const order = await read();
      const wrenFirst = [[world.wrenId], [world.ashId]];
      const rows = JSON.stringify(order.rows) === JSON.stringify(wrenFirst) ? [[world.wrenId, world.ashId]] : wrenFirst;
      return { target: { campaignId: world.campaignId, group: 1, playersReorder }, order, rows };
    },
    async party(state) {
      // The GM's own functions: Wren split off into a group of their own, or every group joined back into the party.
      const at = async () =>
        Number(must(await world.admin.from('party_group_members').select('group_number').eq('actor_id', world.wrenId).single()).group_number);
      if (state === 'split' && (await at()) === 1) must(await world.gm.db.rpc('choose_party_group', { actor: world.wrenId, to_group: null }));
      if (state === 'together') {
        const groups = must(await world.admin.from('party_group_members').select('group_number').eq('campaign_id', world.campaignId)) as { group_number: number }[];
        for (const n of new Set(groups.map((g) => g.group_number).filter((n) => n !== 1))) {
          must(await world.gm.db.rpc('join_party_groups', { campaign: world.campaignId, from_group: n, into_group: 1 }));
        }
      }
      return at();
    },
    async freshStatus(on, levels = false, timed = false) {
      const actor = on === 'wren' ? this.wren : this.ash;
      const levelled = { name: 'Dazed', condition_id: 'dazed', source: 'condition', levels: [{ id: 'dazed', name: 'Dazed' }, { id: 'reeling', name: 'Reeling' }, { id: 'out-cold', name: 'Out cold' }], level: 0 };
      const row = { campaign_id: world.campaignId, actor_id: actor.id, ...(levels ? levelled : { name: 'Muddy boots' }) };
      if (timed) {
        // Timed: 3 turns left of 3 from the clock's now (the GM's stepper changes it).
        const now = Number((await world.admin.from('campaign_clocks').select('seconds').eq('campaign_id', world.campaignId).maybeSingle()).data?.seconds ?? 0);
        const clock = { ends_at: now + 1800, total_seconds: 1800, unit: 'turn', started_at: now };
        return toCharacterStatus(must(await world.admin.from('character_statuses').insert({ ...row, ...clock }).select().single()));
      }
      return toCharacterStatus(must(await world.admin.from('character_statuses').insert(row).select().single()));
    },
    async freshPins(on) {
      // Two fresh trait pins, the list replaced by them so the 24-pin limit is never met (row P2's moves).
      const keys = [`Fen sight ${crypto.randomUUID().slice(0, 8)}`, `Horn charge ${crypto.randomUUID().slice(0, 8)}`];
      const actorId = on === 'wren' ? world.wrenId : world.ashId;
      must(
        await world.admin
          .from('character_play')
          .upsert({ actor_id: actorId, campaign_id: world.campaignId, pins: keys.map((key) => ({ kind: 'trait', key })) })
          .select('actor_id'),
      );
      return keys;
    },
    async freshReadySpell(on, cast = false) {
      const spell = `mire-lamp-${crypto.randomUUID()}`;
      const actorId = on === 'wren' ? world.wrenId : world.ashId;
      must(
        await world.admin
          .from('character_play')
          .upsert({ actor_id: actorId, campaign_id: world.campaignId, prepared: [{ spell, level: 1 }], chosen: null, spells_cast: cast ? { [`1:${spell}`]: 1 } : {} })
          .select('actor_id'),
      );
      return { spell, level: 1 };
    },
    async freshLight(on, holder = false) {
      const carrier = await this.carrier(on);
      const line = must(
        await world.admin
          .from('inventory_lines')
          .insert({ campaign_id: world.campaignId, actor_id: carrier.actorId, name: holder ? 'Reed lamp' : 'Glow-moss', category: 'light', qty: 1, how_got: 'found', item_data: { lightTypeId: holder ? 'reed-lamp' : 'glow-moss' } })
          .select('id')
          .single(),
      ).id as string;
      if (holder) {
        // A flask of fen oil from setting rules (a carried-over copy: it keeps its pack and its id there).
        const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen lights' }).select('id').single()).id;
        must(
          await world.admin
            .from('inventory_lines')
            .insert({ campaign_id: world.campaignId, actor_id: carrier.actorId, name: 'Fen oil', category: 'light', qty: 1, how_got: 'found', source_pack_id: pack, source_entry_id: 'fen-oil' })
            .select('id'),
        );
      }
      const long = 60 * 60 * 24 * 365;
      must(
        await world.admin
          .from('character_lights')
          .update({
            line_id: line,
            type_id: holder ? 'reed-lamp' : 'glow-moss',
            name: holder ? 'Reed lamp' : 'Glow-moss',
            lit_at: 0,
            burn_seconds: holder ? long : null,
            full_seconds: holder ? long : null,
            warn_seconds: null,
            left_seconds: null,
            consumed: false,
            fuel_item: holder ? 'fen-oil' : null,
            keep_lit: false,
            out_at: null,
          })
          .eq('actor_id', carrier.actorId!)
          .select('id'),
      );
      return line;
    },
    async freshPlayersCampaign() {
      const campaignId = await this.freshCampaign(false);
      must(
        await world.admin
          .from('members')
          .insert([
            { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
            { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
          ])
          .select(),
      );
      return campaignId;
    },
    async freshWeather(rolledBy) {
      const campaignId = await this.freshPlayersCampaign();
      must(await world.admin.from('campaigns').update({ settings: { weatherRolledBy: rolledBy } }).eq('id', campaignId).select());
      // Invented setting rules: weather on a d6 table, its first rows wet.
      weatherPack ??= await (async () => {
        const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen weather' }).select('id').single()).id as string;
        must(
          await world.admin
            .from('library_entries')
            .insert([
              { pack_id: pack, kind: 'rulesSet', pack_entry_id: 'fen-weather', name: 'Fen weather', data: { id: 'fen-weather', name: 'Fen weather', weather: { tables: { any: 'fen-sky' }, tags: { wet: { name: 'Wet', note: 'Fires are hard to light' } } } } },
              { pack_id: pack, kind: 'table', pack_entry_id: 'fen-sky', name: 'Fen sky', data: { id: 'fen-sky', name: 'Fen sky', die: 'd6', rows: [{ min: 1, max: 3, result: 'Drizzle', tags: ['wet'] }, { min: 4, max: 6, result: 'Clear skies' }] } },
            ])
            .select('id'),
        );
        return pack;
      })();
      must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: weatherPack, option_choices: {}, priority: 1 }).select());
      // A day-by-day expedition: the rules set's weather is rolled on those (a player enters only the step under way).
      const expedition = must(await world.admin.from('expeditions').insert({ campaign_id: campaignId, mode: 'wilderness' }).select().single());
      return { campaignId, expeditionId: expedition.id as string, tableId: 'fen-sky' };
    },
    async freshWeatherRoll() {
      const { campaignId, expeditionId, tableId } = await this.freshWeather('players');
      return toWeatherRoll(
        must(await world.admin.from('weather_rolls').insert({ campaign_id: campaignId, expedition_id: expeditionId, period: 0, table_id: tableId, roll: '2', result: '—' }).select().single()),
      );
    },
    async freshCompanyInvitation() {
      const companyId = await this.freshCompany();
      const character = await this.freshCharacter('playerA', 'approved');
      return must(
        await world.admin
          .from('company_invitations')
          .insert({ campaign_id: world.campaignId, company_id: companyId, actor_id: character.id, kind: 'invite', created_by: world.gm.id })
          .select('id')
          .single(),
      ).id as string;
    },
    async freshContainer(on) {
      const carrier = await this.carrier(on);
      const sack = must(
        await world.admin
          .from('inventory_lines')
          .insert({ campaign_id: world.campaignId, actor_id: carrier.actorId, name: 'Sack', category: 'gear', qty: 1, how_got: 'found', item_data: { container: { capacityCoin: 200 } } })
          .select('id')
          .single(),
      );
      await world.admin
        .from('inventory_lines')
        .insert({ campaign_id: world.campaignId, actor_id: carrier.actorId, name: 'Chalk', category: 'gear', qty: 1, how_got: 'found', container_line_id: sack.id });
      return { id: sack.id as string, carrier };
    },
    async freshNote(by) {
      const row = must(await person(by).db.from('notes').insert({ campaign_id: world.campaignId, text: 'A fresh note' }).select().single());
      return { id: row.id as string, campaignId: world.campaignId, authorUserId: person(by).id };
    },
    async freshInvite() {
      const row = must(await world.admin.from('invites').insert({ campaign_id: world.campaignId }).select().single());
      return { id: row.id, code: row.code };
    },
  };
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the signed-in person', () => {
  it("loads each person's role in each campaign", () => {
    expect(users.gm.roles[world.campaignId]).toBe('gm');
    expect(users.playerA.roles[world.campaignId]).toBe('player');
    expect(users.outsider.roles[world.campaignId]).toBeUndefined();
  });
});

describe('the app and the database agree', () => {
  it.each(permissionCases.map((c) => [c.says, c] as const))('%s', async (_says, c) => {
    const { target, run } = await c.prepare(cases);
    // Loaded again: a case may have just made a campaign this person runs.
    const user = await loadCurrentUser(person(c.who).db as unknown as Db);
    if (!user) throw new Error(`${c.who} isn't signed in`);
    expect(registry.can(user, c.commandName, target)).toBe(c.allowed);
    // Run it for real, skipping the app's check, so the database's rules decide. Tagged like runCommand does,
    // so its events can be found.
    const requestId = crypto.randomUUID();
    const db = taggedDb(person(c.who).db as unknown as Db, { type: c.commandName, level: 'simple', requestId });
    const result = await run(db, user);
    expect(result.ok, result.ok ? 'the database allowed it' : `the database refused: ${result.message}`).toBe(c.allowed);
    // A refusal must come from the access rules, not from some other error that would hide a broken command.
    if (!result.ok) expect(result.reason, result.message).toBe('not-allowed');

    // Everything allowed is logged under the command's name; nothing refused is logged at all.
    const logged = must(await world.admin.from('events').select('type').eq('request_id', requestId)) as { type: string }[];
    if (!c.allowed) expect(logged).toEqual([]);
    else if (!UNLOGGED.has(c.commandName) && !c.changesNothing) {
      expect(logged.length, 'no event was written').toBeGreaterThan(0);
      expect([...new Set(logged.map((e) => e.type))]).toEqual([c.commandName]);
    }
  });
});

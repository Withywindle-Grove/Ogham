// An in-memory stand-in for Supabase, for click-through smoke tests of the screens.
// It answers only the calls the sign-in and campaign screens make, and mimics the database's
// behaviour for them. The real access rules are checked separately in supabase/tests.
import { RETIRED, STALE, STALE_CODE } from '../core/commands.ts';
import { isJoin, UNDOABLE_DELETIONS, UNDOABLE_MAKINGS, UNDOABLE_SPLIT } from '../core/undo.ts';
import { isRumoursTable as rumoursTable } from '../modules/library/rumours.ts';
import { joinsAtOnce, partyLowest, startLevelFixedOf, startLevelLimit, startLevelOf } from '../core/campaignSettings.ts';
import type { Db } from '../core/supabase.ts';
import { plainLinks } from '../modules/library/linkMarks.ts';
import { PATRON_GM_FIELDS, PLAYER_FACING, playerFacingEntry, type EntryKind, type PatchTargets } from '../modules/library/packFile.ts';
import { routeWays } from '../modules/library/routes.ts';
import { stockDefault } from '../modules/requests/shopStock.ts';
import { hiddenFacts } from '../modules/inventory/hiddenFacts.ts';

type Row = Record<string, unknown>;

// What the travel migration (…_m5b_1_travel.sql) adds to public.undoable_makings. The app's own list (core/undo.ts)
// should hold them too; until it does, the stand-in follows the database.
const TRAVEL_MAKINGS = ['travel.dayStart', 'travel.move', 'travel.forceMarch', 'travel.lost.set'];
// Like the database (fm-1): the travel commands whose lines are their group's.
const TRAVEL_GROUP_LINES = ['travel.dayStart', 'travel.move', 'travel.setBudget', 'travel.forceMarch', 'travel.spendDay'];
/** Like the reading rules (fm-1): a group's line or note is read by the players who were in the group when it was written. */
const inGroupThen = (row: Record<string, unknown>, userId: string | null) =>
  row.audience === 'group' && Array.isArray(row.group_user_ids) && userId !== null && row.group_user_ids.includes(userId);
type Result = { data: unknown; error: { message: string; code?: string } | null };

/** The code every fake sign-in email "contains". */
export const FAKE_EMAIL_CODE = '246810';

export interface FakeWorld {
  db: Db;
  tables: Record<
    | 'profiles'
    | 'campaigns'
    | 'members'
    | 'actors'
    | 'character_alignments'
    | 'companies'
    | 'invites'
    | 'field_definitions'
    | 'assets'
    | 'events'
    | 'notes'
    | 'packs'
    | 'library_entries'
    | 'campaign_packs'
    | 'campaign_pack_secrets'
    | 'library_entry_secrets'
    | 'campaign_rules_revs'
    | 'inventory_lines'
    | 'locations'
    | 'inventory_line_secrets'
    | 'carrier_loads'
    | 'rolls'
    | 'character_layouts'
    | 'character_play'
    | 'company_invitations'
    | 'campaign_clocks'
    | 'sessions'
    | 'expeditions'
    | 'expedition_places'
    | 'places'
    | 'place_notes'
    | 'group_places'
    | 'place_moves'
    | 'place_pieces'
    | 'piece_shows'
    | 'place_rule_switches'
    | 'knowledge_shares'
    | 'gm_messages'
    | 'message_recipients'
    | 'messages'
    | 'requests'
    | 'sheet_changes'
    | 'reminders'
    | 'check_results'
    | 'table_pins'
    | 'table_reads'
    | 'waiting_encounters'
    | 'character_lights'
    | 'weather_rolls'
    | 'marching_orders'
    | 'party_groups'
    | 'party_group_members'
    | 'character_statuses'
    | 'status_secrets'
    | 'character_rests'
    | 'travel_groups'
    | 'travel_group_secrets'
    | 'group_lost'
    | 'camps'
    | 'camp_entries'
    | 'activity_runs'
    | 'purses'
    | 'hook_sends'
    | 'finds_seen'
    | 'calls_seen'
    | 'shop_stock',
    Row[]
  >;
  /** Stored files by path (<campaign id>/<asset id>). */
  files: Map<string, Blob>;
  /** Emails a sign-in code was sent to, in order. */
  codesSentTo: string[];
  addPerson(email: string, displayName?: string): string;
  addCampaign(name: string, gmId: string): string;
  addMember(campaignId: string, userId: string, role: 'gm' | 'player', activeActorId?: string): void;
  addCharacter(
    campaignId: string,
    name: string,
    options?: { ownerId?: string; approval?: 'draft' | 'pending' | 'approved' | 'rejected'; companyName?: string },
  ): string;
  addInvite(campaignId: string, code: string, status?: string): void;
  /** Start the app already signed in as this person. */
  signInAs(userId: string): void;
  /** The options each signOut call was given, in order. */
  signOutCalls: Array<{ scope?: string }>;
  /** Sends an auth event to the app without changing the stored session (a sign-out the device didn't ask for). */
  emitAuthEvent(event: string, userId: string | null): void;
  /** Forgets the stored session without telling the app (storage cleared or a refresh token revoked). */
  loseStoredSession(): void;
}

export function createFakeDb(): FakeWorld {
  let nextId = 1;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;
  const tables: FakeWorld['tables'] = {
    profiles: [],
    campaigns: [],
    members: [],
    actors: [],
    // A character's alignment, in its own table (M5b step 0c): read as the setting's alignmentVisibility allows.
    character_alignments: [],
    companies: [],
    invites: [],
    field_definitions: [],
    assets: [],
    events: [],
    notes: [],
    packs: [],
    library_entries: [],
    campaign_packs: [],
    campaign_pack_secrets: [],
    library_entry_secrets: [],
    campaign_rules_revs: [],
    // Inventory (M4): read by the log for item and place names; screens arrive in step 4.
    inventory_lines: [],
    locations: [],
    inventory_line_secrets: [],
    carrier_loads: [],
    rolls: [],
    character_layouts: [],
    character_play: [],
    company_invitations: [],
    // The clock, sessions and expeditions (M5 step 5).
    campaign_clocks: [],
    sessions: [],
    expeditions: [],
    // Where an expedition started (M5 step 10, DG1): the GM's alone.
    expedition_places: [],
    // Places per group and messages (M5 step 11): kept empty in the stand-in (supabase/tests/m5-places.test.ts
    // checks the real rules).
    places: [],
    place_notes: [],
    group_places: [],
    // Move on's records (December step 4, piece c): the way taken and its turns, the GM's alone.
    place_moves: [],
    // A place's pieces and which a group sees (M5b g2): the GM's alone; players read shown ones through scene_pieces.
    place_pieces: [],
    piece_shows: [],
    // The GM's switches on a place's rules (December dec-7 piece 3): the GM's alone; players read through
    // place_rules_for_players and encounter_check_for_players.
    place_rule_switches: [],
    // The GM's shares of a place's Knowledge (P4, p4s-2): the GM's alone; players read through knowledge_for_players.
    knowledge_shares: [],
    gm_messages: [],
    message_recipients: [],
    // Messaging (M5b g4): one row per message, in its character's thread.
    messages: [],
    // Requests (M5 step 12): a player asks, the GM answers; read by the GM and the requester (everyone, the party's).
    requests: [],
    // Sheet changes (m5b sheet revised, B): a score or Max HP asked of the GM; read by the GM and the character's player.
    sheet_changes: [],
    // The GM's reminders and check results (M5 step 6).
    reminders: [],
    check_results: [],
    // The GM's pins for this session and rows read by hand (M5b step g3).
    table_pins: [],
    table_reads: [],
    // Encounter waiting cards (M5b step 2), the GM's alone.
    waiting_encounters: [],
    // Lights (M5 step 7): one row per character, made by the database with it (here, when first read).
    character_lights: [],
    // Today's weather (M5b).
    weather_rolls: [],
    // Marching order (M5 step 8): one row per campaign, made by the database with it (here, when first read).
    marching_orders: [],
    // Party groups (M5 step 8, DG14): group 1 per campaign and a member row per character, made by the database
    // (here, when first read or changed).
    party_groups: [],
    party_group_members: [],
    // Statuses and rest (M5 step 9): statuses on characters, secret timers (the GM's alone), and a rest row per
    // character (made by the database with it; here, when first read or changed).
    character_statuses: [],
    status_secrets: [],
    character_rests: [],
    // Travel per group and Lost (M5b step 1): the GM reads all; a player their own group's travel, and its Lost only
    // while the campaign's Getting lost is Open.
    travel_groups: [],
    // The GM's part of a travel row (fm-1): the place the group is entering, as the GM names it. Only the GM reads it.
    travel_group_secrets: [],
    group_lost: [],
    // Camp (M5b step 4) and activities (M5b step 3): made through the functions (campRpcs), read by group.
    camps: [],
    camp_entries: [],
    activity_runs: [],
    // Purses (December step 6a): a row per character, hireling and Party stash (made by the database with them; here,
    // when first read). Read by the owner and the GM, by everyone for the stash and for a Down or dead character.
    purses: [],
    // Calls to adventure (dec-12 piece B): one row per send of a hook, made by send_hook.
    hook_sends: [],
    // The seen mark (K20, pk-13): one row per character, written only by mark_finds_seen.
    finds_seen: [],
    // The seen mark on a call (P7, p7-1): one row a send and a player, written only by mark_call_seen.
    calls_seen: [],
    // A shop's stock for the day (W12): written only by set_shop_stock and reset_shop_stock.
    shop_stock: [],
  };
  const files = new Map<string, Blob>();

  // Like the storage rules: the GM, or whoever uploaded a portrait, may write or remove its file;
  // members may read files they can see (portraits are visible to all members).
  const assetAt = (path: string) => tables.assets.find((a) => `${String(a.campaign_id)}/${String(a.id)}` === path);
  const isGmOf = (campaignId: unknown) =>
    tables.members.some((m) => m.campaign_id === campaignId && m.user_id === me() && m.base_role === 'gm');
  // Like private.score_keys: the top attached rules set's abilities, each as written and as a field key.
  const scoreKeysOf = (campaignId: unknown): string[] => {
    const sets = tables.campaign_packs
      .filter((cp) => cp.campaign_id === campaignId)
      .flatMap((cp) => {
        const pack = tables.packs.find((pk) => pk.id === cp.pack_id);
        return tables.library_entries
          .filter((e) => e.pack_id === cp.pack_id && e.kind === 'rulesSet' && Array.isArray((e.data as Row | null)?.abilities) && ((e.data as Row).abilities as unknown[]).length > 0)
          .map((e) => ({ homebrew: pack?.kind === 'homebrew' ? 1 : 0, priority: Number(cp.priority ?? 0), abilities: (e.data as Row).abilities as unknown[] }));
      })
      .sort((a, b) => b.homebrew - a.homebrew || b.priority - a.priority);
    const keys = (sets[0]?.abilities ?? []).flatMap((a) => (typeof a === 'string' ? [a] : a && typeof a === 'object' && typeof (a as Row).key === 'string' ? [String((a as Row).key)] : []));
    return keys.flatMap((k) => [k, k.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36)]);
  };
  const isMemberOf = (campaignId: unknown) => tables.members.some((m) => m.campaign_id === campaignId && m.user_id === me());
  // Like private.group_read_as (C15f; ruling a2): whose characters' groups a players' read answers for: the reader's own,
  // or with `as_player` that player's, for the campaign's GM only and a member named; anyone else, nobody's.
  const readerAs = (campaign: unknown, asPlayer: unknown): string =>
    asPlayer == null ? String(me()) : isGmOf(campaign) && tables.members.some((m) => m.campaign_id === campaign && m.user_id === asPlayer) ? String(asPlayer) : '(nobody)';
  const mayWrite = (path: string) => {
    const asset = assetAt(path);
    return !!asset && (isGmOf(asset.campaign_id) || (asset.kind === 'portrait' && asset.uploaded_by === me()));
  };
  // Like the database's trigger (supabase/migrations/…_m2_events.sql): an event for every changed row.
  const watchers = new Set<{ campaignId: string; onNew: () => void; me: string | null }>();
  let seq = 0;
  // The next log number: past every line already in the log, so lines a page seeded by hand (the layout page's
  // event-1 to event-5) are never numbered or named twice (the duplicate key event-5 on #741's pictures).
  const nextSeq = () => (seq = Math.max(seq, ...tables.events.map((e) => Number(e.seq) || 0)) + 1);
  const mayRead = (event: Row, userId: string | null) =>
    tables.members.some(
      (m) =>
        m.campaign_id === event.campaign_id &&
        m.user_id === userId &&
        (m.base_role === 'gm' || (revealedEvent(tables, event) && (event.audience === 'all' || (event.audience === 'owner' && event.owner_user_id === userId) || inGroupThen(event, userId)))),
    );
  // The character's player, for a seen mark's lines (like private.log_audience_finds_seen); null for a party's or the GM's.
  const markOwner = (row: Row): string | null => {
    const actor = tables.actors.find((a) => a.id === row.actor_id);
    return actor && actor.owner_type === 'user' && typeof actor.owner_user_id === 'string' ? actor.owner_user_id : null;
  };
  /** Like private.log_audience_purses: the player whose character's purse it is (a hireling's employer); null otherwise. */
  const purseOwner = (row: Row): string | null => {
    const actor = row.actor_id ? tables.actors.find((a) => a.id === row.actor_id) : undefined;
    return actor && (actor.owner_type ?? 'user') === 'user' && typeof actor.owner_user_id === 'string' ? actor.owner_user_id : null;
  };
  // TC12: the answer ask_for_thing gives the request it is making (the database's `grimoire.stock_answer`).
  let stockAnswer: { campaign: string; actor: string; item: string; answer: Row } | null = null;
  const log: EventLog = (table, before, after, tag, reverting) => {
    const row = after ?? before!;
    // Like the database: a library entry is logged only in the campaign whose own homebrew holds it.
    const campaignId =
      table === 'campaigns' ? row.id : table === 'library_entries' ? (tables.packs.find((p) => p.id === row.pack_id)?.campaign_id ?? null) : row.campaign_id;
    if (campaignId === null || campaignId === undefined) return;
    // Like the database: a link's GM-only part is made and goes with the link; only its changes are logged.
    if (table === 'campaign_pack_secrets' && !(before && after)) return;
    // Like the database: a line's version number is never in the log (M5 step 4).
    const unversioned = (r: Row | null) => {
      if (!r || !('version' in r)) return r;
      const rest = { ...r };
      delete rest.version;
      return rest;
    };
    let changedBefore: Row | null = unversioned(before);
    let changedAfter: Row | null = unversioned(after);
    if (before && after) {
      changedBefore = {};
      changedAfter = {};
      for (const key of Object.keys(after)) {
        if (key !== 'updated_at' && key !== 'version' && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          changedBefore[key] = before[key] ?? null;
          changedAfter[key] = after[key];
        }
      }
      if (Object.keys(changedAfter).length === 0) return;
    }
    // Like the database: what a character carries is seen like the character.
    const carried =
      table === 'inventory_lines' ||
      table === 'carrier_loads' ||
      table === 'character_layouts' ||
      table === 'character_play' ||
      table === 'character_lights' ||
      table === 'character_statuses' ||
      table === 'character_rests';
    const carrier = carried && row.actor_id ? tables.actors.find((a) => a.id === row.actor_id) : undefined;
    const approved = carried ? !carrier || carrier.approval === 'approved' : before?.approval === 'approved' || after?.approval === 'approved';
    // Like the database (fm-1, private.log_audience_travel_groups): a travel command's line, and its undo, are the
    // group's: read by the players in the group when the line is written, and the GM.
    const groupLine = table === 'travel_groups' && (reverting ? reverting.audience === 'group' : TRAVEL_GROUP_LINES.includes(String(tag?.type)));
    const audience =
      table === 'notes'
        ? String(row.audience)
        : groupLine
          ? 'group'
        : // Like the database (M5b step 0c): an alignment's lines are its owner's (the GM reads every line).
          table === 'character_alignments'
          ? row.owner_user_id
            ? 'owner'
            : 'gm'
        : // Like the database (m5b sheet changes): a change's lines are its player's (the GM reads every line).
          table === 'sheet_changes'
          ? row.requester_id
            ? 'owner'
            : 'gm'
        : // Like the database (dec-12 B): a send to the party is everyone's; to a character, its player's.
          table === 'hook_sends'
          ? row.actor_id === null
            ? 'all'
            : row.player_user_id
              ? 'owner'
              : 'gm'
        : // Like the database (P7): a call's seen mark's lines are its player's alone, even for a call to the party.
          table === 'calls_seen'
          ? 'owner'
        : // Like the database (K20): a seen mark's lines are its character's player's (the GM reads every line).
          table === 'finds_seen'
          ? markOwner(row)
            ? 'owner'
            : 'gm'
        : // Like the database (December step 6a): a purse's lines are its player's (the GM reads every line), a party's
          // or the GM's own character's the GM's alone; the stash's coin lines everyone's.
          table === 'purses'
          ? purseOwner(row)
            ? 'owner'
            : row.location_id
              ? 'all'
              : 'gm'
        : table === 'invites' ||
            table === 'campaign_pack_secrets' ||
            table === 'inventory_line_secrets' ||
            // Like the database (M5 step 9): a secret timer's lines are the GM's alone.
            table === 'status_secrets' ||
            // Like the database (M5 step 10): where an expedition started is the GM's alone (DG9).
            table === 'expedition_places' ||
            // Like the database (M5 step 11): places and where groups are are the GM's lines alone.
            table === 'places' ||
            table === 'group_places' ||
            // Like the database (December step 4, piece c): a move's record (the way taken) is the GM's alone.
            table === 'place_moves' ||
            table === 'place_pieces' ||
            table === 'piece_shows' ||
            // Like the database (fm-1): the GM's part of a travel row is the GM's alone.
            table === 'travel_group_secrets' ||
            table === 'place_rule_switches' ||
            table === 'knowledge_shares' ||
            // Like the database (W12): a shop's stock lines are the GM's alone (whether players read a thing coming in is open).
            table === 'shop_stock' ||
            // Like the database (M5b step g3): pins and rows read by hand are the GM's alone.
            table === 'table_pins' ||
            table === 'table_reads' ||
            // Like the database (M5b step 2): waiting encounters are the GM's alone.
            table === 'waiting_encounters' ||
            // Like the database (M5b step 1): Lost lines are the GM's (players read the state itself). So is a change
            // to a travel row that isn't a travel command's own line or its undo (fm-1: an activity's cost, a secret
            // activity the GM accepted).
            (table === 'travel_groups' && !groupLine) ||
            table === 'group_lost' ||
            (table === 'assets' && !['portrait', 'sigil'].includes(String(row.kind))) ||
            // Like the database (look-back review of #437): a patch's targets decide too (any campaign using the pack),
            // on the row before and after (local review of #629: `before` must not carry a hidden patch to everyone).
            (table === 'library_entries' &&
              [before, after].some((r) => r && !playerFacingEntry(String(r.kind), r.data, r.kind === 'patch' ? patchTargetsIn(tables, r.pack_id, () => true) : undefined))) ||
            // Like the database (M5 step 6): a reminder's lines are everyone's only while it's public before and after.
            (table === 'reminders' && !((!before || before.is_public === true) && (!after || after.is_public === true)))
        ? 'gm'
        : (table === 'actors' || carried) && !approved
          ? (table === 'actors' ? row.owner_type : carrier?.owner_type) === 'user'
            ? 'owner'
            : 'gm'
          : 'all';
    nextSeq();
    const event: Row = {
      id: `event-${seq}`,
      seq,
      campaign_id: campaignId,
      type: tag?.type ?? `${table}.${before && after ? 'update' : after ? 'insert' : 'delete'}`,
      level: reverting ? reverting.level : tag?.level === 'simple' ? 'simple' : 'verbose',
      actor_user_id: me(),
      target_table: table,
      target_id: row.id ?? row.actor_id ?? null,
      before: changedBefore,
      after: changedAfter,
      // Like the database: only the GM's changes can be fiat.
      fiat: !!tag?.fiat && isGmOf(campaignId),
      // A spend's few words (December step 6b) when it isn't a GM ruling with its own reason.
      // A purse function's own words (a spend's, a move's "with:…") win over a GM ruling's reason, as the database has it.
      reason: tag?.whatFor ?? (tag?.fiat && isGmOf(campaignId) && tag.reason ? tag.reason : null),
      reverts_event_id: reverting?.id ?? null,
      audience,
      owner_user_id:
        audience === 'owner'
          ? ((table === 'purses' ? purseOwner(row) : table === 'finds_seen' ? markOwner(row) : carried ? carrier?.owner_user_id : (row.owner_user_id ?? row.requester_id ?? row.player_user_id)) ?? null)
          : null,
      // Like the database (fm-1): a group's line keeps its group and who was in it then; a note's copies its entry's.
      group_number: groupLine ? Number(row.group_number) : null,
      group_user_ids: audience !== 'group' ? null : table === 'notes' ? ((row.group_user_ids as string[] | null) ?? []) : groupReaders(campaignId, Number(row.group_number)),
      // Like the database (M5 step 6): a check result's lines reach players once the campaign goes into Downtime.
      reveal_at: table === 'check_results' && row.revealed !== true ? 'downtime' : 'now',
      request_id: tag?.requestId ?? null,
      created_at: new Date().toISOString(),
    };
    tables.events.push(event);
    for (const watcher of watchers) {
      // Like the database's private.tick_place_rule_switch (dec-7 piece 3): a switch on a place's rule ticks every
      // group's signal, so players' screens read again though the line itself is the GM's.
      if (watcher.campaignId === campaignId && (mayRead(event, watcher.me) || table === 'place_rule_switches')) queueMicrotask(watcher.onNew);
    }
  };
  // Like the database: an entry's gmOnly fields (and the list) are kept apart, where players can't read them.
  const splitHidden = (entry: Row, dataChanged: boolean) => {
    const data = (entry.data ?? {}) as Row;
    // A rules set's GM-only sections are kept apart too (2026-10-23).
    // Special seasons' start chances and encounter swaps are the GM's (2026-10-30): the whole section is kept apart,
    // and players get it without them.
    const forPlayers = (seasons: unknown) =>
      Array.isArray(seasons) ? seasons.map((s) => (s && typeof s === 'object' ? Object.fromEntries(Object.entries(s as Row).filter(([k]) => k !== 'start' && k !== 'encounterSwap')) : s)) : seasons;
    const seasonsLeak = entry.kind === 'rulesSet' && JSON.stringify(forPlayers(data.specialSeasons)) !== JSON.stringify(data.specialSeasons);
    const sections =
      entry.kind === 'rulesSet'
        ? Object.entries(data)
            .filter(([key, value]) => ['monsters', 'magicItems', 'procedures'].includes(key) || (key === 'specialSeasons' && seasonsLeak) || (value !== null && typeof value === 'object' && (value as Row).gmOnly === true))
            .map(([key]) => key)
        : // A patron's cult and stat block are the GM's (20261111130000_dec_1a_patrons.sql).
          entry.kind === 'patron'
          ? PATRON_GM_FIELDS.filter((key) => key in data)
          : [];
    if (Array.isArray(data.gmOnly) || sections.length > 0) {
      const names = [...(Array.isArray(data.gmOnly) ? (data.gmOnly as unknown[]).map(String) : []), ...sections];
      const hidden: Row = Array.isArray(data.gmOnly) ? { gmOnly: data.gmOnly } : {};
      const visible: Row = {};
      for (const [key, value] of Object.entries(data)) {
        if (names.includes(key)) hidden[key] = value;
        else if (key !== 'gmOnly') visible[key] = value;
      }
      // Players receive a rules set's magicItems.charges (2026-10-23); the rest of magicItems stays the GM's.
      const magic = data.magicItems as Row | undefined;
      if (entry.kind === 'rulesSet' && magic && typeof magic.charges === 'object') visible.magicItems = { charges: magic.charges };
      if (seasonsLeak) visible.specialSeasons = forPlayers(data.specialSeasons);
      entry.data = visible;
      tables.library_entry_secrets = tables.library_entry_secrets.filter((s) => s.id !== entry.id);
      tables.library_entry_secrets.push({ id: entry.id, pack_id: entry.pack_id, data: hidden });
    } else if (dataChanged) {
      tables.library_entry_secrets = tables.library_entry_secrets.filter((s) => s.id !== entry.id);
    }
  };
  const importPack = (args: Row): Result => {
    const user = me();
    const meta = args.meta as Row;
    const entries = args.entries as Row[];
    if (!user) return { data: null, error: { message: 'Sign in first.', code: '42501' } };
    if (!Array.isArray(entries) || entries.length === 0) return { data: null, error: { message: 'A pack needs at least one entry.' } };
    const kinds = ['fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table', 'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList', 'gmReferencePanel', 'location', 'patch', 'patron', 'route', 'adventureHook', 'map', 'npc', 'shop'];
    if (entries.some((e) => !kinds.includes(String(e.kind)))) return { data: null, error: { message: 'invalid kind' } };
    const now = new Date().toISOString();
    const details = {
      name: meta.name,
      version: meta.version ?? '',
      kind: meta.kind ?? 'setting',
      format_version: meta.format_version ?? 1,
      source: meta.source ?? '',
      notes: meta.notes ?? '',
      extra_meta: meta.extra ?? {},
      updated_at: now,
    };
    let packId: string;
    if (args.replace_pack_id) {
      const pack = tables.packs.find((x) => x.id === args.replace_pack_id && x.owner_user_id === user);
      if (!pack) return { data: null, error: { message: "You don't have permission to do that.", code: '42501' } };
      Object.assign(pack, details);
      packId = String(pack.id);
      const keep = new Set(entries.map((e) => `${String(e.kind)}/${String(e.pack_entry_id)}`));
      tables.library_entries = tables.library_entries.filter(
        (e) => e.pack_id !== packId || keep.has(`${String(e.kind)}/${String(e.pack_entry_id)}`),
      );
    } else {
      packId = newId('pack');
      tables.packs.push({ id: packId, owner_user_id: user, campaign_id: null, created_at: now, ...details });
    }
    for (const e of entries) {
      const found = tables.library_entries.find((x) => x.pack_id === packId && x.kind === e.kind && x.pack_entry_id === e.pack_entry_id);
      if (found) {
        Object.assign(found, { name: e.name, data: e.data });
        splitHidden(found, true);
      } else {
        const made: Row = { id: newId('entry'), pack_id: packId, kind: e.kind, pack_entry_id: e.pack_entry_id, name: e.name, data: e.data };
        splitHidden(made, false);
        tables.library_entries.push(made);
      }
    }
    return { data: packId, error: null };
  };
  const undo = (eventId: string, tag: { type: string; level: string; requestId: string } | null): Result => {
    const picked = tables.events.find((e) => e.id === eventId);
    const user = me();
    const gm = picked && tables.members.some((m) => m.campaign_id === picked.campaign_id && m.user_id === user && m.base_role === 'gm');
    if (!picked || !(gm || picked.actor_user_id === user)) {
      return { data: null, error: { message: "You don't have permission to do that.", code: '42501' } };
    }
    // Like the database (fm-1, private.undo_own_march): a player undoes their own forced march only on a line they
    // read as one of the group's players, and while they are still in that group.
    const march = picked.type === 'travel.forceMarch';
    if (march && picked.target_table === 'travel_groups' && !gm && !(inGroupThen(picked, user) && inMyGroup(picked.campaign_id, Number(picked.group_number)))) {
      return { data: null, error: { message: "You don't have permission to do that.", code: '42501' } };
    }
    let changes = tables.events
      // Like the database: one action's changes share its request id AND its author.
      .filter((e) => e.id === picked.id || (picked.request_id && e.request_id === picked.request_id && e.actor_user_id === picked.actor_user_id))
      .sort((a, b) => Number(b.seq) - Number(a.seq));
    const rowOf = (e: Row) => tables[e.target_table as (typeof LOGGED)[number]].find((r) => (r.id ?? r.actor_id) === e.target_id);
    // Like private.coin_action_lines (the lead, 2026-11-13): an Undo of a coin line can't itself be undone. The GM reads
    // why; a player picking their own reversal gets the plain refusal, as the database's own path gives them.
    if (picked.target_table === 'purses' && picked.reverts_event_id) {
      return gm
        ? { data: null, error: { message: "An Undo of coin can't be undone. Move the coin again instead." } }
        : { data: null, error: { message: "You don't have permission to do that.", code: '42501' } };
    }
    // Like private.coin_action_lines (review, 2026-11-13): a coin action is undone only exactly as the purse functions
    // made it: its request id, no reversal in it, every line on a purse and of one type, a spend, add or remove one line,
    // a give or take exactly two lines on two purses balancing coin by coin. Like private.undo_coin_checked, its
    // reversal lines are filed under an id of the database's own, never the device's.
    if (picked.target_table === 'purses' || changes.some((e) => e.target_table === 'purses')) {
      tag = { type: tag?.type ?? 'event.undo', level: tag?.level ?? 'simple', requestId: crypto.randomUUID() };
      const coinTypes = ['purse.add', 'purse.remove', 'purse.spend', 'purse.give', 'purse.take'];
      const single = ['purse.add', 'purse.remove', 'purse.spend'].includes(String(picked.type));
      const totals = new Map<string, number>();
      for (const e of changes) {
        const was = ((e.before as Row | null)?.coins ?? {}) as Record<string, number>;
        const now = ((e.after as Row | null)?.coins ?? {}) as Record<string, number>;
        for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) totals.set(k, (totals.get(k) ?? 0) + Number(now[k] ?? 0) - Number(was[k] ?? 0));
      }
      const balanced = [...totals.values()].every((n) => n === 0);
      const shaped =
        !!picked.request_id && !picked.reverts_event_id && coinTypes.includes(String(picked.type)) &&
        changes.every((e) => e.target_table === 'purses' && e.type === picked.type && !e.reverts_event_id) &&
        (single ? changes.length === 1 : changes.length === 2 && new Set(changes.map((e) => e.target_id)).size === 2 && balanced);
      if (!shaped) return { data: null, error: { message: "You don't have permission to do that.", code: '42501' } };
      // For a player, as the purses are now: their own side still theirs and in play, a give's receiver still open.
      if (!gm) {
        const way = (e: Row) => {
          const was = ((e.before as Row | null)?.coins ?? {}) as Record<string, number>;
          const now = ((e.after as Row | null)?.coins ?? {}) as Record<string, number>;
          return Math.sign([...new Set([...Object.keys(was), ...Object.keys(now)])].reduce((sum, k) => sum + Number(now[k] ?? 0) - Number(was[k] ?? 0), 0));
        };
        const stale = changes.some((e) => {
          const purse = tables.purses.find((p) => p.id === e.target_id);
          if (!purse) return false;
          const w = way(e);
          if ((picked.type === 'purse.spend' || picked.type === 'purse.give') && w < 0) return !ownsPurse(purse);
          if (picked.type === 'purse.give' && w > 0) return !mayReceiveCoin(purse);
          if (picked.type === 'purse.take' && w > 0) return !ownsPurse(purse);
          return false;
        });
        if (stale) return { data: null, error: { message: "That's changed since. Undo the later change first." } };
      }
    }
    // Like private.coin_action_lines (the lead, 2026-11-13): a player's take goes back only while they may still read
    // the purse it came from (the stash; a character still Down or dead).
    if (!gm && picked.type === 'purse.take') {
      const source = changes.find((e) => {
        const was = ((e.before as Row | null)?.coins ?? {}) as Record<string, number>;
        const now = ((e.after as Row | null)?.coins ?? {}) as Record<string, number>;
        return Object.keys(was).some((k) => Number(now[k] ?? 0) < Number(was[k]));
      });
      const purse = source ? tables.purses.find((p) => p.id === source.target_id) : undefined;
      if (purse && (!mayReadPurseRow(purse) || !mayReceiveCoin(purse))) return { data: null, error: { message: "That's changed since. Undo the later change first." } };
    }
    // Like the database: a drop or a gift outside the party are the deletions that can be undone (ruled
    // 2026-10-25); a line the action both made and removed (part of a stack given away) is left out.
    const drop = UNDOABLE_DELETIONS.includes(String(picked.type));
    const removed = new Set(changes.filter((e) => !e.after && e.target_table === 'inventory_lines').map((e) => e.target_id));
    const passing = new Set(changes.filter((e) => !e.before && e.target_table === 'inventory_lines' && removed.has(e.target_id)).map((e) => e.target_id));
    if (drop) changes = changes.filter((e) => !(['inventory_lines', 'inventory_line_secrets'].includes(String(e.target_table)) && passing.has(e.target_id)));
    const dropped = changes.filter((e) => !e.after && e.target_table === 'inventory_lines');
    const refused = (message: string): Result => ({ data: null, error: { message } });
    // Like the database: part of a stack moved (ruled 2026-10-26) merges back while it's as the move left it.
    const splits = new Set(
      picked.type === UNDOABLE_SPLIT ? changes.filter((e) => !e.before && e.after && e.target_table === 'inventory_lines').map((e) => e.target_id) : [],
    );
    // Like private.given_left (5b): what's left of a moved line, refused if some was passed on or there's more of it.
    const givenLeft = (moved: Row): { back?: { left: number; of: number; name: string; by: string }; refusal?: string } => {
      const row = rowOf(moved);
      if (!row || Number(row.qty) < 1) return { refusal: 'None of it is left, so nothing can come back.' };
      const later = tables.events.filter((e) => e.target_table === 'inventory_lines' && e.target_id === moved.target_id);
      if (later.some((e) => Number(e.seq) > Number(moved.seq) && ['inventory.move', 'inventory.giveAway'].includes(String(e.type)) && e.after && 'qty' in (e.after as Row))) {
        return { refusal: "Some of it was passed on since, so it can't go back. Undo that first." };
      }
      const counted = later.filter((e) => Number(e.seq) <= Number(moved.seq) && e.after && 'qty' in (e.after as Row)).sort((a, b) => Number(b.seq) - Number(a.seq))[0];
      const of = counted ? Number((counted.after as Row).qty) : Number(row.qty);
      if (Number(row.qty) > of) return { refusal: "That's changed since. Undo the later change first." };
      const by = String(tables.actors.find((a) => a.id === row.actor_id)?.name ?? tables.locations.find((l) => l.id === row.location_id)?.name ?? '');
      return { back: { left: Number(row.qty), of, name: String(row.name), by } };
    };
    let cameBack: { left: number; of: number; name: string; by: string } | null = null;
    let used = 0;
    for (const change of changes.filter((e) => e.target_table === 'inventory_lines' && splits.has(e.target_id) && !e.before)) {
      if (tables.events.some((e) => e.reverts_event_id === change.id)) return refused('That was already undone.');
      const row = rowOf(change);
      if (!row) return refused('None of it is left, so nothing can come back.');
      const expected: Row = {};
      for (const e of [...changes].reverse()) if (e.target_id === change.target_id && e.after) Object.assign(expected, e.after);
      if (Object.keys(expected).some((key) => key !== 'updated_at' && key !== 'qty' && JSON.stringify(row[key]) !== JSON.stringify(expected[key]))) {
        return refused("The part that was moved has changed since, so it can't go back.");
      }
      const left = givenLeft(change);
      if (left.refusal) return refused(left.refusal);
      cameBack = left.back!;
      used = cameBack.of - cameBack.left;
    }
    // Like private.undo_check_join and private.undo_unjoin (Q2, sw-4, sw-9): a joined stack gives back what's left of the
    // added part, never going below what it had; a whole line a move merged in is made again with it.
    const joinChanges = changes.filter((e) => e.target_table === 'inventory_lines' && isJoin(String(picked.type), { before: e.before, after: e.after }));
    const mergedChanges = joinChanges.length > 0 && picked.type === UNDOABLE_SPLIT ? changes.filter((e) => e.target_table === 'inventory_lines' && !e.after) : [];
    const unjoins: { row: Row; change: Row; left: number }[] = [];
    for (const change of joinChanges) {
      if (tables.events.some((e) => e.reverts_event_id === change.id)) return refused('That was already undone.');
      const row = rowOf(change);
      if (!row || Number(row.qty) < 1) return refused('None of it is left, so nothing can come back.');
      const handedOn = tables.events.some(
        (e) =>
          e.target_table === 'inventory_lines' &&
          e.target_id === change.target_id &&
          Number(e.seq) > Number(change.seq) &&
          !e.reverts_event_id &&
          e.request_id !== picked.request_id &&
          !!e.after &&
          ['actor_id', 'location_id', 'name', 'item_data'].some((key) => key in (e.after as Row)),
      );
      if (handedOn) return refused("It's changed since, so it can't go back.");
      // Like private.joined_left: some of it handed on (a give, or out of the party) refuses; moved within the same
      // pack (into a bag, onto another stack there) only leaves fewer here (sw-4).
      const gaveSome = tables.events.some((e) => {
        const was = (e.before ?? {}) as Row;
        const now = (e.after ?? {}) as Row;
        if (e.target_table !== 'inventory_lines' || e.target_id !== change.target_id || Number(e.seq) <= Number(change.seq) || e.reverts_event_id) return false;
        if (!['inventory.move', 'inventory.giveAway'].includes(String(e.type)) || !('qty' in now) || Number(now.qty) >= Number(was.qty)) return false;
        const others = tables.events.filter((o) => o.request_id === e.request_id && o.target_table === 'inventory_lines' && o.target_id !== change.target_id && o.after);
        const handed = others.map((o) => ({ ...(o.after as Row), ...(o.before === null ? {} : (tables.inventory_lines.find((l) => l.id === o.target_id) ?? {})) }));
        return handed.some((h) => !!h.given_to || (h.actor_id ?? null) !== (row.actor_id ?? null) || (h.location_id ?? null) !== (row.location_id ?? null));
      });
      if (gaveSome) return refused("Some of it was given on since, so it can't go back.");
      const had = Number((change.before as Row).qty);
      const added = Number((change.after as Row).qty) - had;
      const left = Math.min(added, Number(row.qty) - had);
      if (left < 1) return refused('None of it is left, so nothing can come back.');
      const by = String(tables.actors.find((a) => a.id === row.actor_id)?.name ?? tables.locations.find((l) => l.id === row.location_id)?.name ?? '');
      cameBack = { left, of: added, name: String(row.name), by };
      used = added - left;
      unjoins.push({ row, change, left });
    }
    if (mergedChanges.some((change) => rowOf(change))) return refused("That's changed since. Undo the later change first.");
    changes = changes.filter((e) => !joinChanges.includes(e) && !mergedChanges.includes(e));
    const splitParts = changes.filter((e) => e.target_table === 'inventory_lines' && splits.has(e.target_id) && !e.before);
    // Like the database (M5 step 5): a session or an expedition the action started is marked undone, never removed,
    // while it's as the action left it.
    const madeRows = [...UNDOABLE_MAKINGS, ...TRAVEL_MAKINGS].includes(String(picked.type))
      ? changes.filter((e) => !e.before && e.after && ['sessions', 'expeditions', 'expedition_places', 'places', 'place_notes', 'group_places', 'place_moves', 'place_pieces', 'piece_shows', 'place_rule_switches', 'knowledge_shares', 'reminders', 'check_results', 'weather_rolls', 'character_statuses', 'table_pins', 'table_reads', 'waiting_encounters', 'messages', 'sheet_changes', 'travel_groups', 'group_lost', 'camps', 'camp_entries', 'hook_sends', 'shop_stock'].includes(String(e.target_table)))
      : [];
    for (const change of madeRows) {
      const row = rowOf(change);
      if (tables.events.some((e) => e.reverts_event_id === change.id) || row?.undone) return refused('That was already undone.');
      if (!row) return refused("You don't have permission to do that.");
      // Like the database (M5b step 4, private.camp_rules): a camp with steps done, or cooking whose portions were eaten.
      if (change.target_table === 'camps' && tables.camp_entries.some((en) => en.camp_id === row.id && !en.undone)) return refused("Undo the camp's steps first.");
      if (change.target_table === 'camp_entries' && row.kind === 'cook') {
        const others = tables.camp_entries.filter((en) => en.camp_id === row.camp_id && en.kind === 'cook' && !en.undone && en.id !== row.id).reduce((sum, en) => sum + Number(en.qty), 0);
        const eaten = tables.camp_entries.filter((en) => en.camp_id === row.camp_id && en.kind === 'meal' && en.from_pot === true && !en.undone).length;
        if (others < eaten) return refused('Some of those portions were eaten: undo the meals first.');
      }
      if (row.ended_at !== null && row.ended_at !== undefined) return refused("That's changed since. Undo the later change first.");
      // Like the database (M5b, A10): a player undoes their weather entry only while the toast could still show.
      if (change.target_table === 'weather_rolls' && !gm && Date.now() - Date.parse(String(row.entered_at)) > 30_000) {
        return { data: null, error: { message: "You don't have permission to do that.", code: '42501' } };
      }
      // Like the database (M5 step 6): a later change to it that still stands (an edit, a roll entered) comes first.
      const later = tables.events.some(
        (l) =>
          l.target_id === change.target_id &&
          Number(l.seq) > Number(change.seq) &&
          !l.reverts_event_id &&
          (!change.request_id || l.request_id !== change.request_id) &&
          !tables.events.some((r) => r.reverts_event_id === l.id),
      );
      if (later) return refused("That's changed since. Undo the later change first.");
    }
    // Like the database (fm-1, private.undo_check_march): a forced march whose points were spent since (a later
    // change to the row's `spent` that still stands) comes after what spent them.
    const marchRow = march ? changes.find((e) => e.target_table === 'travel_groups')?.target_id : undefined;
    if (marchRow !== undefined) {
      const lastSeq = Math.max(...changes.map((e) => Number(e.seq)));
      const spentSince = tables.events.some(
        (l) =>
          l.target_table === 'travel_groups' &&
          l.target_id === marchRow &&
          Number(l.seq) > lastSeq &&
          !l.reverts_event_id &&
          !!l.after &&
          'spent' in (l.after as Row) &&
          !tables.events.some((r) => r.reverts_event_id === l.id),
      );
      if (spentSince) return refused("That's changed since. Undo the later change first.");
    }
    changes = changes.filter((e) => !madeRows.includes(e));
    changes = changes.filter((e) => !(['inventory_lines', 'inventory_line_secrets'].includes(String(e.target_table)) && splits.has(e.target_id)));
    for (const change of changes) {
      if (!change.before || (!change.after && !(drop && ['inventory_lines', 'inventory_line_secrets'].includes(String(change.target_table))))) {
        return refused("Making or deleting things can't be undone.");
      }
      // Like the database's undoable tables: a seen mark (K20) is not among them.
      if (change.target_table === 'finds_seen') return refused("That can't be undone.");
      if (tables.events.some((e) => e.reverts_event_id === change.id)) return refused('That was already undone.');
      const row = rowOf(change);
      if (!change.after) {
        if (row) return refused("That's changed since. Undo the later change first.");
        const was = change.before as Row;
        if (change.target_table !== 'inventory_lines') continue;
        const carrier = was.actor_id ? tables.actors.find((a) => a.id === was.actor_id) : null;
        if (was.actor_id && (!carrier || carrier.status === 'archived')) return refused("Whoever carried it isn't in play any more, so it can't come back.");
        const container = was.container_line_id ? tables.inventory_lines.find((l) => l.id === was.container_line_id) : null;
        if (
          was.container_line_id &&
          !dropped.some((e) => e.target_id === was.container_line_id) &&
          (!container || container.actor_id !== was.actor_id || container.location_id !== was.location_id)
        ) {
          return refused("The container it was in is gone or has moved, so it can't go back.");
        }
        continue;
      }
      // A change to a line the action then removed comes back with it.
      if (change.target_table === 'inventory_lines' && dropped.some((e) => e.target_id === change.target_id)) continue;
      const after = change.after as Row;
      if (!row && picked.type === UNDOABLE_SPLIT && change.target_table === 'inventory_lines') return refused('None of it is left, so nothing can come back.');
      if (!row || Object.keys(after).some((key) => JSON.stringify(row[key]) !== JSON.stringify(after[key]))) {
        return refused("That's changed since. Undo the later change first.");
      }
      // A whole line moved: what's left of it comes back (5b).
      if (picked.type === UNDOABLE_SPLIT && change.target_table === 'inventory_lines' && !('qty' in after)) {
        const left = givenLeft(change);
        if (left.refusal) return refused(left.refusal);
        cameBack = left.back!;
      }
    }
    // Like the database (…_dec_give_character_reassign.sql, private.reassign_owner_rules, which fires on Undo's
    // put-back too): a character goes back only to a player of the campaign (gp-9: not to one who has left).
    for (const change of changes.filter((e) => e.after && e.target_table === 'actors')) {
      const was = change.before as Row;
      if (!was.owner_user_id) continue;
      const stillPlayer = tables.members.some((m) => m.campaign_id === picked.campaign_id && m.user_id === was.owner_user_id && m.base_role === 'player');
      if (!stillPlayer) return { data: null, error: { message: 'A character can only be given to a player of this campaign.', code: '42501' } };
    }
    // The dropped lines come back first (containers before what was in them), then their GM-only rows.
    const comeBack = [
      ...dropped.filter((e) => !mergedChanges.includes(e)).sort((a, b) => Number(!!(a.before as Row).container_line_id) - Number(!!(b.before as Row).container_line_id) || Number(a.seq) - Number(b.seq)),
      ...changes.filter((e) => !e.after && e.target_table === 'inventory_line_secrets'),
    ];
    for (const change of comeBack) {
      const row = structuredClone(change.before as Row);
      tables[change.target_table as 'inventory_lines' | 'inventory_line_secrets'].push(row);
      log(change.target_table as (typeof LOGGED)[number], null, structuredClone(row), tag, change);
    }
    for (const change of splitParts) {
      const row = rowOf(change)!;
      tables.inventory_lines.splice(tables.inventory_lines.indexOf(row), 1);
      log('inventory_lines', structuredClone(row), null, tag, change);
    }
    for (const { row, change, left } of unjoins) {
      const was = structuredClone(row);
      row.qty = Number(row.qty) - left;
      row.version = Number(row.version ?? 1) + 1;
      log('inventory_lines', was, structuredClone(row), tag, change);
    }
    for (const change of mergedChanges) {
      const row: Row = { ...structuredClone(change.before as Row), qty: unjoins.at(-1)?.left ?? (change.before as Row).qty, version: 1 };
      tables.inventory_lines.push(row);
      log('inventory_lines', null, structuredClone(row), tag, change);
    }
    for (const change of madeRows) {
      const row = rowOf(change)!;
      const was = structuredClone(row);
      row.undone = true;
      row.version = Number(row.version ?? 1) + 1;
      log(change.target_table as (typeof LOGGED)[number], was, structuredClone(row), tag, change);
    }
    for (const change of changes.filter((e) => e.after)) {
      const row = rowOf(change)!;
      const was = structuredClone(row);
      const before = { ...(change.before as Row) };
      // The stack a used split-off part came from gets back only what's left (5b).
      if (used > 0 && 'qty' in before) before.qty = Number(before.qty) - used;
      Object.assign(row, before);
      // Like the database (…_m8b_0_safe_place_answer.sql): an expedition under way again forgets In a safe place?.
      if (change.target_table === 'expeditions' && row.ended_at === null && row.ended_safe != null) row.ended_safe = null;
      if (['campaign_clocks', 'sessions', 'expeditions', 'reminders', 'check_results', 'marching_orders', 'party_group_members', 'weather_rolls', 'table_pins', 'waiting_encounters', 'travel_groups', 'group_lost', 'camps', 'camp_entries', 'purses'].includes(String(change.target_table))) row.version = Number(row.version ?? 1) + 1;
      log(change.target_table as (typeof LOGGED)[number], was, structuredClone(row), tag, change);
    }
    return { data: cameBack, error: null };
  };
  const people = new Map<string, string>(); // email → user id
  const codesSentTo: string[] = [];
  let session: { user: { id: string } } | null = null;
  const listeners = new Set<(event: string, value: typeof session) => void>();

  const setSession = (userId: string | null, event: string) => {
    session = userId ? { user: { id: userId } } : null;
    for (const listener of listeners) listener(event, session);
  };
  const me = () => session?.user.id ?? null;
  const signOutCalls: Array<{ scope?: string }> = [];

  function addPerson(email: string, displayName?: string): string {
    const id = newId('user');
    people.set(email, id);
    tables.profiles.push({
      id,
      display_name: displayName ?? email.split('@')[0],
      named_at: displayName ? '2026-10-19T00:00:00Z' : null,
    });
    return id;
  }

  function addCampaign(name: string, gmId: string): string {
    const id = newId('campaign');
    tables.campaigns.push({ id, name, sigil_asset_id: null, out_day: false, active_night: false });
    // Like the database: every campaign has its Party stash.
    tables.locations.push({ id: `location-stash-${id}`, campaign_id: id, kind: 'stash', name: 'Party stash' });
    // Like the database (M5 step 5): every campaign has its clock, at 0.
    tables.campaign_clocks.push({ id: `clock-${id}`, campaign_id: id, seconds: 0, version: 1 });
    addMember(id, gmId, 'gm');
    return id;
  }

  function addMember(campaignId: string, userId: string, role: 'gm' | 'player', activeActorId?: string) {
    tables.members.push({
      id: newId('member'),
      campaign_id: campaignId,
      user_id: userId,
      base_role: role,
      active_actor_id: activeActorId ?? null,
      joined_at: '2026-10-19T12:00:00Z',
    });
  }

  function addCharacter(
    campaignId: string,
    name: string,
    options: { ownerId?: string; approval?: 'draft' | 'pending' | 'approved' | 'rejected'; companyName?: string } = {},
  ): string {
    let companyId: string | null = null;
    if (options.companyName) {
      companyId = newId('company');
      tables.companies.push({ id: companyId, campaign_id: campaignId, name: options.companyName });
    }
    const id = newId('actor');
    tables.actors.push({
      id,
      campaign_id: campaignId,
      kind: 'pc',
      name,
      owner_type: options.ownerId ? 'user' : 'gm',
      owner_user_id: options.ownerId ?? null,
      approval: options.approval ?? 'approved',
      company_id: companyId,
      ...characterDefaults(),
    });
    return id;
  }

  function addInvite(campaignId: string, code: string, status = 'pending') {
    tables.invites.push(newInvite({ campaign_id: campaignId, code, status }));
  }

  // Like the database's defaults: an id, a fresh code, pending, 14 days to use it.
  function newInvite(row: Row): Row {
    const n = nextId++;
    return {
      id: `invite-${n}`,
      code: fakeCode(n),
      email: null,
      status: 'pending',
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      created_at: new Date(Date.now() + n).toISOString(),
      ...row,
    };
  }

  const validInvite = (code: string) =>
    tables.invites.find((i) => i.code === code.toUpperCase().replace(/[^A-Z0-9]/g, '') && i.status === 'pending');

  // Companies run by the players (ruled 2026-10-24), like the database's functions: who may, one company each.
  const companiesOnIn = (campaignId: unknown) => (tables.campaigns.find((c) => c.id === campaignId)?.settings as { companies?: unknown } | undefined)?.companies !== false;
  const mayActFor = (actor: Row | undefined) =>
    !!actor && actor.status !== 'archived' && (isGmOf(actor.campaign_id) || (actor.owner_user_id === me() && actor.approval === 'approved'));
  const memberOf = (companyId: unknown) => tables.actors.some((a) => a.company_id === companyId && a.owner_user_id === me() && a.status !== 'archived');
  const refused = (message: string): Result => ({ data: null, error: { message, code: '42501' } });
  const joinCompany = (actor: Row, companyId: string) => {
    actor.company_id = companyId;
    for (const inv of tables.company_invitations) if (inv.actor_id === actor.id && inv.status === 'open') inv.status = 'cancelled';
  };
  const invite = (campaignId: unknown, companyId: string, actorId: string, kind: string) => {
    const id = `invitation-${tables.company_invitations.length + 1}`;
    tables.company_invitations.push({ id, campaign_id: campaignId, company_id: companyId, actor_id: actorId, kind, status: 'open', created_by: me() });
    return id;
  };
  // Like the database: a member tells the GM a rule couldn't be checked (a GM-only log line).
  const ruleRpcs: Record<string, (args: Row) => Result> = {
    note_rule_skipped: ({ campaign, hook }) => {
      if (!tables.members.some((m) => m.campaign_id === campaign && m.user_id === me())) return refused("You don't have permission to do that.");
      nextSeq();
      tables.events.push({
        id: `event-${seq}`, seq, campaign_id: campaign, type: 'rule.skipped', level: 'simple', actor_user_id: me(), target_table: 'campaigns', target_id: campaign,
        before: null, after: { hook }, fiat: false, reason: null, reverts_event_id: null, audience: 'gm', owner_user_id: null, reveal_at: 'now', request_id: null, created_at: new Date().toISOString(),
      });
      return { data: null, error: null };
    },
  };
  const companyRpcs: Record<string, (args: Row) => Result> = {
    found_company: ({ actor, company_name, cofounders }) => {
      const founder = tables.actors.find((a) => a.id === actor);
      if (!mayActFor(founder)) return refused("You can't found a company for that character.");
      if (!companiesOnIn(founder!.campaign_id)) return { data: null, error: { message: 'Companies are switched off in this campaign.' } };
      if (founder!.company_id) return { data: null, error: { message: 'That character is already in a company.' } };
      const name = String(company_name ?? '').trim();
      if (!name) return { data: null, error: { message: 'Give the company a name.' } };
      const id = `company-${tables.companies.length + 1}`;
      tables.companies.push({ id, campaign_id: founder!.campaign_id, name, founder_ids: [founder!.id] });
      joinCompany(founder!, id);
      for (const other of (cofounders as string[] | undefined) ?? []) {
        const them = tables.actors.find((a) => a.id === other && a.campaign_id === founder!.campaign_id && !a.company_id && a.approval === 'approved');
        if (them && them.id !== founder!.id) invite(founder!.campaign_id, id, String(them.id), 'cofounder');
      }
      return { data: id, error: null };
    },
    ask_or_invite: ({ company, actor, ask }) => {
      const co = tables.companies.find((c) => c.id === company);
      const target = tables.actors.find((a) => a.id === actor);
      if (!co || !target || co.campaign_id !== target.campaign_id) return { data: null, error: { message: "That company or character isn't here." } };
      if (!companiesOnIn(co.campaign_id)) return { data: null, error: { message: 'Companies are switched off in this campaign.' } };
      if (target.company_id) return { data: null, error: { message: 'That character is already in a company.' } };
      if (ask ? !mayActFor(target) : !(isGmOf(co.campaign_id) || memberOf(co.id))) return refused('Not yours to do.');
      return { data: invite(co.campaign_id, String(co.id), String(target.id), ask ? 'ask' : 'invite'), error: null };
    },
    answer_invitation: ({ invitation, accept }) => {
      const inv = tables.company_invitations.find((i) => i.id === invitation);
      if (!inv || inv.status !== 'open') return { data: null, error: { message: "That isn't waiting any more." } };
      const target = tables.actors.find((a) => a.id === inv.actor_id);
      const mine = isGmOf(inv.campaign_id) || (inv.kind === 'ask' ? memberOf(inv.company_id) : mayActFor(target));
      if (!mine) return refused("That isn't yours to answer.");
      inv.status = accept ? 'accepted' : 'declined';
      if (accept && target) {
        if (target.company_id) return { data: null, error: { message: 'That character is already in a company.' } };
        joinCompany(target, String(inv.company_id));
        if (inv.kind === 'cofounder') {
          const co = tables.companies.find((c) => c.id === inv.company_id);
          if (co) co.founder_ids = [...((co.founder_ids as string[]) ?? []), target.id];
        }
      }
      return { data: null, error: null };
    },
    cancel_invitation: ({ invitation }) => {
      const inv = tables.company_invitations.find((i) => i.id === invitation);
      if (!inv || inv.status !== 'open') return { data: null, error: { message: "That isn't waiting any more." } };
      if (!(isGmOf(inv.campaign_id) || inv.created_by === me())) return refused('Only whoever sent it can take it back.');
      inv.status = 'cancelled';
      return { data: null, error: null };
    },
  };

  // Like the database: every attached pack has its GM-only row (tests that push links straight in get one here).
  const withSecretsRows = () => {
    for (const link of tables.campaign_packs) {
      if (!tables.campaign_pack_secrets.some((row) => row.id === link.id)) tables.campaign_pack_secrets.push({ id: link.id, campaign_id: link.campaign_id, overrides: {} });
    }
  };

  // Like the database (supabase/migrations/…_m5_clock.sql): the clock, sessions and expeditions, the GM's alone.
  // A save from an old copy is refused; the same request sent again changes nothing.
  type Tag = ReturnType<typeof readTag>;
  const changeRow = (
    table:
      | 'campaign_clocks'
      | 'sessions'
      | 'expeditions'
      | 'campaigns'
      | 'character_play'
      | 'reminders'
      | 'check_results'
      | 'table_pins'
      | 'waiting_encounters'
      | 'character_lights'
      | 'inventory_lines'
      | 'marching_orders'
      | 'party_group_members'
      | 'character_statuses'
      | 'status_secrets'
      | 'character_rests'
      | 'group_places'
      | 'place_pieces'
      | 'piece_shows'
      | 'place_rule_switches'
      | 'knowledge_shares'
      | 'weather_rolls'
      | 'requests'
      | 'sheet_changes'
      | 'travel_groups'
      | 'travel_group_secrets'
      | 'group_lost'
      | 'camps'
      | 'camp_entries'
      | 'activity_runs'
      | 'messages'
      | 'hook_sends'
      | 'shop_stock'
      | 'purses',
    row: Row,
    patch: Row,
    tag: Tag,
  ) => {
    const was = structuredClone(row);
    Object.assign(row, patch);
    if ('version' in row) row.version = Number(row.version) + 1;
    log(table, was, structuredClone(row), tag);
  };
  // Places (M5 step 11): a place of that name for the campaign (made if new), and a group put at it, hidden.
  // Like …_m8b_0_places_from_packs.sql: a typed name finds a typed place first, else the one pack place of that name.
  const namePlace = (campaign: unknown, name: string, tag: Tag): Row => {
    const named = tables.places.filter((p) => p.campaign_id === campaign && !p.undone && String(p.name).toLowerCase() === name.toLowerCase());
    const found = named.find((p) => !p.pack_entry_id) ?? (named.length === 1 ? named[0] : undefined);
    if (found) return found;
    const place: Row = { ...packlessPlace, id: newId('place'), campaign_id: campaign, name, description: '', version: 1, undone: false, created_by: me(), created_at: new Date().toISOString(), updated_at: new Date(Date.now() + nextId).toISOString() };
    tables.places.push(place);
    log('places', null, structuredClone(place), tag);
    const notes: Row = { id: place.id, campaign_id: campaign, traps: '', puzzles: '', encounters: '', treasure: '', doors: '', version: 1, undone: false };
    tables.place_notes.push(notes);
    log('place_notes', null, structuredClone(notes), tag);
    return place;
  };
  const packlessPlace = { pack_id: null, pack_entry_id: null, pack_type: null, pack_parent_id: null, pack_key: null, players_name: '', region_id: null, terrain_id: null, safety: null, town: {}, settlement: null };
  // A settlement (M8b slice 0, pull request 2): marked by its pack, or (older places) Safe or Hostile by the GM.
  const isSettlementRow = (p: Row) => (!!p.settlement && typeof p.settlement === 'object') || p.safety === 'safe' || p.safety === 'hostile';
  const placeInCampaign = (campaign: unknown, placeId: unknown): Row | undefined => tables.places.find((p) => p.id === placeId && p.campaign_id === campaign && !p.undone);
  const putGroupAt = (campaign: unknown, expedition: unknown, group: number, placeId: unknown, tag: Tag): Row => {
    for (const old of tables.group_places.filter((g) => g.expedition_id === expedition && g.group_number === group && !g.moved_on && !g.undone)) changeRow('group_places', old, { moved_on: true }, tag);
    const made: Row = { id: newId('group-place'), campaign_id: campaign, expedition_id: expedition, group_number: group, place_id: placeId, shown: false, moved_on: false, undone: false, created_at: new Date(Date.now() + nextId).toISOString() };
    tables.group_places.push(made);
    log('group_places', null, structuredClone(made), tag);
    return made;
  };
  const repeated = (tag: Tag, id: unknown) => !!tag?.requestId && tables.events.some((e) => e.request_id === tag.requestId && e.target_id === id);
  const madeBy = (table: string, tag: Tag) =>
    tag?.requestId ? tables.events.find((e) => e.request_id === tag.requestId && e.target_table === table && e.before === null && e.actor_user_id === me()) : undefined;
  const isStale = (row: Row, seen: unknown) => seen !== undefined && seen !== null && row.version !== seen;
  const staleResult: Result = { data: null, error: { message: STALE, code: STALE_CODE } };
  const plain = (message: string): Result => ({ data: null, error: { message } });
  /** A refusal a function raised, as Postgres reports one: its words and the code `raise exception` gives (P0001). */
  const raised = (message: string): Result => ({ data: null, error: { message, code: 'P0001' } });
  const copy = (row: Row | undefined): Result => ({ data: row ? { ...row } : null, error: null });
  const moveClock = (campaign: unknown, seen: unknown, tag: Tag, to: (seconds: number) => number, rest: unknown = null): Result => {
    if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
    const clock = tables.campaign_clocks.find((c) => c.campaign_id === campaign);
    if (!clock) return refused("You don't have permission to do that.");
    if (repeated(tag, clock.id)) return copy(clock);
    if (isStale(clock, seen)) return staleResult;
    const from = Number(clock.seconds);
    changeRow('campaign_clocks', clock, { seconds: to(from) }, tag);
    const now = Number(clock.seconds);
    if (now > from) burnLights(campaign, now, tag);
    // Like the database (M5 step 9): an advance applies the rest choices; any move forwards ends the status timers
    // that ran out.
    if (now > from && rest) applyRests(campaign, from, rest, tag);
    if (now > from) endStatuses(campaign, now, tag);
    // Like the database (ruled 2026-10-29): backwards, lights get their time back up to their whole length.
    if (now < from) for (const l of tables.character_lights) if (l.campaign_id === campaign && l.lit_at !== null && Number(l.lit_at) > now) changeRow('character_lights', l, { lit_at: now }, tag);
    // And so do status timers; ended statuses stay ended.
    if (now < from) {
      for (const st of tables.character_statuses) {
        if (st.campaign_id !== campaign || st.ended_at !== null || st.undone || st.ends_at === null || st.total_seconds === null) continue;
        if (Number(st.ends_at) - Number(st.total_seconds) > now) changeRow('character_statuses', st, { ends_at: now + Number(st.total_seconds) }, tag);
      }
      for (const x of tables.status_secrets) {
        const st = tables.character_statuses.find((r) => r.id === x.id);
        if (x.campaign_id !== campaign || !st || st.ended_at !== null || st.undone) continue;
        if (Number(x.ends_at) - Number(x.total_seconds) > now) changeRow('status_secrets', x, { ends_at: now + Number(x.total_seconds) }, tag);
      }
    }
    return copy(clock);
  };
  // Like the database (supabase/migrations/…_m5_light.sql): every character's light row, made with it.
  const withLightRows = () => {
    for (const a of tables.actors) {
      if ((a.kind ?? 'pc') !== 'pc' && a.kind !== 'hireling') continue;
      if (tables.character_lights.some((l) => l.actor_id === a.id)) continue;
      tables.character_lights.push({
        id: newId('light'), actor_id: a.id, campaign_id: a.campaign_id, line_id: null, type_id: null, name: '', lit_at: null, burn_seconds: null,
        full_seconds: null, warn_seconds: null, left_seconds: null, consumed: false, fuel_item: null, keep_lit: false, out_at: null, version: 1,
      });
    }
  };
  // Like the database (supabase/migrations/…_dec_6a_purse_data.sql): every character's, hireling's and Party stash's
  // purse row, made with it, empty.
  const withPurseRows = () => {
    for (const a of tables.actors) {
      if ((a.kind ?? 'pc') !== 'pc' && a.kind !== 'hireling') continue;
      if (tables.purses.some((p) => p.actor_id === a.id)) continue;
      tables.purses.push({ id: newId('purse'), campaign_id: a.campaign_id, actor_id: a.id, location_id: null, coins: {}, version: 1 });
    }
    for (const l of tables.locations) {
      if (l.kind !== 'stash' || tables.purses.some((p) => p.location_id === l.id)) continue;
      tables.purses.push({ id: newId('purse'), campaign_id: l.campaign_id, actor_id: null, location_id: l.id, coins: {}, version: 1 });
    }
    // A purse goes with its character (on delete cascade).
    tables.purses = tables.purses.filter((p) => p.actor_id === null || tables.actors.some((a) => a.id === p.actor_id));
  };
  // One of a line used up: the stack loses one, the line goes with the last (the log keeps a copy).
  const spendOne = (lineId: unknown, tag: Tag) => {
    const line = tables.inventory_lines.find((l) => l.id === lineId);
    if (!line) return;
    if (Number(line.qty) > 1) return changeRow('inventory_lines', line, { qty: Number(line.qty) - 1 }, tag);
    tables.inventory_lines = tables.inventory_lines.filter((l) => l.id !== lineId);
    log('inventory_lines', structuredClone(line), null, tag);
  };
  const lightLineLeft = (actor: unknown, lineId: unknown, typeId: unknown) =>
    tables.inventory_lines.find((l) => l.id === lineId && l.actor_id === actor && Number(l.qty) >= 1)?.id ??
    tables.inventory_lines.find((l) => l.actor_id === actor && (l.approval ?? 'approved') === 'approved' && Number(l.qty) >= 1 && (l.item_data as Row | null)?.lightTypeId === typeId)?.id ??
    null;
  const fuelLine = (actor: unknown, fuel: unknown) =>
    fuel ? (tables.inventory_lines.find((l) => l.actor_id === actor && (l.approval ?? 'approved') === 'approved' && Number(l.qty) >= 1 && l.source_entry_id === fuel)?.id ?? null) : null;
  // Like the database: lights whose time ran out burn out with the clock, logged as light.burnOut (Simple), with Keep lit.
  const burnLights = (campaign: unknown, to: number, tag: Tag) => {
    withLightRows();
    const burnTag = tag ? { ...tag, type: 'light.burnOut', level: 'simple' } : tag;
    const due = tables.character_lights
      .filter((l) => l.campaign_id === campaign && l.lit_at !== null && l.burn_seconds !== null && Number(l.lit_at) + Number(l.burn_seconds) <= to)
      .sort((a, b) => Number(a.lit_at) + Number(a.burn_seconds) - (Number(b.lit_at) + Number(b.burn_seconds)));
    for (const light of due) {
      let ends = Number(light.lit_at) + Number(light.burn_seconds);
      let lineId = light.line_id;
      let relit = false;
      for (let round = 0; round < 1000; round += 1) {
        relit = false;
        if (light.consumed && lineId) spendOne(lineId, burnTag);
        if (light.keep_lit && light.full_seconds !== null) {
          if (light.consumed) {
            const next = lightLineLeft(light.actor_id, lineId, light.type_id);
            if (next) {
              lineId = next;
              relit = true;
            }
          } else if (light.fuel_item && tables.inventory_lines.some((l) => l.id === lineId)) {
            const fuel = fuelLine(light.actor_id, light.fuel_item);
            if (fuel) {
              spendOne(fuel, burnTag);
              relit = true;
            }
          }
        }
        if (!relit || ends + Number(light.full_seconds) > to) break;
        ends += Number(light.full_seconds);
      }
      changeRow(
        'character_lights',
        light,
        relit ? { lit_at: ends, burn_seconds: light.full_seconds, line_id: lineId, left_seconds: null, out_at: null } : { lit_at: null, left_seconds: null, out_at: ends },
        burnTag,
      );
      // Like the database (…_m5_light_refill_sticks.sql): a holder that burnt out needs fuel, marked on its line.
      const holder = !relit && !light.consumed && light.fuel_item ? tables.inventory_lines.find((l) => l.id === lineId) : undefined;
      if (holder && holder.needs_fuel !== true) changeRow('inventory_lines', holder, { needs_fuel: true }, burnTag);
    }
  };
  const lightOf = (actor: unknown): Row | undefined => {
    withLightRows();
    const row = tables.character_lights.find((l) => l.actor_id === actor);
    const who = tables.actors.find((a) => a.id === actor);
    return row && who && who.approval === 'approved' && (isGmOf(who.campaign_id) || (who.owner_user_id === me() && isMemberOf(who.campaign_id))) ? row : undefined;
  };
  // Like the database (…_m5_party_groups.sql): every campaign's party (group 1), and every character's and hireling's
  // member row (its id the character's), made with them.
  const withGroupRows = () => {
    for (const c of tables.campaigns) {
      if (!tables.party_groups.some((g) => g.campaign_id === c.id && g.number === 1)) tables.party_groups.push({ id: `group-${String(c.id)}-1`, campaign_id: c.id, number: 1 });
    }
    for (const a of tables.actors) {
      if (['pc', 'hireling'].includes(String(a.kind ?? 'pc')) && !tables.party_group_members.some((m) => m.actor_id === a.id)) {
        tables.party_group_members.push({ id: a.id, actor_id: a.id, campaign_id: a.campaign_id, group_number: 1, version: 1 });
      }
    }
  };
  // Like the database (supabase/migrations/…_m5_marching.sql, …_m5_party_groups.sql): a marching order per group.
  const withMarchingRows = () => {
    withGroupRows();
    for (const g of tables.party_groups) {
      if (!tables.marching_orders.some((m) => m.campaign_id === g.campaign_id && (m.group_number ?? 1) === g.number)) {
        tables.marching_orders.push({
          id: g.number === 1 ? `marching-${String(g.campaign_id)}` : `marching-${String(g.campaign_id)}-${String(g.number)}`,
          campaign_id: g.campaign_id, group_number: g.number, rows: [], presets: [], last_preset: null, locked: false, version: 1,
        });
      }
    }
  };
  const groupNumberOf = (actor: unknown) => Number(tables.party_group_members.find((m) => m.actor_id === actor)?.group_number ?? 1);
  // Like the access rules (M5 step 12): a request is the GM's, its requester's, or everyone's when it's the party's.
  const requestForMe = (row: Row) => isGmOf(row.campaign_id) || (isMemberOf(row.campaign_id) && (row.requester_id === me() || (row.requester_id === null && row.direction === 'gmAsks')));
  const activeIn = (campaign: unknown) =>
    tables.actors.filter((a) => a.campaign_id === campaign && ['pc', 'hireling'].includes(String(a.kind ?? 'pc')) && (a.approval ?? 'approved') === 'approved' && (a.status ?? 'active') === 'active');
  // A place's picture (M5b step 1 follow-up; ruled B), like private.place_picture_shown_to_me: for each of the reader's
  // groups, the picture piece shown to it on its current visit (the newest shown).
  const shownPlacePictures = (campaign: unknown, asPlayer?: unknown): { group: number; assetId: string }[] => {
    withGroupRows();
    const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, asPlayer)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
    return groups.flatMap((group) => {
      const visit = tables.group_places
        .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && !g.moved_on)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
      if (!visit || !place) return [];
      const shown = tables.piece_shows
        .filter((s) => s.group_place_id === visit.id && s.shown === true && !s.undone)
        .sort((a, b) => String(b.shown_at).localeCompare(String(a.shown_at)))
        .map((s) => tables.place_pieces.find((pc) => pc.id === s.piece_id && !pc.undone && pc.kind === 'picture' && typeof pc.asset_id === 'string'))
        .find((pc) => pc !== undefined);
      return shown ? [{ group, assetId: String(shown.asset_id) }] : [];
    });
  };
  // Every string in a value with its link marks as words (like private.plain_link_marks).
  // Like private.plain_link_text (…_players_never_get_link_ids.sql): the app's plainLinks, then anything still starting
  // a mark is dropped up to its `]]` or the next space, so no id is left.
  // As private.is_rumours_table (20261114220000_dec_12e_rumours.sql).
  const isRumoursTable = (data: Row): boolean => {
    const uses = (value: unknown): unknown[] => (typeof value === 'string' ? [value] : Array.isArray(value) ? value : []);
    return [...uses(data.uses), ...uses(data.use)].includes('world.rumours') || data.kind === 'rumours';
  };
  const plainText = (value: string): string => plainLinks(value).replace(/\[\[[A-Za-z]+:[^\]\s]*(\]\])?/g, '');
  const plainDeep = (value: unknown): unknown =>
    typeof value === 'string' ? plainText(value) : Array.isArray(value) ? value.map(plainDeep) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainDeep(v)])) : value;
  // A rule's button as `r.value ->> 'button'` gives it, put into words: a string as it is, an object as its JSON text
  // (pf-12e's `{ icon, words }`), nothing as ''.
  const fakeButtonText = (value: unknown): string =>
    typeof value === 'string' ? plainText(value) : value && typeof value === 'object' ? plainText(JSON.stringify(value)) : '';
  // A place is shown to a visit when a piece of it is shown on that visit (December dec-7 piece 3; scene_town's rule).
  const visitShown = (visit: unknown) =>
    tables.piece_shows.some((s) => s.group_place_id === visit && s.shown === true && !s.undone && tables.place_pieces.some((pc) => pc.id === s.piece_id && !pc.undone));
  // A pack's location and every place it sits in (`parentId`, same pack), nearest first, at most 12.
  const fakeChain = (pack: unknown, entryId: unknown): Row[] => {
    const chain: Row[] = [];
    let at = tables.library_entries.find((e) => e.pack_id === pack && e.kind === 'location' && e.pack_entry_id === entryId);
    while (at && chain.length < 12 && !chain.includes(at)) {
      chain.push(at);
      const parent = (at.data as Row | undefined)?.parentId;
      at = typeof parent === 'string' ? tables.library_entries.find((e) => e.pack_id === pack && e.kind === 'location' && e.pack_entry_id === parent) : undefined;
    }
    return chain;
  };
  // The name players see for a rule's or a check's place (the lead's ruling on ⚑ b, 2026-11-13): a place this group was
  // shown by its players' name; any other (a region the shown place sits in) under the shown place's own name.
  const fakeShownPlaceName = (campaign: unknown, group: number, pack: unknown, entry: Row, shownName: string): string => {
    const shown = tables.places.find(
      (p) =>
        p.campaign_id === campaign &&
        p.pack_id === pack &&
        p.pack_entry_id === entry.pack_entry_id &&
        !p.undone &&
        tables.group_places.some((g) => g.place_id === p.id && Number(g.group_number) === group && !g.undone && visitShown(g.id)),
    );
    return shown ? String(shown.players_name || shown.name) : shownName;
  };
  // The name of a pack's place when it counts as shown to the group (P4's private.known_entry_name): a place made from it
  // the group was shown, or (ppf-1) a place inside it the group was shown, then under the pack's name for players.
  const fakeKnownEntryName = (campaign: unknown, group: number, pack: unknown, entry: Row): string | null => {
    const shown = fakeShownPlaceName(campaign, group, pack, entry, '');
    if (shown) return shown;
    const inside = tables.places.some(
      (q) =>
        q.campaign_id === campaign &&
        q.pack_id === pack &&
        !q.undone &&
        q.pack_entry_id !== entry.pack_entry_id &&
        tables.group_places.some((g) => g.place_id === q.id && Number(g.group_number) === group && !g.undone && visitShown(g.id)) &&
        fakeChain(pack, q.pack_entry_id).slice(1).includes(entry),
    );
    const view = ((entry.data ?? {}) as Row).playerView as Row | undefined;
    return inside ? (typeof view?.name === 'string' && view.name.trim() ? view.name.trim().slice(0, 200) : String(entry.name ?? '')) : null;
  };
  // With one group left, everyone is the party (group 1) again.
  const tidyGroups = (campaign: unknown, tag: Tag) => {
    if (new Set(activeIn(campaign).map((a) => groupNumberOf(a.id))).size > 1) return;
    for (const m of tables.party_group_members) if (m.campaign_id === campaign && m.group_number !== 1) changeRow('party_group_members', m, { group_number: 1 }, tag);
  };
  // Travel (M5b step 1), like supabase/migrations/…_m5b_1_travel.sql: a travel row per group, paid in points; the
  // shortfall owed is paid first and the group arrives (its place moves on) when it's paid in full.
  const inMyGroup = (campaign: unknown, group: number) =>
    tables.actors.some((a) => a.campaign_id === campaign && a.owner_user_id === me() && groupNumberOf(a.id) === group) && isMemberOf(campaign);
  // Like private.group_readers (fm-1): the players with an approved, active character of their own in the group now.
  const groupReaders = (campaign: unknown, group: number): string[] => [
    ...new Set(activeIn(campaign).filter((a) => groupNumberOf(a.id) === group && (a.owner_type ?? 'user') === 'user' && typeof a.owner_user_id === 'string').map((a) => String(a.owner_user_id))),
  ];
  const gettingLostOpen = (campaign: unknown) => (tables.campaigns.find((c) => c.id === campaign)?.settings as { gettingLost?: unknown } | undefined)?.gettingLost === 'open';
  const tripOf = (campaign: unknown) => tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone);
  const travelRowOf = (campaign: unknown, group: number): Row | undefined => {
    const trip = tripOf(campaign);
    return trip ? tables.travel_groups.find((t) => t.expedition_id === trip.id && t.group_number === group && !t.undone) : undefined;
  };
  const travelDone = (table: 'travel_groups' | 'group_lost', tag: Tag): Result | null => {
    const done = requestTargets(table, tag);
    return done.length > 0 ? copy(tables[table].find((t) => t.id === done[0])) : null;
  };
  const goesTo = (campaign: unknown, group: number, name: unknown, tag: Tag) => {
    const trip = tripOf(campaign);
    if (!trip) return;
    const text = typeof name === 'string' ? name.trim() : '';
    const place = text ? namePlace(campaign, text, tag) : null;
    const here = tables.group_places.find((g) => g.expedition_id === trip.id && g.group_number === group && !g.moved_on && !g.undone);
    if (here && place && here.place_id === place.id) return;
    putGroupAt(campaign, trip.id, group, place ? place.id : null, tag);
  };
  const goesToId = (campaign: unknown, group: number, placeId: unknown, tag: Tag) => {
    const trip = tripOf(campaign);
    if (!trip) return;
    // Like the database (fm-1, the #528 nit): a place undone since is no place; the group arrives somewhere unnamed.
    const there = placeInCampaign(campaign, placeId) ? placeId : null;
    const here = tables.group_places.find((g) => g.expedition_id === trip.id && g.group_number === group && !g.moved_on && !g.undone);
    if (here && (here.place_id ?? null) === there) return;
    putGroupAt(campaign, trip.id, group, there, tag);
  };
  // Like …_fm1_group_log_audience.sql (7): the GM's part of a travel row (the place it is entering, as the GM names it
  // and by its id), made with the row and never logged at its making.
  const travelSecretOf = (row: Row): Row => {
    let secret = tables.travel_group_secrets.find((s) => s.id === row.id);
    if (!secret) {
      secret = { id: row.id, campaign_id: row.campaign_id, pending_place_name: null, pending_place_id: null };
      tables.travel_group_secrets.push(secret);
    }
    return secret;
  };
  // Like private.entering_name_for_players: what a group's players may read of the place it is entering: that place's
  // players' name, and only when one of its pieces has been shown to that group on a visit; otherwise nothing.
  const enteringNameForPlayers = (campaign: unknown, group: number, placeId: unknown, name: unknown): string | null => {
    const typed = typeof name === 'string' ? name.trim().toLowerCase() : '';
    const named = typed ? tables.places.filter((p) => p.campaign_id === campaign && !p.undone && String(p.name).toLowerCase() === typed) : [];
    const fromPacks = named.filter((p) => p.pack_entry_id);
    const place = placeId ? placeInCampaign(campaign, placeId) : (named.find((p) => !p.pack_entry_id) ?? (fromPacks.length === 1 ? fromPacks[0] : undefined));
    if (!place) return null;
    const shown = tables.group_places.some(
      (gp) =>
        gp.place_id === place.id &&
        gp.campaign_id === campaign &&
        Number(gp.group_number) === group &&
        !gp.undone &&
        tables.expeditions.some((x) => x.id === gp.expedition_id && !x.undone) &&
        tables.piece_shows.some((s) => s.group_place_id === gp.id && s.shown === true && !s.undone && tables.place_pieces.some((pc) => pc.id === s.piece_id && !pc.undone)),
    );
    return shown ? String(place.players_name || place.name) : null;
  };
  const noPending = { pending_place_name: null, pending_place_id: null, pending_terrain_id: null, pending_route_id: null, pending_owed: null };
  const payOwed = (row: Row, points: number, tag: Tag): Row => {
    if (row.pending_owed === null || row.pending_owed === undefined) return row;
    const paid = Math.min(Number(row.pending_owed), Math.max(points, 0));
    const left = Number(row.pending_owed) - paid;
    if (left > 0) {
      changeRow('travel_groups', row, { spent: Number(row.spent) + paid, pending_owed: left }, tag);
      return row;
    }
    // Like the database (fm-1): the place being entered is read from, and cleared in, the GM's part of the row.
    const secret = travelSecretOf(row);
    const name = secret.pending_place_name;
    const placeId = secret.pending_place_id;
    changeRow('travel_groups', row, { spent: Number(row.spent) + paid, terrain_id: row.pending_terrain_id, route_id: row.pending_route_id, ...noPending }, tag);
    changeRow('travel_group_secrets', secret, { pending_place_name: null, pending_place_id: null }, tag);
    if (placeId) goesToId(row.campaign_id, Number(row.group_number), placeId, tag);
    else goesTo(row.campaign_id, Number(row.group_number), name, tag);
    return row;
  };
  const travelRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    start_travel_day: ({ campaign, group_no, day, total, pace, gm_per_day }, tag) => {
      const made = madeBy('travel_groups', tag);
      if (made) return copy(tables.travel_groups.find((t) => t.id === made.target_id));
      const done = travelDone('travel_groups', tag);
      if (done) return done;
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (typeof day !== 'number' || day < 0 || typeof total !== 'number' || total < 0 || !['foot', 'riding', 'cart'].includes(String(pace))) return plain('A day, a budget and a pace are needed.');
      const trip = tripOf(campaign);
      if (!trip) return plain('Start an expedition first.');
      withGroupRows();
      if (!tables.party_groups.some((g) => g.campaign_id === campaign && g.number === group_no)) return plain("That group isn't there any more.");
      const found = travelRowOf(campaign, Number(group_no));
      if (!found) {
        const row: Row = {
          id: newId('travel'), campaign_id: campaign, expedition_id: trip.id, group_number: Number(group_no), day, total, gm_per_day: gm_per_day ?? null, pace,
          spent: 0, forced: 0, terrain_id: null, route_id: null, ...noPending, created_by: me(), undone: false, version: 1, created_at: new Date().toISOString(),
        };
        tables.travel_groups.push(row);
        log('travel_groups', null, structuredClone(row), tag);
        return copy(row);
      }
      if (Number(found.day) >= day) return copy(found);
      changeRow('travel_groups', found, { day, total, pace, gm_per_day: gm_per_day ?? null, spent: 0, forced: 0 }, tag);
      return copy(payOwed(found, total, tag));
    },
    travel_move: ({ campaign, group_no, cost, terrain_id, route_id, place_name, place_id, seen_version }, tag) => {
      const done = travelDone('travel_groups', tag);
      if (done) return done;
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (typeof cost !== 'number' || cost < 0 || cost > 100000) return plain('A whole cost, 0 or more, is needed.');
      let name = typeof place_name === 'string' && place_name.trim() ? place_name.trim() : null;
      if (place_id) {
        const place = tables.places.find((p) => p.id === place_id && p.campaign_id === campaign && !p.undone);
        if (!place) return plain("That place isn't in this campaign.");
        name = String(place.name);
      }
      const row = travelRowOf(campaign, Number(group_no));
      if (!row) return plain('Start the day first.');
      if (isStale(row, seen_version)) return staleResult;
      const pay = Math.min(Math.max(Number(row.total) - Number(row.spent), 0), cost);
      const owed = cost - pay;
      if (owed > 0) {
        // Like the database (fm-1): the GM's name and the place go to the GM's part of the row; the players' part gets
        // only what that group's players may read of it.
        const forPlayers = enteringNameForPlayers(campaign, Number(group_no), place_id, name);
        changeRow('travel_groups', row, { spent: Number(row.spent) + pay, pending_place_name: forPlayers, pending_place_id: null, pending_terrain_id: terrain_id ?? null, pending_route_id: route_id ?? null, pending_owed: owed }, tag);
        changeRow('travel_group_secrets', travelSecretOf(row), { pending_place_name: name, pending_place_id: place_id ?? null }, tag);
        return copy(row);
      }
      changeRow('travel_groups', row, { spent: Number(row.spent) + pay, terrain_id: terrain_id ?? null, route_id: route_id ?? null, ...noPending }, tag);
      changeRow('travel_group_secrets', travelSecretOf(row), { pending_place_name: null, pending_place_id: null }, tag);
      if (place_id) goesToId(campaign, Number(group_no), place_id, tag);
      else goesTo(campaign, Number(group_no), name, tag);
      return copy(row);
    },
    set_travel_budget: ({ campaign, group_no, total, pace, gm_per_day, seen_version }, tag) => {
      const done = travelDone('travel_groups', tag);
      if (done) return done;
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (typeof total !== 'number' || total < 0 || !['foot', 'riding', 'cart'].includes(String(pace))) return plain('A budget and a pace are needed.');
      const row = travelRowOf(campaign, Number(group_no));
      if (!row) return plain('Start the day first.');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('travel_groups', row, { total, pace, gm_per_day: gm_per_day ?? null }, tag);
      return copy(row);
    },
    force_march: ({ campaign, group_no, added, seen_version }, tag) => {
      const done = travelDone('travel_groups', tag);
      if (done) return done;
      if (!(isGmOf(campaign) || inMyGroup(campaign, Number(group_no)))) return refused("You don't have permission to do that.");
      if (typeof added !== 'number' || added < 0 || added > 100000) return plain('A whole number of points, 0 or more, is needed.');
      const row = travelRowOf(campaign, Number(group_no));
      if (!row) return plain('Start the day first.');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('travel_groups', row, { total: Number(row.total) + added, forced: Number(row.forced) + 1 }, tag);
      payOwed(row, added, tag);
      // Rest falls due that evening in camp's Sleep step (ruled 2026-11-03, SC-4-3 A): nothing is called now.
      return copy(row);
    },
    spend_travel_day: ({ campaign, group_no, seen_version }, tag) => {
      const done = travelDone('travel_groups', tag);
      if (done) return done;
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const row = travelRowOf(campaign, Number(group_no));
      if (!row) return plain('Start the day first.');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('travel_groups', row, { spent: Math.max(Number(row.spent), Number(row.total)) }, tag);
      return copy(row);
    },
    set_lost: ({ campaign, group_no, day, note }, tag) => {
      const made = madeBy('group_lost', tag);
      if (made) return copy(tables.group_lost.find((l) => l.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const trip = tripOf(campaign);
      if (!trip) return plain('Start an expedition first.');
      withGroupRows();
      if (!tables.party_groups.some((g) => g.campaign_id === campaign && g.number === group_no)) return plain("That group isn't there any more.");
      const open = tables.group_lost.find((l) => l.expedition_id === trip.id && l.group_number === group_no && l.found_day === null && !l.undone);
      if (open) return copy(open);
      const row: Row = {
        id: newId('lost'), campaign_id: campaign, expedition_id: trip.id, group_number: Number(group_no), since_day: Math.max(Number(day ?? 0), 0), found_day: null, attempts: 0,
        roll: null, roll_by: null, note: typeof note === 'string' ? note.trim() : '', created_by: me(), undone: false, version: 1, created_at: new Date().toISOString(),
      };
      tables.group_lost.push(row);
      log('group_lost', null, structuredClone(row), tag);
      return copy(row);
    },
    enter_lost_roll: ({ lost, roll, seen_version }, tag) => {
      const done = travelDone('group_lost', tag);
      if (done) return done;
      const row = tables.group_lost.find((l) => l.id === lost);
      if (!row || !(isGmOf(row.campaign_id) || (gettingLostOpen(row.campaign_id) && inMyGroup(row.campaign_id, Number(row.group_number))))) return refused("You don't have permission to do that.");
      if (row.found_day !== null || row.undone) return plain('The group already found the way.');
      const text = typeof roll === 'string' ? roll.trim() : '';
      if (!text || text.length > 20) return plain('What did the dice show?');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('group_lost', row, { roll: text, roll_by: me() }, tag);
      return copy(row);
    },
    resolve_lost: ({ lost, outcome, day, seen_version }, tag) => {
      const done = travelDone('group_lost', tag);
      if (done) return done;
      const row = tables.group_lost.find((l) => l.id === lost);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.found_day !== null || row.undone) return plain('The group already found the way.');
      if (isStale(row, seen_version)) return staleResult;
      if (outcome === 'found') changeRow('group_lost', row, { found_day: Math.max(Number(day ?? row.since_day), Number(row.since_day)) }, tag);
      else if (outcome === 'still') changeRow('group_lost', row, { attempts: Number(row.attempts) + 1, roll: null, roll_by: null }, tag);
      else return plain('Found the way, or still lost?');
      return copy(row);
    },
  };
  const groupRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    choose_party_group: (args, tag) => {
      withGroupRows();
      const who = tables.actors.find((a) => a.id === args.actor);
      if (!who || !['pc', 'hireling'].includes(String(who.kind ?? 'pc')) || (who.approval ?? 'approved') !== 'approved') return refused("You don't have permission to do that.");
      if (!(isGmOf(who.campaign_id) || (who.owner_user_id === me() && isMemberOf(who.campaign_id)))) return refused("You don't have permission to do that.");
      const found = tables.party_group_members.find((m) => m.actor_id === who.id)!;
      if (repeated(tag, found.id)) return copy(found);
      const from = Number(found.group_number);
      let target = args.to_group === null || args.to_group === undefined ? null : Number(args.to_group);
      if (target === null) {
        const alone = !activeIn(who.campaign_id).some((a) => a.id !== who.id && groupNumberOf(a.id) === from);
        if (alone && from !== 1) return plain("They're in a group of their own already.");
        const empty = tables.party_groups
          .filter((g) => g.campaign_id === who.campaign_id && Number(g.number) > 1 && !tables.party_group_members.some((m) => m.campaign_id === g.campaign_id && m.group_number === g.number))
          .map((g) => Number(g.number))
          .sort((a, b) => a - b)[0];
        if (empty !== undefined) target = empty;
        else {
          target = Math.max(...tables.party_groups.filter((g) => g.campaign_id === who.campaign_id).map((g) => Number(g.number))) + 1;
          tables.party_groups.push({ id: `group-${String(who.campaign_id)}-${target}`, campaign_id: who.campaign_id, number: target });
        }
      } else if (!tables.party_groups.some((g) => g.campaign_id === who.campaign_id && g.number === target)) return plain("That group isn't there any more.");
      if (target === from) return copy(found);
      changeRow('party_group_members', found, { group_number: target }, tag);
      if (who.kind === 'pc' && who.owner_user_id) {
        for (const m of tables.party_group_members) {
          const h = tables.actors.find((a) => a.id === m.actor_id);
          if (h && h.kind === 'hireling' && h.owner_user_id === who.owner_user_id && m.group_number === from) changeRow('party_group_members', m, { group_number: target }, tag);
        }
      }
      tidyGroups(who.campaign_id, tag);
      return copy(found);
    },
    join_party_groups: (args, tag) => {
      withGroupRows();
      if (!isMemberOf(args.campaign)) return refused("You don't have permission to do that.");
      const from = Number(args.from_group);
      const into = Number(args.into_group);
      if (from === into) return plain('Which groups join up?');
      const found = tables.party_groups.find((g) => g.campaign_id === args.campaign && g.number === into);
      if (!found || !tables.party_groups.some((g) => g.campaign_id === args.campaign && g.number === from)) return plain("That group isn't there any more.");
      for (const m of tables.party_group_members) if (m.campaign_id === args.campaign && m.group_number === from) changeRow('party_group_members', m, { group_number: into }, tag);
      tidyGroups(args.campaign, tag);
      return copy(found);
    },
    // Where now? (M5 step 11): the group goes to the place of that name (blank: unnamed), hidden until shown.
    set_group_place: ({ campaign, group_no, place_name }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const made = madeBy('group_places', tag);
      if (made) return copy(tables.group_places.find((g) => g.id === made.target_id));
      const expedition = tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone);
      if (!expedition) return plain('No expedition is under way.');
      const name = typeof place_name === 'string' ? place_name.trim() : '';
      return copy(putGroupAt(campaign, expedition.id, Number(group_no), name ? namePlace(campaign, name, tag).id : null, tag));
    },
    // Where now? by place id (M8b slice 0): the place meant, even when another shares its name.
    set_group_place_at: ({ campaign, group_no, place }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const made = madeBy('group_places', tag);
      if (made) return copy(tables.group_places.find((g) => g.id === made.target_id));
      const expedition = tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone);
      if (!expedition) return plain('Start an expedition first.');
      const found = placeInCampaign(campaign, place);
      if (!found) return plain("That place isn't in this campaign.");
      return copy(putGroupAt(campaign, expedition.id, Number(group_no), found.id, tag));
    },
    // A place from a pack's location (M8b slice 0), like …_m8b_0_places_from_packs.sql: the campaign's place for
    // that link, made with its notes and its unshown pieces if there isn't one; the one made before otherwise.
    make_place_from_pack: ({ campaign, pack, entry_id, details, notes, pieces }, tag) => {
      const made = madeBy('places', tag);
      if (made) return copy(tables.places.find((p) => p.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (!tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === pack)) return plain("That place isn't in an attached pack.");
      const entry = tables.library_entries.find((e) => e.pack_id === pack && e.kind === 'location' && e.pack_entry_id === entry_id);
      if (!entry) return plain("That place isn't in an attached pack.");
      const existing = tables.places.find((p) => p.campaign_id === campaign && p.pack_id === pack && p.pack_entry_id === entry_id && !p.undone);
      if (existing) return copy(existing);
      const facts = (details ?? {}) as Row;
      const given = (notes ?? {}) as Row;
      const parts = Array.isArray(pieces) ? (pieces as Row[]) : [];
      if (parts.length > 200) return plain('A place has at most 200 pieces.');
      for (const h of ['traps', 'puzzles', 'encounters', 'treasure', 'doors']) if (String(given[h] ?? '').length > 4000) return plain('A note is at most 4000 characters.');
      for (const pc of parts) {
        if (!['description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other'].includes(String(pc.kind))) return plain('Pick what kind of piece it is.');
        if (!String(pc.body ?? '').trim()) return plain('Write what players will see.');
        if (String(pc.body).trim().length > 4000) return plain('A piece is at most 4000 characters.');
        if ([pc.gm_value, pc.gm_trigger, pc.gm_stat_line].some((v) => String(v ?? '').length > 1000)) return plain("A piece's GM note is at most 1000 characters.");
      }
      const nothing = (v: unknown) => (typeof v === 'string' && v ? v : null);
      const place: Row = {
        ...packlessPlace, id: newId('place'), campaign_id: campaign, name: entry.name, description: '', version: 1, undone: false, created_by: me(),
        pack_id: pack, pack_entry_id: entry_id, pack_type: nothing(facts.pack_type), pack_parent_id: nothing(facts.pack_parent_id), pack_key: nothing(facts.pack_key),
        players_name: String(facts.players_name ?? '').trim(), terrain_id: nothing(facts.terrain_id), region_id: nothing(facts.region_id),
        settlement: facts.settlement && typeof facts.settlement === 'object' ? facts.settlement : null,
        created_at: new Date().toISOString(), updated_at: new Date(Date.now() + nextId).toISOString(),
      };
      tables.places.push(place);
      log('places', null, structuredClone(place), tag);
      const noteRow: Row = { id: place.id, campaign_id: campaign, traps: String(given.traps ?? ''), puzzles: String(given.puzzles ?? ''), encounters: String(given.encounters ?? ''), treasure: String(given.treasure ?? ''), doors: String(given.doors ?? ''), version: 1, undone: false };
      tables.place_notes.push(noteRow);
      log('place_notes', null, structuredClone(noteRow), tag);
      parts.forEach((pc, position) => {
        const piece: Row = { id: newId('piece'), campaign_id: campaign, place_id: place.id, kind: pc.kind, body: String(pc.body).trim(), position, gm_value: String(pc.gm_value ?? ''), gm_trigger: String(pc.gm_trigger ?? ''), gm_stat_line: String(pc.gm_stat_line ?? ''), lead: typeof pc.lead === 'string' && pc.lead.trim() ? pc.lead.trim() : null, undone: false, version: 1, created_at: new Date(Date.now() + nextId).toISOString() };
        tables.place_pieces.push(piece);
        log('place_pieces', null, structuredClone(piece), tag);
      });
      return copy(place);
    },
    ...travelRpcs,
    // Pieces (M5b g2), like supabase/migrations/…_m5b_g2_place_pieces.sql: + Piece, Show / Hide one, Hide all (the
    // GM's), and a player's shown pieces of their groups' current places, in the order shown.
    add_place_piece: ({ place, kind, body }, tag) => {
      const made = madeBy('place_pieces', tag);
      if (made) return copy(tables.place_pieces.find((pc) => pc.id === made.target_id));
      const found = tables.places.find((p) => p.id === place && !p.undone);
      if (!found || !isGmOf(found.campaign_id)) return refused("You don't have permission to do that.");
      const text = typeof body === 'string' ? body.trim() : '';
      if (!text) return plain('Write what players will see.');
      const position = Math.max(-1, ...tables.place_pieces.filter((pc) => pc.place_id === place).map((pc) => Number(pc.position))) + 1;
      const piece: Row = { id: newId('piece'), campaign_id: found.campaign_id, place_id: place, kind, body: text, position, gm_value: '', gm_trigger: '', gm_stat_line: '', lead: null, undone: false, created_at: new Date(Date.now() + nextId).toISOString() };
      tables.place_pieces.push(piece);
      log('place_pieces', null, structuredClone(piece), tag);
      return copy(piece);
    },
    show_place_piece: ({ visit, piece, show_it }, tag) => {
      const made = madeBy('piece_shows', tag);
      if (made) return copy(tables.piece_shows.find((s) => s.id === made.target_id));
      const here = tables.group_places.find((g) => g.id === visit);
      if (!here || !isGmOf(here.campaign_id)) return refused("You don't have permission to do that.");
      if (here.undone || here.moved_on) return plain('That group has moved on from there.');
      const thisPiece = tables.place_pieces.find((pc) => pc.id === piece && !pc.undone);
      if (!thisPiece || thisPiece.place_id !== here.place_id) return plain("That piece isn't in this place any more.");
      const row = tables.piece_shows.find((s) => s.group_place_id === visit && s.piece_id === piece && !s.undone);
      if (!row) {
        if (show_it !== true) return { data: null, error: null };
        const shown: Row = { id: newId('piece-show'), campaign_id: here.campaign_id, group_place_id: visit, piece_id: piece, group_number: here.group_number, shown: true, shown_at: new Date(Date.now() + nextId).toISOString(), undone: false };
        tables.piece_shows.push(shown);
        log('piece_shows', null, structuredClone(shown), tag);
        return copy(shown);
      }
      if (row.shown !== (show_it === true)) changeRow('piece_shows', row, show_it === true ? { shown: true, shown_at: new Date(Date.now() + nextId++).toISOString() } : { shown: false }, tag);
      return copy(row);
    },
    // B15 (…_p2p_b15_item_truth.sql), a stand-in for the layout pictures only: the GM's eye on a magic item's piece
    // shows it and writes a pointer to it (`item_data.truthPiece`) on the given lines; item_truths gives a reader the
    // real name and words of a line they read whose pointer names a piece shown to any group and not undone. It skips
    // the check that a GM wrote the pointer: the real database's, tested in supabase/tests/p2p-b15-item-truth.test.ts.
    show_item_truth: ({ visit, piece, lines }, tag) => {
      const here = tables.group_places.find((g) => g.id === visit);
      if (!here || !isGmOf(here.campaign_id)) return refused("You don't have permission to do that.");
      const truth = tables.place_pieces.find((pc) => pc.id === piece && !pc.undone);
      if (!truth || truth.kind !== 'other' || !String(truth.lead ?? '').trim()) return plain("That piece isn't a magic item's truth.");
      const shown = groupRpcs.show_place_piece!({ visit, piece, show_it: true }, tag);
      if (shown.error) return shown;
      let named = 0;
      for (const id of Array.isArray(lines) ? (lines as unknown[]) : []) {
        const line = tables.inventory_lines.find((l) => l.id === id && l.campaign_id === here.campaign_id);
        const data = (line?.item_data ?? {}) as Row;
        if (!line || data.truthPiece === piece) continue;
        changeRow('inventory_lines', line, { item_data: { ...data, truthPiece: piece } }, tag);
        named += 1;
      }
      return { data: named, error: null };
    },
    // A thing sent after the reveal (the local review of #10): the pointer on the given lines, nothing shown; refused for
    // a piece not shown to some group (a show not undone).
    name_item_truth: ({ piece, lines }, tag) => {
      const truth = tables.place_pieces.find((pc) => pc.id === piece && !pc.undone);
      if (!truth || !isGmOf(truth.campaign_id)) return refused("You don't have permission to do that.");
      if (truth.kind !== 'other' || !String(truth.lead ?? '').trim()) return plain("Only a magic item's piece can name an item.");
      if (!tables.piece_shows.some((s) => s.piece_id === piece && !s.undone)) return plain("That magic item hasn't been shown yet.");
      let named = 0;
      for (const id of Array.isArray(lines) ? (lines as unknown[]) : []) {
        const line = tables.inventory_lines.find((l) => l.id === id && l.campaign_id === truth.campaign_id);
        const data = (line?.item_data ?? {}) as Row;
        if (!line || data.truthPiece === piece) continue;
        changeRow('inventory_lines', line, { item_data: { ...data, truthPiece: piece } }, tag);
        named += 1;
      }
      return { data: named, error: null };
    },
    item_truths: ({ campaign }) => {
      const gmHere = isGmOf(campaign);
      if (!gmHere && !tables.members.some((m) => m.campaign_id === campaign && m.user_id === me())) return { data: [], error: null };
      const reads = (l: Row) => {
        if (gmHere || l.location_id) return true;
        const carrier = tables.actors.find((a) => a.id === l.actor_id);
        return !!carrier && (carrier.approval === 'approved' || carrier.owner_user_id === me());
      };
      const out = tables.inventory_lines.flatMap((l) => {
        const pointer = ((l.item_data ?? {}) as Row).truthPiece;
        if (l.campaign_id !== campaign || typeof pointer !== 'string' || !reads(l)) return [];
        const truth = tables.place_pieces.find((pc) => pc.id === pointer && !pc.undone && pc.kind === 'other' && String(pc.lead ?? '').trim());
        if (!truth || !tables.piece_shows.some((s) => s.piece_id === pointer && !s.undone)) return [];
        return [{ line_id: l.id, name: String(truth.lead), body: String(truth.body) }];
      });
      return { data: out, error: null };
    },
    hide_all_pieces: ({ visit }, tag) => {
      const here = tables.group_places.find((g) => g.id === visit);
      if (!here || !isGmOf(here.campaign_id)) return refused("You don't have permission to do that.");
      const shown = tables.piece_shows.filter((s) => s.group_place_id === visit && s.shown === true && !s.undone);
      for (const s of shown) changeRow('piece_shows', s, { shown: false }, tag);
      return { data: shown.length, error: null };
    },
    // After they're added (M5b g2b), like supabase/migrations/20261102320000_m5b_g2b_pieces_follow_up.sql: Edit piece
    // (kind and text, the version moving on; a save from an old copy refused), Remove this piece (the undone flag),
    // and Back at (the new visit starts with what the place's last visit showed, in its order).
    edit_place_piece: ({ piece, kind, body, seen }, tag) => {
      const found = tables.place_pieces.find((pc) => pc.id === piece);
      if (!found || !isGmOf(found.campaign_id)) return refused("You don't have permission to do that.");
      if (found.undone) return plain('That piece was removed.');
      const text = typeof body === 'string' ? body.trim() : '';
      if (!text) return plain('Write what players will see.');
      if (isStale({ ...found, version: Number(found.version ?? 1) }, seen)) return staleResult;
      if (found.kind !== kind || found.body !== text) {
        if (!('version' in found)) found.version = 1;
        changeRow('place_pieces', found, { kind, body: text }, tag);
      }
      return copy(found);
    },
    // place.setPicture (M5b step 1 follow-up, ruled B), like …_m5b_1b_picture_shown_on_its_own.sql: the old picture
    // piece is retired; with an asset, a new picture piece, hidden.
    set_place_picture: ({ place, asset }, tag) => {
      const made = madeBy('place_pieces', tag);
      if (made) return copy(tables.place_pieces.find((pc) => pc.id === made.target_id));
      const found = tables.places.find((p) => p.id === place && !p.undone);
      if (!found || !isGmOf(found.campaign_id)) return refused("You don't have permission to do that.");
      if (asset !== null && !tables.assets.some((a) => a.id === asset && a.kind === 'place' && a.campaign_id === found.campaign_id)) return refused("That picture can't be this place's picture.");
      for (const old of tables.place_pieces.filter((pc) => pc.place_id === place && pc.kind === 'picture' && !pc.undone && pc.asset_id !== asset)) changeRow('place_pieces', old, { undone: true }, tag);
      if (asset === null) return { data: null, error: null };
      const there = tables.place_pieces.find((pc) => pc.place_id === place && pc.kind === 'picture' && !pc.undone && pc.asset_id === asset);
      if (there) return copy(there);
      const position = Math.min(1, ...tables.place_pieces.filter((pc) => pc.place_id === place).map((pc) => Number(pc.position))) - 1;
      const piece: Row = { id: newId('piece'), campaign_id: found.campaign_id, place_id: place, kind: 'picture', body: 'A picture', position, asset_id: asset, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false, version: 1, created_at: new Date(Date.now() + nextId).toISOString() };
      tables.place_pieces.push(piece);
      log('place_pieces', null, structuredClone(piece), tag);
      return copy(piece);
    },
    remove_place_piece: ({ piece }, tag) => {
      const found = tables.place_pieces.find((pc) => pc.id === piece);
      if (!found || !isGmOf(found.campaign_id)) return refused("You don't have permission to do that.");
      if (!found.undone) changeRow('place_pieces', found, { undone: true }, tag);
      return copy(found);
    },
    back_at_place: ({ visit }, tag) => {
      const here = tables.group_places.find((g) => g.id === visit);
      if (!here || !isGmOf(here.campaign_id)) return refused("You don't have permission to do that.");
      if (!here.place_id) return { data: 0, error: null };
      if (here.undone || here.moved_on) return plain('That group has moved on from there.');
      if (tables.piece_shows.some((s) => s.group_place_id === visit && !s.undone)) {
        return { data: tables.piece_shows.filter((s) => s.group_place_id === visit && s.shown === true && !s.undone).length, error: null };
      }
      const last = tables.group_places
        .filter((g) => g.campaign_id === here.campaign_id && g.place_id === here.place_id && g.id !== here.id && !g.undone && String(g.created_at) < String(here.created_at))
        // A group still there first (what the room shows now), then the visit left last.
        .sort((a, b) => Number(a.moved_on === true) - Number(b.moved_on === true) || String(b.updated_at ?? b.created_at).localeCompare(String(a.updated_at ?? a.created_at)))[0];
      if (!last) return { data: 0, error: null };
      const shows = tables.piece_shows
        .filter((s) => s.group_place_id === last.id && s.shown === true && !s.undone && tables.place_pieces.some((pc) => pc.id === s.piece_id && !pc.undone))
        .sort((a, b) => String(a.shown_at).localeCompare(String(b.shown_at)));
      for (const s of shows) {
        const made: Row = { id: newId('piece-show'), campaign_id: here.campaign_id, group_place_id: visit, piece_id: s.piece_id, group_number: here.group_number, shown: true, shown_at: s.shown_at, undone: false };
        tables.piece_shows.push(made);
        log('piece_shows', null, structuredClone(made), tag);
      }
      return { data: shows.length, error: null };
    },
    scene_pieces: ({ campaign, as_player }) => {
      withGroupRows();
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, as_player)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && !g.moved_on)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
        if (!visit || !place) return [];
        return tables.piece_shows
          .filter((s) => s.group_place_id === visit.id && s.shown === true && !s.undone)
          .sort((a, b) => String(a.shown_at).localeCompare(String(b.shown_at)))
          .flatMap((s) => {
            const pc = tables.place_pieces.find((x) => x.id === s.piece_id && !x.undone);
            return pc ? [{ group_number: group, place_name: place.players_name || place.name, piece_id: pc.id, kind: pc.kind, body: plainText(String(pc.body)), lead: pc.lead == null ? null : plainText(String(pc.lead)) }] : [];
          });
      });
      return { data: rows, error: null };
    },
    // A place's rules and its check (December dec-7 piece 3), like …_dec_7_3_place_check_and_rules.sql: the GM's
    // switches; the rules of the place a group is shown and the places it sits in, less those not open; the last
    // shown place's check when it stands in for the setting's.
    set_place_rule_switch: ({ campaign, pack, entry_id, rule_id, which, value }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const entry = tables.library_entries.find((e) => e.pack_id === pack && e.kind === 'location' && e.pack_entry_id === entry_id);
      if (!entry || !tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === pack)) return plain("That place isn't in an attached pack.");
      const data = (entry.data ?? {}) as Row;
      const rules = Array.isArray(data.rules) ? (data.rules as Row[]) : [];
      const check = data.encounterCheck && typeof data.encounterCheck === 'object' ? (data.encounterCheck as Row) : null;
      const theRule = rules.find((r) => r && typeof r === 'object' && r.id === rule_id);
      // Like the database: a switch names a rule the place has, or a place with its own check; a rule the pack keeps
      // for the GM is never opened.
      if (which === 'inForce' && !check) return plain('That place has no encounter check of its own.');
      if (which === 'eye' && !theRule) return plain("That rule isn't in that place.");
      if (which === 'eye' && value === true && theRule!.gmOnly === true) return plain('The book keeps this for the GM: players never see it.');
      const ruleName = which === 'inForce' ? String(check!.name ?? '').trim() || 'Encounter check' : String(theRule!.name ?? '');
      const row = tables.place_rule_switches.find((s) => s.campaign_id === campaign && s.pack_id === pack && s.entry_id === entry_id && s.rule_id === rule_id && s.which === which && !s.undone);
      if (!row) {
        const made: Row = { id: newId('rule-switch'), campaign_id: campaign, pack_id: pack, entry_id, rule_id, which, value: value === true, rule_name: ruleName, place_name: String(entry.name ?? ''), undone: false };
        tables.place_rule_switches.push(made);
        log('place_rule_switches', null, structuredClone(made), tag);
        return copy(made);
      }
      if (row.value !== (value === true)) changeRow('place_rule_switches', row, { value: value === true }, tag);
      return copy(row);
    },
    place_rules_for_players: ({ campaign, as_player }) => {
      withGroupRows();
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, as_player)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && !g.moved_on)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
        if (!visit || !place || !place.pack_id || !visitShown(visit.id)) return [];
        if (!tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === place.pack_id)) return [];
        return fakeChain(place.pack_id, place.pack_entry_id).flatMap((entry, depth) => {
          const rules = Array.isArray((entry.data as Row).rules) ? ((entry.data as Row).rules as Row[]) : [];
          return rules.flatMap((r) => {
            if (!r || typeof r !== 'object' || !r.id || !r.name) return [];
            const eye = tables.place_rule_switches.find((s) => s.campaign_id === campaign && s.pack_id === place.pack_id && s.entry_id === entry.pack_entry_id && s.rule_id === r.id && s.which === 'eye' && !s.undone);
            // Never a rule the pack keeps for the GM, whatever a switch says; else open unless the GM closed it.
            if (r.gmOnly === true || (eye && eye.value !== true)) return [];
            const own = String(place.players_name || place.name);
            const placeName = depth === 0 ? own : fakeShownPlaceName(campaign, group, place.pack_id, entry, own);
            return [{ group_number: group, place_name: placeName, name: plainText(String(r.name)), body: r.text === undefined ? null : plainDeep(r.text), button: fakeButtonText(r.button) }];
          });
        });
      });
      return { data: rows, error: null };
    },
    encounter_check_for_players: ({ campaign, as_player }) => {
      withGroupRows();
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, as_player)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && visitShown(g.id) && tables.expeditions.some((x) => x.id === g.expedition_id && !x.undone && (x.ended_at ?? null) === null))
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
        if (!visit || !place || !place.pack_id) return [];
        const chain = fakeChain(place.pack_id, place.pack_entry_id);
        const owner = chain.find((e) => (e.data as Row).encounterCheck && typeof (e.data as Row).encounterCheck === 'object');
        if (!owner || !tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === place.pack_id)) return [];
        const check = (owner.data as Row).encounterCheck as Row;
        if (check.replacesScheduled !== true) return [];
        const off = tables.place_rule_switches.some((s) => s.campaign_id === campaign && s.pack_id === place.pack_id && s.entry_id === owner.pack_entry_id && s.rule_id === 'encounterCheck' && s.which === 'inForce' && !s.undone && s.value === false);
        if (off) return [];
        const checked = Object.fromEntries(['when', 'every', 'chance'].filter((k) => check[k] !== undefined && check[k] !== null).map((k) => [k, check[k]]));
        const own = String(place.players_name || place.name);
        return [{ group_number: group, place_name: chain[0] === owner ? own : fakeShownPlaceName(campaign, group, place.pack_id, owner, own), checked }];
      });
      return { data: rows, error: null };
    },
    // The players' place card (P4), like …_p4_players_place_card.sql: the GM's eye on a section of Knowledge (its words
    // copied from the pack), a player's card of the place their group is shown, and the sections shared with them.
    set_knowledge_share: ({ campaign, group_no, pack, entry_id, section_at, share }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const entry = tables.library_entries.find((e) => e.pack_id === pack && e.kind === 'location' && e.pack_entry_id === entry_id);
      if (!entry || !tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === pack)) return plain("That place isn't in an attached pack.");
      const gm = ((entry.data ?? {}) as Row).gm as Row | undefined;
      const sections = gm && Array.isArray(gm.sections) ? (gm.sections as Row[]) : [];
      const section = sections[Number(section_at)];
      if (!section || typeof section !== 'object') return plain("That section isn't in that place's knowledge.");
      const clock = Number(tables.campaign_clocks.find((c) => c.campaign_id === campaign)?.seconds ?? 0);
      const row = tables.knowledge_shares.find((k) => k.campaign_id === campaign && Number(k.group_number) === Number(group_no) && k.pack_id === pack && k.entry_id === entry_id && Number(k.section_at) === Number(section_at) && !k.undone);
      if (!row) {
        if (share !== true) return { data: null, error: null };
        const made: Row = { id: newId('knowledge-share'), campaign_id: campaign, group_number: Number(group_no), pack_id: pack, entry_id, section_at: Number(section_at), heading: String(section.heading ?? ''), body: section.text ?? null, shared: true, shared_clock: clock, place_name: String(entry.name ?? ''), undone: false };
        tables.knowledge_shares.push(made);
        log('knowledge_shares', null, structuredClone(made), tag);
        return copy(made);
      }
      if (row.shared !== (share === true)) changeRow('knowledge_shares', row, share === true ? { shared: true, shared_clock: clock } : { shared: false }, tag);
      return copy(row);
    },
    place_card_for_players: ({ campaign, as_player }) => {
      withGroupRows();
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, as_player)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && !g.moved_on)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
        // A detached pack's place sends nothing (local review of the P4 fixes, 1).
        if (!visit || !place || !visitShown(visit.id) || (place.pack_id && !tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === place.pack_id))) return [];
        const out: Row[] = [{ group_number: group, kind: 'here', at: 0, place_id: place.id, key: String(place.pack_key ?? ''), name: String(place.players_name || place.name) }];
        if (!place.pack_id) return out;
        const above = fakeChain(place.pack_id, place.pack_entry_id).slice(1);
        const names = above.map((entry) => fakeKnownEntryName(campaign, group, place.pack_id, entry));
        const trail = names.filter((n): n is string => !!n).reverse();
        trail.forEach((name, i) => out.push({ group_number: group, kind: 'trail', at: i + 1, place_id: null, key: null, name }));
        if (names[0]) out.push({ group_number: group, kind: 'area', at: 0, place_id: null, key: null, name: names[0] });
        const parent = String(place.pack_parent_id ?? '');
        if (parent) {
          const known = tables.places.filter(
            (q) =>
              q.campaign_id === campaign && !q.undone && q.pack_id === place.pack_id && String(q.pack_parent_id ?? '') === parent && q.id !== place.id && q.pack_entry_id !== place.pack_entry_id &&
              tables.group_places.some((g) => g.place_id === q.id && Number(g.group_number) === group && !g.undone && !tables.expeditions.some((x) => x.id === g.expedition_id && x.undone) && visitShown(g.id)),
          );
          known.sort((a, b) => String(a.pack_key ?? '').length - String(b.pack_key ?? '').length || String(a.pack_key ?? '').localeCompare(String(b.pack_key ?? '')));
          // Each with the first piece the group was shown there (ppf-4), never a picture.
          const lineOf = (q: Row) => {
            const visits = new Set(tables.group_places.filter((g) => g.place_id === q.id && Number(g.group_number) === group && !g.undone && !tables.expeditions.some((x) => x.id === g.expedition_id && x.undone)).map((g) => g.id));
            const first = tables.piece_shows
              .filter((sh) => visits.has(sh.group_place_id) && sh.shown === true && !sh.undone)
              .sort((a, b) => String(a.shown_at).localeCompare(String(b.shown_at)))
              .map((sh) => tables.place_pieces.find((pc) => pc.id === sh.piece_id && !pc.undone && pc.kind !== 'picture' && String(pc.body ?? '').trim()))
              .find(Boolean);
            return first ? plainText(String(first.body)) : '';
          };
          known.forEach((q, i) => out.push({ group_number: group, kind: 'known', at: i + 1, place_id: q.id, key: String(q.pack_key ?? ''), name: String(q.players_name || q.name), line: lineOf(q) }));
        }
        return out;
      });
      return { data: rows, error: null };
    },
    knowledge_for_players: ({ campaign, as_player }) => {
      withGroupRows();
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, as_player)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && !g.moved_on)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
        if (!visit || !place || !place.pack_id || !visitShown(visit.id)) return [];
        const chain = fakeChain(place.pack_id, place.pack_entry_id).map((e) => e.pack_entry_id);
        const parent = String(place.pack_parent_id ?? '');
        const own = String(place.players_name || place.name);
        return tables.knowledge_shares
          .filter((k) => k.campaign_id === campaign && Number(k.group_number) === group && k.pack_id === place.pack_id && k.shared === true && !k.undone)
          .filter((k) => {
            if (chain.includes(k.entry_id)) return true;
            const entry = tables.library_entries.find((e) => e.pack_id === k.pack_id && e.kind === 'location' && e.pack_entry_id === k.entry_id);
            return !!parent && ((entry?.data ?? {}) as Row).parentId === parent;
          })
          .sort((a, b) => Number(a.shared_clock) - Number(b.shared_clock))
          .map((k) => {
            const entry = tables.library_entries.find((e) => e.pack_id === k.pack_id && e.kind === 'location' && e.pack_entry_id === k.entry_id);
            const placeName = k.entry_id === place.pack_entry_id || !entry ? own : (fakeKnownEntryName(campaign, group, place.pack_id, entry) ?? own);
            return { group_number: group, share_id: k.id, place_name: placeName, heading: plainText(String(k.heading ?? '')), body: k.body === null || k.body === undefined ? null : plainDeep(k.body), shared_clock: Number(k.shared_clock) };
          });
      });
      return { data: rows, error: null };
    },
    // The players' map (P5), like …_p5_players_map.sql: for each of the reader's groups, the copy of the map of the last
    // place shown to it on the expedition under way (its own tie, else the copy another place holds for the same pack
    // map, up the place's trail), only while its eye is open.
    map_for_players: ({ campaign }) => {
      withGroupRows();
      const packMap = (packId: unknown, entryId: unknown) => {
        if (!packId || !entryId) return null;
        const maps = tables.library_entries
          .filter((e) => e.pack_id === packId && e.kind === 'map' && Array.isArray((e.data as Row)?.locationIds))
          .sort((a, b) => String(a.pack_entry_id).localeCompare(String(b.pack_entry_id)));
        for (const entry of fakeChain(packId, entryId)) {
          const found = maps.find((m) => ((m.data as Row).locationIds as unknown[]).includes(entry.pack_entry_id));
          if (found) return String(found.pack_entry_id);
        }
        return null;
      };
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === me()).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && Number(g.group_number) === group && !g.undone && visitShown(g.id) && tables.expeditions.some((x) => x.id === g.expedition_id && !x.undone && (x.ended_at ?? null) === null))
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone);
        if (!visit || !place) return [];
        const own = packMap(place.pack_id, place.pack_entry_id);
        const held = own
          ? tables.places
              .filter((q) => q.campaign_id === campaign && !q.undone && q.id !== place.id && q.map_asset_id && q.pack_id === place.pack_id && packMap(q.pack_id, q.pack_entry_id) === own)
              .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))[0]
          : undefined;
        const assetId = place.map_asset_id ?? held?.map_asset_id ?? null;
        const asset = assetId && tables.assets.find((a) => a.id === assetId && a.campaign_id === campaign && a.kind === 'map' && a.visibility === 'all');
        return asset ? [{ group_number: group, asset_id: asset.id, title: String(asset.name ?? '') }] : [];
      });
      return { data: rows, error: null };
    },
    // A place's picture (M5b step 1 follow-up), like …_m5b_1b_place_picture.sql: each of the reader's groups shown its
    // current place (a piece shown on this visit) gets the place's picture, if it has one.
    scene_pictures: ({ campaign, as_player }) => {
      return { data: shownPlacePictures(campaign, as_player).map(({ group, assetId }) => ({ group_number: group, asset_id: assetId })), error: null };
    },
    // The town screen (M5b step 6c), like …_m5b_6c_town_screen.sql: each of the reader's groups at a settlement place
    // (its current visit in the newest expedition, under way or ended) gets the places in town shown to players.
    scene_town: ({ campaign, as_player }) => {
      withGroupRows();
      const newest = tables.expeditions
        .filter((x) => x.campaign_id === campaign && !x.undone)
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0];
      if (!newest) return { data: [], error: null };
      const groups = [...new Set(activeIn(campaign).filter((a) => a.owner_user_id === readerAs(campaign, as_player)).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      const rows = groups.flatMap((group) => {
        const visit = tables.group_places
          .filter((g) => g.campaign_id === campaign && g.expedition_id === newest.id && Number(g.group_number) === group && !g.undone && !g.moved_on)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const place = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone && isSettlementRow(p));
        if (!place) return [];
        // The place itself is shown to the group: a piece of it shown on the visit (review finding 2, ruled B).
        const townShown = tables.piece_shows.some((s) => s.group_place_id === visit.id && s.shown === true && !s.undone && tables.place_pieces.some((pc) => pc.id === s.piece_id && !pc.undone));
        if (!townShown) return [];
        const town = (place.town ?? {}) as Record<string, { name: string; kind?: string; shown: boolean; open: boolean }>;
        return Object.entries(town)
          .filter(([, e]) => e.shown === true)
          .sort(([ka, a], [kb, b]) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || ka.localeCompare(kb))
          .map(([key, e]) => ({ group_number: group, place_name: place.players_name || place.name, entry_key: key, name: e.name, kind: e.kind ?? '', open: e.open }));
      });
      return { data: rows, error: null };
    },
    // Requests (M5 step 12), like supabase/migrations/…_m5_requests.sql: a player sends for their own character in
    // play; the GM asks each player character (or the party as one); the requester cancels or enters while it waits;
    // the GM answers, and with a cost the clock moves on in the same request.
    // Messaging (M5b g4), like supabase/migrations/20261102120000_m5b_g4_messages.sql: the GM writes to characters in
    // play (one message each), a player to the GM as their own character; only the GM attaches a picture; the
    // recipient reads (a repeat changes nothing).
    send_messages: ({ campaign, to_characters, body, disappears, attachment }, tag) => {
      const madeBefore = tables.messages.filter((m) => tables.events.some((e) => e.request_id === tag?.requestId && e.target_id === m.id && e.before === null));
      if (madeBefore.length > 0) return { data: madeBefore.map((m) => ({ ...m })), error: null };
      if (!isMemberOf(campaign)) return refused("You don't have permission to do that.");
      const gm = isGmOf(campaign);
      const to = Array.isArray(to_characters) ? (to_characters as unknown[]) : [];
      if (to.length === 0) return plain('Pick at least one character.');
      if (!gm && to.length > 1) return plain('A player writes to the GM as one character at a time.');
      const text = typeof body === 'string' ? body.trim() : '';
      if (!text && !attachment) return plain('Write something to send.');
      if (attachment && !gm) return plain('Only the GM can attach a file.');
      const file = attachment as { name?: string; type?: string; size?: number } | null;
      if (file && Number(file.size ?? 0) > 10 * 1024 * 1024) return plain('That picture is too large. Choose one under 10 MB.');
      const rows: Row[] = [];
      for (const actorId of to) {
        const character = tables.actors.find((a) => a.id === actorId && a.campaign_id === campaign);
        if (!character) return plain("That character isn't in this campaign.");
        if (character.kind !== 'pc' || character.approval !== 'approved' || (character.status ?? 'active') !== 'active' || character.owner_type !== 'user' || !character.owner_user_id) {
          return plain("Messages go to a player's character in play.");
        }
        if (!gm && character.owner_user_id !== me()) return refused("You don't have permission to do that.");
        rows.push({
          id: newId('message'),
          campaign_id: campaign,
          actor_id: actorId,
          player_user_id: character.owner_user_id,
          from_gm: gm,
          sender_user_id: me(),
          body: text,
          attachment_name: file ? String(file.name ?? 'Picture') : null,
          attachment_type: file ? String(file.type ?? 'image/jpeg') : null,
          attachment_size: file ? Number(file.size ?? 0) : null,
          disappears: disappears === true,
          read_at: null,
          undone: false,
          created_at: new Date(Date.now() + nextId).toISOString(),
        });
      }
      for (const row of rows) {
        tables.messages.push(row);
        log('messages', null, structuredClone(row), tag);
      }
      return { data: rows.map((r) => ({ ...r })), error: null };
    },
    read_messages: ({ message_ids }, tag) => {
      const ids = Array.isArray(message_ids) ? (message_ids as unknown[]) : [];
      const recipientIsMe = (m: Row) => isMemberOf(m.campaign_id) && (m.from_gm ? m.player_user_id === me() : isGmOf(m.campaign_id));
      const mine = tables.messages.filter((m) => ids.includes(m.id) && !m.undone && recipientIsMe(m));
      if (mine.length === 0) return refused("You don't have permission to do that.");
      let count = 0;
      for (const row of mine) {
        if (row.read_at !== null) continue;
        changeRow('messages', row, { read_at: new Date().toISOString() }, tag);
        count += 1;
      }
      return { data: count, error: null };
    },
    send_request: ({ campaign, actor, kind, body, cost_text, prompt }, tag) => {
      // M5b step 6e (…_m5b_6e_town_requests.sql): buy and sell get their answer kinds; a listed lodging the GM shows,
      // open, in the asker's group's town is answered at once.
      const asked = (prompt ?? {}) as Record<string, unknown>;
      const listed = kind === 'lodging' && asked.listed === true;
      const made = madeBy('requests', tag);
      if (made) return copy(tables.requests.find((r) => r.id === made.target_id));
      if (!isMemberOf(campaign)) return refused("You don't have permission to do that.");
      const character = tables.actors.find((a) => a.id === actor && a.campaign_id === campaign && a.owner_type === 'user');
      if (!character) return plain("That character isn't in this campaign.");
      if (character.owner_user_id !== me()) return refused("You don't have permission to do that.");
      if (character.approval !== 'approved' || (character.status ?? 'active') !== 'active') return plain('Only a character in play can ask.');
      const text = typeof body === 'string' ? body.trim() : '';
      if (!text) return plain('Write what you want to do.');
      const trip = tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone);
      const row: Row = {
        id: newId('request'),
        campaign_id: campaign,
        expedition_id: trip?.id ?? null,
        group_number: trip ? groupNumberOf(actor) : null,
        requester_id: me(),
        actor_id: actor,
        kind,
        direction: 'playerAsks',
        text,
        cost_text: typeof cost_text === 'string' ? cost_text.trim() : '',
        prompt: prompt ?? {},
        entry: null,
        status: 'waiting',
        answer_kind: kind === 'buy' ? 'hitMissChoice' : kind === 'sell' ? 'offer' : 'yesNo',
        answer: null,
        answered_at: null,
        reply: null,
        undone: false,
        version: 1,
        created_by: me(),
        created_at: new Date(Date.now() + nextId).toISOString(),
      };
      if (listed) {
        const place = townPlaceOf(campaign, groupNumberOf(actor));
        const entry = place ? ((place.town ?? {}) as Record<string, { shown: boolean; open: boolean }>)[String(asked.key ?? '')] : undefined;
        if (!entry || !String(asked.key ?? '').startsWith('lodging:') || entry.shown !== true || entry.open !== true) return plain('That lodging isn\'t offered here.');
        Object.assign(row, { status: 'answered', answer: { kind: 'stay', listed: true }, answered_at: new Date().toISOString() });
      }
      // TC12 (…_dec16_tc12_ask_answered_at_once.sql): ask_for_thing's answer, like the database's transaction setting
      // read by private.request_stock_answer: only for this very ask (its campaign, character and thing).
      if (stockAnswer && kind === 'buy' && stockAnswer.campaign === campaign && stockAnswer.actor === actor && String(asked.itemId ?? '') === stockAnswer.item) {
        Object.assign(row, { status: 'answered', answer: stockAnswer.answer, answered_at: new Date().toISOString() });
      }
      tables.requests.push(row);
      log('requests', null, structuredClone(row), tag);
      return copy(row);
    },
    ask_requests: ({ campaign, kind, who, prompt, body }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const made = madeBy('requests', tag);
      if (made) return { data: tables.requests.filter((r) => tables.events.some((e) => e.request_id === tag?.requestId && e.target_id === r.id && e.before === null)).map((r) => ({ ...r })), error: null };
      const trip = tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone);
      if (!trip) return plain('Start an expedition first.');
      if (who !== 'party' && who !== 'each') return plain('Ask each character, or the party.');
      // Like the database (review of #194): only the characters who went on this expedition.
      const went = Array.isArray(trip.who_went) ? trip.who_went : [];
      const asked = who === 'party' ? [null] : activeIn(campaign).filter((a) => a.kind === 'pc' && a.owner_type === 'user' && a.owner_user_id && went.includes(a.id));
      if (asked.length === 0) return plain('Nobody to ask: no character went on this expedition.');
      const rows = asked.map((a): Row => ({
        id: newId('request'),
        campaign_id: campaign,
        expedition_id: trip.id,
        group_number: a ? groupNumberOf(a.id) : null,
        requester_id: a ? a.owner_user_id : null,
        actor_id: a ? a.id : null,
        kind,
        direction: 'gmAsks',
        text: typeof body === 'string' ? body : '',
        cost_text: '',
        prompt: prompt ?? {},
        entry: null,
        status: 'waiting',
        answer_kind: 'yesNo',
        answer: null,
        answered_at: null,
        undone: false,
        version: 1,
        created_by: me(),
        created_at: new Date(Date.now() + nextId).toISOString(),
      }));
      for (const row of rows) {
        tables.requests.push(row);
        log('requests', null, structuredClone(row), tag);
      }
      return { data: rows.map((r) => ({ ...r })), error: null };
    },
    withdraw_request: ({ request, seen_version }, tag) => {
      const row = tables.requests.find((r) => r.id === request && requestForMe(r));
      if (!row) return refused("You don't have permission to do that.");
      if (row.status === 'withdrawn') return copy(row);
      if (row.status !== 'waiting') return plain('The GM has answered it already.');
      if (isStale(row, seen_version)) return staleResult;
      if (isGmOf(row.campaign_id) || row.requester_id !== me()) return refused("You don't have permission to do that.");
      if (row.direction !== 'playerAsks') return plain('Only the GM takes back what the GM asked.');
      changeRow('requests', row, { status: 'withdrawn' }, tag);
      return copy(row);
    },
    // Got it (K20, pk-13), like supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql: the character's own player,
    // on an approved character in play in a campaign they're in, never the GM, sets the mark to the server's now.
    mark_finds_seen: ({ character }, tag) => {
      const actor = tables.actors.find((a) => a.id === character);
      const campaign = actor?.campaign_id;
      if (
        !actor || actor.kind !== 'pc' || actor.approval !== 'approved' || (actor.status ?? 'active') !== 'active' ||
        actor.owner_type !== 'user' || actor.owner_user_id !== me() || !isMemberOf(campaign) || isGmOf(campaign)
      ) {
        return refused("You don't have permission to do that.");
      }
      const seen = new Date(Date.now() + nextId).toISOString();
      // Like the database: the function names its own line (grimoire.event_type), tagged by the app or not.
      const named: NonNullable<Tag> = { ...(tag ?? { requestId: crypto.randomUUID() }), type: 'character.seenFinds', level: 'verbose' };
      const was = tables.finds_seen.find((r) => r.actor_id === character);
      if (was) {
        const before = structuredClone(was);
        Object.assign(was, { seen_at: seen, updated_at: seen });
        log('finds_seen', before, structuredClone(was), named);
      } else {
        const row: Row = { id: newId('finds-seen'), campaign_id: campaign, actor_id: character, seen_at: seen, created_at: seen, updated_at: seen };
        tables.finds_seen.push(row);
        log('finds_seen', null, structuredClone(row), named);
      }
      return { data: seen, error: null };
    },
    // Got it on a call (P7, p7-1 to p7-3), like supabase/migrations/20261124120000_p7_calls_seen.sql: a member who isn't
    // the GM, on a live send they may read, marks it seen; a repeat changes nothing and gives back the first time.
    mark_call_seen: ({ send }, tag) => {
      const sent = tables.hook_sends.find((s) => s.id === send);
      const campaign = sent?.campaign_id;
      if (!sent || sent.undone || !isMemberOf(campaign) || isGmOf(campaign) || ((sent.actor_id ?? null) !== null && sent.player_user_id !== me())) {
        return refused("You don't have permission to do that.");
      }
      const was = tables.calls_seen.find((r) => r.send_id === send && r.player_user_id === me());
      if (was) return { data: was.seen_at, error: null };
      const seen = new Date(Date.now() + nextId).toISOString();
      const row: Row = { id: newId('call-seen'), campaign_id: campaign, send_id: send, player_user_id: me(), seen_at: seen, created_at: seen, updated_at: seen };
      tables.calls_seen.push(row);
      log('calls_seen', null, structuredClone(row), { ...(tag ?? { requestId: crypto.randomUUID() }), type: 'hook.seen', level: 'verbose' });
      return { data: seen, error: null };
    },
    // Calls to adventure (dec-12 piece B), like supabase/migrations/20261113210000_dec_12b_calls_to_adventure.sql: the
    // GM sends a hook of an attached adventure to a player's character in play or to the party; one live send of a
    // hook to each hearer; a repeat of the request changes nothing.
    send_hook: ({ campaign, pack, hook_key, body, pays, to_actor }, tag) => {
      const made = madeBy('hook_sends', tag);
      if (made) return copy(tables.hook_sends.find((r) => r.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const hook = tables.library_entries.find(
        (e) => e.pack_id === pack && e.pack_entry_id === hook_key && e.kind === 'adventureHook' && tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === pack),
      );
      if (!hook) return plain("That call to adventure isn't in an adventure this campaign uses.");
      // As 20261113220000_dec_12b_send_hook_refusals.sql: the name as players will read it, said in words.
      const named = plainText(String(hook.name ?? '')).trim();
      if (!named) return plain('This call to adventure has no name the players can read. It needs fixing in its pack.');
      // In characters, as Postgres's length(): an emoji is one.
      if ([...named].length > 200) return plain("A call to adventure's name is at most 200 characters.");
      const actorId = typeof to_actor === 'string' ? to_actor : null;
      const who = actorId ? tables.actors.find((a) => a.id === actorId && a.campaign_id === campaign) : undefined;
      if (actorId && (!who || who.kind !== 'pc' || who.approval !== 'approved' || (who.status ?? 'active') !== 'active' || who.owner_type !== 'user' || !who.owner_user_id)) {
        return plain("Send it to a player's character in play, or to the party.");
      }
      // A link's code never reaches a player (rp-11): kept as its words.
      const words = typeof body === 'string' ? plainText(body).trim() : '';
      const paid = typeof pays === 'string' ? plainText(pays).trim() : '';
      if (!words) return plain('Write the words to send.');
      if (words.length > 4000) return plain('The words are at most 4000 characters.');
      if (paid.length > 500) return plain('What it pays is at most 500 characters.');
      if (tables.hook_sends.some((s) => s.campaign_id === campaign && s.pack_id === pack && s.hook_key === hook_key && (s.actor_id ?? null) === actorId && !s.undone)) {
        return plain(`It wasn't sent again: ${actorId ? String(who?.name) : 'the party'} already has it. Nothing changed.`);
      }
      const clock = tables.campaign_clocks.find((c) => c.campaign_id === campaign);
      const row: Row = {
        id: newId('hook-send'), campaign_id: campaign, pack_id: pack, hook_key, actor_id: actorId, player_user_id: who?.owner_user_id ?? null,
        name: named, body: words, pays: paid, clock_seconds: Number(clock?.seconds ?? 0), undone: false, version: 1,
        created_by: me(), created_at: new Date(Date.now() + nextId).toISOString(), kind: 'hook',
      };
      tables.hook_sends.push(row);
      log('hook_sends', null, structuredClone(row), tag);
      return copy(row);
    },
    // A shop's stock for the day (W12), like supabase/migrations/20261115110000_dec_3_w12_shop_stock.sql: the GM sets a
    // thing in or out (the day's live row changed, or one made), or puts the listed things back on undecided; a member
    // reads the things in force in, never one out or undecided.
    set_shop_stock: ({ campaign, service, item, on_day, answer }, tag) => {
      const made = madeBy('shop_stock', tag);
      if (made) return copy(tables.shop_stock.find((r) => r.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (answer !== 'in' && answer !== 'out') return plain('Set it in stock or not in stock.');
      const ids = [service, item].map((v) => (typeof v === 'string' ? v : ''));
      if (ids.some((v) => v.length < 1 || v.length > 200)) return plain("That shop or thing isn't known.");
      if (typeof on_day !== 'number' || !Number.isInteger(on_day) || on_day < 1) return plain("That day isn't on the campaign's clock.");
      const live = tables.shop_stock.find((r) => r.campaign_id === campaign && r.service_id === service && r.item_id === item && r.day === on_day && !r.undone);
      if (live) {
        if (live.answer !== answer) changeRow('shop_stock', live, { answer, updated_at: new Date(Date.now() + nextId).toISOString() }, tag);
        return copy(live);
      }
      const at = new Date(Date.now() + nextId).toISOString();
      const row: Row = { id: newId('shop-stock'), campaign_id: campaign, service_id: service, item_id: item, day: on_day, answer, undone: false, created_by: me(), created_at: at, updated_at: at };
      tables.shop_stock.push(row);
      log('shop_stock', null, structuredClone(row), tag);
      return copy(row);
    },
    reset_shop_stock: ({ campaign, service, on_day, items }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (typeof on_day !== 'number' || !Number.isInteger(on_day) || on_day < 1) return plain("That day isn't on the campaign's clock.");
      const listed = Array.isArray(items) ? items : [];
      if (listed.length > 2000) return plain("That's too many things at once.");
      const rows = tables.shop_stock.filter((r) => r.campaign_id === campaign && r.service_id === service && r.day === on_day && !r.undone && r.answer !== 'undecided' && listed.includes(r.item_id));
      for (const row of rows) changeRow('shop_stock', row, { answer: 'undecided', updated_at: new Date(Date.now() + nextId).toISOString() }, tag);
      return { data: rows.length, error: null };
    },
    // The players' reader works the answer in force out itself: each item for sale in the campaign (its winning version,
    // as private.items_open_in orders them), the day's live row, else the default with the town's size unknown, read
    // from the item's whole entry (its GM-only part included, for sale and availability; only ids come back). `offered`
    // only narrows, at most 2000 ids. A pack's shop (a `place:` key; sh-1 a, migration 20261115150000): only the GM's
    // stored "in" answers for the day on things for sale, no default, `offered` ignored.
    shop_stock_in: ({ campaign, service, on_day, offered }) => {
      if (Array.isArray(offered) && offered.length > 2000) return plain("That's too many things at once.");
      if (!tables.members.some((m) => m.campaign_id === campaign && m.user_id === me())) return { data: [], error: null };
      const packShop = typeof service === 'string' && service.startsWith('place:');
      const narrow = !packShop && Array.isArray(offered) ? new Set(offered.filter((o): o is string => typeof o === 'string')) : null;
      const attached = tables.campaign_packs.filter((cp) => cp.campaign_id === campaign);
      const rank = (e: Row): [number, number, number, string] => {
        const cp = attached.find((c) => c.pack_id === e.pack_id)!;
        const overrides = (tables.campaign_pack_secrets.find((s) => s.id === cp.id)?.overrides ?? {}) as Row;
        const homebrew = tables.packs.find((p) => p.id === e.pack_id)?.kind === 'homebrew';
        return [Object.hasOwn(overrides, `item:${String(e.pack_entry_id)}`) ? 1 : 0, homebrew ? 1 : 0, Number(cp.priority ?? 0), String(e.pack_id)];
      };
      const winners = new Map<string, Row>();
      for (const e of tables.library_entries.filter((e) => e.kind === 'item' && attached.some((cp) => cp.pack_id === e.pack_id))) {
        const id = String(e.pack_entry_id);
        if (narrow && !narrow.has(id)) continue;
        const was = winners.get(id);
        if (!was) {
          winners.set(id, e);
          continue;
        }
        const [a, b] = [rank(e), rank(was)];
        const better = a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] < b[3] ? 1 : a[3] > b[3] ? -1 : 0);
        if (better > 0) winners.set(id, e);
      }
      const live = tables.shop_stock.filter((r) => r.campaign_id === campaign && r.service_id === service && r.day === on_day && !r.undone);
      // The whole entry: its GM-only part (library_entry_secrets) merged over the readable part, for sale and availability.
      const wholeOf = (e: Row): Row => ({ ...((e.data ?? {}) as Row), ...((tables.library_entry_secrets.find((s) => s.id === e.id)?.data ?? {}) as Row) });
      const ids = [...winners.entries()]
        .filter(([, e]) => {
          const data = wholeOf(e);
          return typeof data.forSale === 'boolean' ? data.forSale : !/(^|-)magic(-|$)/.test(typeof data.category === 'string' ? data.category : '');
        })
        .filter(([id, e]) => {
          const stored = live.find((r) => r.item_id === id)?.answer;
          return (packShop ? stored : (stored ?? stockDefault(wholeOf(e).availability, null))) === 'in';
        })
        .map(([id]) => id)
        .sort();
      return { data: ids.map((item_id) => ({ item_id })), error: null };
    },
    // Ask for… answered at once (TC12), like supabase/migrations/20261125180000_dec16_tc12_ask_answered_at_once.sql and
    // its review fixes (20261126100000_dec16_tc12_ask_only_offered_shop.sql): only at a shop offered where the asker's
    // group is (its town's list has it shown and open; a pack's shop also its place live, one level under that town),
    // what the day's stock says of the thing (as private.stock_answer_for: the winning entry for sale, a stored answer,
    // else the default for a setting's shop; a pack's shop its stored answers alone), never a day before the newest day
    // with a live row; "in" with the entry's own price (never the device's), or "out", makes the request already
    // answered; else it waits for the GM as send_request's does.
    ask_for_thing: ({ campaign, actor, body, on_day, prompt }, tag) => {
      const made = madeBy('requests', tag);
      if (made) return copy(tables.requests.find((r) => r.id === made.target_id));
      if (!isMemberOf(campaign)) return refused("You don't have permission to do that.");
      const words = typeof body === 'string' ? body.trim() : '';
      if (!words) return plain('Write what you want to do.');
      if (typeof on_day !== 'number' || !Number.isInteger(on_day) || on_day < 1) return plain("That day isn't on the campaign's clock.");
      const asked = (prompt && typeof prompt === 'object' && !Array.isArray(prompt) ? prompt : {}) as Row;
      const service = typeof asked.serviceId === 'string' ? asked.serviceId : '';
      const item = typeof asked.itemId === 'string' ? asked.itemId : '';
      const liveDays = tables.shop_stock.filter((r) => r.campaign_id === campaign && !r.undone).map((r) => Number(r.day));
      let decided: 'in' | 'out' | null = null;
      let price = '';
      if (service && item && shopOfferedTo(campaign, actor, service) && !(liveDays.length > 0 && on_day < Math.max(...liveDays))) {
        const winner = winningItem(campaign, item);
        const whole = winner ? wholeEntry(winner) : null;
        if (whole && entryForSale(whole)) {
          const stored = tables.shop_stock.find((r) => r.campaign_id === campaign && r.service_id === service && r.item_id === item && r.day === on_day && !r.undone)?.answer;
          const said = service.startsWith('place:') ? stored : (stored ?? stockDefault(whole.availability, null));
          decided = said === 'in' || said === 'out' ? said : null;
          // The price said is the entry's readable value, in priceText's words (private.stock_price_for).
          if (decided === 'in') price = priceWords(visiblePart(whole).value);
        }
      }
      const answer = decided === 'in' && price ? { kind: 'buy', result: 'inStock', price, note: '' } : decided === 'out' ? { kind: 'buy', result: 'notHere', price: '', note: '' } : null;
      stockAnswer = answer ? { campaign: String(campaign), actor: String(actor), item, answer } : null;
      // Review fix, round 2 (…_dec16_tc12_ask_prompt_server_price.sql): the prompt stored, and so logged, is the buy
      // prompt's own fields as sent with the server's price: the entry's (waiting or not), '' with no thing named.
      const winner = item ? winningItem(campaign, item) : undefined;
      const stored: Row = Object.fromEntries(Object.entries(asked).filter(([key]) => ['serviceId', 'shop', 'itemId', 'item'].includes(key)));
      stored.price = winner ? priceWords(visiblePart(wholeEntry(winner)).value) : '';
      try {
        return groupRpcs.send_request!({ campaign, actor, kind: 'buy', body: words, cost_text: '', prompt: stored }, tag);
      } finally {
        stockAnswer = null;
      }
    },
    // A rumour given (dec-12 piece E), like supabase/migrations/20261114220000_dec_12e_rumours.sql: the GM gives the row
    // of a rumours table of an attached adventure whose range is row_min to row_max; only its words are copied (never
    // its truth or note), as a send of kind 'rumour'; one live give of a row to each hearer.
    give_rumour: ({ campaign, pack, table_key, row_min, row_max, to_actor }, tag) => {
      const made = madeBy('hook_sends', tag);
      if (made) return copy(tables.hook_sends.find((r) => r.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const entry = tables.library_entries.find(
        (e) =>
          e.pack_id === pack && e.pack_entry_id === table_key && e.kind === 'table' && isRumoursTable((e.data ?? {}) as Row) &&
          tables.packs.some((pk) => pk.id === pack && pk.kind === 'adventure') && tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === pack),
      );
      if (!entry) return plain("That table of rumours isn't in an adventure this campaign uses.");
      const rows = Array.isArray((entry.data as Row).rows) ? ((entry.data as Row).rows as Row[]) : [];
      const found = rows.find((r) => r && typeof r === 'object' && r.min === row_min && r.max === row_max);
      if (!found) return plain("That rumour isn't in its table any more.");
      const said = typeof found.result === 'string' ? found.result : typeof found.value === 'string' ? found.value : '';
      const words = plainText(said).trim();
      if (!words) return plain('This rumour has no words the players can read. It needs fixing in its pack.');
      if (words.length > 4000) return plain('The words are at most 4000 characters.');
      // rm-2 (…_dec_12e_rumour_name.sql): a give is named "A rumour", never the table's name.
      const named = 'A rumour';
      const key = `${String(table_key)}#${String(row_min)}-${String(row_max)}`;
      const actorId = typeof to_actor === 'string' ? to_actor : null;
      const who = actorId ? tables.actors.find((a) => a.id === actorId && a.campaign_id === campaign) : undefined;
      if (actorId && (!who || who.kind !== 'pc' || who.approval !== 'approved' || (who.status ?? 'active') !== 'active' || who.owner_type !== 'user' || !who.owner_user_id)) {
        return plain("Send it to a player's character in play, or to the party.");
      }
      if (tables.hook_sends.some((s) => s.campaign_id === campaign && s.pack_id === pack && s.hook_key === key && (s.actor_id ?? null) === actorId && !s.undone)) {
        return plain(`It wasn't sent again: ${actorId ? String(who?.name) : 'the party'} already has it. Nothing changed.`);
      }
      const clock = tables.campaign_clocks.find((c) => c.campaign_id === campaign);
      const row: Row = {
        id: newId('hook-send'), campaign_id: campaign, pack_id: pack, hook_key: key, actor_id: actorId, player_user_id: who?.owner_user_id ?? null,
        name: named, body: words, pays: '', clock_seconds: Number(clock?.seconds ?? 0), undone: false, version: 1,
        created_by: me(), created_at: new Date(Date.now() + nextId).toISOString(), kind: 'rumour',
      };
      tables.hook_sends.push(row);
      log('hook_sends', null, structuredClone(row), tag);
      return copy(row);
    },
    // Sheet changes (m5b sheet revised), like supabase/migrations/20261108200000_m5b_sheet_changes.sql: the character's
    // player asks for a score or Max HP; one change waits per figure; the player takes it back; the GM answers, and an
    // approval writes the figure onto the character in the same request.
    // As 20261108210000_m5b_sheet_changes_guard.sql: only a score of the pack's (its field in use), Max HP or the level.
    request_sheet_change: ({ actor, field, label, to_value }, tag) => {
      const made = madeBy('sheet_changes', tag);
      if (made) return copy(tables.sheet_changes.find((r) => r.id === made.target_id));
      const who = tables.actors.find((a) => a.id === actor);
      if (!who || who.owner_type !== 'user' || who.owner_user_id !== me() || !isMemberOf(who.campaign_id)) return refused("You don't have permission to do that.");
      if (who.approval !== 'approved' || (who.status ?? 'active') !== 'active') return plain('Only a character in play asks the GM for a change.');
      const to = Number(to_value);
      if (!Number.isInteger(to) || to < 1 || to > 9999) return plain('Ask for a whole number from 1 to 9999.');
      const words = typeof label === 'string' ? label.trim() : '';
      if (!words || words.length > 80) return plain('Say what the change is to.');
      let before: number | null;
      // A null Max HP stays null, as in the database (from_value is then null).
      if (field === 'hpMax') before = typeof who.hp_max === 'number' ? who.hp_max : null;
      else if (field === 'level') before = typeof who.level === 'number' ? who.level : null;
      else if (
        typeof field === 'string' &&
        scoreKeysOf(who.campaign_id).includes(field) &&
        tables.field_definitions.some((f) => f.campaign_id === who.campaign_id && f.key === field && f.type === 'number' && !f.hidden)
      ) {
        const raw = ((who.fields ?? {}) as Row)[field];
        before = typeof raw === 'number' ? Math.trunc(raw) : null;
      } else return plain('That figure saves at once: only a score, Max HP or the level waits for the GM.');
      if (before === to) return plain("That's the figure already.");
      for (const old of tables.sheet_changes.filter((c) => c.actor_id === actor && c.field === field && c.status === 'waiting' && !c.undone)) changeRow('sheet_changes', old, { status: 'withdrawn' }, tag);
      const row: Row = {
        id: newId('sheet-change'), campaign_id: who.campaign_id, actor_id: actor, requester_id: who.owner_user_id, field, label: words,
        from_value: before, to_value: to, status: 'waiting', reason: '', answered_by: null, answered_at: null, undone: false, version: 1,
        created_by: me(), created_at: new Date(Date.now() + nextId).toISOString(),
      };
      tables.sheet_changes.push(row);
      log('sheet_changes', null, structuredClone(row), tag);
      return copy(row);
    },
    take_back_sheet_change: ({ change, seen_version }, tag) => {
      const row = tables.sheet_changes.find((r) => r.id === change);
      if (!row || row.requester_id !== me() || !isMemberOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.status === 'withdrawn') return copy(row);
      if (row.status !== 'waiting' || row.undone) return plain('Your GM has answered it already.');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('sheet_changes', row, { status: 'withdrawn' }, tag);
      return copy(row);
    },
    answer_sheet_change: ({ change, approve, reason, seen_version }, tag) => {
      const row = tables.sheet_changes.find((r) => r.id === change);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if ((row.status === 'approved' || row.status === 'refused') && repeated(tag, row.id)) return copy(row);
      if (row.status === 'withdrawn') return plain('Its player took it back.');
      if (row.status !== 'waiting' || row.undone) return plain(`That change was already ${String(row.status)}.`);
      if (isStale(row, seen_version)) return staleResult;
      const words = typeof reason === 'string' ? reason : '';
      if (words.length > 500) return plain('Keep the reason under 500 characters.');
      if (approve === true) {
        const character = tables.actors.find((a) => a.id === row.actor_id);
        if (character) {
          // The figure must still be the one asked from (20261108210000).
          const rawNow = row.field === 'hpMax' ? character.hp_max : row.field === 'level' ? character.level : ((character.fields ?? {}) as Row)[String(row.field)];
          const now = typeof rawNow === 'number' ? Math.trunc(rawNow) : null;
          if (now !== (row.from_value ?? null)) return { data: null, error: { message: `That's changed since: the sheet reads ${now ?? 'nothing'} now. Refuse it, or ask the player to send it again.`, code: 'GR409' } };
          const was = structuredClone(character);
          if (row.field === 'hpMax') character.hp_max = row.to_value;
          else if (row.field === 'level') character.level = row.to_value;
          else character.fields = { ...((character.fields ?? {}) as Row), [String(row.field)]: row.to_value };
          log('actors', was, structuredClone(character), tag);
        }
      }
      changeRow('sheet_changes', row, { status: approve === true ? 'approved' : 'refused', reason: approve === true ? '' : words.trim(), answered_by: me(), answered_at: new Date().toISOString() }, tag);
      return copy(row);
    },
    enter_request: ({ request, entry, seen_version }, tag) => {
      const row = tables.requests.find((r) => r.id === request && requestForMe(r));
      if (!row) return refused("You don't have permission to do that.");
      if (row.status !== 'waiting') return plain(`That request was already ${String(row.status)}.`);
      if (isStale(row, seen_version)) return staleResult;
      // C7 (20261101141000_m5b_g1_gm_enters_roll.sql): the GM enters only on what the GM asked.
      if (isGmOf(row.campaign_id) && row.direction !== 'gmAsks') return refused("You don't have permission to do that.");
      changeRow('requests', row, { entry: entry ?? null }, tag);
      return copy(row);
    },
    answer_request: ({ request, answer, cost_text, cost_seconds, seen_version }, tag) => {
      const row = tables.requests.find((r) => r.id === request);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.status === 'answered' && repeated(tag, row.id)) return copy(row);
      if (row.status !== 'waiting') return plain(`That request was already ${String(row.status)}.`);
      if (!answer) return plain('Give an answer.');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('requests', row, { status: 'answered', answer, cost_text: typeof cost_text === 'string' ? cost_text.trim() : row.cost_text, answered_by: me(), answered_at: new Date().toISOString() }, tag);
      const by = Number(cost_seconds);
      if (Number.isInteger(by) && by > 0) {
        const moved = moveClock(row.campaign_id, null, tag, (seconds) => seconds + by);
        if (moved.error) return moved;
      }
      return copy(row);
    },
    // The requester's reply to a priced answer (M5b step 6e): once, on an answered buy or sell with a price.
    reply_request: ({ request, accept, seen_version }, tag) => {
      const row = tables.requests.find((r) => r.id === request && requestForMe(r));
      if (!row) return refused("You don't have permission to do that.");
      if (row.reply && repeated(tag, row.id)) return copy(row);
      if (isStale(row, seen_version)) return staleResult;
      if (row.requester_id !== me()) return refused("You don't have permission to do that.");
      const answer = (row.answer ?? {}) as Record<string, unknown>;
      if (row.status !== 'answered' || !['hitMissChoice', 'offer'].includes(String(row.answer_kind)) || !String(answer.price ?? '').trim()) return plain("There's nothing to answer yet.");
      if (row.reply) return plain("You've answered it already.");
      changeRow('requests', row, { reply: accept ? 'accept' : 'decline', replied_at: new Date().toISOString() }, tag);
      return copy(row);
    },
    // request.undoBuy (W11b, bu-1/bu-2): the buyer's own Undo of their own purchase; the bought line comes out while its version is the one the purchase gave it.
    undo_buy: ({ request }, tag) => {
      const row = tables.requests.find((r) => r.id === request);
      if (!row || !isMemberOf(row.campaign_id) || row.requester_id !== me()) return forbidden();
      if (row.undone) return plain('That was already undone.');
      if (row.kind !== 'buy' || row.reply !== 'accept') return plain("There's no purchase to undo.");
      const replyEvent = tables.events
        .filter((e) => e.target_table === 'requests' && e.target_id === row.id && e.before && (e.after as Row).reply === 'accept' && (e.before as Row).reply == null)
        .sort((x, y) => Number(y.seq) - Number(x.seq))[0];
      const none = plain("There's no purchase to undo.");
      if (!tables.actors.some((a) => a.id === row.actor_id && a.owner_type === 'user' && a.owner_user_id === me() && a.status !== 'archived')) return none;
      if (!replyEvent || !replyEvent.request_id) return none;
      const madeEvent = tables.events
        .filter((e) => e.target_table === 'inventory_lines' && e.before === null && e.request_id === replyEvent.request_id && e.actor_user_id === row.requester_id && e.type === 'request.reply')
        .sort((x, y) => Number(x.seq) - Number(y.seq))[0];
      if (!madeEvent) return none;
      const line = tables.inventory_lines.find((l) => l.id === madeEvent.target_id);
      if (!line || line.actor_id !== row.actor_id || line.how_got !== 'bought') return none;
      if (
        Number(line.version) !== 1 ||
        tables.character_lights.some((c) => c.line_id === line.id) ||
        tables.inventory_lines.some((o) => o.container_line_id === line.id) ||
        // bu-2b: any logged change after the one that made it, to the line, its secrets, or a light that ever pointed at it.
        tables.events.some(
          (e) =>
            (['inventory_lines', 'inventory_line_secrets'].includes(String(e.target_table)) && e.target_id === line.id && Number(e.seq) > Number(madeEvent.seq)) ||
            (e.target_table === 'character_lights' && ((e.before as Row | null)?.line_id === line.id || (e.after as Row | null)?.line_id === line.id)),
        )
      ) {
        return plain(`That's changed since: the ${String(line.name)} was used or moved. Undo the later change first.`);
      }
      const gone = structuredClone(line);
      tables.inventory_lines = tables.inventory_lines.filter((l) => l.id !== line.id);
      log('inventory_lines', gone, null, tag, madeEvent);
      const was = structuredClone(row);
      Object.assign(row, { undone: true, version: Number(row.version) + 1 });
      log('requests', was, structuredClone(row), tag, replyEvent);
      return copy(row);
    },
    // Which groups share a place (M5 step 11). The stand-in keeps no places, so every group is in the same one.
    groups_meeting: (args) => {
      withGroupRows();
      if (!isMemberOf(args.campaign)) return refused("You don't have permission to do that.");
      const numbers = [...new Set(activeIn(args.campaign).map((a) => groupNumberOf(a.id)))].sort((a, b) => a - b);
      return { data: numbers.map((n) => ({ group_number: n, meets: numbers[0] })), error: null };
    },
  };
  // TC12's review fix (private.shop_offered_to): a shop offered where the asker's group is: its town's list has it
  // (`service:<id>`, or a pack shop's own `place:<entry id>` key) shown and open, and a pack shop's place is live, one
  // level under that town.
  function shopOfferedTo(campaign: unknown, actor: unknown, service: string): boolean {
    if (service.length < 1 || service.length > 200) return false;
    const town = townPlaceOf(campaign, groupNumberOf(actor));
    if (!town) return false;
    const packShop = service.startsWith('place:');
    const entry = ((town.town ?? {}) as Record<string, { shown?: unknown; open?: unknown } | undefined>)[packShop ? service : `service:${service}`];
    if (!entry || entry.shown !== true || entry.open !== true) return false;
    return (
      !packShop ||
      tables.places.some((p) => p.campaign_id === campaign && !p.undone && p.pack_id === town.pack_id && p.pack_parent_id === town.pack_entry_id && p.pack_entry_id === service.slice(6))
    );
  }
  // The item's winning version in the campaign (as private.items_open_in orders them), its whole entry (the GM-only
  // part merged over the readable part), whether a shop sells it (private.for_sale), its readable part
  // (private.visible_part) and a value's words (private.price_words, the device's priceText).
  function winningItem(campaign: unknown, item: string): Row | undefined {
    const attached = tables.campaign_packs.filter((cp) => cp.campaign_id === campaign);
    const rank = (e: Row): [number, number, number, string] => {
      const cp = attached.find((c) => c.pack_id === e.pack_id)!;
      const overrides = (tables.campaign_pack_secrets.find((x) => x.id === cp.id)?.overrides ?? {}) as Row;
      const homebrew = tables.packs.find((p) => p.id === e.pack_id)?.kind === 'homebrew';
      return [Object.hasOwn(overrides, `item:${String(e.pack_entry_id)}`) ? 1 : 0, homebrew ? 1 : 0, Number(cp.priority ?? 0), String(e.pack_id)];
    };
    let best: Row | undefined;
    for (const e of tables.library_entries.filter((x) => x.kind === 'item' && x.pack_entry_id === item && attached.some((cp) => cp.pack_id === x.pack_id))) {
      if (!best) {
        best = e;
        continue;
      }
      const [a, b] = [rank(e), rank(best)];
      const better = a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] < b[3] ? 1 : a[3] > b[3] ? -1 : 0);
      if (better > 0) best = e;
    }
    return best;
  }
  const wholeEntry = (e: Row): Row => ({ ...((e.data ?? {}) as Row), ...((tables.library_entry_secrets.find((x) => x.id === e.id)?.data ?? {}) as Row) });
  const entryForSale = (whole: Row): boolean => (typeof whole.forSale === 'boolean' ? whole.forSale : !/(^|-)magic(-|$)/.test(typeof whole.category === 'string' ? whole.category : ''));
  const visiblePart = (whole: Row): Row => {
    if (!Array.isArray(whole.gmOnly)) return whole;
    const out: Row = { ...whole };
    for (const key of [...whole.gmOnly, 'gmOnly']) if (typeof key === 'string') delete out[key];
    return out;
  };
  const priceWords = (value: unknown): string =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value as Row)
          .filter(([, amount]) => typeof amount === 'number')
          .map(([coin, amount]) => `${String(amount)} ${coin}`)
          .join(' ')
      : '';
  // A group's town (M5b step 6e): its current visit's place in the newest expedition, when marked Safe or Hostile.
  function townPlaceOf(campaign: unknown, group: number): Row | undefined {
    const newest = tables.expeditions
      .filter((x) => x.campaign_id === campaign && !x.undone)
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0];
    if (!newest) return undefined;
    const visit = tables.group_places
      .filter((g) => g.campaign_id === campaign && g.expedition_id === newest.id && Number(g.group_number) === group && !g.undone && !g.moved_on)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    return visit && tables.places.find((p) => p.id === visit.place_id && !p.undone && isSettlementRow(p));
  }
  // Rows of 1–3 of the campaign's own characters and hirelings, each once.
  const marchingRowsOk = (campaign: unknown, rows: unknown) => {
    if (!Array.isArray(rows)) return false;
    const ids = rows.flatMap((row) => (Array.isArray(row) ? row : [null]));
    return (
      rows.every((row) => Array.isArray(row) && row.length >= 1 && row.length <= 3) &&
      ids.every((id) => typeof id === 'string') &&
      new Set(ids).size === ids.length &&
      ids.every((id) => tables.actors.some((a) => a.id === id && a.campaign_id === campaign && ['pc', 'hireling'].includes(String(a.kind ?? 'pc'))))
    );
  };
  // The rules the database applies to any change: the GM always; players wherever the setting is on. A stored lock
  // stops nobody (B11; …_p2p_b11_marching_no_lock.sql).
  const marchingChange = (campaign: unknown, seen: unknown, tag: Tag, patch: (order: Row) => Row | Result, group: unknown = 1): Result => {
    withMarchingRows();
    const number = group === null || group === undefined ? 1 : Number(group);
    const order = tables.marching_orders.find((m) => m.campaign_id === campaign && (m.group_number ?? 1) === number);
    if (!isMemberOf(campaign)) return refused("You don't have permission to do that.");
    if (!order) return plain("That group isn't there any more.");
    if (repeated(tag, order.id)) return copy(order);
    if (isStale(order, seen)) return staleResult;
    const next = patch(order);
    if ('error' in next) return next as Result;
    if (!isGmOf(campaign)) {
      const settings = tables.campaigns.find((c) => c.id === campaign)?.settings as Row | undefined;
      if ('locked' in next && next.locked !== order.locked) return refused('Only the GM locks the marching order.');
      if (settings?.playersReorderMarching === false) return refused('Only the GM sets the marching order in this campaign.');
    }
    if ('rows' in next && JSON.stringify(next.rows) !== JSON.stringify(order.rows)) {
      if (!marchingRowsOk(campaign, next.rows)) return plain('Each row holds 1 to 3 of the party, each once.');
      if ((next.rows as unknown[][]).flat().some((id) => groupNumberOf(id) !== number)) return staleResult;
    }
    if (Object.keys(next).some((key) => JSON.stringify(next[key]) !== JSON.stringify(order[key]))) changeRow('marching_orders', order, next, tag);
    return copy(order);
  };
  const marchingRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    set_marching_order: (args, tag) => marchingChange(args.campaign, args.seen_version, tag, () => ({ rows: args.new_rows ?? [], last_preset: null }), args.party_group),
    use_marching_preset: (args, tag) =>
      marchingChange(
        args.campaign,
        args.seen_version,
        tag,
        (order) => {
          const party = tables.marching_orders.find((m) => m.campaign_id === args.campaign && (m.group_number ?? 1) === 1)!;
          const named = String(args.preset_name ?? '').trim().toLowerCase();
          const preset = (party.presets as Row[]).find((p) => String(p.name).trim().toLowerCase() === named);
          if (!preset) return plain("That saved order isn't there any more.");
          const here = (id: unknown) =>
            tables.actors.some((a) => a.id === id && a.campaign_id === args.campaign && ['pc', 'hireling'].includes(String(a.kind ?? 'pc'))) && groupNumberOf(id) === (order.group_number ?? 1);
          const rows = (preset.rows as unknown[][]).map((row) => row.filter(here)).filter((row) => row.length > 0);
          return { rows, last_preset: String(preset.name).trim() };
        },
        args.party_group,
      ),
    save_marching_preset: (args, tag) => {
      withMarchingRows();
      const source = tables.marching_orders.find((m) => m.campaign_id === args.campaign && (m.group_number ?? 1) === Number(args.party_group ?? 1));
      return marchingChange(args.campaign, args.seen_version, tag, (order) => {
        const named = String(args.preset_name ?? '').trim();
        if (named.length < 1 || named.length > 60) return plain('Give the saved order a name (up to 60 characters).');
        if (((source?.rows as unknown[]) ?? []).length === 0) return plain("There's no order to save yet.");
        const others = (order.presets as Row[]).filter((p) => String(p.name).trim().toLowerCase() !== named.toLowerCase());
        if (others.length >= 12) return plain('There are 12 saved orders already. Delete one, or replace one by saving under its name.');
        return { presets: [...others, { name: named, rows: source!.rows }] };
      });
    },
    delete_marching_preset: (args, tag) =>
      marchingChange(args.campaign, args.seen_version, tag, (order) => {
        const named = String(args.preset_name ?? '').trim().toLowerCase();
        const others = (order.presets as Row[]).filter((p) => String(p.name).trim().toLowerCase() !== named);
        if (others.length === (order.presets as Row[]).length) return plain("That saved order isn't there any more.");
        return { presets: others };
      }),
    lock_marching_order: (args, tag) => {
      if (!isGmOf(args.campaign)) return refused('Only the GM locks the marching order.');
      return marchingChange(args.campaign, args.seen_version, tag, () => ({ locked: args.lock_it === true }));
    },
  };
  // The holder a light replaces keeps the fuel left in it, on its line (a torch's leftover time is dropped).
  const keepHolderFuel = (row: Row, line: unknown, tag: Tag) => {
    if (!row.line_id || row.line_id === line || !row.fuel_item || row.consumed) return;
    const left = row.lit_at !== null && row.burn_seconds !== null ? Math.max(1, Number(row.lit_at) + Number(row.burn_seconds) - clockNow(row.campaign_id)) : row.left_seconds;
    const holder = tables.inventory_lines.find((l) => l.id === row.line_id);
    if (holder && typeof left === 'number' && holder.fuel_left_seconds !== left) changeRow('inventory_lines', holder, { fuel_left_seconds: left }, tag);
  };
  // Like the database (supabase/migrations/…_m5_statuses.sql): a rest row per character and hireling, made with it.
  const withRestRows = () => {
    for (const a of tables.actors) {
      if ((a.kind ?? 'pc') !== 'pc' && a.kind !== 'hireling') continue;
      if (tables.character_rests.some((r) => r.actor_id === a.id)) continue;
      tables.character_rests.push({ id: newId('rest'), actor_id: a.id, campaign_id: a.campaign_id, chosen_at: null, rested_at: null, pushing_at: null, pushed_on_at: null, period_from: null, called_at: null, called_by: null, version: 1 });
    }
  };
  // The GM, or the owner of an approved character in the campaign (private.may_play).
  const mayPlayActor = (campaign: unknown, actor: unknown) => {
    const who = tables.actors.find((a) => a.id === actor && a.campaign_id === campaign);
    return !!who && (who.approval ?? 'approved') === 'approved' && (isGmOf(campaign) || (who.owner_user_id === me() && isMemberOf(campaign)));
  };
  const requestTargets = (table: string, tag: Tag) => (tag?.requestId ? tables.events.filter((e) => e.request_id === tag.requestId && e.target_table === table).map((e) => e.target_id) : []);
  // Like the database (20261102330000_m5b_g6_rest_flow.sql): Next turn applies the open flows' answers. Resting
  // counts as rest (the rest condition ends); Push on and unanswered get the condition, stacked, and owe a rest; the
  // countdown restarts for everyone in the flow. Logged rest.applied (Simple) in the move's request.
  const applyRests = (campaign: unknown, from: number, rest: unknown, tag: Tag) => {
    withRestRows();
    if (!rest || typeof rest !== 'object' || !Array.isArray((rest as Row).actors)) return;
    const wanted = ((rest as Row).actors as unknown[]).map(String);
    const cond = (rest as Row).condition as Row | null | undefined;
    // 20261103120000_m5b_g6c_next_rest_due.sql: a well-formed nextDue is kept on every row in the flow.
    const due = (rest as Row).nextDue as Row | null | undefined;
    const nextDue =
      due && typeof due === 'object' && Number.isInteger(due.at) && Number.isInteger(due.number) && typeof due.unit === 'string' && due.unit.trim()
        ? { at: due.at, unit: due.unit.trim(), number: due.number }
        : null;
    const restTag = tag ? { ...tag, type: 'rest.applied', level: 'simple' } : tag;
    const rows = tables.character_rests.filter((r) => r.campaign_id === campaign && wanted.includes(String(r.actor_id)));
    const pushers = rows.filter((r) => r.chosen_at === null);
    // The condition first (the fake has no transactions: add_status would otherwise see this request's other rows).
    if (pushers.length > 0 && cond && typeof cond.name === 'string' && cond.name.trim()) {
      statusRpcs.add_status!(
        { campaign, actors: pushers.map((r) => r.actor_id), status_name: cond.name, condition_id: cond.conditionId ?? null, icon: cond.icon ?? null, stacking: cond.stacks === true, levels: cond.levels ?? null, note: cond.note ?? null, source: 'rest' },
        restTag,
      );
    }
    for (const r of rows) {
      if (r.chosen_at !== null) {
        changeRow('character_rests', r, { rested_at: from, chosen_at: null, pushing_at: null, pushed_on_at: null, period_from: from, called_at: null, called_by: null, next_due: nextDue }, restTag);
        for (const st of tables.character_statuses) {
          if (st.actor_id === r.actor_id && (st.source === 'rest' || st.until_rest === true) && st.ended_at === null && !st.undone) changeRow('character_statuses', st, { ended_at: from, end_reason: 'rested' }, restTag);
        }
      } else {
        changeRow('character_rests', r, { pushed_on_at: r.pushed_on_at ?? from, pushing_at: null, period_from: from, called_at: null, called_by: null, next_due: nextDue }, restTag);
      }
    }
  };
  // Like the database: every status whose timer ran out ends with the clock's move (logged as status.timerEnd).
  const endStatuses = (campaign: unknown, to: number, tag: Tag) => {
    const endTag = tag ? { ...tag, type: 'status.timerEnd', level: 'simple' } : tag;
    for (const st of tables.character_statuses) {
      if (st.campaign_id !== campaign || st.ended_at !== null || st.undone) continue;
      const ends = st.secret ? tables.status_secrets.find((x) => x.id === st.id)?.ends_at : st.ends_at;
      if (ends !== null && ends !== undefined && Number(ends) <= to) changeRow('character_statuses', st, { ended_at: Number(ends), end_reason: 'timer' }, endTag);
    }
  };
  const statusRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    add_status: (args, tag) => {
      const done = requestTargets('character_statuses', tag);
      if (done.length > 0) return { data: tables.character_statuses.filter((st) => done.includes(st.id)).map((st) => ({ ...st })), error: null };
      const actors = Array.isArray(args.actors) ? args.actors : [];
      const name = String(args.status_name ?? '').trim();
      if (actors.length === 0) return plain('Who has it?');
      if (name.length < 1 || name.length > 80) return plain('Give the status a name of up to 80 characters.');
      const timer = args.timer_seconds === null || args.timer_seconds === undefined ? null : Number(args.timer_seconds);
      const hidden = args.secret === true && timer !== null;
      const source = String(args.source ?? 'typed');
      // C1 (20261101140000_m5b_g1_status_gm_only.sql): only the GM gives a status.
      if (!isGmOf(args.campaign)) return refused('Only the GM gives a status.');
      const condition = typeof args.condition_id === 'string' && args.condition_id.trim() ? args.condition_id.trim() : null;
      const levels = Array.isArray(args.levels) ? (args.levels as Row[]).map((l) => ({ id: String(l.id ?? l.name), name: String(l.name ?? '').trim() })) : null;
      const now = clockNow(args.campaign);
      const touched: Row[] = [];
      for (const who of actors) {
        if (!mayPlayActor(args.campaign, who)) return refused("You don't have permission to do that.");
        const found = tables.character_statuses.find(
          (st) => st.actor_id === who && st.ended_at === null && !st.undone && (condition ? st.condition_id === condition : st.condition_id === null && String(st.name).toLowerCase() === name.toLowerCase()),
        );
        if (found) {
          if (found.stacking && Number(found.stacks) < 99) changeRow('character_statuses', found, { stacks: Number(found.stacks) + 1 }, tag);
          else if (Array.isArray(found.levels) && Number(found.level ?? 0) < found.levels.length - 1) changeRow('character_statuses', found, { level: Number(found.level ?? 0) + 1 }, tag);
          touched.push(found);
          continue;
        }
        const row: Row = {
          id: newId('status'), campaign_id: args.campaign, actor_id: who, name, condition_id: condition, icon: args.icon ?? null, stacks: 1, stacking: args.stacking === true,
          levels, level: levels ? 0 : null, source, note: args.note ?? null, started_at: now, ends_at: timer !== null && !hidden ? now + timer : null,
          total_seconds: hidden ? null : timer, unit: timer !== null && !hidden ? (args.timer_unit ?? null) : null, secret: hidden, until_rest: args.until_rest === true, ended_at: null, end_reason: null,
          undone: false, version: 1, created_at: new Date().toISOString(),
        };
        tables.character_statuses.push(row);
        log('character_statuses', null, structuredClone(row), tag);
        if (hidden) tables.status_secrets.push({ id: row.id, campaign_id: args.campaign, ends_at: now + timer!, total_seconds: timer, unit: args.timer_unit ?? null, version: 1 });
        touched.push(row);
      }
      return { data: touched.map((st) => ({ ...st })), error: null };
    },
    remove_status: (args, tag) => {
      const row = tables.character_statuses.find((st) => st.id === args.status);
      if (!row || !mayPlayActor(row.campaign_id, row.actor_id)) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      if (row.undone || row.ended_at !== null) return plain('That status has already ended.');
      if (isStale(row, args.seen_version)) return staleResult;
      changeRow('character_statuses', row, { ended_at: clockNow(row.campaign_id), end_reason: 'removed' }, tag);
      return copy(row);
    },
    step_status: (args, tag) => {
      const row = tables.character_statuses.find((st) => st.id === args.status);
      if (!row || !mayPlayActor(row.campaign_id, row.actor_id)) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      if (row.undone || row.ended_at !== null) return plain('That status has already ended.');
      if (!Array.isArray(row.levels)) return plain('That status has no levels.');
      if (isStale(row, args.seen_version)) return staleResult;
      const levels = row.levels as Row[];
      const at = Number(row.level ?? 0);
      if (args.step === 1 && at >= levels.length - 1) return plain(`It's at its last level already: ${String(levels[levels.length - 1]!.name)}.`);
      if (args.step === -1 && at <= 0) changeRow('character_statuses', row, { ended_at: clockNow(row.campaign_id), end_reason: 'stepped' }, tag);
      else changeRow('character_statuses', row, { level: at + Number(args.step) }, tag);
      return copy(row);
    },
    // As supabase/migrations/20261108120000_m5b_status_time.sql: the GM's only; a secret timer is set in status_secrets.
    set_status_time: (args, tag) => {
      const row = tables.character_statuses.find((st) => st.id === args.status);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      if (row.undone || row.ended_at !== null) return plain('That status has already ended.');
      const left = Number(args.seconds_left);
      if (!Number.isInteger(left) || left < 1) return plain('It needs some time left. To end it, use End it now.');
      if (isStale(row, args.seen_version)) return staleResult;
      const now = clockNow(row.campaign_id);
      const secret = row.secret ? tables.status_secrets.find((x) => x.id === row.id) : undefined;
      const timed = secret ?? (row.ends_at !== null ? row : undefined);
      if (!timed) return plain('That status has no timer.');
      changeRow(secret ? 'status_secrets' : 'character_statuses', timed, { ends_at: now + left, total_seconds: Math.max(Number(timed.total_seconds ?? left), left) }, tag);
      return copy(row);
    },
    choose_rest: (args, tag) => {
      withRestRows();
      const done = requestTargets('character_rests', tag);
      if (done.length > 0) return { data: tables.character_rests.filter((r) => done.includes(r.id)).map((r) => ({ ...r })), error: null };
      const actors = Array.isArray(args.actors) ? args.actors : [];
      const campaign = tables.actors.find((a) => a.id === actors[0])?.campaign_id;
      if (!campaign) return refused("You don't have permission to do that.");
      if (!tables.expeditions.some((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone)) return plain('Resting counts during an expedition. Start one first.');
      const touched: Row[] = [];
      for (const who of actors) {
        if (!mayPlayActor(campaign, who)) return refused("You don't have permission to do that.");
        const row = tables.character_rests.find((r) => r.actor_id === who)!;
        if ((row.chosen_at !== null) !== (args.resting === true)) changeRow('character_rests', row, { chosen_at: args.resting === true ? clockNow(campaign) : null }, tag);
        touched.push(row);
      }
      return { data: touched.map((r) => ({ ...r })), error: null };
    },
    answer_rest: (args, tag) => {
      withRestRows();
      const done = requestTargets('character_rests', tag);
      if (done.length > 0) return { data: tables.character_rests.filter((r) => done.includes(r.id)).map((r) => ({ ...r })), error: null };
      const actors = Array.isArray(args.actors) ? args.actors : [];
      const answer = String(args.answer ?? '');
      if (actors.length === 0 || !['rest', 'push', 'wait'].includes(answer)) return plain('Who rests?');
      const campaign = tables.actors.find((a) => a.id === actors[0])?.campaign_id;
      if (!campaign) return refused("You don't have permission to do that.");
      if (!tables.expeditions.some((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone)) return plain('Resting counts during an expedition. Start one first.');
      const now = clockNow(campaign);
      const touched: Row[] = [];
      for (const who of actors) {
        if (!mayPlayActor(campaign, who)) return refused("You don't have permission to do that.");
        const row = tables.character_rests.find((r) => r.actor_id === who)!;
        const change = (answer === 'rest' && row.chosen_at === null) || (answer === 'push' && row.pushing_at === null) || (answer === 'wait' && (row.chosen_at !== null || row.pushing_at !== null));
        if (change) changeRow('character_rests', row, { chosen_at: answer === 'rest' ? now : null, pushing_at: answer === 'push' ? now : null }, tag);
        touched.push(row);
      }
      return { data: touched.map((r) => ({ ...r })), error: null };
    },
    call_rest: (args, tag) => {
      withRestRows();
      const done = requestTargets('character_rests', tag);
      if (done.length > 0) return { data: tables.character_rests.filter((r) => done.includes(r.id)).map((r) => ({ ...r })), error: null };
      const caller = tables.actors.find((a) => a.id === args.actor && ((a.kind ?? 'pc') === 'pc' || a.kind === 'hireling'));
      if (!caller || !mayPlayActor(caller.campaign_id, caller.id)) return refused("You don't have permission to do that.");
      const campaign = caller.campaign_id;
      if (!tables.expeditions.some((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone)) return plain('Resting counts during an expedition. Start one first.');
      const now = clockNow(campaign);
      const groupOf = (id: unknown) => Number(tables.party_group_members.find((m) => m.actor_id === id)?.group_number ?? 1);
      const mates = tables.actors.filter(
        (a) => a.campaign_id === campaign && ((a.kind ?? 'pc') === 'pc' || a.kind === 'hireling') && (a.approval ?? 'approved') === 'approved' && (a.status ?? 'active') === 'active' && groupOf(a.id) === groupOf(caller.id),
      );
      const touched: Row[] = [];
      for (const mate of mates) {
        const row = tables.character_rests.find((r) => r.actor_id === mate.id);
        if (!row) continue;
        const mine = mate.id === caller.id;
        changeRow('character_rests', row, { called_at: now, called_by: caller.id, ...(mine ? { chosen_at: now, pushing_at: null } : {}) }, tag);
        touched.push(row);
      }
      return { data: touched.map((r) => ({ ...r })), error: null };
    },
  };
  const lightRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    light_light: (args, tag) => {
      const row = lightOf(args.actor);
      if (!row) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      const line = tables.inventory_lines.find((l) => l.id === args.line);
      if (!line || line.actor_id !== args.actor || (line.approval ?? 'approved') !== 'approved' || Number(line.qty) < 1) return plain("That light isn't in their pack any more.");
      if (row.lit_at !== null && row.line_id === args.line) return plain('That light is already lit.');
      if (line.needs_fuel === true || (row.lit_at === null && row.out_at !== null && row.line_id === args.line && row.fuel_item)) return plain('It burnt out. Refill it first.');
      if (isStale(row, args.seen_version)) return staleResult;
      const type = String(args.light_type).trim();
      // Like the database (…_m5_party_groups.sql): a holder burns on from the fuel kept on its line; the holder it
      // replaces keeps the fuel left in it.
      const kept = typeof line.fuel_left_seconds === 'number' && trimmed(args.fuel_item) ? line.fuel_left_seconds : null;
      const burn = row.line_id === args.line && row.type_id === type && row.left_seconds !== null ? row.left_seconds : (kept ?? args.burn_seconds ?? null);
      keepHolderFuel(row, args.line, tag);
      if (typeof line.fuel_left_seconds === 'number') changeRow('inventory_lines', line, { fuel_left_seconds: null }, tag);
      changeRow('character_lights', row, {
        line_id: args.line, type_id: type, name: String(args.light_name).trim(), lit_at: clockNow(row.campaign_id), burn_seconds: burn,
        full_seconds: args.burn_seconds ?? null, warn_seconds: args.warn_seconds ?? null, left_seconds: null, consumed: args.consumed === true,
        fuel_item: trimmed(args.fuel_item), out_at: null, keep_lit: row.type_id === type ? row.keep_lit : false,
      }, tag);
      return copy(row);
    },
    douse_light: (args, tag) => {
      const row = lightOf(args.actor);
      if (!row) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      if (row.lit_at === null) return plain("That light isn't lit.");
      if (isStale(row, args.seen_version)) return staleResult;
      const left = row.burn_seconds === null ? null : Math.max(1, Number(row.lit_at) + Number(row.burn_seconds) - clockNow(row.campaign_id));
      changeRow('character_lights', row, { lit_at: null, left_seconds: left }, tag);
      return copy(row);
    },
    keep_light_lit: (args, tag) => {
      const row = lightOf(args.actor);
      if (!row) return refused("You don't have permission to do that.");
      if (isStale(row, args.seen_version)) return staleResult;
      if (row.keep_lit !== (args.keep === true)) changeRow('character_lights', row, { keep_lit: args.keep === true }, tag);
      return copy(row);
    },
    refill_light: (args, tag) => {
      const row = lightOf(args.actor);
      if (!row) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      if (!row.fuel_item || !row.line_id || row.full_seconds === null) return plain("That light doesn't take fuel.");
      if (!tables.inventory_lines.some((l) => l.id === row.line_id && l.actor_id === args.actor)) return plain("That light isn't in their pack any more.");
      const fuel = fuelLine(args.actor, row.fuel_item);
      if (!fuel) return plain("There's no fuel left in their pack.");
      if (isStale(row, args.seen_version)) return staleResult;
      spendOne(fuel, tag);
      const holder = tables.inventory_lines.find((l) => l.id === row.line_id);
      if (holder && (holder.needs_fuel === true || typeof holder.fuel_left_seconds === 'number')) changeRow('inventory_lines', holder, { needs_fuel: false, fuel_left_seconds: null }, tag);
      changeRow('character_lights', row, { lit_at: clockNow(row.campaign_id), burn_seconds: row.full_seconds, left_seconds: null, out_at: null }, tag);
      return copy(row);
    },
    refill_and_light: (args, tag) => {
      const row = lightOf(args.actor);
      if (!row) return refused("You don't have permission to do that.");
      if (repeated(tag, row.id)) return copy(row);
      if (!trimmed(args.fuel_item) || !(Number(args.burn_seconds) >= 1)) return plain("That light doesn't take fuel.");
      const line = tables.inventory_lines.find((l) => l.id === args.line);
      if (!line || line.actor_id !== args.actor || (line.approval ?? 'approved') !== 'approved' || Number(line.qty) < 1) return plain("That light isn't in their pack any more.");
      if (row.lit_at !== null && row.line_id === args.line) return plain('That light is already lit.');
      const fuel = fuelLine(args.actor, trimmed(args.fuel_item));
      if (!fuel) return plain("There's no fuel left in their pack.");
      if (isStale(row, args.seen_version)) return staleResult;
      spendOne(fuel, tag);
      keepHolderFuel(row, args.line, tag);
      if (line.needs_fuel === true || typeof line.fuel_left_seconds === 'number') changeRow('inventory_lines', line, { needs_fuel: false, fuel_left_seconds: null }, tag);
      const type = String(args.light_type).trim();
      changeRow('character_lights', row, {
        line_id: args.line, type_id: type, name: String(args.light_name).trim(), lit_at: clockNow(row.campaign_id), burn_seconds: args.burn_seconds,
        full_seconds: args.burn_seconds, warn_seconds: args.warn_seconds ?? null, left_seconds: null, consumed: false,
        fuel_item: trimmed(args.fuel_item), out_at: null, keep_lit: row.type_id === type ? row.keep_lit : false,
      }, tag);
      return copy(row);
    },
  };
  // Like the database (…_k22_tell.sql; K2 brings it, as the stub here promised): the GM's tell and his edit of what
  // players see. The fact list is the app's own (hiddenFacts, the database's twin); the told facts come from the entry.
  const entryOfLine = (l: Row): Row | undefined =>
    tables.library_entries.find((e) => e.kind === 'item' && e.pack_id === l.source_pack_id && e.pack_entry_id === l.source_entry_id);
  const singularOf = (campaign: unknown, category: string): string => {
    const packs = tables.campaign_packs.filter((cp) => cp.campaign_id === campaign).sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
    for (const cp of packs) {
      for (const r of tables.library_entries.filter((e) => e.kind === 'rulesSet' && e.pack_id === cp.pack_id)) {
        const cats = (r.data as Row).itemCategories;
        const c = Array.isArray(cats) ? (cats as Row[]).find((x) => x?.id === category) : undefined;
        const said = String(c?.singular ?? '').trim() || String(c?.name ?? '').trim();
        if (said) return said;
      }
    }
    const tidy = category.replace(/[-_]+/g, ' ').trim();
    return tidy ? `${tidy.charAt(0).toUpperCase()}${tidy.slice(1)}` : 'Item';
  };
  const k22Rpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    tell_item: (args, tag) => {
      const l = tables.inventory_lines.find((x) => x.id === args.line);
      if (!l || !isGmOf(l.campaign_id)) return refused("You don't have permission to do that.");
      if (isStale(l, args.seen_version)) return staleResult;
      const entry = entryOfLine(l);
      const whole = entry ? { ...(entry.data as Row), ...((tables.library_entry_secrets.find((s) => s.id === entry.id)?.data as Row | undefined) ?? {}) } : null;
      const facts = (line: Row) =>
        hiddenFacts(
          { identified: line.identified !== false, revealedFields: (line.revealed_fields as string[] | undefined) ?? [], details: (line.item_data as Row) ?? {}, chargesHidden: line.charges_hidden === true, category: String(line.category) },
          whole,
        ).map((f) => f.id as string);
      const hidden = facts(l);
      const asked = Array.isArray(args.facts) ? (args.facts as string[]) : [];
      let told = asked.includes('everything') ? hidden : hidden.filter((h) => asked.includes(h));
      if (told.length === 0) return { data: 0, error: null };
      if (hidden.includes('magic') && !told.includes('magic')) told = ['magic', ...told];
      const data: Row = { ...((l.item_data as Row) ?? {}) };
      const patch: Row = {};
      if (told.includes('name')) {
        if (!entry) return raised("Its setting rules are gone, so its name can't be told.");
        Object.assign(patch, { name: entry.name, identified: true });
      }
      if (told.includes('bonus') && whole) {
        if ('bonus' in whole) data.bonus = whole.bonus;
        for (const block of ['weapon', 'armour']) {
          const part = whole[block] as Row | undefined;
          const picked = part ? Object.fromEntries(['magicBonus', 'bonusVs'].filter((k) => k in part).map((k) => [k, part[k]])) : {};
          if (Object.keys(picked).length > 0) data[block] = { ...((data[block] as Row) ?? {}), ...picked };
        }
      }
      if (told.includes('cursed') && whole && 'cursed' in whole) data.cursed = whole.cursed;
      if (told.some((t) => t.startsWith('power:')) && whole && Array.isArray(whole.properties)) {
        const own = Array.isArray(data.properties) ? (data.properties as unknown[]).map((p) => JSON.stringify(p)) : [];
        data.properties = (whole.properties as unknown[]).filter((p, i) => told.includes(`power:${i}`) || own.includes(JSON.stringify(p)));
      }
      for (const t of told.filter((x) => x.startsWith('fields.'))) data.fields = { ...((data.fields as Row) ?? {}), [t.slice(7)]: (whole?.fields as Row)[t.slice(7)] };
      if (told.includes('charges')) {
        const total = tables.inventory_line_secrets.find((s) => s.id === l.id)?.charges_total;
        if (total === null || total === undefined) return raised('Set its charges first, then tell them.');
        Object.assign(patch, { charges_hidden: false, charges_left: Math.max(0, Number(total) - Number(l.charges_used ?? 0)), spent_shown: false });
      }
      const revealed = [...((l.revealed_fields as string[] | undefined) ?? []), ...told.filter((t) => !((l.revealed_fields as string[] | undefined) ?? []).includes(t))];
      const after = { ...l, ...patch, item_data: data, revealed_fields: revealed };
      if (facts(after).length === 0 && whole) for (const key of ['description', 'source']) if (key in whole) data[key] = whole[key];
      changeRow('inventory_lines', l, { ...patch, item_data: data, revealed_fields: revealed }, tag);
      return { data: told.length, error: null };
    },
    edit_item_look: (args, tag) => {
      const l = tables.inventory_lines.find((x) => x.id === args.line);
      if (!l || !isGmOf(l.campaign_id)) return refused("You don't have permission to do that.");
      if (isStale(l, args.seen_version)) return staleResult;
      const appears = String(args.appears_as ?? '').trim().slice(0, 200);
      const noticed = String(args.noticed ?? '').trim().slice(0, 2000);
      changeRow('inventory_lines', l, { appears_as: appears, noticed, ...(l.identified === false ? { name: appears || singularOf(l.campaign_id, String(l.category)) } : {}) }, tag);
      return { data: null, error: null };
    },
  };
  // Like the database (supabase/migrations/…_m5b_weather_roll.sql): today's weather. The weather tables the campaign's
  // rules sets name; the row a typed roll lands on (its result and tags); who may enter it; the first entry counts.
  const weatherTables = (campaign: unknown): string[] => {
    const ids = new Set<string>();
    const tablesIn = (value: unknown) => {
      if (value && typeof value === 'object') for (const id of Object.values(value as Row)) if (typeof id === 'string') ids.add(id);
    };
    const scan = (rules: Row) => {
      tablesIn((rules.weather as Row | undefined)?.tables);
      const modes = (rules.exploration as Row | undefined)?.modes;
      for (const m of Array.isArray(modes) ? (modes as Row[]) : []) {
        tablesIn((m.weather as Row | undefined)?.tables);
        for (const s of Array.isArray(m.procedure) ? (m.procedure as Row[]) : []) {
          if (s.icon !== 'weather') continue;
          if (typeof s.tableId === 'string') ids.add(s.tableId);
          tablesIn(s.tableBySeason);
        }
      }
      for (const s of Array.isArray(rules.specialSeasons) ? (rules.specialSeasons as Row[]) : []) if (typeof s.weatherTableId === 'string') ids.add(s.weatherTableId);
    };
    for (const cp of tables.campaign_packs.filter((link) => link.campaign_id === campaign)) {
      for (const e of tables.library_entries.filter((x) => x.pack_id === cp.pack_id && x.kind === 'rulesSet')) {
        const data = { ...((e.data ?? {}) as Row), ...((tables.library_entry_secrets.find((s) => s.id === e.id)?.data ?? {}) as Row) };
        scan(data);
        if (data.byOption && typeof data.byOption === 'object') for (const o of Object.values(data.byOption as Row)) if (o && typeof o === 'object') scan(o as Row);
      }
    }
    return [...ids];
  };
  // Like private.settle_encounter (M5b step 2): a waiting card started or dismissed, once; refused from an old copy.
  const settleEncounter = (encounter: unknown, to: 'started' | 'dismissed', seen: unknown, tag: Tag): Result => {
    const row = tables.waiting_encounters.find((w) => w.id === encounter);
    if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
    if (row.undone) return plain('That encounter was undone.');
    if (row.state === to) return copy(row);
    if (row.state !== 'waiting') return plain(`That encounter was already ${String(row.state)}.`);
    if (isStale(row, seen)) return staleResult;
    changeRow('waiting_encounters', row, to === 'started' ? { state: to, started_at: new Date().toISOString() } : { state: to, dismissed_at: new Date().toISOString() }, tag);
    return copy(row);
  };
  // Like public.table_pins_now (M5b step g3): live pins made after the last session that ended (not undone).
  const pinsNow = (campaign: unknown): Row[] => {
    const ends = tables.sessions.filter((x) => x.campaign_id === campaign && !x.undone && x.ended_at).map((x) => Date.parse(String(x.ended_at)));
    const last = ends.length ? Math.max(...ends) : -Infinity;
    return tables.table_pins
      .filter((p) => p.campaign_id === campaign && !p.undone && p.unpinned_at === null && Date.parse(String(p.pinned_at)) > last)
      .sort((a, b) => String(a.pinned_at).localeCompare(String(b.pinned_at)));
  };
  const campaignTable = (campaign: unknown, tableId: unknown): Row | null => {
    const links = tables.campaign_packs
      .filter((cp) => cp.campaign_id === campaign)
      .sort((a, b) => Number(tables.packs.find((p) => p.id === b.pack_id)?.kind === 'homebrew') - Number(tables.packs.find((p) => p.id === a.pack_id)?.kind === 'homebrew') || Number(b.priority ?? 0) - Number(a.priority ?? 0));
    for (const cp of links) {
      const e = tables.library_entries.find((x) => x.pack_id === cp.pack_id && x.kind === 'table' && x.pack_entry_id === tableId);
      if (e) return (e.data ?? {}) as Row;
    }
    return null;
  };
  const rangeOfSpec = (value: unknown): [number, number] | null => {
    const said = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    let m = /^(\d+)$/.exec(said);
    if (m) return [Number(m[1]), Number(m[1])];
    m = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(said);
    if (m) return [Number(m[1]), Number(m[2])];
    m = /^(\d+)\s*\+$/.exec(said);
    return m ? [Number(m[1]), Number.MAX_SAFE_INTEGER] : null;
  };
  const weatherRead = (campaign: unknown, tableId: unknown, roll: unknown): { result: string; tags: string[] } | string => {
    const said = String(roll ?? '').replace(/\s+/g, '');
    if (!said) return 'Type what the dice showed.';
    if (!weatherTables(campaign).includes(String(tableId))) return "That isn't one of the setting's weather tables.";
    const table = campaignTable(campaign, tableId);
    if (!table) return "That weather table isn't in the setting rules.";
    const n = /^\d{1,4}$/.test(said) ? Number(said) : null;
    for (const r of Array.isArray(table.rows) ? (table.rows as Row[]) : []) {
      let hit: boolean;
      if (n === null) hit = typeof r.key === 'string' && r.key.replace(/\s+/g, '').replace(/[\\|,]/g, '/') === said;
      else {
        const range = typeof r.min === 'number' ? ([r.min, typeof r.max === 'number' ? r.max : r.min] as [number, number]) : (rangeOfSpec(r.roll) ?? rangeOfSpec(r.level) ?? (String(r.key ?? '').includes('/') ? null : rangeOfSpec(r.key)));
        hit = !!range && n >= range[0] && n <= range[1];
      }
      const result = [r.result, r.value, Array.isArray(r.results) ? r.results[0] : undefined].map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')).find(Boolean);
      if (hit && result) return { result, tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [] };
    }
    return `No row of the weather table has ${said}. Check the roll.`;
  };
  const weatherRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    enter_weather: (args, tag) => {
      const made = madeBy('weather_rolls', tag);
      if (made) return copy(tables.weather_rolls.find((w) => w.id === made.target_id));
      if (!isMemberOf(args.campaign)) return refused("You don't have permission to do that.");
      if (!tables.expeditions.some((x) => x.id === args.expedition && x.campaign_id === args.campaign && x.ended_at === null && !x.undone)) {
        return plain('The weather is entered while an expedition is under way.');
      }
      const settings = (tables.campaigns.find((c) => c.id === args.campaign)?.settings ?? {}) as Row;
      if (!isGmOf(args.campaign) && settings.weatherRolledBy === 'gm') return refused("You don't have permission to do that.");
      const reading = weatherRead(args.campaign, args.table_id, args.roll);
      if (typeof reading === 'string') return plain(reading);
      if (tables.weather_rolls.some((w) => w.expedition_id === args.expedition && w.period === args.period && !w.undone)) {
        return plain("Someone entered the weather first. It's on the card now.");
      }
      const row: Row = {
        id: newId('weather'),
        campaign_id: args.campaign,
        expedition_id: args.expedition,
        period: Number(args.period),
        starts_at: Number(args.starts_at),
        table_id: String(args.table_id).trim(),
        roll: String(args.roll).replace(/\s+/g, ''),
        result: reading.result,
        tags: reading.tags,
        entered_by: me(),
        entered_at: new Date().toISOString(),
        corrected_by: null,
        undone: false,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      tables.weather_rolls.push(row);
      log('weather_rolls', null, structuredClone(row), tag);
      return copy(row);
    },
    correct_weather: (args, tag) => {
      const row = tables.weather_rolls.find((w) => w.id === args.weather);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That weather was undone.');
      if (repeated(tag, row.id)) return copy(row);
      if (isStale(row, args.seen_version)) return staleResult;
      const reading = weatherRead(row.campaign_id, args.table_id, args.roll);
      if (typeof reading === 'string') return plain(reading);
      changeRow('weather_rolls', row, { table_id: String(args.table_id).trim(), roll: String(args.roll).replace(/\s+/g, ''), result: reading.result, tags: reading.tags, corrected_by: me() }, tag);
      return copy(row);
    },
    weather_die: (args) => {
      if (!isMemberOf(args.campaign)) return refused("You don't have permission to do that.");
      if (!weatherTables(args.campaign).includes(String(args.table_id))) return { data: null, error: null };
      const table = campaignTable(args.campaign, args.table_id);
      const die = typeof table?.die === 'string' ? table.die : typeof table?.roll === 'string' ? table.roll : null;
      return { data: die, error: null };
    },
  };
  const setCampaignMode = (campaignId: unknown, mode: string, tag: Tag) => {
    const campaign = tables.campaigns.find((c) => c.id === campaignId);
    if (campaign && (campaign.mode ?? 'downtime') !== mode) {
      // Like the database (M5b step 6.0, sw-3): going into Downtime turns the town switches off, in the same change.
      changeRow('campaigns', campaign, mode === 'downtime' ? { mode, out_day: false, active_night: false } : { mode }, tag);
      // Like the database (M5 step 6): going into Downtime reveals the check results so far (not logged).
      if (mode === 'downtime') for (const r of tables.check_results) if (r.campaign_id === campaignId && !r.revealed) r.revealed = true;
    }
  };
  const clockNow = (campaignId: unknown) => Number(tables.campaign_clocks.find((c) => c.campaign_id === campaignId)?.seconds ?? 0);
  const trimmed = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const clockRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    // Like the database (supabase/migrations/…_m5_reminders.sql): the GM's reminders and check results.
    add_reminder: (args, tag) => {
      const made = madeBy('reminders', tag);
      if (made) return copy(tables.reminders.find((r) => r.id === made.target_id));
      if (!isGmOf(args.campaign)) return refused("You don't have permission to do that.");
      if (!trimmed(args.label)) return plain('Give the reminder a few words.');
      if (!Number.isInteger(Number(args.every_value)) || Number(args.every_value) < 1) return plain('How often: a whole number above 0.');
      const check = args.kind === 'check';
      const row: Row = {
        id: newId('reminder'),
        campaign_id: args.campaign,
        label: trimmed(args.label),
        kind: check ? 'check' : 'reminder',
        encounter_check: check && args.encounter_check === true,
        every_value: Number(args.every_value),
        every_unit: String(args.every_unit ?? 'turn').trim(),
        anchor: clockNow(args.campaign),
        active: true,
        is_public: args.is_public === true,
        chance: check && args.chance && typeof args.chance === 'object' ? args.chance : null,
        table_id: check ? trimmed(args.table_id) : null,
        note: trimmed(args.note),
        created_by: me(),
        undone: false,
        version: 1,
        created_at: new Date(Date.UTC(2026, 9, 29) + createdOrder++).toISOString(),
      };
      tables.reminders.push(row);
      log('reminders', null, structuredClone(row), tag);
      return copy(row);
    },
    edit_reminder: ({ reminder, changes, seen_version }, tag) => {
      const row = tables.reminders.find((r) => r.id === reminder);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That reminder was undone.');
      if (repeated(tag, row.id)) return copy(row);
      if (isStale(row, seen_version)) return staleResult;
      const c = (changes ?? {}) as Row;
      const patch: Row = {};
      for (const key of ['label', 'kind', 'encounter_check', 'every_value', 'every_unit', 'is_public', 'chance', 'table_id', 'note', 'active']) if (key in c) patch[key] = c[key];
      if ('table_id' in patch) patch.table_id = trimmed(patch.table_id);
      if ('note' in patch) patch.note = trimmed(patch.note);
      const kind = (patch.kind ?? row.kind) === 'check' ? 'check' : 'reminder';
      if (kind !== 'check') Object.assign(patch, { encounter_check: false, chance: null, table_id: null });
      const restart =
        (patch.active === true && row.active === false) ||
        ('every_value' in patch && patch.every_value !== row.every_value) ||
        ('every_unit' in patch && patch.every_unit !== row.every_unit);
      if (restart) patch.anchor = clockNow(row.campaign_id);
      changeRow('reminders', row, patch, tag);
      return copy(row);
    },
    record_check: (args, tag) => {
      const made = madeBy('check_results', tag);
      if (made) return copy(tables.check_results.find((r) => r.id === made.target_id));
      if (!isGmOf(args.campaign)) return refused("You don't have permission to do that.");
      if (args.outcome !== 'hit' && args.outcome !== 'miss') return plain('A check is a hit or a miss.');
      const row: Row = {
        id: newId('check'),
        campaign_id: args.campaign,
        expedition_id: tables.expeditions.find((x) => x.campaign_id === args.campaign && x.ended_at === null && !x.undone)?.id ?? null,
        check_key: String(args.check_key),
        name: String(args.name).trim(),
        source: args.source ?? 'mode',
        outcome: args.outcome,
        at_seconds: clockNow(args.campaign),
        modifiers: Array.isArray(args.modifiers) ? args.modifiers : [],
        note: trimmed(args.note),
        table_id: null,
        roll: null,
        row_text: null,
        // Like the database (ruled 2026-10-29): an open check, or one recorded in Downtime, shows to players at once.
        secret: args.secret !== false,
        revealed: args.secret === false || (tables.campaigns.find((c) => c.id === args.campaign)?.mode ?? 'downtime') === 'downtime',
        revealed_by_hand: false,
        created_by: me(),
        undone: false,
        version: 1,
        // On the same clock as the camps' stamp (now, plus the id counter to keep the order): the night check compares
        // a check recorded with Encounter check against when the camp was made (#619).
        created_at: new Date(Date.now() + nextId).toISOString(),
      };
      tables.check_results.push(row);
      log('check_results', null, structuredClone(row), tag);
      return copy(row);
    },
    reveal_check: ({ result, seen_version }, tag) => {
      const row = tables.check_results.find((r) => r.id === result);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That result was undone.');
      if (row.revealed) return copy(row);
      if (isStale(row, seen_version)) return staleResult;
      changeRow('check_results', row, { revealed: true, revealed_by_hand: true }, tag);
      return copy(row);
    },
    set_check_roll: ({ result, table_id, roll, row_text, seen_version }, tag) => {
      const row = tables.check_results.find((r) => r.id === result);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That result was undone.');
      if (row.outcome !== 'hit') return plain('Only a hit rolls a table.');
      if (repeated(tag, row.id)) return copy(row);
      if (isStale(row, seen_version)) return staleResult;
      changeRow('check_results', row, { table_id: trimmed(table_id), roll: trimmed(roll), row_text: trimmed(row_text) }, tag);
      return copy(row);
    },
    // Like the database (M5b step g3): the pins in play now are those made since the last session ended.
    table_pins_now: ({ campaign }) => {
      if (!isGmOf(campaign)) return { data: [], error: null };
      return { data: pinsNow(campaign).map((p) => structuredClone(p)), error: null };
    },
    pin_table: ({ campaign, table_id }, tag) => {
      const made = madeBy('table_pins', tag);
      if (made) return copy(tables.table_pins.find((p) => p.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const id = typeof table_id === 'string' ? table_id.trim() : '';
      if (!id || !campaignTable(campaign, id)) return plain("That table isn't in your setting rules.");
      if (pinsNow(campaign).some((p) => p.table_id === id)) return plain('That table is already pinned.');
      const row: Row = {
        id: newId('pin'),
        campaign_id: campaign,
        table_id: id,
        pinned_at: new Date().toISOString(),
        unpinned_at: null,
        created_by: me(),
        undone: false,
        version: 1,
      };
      tables.table_pins.push(row);
      log('table_pins', null, structuredClone(row), tag);
      return copy(row);
    },
    unpin_table: ({ pin, seen_version }, tag) => {
      const row = tables.table_pins.find((p) => p.id === pin);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That pin was undone.');
      if (row.unpinned_at !== null) return copy(row);
      if (isStale(row, seen_version)) return staleResult;
      changeRow('table_pins', row, { unpinned_at: new Date().toISOString() }, tag);
      return copy(row);
    },
    // Like the database (M5b step 2): one Encounter waiting card per hit that stands; Start and Dismiss settle it.
    queue_encounter: ({ result }, tag) => {
      const made = madeBy('waiting_encounters', tag);
      if (made) return copy(tables.waiting_encounters.find((w) => w.id === made.target_id));
      const hit = tables.check_results.find((r) => r.id === result);
      if (!hit || !isGmOf(hit.campaign_id)) return refused("You don't have permission to do that.");
      if (hit.outcome !== 'hit' || hit.undone) return plain('Only a hit that stands can wait as an encounter.');
      const already = tables.waiting_encounters.find((w) => w.check_result_id === result && !w.undone);
      if (already) return copy(already);
      const row: Row = {
        id: newId('waiting'),
        campaign_id: hit.campaign_id,
        expedition_id: hit.expedition_id ?? null,
        check_result_id: result,
        watch: null,
        state: 'waiting',
        started_at: null,
        dismissed_at: null,
        created_by: me(),
        undone: false,
        version: 1,
        created_at: new Date().toISOString(),
      };
      tables.waiting_encounters.push(row);
      log('waiting_encounters', null, structuredClone(row), tag);
      return copy(row);
    },
    start_encounter: ({ encounter, seen_version }, tag) => settleEncounter(encounter, 'started', seen_version, tag),
    dismiss_encounter: ({ encounter, seen_version }, tag) => settleEncounter(encounter, 'dismissed', seen_version, tag),
    read_table_by_hand: ({ campaign, table_id, roll, row_text }, tag) => {
      const made = madeBy('table_reads', tag);
      if (made) return copy(tables.table_reads.find((r) => r.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (!campaignTable(campaign, table_id)) return plain("That table isn't in your setting rules.");
      if (!trimmed(roll) || !trimmed(row_text)) return plain('Tap the row the dice showed.');
      const row: Row = {
        id: newId('read'),
        campaign_id: campaign,
        expedition_id: tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone)?.id ?? null,
        table_id: String(table_id).trim(),
        roll: trimmed(roll),
        row_text: trimmed(row_text),
        at_seconds: clockNow(campaign),
        created_by: me(),
        undone: false,
        version: 1,
      };
      tables.table_reads.push(row);
      log('table_reads', null, structuredClone(row), tag);
      return copy(row);
    },
    // Move on (December step 4, piece c), like …_dec_4c_move_between_places.sql: the party (group 1) goes to the place
    // and the clock moves on, under one request: Where now?'s move, the move's record, Advance by…'s clock (lights,
    // rest answers, status timers) and the shows a return visit brings back. A repeat gives back what the first made.
    move_between_places: ({ campaign, place, turns, by_seconds, way_by, way_name, seen_version, rest }, tag) => {
      const clockRow = () => tables.campaign_clocks.find((c) => c.campaign_id === campaign);
      const answer = (visit: Row | undefined, back: number): Result => ({ data: { visit: visit ? { ...visit } : null, clock: clockRow() ? { ...clockRow() } : null, back_shown: back }, error: null });
      const made = madeBy('group_places', tag);
      if (made) return answer(tables.group_places.find((g) => g.id === made.target_id), tables.piece_shows.filter((s) => s.group_place_id === made.target_id && s.shown === true && !s.undone).length);
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      withGroupRows();
      if (activeIn(campaign).some((a) => groupNumberOf(a.id) !== 1)) return plain('Join the party up first: for now a move between linked places takes the whole party.');
      const n = Number(turns);
      const by = Number(by_seconds);
      if (!Number.isInteger(n) || n < 1 || n > 1000) return plain('A move takes a whole number of turns, from 1 to 1000.');
      if (!Number.isInteger(by) || by < 1) return plain('Move the clock on by a whole amount above 0.');
      // Like the database: the seconds are the turns at the campaign's turn length (settings, time.turnMinutes; 10 without one).
      const turnMinutes = ((tables.campaigns.find((c) => c.id === campaign)?.settings as { time?: { turnMinutes?: unknown } } | undefined)?.time ?? {}).turnMinutes;
      const turnSeconds = (typeof turnMinutes === 'number' && Number.isInteger(turnMinutes) && turnMinutes > 0 ? turnMinutes : 10) * 60;
      if (by !== n * turnSeconds) return plain(`That time doesn't match the turns: a turn is ${turnSeconds / 60} minutes in this campaign.`);
      const wayBy = typeof way_by === 'string' ? way_by.trim() : '';
      const wayName = typeof way_name === 'string' ? way_name.trim() : '';
      if (wayBy.length > 60) return plain("A way's id is at most 60 characters.");
      if (wayName.length > 200) return plain("A way's name is at most 200 characters.");
      const found = placeInCampaign(campaign, place);
      if (!found) return plain("That place isn't in this campaign.");
      const expedition = tables.expeditions.find((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone);
      if (!expedition) return plain('Start an expedition first.');
      // The database undoes the whole request when the clock refuses; the stand-in can't, so it checks the clock first.
      const clock = clockRow();
      if (!clock) return refused("You don't have permission to do that.");
      if (isStale(clock, seen_version)) return staleResult;
      const was = tables.group_places.find((g) => g.expedition_id === expedition.id && g.group_number === 1 && !g.moved_on && !g.undone);
      const visit = putGroupAt(campaign, expedition.id, 1, found.id, tag);
      const record: Row = { id: newId('place-move'), campaign_id: campaign, expedition_id: expedition.id, group_number: 1, group_place_id: visit.id, from_group_place_id: was?.id ?? null, way_by: wayBy || null, way_name: wayName || null, turns: n, seconds: by, undone: false, created_by: me(), created_at: new Date().toISOString() };
      tables.place_moves.push(record);
      log('place_moves', null, structuredClone(record), tag);
      const moved = moveClock(campaign, seen_version, tag, (seconds) => seconds + by, rest ?? null);
      if (moved.error) return moved;
      const back = groupRpcs.back_at_place!({ visit: visit.id }, tag);
      return answer(visit, Number(back.data ?? 0));
    },
    // Like public.party_moves (…_dec_4c_move_between_places.sql): the moves the reader may know of, each by its clock
    // change's id, with its turns and the names of the place arrived at and the place left as the reader may have
    // them: the GM their own names; a player the players' name once a piece of the place was shown to their group.
    party_moves: ({ campaign }) => {
      withGroupRows();
      const gm = isGmOf(campaign);
      const nameForMe = (visitId: unknown): string | null => {
        const placeId = tables.group_places.find((g) => g.id === visitId)?.place_id;
        const place = tables.places.find((p) => p.id === placeId && p.campaign_id === campaign && !p.undone);
        if (!place) return null;
        if (gm) return String(place.name);
        const shown = tables.group_places.some(
          (g) =>
            g.campaign_id === campaign && g.place_id === place.id && !g.undone && inMyGroup(campaign, Number(g.group_number)) &&
            tables.expeditions.some((x) => x.id === g.expedition_id && !x.undone) &&
            tables.piece_shows.some((s) => s.group_place_id === g.id && s.shown === true && !s.undone && tables.place_pieces.some((pc) => pc.id === s.piece_id && !pc.undone)),
        );
        return shown ? String(place.players_name || place.name) : null;
      };
      const rows = tables.place_moves
        .filter((m) => m.campaign_id === campaign && (gm || inMyGroup(campaign, Number(m.group_number))))
        .flatMap((m) => {
          const made = tables.events.find((e) => e.target_table === 'place_moves' && e.target_id === m.id && e.before === null && e.request_id && !e.reverts_event_id);
          const clock = made && tables.events.find((e) => e.request_id === made.request_id && e.target_table === 'campaign_clocks' && e.type === 'place.moveOn' && !e.reverts_event_id);
          return clock ? [{ clock_event_id: clock.id, turns: m.turns, to_name: nameForMe(m.group_place_id), from_name: nameForMe(m.from_group_place_id) }] : [];
        });
      return { data: rows.reverse(), error: null };
    },
    advance_clock: ({ campaign, by_seconds, seen_version, rest, days }, tag) => {
      const by = Number(by_seconds);
      if (!Number.isInteger(by) || by < 1) return plain('Move the clock on by a whole amount above 0.');
      // Like the database (20261112100000_fix_travel_day_with_clock.sql): the travel days are checked before anything
      // is written (there, a bad one rolls the whole move back), and started after the clock has moved.
      const starts = Array.isArray(days) ? (days as Row[]) : [];
      const whole = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
      if (starts.some((d) => !d || typeof d !== 'object' || !whole(d.group) || !whole(d.day) || !whole(d.total) || !['foot', 'riding', 'cart'].includes(String(d.pace ?? 'foot')))) {
        return plain('A day, a budget and a pace are needed.');
      }
      const moved = moveClock(campaign, seen_version, tag, (seconds) => seconds + by, rest ?? null);
      if (moved.error) return moved;
      const dayTag = tag ? { ...tag, type: 'travel.dayStart', level: 'simple' } : tag;
      for (const d of tripOf(campaign) ? starts : []) {
        const found = travelRowOf(campaign, Number(d.group));
        // A group's first day is the travel card's to make; a day already started is left as it is.
        if (!found || Number(found.day) >= Number(d.day)) continue;
        // One change to the row (the day with yesterday's shortfall already paid), so the move's Undo can check it.
        const owed = found.pending_owed === null || found.pending_owed === undefined ? null : Number(found.pending_owed);
        const paid = Math.min(owed ?? 0, Number(d.total));
        const arrived = owed !== null && owed - paid <= 0;
        // Like the database (fm-1): the place being entered is read from the GM's part of the row.
        const secret = travelSecretOf(found);
        const name = secret.pending_place_name;
        const placeId = secret.pending_place_id;
        changeRow(
          'travel_groups',
          found,
          {
            day: d.day, total: d.total, pace: d.pace ?? 'foot', gm_per_day: d.gmPerDay ?? null, spent: paid, forced: 0,
            ...(arrived ? { terrain_id: found.pending_terrain_id, route_id: found.pending_route_id, ...noPending } : { pending_owed: owed === null ? null : owed - paid }),
          },
          dayTag,
        );
        // Like the database (20261114100000_fix_travel_day_arrival_secrets.sql): the GM's part is cleared with the arrival.
        if (arrived) changeRow('travel_group_secrets', secret, { pending_place_name: null, pending_place_id: null }, dayTag);
        if (arrived && placeId) goesToId(campaign, Number(d.group), placeId, dayTag);
        else if (arrived) goesTo(campaign, Number(d.group), name, dayTag);
      }
      return moved;
    },
    set_clock: ({ campaign, to_seconds, seen_version }, tag) => {
      const to = Number(to_seconds);
      if (!Number.isInteger(to) || to < 0) return plain("The time can't be before the clock started.");
      return moveClock(campaign, seen_version, tag, () => to);
    },
    start_session: ({ campaign }, tag) => {
      const made = madeBy('sessions', tag);
      if (made) return copy(tables.sessions.find((s) => s.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      const mine = tables.sessions.filter((s) => s.campaign_id === campaign && !s.undone);
      if (mine.some((s) => s.ended_at === null)) return plain('A session is already running.');
      const row: Row = {
        id: newId('session'),
        campaign_id: campaign,
        number: Math.max(0, ...mine.map((s) => Number(s.number))) + 1,
        started_at: new Date().toISOString(),
        ended_at: null,
        started_by: me(),
        ended_by: null,
        undone: false,
        version: 1,
      };
      tables.sessions.push(row);
      log('sessions', null, structuredClone(row), tag);
      return copy(row);
    },
    // Like the database (M5 calendar follow-ups): "Not now" on "Which season?", kept with the campaign.
    season_not_now: ({ campaign }, tag) => {
      const row = tables.campaigns.find((c) => c.id === campaign);
      if (!row || !isGmOf(campaign)) return refused("You don't have permission to do that.");
      changeRow('campaigns', row, { season_not_now_at: new Date().toISOString() }, tag);
      return { data: row.season_not_now_at, error: null };
    },
    end_session: ({ session, seen_version }, tag) => {
      const row = tables.sessions.find((s) => s.id === session);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That session was undone.');
      if (row.ended_at !== null) return repeated(tag, row.id) ? copy(row) : plain('That session has already ended.');
      if (isStale(row, seen_version)) return staleResult;
      changeRow('sessions', row, { ended_at: new Date().toISOString(), ended_by: me() }, tag);
      return copy(row);
    },
    start_expedition: ({ campaign, mode_id, place_name }, tag) => beginExpedition(campaign, mode_id, place_name, null, tag),
    // Start at a place picked by id (M8b slice 0).
    start_expedition_at: ({ campaign, mode_id, place }, tag) => {
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (!place) return plain("That place isn't in this campaign.");
      return beginExpedition(campaign, mode_id, null, place, tag);
    },
  };
  function beginExpedition(campaign: unknown, mode_id: unknown, place_name: unknown, placeId: unknown, tag: Tag): Result {
    {
      const made = madeBy('expeditions', tag);
      if (made) return copy(tables.expeditions.find((x) => x.id === made.target_id));
      if (!isGmOf(campaign)) return refused("You don't have permission to do that.");
      if (tables.expeditions.some((x) => x.campaign_id === campaign && x.ended_at === null && !x.undone)) return plain('An expedition is already under way. End it first.');
      const picked = placeId ? placeInCampaign(campaign, placeId) : undefined;
      if (placeId && !picked) return plain("That place isn't in this campaign.");
      if (picked) place_name = String(picked.name);
      const row: Row = {
        id: newId('expedition'),
        campaign_id: campaign,
        session_id: tables.sessions.find((s) => s.campaign_id === campaign && s.ended_at === null && !s.undone)?.id ?? null,
        mode: String(mode_id).trim(),
        started_at: Number(tables.campaign_clocks.find((c) => c.campaign_id === campaign)?.seconds ?? 0),
        ended_at: null,
        created_at: new Date().toISOString(),
        who_went: tables.actors
          .filter((a) => a.campaign_id === campaign && a.kind === 'pc' && a.approval === 'approved' && (a.status ?? 'active') === 'active')
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map((a) => a.id),
        summary: null,
        safe_paths: false,
        ended_safe: null,
        started_by: me(),
        undone: false,
        version: 1,
      };
      if (typeof place_name === 'string' && place_name.trim().length > 200) return plain("A place's name is at most 200 characters.");
      tables.expeditions.push(row);
      log('expeditions', null, structuredClone(row), tag);
      // Like the database (M5 step 10, DG1): the optional place, the GM's alone.
      if (typeof place_name === 'string' && place_name.trim()) {
        const place: Row = { id: newId('place'), campaign_id: campaign, expedition_id: row.id, name: place_name.trim(), mode: row.mode, undone: false, created_by: me(), created_at: new Date(Date.now() + nextId).toISOString() };
        tables.expedition_places.push(place);
        log('expedition_places', null, structuredClone(place), tag);
        // Like the database (M5 step 11): the place is named for the campaign, and group 1 is there, hidden.
        const known = picked ?? namePlace(campaign, String(place.name), tag);
        putGroupAt(campaign, row.id, 1, known.id, tag);
      }
      setCampaignMode(campaign, 'adventure', tag);
      return copy(row);
    }
  }
  const expeditionRpcsRest: Record<string, (args: Row, tag: Tag) => Result> = {
    end_expedition: ({ expedition, seen_version }, tag) => {
      const row = tables.expeditions.find((x) => x.id === expedition);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That expedition was undone.');
      if (row.ended_at !== null) return repeated(tag, row.id) ? copy(row) : plain('That expedition has already ended.');
      if (isStale(row, seen_version)) return staleResult;
      const now = Math.max(Number(row.started_at), Number(tables.campaign_clocks.find((c) => c.campaign_id === row.campaign_id)?.seconds ?? 0));
      changeRow('expeditions', row, { ended_at: now, summary: { seconds: now - Number(row.started_at) } }, tag);
      // M5b step 6a (dt-2): the campaign stays in Adventure; Start downtime is its own tap.
      return copy(row);
    },
    // Like the database (…_m5b_6a_time_in_town.sql): a full rest for every character in play, then Downtime.
    start_downtime: ({ campaign, refills }, tag) => {
      const found = tables.campaigns.find((c) => c.id === campaign);
      if (!found || !isGmOf(campaign)) return refused("You don't have permission to do that.");
      if ((found.mode ?? 'downtime') === 'downtime') return repeated(tag, found.id) ? { data: 'downtime', error: null } : plain('Downtime has already started.');
      if (tripOf(campaign)) return plain('End the expedition first.');
      for (const [who, names] of Object.entries((refills ?? {}) as Record<string, unknown>)) {
        const actor = tables.actors.find((a) => a.id === who && a.campaign_id === campaign);
        if (!actor || (actor.kind ?? 'pc') !== 'pc' || (actor.approval ?? 'approved') !== 'approved' || (actor.status ?? 'active') !== 'active' || !Array.isArray(names)) continue;
        const play = tables.character_play.find((p) => p.actor_id === who);
        const spent = (play?.uses_spent ?? {}) as Record<string, number>;
        const named = names.map(String);
        if (!play || !named.some((n) => n in spent)) continue;
        changeRow('character_play', play, { uses_spent: Object.fromEntries(Object.entries(spent).filter(([name]) => !named.includes(name))) }, tag);
      }
      setCampaignMode(campaign, 'downtime', tag);
      return { data: 'downtime', error: null };
    },
    end_downtime: ({ campaign }, tag) => {
      const found = tables.campaigns.find((c) => c.id === campaign);
      if (!found || !isGmOf(campaign)) return refused("You don't have permission to do that.");
      if ((found.mode ?? 'downtime') !== 'downtime') return repeated(tag, found.id) ? { data: found.mode, error: null } : plain("The campaign isn't in downtime.");
      setCampaignMode(campaign, 'adventure', tag);
      return { data: 'adventure', error: null };
    },
    // Use safe paths (sq-2; …_m5b_safe_paths_logged.sql): the GM's, on an expedition under way; once.
    use_safe_paths: ({ expedition }, tag) => {
      const row = tables.expeditions.find((x) => x.id === expedition);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That expedition was undone.');
      if (row.ended_at !== null) return plain('That expedition has ended.');
      if (row.safe_paths === true) return copy(row);
      changeRow('expeditions', row, { safe_paths: true }, tag);
      return copy(row);
    },
    // In a safe place? (m8b-0 delivery 5; …_m8b_0_safe_place_answer.sql): the GM's, on an ended expedition; changeable.
    answer_safe_place: ({ expedition, safe }, tag) => {
      const row = tables.expeditions.find((x) => x.id === expedition);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That expedition was undone.');
      if (row.ended_at === null || row.ended_at === undefined) return plain('End the expedition first.');
      if (typeof safe !== 'boolean') return plain('Answer Yes or No.');
      if (row.ended_safe === safe) return copy(row);
      changeRow('expeditions', row, { ended_safe: safe }, tag);
      return copy(row);
    },
    full_rest: ({ expedition, refills }, tag) => {
      const row = tables.expeditions.find((x) => x.id === expedition);
      if (!row || !isGmOf(row.campaign_id)) return refused("You don't have permission to do that.");
      if (row.undone) return plain('That expedition was undone.');
      if (row.ended_at === null) return plain('End the expedition first.');
      if ((row.summary as Row | null)?.fullRest === true) return repeated(tag, row.id) ? copy(row) : plain('The party has had its full rest.');
      for (const [who, names] of Object.entries((refills ?? {}) as Record<string, unknown>)) {
        if (!(row.who_went as string[]).includes(who) || !Array.isArray(names)) continue;
        const play = tables.character_play.find((p) => p.actor_id === who);
        const spent = (play?.uses_spent ?? {}) as Record<string, number>;
        const named = names.map(String);
        if (!play || !named.some((n) => n in spent)) continue;
        changeRow('character_play', play, { uses_spent: Object.fromEntries(Object.entries(spent).filter(([name]) => !named.includes(name))) }, tag);
      }
      changeRow('expeditions', row, { summary: { ...((row.summary as Row | null) ?? {}), fullRest: true } }, tag);
      return copy(row);
    },
  };
  // One map, as before: the expedition functions after Start sit with the clock's.
  Object.assign(clockRpcs, expeditionRpcsRest);

  // Activities (M5b step 3) and camp (M5b step 4), like supabase/migrations/…_m5b_3_activities.sql,
  // …_m5b_3_undo_named.sql, …_m5b_3_known_places_campaign.sql, …_m5b_4_camp.sql, …_m5b_4_camp_night.sql and its fixes
  // (…171000 to …173000). Every call checks first and writes after, so a refusal changes nothing (the database rolls back).
  const stamp = () => new Date(Date.now() + nextId).toISOString();
  const clip = (value: unknown, most: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, most) : null);
  const forbidden = () => refused("You don't have permission to do that.");
  const groupMemberOf = (campaign: unknown, group: number, actor: unknown) => {
    withGroupRows();
    const who = tables.actors.find((a) => a.id === actor && a.campaign_id === campaign);
    return !!who && ['pc', 'hireling'].includes(String(who.kind ?? 'pc')) && (who.approval ?? 'approved') === 'approved' && (who.status ?? 'active') === 'active' && groupNumberOf(who.id) === group;
  };
  // The camp this request may write to (private.camp_for_me): open, of the expedition under way, the caller's.
  const campForMe = (camp: unknown): Row | Result => {
    const found = tables.camps.find((c) => c.id === camp && !c.undone);
    if (!found || !(isGmOf(found.campaign_id) || inMyGroup(found.campaign_id, Number(found.group_number)))) return forbidden();
    if (found.expedition_id !== tripOf(found.campaign_id)?.id || (found.applied_at !== null && found.applied_at !== undefined)) return plain('That camp is over.');
    return found;
  };
  const isResult = (value: Row | Result): value is Result => 'error' in value && 'data' in value;
  // private.camp_actor: a character the caller may act for, active in the camp's group.
  const campActor = (cmp: Row, actor: unknown): Result | null => {
    if (!mayPlayActor(cmp.campaign_id, actor)) return forbidden();
    if (!groupMemberOf(cmp.campaign_id, Number(cmp.group_number), actor)) return plain('Only someone in the camp can do that.');
    return null;
  };
  // private.use_up_line, checked first (null: fine) and then done: the line goes with the last (the log keeps a copy).
  const upMessage = (who: unknown, lineId: unknown, howMany: unknown): string | null => {
    const got = tables.inventory_lines.find((l) => l.id === lineId);
    if (!got || got.actor_id !== who || (got.approval ?? 'approved') !== 'approved') return "That isn't in their pack.";
    if (typeof howMany !== 'number' || !Number.isInteger(howMany) || howMany < 1 || howMany > Number(got.qty)) return `How many must be a whole number from 1 to ${String(got.qty)}.`;
    return null;
  };
  const takeUp = (lineId: unknown, howMany: number, tag: Tag): Row => {
    const got = tables.inventory_lines.find((l) => l.id === lineId)!;
    const was = structuredClone(got);
    if (howMany === Number(got.qty)) {
      tables.inventory_lines = tables.inventory_lines.filter((l) => l.id !== got.id);
      log('inventory_lines', structuredClone(got), null, tag);
    } else {
      changeRow('inventory_lines', got, { qty: Number(got.qty) - howMany }, tag);
    }
    return was;
  };
  const campEntry = (cmp: Row, kind: string, actor: unknown, fields: Row, tag: Tag): Row => {
    const entry: Row = {
      id: newId('camp-entry'), camp_id: cmp.id, campaign_id: cmp.campaign_id, group_number: cmp.group_number, kind, actor_id: actor, qty: 0, seconds: 0,
      at: clockNow(cmp.campaign_id), line_id: null, food_name: null, food_kind: null, from_pot: false, outcome: null, detail: [], created_by: me(),
      undone: false, version: 1, created_at: stamp(), updated_at: stamp(), ...fields,
    };
    tables.camp_entries.push(entry);
    log('camp_entries', null, structuredClone(entry), tag);
    return entry;
  };
  const sumOf = (cmp: Row, kind: string) => tables.camp_entries.filter((e) => e.camp_id === cmp.id && e.kind === kind && !e.undone).reduce((sum, e) => sum + Number(e.qty), 0);
  const potMeals = (cmp: Row) => tables.camp_entries.filter((e) => e.camp_id === cmp.id && e.kind === 'meal' && e.from_pot === true && !e.undone).length;
  const enteredBy = (table: 'camp_entries' | 'activity_runs' | 'camps', tag: Tag): Result | null => {
    const made = madeBy(table, tag);
    return made ? copy(tables[table].find((r) => r.id === made.target_id)) : null;
  };
  // Like private.activity_who (ac-1): the activity's `who` in the highest rules set with a readable mode (as
  // campaign_rules_sets orders them: the homebrew on top, then priority; a pack's secret half merged in; option choices
  // aren't applied here); not found: 'one'.
  const activityWho = (campaign: unknown, activityId: unknown): string => {
    const homebrew = (cp: Row) => (tables.packs.find((p) => p.id === cp.pack_id)?.kind === 'homebrew' ? 1 : 0);
    const sets = tables.campaign_packs
      .filter((link) => link.campaign_id === campaign)
      .sort((x, y) => homebrew(x) - homebrew(y) || Number(x.priority ?? 0) - Number(y.priority ?? 0))
      .flatMap((cp) => tables.library_entries.filter((e) => e.pack_id === cp.pack_id && e.kind === 'rulesSet'))
      .map((e) => ({ ...((e.data ?? {}) as Row), ...((tables.library_entry_secrets.find((x) => x.id === e.id)?.data ?? {}) as Row) }));
    const modesOf = (set: Row) => {
      const exploration = set.exploration as Row | undefined;
      return Array.isArray(exploration?.modes) ? (exploration.modes as Row[]) : [];
    };
    // Like private.mode_readable: an id, and a step with a whole value and a unit.
    const readable = (m: Row) => {
      const step = m.step as Row | undefined;
      return typeof m.id === 'string' && m.id !== '' && Number.isInteger(step?.value) && Number(step?.value) > 0 && typeof step?.unit === 'string' && step.unit !== '';
    };
    const chosen = [...sets].reverse().find((set) => modesOf(set).some(readable));
    const found = (chosen ? modesOf(chosen) : []).flatMap((m) => (Array.isArray(m.activities) ? (m.activities as Row[]) : [])).filter((x) => x.id === activityId);
    return found.length > 0 && found.every((x) => x.who === 'several' || x.who === 'party') ? String(found[0]!.who) : 'one';
  };
  // Like private.actor_is_mine (ac-1): a character or hireling the caller's user owns.
  const actorIsMine = (id: unknown) => tables.actors.some((x) => x.id === id && x.owner_type === 'user' && x.owner_user_id === me());
  const campRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    // activity.apply: the cost off today's budget and the yield into the finder's pack, in one request.
    apply_activity: (a, tag) => {
      const done = enteredBy('activity_runs', tag);
      if (done) return done;
      const campaign = a.campaign;
      const group = Number(a.group_no);
      if (!(isGmOf(campaign) || inMyGroup(campaign, group))) return forbidden();
      const trip = tripOf(campaign);
      if (!trip) return plain('Start an expedition first.');
      const actors = Array.isArray(a.actors) ? (a.actors as unknown[]) : [];
      if (actors.length === 0) return plain("Pick who's acting.");
      if (!actors.every((who) => groupMemberOf(campaign, group, who))) return plain('Everyone acting must be in the group.');
      // ac-1: in an activity one character does, a player names only their own characters and hirelings.
      if (!isGmOf(campaign) && activityWho(campaign, a.activity_id) === 'one' && ![...actors, ...(a.finder ? [a.finder] : [])].every(actorIsMine)) return forbidden();
      if (!['worked', 'failed', 'done'].includes(String(a.outcome))) return plain('Say how it went.');
      const spend = a.spend;
      if (typeof spend !== 'number' || !Number.isInteger(spend) || spend < 0 || spend > 100000) return plain('A whole number of points, 0 or more, is needed.');
      const qty = a.yield_qty === undefined || a.yield_qty === null ? 0 : Number(a.yield_qty);
      if (!Number.isInteger(qty) || qty < 0 || qty > 100000) return plain('How many must be a whole number, 0 or more.');
      if (qty > 0) {
        if (!a.finder || !actors.includes(a.finder)) return plain('The finder must be one of those acting.');
        if (!a.yield_entry || typeof a.yield_name !== 'string' || !a.yield_name.trim()) return plain("That item isn't in the setting rules.");
      }
      const travel = spend > 0 ? travelRowOf(campaign, group) : undefined;
      if (spend > 0 && !travel) return plain('Start the day first.');
      const lineId = qty > 0 ? `line-${crypto.randomUUID()}` : null;
      const run: Row = {
        id: newId('activity-run'), campaign_id: campaign, expedition_id: trip.id, group_number: group, travel_group_id: travel?.id ?? null, day: travel?.day ?? null,
        activity_id: String(a.activity_id).trim().slice(0, 200), activity_name: String(a.activity_name).trim().slice(0, 200), actor_ids: [...actors],
        rolls: Array.isArray(a.rolls) ? a.rolls : [], outcome: a.outcome, spent: spend, finder_id: lineId ? a.finder : null, yield_line_id: lineId,
        yield_name: lineId ? String(a.yield_name).trim().slice(0, 200) : null, yield_qty: lineId ? qty : 0, created_by: me(), undone: false, version: 1,
        created_at: stamp(), updated_at: stamp(),
      };
      tables.activity_runs.push(run);
      log('activity_runs', null, structuredClone(run), tag);
      if (travel) changeRow('travel_groups', travel, { spent: Math.min(100000, Number(travel.spent) + spend) }, tag);
      if (lineId) {
        // Like the database (a trigger on the line copies the item from the setting rules): what the entry holds.
        const entry = tables.library_entries.find((e) => e.id === a.yield_entry);
        const data = (entry?.data ?? {}) as Row;
        const line: Row = {
          id: lineId, campaign_id: campaign, location_id: null, actor_id: a.finder, library_entry_id: a.yield_entry, name: String(a.yield_name).trim().slice(0, 200),
          category: typeof a.yield_category === 'string' ? a.yield_category : '', weight_coin: a.yield_weight ?? null, slots: a.yield_slots ?? null,
          stack: Math.max(1, Number(a.yield_stack ?? 1)), container_line_id: null, equipped: false, cost: '', notes: '', item_data: entry ? data : {},
          source_pack_id: entry?.pack_id ?? null, source_entry_id: entry?.pack_entry_id ?? null, charges_left: null, charges_hidden: false, charges_used: 0,
          spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, qty, how_got: 'found',
          created_at: stamp(), version: 1,
        };
        tables.inventory_lines.push(line);
        log('inventory_lines', null, structuredClone(line), tag);
      }
      return copy(run);
    },
    // activity.undo: the yield out (while untouched), the points back, the run marked undone; each linked to its change.
    undo_activity: ({ run_id }, tag) => {
      const run = tables.activity_runs.find((r) => r.id === run_id);
      if (!run || !(isGmOf(run.campaign_id) || (isMemberOf(run.campaign_id) && run.created_by === me()))) return forbidden();
      if (run.undone) return plain('That was already undone.');
      const madeEvent = tables.events.filter((e) => e.target_table === 'activity_runs' && e.target_id === run.id && e.before === null).sort((x, y) => Number(x.seq) - Number(y.seq))[0];
      const request = madeEvent?.request_id ?? null;
      const author = madeEvent?.actor_user_id ?? null;
      const line = run.yield_line_id ? tables.inventory_lines.find((l) => l.id === run.yield_line_id) : undefined;
      if (run.yield_line_id && (!line || line.actor_id !== run.finder_id || Number(line.qty) !== Number(run.yield_qty) || line.container_line_id)) {
        return plain(`That's changed since: the ${String(run.yield_name)} was used or moved. Undo the later change first.`);
      }
      const travel = Number(run.spent) > 0 && run.travel_group_id ? tables.travel_groups.find((t) => t.id === run.travel_group_id) : undefined;
      if (Number(run.spent) > 0 && run.travel_group_id && (!travel || travel.undone || travel.day !== run.day)) return plain('A new day has started: that can\'t be undone now.');
      const linked = (table: string, id: unknown, byAuthor: boolean) =>
        tables.events
          .filter((e) => e.target_table === table && e.target_id === id && (table !== 'inventory_lines' || e.before === null) &&(e.request_id ?? null) === request && (!byAuthor || (e.actor_user_id ?? null) === author))
          .sort((x, y) => (table === 'inventory_lines' ? Number(x.seq) - Number(y.seq) : Number(y.seq) - Number(x.seq)))[0] ?? madeEvent;
      if (line) {
        const gone = structuredClone(line);
        tables.inventory_lines = tables.inventory_lines.filter((l) => l.id !== line.id);
        log('inventory_lines', gone, null, tag, linked('inventory_lines', line.id, false));
      }
      if (travel) {
        const was = structuredClone(travel);
        Object.assign(travel, { spent: Math.max(0, Number(travel.spent) - Number(run.spent)), version: Number(travel.version) + 1 });
        log('travel_groups', was, structuredClone(travel), tag, linked('travel_groups', travel.id, true));
      }
      const was = structuredClone(run);
      Object.assign(run, { undone: true, version: Number(run.version) + 1 });
      log('activity_runs', was, structuredClone(run), tag, madeEvent);
      return copy(run);
    },
    // camp.open: one camp per group per evening; the same evening again gives back the one open.
    open_camp: (a, tag) => {
      const done = enteredBy('camps', tag);
      if (done) return done;
      const group = Number(a.group_no);
      if (!(isGmOf(a.campaign) || inMyGroup(a.campaign, group))) return forbidden();
      const trip = tripOf(a.campaign);
      if (!trip) return plain('Start an expedition first.');
      if (typeof a.day !== 'number' || a.day < 0) return plain('Which day is it?');
      withGroupRows();
      const open = tables.camps.find((c) => c.expedition_id === trip.id && c.group_number === group && c.day === a.day && !c.undone);
      if (open) return copy(open);
      const row: Row = {
        id: newId('camp'), campaign_id: a.campaign, expedition_id: trip.id, group_number: group, day: a.day, quick: a.quick === true, fire_type_id: clip(a.fire_type_id, 200),
        fire_name: clip(a.fire_name, 200), fuel_item: clip(a.fuel_item, 200), applied_at: null, created_by: me(), undone: false, version: 1, created_at: stamp(), updated_at: stamp(),
      };
      tables.camps.push(row);
      log('camps', null, structuredClone(row), tag);
      return copy(row);
    },
    // camp.fuel: bundles of firewood off a line in a character's pack onto the fire.
    add_camp_fuel: (a, tag) => {
      const done = enteredBy('camp_entries', tag);
      if (done) return done;
      const cmp = campForMe(a.camp);
      if (isResult(cmp)) return cmp;
      const refusal = campActor(cmp, a.actor);
      if (refusal) return refusal;
      if (cmp.fuel_item === null || cmp.fuel_item === undefined) return plain('This camp has no campfire.');
      const each = a.seconds_each;
      if (typeof each !== 'number' || each < 0 || each > 100000000) return plain('How long a bundle burns must be a whole number of seconds.');
      const wood = tables.inventory_lines.find((l) => l.id === a.line);
      if (!wood || wood.source_entry_id !== cmp.fuel_item) return plain("That isn't firewood.");
      const why = upMessage(a.actor, a.line, a.qty);
      if (why) return plain(why);
      const qty = Number(a.qty);
      const used = takeUp(a.line, qty, tag);
      return copy(campEntry(cmp, 'fuel', a.actor, { qty, seconds: qty * each, line_id: used.id, food_name: String(used.name).slice(0, 200) }, tag));
    },
    // camp.cook: the cook's ingredients become portions in the pot.
    cook_at_camp: (a, tag) => {
      const done = enteredBy('camp_entries', tag);
      if (done) return done;
      const cmp = campForMe(a.camp);
      if (isResult(cmp)) return cmp;
      const refusal = campActor(cmp, a.cook);
      if (refusal) return refusal;
      const portions = a.portions;
      if (typeof portions !== 'number' || !Number.isInteger(portions) || portions < 0 || portions > 1000) return plain('How many portions must be a whole number, 0 or more.');
      if (!Array.isArray(a.ingredients) || a.ingredients.length === 0) return plain('Pick what to cook.');
      const items = a.ingredients as Row[];
      for (const item of items) {
        const why = upMessage(a.cook, item.line, item.qty);
        if (why) return plain(why);
      }
      const said = items.map((item) => {
        const used = takeUp(item.line, Number(item.qty), tag);
        return { line: used.id, name: used.name, qty: Number(item.qty) };
      });
      return copy(campEntry(cmp, 'cook', a.cook, { qty: portions, detail: said }, tag));
    },
    // camp.talk: campfire talk worked or it didn't.
    camp_talk: (a, tag) => {
      const done = enteredBy('camp_entries', tag);
      if (done) return done;
      const cmp = campForMe(a.camp);
      if (isResult(cmp)) return cmp;
      const refusal = campActor(cmp, a.actor);
      if (refusal) return refusal;
      if (a.outcome !== 'worked' && a.outcome !== 'failed') return plain('Say how it went.');
      return copy(campEntry(cmp, 'talk', a.actor, { outcome: a.outcome }, tag));
    },
    // camp.eat: a portion from the pot, or one of a food line in their own pack; once each per camp.
    eat_at_camp: (a, tag) => {
      const done = enteredBy('camp_entries', tag);
      if (done) return done;
      const cmp = campForMe(a.camp);
      if (isResult(cmp)) return cmp;
      const refusal = campActor(cmp, a.actor);
      if (refusal) return refusal;
      if (tables.camp_entries.some((e) => e.camp_id === cmp.id && e.kind === 'meal' && e.actor_id === a.actor && !e.undone)) return plain('They have eaten already.');
      const pot = a.from_pot === true;
      let fields: Row;
      if (pot) {
        if (sumOf(cmp, 'cook') <= potMeals(cmp)) return plain('The pot is empty.');
        fields = { qty: 1, from_pot: true, food_kind: 'cooked' };
      } else {
        if (!a.line) return plain('Pick what they eat.');
        const why = upMessage(a.actor, a.line, 1);
        if (why) return plain(why);
        const food = takeUp(a.line, 1, tag);
        const kind = (food.item_data as Row | null)?.food;
        fields = { qty: 1, line_id: food.id, food_name: String(food.name).slice(0, 200), food_kind: kind === 'cooked' || kind === 'fresh' || kind === 'preserved' ? kind : null };
      }
      return copy(campEntry(cmp, 'meal', a.actor, fields, tag));
    },
    // camp.watches: the group's watch order, 1 to 3 of the group's characters a watch, each once (the newest stands).
    set_camp_watches: (a, tag) => {
      const done = enteredBy('camp_entries', tag);
      if (done) return done;
      const cmp = campForMe(a.camp);
      if (isResult(cmp)) return cmp;
      const refusal = campActor(cmp, a.actor);
      if (refusal) return refusal;
      if (!Array.isArray(a.watches) || a.watches.length > 24) return plain('The watches must be a list.');
      const seen: unknown[] = [];
      for (const one of a.watches as unknown[]) {
        if (!Array.isArray(one) || one.length < 1 || one.length > 3) return plain('Each watch holds 1 to 3 characters.');
        for (const who of one) {
          if (!groupMemberOf(cmp.campaign_id, Number(cmp.group_number), who) || seen.includes(who)) return plain("Each watch is the group's own characters, each once.");
          seen.push(who);
        }
      }
      return copy(campEntry(cmp, 'watches', a.actor, { detail: structuredClone(a.watches) }, tag));
    },
    // camp.sleep: one character's sleep; only the GM sets the difficulty (a permission refusal, …173000).
    camp_sleep: (a, tag) => {
      const done = enteredBy('camp_entries', tag);
      if (done) return done;
      const cmp = campForMe(a.camp);
      if (isResult(cmp)) return cmp;
      const refusal = campActor(cmp, a.actor);
      if (refusal) return refusal;
      const difficulty = clip(a.difficulty, 200);
      if (difficulty && !isGmOf(cmp.campaign_id)) return refused('Only the GM changes how hard sleep is.');
      const outcome = a.outcome === undefined ? null : a.outcome;
      if (outcome !== null && outcome !== 'good' && outcome !== 'bad') return plain('Say how they slept.');
      if (!difficulty && outcome === null) return plain('Say how they slept.');
      const roll = clip(a.roll, 40);
      return copy(campEntry(cmp, 'sleep', a.actor, { outcome, detail: [{ ...(difficulty ? { difficulty } : {}), ...(roll ? { roll } : {}) }] }, tag));
    },
    // camp.apply: Next day marks tonight's camps applied at the clock's time (sent in the move's own request).
    apply_camps: ({ campaign, camps }, tag) => {
      if (!isGmOf(campaign)) return forbidden();
      const trip = tripOf(campaign);
      const named = Array.isArray(camps) ? (camps as unknown[]) : [];
      const applied: Row[] = [];
      for (const c of tables.camps) {
        if (!named.includes(c.id) || c.campaign_id !== campaign || c.expedition_id !== trip?.id || c.undone || (c.applied_at !== null && c.applied_at !== undefined)) continue;
        changeRow('camps', c, { applied_at: clockNow(campaign) }, tag);
        applied.push({ ...c });
      }
      return { data: applied, error: null };
    },
    // encounter.watch: Which watch? on a night hit's waiting card, the GM's.
    set_encounter_watch: ({ encounter, watch, seen_version }, tag) => {
      const row = tables.waiting_encounters.find((w) => w.id === encounter && w.state === 'waiting' && !w.undone);
      if (!row || !isGmOf(row.campaign_id)) return forbidden();
      if (isStale(row, seen_version)) return staleResult;
      changeRow('waiting_encounters', row, { watch: typeof watch === 'string' ? watch.trim().slice(0, 200) || null : null }, tag);
      return copy(row);
    },
    // Like public.campaign_ways_on (mc-28, …_dec_hd2_ways_on_read.sql): for each group the reader is in (the GM:
    // every group), the routes leaving its current place when that place came from a pack still attached. Never a
    // hidden route (anything but a plain false or absent `hidden`, read on the whole entry); the far end's place and
    // players' name only once a piece of it has been shown to the group, else null; no pack ids. And no row at all
    // for a group until a piece of the place it is at now has been shown to it (mc-28b), on any visit (mc-28c).
    // Since sf-9 (…_sf_9_ways_on_number_elsewhere.sql; sf-19): `to_number`, the far place's map number (its location's
    // `key`, when text), only for a place explored or whose container (`parentId`) the group knows: one of its visits
    // stood at that container or inside it, at any depth, shown or not; with no container, at a place that has none
    // either. Else `elsewhere` is true and no number is sent. And `to_area_name` (#122's ⚑ 1), only when not elsewhere:
    // the players' name of that container, the `players_name` of the campaign's place made from it, else the pack's
    // `playerView.name` when text; never the container's own name, and null when it was given neither.
    // Since the review of #122: the container is named only when it is an Area (its `type`, as every reader reads it,
    // is plainly "area") or the group has itself explored it (a piece of it shown): a visit alone names an Area only.
    // A far place whose `parentId` the pack files among its GM-only fields leads elsewhere unless explored, and has no
    // number either way; a visited place that hides its own does not count as standing in no Area. A players' name
    // that is only blanks is no name.
    campaign_ways_on: ({ campaign }) => {
      if (!isMemberOf(campaign)) return { data: [], error: null };
      withGroupRows();
      const gm = isGmOf(campaign);
      const plainFalse = (value: unknown) => value === undefined || value === false;
      const rows: Row[] = [];
      for (const g of tables.party_groups) {
        const group = Number(g.number);
        if (g.campaign_id !== campaign || !(gm || inMyGroup(campaign, group))) continue;
        const visit = tables.group_places
          .filter((v) => v.campaign_id === campaign && Number(v.group_number) === group && !v.undone && !v.moved_on)
          .filter((v) => tables.expeditions.some((x) => x.id === v.expedition_id && x.ended_at === null && !x.undone))
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const here = visit && tables.places.find((p) => p.id === visit.place_id && !p.undone && p.pack_entry_id);
        if (!here || !tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === here.pack_id)) continue;
        // Whether a piece of a place has been shown to this group, on any visit (as What we know decides).
        const shownToGroup = (placeId: unknown) =>
          tables.group_places.some(
            (v) =>
              v.campaign_id === campaign && v.place_id === placeId && Number(v.group_number) === group && !v.undone &&
              tables.expeditions.some((x) => x.id === v.expedition_id && !x.undone) &&
              tables.piece_shows.some((sh) => sh.group_place_id === v.id && sh.shown === true && !sh.undone && tables.place_pieces.some((pc) => pc.id === sh.piece_id && !pc.undone)),
          );
        // mc-28b and mc-28c (2026-11-12): no ways at all for a group until something of the place it is at now has
        // been shown to it, on this visit or an earlier one.
        if (!shownToGroup(here.id)) continue;
        for (const r of tables.library_entries) {
          if (r.pack_id !== here.pack_id || r.kind !== 'route') continue;
          const whole = { ...((r.data ?? {}) as Row), ...((tables.library_entry_secrets.find((x) => x.id === r.id)?.data ?? {}) as Row) };
          if (!plainFalse(whole.hidden)) continue;
          const end = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
          const leaves = end(whole.from) === here.pack_entry_id;
          if (!leaves && !(end(whole.to) === here.pack_entry_id && plainFalse(whole.oneWay))) continue;
          const farEntry = leaves ? end(whole.to) : end(whole.from);
          const far = tables.places.find((p) => p.campaign_id === campaign && p.pack_id === here.pack_id && p.pack_entry_id === farEntry && !p.undone && shownToGroup(p.id));
          // mc-28a: how the way is travelled and how long it takes, the four fields alone. The route's reader also
          // keeps a way's `icon` (pf-25), which the database does not send, so it is left behind here.
          const ways = routeWays(whole.travel).map(({ by, name, value, unit }) => ({ by, name, value, unit }));
          // sf-9, sf-19: the far place as the pack has it, read here and never sent as written.
          const farLocation = tables.library_entries.find((e) => e.pack_id === here.pack_id && e.kind === 'location' && e.pack_entry_id === farEntry);
          const containerOf = (entry: Row) => end((entry.data as Row | undefined)?.parentId);
          // Whether the pack hides where an entry sits: its GM-only part holds `parentId`.
          const hidesContainer = (entry: Row | undefined) => !!entry && 'parentId' in ((tables.library_entry_secrets.find((x) => x.id === entry.id)?.data ?? {}) as Row);
          const farHidden = hidesContainer(farLocation);
          const farContainer = farLocation && !farHidden ? containerOf(farLocation) : '';
          const beenAt = (placeId: unknown) =>
            tables.group_places.some(
              (v) => v.campaign_id === campaign && v.place_id === placeId && Number(v.group_number) === group && !v.undone && tables.expeditions.some((x) => x.id === v.expedition_id && !x.undone),
            );
          const known =
            !!far ||
            (!!farLocation &&
              !farHidden &&
              tables.places.some(
                (q) =>
                  q.campaign_id === campaign && q.pack_id === here.pack_id && q.pack_entry_id && !q.undone && beenAt(q.id) &&
                  fakeChain(q.pack_id, q.pack_entry_id).some((c, depth) =>
                    farContainer === '' ? depth === 0 && containerOf(c) === '' && !hidesContainer(c) : farContainer === c.pack_entry_id || farContainer === containerOf(c),
                  ),
              ));
          const farKey = (farLocation?.data as Row | undefined)?.key;
          const number = known && !farHidden && typeof farKey === 'string' ? farKey.trim().slice(0, 200) || null : null;
          // #122's ⚑ 1: the Area's players' name, only one given for players, only when the way does not lead elsewhere,
          // and only for an Area or a place the group has itself explored.
          const areaPlace = tables.places.find((a) => a.campaign_id === campaign && a.pack_id === here.pack_id && a.pack_entry_id === farContainer && !a.undone);
          const areaEntry = tables.library_entries.find((e) => e.pack_id === here.pack_id && e.kind === 'location' && e.pack_entry_id === farContainer);
          const packAreaName = ((areaEntry?.data as Row | undefined)?.playerView as Row | undefined)?.name;
          const areaType = (areaEntry?.data as Row | undefined)?.type;
          const nameable = (typeof areaType === 'string' && areaType.trim() === 'area') || (!!areaPlace && shownToGroup(areaPlace.id));
          const areaName =
            known && farContainer !== '' && nameable
              ? (typeof areaPlace?.players_name === 'string' && areaPlace.players_name.trim()) || (typeof packAreaName === 'string' && packAreaName.trim().slice(0, 200)) || null
              : null;
          rows.push({ group_number: group, route_id: r.id, to_place_id: far?.id ?? null, to_name: far ? far.players_name || far.name : null, ways, to_number: number, elsewhere: !known, to_area_name: areaName });
        }
      }
      rows.sort((a, b) => Number(a.group_number) - Number(b.group_number) || String(a.route_id).localeCompare(String(b.route_id)));
      return { data: rows, error: null };
    },
    // What we know: the places shown to the reader's groups across the campaign, the current expedition's first.
    known_places_campaign: ({ campaign, as_player }) => {
      const rows: Row[] = [];
      const readsGroup = (group: number) =>
        as_player == null ? inMyGroup(campaign, group) : activeIn(campaign).some((a) => a.owner_user_id === readerAs(campaign, as_player) && groupNumberOf(a.id) === group);
      for (const gp of tables.group_places) {
        if (gp.campaign_id !== campaign || gp.undone || !readsGroup(Number(gp.group_number))) continue;
        const x = tables.expeditions.find((e) => e.id === gp.expedition_id && !e.undone);
        const place = tables.places.find((p) => p.id === gp.place_id && !p.undone);
        if (!x || !place) continue;
        for (const s of tables.piece_shows) {
          const pc = s.group_place_id === gp.id && s.shown === true && !s.undone ? tables.place_pieces.find((p) => p.id === s.piece_id && !p.undone) : undefined;
          if (!pc) continue;
          rows.push({
            expedition_id: x.id, current: x.ended_at === null, expedition_started: x.started_at, visit_id: gp.id, group_number: gp.group_number, place_id: place.id, place_name: place.players_name || place.name,
            visited_at: gp.created_at, piece_id: pc.id, kind: pc.kind, body: plainText(String(pc.body)), lead: pc.lead == null ? null : plainText(String(pc.lead)), _x: x.created_at, _s: s.shown_at, _sid: s.id,
          });
        }
      }
      const by = (k: string, r: Row) => String(r[k] ?? '');
      rows.sort(
        (p, q) =>
          Number(q.current) - Number(p.current) || by('_x', q).localeCompare(by('_x', p)) || by('visited_at', p).localeCompare(by('visited_at', q)) || by('visit_id', p).localeCompare(by('visit_id', q)) ||
          by('_s', p).localeCompare(by('_s', q)) || by('_sid', p).localeCompare(by('_sid', q)),
      );
      return { data: rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_')))), error: null };
    },
  };
  // Like the database (supabase/migrations/…_dec_6b_purse_commands.sql): the purse commands. Who is asking is checked
  // first (refused as "not allowed", so a refusal never says what an unreadable purse holds); a purse never goes below
  // zero ("<Name> has <n> <coin>.", code GR422, with its detail); the same request sent again changes nothing.
  const purseOf = (campaign: unknown, actor: unknown, location: unknown): Row | undefined =>
    (actor ? 1 : 0) + (location ? 1 : 0) !== 1
      ? undefined
      : tables.purses.find((p) => p.campaign_id === campaign && (actor ? p.actor_id === actor : p.location_id === location));
  const actorOfPurse = (p: Row) => (p.actor_id ? tables.actors.find((a) => a.id === p.actor_id) : undefined);
  // An archived character's purse follows its pack: only the GM changes it (the lead, 2026-11-13).
  const ownsPurse = (p: Row) => !!p.actor_id && isMemberOf(p.campaign_id) && purseOwner(p) === me() && actorOfPurse(p)?.status !== 'archived' && actorOfPurse(p)?.approval === 'approved';
  const othersDraft = (p: Row) => {
    const actor = actorOfPurse(p);
    return !!actor && actor.approval === 'draft' && actor.owner_user_id !== me();
  };
  const mayReceiveCoin = (p: Row) => {
    if (p.location_id) return true;
    const actor = actorOfPurse(p);
    return actor?.approval === 'approved' && (actor.status !== 'archived' || isGmOf(p.campaign_id));
  };
  const isAmount = (coins: unknown): coins is Record<string, number> =>
    !!coins && typeof coins === 'object' && !Array.isArray(coins) && Object.keys(coins).length > 0 &&
    Object.entries(coins as Row).every(([key, n]) => key.length > 0 && key.length <= 40 && key.trim() === key && Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 999_999_999);
  /** The purse's coin after the change, or the refusal; checks every coin before changing any. */
  const changedCoins = (p: Row, coins: Record<string, number>, sign: 1 | -1): { coins: Row } | { refusal: Result } => {
    const held = { ...((p.coins ?? {}) as Record<string, number>) };
    const name = String(actorOfPurse(p)?.name ?? (p.location_id ? 'The stash' : 'That purse'));
    for (const key of Object.keys(coins).sort()) {
      const has = Number(held[key] ?? 0);
      const left = has + sign * coins[key]!;
      if (left < 0) {
        return { refusal: { data: null, error: { message: `${name} has ${has} ${key}.`, code: 'GR422', details: JSON.stringify({ name, coin: key, has }) } as never } };
      }
      if (left > 999_999_999) {
        return { refusal: { data: null, error: { message: `${name} can't hold more than 999,999,999 ${key}.`, code: 'GR423', details: JSON.stringify({ name, coin: key, most: 999_999_999 }) } as never } };
      }
      if (left === 0) delete held[key];
      else held[key] = left;
    }
    return { coins: held };
  };
  /** Like private.coin_counterpart: a move's line keeps the other side ("with:<character id>" or "with:stash"). */
  const movePurse = (p: Row, coins: Row, tag: Tag, other: Row) => writePurse(p, coins, tag, `with:${String(other.actor_id ?? 'stash')}`);
  /** Writes a purse and its line, the line named by the function and carrying the function's own words (never the header's). */
  const writePurse = (p: Row, coins: Row, tag: Tag, whatFor: string | null) => {
    const was = structuredClone(p);
    p.coins = coins;
    p.version = Number(p.version ?? 1) + 1;
    log('purses', was, structuredClone(p), tag ? { ...tag, whatFor } : null);
  };
  /** Like private.may_read_purse: the stash, any member; a character's, its owner, the GM (not another's draft), and anyone while Down or dead. */
  const mayReadPurseRow = (p: Row) => {
    if (!p.actor_id) return isMemberOf(p.campaign_id);
    if (isGmOf(p.campaign_id) && !othersDraft(p)) return true;
    return isMemberOf(p.campaign_id) && (purseOwner(p) === me() || isDownOrDeadIn(tables, actorOfPurse(p)));
  };
  /** Like private.begin_coin_action: the request must carry its id; the line is named by the function, not the header. */
  const coinAction = (tag: Tag, command: string): { tag: Tag } | { refusal: Result } =>
    tag?.requestId ? { tag: { ...tag, type: command } } : { refusal: plain('That change needs its request id. Try again from the app.') };
  /** Like private.campaign_coin_keys (K16b): the coins of the top rules set that names any (valueInBase a whole 1 or more). */
  const coinKeysOf = (campaign: unknown): string[] => {
    const sets = tables.campaign_packs
      .filter((cp) => cp.campaign_id === campaign)
      .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
      .flatMap((cp) => tables.library_entries.filter((e) => e.pack_id === cp.pack_id && e.kind === 'rulesSet').map((e) => ({ ...((e.data ?? {}) as Row), ...((tables.library_entry_secrets.find((s) => s.id === e.id)?.data ?? {}) as Row) })));
    for (const rules of [...sets].reverse()) {
      const keys = (Array.isArray(rules.currency) ? (rules.currency as Row[]) : [])
        .filter((c) => c && typeof c.key === 'string' && c.key.length >= 1 && c.key.length <= 40 && c.key === c.key.trim() && Number.isInteger(c.valueInBase) && Number(c.valueInBase) >= 1)
        .map((c) => String(c.key));
      if (keys.length > 0) return [...new Set(keys)];
    }
    return [];
  };
  /**
   * Like public.give_find (K16b, pk-12; …_dec_6_k16b_send_find.sql): the GM sends things and coin to a character or the
   * stash in one request, every line `find.give` with one ids-only reason; the shape checked first; the purse's line
   * read by its readers alone.
   */
  const giveFind = (args: Row, header: Tag): Result => {
    // Like the database: every character's and the stash's purse is there (the stand-in makes them on first read).
    withPurseRows();
    const campaign = args.campaign;
    if (!me() || !isGmOf(campaign)) return refused("You don't have permission to do that.");
    const to = (args.to_actor ?? null) as string | null;
    const stash = to ? null : tables.locations.find((l) => l.campaign_id === campaign && l.kind === 'stash');
    if (to && !tables.actors.some((a) => a.id === to && a.campaign_id === campaign && ['pc', 'hireling'].includes(String(a.kind ?? 'pc')) && a.approval === 'approved')) return refused("You don't have permission to do that.");
    if (!to && !stash) return plain('This campaign has no party stash.');
    if (!tables.places.some((p) => p.id === args.place && p.campaign_id === campaign && !p.undone)) return plain("That place isn't in this campaign.");
    const things = (args.things ?? []) as Row[];
    const rows = (args.rows ?? []) as unknown[];
    if (!Array.isArray(things) || things.length > 100) return plain('Send at most 100 things, as a list.');
    const coins = (args.coins ?? {}) as Row;
    if (typeof coins !== 'object' || Array.isArray(coins)) return plain('Say the coin as whole numbers, 0 or more.');
    const keys = coinKeysOf(campaign);
    const wanted: Record<string, number> = {};
    for (const [key, n] of Object.entries(coins)) {
      if (!keys.includes(key)) return plain(`${key} isn't a coin of this setting.`);
      if (!Number.isInteger(n) || Number(n) < 0 || Number(n) > 999_999_999) return plain('Say how many: a whole number, 0 or more.');
      if (Number(n) > 0) wanted[key] = Number(n);
    }
    if (!Array.isArray(rows) || rows.length > 25 || rows.some((r) => typeof r !== 'string' || !/^\d{1,4}:(thing|coin)$/.test(r))) return plain('Send at most 25 rows of a hoard at once.');
    for (const t of things) {
      const qty = t?.qty;
      if (!Number.isInteger(qty) || Number(qty) < 1 || Number(qty) > 100000) return plain('How many must be a whole number, 1 or more.');
      if (typeof t.libraryEntryId === 'string') {
        const entry = tables.library_entries.find((e) => e.id === t.libraryEntryId && e.kind === 'item');
        if (!entry || !tables.campaign_packs.some((cp) => cp.campaign_id === campaign && cp.pack_id === entry.pack_id)) return plain("That item isn't in this campaign's setting rules.");
      } else if (typeof t.name !== 'string' || t.name.trim().length < 1 || t.name.trim().length > 200) return plain('A thing needs its words or its item.');
    }
    if (things.length === 0 && Object.keys(wanted).length === 0) return plain('Choose something to send.');
    const action = coinAction(header, 'find.give');
    if ('refusal' in action) return action.refusal;
    const already = tables.events.filter((e) => e.request_id === action.tag?.requestId && e.type === 'find.give' && e.actor_user_id === me()).sort((x, y) => Number(x.seq) - Number(y.seq))[0];
    if (already) return { data: already.id, error: null };
    // Like the database (rp-4): the party's lines name who it went to, never the place or the rows; the GM's line does.
    const coin = Object.keys(wanted).length > 0 ? { coin: true } : {};
    const reason = JSON.stringify({ find: { to, ...coin } });
    const gmReason = JSON.stringify({ find: { to, placeId: args.place, ...coin, ...(rows.length > 0 ? { rows } : {}) } });
    if (gmReason.length > 500) return plain('Send at most 25 rows of a hoard at once.');
    const tag = action.tag ? { ...action.tag, whatFor: reason } : null;
    // Every check first, as the database does (its refusal rolls the request back): the purse and its new coin.
    const p = Object.keys(wanted).length > 0 ? purseOf(campaign, to, stash?.id ?? null) : null;
    if (Object.keys(wanted).length > 0 && !p) return refused("You don't have permission to do that.");
    const next = p ? changedCoins(p, wanted, 1) : null;
    if (next && 'refusal' in next) return next.refusal;
    for (const t of things) {
      const entry = typeof t.libraryEntryId === 'string' ? tables.library_entries.find((e) => e.id === t.libraryEntryId) : undefined;
      const data = (entry?.data ?? {}) as Row;
      const line: Row = {
        id: newId('find-line'), campaign_id: campaign, location_id: stash?.id ?? null, actor_id: to, library_entry_id: entry?.id ?? null,
        name: entry ? String(entry.name) : String(t.name).trim(), category: entry && typeof data.category === 'string' ? data.category : '', weight_coin: entry && Number.isInteger(data.weightCoin) ? data.weightCoin : null,
        slots: entry && Number.isInteger(data.slots) ? data.slots : null, stack: entry && Number.isInteger(data.stack) && Number(data.stack) >= 1 ? data.stack : 1, container_line_id: null, equipped: false, cost: '', notes: '',
        item_data: entry ? data : {}, source_pack_id: entry?.pack_id ?? null, source_entry_id: entry?.pack_entry_id ?? null, charges_left: null, charges_hidden: false, charges_used: 0,
        spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, qty: Number(t.qty), how_got: 'found',
        created_at: new Date().toISOString(), version: 1,
      };
      tables.inventory_lines.push(line);
      log('inventory_lines', null, structuredClone(line), tag);
    }
    if (p && next && !('refusal' in next)) writePurse(p, next.coins, action.tag, reason);
    // The GM's line (the stand-in keeps no known_items, so it records no item learned).
    nextSeq();
    tables.events.push({
      id: `event-${seq}`, seq, campaign_id: campaign, type: 'find.give', level: 'simple', actor_user_id: me(), target_table: 'places', target_id: args.place,
      before: null, after: { learned: [] }, fiat: false, reason: gmReason, reverts_event_id: null, audience: 'gm', owner_user_id: null, reveal_at: 'now',
      request_id: action.tag?.requestId ?? null, created_at: new Date().toISOString(),
    });
    const first = tables.events.filter((e) => e.request_id === action.tag?.requestId && e.type === 'find.give').sort((x, y) => Number(x.seq) - Number(y.seq))[0];
    return { data: first?.id ?? null, error: null };
  };
  /** Like public.undo_find (K16b): the GM's Undo of a send, whole, only while nothing it made has changed since. */
  const undoFind = (args: Row, header: Tag): Result => {
    withPurseRows();
    const picked = tables.events.find((e) => e.id === args.event_id);
    if (!picked || !isGmOf(picked.campaign_id)) return refused("You don't have permission to do that.");
    if (picked.type !== 'find.give' || !picked.request_id || picked.reverts_event_id) return plain("That can't be undone.");
    const action = coinAction(header, 'find.undo');
    if ('refusal' in action) return action.refusal;
    const sent = tables.events.filter((e) => e.campaign_id === picked.campaign_id && e.request_id === picked.request_id).sort((x, y) => Number(x.seq) - Number(y.seq));
    if (tables.events.some((r) => r.reverts_event_id && sent.some((e) => e.id === r.reverts_event_id))) return plain('That was already undone.');
    const made = sent.filter((e) => e.type === 'find.give' && e.target_table === 'inventory_lines' && e.before === null);
    for (const change of made) {
      const line = tables.inventory_lines.find((l) => l.id === change.target_id);
      const later = tables.events.some(
        (e) => e.campaign_id === picked.campaign_id && ['inventory_lines', 'inventory_line_secrets'].includes(String(e.target_table)) && e.target_id === change.target_id && Number(e.seq) > Number(change.seq) && e.request_id !== picked.request_id,
      );
      const holds = tables.inventory_lines.some((l) => l.container_line_id === change.target_id);
      if (!line || later || holds) return plain("That's changed since. Undo the later change first.");
    }
    const coinLine = sent.find((e) => e.type === 'find.give' && e.target_table === 'purses');
    const added: Record<string, number> = {};
    let purse: Row | undefined;
    if (coinLine) {
      const was = ((coinLine.before as Row | null)?.coins ?? {}) as Record<string, number>;
      const now = ((coinLine.after as Row | null)?.coins ?? {}) as Record<string, number>;
      for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
        const n = Number(now[key] ?? 0) - Number(was[key] ?? 0);
        if (n > 0) added[key] = n;
      }
      purse = tables.purses.find((p) => p.id === coinLine.target_id);
      const held = (purse?.coins ?? {}) as Record<string, number>;
      if (!purse || Object.entries(added).some(([key, n]) => Number(held[key] ?? 0) < n)) return plain("That's changed since. Undo the later change first.");
    }
    // Every check first, as the database does: the coin's return too, before any line is removed.
    const back = purse && coinLine && Object.keys(added).length > 0 ? changedCoins(purse, added, -1) : null;
    if (back && 'refusal' in back) return back.refusal;
    for (const change of made) {
      const line = tables.inventory_lines.find((l) => l.id === change.target_id)!;
      tables.inventory_lines = tables.inventory_lines.filter((l) => l.id !== line.id);
      log('inventory_lines', structuredClone(line), null, action.tag, change);
    }
    if (purse && coinLine && back) {
      const next = back;
      const was = structuredClone(purse);
      purse.coins = next.coins;
      purse.version = Number(purse.version ?? 1) + 1;
      log('purses', was, structuredClone(purse), action.tag, coinLine);
    }
    return { data: null, error: null };
  };
  const purseRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    give_find: giveFind,
    undo_find: undoFind,
    purse_add: (args, header) => {
      const p = purseOf(args.campaign, args.actor, args.location);
      if (!p || !isGmOf(p.campaign_id) || othersDraft(p)) return refused("You don't have permission to do that.");
      const action = coinAction(header, 'purse.add');
      if ('refusal' in action) return action.refusal;
      if (repeated(action.tag, p.id)) return { data: null, error: null };
      if (!isAmount(args.coins)) return plain('Say how many: a whole number, 1 or more.');
      const next = changedCoins(p, args.coins, 1);
      if ('refusal' in next) return next.refusal;
      writePurse(p, next.coins, action.tag, null);
      return { data: null, error: null };
    },
    purse_remove: (args, header) => {
      const p = purseOf(args.campaign, args.actor, args.location);
      if (!p || !isGmOf(p.campaign_id) || othersDraft(p)) return refused("You don't have permission to do that.");
      const action = coinAction(header, 'purse.remove');
      if ('refusal' in action) return action.refusal;
      if (repeated(action.tag, p.id)) return { data: null, error: null };
      if (!isAmount(args.coins)) return plain('Say how many: a whole number, 1 or more.');
      const next = changedCoins(p, args.coins, -1);
      if ('refusal' in next) return next.refusal;
      writePurse(p, next.coins, action.tag, null);
      return { data: null, error: null };
    },
    purse_spend: (args, header) => {
      const p = purseOf(args.campaign, args.actor, null);
      if (!p || !ownsPurse(p)) return refused("You don't have permission to do that.");
      const action = coinAction(header, 'purse.spend');
      if ('refusal' in action) return action.refusal;
      if (repeated(action.tag, p.id)) return { data: null, error: null };
      if (!isAmount(args.coins)) return plain('Say how many: a whole number, 1 or more.');
      const next = changedCoins(p, args.coins, -1);
      if ('refusal' in next) return next.refusal;
      // The words come from the function's argument, never from the request's header.
      writePurse(p, next.coins, action.tag, typeof args.what_for === 'string' ? args.what_for.trim().slice(0, 500) || null : null);
      return { data: null, error: null };
    },
    purse_give: (args, header) => {
      const from = purseOf(args.campaign, args.from_actor, null);
      const to = purseOf(args.campaign, args.to_actor, args.to_location);
      if (!from || !to || from === to || !ownsPurse(from) || !mayReceiveCoin(to)) return refused("You don't have permission to do that.");
      const action = coinAction(header, 'purse.give');
      if ('refusal' in action) return action.refusal;
      if (repeated(action.tag, from.id) || repeated(action.tag, to.id)) return { data: null, error: null };
      if (!isAmount(args.coins)) return plain('Say how many: a whole number, 1 or more.');
      const out = changedCoins(from, args.coins, -1);
      if ('refusal' in out) return out.refusal;
      const into = changedCoins(to, args.coins, 1);
      if ('refusal' in into) {
        // Like the database (the lead, 2026-11-13): to a giver who can't read the receiver's purse, nothing of it.
        return mayReadPurseRow(to) ? into.refusal : { data: null, error: { message: "That give didn't go through. Nothing changed.", code: 'GR424' } as never };
      }
      movePurse(from, out.coins, action.tag, to);
      movePurse(to, into.coins, action.tag, from);
      return { data: null, error: null };
    },
    purse_take: (args, header) => {
      const from = purseOf(args.campaign, args.from_actor, args.from_location);
      const to = purseOf(args.campaign, args.to_actor, null);
      const allowed =
        !!from && !!to && from !== to && mayReceiveCoin(to) &&
        ((isGmOf(args.campaign) && !othersDraft(from)) || (ownsPurse(to) && (!!from.location_id || isDownOrDeadIn(tables, actorOfPurse(from)))));
      if (!allowed) return refused("You don't have permission to do that.");
      const action = coinAction(header, 'purse.take');
      if ('refusal' in action) return action.refusal;
      if (repeated(action.tag, from.id) || repeated(action.tag, to.id)) return { data: null, error: null };
      if (!isAmount(args.coins)) return plain('Say how many: a whole number, 1 or more.');
      const out = changedCoins(from, args.coins, -1);
      if ('refusal' in out) return out.refusal;
      const into = changedCoins(to, args.coins, 1);
      if ('refusal' in into) return into.refusal;
      movePurse(from, out.coins, action.tag, to);
      movePurse(to, into.coins, action.tag, from);
      return { data: null, error: null };
    },
  };
  const rpcs: Record<string, (args: Row) => Result> = {
    ...companyRpcs,
    ...ruleRpcs,
    // Like the database (ruled 2026-10-29, A4): the GM gets every exception; a player only those for player-facing
    // entries (the fake doesn't model which items a player may read).
    campaign_exceptions: ({ campaign }) => {
      if (!isMemberOf(campaign)) return { data: [], error: null };
      withSecretsRows();
      const gm = isGmOf(campaign);
      return {
        data: tables.campaign_pack_secrets
          .filter((row) => row.campaign_id === campaign)
          .map((row) => ({
            id: row.id,
            overrides: gm
              ? row.overrides
              : Object.fromEntries(Object.entries((row.overrides ?? {}) as Row).filter(([key]) => PLAYER_FACING.includes(key.split(':')[0] as EntryKind))),
          })),
        error: null,
      };
    },
    // Like public.campaign_library (hd-2, …_dec_hd2_ways_on_read.sql): the entries of the campaign's packs as the
    // reader may see them in THIS campaign: the GM all of them; another member the player-facing ones (a patch's
    // items judged by this campaign's packs alone) and the tables a pack opens; nobody else anything. The readable
    // part only. (The fake doesn't model which items a campaign has opened: a member reads every item of its packs.)
    campaign_library: ({ campaign, packs, after_id, page_size }) => {
      if (!isMemberOf(campaign)) return { data: [], error: null };
      const gm = isGmOf(campaign);
      const attached = tables.campaign_packs
        .filter((cp) => cp.campaign_id === campaign && (!Array.isArray(packs) || packs.includes(cp.pack_id)))
        .map((cp) => cp.pack_id);
      return {
        data: tables.library_entries
          .filter(
            (e) =>
              attached.includes(e.pack_id) &&
              (gm ||
                playerFacingEntry(String(e.kind), e.data, e.kind === 'patch' ? patchTargetsIn(tables, e.pack_id, (c) => c === campaign) : undefined) ||
                // rm-3 (…_dec_12e_rumours_gm_only.sql): never a rumours table, whatever its pack says.
                (e.kind === 'table' && (e.data as Row | undefined)?.gmOnly === false && !rumoursTable((e.data ?? {}) as Record<string, unknown>))),
          )
          // The row's own data, not a copy, as a read of the table gives it here (tests change an entry in place).
          .map((e) => ({ id: e.id, pack_id: e.pack_id, kind: e.kind, pack_entry_id: e.pack_entry_id, name: e.name, data: e.data }))
          // A page by key: in id order, after `after_id`, at most `page_size` (1 to 1000).
          .sort((x, y) => (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0))
          .filter((e) => typeof after_id !== 'string' || String(e.id) > after_id)
          .slice(0, Math.min(Math.max(typeof page_size === 'number' ? page_size : 1000, 1), 1000)),
        error: null,
      };
    },
    // Like the database (M5 calendar follow-ups): members read the calendars' readable part, with whether the GM's
    // exception prefers each one.
    campaign_calendars: ({ campaign }) => {
      if (!isMemberOf(campaign)) return { data: [], error: null };
      withSecretsRows();
      const links = tables.campaign_packs.filter((cp) => cp.campaign_id === campaign);
      return {
        data: links.flatMap((cp) =>
          tables.library_entries
            .filter((e) => e.pack_id === cp.pack_id && e.kind === 'calendar')
            .map((e) => {
              const key = `calendar:${String(e.pack_entry_id)}`;
              const secret = tables.campaign_pack_secrets.find((s) => s.id === cp.id);
              return {
                id: e.id,
                pack_id: e.pack_id,
                pack_entry_id: e.pack_entry_id,
                name: e.name,
                data: structuredClone(e.data),
                preferred: key in ((cp.overrides ?? {}) as Row) || key in ((secret?.overrides ?? {}) as Row),
              };
            }),
        ),
        error: null,
      };
    },
    create_campaign: ({ campaign_name }) => {
      const name = String(campaign_name).trim();
      const user = me();
      if (!user) return { data: null, error: { message: 'Sign in first.', code: '42501' } };
      if (!name) return { data: null, error: { message: 'Give the campaign a name.' } };
      return { data: addCampaign(name, user), error: null };
    },
    peek_invite: ({ invite_code }) => {
      const user = me();
      if (!user) return { data: null, error: { message: 'Sign in first.', code: '42501' } };
      const invite = validInvite(String(invite_code));
      if (!invite) return { data: [], error: null };
      const campaign = tables.campaigns.find((c) => c.id === invite.campaign_id);
      const gm = tables.members.find((m) => m.campaign_id === invite.campaign_id && m.base_role === 'gm');
      const gmProfile = tables.profiles.find((p) => p.id === gm?.user_id);
      const alreadyMember = tables.members.some((m) => m.campaign_id === invite.campaign_id && m.user_id === user);
      return {
        data: [
          {
            campaign_id: invite.campaign_id,
            campaign_name: campaign?.name,
            gm_name: gmProfile?.display_name ?? 'your GM',
            already_member: alreadyMember,
          },
        ],
        error: null,
      };
    },
    redeem_invite: ({ invite_code }) => {
      const user = me();
      if (!user) return { data: null, error: { message: 'Sign in first.', code: '42501' } };
      const invite = validInvite(String(invite_code));
      if (!invite) {
        return { data: null, error: { message: "This invite code isn't valid or has expired. Ask your GM for a new one." } };
      }
      const campaignId = String(invite.campaign_id);
      // Like the database: nobody joins a retired campaign.
      if (tables.campaigns.some((c) => c.id === campaignId && c.retired_at)) return { data: null, error: { message: RETIRED } };
      if (!tables.members.some((m) => m.campaign_id === campaignId && m.user_id === user)) {
        addMember(campaignId, user, 'player');
        invite.status = 'accepted';
      }
      return { data: campaignId, error: null };
    },
  };

  // Like public.join_added_line and public.move_into_stack (Q2, sw-1 to sw-9): a stackable thing joins a same-name stack
  // in the same place, counted in one step; null when nothing joined (the command then goes on as before).
  const stackName = (name: unknown) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const sameStackName = (a: unknown, b: unknown) => {
    const [x, y] = [stackName(a), stackName(b)];
    const ies = (one: string, other: string) => /[^aeiou]y$/.test(one) && `${one.slice(0, -1)}ies` === other;
    return x !== '' && (x === y || `${x}s` === y || `${y}s` === x || `${x}es` === y || `${y}es` === x || ies(x, y) || ies(y, x));
  };
  const stackJoinable = (l: Row, moving = false) =>
    l.approval === 'approved' &&
    (moving || !l.equipped) &&
    !l.given_to &&
    !l.charges_hidden &&
    (l.charges_left ?? null) === null &&
    Number(l.charges_used ?? 0) === 0 &&
    !(l.item_data && typeof l.item_data === 'object' && 'charges' in (l.item_data as Row)) &&
    !l.needs_fuel &&
    (l.fuel_left_seconds ?? null) === null &&
    !tables.character_lights.some((c) => c.line_id === l.id && ((c.lit_at ?? null) !== null || (c.left_seconds ?? null) !== null));
  const mayChangeCarrierOf = (campaign: unknown, actor: unknown, location: unknown) =>
    isGmOf(campaign) ||
    (isMemberOf(campaign) &&
      (tables.locations.some((l) => l.id === location && l.campaign_id === campaign) ||
        tables.actors.some((a) => a.id === actor && a.campaign_id === campaign && a.owner_user_id === me() && a.status !== 'archived')));
  const mayReceiveAt = (campaign: unknown, actor: unknown, location: unknown) =>
    isMemberOf(campaign) &&
    (tables.locations.some((l) => l.id === location && l.campaign_id === campaign) ||
      tables.actors.some((a) => a.id === actor && a.campaign_id === campaign && (isGmOf(campaign) || ((a.approval ?? 'approved') === 'approved' && a.status !== 'archived'))));
  const joinDone = (tag: Tag): { done: boolean; line: unknown } => {
    if (!tag?.requestId) return { done: false, line: null };
    const earlier = tables.events.filter((e) => e.request_id === tag.requestId && e.actor_user_id === me());
    const joined = earlier.find((e) => e.target_table === 'inventory_lines' && isJoin(String(e.type), { before: e.before, after: e.after }));
    return { done: earlier.length > 0, line: joined?.target_id ?? null };
  };
  const stackAt = (campaign: unknown, actor: unknown, location: unknown, container: unknown, name: unknown, inNumbers: boolean, not: unknown = null) =>
    tables.inventory_lines.find(
      (l) =>
        l.campaign_id === campaign &&
        (l.actor_id ?? null) === (actor ?? null) &&
        (l.location_id ?? null) === (location ?? null) &&
        (l.container_line_id ?? null) === (container ?? null) &&
        l.id !== not &&
        sameStackName(l.name, name) &&
        // Only things carried in numbers (sw-10): several to a slot, or a bundle's units.
        (Number(l.stack) > 1 || Number(l.per_units ?? 1) > 1) &&
        inNumbers &&
        stackJoinable(l) &&
        (actor === null || actor === undefined || tables.actors.some((a) => a.id === actor && (a.approval ?? 'approved') === 'approved')),
    );
  const countOn = (line: Row, qty: number, tag: Parameters<EventLog>[3]) => {
    const was = structuredClone(line);
    line.qty = qty;
    line.version = Number(line.version ?? 1) + 1;
    line.updated_at = new Date(Date.now() + nextId).toISOString();
    log('inventory_lines', was, structuredClone(line), tag);
  };
  const joinRpcs: Record<string, (args: Row, tag: Tag) => Result> = {
    join_added_line: (args, tag) => {
      const done = joinDone(tag);
      if (done.done) return { data: done.line, error: null };
      const howMany = Number(args.how_many);
      const howGot = typeof args.how_got === 'string' ? args.how_got : 'found';
      if (!['bought', 'found', 'given'].includes(howGot) || (howGot === 'given' && !isGmOf(args.campaign))) return { data: null, error: null };
      if (!Number.isInteger(howMany) || howMany < 1 || !args.entry || tables.inventory_lines.some((l) => l.id === args.made_id)) return { data: null, error: null };
      if (!mayChangeCarrierOf(args.campaign, args.actor, args.location)) return { data: null, error: null };
      const entry = tables.library_entries.find((e) => e.id === args.entry);
      const data = (entry?.data ?? {}) as Row;
      const used = !!entry && tables.campaign_packs.some((cp) => cp.campaign_id === args.campaign && cp.pack_id === entry.pack_id);
      if (!entry || entry.kind !== 'item' || !used || 'charges' in data) return { data: null, error: null };
      const bundled = typeof data.bundle === 'number' && data.bundle > 1;
      const name = bundled && typeof data.unitName === 'string' && data.unitName.trim() ? data.unitName : entry.name;
      const stack = typeof data.stack === 'number' && Number.isInteger(data.stack) ? data.stack : 1;
      const target = stackAt(args.campaign, args.actor ?? null, args.location ?? null, args.container ?? null, name, stack > 1 || bundled);
      if (!target) return { data: null, error: null };
      // How it was got stays on the add's own line (its reason), never on the stack.
      const words = (v: unknown, most: number) => (typeof v === 'string' ? v.trim().slice(0, most) : '');
      const reason = JSON.stringify({ join: { howGot, cost: howGot === 'bought' ? words(args.cost, 100) : '', note: words(args.note, 300) } });
      countOn(target, Number(target.qty) + howMany, tag ? { ...tag, whatFor: reason } : tag);
      return { data: target.id, error: null };
    },
    move_into_stack: (args, tag) => {
      const done = joinDone(tag);
      if (done.done) return { data: done.line, error: null };
      const source = tables.inventory_lines.find((l) => l.id === args.line);
      const howMany = Number(args.how_many);
      if (!source || !Number.isInteger(howMany) || howMany < 1 || howMany > Number(source.qty)) return { data: null, error: null };
      if (args.seen_version !== undefined && args.seen_version !== null && args.seen_version !== source.version) return { data: null, error: null };
      if (!mayChangeCarrierOf(source.campaign_id, source.actor_id, source.location_id) || !mayReceiveAt(source.campaign_id, args.to_actor, args.to_location)) return { data: null, error: null };
      if ((!source.library_entry_id && !source.source_pack_id) || !stackJoinable(source, true) || tables.inventory_lines.some((l) => l.container_line_id === source.id)) {
        return { data: null, error: null };
      }
      const inNumbers = Number(source.stack) > 1 || Number(source.per_units ?? 1) > 1;
      const target = stackAt(source.campaign_id, args.to_actor ?? null, args.to_location ?? null, args.to_container ?? null, source.name, inNumbers, source.id);
      if (!target) return { data: null, error: null };
      if (howMany < Number(source.qty)) countOn(source, Number(source.qty) - howMany, tag);
      countOn(target, Number(target.qty) + howMany, tag);
      if (howMany === Number(source.qty)) {
        const was = structuredClone(source);
        tables.inventory_lines.splice(tables.inventory_lines.indexOf(source), 1);
        log('inventory_lines', was, null, tag);
      }
      return { data: target.id, error: null };
    },
  };

  // Like split_inventory_line: the rest stays, and the copy keeps everything the line says, in one step.
  async function splitLine(lineId: string, howMany: number, tag: string | null, seenVersion?: number): Promise<Result> {
    const tagged = (table: keyof FakeWorld['tables']) => {
      const query = db.from(table);
      if (tag) query.headers.set('x-grimoire-command', tag);
      return query;
    };
    const found = (await tagged('inventory_lines').select('*').eq('id', lineId)) as Result;
    const source = (Array.isArray(found.data) ? found.data[0] : null) as Row | null | undefined;
    if (!source) return { data: null, error: { message: "That item isn't there any more." } };
    if (seenVersion !== undefined && source.version !== seenVersion) return { data: null, error: { message: STALE, code: STALE_CODE } };
    const qty = Number(source.qty);
    if (!Number.isInteger(howMany) || howMany < 1 || howMany >= qty) return { data: null, error: { message: `How many must be a whole number from 1 to ${qty - 1}.` } };
    const left = (await tagged('inventory_lines').update({ qty: qty - howMany }).eq('id', lineId).select('id')) as Result;
    if (left.error) return left;
    // Like grimoire.splitting in the database: the part split off keeps the stack's approval (ruled 2026-10-29).
    splittingLine = source;
    const made = (await tagged('inventory_lines')
      .insert({
        campaign_id: source.campaign_id,
        actor_id: source.actor_id,
        location_id: source.location_id,
        library_entry_id: null,
        name: source.name,
        category: source.category,
        weight_coin: source.weight_coin,
        slots: source.slots,
        stack: source.stack,
        per_units: source.per_units,
        qty: howMany,
        how_got: source.how_got === 'given' && !isGmOf(source.campaign_id) ? 'found' : source.how_got,
        cost: source.cost,
        notes: source.notes,
        item_data: source.item_data,
        source_pack_id: source.source_pack_id,
        source_entry_id: source.source_entry_id,
        charges_hidden: source.charges_hidden,
      })
      .select('id')) as Result;
    splittingLine = null;
    if (made.error) return made;
    const row = (Array.isArray(made.data) ? made.data[0] : made.data) as Row;
    return { data: row.id, error: null };
  }

  // Like cast_spell (dec-8 piece A): one casting of a ready spell spent (1) or given back (-1), never more than the
  // times it is ready nor below 0; the owner of an approved character or the GM (private.may_play).
  async function castSpellRpc(args: Row, tag: string | null): Promise<Result> {
    const spell = String(args.spell ?? '');
    const level = Number(args.spell_level);
    const change = Number(args.change);
    if (!spell || spell.length > 200) return { data: null, error: { message: 'Which spell?' } };
    if (!Number.isInteger(level) || level < 0 || level > 99) return { data: null, error: { message: 'Which spell level?' } };
    if (change !== 1 && change !== -1) return { data: null, error: { message: 'A spell is cast, or given back, one at a time.' } };
    const actor = tables.actors.find((a) => a.id === args.actor);
    const member = !!actor && tables.members.some((m) => m.campaign_id === actor.campaign_id && m.user_id === me());
    if (!actor || (actor.approval ?? 'approved') !== 'approved' || !(isGmOf(actor.campaign_id) || (member && actor.owner_user_id === me()))) return refused("You don't have permission to do that.");
    const found = tables.character_play.find((p) => p.actor_id === actor.id);
    const ready = Array.isArray(found?.prepared) ? (found.prepared as { spell?: unknown; level?: unknown }[]) : [];
    const times = ready.filter((p) => p.spell === spell && p.level === level).length;
    if (times === 0) return { data: null, error: { message: "That spell isn't ready." } };
    const key = `${level}:${spell}`;
    const spent = { ...((found?.spells_cast as Record<string, number> | undefined) ?? {}) };
    const now = Math.min(spent[key] ?? 0, times) + change;
    if (now > times) return { data: null, error: { message: 'Every casting of that spell is spent.' } };
    if (now < 0) return { data: null, error: { message: "That spell hasn't been cast." } };
    if (now === 0) delete spent[key];
    else spent[key] = now;
    const query = db.from('character_play');
    if (tag) query.headers.set('x-grimoire-command', tag);
    const saved = (await query.upsert({ actor_id: actor.id, campaign_id: actor.campaign_id, spells_cast: spent }).select('spells_cast')) as Result;
    if (saved.error) return saved;
    return { data: spent, error: null };
  }

  // Like set_spells (dec-8 piece A): the GM alone sets what is ready, chosen and cast.
  async function setSpellsRpc(args: Row, tag: string | null): Promise<Result> {
    const actor = tables.actors.find((a) => a.id === args.actor);
    if (!actor || !isGmOf(actor.campaign_id)) return refused("Only the GM can change someone's spells this way.");
    const given = args.new_cast as Record<string, unknown> | null | undefined;
    if (given && Object.values(given).some((n) => !Number.isInteger(n) || (n as number) < 0 || (n as number) > 999)) {
      return { data: null, error: { message: 'A count of casts must be a whole number, 0 or more.' } };
    }
    // Casts kept: given, or today's; trimmed to the new ready set.
    const ready = Array.isArray(args.new_ready) ? (args.new_ready as { spell?: unknown; level?: unknown }[]) : [];
    const source = (given ?? tables.character_play.find((p) => p.actor_id === actor.id)?.spells_cast ?? {}) as Record<string, number>;
    const kept = Object.fromEntries(
      Object.entries(source).flatMap(([key, n]) => {
        const most = Math.min(n, ready.filter((r) => `${String(r.level)}:${String(r.spell)}` === key).length);
        return most > 0 ? [[key, most]] : [];
      }),
    );
    const query = db.from('character_play');
    if (tag) query.headers.set('x-grimoire-command', tag);
    const saved = (await query
      .upsert({ actor_id: actor.id, campaign_id: actor.campaign_id, prepared: args.new_ready, chosen: args.new_chosen ?? null, spells_cast: kept, rested_once: true })
      .select('actor_id')) as Result;
    return saved.error ? saved : { data: null, error: null };
  }

  // Like use_ability: only this ability's count changes (0 removes it), through the character_play rules.
  async function markAbilityUse(args: Row, tag: string | null): Promise<Result> {
    const ability = String(args.ability ?? '');
    const spent = Number(args.spent);
    if (!ability || ability.length > 200) return { data: null, error: { message: 'Which ability?' } };
    if (!Number.isInteger(spent) || spent < 0) return { data: null, error: { message: 'Uses spent must be a whole number, 0 or more.' } };
    const actor = tables.actors.find((a) => a.id === args.actor);
    if (!actor) return refused("You don't have permission to do that.");
    const found = tables.character_play.find((p) => p.actor_id === actor.id);
    const next: Record<string, number> = { ...((found?.uses_spent as Record<string, number> | undefined) ?? {}), [ability]: spent };
    if (spent === 0) delete next[ability];
    const query = db.from('character_play');
    if (tag) query.headers.set('x-grimoire-command', tag);
    const saved = (await query.upsert({ actor_id: actor.id, campaign_id: actor.campaign_id, uses_spent: next }).select('uses_spent')) as Result;
    if (saved.error) return saved;
    return { data: next, error: null };
  }

  const db = {
    auth: {
      onAuthStateChange(callback: (event: string, value: typeof session) => void) {
        listeners.add(callback);
        queueMicrotask(() => callback('INITIAL_SESSION', session));
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
      async getUser() {
        return { data: { user: session?.user ?? null }, error: null };
      },
      async signInWithOtp({ email }: { email: string }) {
        codesSentTo.push(email);
        return { data: {}, error: null };
      },
      async verifyOtp({ email, token }: { email: string; token: string }) {
        if (token !== FAKE_EMAIL_CODE) return { data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } };
        setSession(people.get(email) ?? addPerson(email), 'SIGNED_IN');
        return { data: {}, error: null };
      },
      async getSession() {
        return { data: { session }, error: null };
      },
      async signOut(options?: { scope?: string }) {
        signOutCalls.push(options ?? {});
        setSession(null, 'SIGNED_OUT');
        return { error: null };
      },
    },
    from: (table: keyof FakeWorld['tables']) => {
      if (table === 'campaign_pack_secrets') withSecretsRows();
      if (table === 'character_lights') withLightRows();
      if (table === 'purses') withPurseRows();
      if (table === 'marching_orders') withMarchingRows();
      if (table === 'party_groups' || table === 'party_group_members') withGroupRows();
      if (table === 'character_rests') withRestRows();
      return new Query(tables, table, me, newInvite, log, splitHidden);
    },
    channel: () => {
      const watcher = { campaignId: '', onNew: () => {}, me: me() };
      const channel = {
        on(_kind: string, options: { filter?: string }, onNew: () => void) {
          watcher.campaignId = options.filter?.replace('campaign_id=eq.', '') ?? '';
          watcher.onNew = onNew;
          return channel;
        },
        subscribe(onStatus?: (status: string) => void) {
          watchers.add(watcher);
          queueMicrotask(() => onStatus?.('SUBSCRIBED'));
          return channel;
        },
        watcher,
      };
      return channel;
    },
    removeChannel: async (channel: { watcher: unknown }) => {
      watchers.delete(channel.watcher as never);
      return 'ok';
    },
    rpc: (name: string, args: Row) => {
      let tag: string | null = null;
      const call = {
        setHeader(_name: string, value: string) {
          tag = value;
          return call;
        },
        then<A, B = never>(onDone?: (value: Result) => A, onFail?: (reason: unknown) => B) {
          const run = () => {
            const headers = new Headers(tag ? { 'x-grimoire-command': tag } : {});
            if (name === 'undo_request' || name === 'undo_request_said') return undo(String(args.event_id), readTag(headers));
            if (name === 'import_pack') return importPack(args);
            if (name === 'split_inventory_line') return splitLine(String(args.line), Number(args.how_many), tag, args.seen_version as number | undefined);
            if (name === 'use_ability') return markAbilityUse(args, tag);
            if (name === 'cast_spell') return castSpellRpc(args, tag);
            if (name === 'set_spells') return setSpellsRpc(args, tag);
            if (name in clockRpcs) return clockRpcs[name]!(args, readTag(headers));
            if (name in lightRpcs) return lightRpcs[name]!(args, readTag(headers));
            if (name in k22Rpcs) return k22Rpcs[name]!(args, readTag(headers));
            if (name in joinRpcs) return joinRpcs[name]!(args, readTag(headers));
            if (name in weatherRpcs) return weatherRpcs[name]!(args, readTag(headers));
            if (name in marchingRpcs) return marchingRpcs[name]!(args, readTag(headers));
            if (name in groupRpcs) return groupRpcs[name]!(args, readTag(headers));
            if (name in campRpcs) return campRpcs[name]!(args, readTag(headers));
            if (name in statusRpcs) return statusRpcs[name]!(args, readTag(headers));
            if (name in purseRpcs) return purseRpcs[name]!(args, readTag(headers));
            return rpcs[name]?.(args) ?? { data: null, error: { message: `No fake for ${name}` } };
          };
          return Promise.resolve().then(run).then(onDone, onFail);
        },
      };
      return call;
    },
    storage: {
      // Like the buckets' rules: campaign-files follow the assets table; message-files (M5b g4) follow the message
      // (the GM who sent it uploads once; its two parties read while the message is readable; 10 MB a file).
      from: (bucket?: string) => ({
        // A pack's pictures (B14), like the bucket's rules: <pack id>/<map id>, written by the pack's owner; read by the
        // owner and by the GM of a campaign that uses the pack; never by a player.
        async list(folder: string, options?: { search?: string }) {
          const pack = tables.packs.find((p) => p.id === folder);
          const may = bucket === 'pack-files' && !!pack && (pack.owner_user_id === me() || tables.campaign_packs.some((cp) => cp.pack_id === folder && isGmOf(cp.campaign_id)));
          const prefix = `pack-files/${folder}/`;
          const names = may ? [...files.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)) : [];
          return { data: names.filter((name) => name.includes(options?.search ?? '')).map((name) => ({ name })), error: null };
        },
        async download(path: string) {
          const listed = await this.list(path.split('/')[0] ?? '');
          const blob = listed.data.some((file) => file.name === path.split('/')[1]) ? files.get(`pack-files/${path}`) : undefined;
          return blob ? { data: blob, error: null } : { data: null, error: { message: 'Object not found' } };
        },
        async upload(path: string, blob: Blob) {
          if (bucket === 'pack-files') {
            const pack = tables.packs.find((p) => p.id === path.split('/')[0]);
            if (!pack || pack.owner_user_id !== me() || path.split('/').length !== 2) return { data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } };
            files.set(`pack-files/${path}`, blob);
            return { data: { path }, error: null };
          }
          if (bucket === 'message-files') {
            const message = tables.messages.find((m) => `${String(m.campaign_id)}/${String(m.id)}` === path);
            const may = !!message && message.from_gm === true && message.sender_user_id === me() && isGmOf(message.campaign_id) && message.attachment_name !== null && !message.undone;
            if (!may) return { data: null, error: { message: 'new row violates row-level security policy' } };
            if (blob.size > 10 * 1024 * 1024) return { data: null, error: { message: 'The object exceeded the maximum allowed size' } };
            if (files.has(`message-files/${path}`)) return { data: null, error: { message: 'The resource already exists' } };
            files.set(`message-files/${path}`, blob);
            return { data: { path }, error: null };
          }
          if (!mayWrite(path)) return { data: null, error: { message: 'new row violates row-level security policy' } };
          files.set(path, blob);
          return { data: { path }, error: null };
        },
        async remove(paths: string[]) {
          const removed = paths.filter((path) => mayWrite(path) && files.delete(path));
          return { data: removed.map((name) => ({ name })), error: null };
        },
        async createSignedUrls(paths: string[]) {
          if (bucket === 'message-files') {
            const visible = (path: string) => {
              const m = tables.messages.find((row) => `${String(row.campaign_id)}/${String(row.id)}` === path);
              if (!m || m.undone || !files.has(`message-files/${path}`) || !isMemberOf(m.campaign_id)) return false;
              if (!(isGmOf(m.campaign_id) || m.player_user_id === me())) return false;
              const recipientIsMe = m.from_gm ? m.player_user_id === me() : isGmOf(m.campaign_id);
              return !(m.disappears && m.read_at !== null && recipientIsMe);
            };
            return {
              data: paths.map((path) => (visible(path) ? { path, signedUrl: `https://files.example/message-files/${path}?signed`, error: null } : { path, signedUrl: '', error: 'Object not found' })),
              error: null,
            };
          }
          return {
            data: paths.map((path) => {
              const asset = assetAt(path);
              // A place's picture: the GM's, and a player's only while the place is shown to their group.
              const visible =
                !!asset &&
                files.has(path) &&
                (isGmOf(asset.campaign_id) ||
                  (isMemberOf(asset.campaign_id) && (asset.kind !== 'place' || shownPlacePictures(asset.campaign_id).some((p) => p.assetId === asset.id))));
              return visible
                ? { path, signedUrl: `https://files.example/${path}?signed`, error: null }
                : { path, signedUrl: '', error: 'Object not found' };
            }),
            error: null,
          };
        },
      }),
    },
  };

  return {
    db: db as unknown as Db,
    tables,
    files,
    codesSentTo,
    addPerson,
    addCampaign,
    addMember,
    addCharacter,
    addInvite,
    signInAs: (userId) => {
      session = { user: { id: userId } };
    },
    signOutCalls,
    emitAuthEvent: (event, userId) => {
      for (const listener of listeners) listener(event, userId ? { user: { id: userId } } : null);
    },
    loseStoredSession: () => {
      session = null;
    },
  };
}

let createdOrder = 0;

/**
 * Like private.patch_open_to_me / private.patch_open_to_all (look-back review of #437, 2026-11-10): what a patch's
 * targets say about who reads it. Items: the fake database lets a member read every item of a pack their campaign
 * uses, so an item counts as readable when a pack attached in a campaign that attaches the patch's pack (one of
 * `counts`) has it. Hidden fields: the keys kept apart (library_entry_secrets) of every entry the patch may match, in
 * the patch's pack and every pack attached alongside it in any campaign.
 */
function patchTargetsIn(tables: FakeWorld['tables'], packId: unknown, counts: (campaignId: unknown) => boolean): PatchTargets {
  const campaigns = tables.campaign_packs.filter((cp) => cp.pack_id === packId).map((cp) => cp.campaign_id);
  const packsOf = (keep: (campaignId: unknown) => boolean) =>
    new Set([packId, ...tables.campaign_packs.filter((cp) => campaigns.includes(cp.campaign_id) && keep(cp.campaign_id)).map((cp) => cp.pack_id)]);
  // Like private.item_readable since hd-2 (…_dec_hd2_ways_on_read.sql): every campaign that counts must have the item,
  // not any one of them (a campaign's own answer, campaign_library, counts only itself).
  const counted = campaigns.filter(counts);
  const hasItem = (campaignId: unknown, id: string) =>
    tables.library_entries.some((e) => e.kind === 'item' && e.pack_entry_id === id && tables.campaign_packs.some((cp) => cp.campaign_id === campaignId && cp.pack_id === e.pack_id));
  const alongside = packsOf(() => true);
  const hiddenOf = (entry: Row) => (tables.library_entry_secrets.find((s) => s.id === entry.id)?.data ?? {}) as Row;
  return {
    itemReadable: (id) => counted.length > 0 && counted.every((campaignId) => hasItem(campaignId, id)),
    hiddenKeys: (match) =>
      tables.library_entries
        .filter((e) => e.kind === match.kind && alongside.has(e.pack_id) && (match.ids.length === 0 || match.ids.includes(String(e.pack_entry_id))))
        .filter((e) => {
          if (!match.category) return true;
          const whole = { ...((e.data ?? {}) as Row), ...hiddenOf(e) };
          const byOption = (whole.byOption ?? {}) as Record<string, unknown>;
          return whole.category === match.category || Object.values(byOption).some((o) => (o as Row | null)?.category === match.category);
        })
        .flatMap((e) => Object.keys(hiddenOf(e))),
  };
}

function characterDefaults(): Row {
  return {
    status: 'active',
    fields: {},
    portrait_asset_id: null,
    level: 1,
    review_note: '',
    hp_max: null,
    hp_current: null,
    classes: [],
    race_ref: null,
    creation: {},
    weapon_skills: [],
    backstory: '',
    created_at: new Date(Date.UTC(2026, 9, 19) + createdOrder++).toISOString(),
  };
}

// Eight characters from the same alphabet as real codes, different for every invite.
function fakeCode(n: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code = alphabet.charAt(n % 32) + code;
    n = Math.floor(n / 32);
  }
  return code;
}

// Just enough of Supabase's query builder: select, update, eq, in, single, maybeSingle.
/** The stack a split is taking part of, while its new part is inserted (grimoire.splitting in the database). */
let splittingLine: Row | null = null;

class Query implements PromiseLike<Result> {
  private filters: ((row: Row) => boolean)[] = [];
  private limitTo: number | null = null;
  private offset = 0;
  private columns = '*';
  private patch: Row | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';

  constructor(
    private tables: FakeWorld['tables'],
    private table: keyof FakeWorld['tables'],
    private me: () => string | null,
    private newInvite: (row: Row) => Row,
    private log: EventLog,
    private splitHidden: (entry: Row, dataChanged: boolean) => void,
  ) {}

  /** Set by taggedDb (src/core/eventTags.ts): the command's name and log level. */
  headers = new Headers();
  /** As PostgREST: the first `.order()` sorts, each later one breaks the ties left by those before it. */
  private orderBy: { column: string; ascending: boolean }[] = [];

  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  lt(column: string, value: number) {
    this.filters.push((row) => Number(row[column]) < value);
    return this;
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  private inserted: Row[] | null = null;
  private failure: Result['error'] = null;
  /** The write fails with this database error (a duplicate key, say), changing nothing. */
  private failWith(error: NonNullable<Result['error']>) {
    this.failure = error;
    return this;
  }
  private duplicate = false;
  private deleting = false;

  delete() {
    this.deleting = true;
    return this;
  }

  /** Insert, or change the row with the same key (id, or actor_id for a carrier's load). */
  upsert(rows: Row | Row[]) {
    const list = Array.isArray(rows) ? rows : [rows];
    const key = this.table === 'carrier_loads' || this.table === 'character_layouts' || this.table === 'character_play' ? 'actor_id' : 'id';
    const existing = this.tables[this.table].find((row) => row[key] === list[0]![key]);
    if (!existing) return this.insert(list);
    this.patch = list[0]!;
    this.filters.push((row) => row[key] === list[0]![key]);
    return this;
  }

  insert(rows: Row | Row[]) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (this.table === 'invites') this.inserted = list.map((row) => this.newInvite(row));
    else if (this.table === 'actors') {
      this.inserted = list.map((row) => ({ id: `actor-${crypto.randomUUID()}`, ...characterDefaults(), ...row }));
    } else if (this.table === 'notes') {
      this.inserted = list.map((row) => {
        const entry = this.tables.events.find((e) => e.id === row.annotates_event_id);
        const now = new Date().toISOString();
        return {
          id: `note-${crypto.randomUUID()}`,
          about_actor_id: null,
          annotates_event_id: null,
          ...row,
          created_by: this.me(),
          created_at: now,
          updated_at: now,
          audience: entry ? entry.audience : 'all',
          reveal_at: entry ? (entry.reveal_at ?? 'now') : 'now',
          owner_user_id: entry ? (entry.owner_user_id ?? null) : null,
          // Like the database (fm-1): a note on a group's line is read by that line's readers.
          group_user_ids: entry?.audience === 'group' ? (entry.group_user_ids ?? []) : null,
        };
      });
    } else if (this.table === 'campaign_packs') {
      // Like the database: the link keeps the pack's name, taken from the pack.
      this.inserted = list.map((row) => ({
        id: `campaign-pack-${crypto.randomUUID()}`,
        option_choices: {},
        priority: 0,
        overrides: {},
        ...row,
        pack_name: this.tables.packs.find((pack) => pack.id === row.pack_id)?.name ?? '',
      }));
      for (const row of this.inserted) {
        // Your own packs; a campaign's homebrew only in that campaign.
        const pack = this.tables.packs.find((p) => p.id === row.pack_id);
        const own = !!pack && pack.owner_user_id === this.me() && (!pack.campaign_id || pack.campaign_id === row.campaign_id);
        if (!own) this.inserted = [];
        if (this.tables.campaign_packs.some((x) => x.campaign_id === row.campaign_id && x.pack_id === row.pack_id)) {
          this.duplicate = true;
        }
      }
    } else if (this.table === 'library_entries') {
      // Like the access rules: entries go only into your own packs.
      this.inserted = list.map((row) => ({ id: `entry-${crypto.randomUUID()}`, data: {}, ...row }));
      for (const row of this.inserted) {
        if (!this.tables.packs.some((pack) => pack.id === row.pack_id && pack.owner_user_id === this.me())) this.inserted = [];
      }
    } else if (this.table === 'packs') {
      // Like the access rules: your own packs; a campaign's homebrew pack only by its GM, one per campaign.
      this.inserted = list.map((row) => ({
        id: `pack-${crypto.randomUUID()}`,
        version: '',
        kind: 'setting',
        format_version: 1,
        source: '',
        notes: '',
        campaign_id: null,
        updated_at: new Date().toISOString(),
        ...row,
      }));
      for (const row of this.inserted) {
        if (row.owner_user_id !== this.me()) this.inserted = [];
        else if (row.campaign_id && (row.kind !== 'homebrew' || !this.isGm(row.campaign_id))) this.inserted = [];
        else if (row.campaign_id && this.tables.packs.some((x) => x.campaign_id === row.campaign_id)) this.duplicate = true;
      }
    } else if (this.table === 'inventory_lines') {
      const copied = list.map((row) => this.copyItem({
        id: `line-${crypto.randomUUID()}`,
        location_id: null,
        actor_id: null,
        library_entry_id: null,
        category: '',
        weight_coin: null,
        slots: null,
        stack: 1,
        qty: 1,
        container_line_id: null,
        equipped: false,
        cost: '',
        notes: '',
        item_data: {},
        source_pack_id: null,
        source_entry_id: null,
        charges_left: null,
        charges_hidden: false,
        charges_used: 0,
        spent_shown: false,
        last_roll: null,
        pinned: false,
        at_hand_hidden: false,
        approval: 'approved',
        per_units: 1,
        created_at: new Date(Date.UTC(2026, 9, 23) + createdOrder++).toISOString(),
        ...row,
        // Like the database: a new line starts at version 1 (M5 step 4).
        version: 1,
      }));
      // Like the database: a line's id is its own; the same add sent twice makes one line (a duplicate key).
      if (copied.some((row) => row && this.tables.inventory_lines.some((l) => l.id === row.id))) {
        return this.failWith({ message: 'duplicate key value violates unique constraint "inventory_lines_pkey"', code: '23505' });
      }
      // Like the database: "given" is the GM's alone; a player's one-off waits for the GM, unless the campaign's
      // "One-off items need approval" is off, or it goes on a character of their own that isn't approved yet (bq3-6:
      // the character's own approval covers it).
      for (const row of copied) {
        if (!row || this.isGm(row.campaign_id)) continue;
        if (row.how_got === 'given') row.campaign_id = null;
        const settings = this.tables.campaigns.find((c) => c.id === row.campaign_id)?.settings as { oneOffApproval?: unknown } | undefined;
        if (splittingLine) row.approval = splittingLine.approval;
        else if (!row.library_entry_id && !row.source_pack_id) {
          row.approval = this.isOwnUnapprovedCharacter(row.actor_id) || settings?.oneOffApproval === false ? 'approved' : 'pending';
        }
      }
      this.inserted = copied.every((row): row is Row => row !== null && row.campaign_id !== null && this.mayChangeCarrier(row)) ? copied : [];
    } else if (this.table === 'inventory_line_secrets') {
      // Like the access rules: the GM's alone.
      this.inserted = list.map((row) => ({ charges_total: null, spent: false, ...row }));
    } else if (this.table === 'rolls') {
      // Like the access rules: members enter their own; GM-only rolls only the GM.
      this.inserted = list.map((row) => ({ id: `roll-${crypto.randomUUID()}`, method: 'manual', entered_by: this.me(), gm_only: false, ...row }));
      if (!this.inserted.every((row) => this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && !row.gm_only))) this.inserted = [];
    } else if (this.table === 'character_layouts') {
      // Like the access rules: the owner or the GM.
      this.inserted = list.map((row) => ({ sections: [], ...row }));
      if (!this.inserted.every((row) => this.mayArrange(row))) this.inserted = [];
    } else if (this.table === 'character_play') {
      // Like the access rules: the owner or the GM, for an approved character.
      // A row made from now on starts not rested (rested_once's default, fsr-4).
      this.inserted = list.map((row) => ({ prepared: [], uses_spent: {}, ac_override: null, form_id: null, form_name: null, pins: [], rested_once: false, ...row }));
      if (!this.inserted.every((row) => this.mayPlay(row))) this.inserted = [];
    } else if (this.table === 'carrier_loads') {
      this.inserted = list.map((row) => ({ updated_at: new Date().toISOString(), ...row }));
      if (!this.inserted.every((row) => this.mayChangeCarrier({ ...row, location_id: null }))) this.inserted = [];
    } else if (this.table === 'companies') {
      this.inserted = list.map((row) => ({ id: `company-${crypto.randomUUID()}`, ...row }));
    } else if (this.table === 'assets') {
      this.inserted = list.map((row) => ({ id: `asset-${crypto.randomUUID()}`, uploaded_by: this.me(), visibility: 'gm', ...row }));
    } else if (this.table === 'field_definitions') {
      // Like the database's defaults, and its rule that two fields can't share a key in a campaign.
      this.inserted = list.map((row) => ({
        id: `field-${crypto.randomUUID()}`,
        applies_to: 'pc',
        choices: [],
        field_group: '',
        sort_order: 0,
        show_on_card: false,
        hidden: false,
        created_at: new Date(Date.UTC(2026, 9, 19) + createdOrder++).toISOString(),
        ...row,
      }));
    } else if (this.table === 'purses' || this.table === 'finds_seen' || this.table === 'calls_seen') {
      // Like the database: the purse row is made with its character or stash, and a seen mark by mark_finds_seen
      // (K20), never by a device (refused in runQuery).
      this.inserted = [];
    } else throw new Error(`The fake database doesn't insert into ${this.table}`);
    return this;
  }
  gt(column: string, value: string) {
    this.filters.push((row) => String(row[column]) > value);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column]) >= value);
    return this;
  }

  select(columns = '*') {
    this.columns = columns;
    return this;
  }
  update(patch: Row) {
    this.patch = patch;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  limit(count: number) {
    this.limitTo = count;
    return this;
  }
  range(from: number, to: number) {
    this.offset = from;
    this.limitTo = to - from + 1;
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then<A = Result, B = never>(onDone?: ((value: Result) => A | PromiseLike<A>) | null, onFail?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(onDone, onFail);
  }

  /** Like the events and notes reading rules: the GM all; members what's for everyone, or for them as owner. */
  private mayReadNoteOrEvent(row: Row): boolean {
    // Like the database (M5 step 6): a line kept for Downtime, or a note on one, once the campaign has gone into
    // Downtime after the line.
    const entry = row.annotates_event_id ? this.tables.events.find((e) => e.id === row.annotates_event_id) : row.seq !== undefined ? row : undefined;
    const revealed = !entry || revealedEvent(this.tables, entry);
    return this.tables.members.some(
      (m) =>
        m.campaign_id === row.campaign_id &&
        m.user_id === this.me() &&
        (m.base_role === 'gm' || (revealed && (row.audience === 'all' || (row.audience === 'owner' && row.owner_user_id === this.me()) || inGroupThen(row, this.me())))),
    );
  }

  private mayReadEvent(eventId: unknown): boolean {
    if (!eventId) return true;
    const event = this.tables.events.find((e) => e.id === eventId);
    return !!event && this.mayReadNoteOrEvent(event);
  }

  /** Like the database's split_alignment trigger: the field "alignment" moves into character_alignments. */
  private splitAlignment(row: Row): void {
    const fields = row.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !('alignment' in fields)) return;
    const { alignment, ...rest } = fields as Record<string, unknown>;
    row.fields = rest;
    const value = typeof alignment === 'string' ? alignment.trim().slice(0, 80) : alignment === null || alignment === undefined ? '' : String(alignment);
    const kept = this.tables.character_alignments.filter((a) => a.actor_id !== row.id);
    if (value === '') {
      this.tables.character_alignments = kept;
      return;
    }
    const was = this.tables.character_alignments.find((a) => a.actor_id === row.id);
    const owner = row.owner_type === 'user' ? (row.owner_user_id ?? null) : null;
    if (was && was.alignment === value && was.owner_user_id === owner) return;
    const now = new Date().toISOString();
    this.tables.character_alignments = [...kept, { actor_id: row.id, campaign_id: row.campaign_id, owner_user_id: owner, alignment: value, created_at: was?.created_at ?? now, updated_at: now }];
  }

  /** Like private.alignment_visible_to_all: the top attached rules set that says alignmentVisibility, "all" when none does. */
  private alignmentVisibleToAll(campaignId: unknown): boolean {
    const links = this.tables.campaign_packs.filter((cp) => cp.campaign_id === campaignId);
    const saying = links.flatMap((cp) => {
      const pack = this.tables.packs.find((p) => p.id === cp.pack_id);
      return this.tables.library_entries
        .filter((e) => e.pack_id === cp.pack_id && e.kind === 'rulesSet' && e.data && typeof e.data === 'object' && 'alignmentVisibility' in (e.data as Row))
        .map((e) => ({ homebrew: pack?.kind === 'homebrew' ? 1 : 0, priority: Number(cp.priority ?? 0), value: (e.data as Row).alignmentVisibility }));
    });
    saying.sort((a, b) => b.homebrew - a.homebrew || b.priority - a.priority);
    return saying[0]?.value !== 'owner';
  }

  /** Like private.may_read_alignment: the owner, the GM (not another's draft), or any member when the setting says all. */
  private mayReadAlignment(row: Row): boolean {
    const actor = this.tables.actors.find((a) => a.id === row.actor_id);
    if (row.owner_user_id !== null && row.owner_user_id === this.me()) return true;
    if (this.isGm(row.campaign_id)) return !actor || actor.approval !== 'draft' || actor.owner_user_id === this.me();
    return this.isMember(row.campaign_id) && this.alignmentVisibleToAll(row.campaign_id) && actor?.approval === 'approved';
  }

  /** Like private.is_down_or_dead (see isDownOrDeadIn below). */
  private isDownOrDead(actor: Row | undefined): boolean {
    return isDownOrDeadIn(this.tables, actor);
  }

  /**
   * Like private.may_read_purse: the stash's coin, any member; a character's purse, its owner (a hireling's employer)
   * and the GM (not another's draft), and any member while the character is Down or dead.
   */
  private mayReadPurse(row: Row): boolean {
    if (row.actor_id === null || row.actor_id === undefined) return row.location_id !== null && row.location_id !== undefined && this.isMember(row.campaign_id);
    const actor = this.tables.actors.find((a) => a.id === row.actor_id && a.campaign_id === row.campaign_id);
    if (this.isGm(row.campaign_id) && !(actor?.approval === 'draft' && actor.owner_user_id !== this.me())) return true;
    if (!this.isMember(row.campaign_id) || !actor) return false;
    return ((actor.owner_type ?? 'user') === 'user' && actor.owner_user_id === this.me()) || this.isDownOrDead(actor);
  }

  private isMember(campaignId: unknown): boolean {
    return this.tables.members.some((m) => m.campaign_id === campaignId && m.user_id === this.me());
  }

  private isGm(campaignId: unknown): boolean {
    return this.tables.members.some((m) => m.campaign_id === campaignId && m.user_id === this.me() && m.base_role === 'gm');
  }

  /** Like the access rules: a character's screen is arranged by its owner or the GM. */
  private mayArrange(row: Row): boolean {
    if (this.isGm(row.campaign_id)) return true;
    const actor = this.tables.actors.find((a) => a.id === row.actor_id);
    return !!actor && actor.owner_user_id === this.me() && this.isMember(row.campaign_id);
  }

  /** Like the access rules: what a character has prepared and spent is changed by its owner or the GM, once approved. */
  private mayPlay(row: Row): boolean {
    const actor = this.tables.actors.find((a) => a.id === row.actor_id);
    return !!actor && actor.approval === 'approved' && this.mayArrange(row);
  }

  /** Like the access rules: the GM; any member for the stash; a player for their own character still in play. */
  private mayChangeCarrier(line: Row): boolean {
    if (this.isGm(line.campaign_id)) return true;
    if (!this.isMember(line.campaign_id)) return false;
    if (line.location_id) return this.tables.locations.some((l) => l.id === line.location_id && l.campaign_id === line.campaign_id);
    const actor = this.tables.actors.find((a) => a.id === line.actor_id);
    return !!actor && actor.owner_user_id === this.me() && actor.status !== 'archived';
  }

  /** Like the database (bq3-6): a player character of the signed-in person's own that isn't approved yet. */
  private isOwnUnapprovedCharacter(actorId: unknown): boolean {
    const actor = this.tables.actors.find((a) => a.id === actorId);
    return !!actor && actor.kind === 'pc' && actor.owner_type === 'user' && actor.owner_user_id === this.me() && actor.approval !== 'approved';
  }

  /** Like the database: an item from the setting rules is copied from the entry; a one-off keeps what it was given. */
  private copyItem(line: Row): Row | null {
    if (!line.library_entry_id) return line;
    const entry = this.tables.library_entries.find((e) => e.id === line.library_entry_id);
    if (!entry) return line;
    const used = this.tables.campaign_packs.some((cp) => cp.campaign_id === line.campaign_id && cp.pack_id === entry.pack_id);
    if (entry.kind !== 'item' || !used) return null;
    const data = (entry.data ?? {}) as Row;
    const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
    return {
      ...line,
      item_data: data,
      name: entry.name,
      category: typeof data.category === 'string' ? data.category : '',
      weight_coin: whole(data.weightCoin),
      slots: whole(data.slots),
      stack: whole(data.stack) || 1,
      source_pack_id: entry.pack_id,
      source_entry_id: entry.pack_entry_id,
      // A bundle arrives as its units.
      ...(whole(data.bundle) && Number(data.bundle) > 1 ? { per_units: data.bundle, name: typeof data.unitName === 'string' && data.unitName.trim() ? data.unitName : entry.name } : {}),
    };
  }

  /** Runs the query; a write is followed by an event for each changed row, like the database's trigger. */
  private run(): Result {
    if (this.failure) return { data: null, error: this.failure };
    const writing = this.inserted !== null || this.patch !== null || this.deleting;
    const before = writing ? snapshotLogged(this.tables) : null;
    const result = this.runQuery();
    if (before && !result.error) {
      const after = snapshotLogged(this.tables);
      const tag = readTag(this.headers);
      for (const table of LOGGED) {
        const was = before.get(table)!;
        const now = after.get(table)!;
        for (const [key, row] of now) if (JSON.stringify(was.get(key)) !== JSON.stringify(row)) this.log(table, was.get(key) ?? null, row, tag);
        for (const [key, row] of was) if (!now.has(key)) this.log(table, row, null, tag);
      }
    }
    return result;
  }

  private runQuery(): Result {
    // Like the database (December step 6a): nobody writes a purse from a device; the commands' functions do (piece b).
    if (this.table === 'purses' && (this.inserted || this.patch || this.deleting)) {
      return { data: null, error: { message: 'permission denied for table purses', code: '42501' } };
    }
    // Like the database (K20): a seen mark has no write grant; only mark_finds_seen writes it.
    if ((this.table === 'finds_seen' || this.table === 'calls_seen') && (this.inserted || this.patch || this.deleting)) {
      return { data: null, error: { message: `permission denied for table ${this.table}`, code: '42501' } };
    }
    if (this.inserted && this.duplicate) {
      return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
    }
    if (this.inserted && (this.table === 'campaign_packs' || this.table === 'packs' || this.table === 'library_entries' || this.table === 'inventory_lines' || this.table === 'carrier_loads' || this.table === 'rolls' || this.table === 'character_layouts' || this.table === 'character_play') && this.inserted.length === 0) {
      return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
    }
    // Like the database: nothing in a retired campaign changes, except its GM bringing it back.
    const retired = (campaignId: unknown) => this.tables.campaigns.some((c) => c.id === campaignId && c.retired_at);
    // A library entry belongs to the campaign whose homebrew holds it (library packs belong to none).
    const campaignOf = (row: Row) =>
      this.table === 'campaigns'
        ? row.id
        : this.table === 'library_entries'
          ? (this.tables.packs.find((p) => p.id === row.pack_id)?.campaign_id ?? null)
          : row.campaign_id;
    if (this.inserted?.some((row) => retired(campaignOf(row)))) return { data: null, error: { message: RETIRED } };
    if (this.patch || this.deleting) {
      const touched = this.tables[this.table].filter((row) => this.filters.every((keep) => keep(row)));
      const bringingBack = this.table === 'campaigns' && Object.keys(this.patch ?? {}).join() === 'retired_at' && this.patch?.retired_at === null;
      if (!bringingBack && touched.some((row) => retired(campaignOf(row)))) {
        return { data: null, error: { message: RETIRED } };
      }
      // Like the database: an entry stays in its pack and kind; the GM's exceptions never go where players read
      // (ruled 2026-10-29, A4: all of them live in campaign_pack_secrets).
      const patch = this.patch ?? {};
      const moving = this.table === 'library_entries' && touched.some((row) => ['pack_id', 'kind'].some((key) => key in patch && patch[key] !== row[key]));
      const exposing = this.table === 'campaign_packs' && 'overrides' in patch && Object.keys(patch.overrides as Row).length > 0;
      if (moving || exposing) return { data: null, error: { message: 'new row violates check constraint', code: '23514' } };
    }
    if (this.inserted) {
      // Like the database: a player's new character follows the campaign's settings (ruled 2026-10-25): within the
      // level limit, and approved at once when approval is off.
      const joined = new Set<Row>();
      if (this.table === 'actors') {
        for (const row of this.inserted) {
          if (this.isGm(row.campaign_id) || row.owner_type !== 'user' || row.kind !== 'pc') continue;
          const settings = this.tables.campaigns.find((c) => c.id === row.campaign_id)?.settings;
          const lowest = partyLowest(this.tables.actors.filter((a) => a.campaign_id === row.campaign_id) as never);
          const max = startLevelLimit(startLevelOf(settings), lowest, startLevelFixedOf(settings));
          if (max !== null && Number(row.level) > max) {
            return { data: null, error: { message: `New characters here start at level ${max} or lower.`, code: '42501' } };
          }
          // A draft (ruled 2026-10-26) never joins at once: sending it does.
          if (row.approval === 'draft') continue;
          // Asking for an approved character that wouldn't join at once is refused, never quietly sent to the GM.
          if (joinsAtOnce(settings, Number(row.level), lowest)) {
            row.approval = 'approved';
            joined.add(row);
          } else if (row.approval === 'approved') {
            return { data: null, error: { message: 'Only the GM can approve characters.', code: '42501' } };
          }
        }
      }
      // Like the access rules: only the campaign's GM makes invites and fields; players make their own characters, pending.
      const allowed = (row: Row) =>
        this.isGm(row.campaign_id) ||
        // Like the access rules: members write notes (on an entry only if they can see it).
        (this.table === 'notes' && this.isMember(row.campaign_id) && this.mayReadEvent(row.annotates_event_id)) ||
        (this.table === 'assets' && row.kind === 'portrait' && this.isMember(row.campaign_id)) ||
        (this.table === 'actors' && row.owner_user_id === this.me() && (row.approval === 'pending' || row.approval === 'draft' || joined.has(row))) ||
        // Entries were already checked against their pack's owner, and lines against their carrier (insert).
        this.table === 'library_entries' ||
        this.table === 'inventory_lines' ||
        this.table === 'carrier_loads' ||
        this.table === 'rolls' ||
        this.table === 'character_layouts' ||
        this.table === 'character_play';
      if (!this.inserted.every(allowed)) {
        return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
      }
      if (this.table === 'library_entries') for (const row of this.inserted) this.splitHidden(row, false);
      this.tables[this.table].push(...this.inserted);
      if (this.table === 'actors') for (const row of this.inserted) this.splitAlignment(row);
      // Like the database: a character approved on creation becomes its player's active one if they have none.
      for (const row of joined) {
        const member = this.tables.members.find((m) => m.campaign_id === row.campaign_id && m.user_id === row.owner_user_id);
        if (member && !member.active_actor_id) member.active_actor_id = row.id;
      }
      // Like the database: each link gets its GM-only part.
      if (this.table === 'campaign_packs') {
        for (const row of this.inserted) this.tables.campaign_pack_secrets.push({ id: row.id, campaign_id: row.campaign_id, overrides: {} });
      }
      const made = this.inserted.map((row) => ({ ...row }));
      // Like Supabase: .single() hands back the one row itself, not a list.
      if (this.mode !== 'many') return { data: made[0] ?? null, error: null };
      return { data: made, error: null };
    }
    let rows = this.tables[this.table].filter((row) => this.filters.every((keep) => keep(row)));
    // Like the access rule: the GM reads every event; members read what's for everyone, or for them as owner.
    if (this.table === 'notes') rows = rows.filter((note) => this.mayReadNoteOrEvent(note));
    // Like the access rules: packs and their entries are their owner's only.
    const usedIn = (packId: unknown, gmOnly: boolean) =>
      this.tables.campaign_packs.some((cp) => cp.pack_id === packId && (gmOnly ? this.isGm(cp.campaign_id) : this.isMember(cp.campaign_id)));
    if (this.table === 'packs') rows = rows.filter((pack) => pack.owner_user_id === this.me() || usedIn(pack.id, false));
    if (this.table === 'library_entries') {
      rows = rows.filter(
        (entry) =>
          this.tables.packs.some((pack) => pack.id === entry.pack_id && pack.owner_user_id === this.me()) ||
          usedIn(entry.pack_id, true) ||
          // Like the access rule (fresh-session review of 2026-11-04; look-back review of #437): a patch on a GM-only
          // kind, on an item the reader can't read or on a field its target keeps GM-only is the GM's alone.
          (usedIn(entry.pack_id, false) && playerFacingEntry(String(entry.kind), entry.data, entry.kind === 'patch' ? patchTargetsIn(this.tables, entry.pack_id, (c) => this.isMember(c)) : undefined)) ||
          // Like the access rule (fs-1, 2026-11-02): a table the pack marks `gmOnly: false` is every member's.
          // Never a rumours table, whatever its pack says (rm-3, …_dec_12e_rumours_gm_only.sql).
          (usedIn(entry.pack_id, false) && entry.kind === 'table' && (entry.data as Row | undefined)?.gmOnly === false && !rumoursTable((entry.data ?? {}) as Record<string, unknown>)),
      );
      // Like the access rules: only the pack's owner changes or deletes its entries.
      if (this.patch || this.deleting) rows = rows.filter((entry) => this.tables.packs.some((pack) => pack.id === entry.pack_id && pack.owner_user_id === this.me()));
    }
    // Like the access rules: nobody else sees a draft, not even the GM (ruled 2026-10-26).
    if (this.table === 'actors') rows = rows.filter((row) => row.approval !== 'draft' || row.owner_user_id === this.me());
    // Like the access rule (M5b step 0c): an alignment is read by its owner, the GM, or everyone when the setting says all.
    if (this.table === 'character_alignments') rows = rows.filter((row) => this.mayReadAlignment(row));
    // Like the access rule (December step 6a): a purse is read by its owner and the GM; the stash's by every member; a
    // Down or dead character's by every member.
    if (this.table === 'purses') rows = rows.filter((row) => this.mayReadPurse(row));
    // Like the access rules: lines are seen like their carrier; changed or removed by who may change it.
    if (this.table === 'inventory_lines') {
      rows = rows.filter((line) => {
        if (this.isGm(line.campaign_id)) return true;
        if (!this.isMember(line.campaign_id)) return false;
        const actor = this.tables.actors.find((a) => a.id === line.actor_id);
        return line.location_id !== null || (!!actor && (actor.approval === 'approved' || actor.owner_user_id === this.me()));
      });
      if (this.patch || this.deleting) rows = rows.filter((line) => this.mayChangeCarrier(line));
      // Like the database (bq3-6): a one-off a player moves off their own character that isn't approved yet waits
      // again where it lands, unless the campaign's "One-off items need approval" is off.
      if (this.patch && 'actor_id' in this.patch && !this.isGm(rows[0]?.campaign_id)) {
        const leaving = rows.filter((line) => line.actor_id !== this.patch!.actor_id && !line.library_entry_id && !line.source_pack_id && this.isOwnUnapprovedCharacter(line.actor_id));
        if (leaving.length > 0) {
          const settings = this.tables.campaigns.find((c) => c.id === leaving[0]!.campaign_id)?.settings as { oneOffApproval?: unknown } | undefined;
          this.patch = { ...this.patch, approval: settings?.oneOffApproval === false ? 'approved' : 'pending' };
        }
      }
      if (this.deleting) {
        const gone = new Set(rows.map((row) => row.id));
        this.tables.inventory_lines = this.tables.inventory_lines.filter((row) => !gone.has(row.id));
        // Like the database: the line's GM-only row goes with it, and what was inside stays, loose.
        this.tables.inventory_line_secrets = this.tables.inventory_line_secrets.filter((row) => !gone.has(row.id));
        for (const line of this.tables.inventory_lines) if (gone.has(line.container_line_id)) line.container_line_id = null;
        return { data: rows.map((row) => ({ ...row })), error: null };
      }
    }
    if (this.table === 'locations') rows = rows.filter((place) => this.isMember(place.campaign_id));
    if (this.table === 'inventory_line_secrets') rows = rows.filter((row) => this.isGm(row.campaign_id));
    if (this.table === 'character_layouts' && this.patch) rows = rows.filter((row) => this.mayArrange(row));
    if (this.table === 'character_play' && this.patch) rows = rows.filter((row) => this.mayPlay(row));
    // Like the access rules (M5 step 7): a light is read like its character; changed through the functions only.
    if (this.table === 'character_lights') {
      rows = rows.filter((row) => {
        const actor = this.tables.actors.find((a) => a.id === row.actor_id);
        return this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && !!actor && (actor.approval === 'approved' || actor.owner_user_id === this.me()));
      });
      if (this.patch) rows = rows.filter((row) => this.mayPlay(row));
    }
    // Like the access rules (M5 step 9): statuses and rests are read like their character; secret timers by the GM.
    if (this.table === 'character_statuses' || this.table === 'character_rests') {
      rows = rows.filter((row) => {
        const actor = this.tables.actors.find((a) => a.id === row.actor_id);
        return this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && !!actor && (actor.approval === 'approved' || actor.owner_user_id === this.me()));
      });
      if (this.patch) rows = rows.filter((row) => this.mayPlay(row));
    }
    // Like the access rules (M5 step 11; M5b g2): the GM reads every place, piece and group row; a player their own
    // group's row only; places, pieces and the GM's notes never leave the GM (players read shown pieces through
    // scene_pieces).
    if (this.table === 'place_pieces' || this.table === 'piece_shows' || this.table === 'place_rule_switches' || this.table === 'knowledge_shares') rows = rows.filter((row) => this.isGm(row.campaign_id));
    if (this.table === 'places' || this.table === 'group_places' || this.table === 'place_notes') {
      const mine = (campaignId: unknown) =>
        this.tables.actors
          .filter((a) => a.campaign_id === campaignId && a.owner_user_id === this.me())
          .map((a) => Number(this.tables.party_group_members.find((m) => m.actor_id === a.id)?.group_number ?? 1));
      rows = rows.filter((row) => {
        if (this.isGm(row.campaign_id)) return true;
        if (this.table === 'place_notes' || this.table === 'places' || this.patch || !this.isMember(row.campaign_id)) return false;
        const groups = mine(row.campaign_id);
        if (this.table === 'group_places') return groups.includes(Number(row.group_number));
        return this.tables.group_places.some((g) => g.place_id === row.id && g.shown === true && !g.undone && !g.moved_on && groups.includes(Number(g.group_number)));
      });
    }
    if (this.table === 'status_secrets' || this.table === 'travel_group_secrets' || this.table === 'expedition_places' || this.table === 'table_pins' || this.table === 'table_reads' || this.table === 'waiting_encounters' || this.table === 'place_moves') rows = rows.filter((row) => this.isGm(row.campaign_id));
    // Like the access rules (M5b step 1): the GM reads all travel and Lost rows; a player their own group's travel, and
    // its Lost only while the campaign's Getting lost is Open.
    if (this.table === 'travel_groups' || this.table === 'group_lost') {
      rows = rows.filter((row) => {
        if (this.isGm(row.campaign_id)) return true;
        if (this.patch || !this.isMember(row.campaign_id)) return false;
        const mine = this.tables.actors
          .filter((a) => a.campaign_id === row.campaign_id && a.owner_user_id === this.me())
          .some((a) => Number(this.tables.party_group_members.find((m) => m.actor_id === a.id)?.group_number ?? 1) === Number(row.group_number));
        if (this.table === 'travel_groups') return mine;
        const settings = this.tables.campaigns.find((c) => c.id === row.campaign_id)?.settings as { gettingLost?: unknown } | undefined;
        return mine && settings?.gettingLost === 'open';
      });
    }
    // Like the access rules (M5b steps 3 and 4): the GM reads every camp, camp step and activity run; a player their
    // own group's; nothing is written through the table (the functions do it).
    if (this.table === 'camps' || this.table === 'camp_entries' || this.table === 'activity_runs') {
      rows = rows.filter((row) => {
        if (this.isGm(row.campaign_id)) return true;
        if (this.patch || this.deleting || !this.isMember(row.campaign_id)) return false;
        return this.tables.actors
          .filter((a) => a.campaign_id === row.campaign_id && a.owner_user_id === this.me() && (a.approval ?? 'approved') === 'approved' && (a.status ?? 'active') === 'active')
          .some((a) => Number(this.tables.party_group_members.find((m) => m.actor_id === a.id)?.group_number ?? 1) === Number(row.group_number));
      });
    }
    // Like the access rules (M5 step 12): the GM reads every request; a player their own, and the party's.
    if (this.table === 'requests') {
      rows = rows.filter((row) => this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && (row.requester_id === this.me() || (row.requester_id === null && row.direction === 'gmAsks'))));
    }
    // Like the access rules (m5b sheet changes): the GM reads every change; a player their own.
    if (this.table === 'sheet_changes') {
      rows = rows.filter((row) => this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && row.requester_id === this.me()));
    }
    // Like the access rules (K20, pk-13): the GM and the character's player read a seen mark; nobody writes one through
    // the table (mark_finds_seen does it).
    if (this.table === 'finds_seen') {
      rows = rows.filter((row) => {
        if (this.patch || this.deleting) return false;
        if (this.isGm(row.campaign_id)) return true;
        const actor = this.tables.actors.find((a) => a.id === row.actor_id);
        return this.isMember(row.campaign_id) && actor?.owner_type === 'user' && actor.owner_user_id === this.me();
      });
    }
    // Like the access rules (P7, p7-1, p7-2): the GM reads every call's seen mark; a player their own, never another's.
    if (this.table === 'calls_seen') {
      rows = rows.filter((row) => !this.patch && !this.deleting && (this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && row.player_user_id === this.me())));
    }
    // Like the access rules (W12, 20261115110000_dec_3_w12_shop_stock.sql): the GM reads every line (fix-856-1,
    // 20261118090000_fix_856_1_shop_stock_gm_read.sql: only the GM); a player none, and reads stock through shop_stock_in; nothing is written through the table (the functions do it; an undo puts back).
    if (this.table === 'shop_stock') {
      rows = rows.filter((row) => {
        if (this.patch || this.deleting) return false;
        return this.isGm(row.campaign_id);
      });
    }
    // Like the access rules (dec-12 B): the GM reads every send; a player a live send to the party, or to a character
    // whose player they were when it was sent; nothing is written through the table (send_hook does it).
    if (this.table === 'hook_sends') {
      rows = rows.filter((row) => {
        if (this.isGm(row.campaign_id)) return true;
        if (this.patch || this.deleting || !this.isMember(row.campaign_id) || row.undone) return false;
        return row.actor_id === null || row.player_user_id === this.me();
      });
    }
    // Like the access rules (M5b g4): a message reaches its two parties only (the GM and the character's player), and
    // a disappearing one leaves its recipient once they've closed it.
    if (this.table === 'messages') {
      rows = rows.filter((row) => {
        if (!this.isMember(row.campaign_id) || !(this.isGm(row.campaign_id) || row.player_user_id === this.me())) return false;
        const recipientIsMe = row.from_gm ? row.player_user_id === this.me() : this.isGm(row.campaign_id);
        return !(row.disappears && row.read_at !== null && recipientIsMe);
      });
    }
    if (this.table === 'carrier_loads') {
      rows = rows.filter((row) => {
        const actor = this.tables.actors.find((a) => a.id === row.actor_id);
        return this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && !!actor && (actor.approval === 'approved' || actor.owner_user_id === this.me()));
      });
      if (this.patch) rows = rows.filter((row) => this.mayChangeCarrier({ ...row, location_id: null }));
    }
    if (this.deleting && this.table === 'library_entries') {
      const gone = new Set(rows.map((row) => row.id));
      this.tables.library_entries = this.tables.library_entries.filter((row) => !gone.has(row.id));
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.table === 'campaign_packs') {
      rows = rows.filter((cp) => this.isMember(cp.campaign_id));
      if (this.patch || this.deleting) rows = rows.filter((cp) => this.isGm(cp.campaign_id));
    }
    // Like the access rules: an entry's hidden fields are for the pack's owner and the GM of a campaign using it.
    if (this.table === 'library_entry_secrets') {
      rows = rows.filter((row) => this.tables.packs.some((pack) => pack.id === row.pack_id && pack.owner_user_id === this.me()) || usedIn(row.pack_id, true));
    }
    // Like the access rules: only the GM reads or changes a link's GM-only part.
    if (this.table === 'campaign_pack_secrets') rows = rows.filter((row) => this.isGm(row.campaign_id));
    if (this.deleting && this.table === 'packs') {
      // Like the access rules: only the owner deletes; its entries and campaign links go with it. A campaign's
      // homebrew goes only with its campaign.
      if (rows.some((pack) => pack.campaign_id)) return { data: null, error: { message: "A campaign's homebrew goes only with its campaign.", code: '42501' } };
      rows = rows.filter((pack) => pack.owner_user_id === this.me());
      const gone = new Set(rows.map((row) => row.id));
      const links = new Set(this.tables.campaign_packs.filter((row) => gone.has(row.pack_id)).map((row) => row.id));
      this.tables.packs = this.tables.packs.filter((row) => !gone.has(row.id));
      this.tables.library_entries = this.tables.library_entries.filter((row) => !gone.has(row.pack_id));
      this.tables.campaign_packs = this.tables.campaign_packs.filter((row) => !gone.has(row.pack_id));
      this.tables.campaign_pack_secrets = this.tables.campaign_pack_secrets.filter((row) => !links.has(row.id));
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.deleting && this.table === 'campaign_packs') {
      const gone = new Set(rows.map((row) => row.id));
      this.tables.campaign_packs = this.tables.campaign_packs.filter((row) => !gone.has(row.id));
      this.tables.campaign_pack_secrets = this.tables.campaign_pack_secrets.filter((row) => !gone.has(row.id));
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.table === 'events') {
      rows = rows.filter((event) =>
        this.tables.members.some(
          (m) =>
            m.campaign_id === event.campaign_id &&
            m.user_id === this.me() &&
            (m.base_role === 'gm' ||
              (revealedEvent(this.tables, event) && (event.audience === 'all' || (event.audience === 'owner' && event.owner_user_id === this.me()) || inGroupThen(event, this.me())))),
        ),
      );
    }
    // Like the access rules (M5 step 6): members read the public reminders and the revealed check results only.
    if (this.table === 'reminders') rows = rows.filter((row) => this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && row.is_public === true && !row.undone));
    if (this.table === 'check_results') rows = rows.filter((row) => this.isGm(row.campaign_id) || (this.isMember(row.campaign_id) && row.revealed === true && !row.undone));
    // Like the access rules (M5b): every member reads today's weather.
    if (this.table === 'weather_rolls') rows = rows.filter((row) => this.isMember(row.campaign_id));
    // Like the access rules (M5 step 8): members read the marching order; changes go through its functions only.
    if (this.table === 'marching_orders') rows = rows.filter((row) => this.isMember(row.campaign_id) && !this.patch);
    // Like the access rules (M5 step 8, DG14): members read the groups; changes go through their functions only.
    if (this.table === 'party_groups' || this.table === 'party_group_members') rows = rows.filter((row) => this.isMember(row.campaign_id) && !this.patch);
    if (this.orderBy.length > 0) {
      const compare = (a: Row, b: Row, column: string) =>
        typeof a[column] === 'number' ? Number(a[column]) - Number(b[column]) : String(a[column]).localeCompare(String(b[column]));
      const orderBy = this.orderBy;
      rows = [...rows].sort((a, b) => {
        for (const { column, ascending } of orderBy) {
          const by = compare(a, b, column) * (ascending ? 1 : -1);
          if (by !== 0) return by;
        }
        return 0;
      });
    }
    // Like the access rules: only the GM reads or changes invites.
    if (this.table === 'invites') rows = rows.filter((row) => this.isGm(row.campaign_id));
    // Like the access rules: only the GM changes fields, and deletes only ones no character has a value for.
    if (this.table === 'field_definitions' && (this.patch || this.deleting)) {
      rows = rows.filter((row) => this.isGm(row.campaign_id));
    }
    if (this.deleting && this.table === 'assets') {
      rows = rows.filter((row) => this.isGm(row.campaign_id) || (row.kind === 'portrait' && row.uploaded_by === this.me()));
      const gone = new Set(rows.map((row) => row.id));
      this.tables.assets = this.tables.assets.filter((row) => !gone.has(row.id));
      for (const actor of this.tables.actors) if (gone.has(actor.portrait_asset_id)) actor.portrait_asset_id = null;
      for (const campaign of this.tables.campaigns) if (gone.has(campaign.sigil_asset_id)) campaign.sigil_asset_id = null;
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.deleting && this.table === 'companies') {
      // Like the access rules: the GM deletes a company only while no character is in it.
      rows = rows.filter((row) => this.isGm(row.campaign_id) && !this.tables.actors.some((a) => a.company_id === row.id));
      const gone = new Set(rows.map((row) => row.id));
      this.tables.companies = this.tables.companies.filter((row) => !gone.has(row.id));
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.deleting && this.table === 'field_definitions') {
      rows = rows.filter(
        (row) =>
          !this.tables.actors.some(
            (a) => a.campaign_id === row.campaign_id && Object.hasOwn((a.fields as object) ?? {}, String(row.key)),
          ),
      );
      const gone = new Set(rows.map((row) => row.id));
      this.tables.field_definitions = this.tables.field_definitions.filter((row) => !gone.has(row.id));
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.deleting) {
      if (this.table !== 'actors') throw new Error(`The fake database doesn't delete from ${this.table}`);
      // Like the access rules: never-approved or archived characters, by their owner or the GM.
      rows = rows.filter(
        (row) =>
          (row.approval !== 'approved' || row.status === 'archived') &&
          (this.isGm(row.campaign_id) || row.owner_user_id === this.me()),
      );
      const gone = new Set(rows.map((row) => row.id));
      this.tables.actors = this.tables.actors.filter((row) => !gone.has(row.id));
      for (const member of this.tables.members) if (gone.has(member.active_actor_id)) member.active_actor_id = null;
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (this.patch) {
      // Like the database (M5 step 4): a change made from an old copy of a line is refused; a real change raises the version.
      if (this.table === 'inventory_lines' && 'version' in this.patch) {
        const seen = this.patch.version;
        if (rows.some((row) => row.version !== seen)) return { data: null, error: { message: STALE, code: STALE_CODE } };
      }
      // Like the database (M5 small fixes): magic armour's base is one of its own choices, picked once by a player.
      if (this.table === 'inventory_lines' && 'base_armour_id' in this.patch) {
        const picked = this.patch.base_armour_id;
        for (const row of rows) {
          const armour = (row.item_data as { armour?: { baseArmour?: { choose?: unknown } } } | null)?.armour;
          const choose = Array.isArray(armour?.baseArmour?.choose) ? armour.baseArmour.choose : [];
          if (picked !== null && !choose.includes(picked)) return { data: null, error: { message: "That isn't one of this armour's bases." } };
          if (!this.isGm(row.campaign_id) && row.base_armour_id && picked !== row.base_armour_id) {
            return { data: null, error: { message: "Only the GM changes the base armour once it's chosen.", code: '42501' } };
          }
        }
      }
      if (this.table === 'inventory_lines') {
        const change = { ...this.patch };
        delete change.version;
        this.patch = change;
        for (const row of rows) row.version = Number(row.version ?? 1) + 1;
      }
      if (this.table === 'inventory_line_secrets') rows = rows.filter((row) => this.isGm(row.campaign_id));
      // Like the database: only your own profile, and saving your name marks it as chosen.
      if (this.table === 'profiles') rows = rows.filter((row) => row.id === this.me());
      // Like the access rules: only the GM edits the campaign and its companies.
      if (this.table === 'campaigns') rows = rows.filter((row) => this.isGm(row.id));
      if (this.table === 'companies') rows = rows.filter((row) => this.isGm(row.campaign_id));
      // Like the access rules: your own notes, or any as GM; only the text changes.
      if (this.table === 'notes') {
        rows = rows.filter((row) => this.isGm(row.campaign_id) || row.created_by === this.me());
        for (const row of rows) row.updated_at = new Date(Date.now() + 1).toISOString();
      }
      // Like the database (follow-up C, cf-7; 04): a player changes a character's class or race only before approval.
      if (this.table === 'actors' && ('classes' in this.patch || 'race_ref' in this.patch)) {
        const patch = this.patch;
        const moved = (row: Row) => ('classes' in patch && JSON.stringify(patch.classes) !== JSON.stringify(row.classes)) || ('race_ref' in patch && patch.race_ref !== row.race_ref);
        if (rows.some((row) => moved(row) && !this.isGm(row.campaign_id) && row.approval === 'approved')) {
          return { data: null, error: { message: "Only the GM can change an approved character's class or race.", code: '42501' } };
        }
      }
      // Like the database: an archived character keeps its company.
      if (this.table === 'actors' && 'company_id' in this.patch) {
        const patch = this.patch;
        rows = rows.filter((row) => row.status !== 'archived' || row.company_id === patch.company_id);
      }
      // Like the database (…_dec_give_character_reassign.sql): only the GM changes an owner, and only to a player of
      // the campaign or to the GM himself.
      const reassigning = this.table === 'actors' && ('owner_type' in this.patch || 'owner_user_id' in this.patch);
      if (reassigning) {
        const patch = this.patch;
        for (const row of rows) {
          const toPlayer = this.tables.members.some((m) => m.campaign_id === row.campaign_id && m.user_id === patch.owner_user_id && m.base_role === 'player');
          if (!this.isGm(row.campaign_id) || (patch.owner_type === 'user' ? !toPlayer : patch.owner_type !== 'gm')) {
            return { data: null, error: { message: 'A character can only be given to a player of this campaign.', code: '42501' } };
          }
        }
      }
      // Like the database (…_dec_7_5m_2_place_map.sql, private.check_place_map): a place's map is a map of its campaign.
      if (this.table === 'places' && this.patch.map_asset_id) {
        const asset = this.patch.map_asset_id;
        if (rows.some((row) => row.map_asset_id !== asset && !this.tables.assets.some((a) => a.id === asset && a.kind === 'map' && a.campaign_id === row.campaign_id))) {
          return { data: null, error: { message: "That picture can't be this place's map.", code: '42501' } };
        }
      }
      for (const row of rows) {
        const wasApproved = row.approval === 'approved';
        const handedOn = this.table === 'inventory_lines' && (('actor_id' in this.patch && this.patch.actor_id !== row.actor_id) || ('location_id' in this.patch && this.patch.location_id !== row.location_id));
        const sending = this.table === 'actors' && row.approval === 'draft' && this.patch.approval === 'pending';
        Object.assign(row, this.patch);
        // Like the database: a draft sent joins at once when the campaign says so (ruled 2026-10-26).
        if (sending) {
          const settings = this.tables.campaigns.find((c) => c.id === row.campaign_id)?.settings;
          const lowest = partyLowest(this.tables.actors.filter((a) => a.campaign_id === row.campaign_id) as never);
          if (joinsAtOnce(settings, Number(row.level), lowest)) row.approval = 'approved';
        }
        if (this.table === 'library_entries' && 'data' in this.patch) this.splitHidden(row, true);
        if (this.table === 'actors' && 'fields' in this.patch) this.splitAlignment(row);
        // Like the database: hidden charges are spent when the uses reach the GM's total; used again with none
        // left, the holder is shown it's spent (note_fizzle).
        if (this.table === 'inventory_lines' && 'charges_used' in this.patch && row.charges_hidden) {
          const secret = this.tables.inventory_line_secrets.find((x) => x.id === row.id);
          if (secret?.spent) row.spent_shown = true;
          if (secret && !secret.spent && secret.charges_total !== null && Number(row.charges_used) >= Number(secret.charges_total)) secret.spent = true;
        }
        // Like the database: a pin goes away when its item is handed on, only when its holder or place really changes
        // (private.unpin_when_handed_on, 20261109130000_m5b_weapon_mode_characters_only.sql: `is distinct from`).
        if (handedOn) {
          row.pinned = false;
          row.at_hand_hidden = false;
        }
        // Like the database: a container that changes hands takes what's in it along.
        if (this.table === 'inventory_lines' && ('actor_id' in this.patch || 'location_id' in this.patch)) {
          for (const inner of this.tables.inventory_lines) {
            if (inner.container_line_id === row.id) Object.assign(inner, { actor_id: row.actor_id, location_id: row.location_id });
          }
        }
        if (this.table === 'profiles') row.named_at ??= new Date().toISOString();
        // Like the database: archiving the active character leaves its player with none.
        if (this.table === 'actors' && row.status === 'archived') {
          for (const member of this.tables.members) if (member.active_actor_id === row.id) member.active_actor_id = null;
        }
        // Like the database: a character given on leaves play for whoever had it, is in play for a new player who has
        // none, and its alignment's owner follows it.
        if (reassigning) {
          const owner = row.owner_type === 'user' ? row.owner_user_id : null;
          for (const member of this.tables.members) {
            if (member.active_actor_id === row.id && member.user_id !== owner) member.active_actor_id = null;
          }
          const member = owner ? this.tables.members.find((m) => m.campaign_id === row.campaign_id && m.user_id === owner) : undefined;
          if (member && !member.active_actor_id && row.approval === 'approved' && (row.kind ?? 'pc') === 'pc' && row.status !== 'archived') {
            member.active_actor_id = row.id;
          }
          for (const a of this.tables.character_alignments) if (a.actor_id === row.id) a.owner_user_id = owner;
        }
        // Like the database: a player's first approved character becomes their active one.
        if (this.table === 'actors' && !wasApproved && row.approval === 'approved' && row.owner_user_id) {
          const member = this.tables.members.find(
            (m) => m.campaign_id === row.campaign_id && m.user_id === row.owner_user_id,
          );
          if (member && !member.active_actor_id) member.active_actor_id = row.id;
        }
      }
    }
    // Like PostgREST: "guide:data->creationGuide" reads one key of a JSON column under a name of its own.
    const jsonColumns = [...this.columns.matchAll(/(\w+):(\w+)->(\w+)/g)].map(([, alias, column, key]) => ({ alias: alias!, column: column!, key: key! }));
    const shaped = rows.map((row) => {
      const copy: Row = { ...row };
      for (const { alias, column, key } of jsonColumns) {
        const json = row[column];
        copy[alias] = json && typeof json === 'object' && !Array.isArray(json) ? ((json as Row)[key] ?? null) : null;
      }
      if (this.columns.includes('packs(')) {
        const pack = this.tables.packs.find((p) => p.id === row.pack_id);
        copy.packs = pack ? { name: pack.name, version: pack.version, kind: pack.kind, campaign_id: pack.campaign_id ?? null, extra_meta: pack.extra_meta ?? {}, content_rev: pack.content_rev ?? 0 } : null;
      }
      if (this.columns.includes('campaigns(')) {
        const campaign = this.tables.campaigns.find((c) => c.id === row.campaign_id);
        copy.campaigns = campaign
          ? { name: campaign.name, sigil_asset_id: campaign.sigil_asset_id ?? null, retired_at: campaign.retired_at ?? null }
          : null;
      }
      if (this.columns.includes('profiles!members_user_id_fkey(display_name)')) {
        const profile = this.tables.profiles.find((p) => p.id === row.user_id);
        copy.profiles = profile ? { display_name: profile.display_name } : null;
      }
      return copy;
    });
    if (this.mode === 'single') {
      return shaped.length === 1 ? { data: shaped[0], error: null } : { data: null, error: { message: 'Expected one row' } };
    }
    if (this.mode === 'maybe') return { data: shaped[0] ?? null, error: null };
    return { data: this.limitTo === null ? shaped.slice(this.offset) : shaped.slice(this.offset, this.offset + this.limitTo), error: null };
  }
}

// The tables the database logs (members have no id in the stand-in, so they're keyed by campaign and person).
const LOGGED = [
  'campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'notes', 'campaign_packs', 'library_entries', 'campaign_pack_secrets',
  'inventory_lines', 'inventory_line_secrets', 'carrier_loads', 'character_layouts', 'character_play', 'campaign_clocks', 'sessions', 'expeditions',
  'reminders', 'check_results', 'character_lights', 'marching_orders', 'party_group_members', 'weather_rolls', 'character_statuses', 'status_secrets', 'character_rests',
  'expedition_places', 'places', 'place_notes', 'group_places', 'place_pieces', 'piece_shows', 'place_rule_switches', 'knowledge_shares', 'requests', 'sheet_changes', 'table_pins', 'table_reads', 'messages', 'character_alignments', 'waiting_encounters',
  'travel_groups', 'travel_group_secrets', 'group_lost', 'camps', 'camp_entries', 'activity_runs', 'sheet_changes', 'hook_sends', 'place_moves', 'purses',
  'finds_seen', 'calls_seen', 'shop_stock',
] as const;

/**
 * Like private.down_at: the HP at which the campaign's setting marks a character Down, `death.at` of the top attached
 * rules set that says it (the homebrew, then the highest priority), its pack's chosen options applied; null when none says.
 */
function downAtIn(tables: FakeWorld['tables'], campaignId: unknown): number | null {
  const saying = tables.campaign_packs
    .filter((cp) => cp.campaign_id === campaignId)
    .flatMap((cp) => {
      const pack = tables.packs.find((p) => p.id === cp.pack_id);
      const choices = (cp.option_choices ?? {}) as Row;
      return tables.library_entries
        .filter((e) => e.pack_id === cp.pack_id && e.kind === 'rulesSet')
        .map((e) => {
          const data = { ...((e.data ?? {}) as Row), ...((tables.library_entry_secrets.find((x) => x.id === e.id)?.data ?? {}) as Row) };
          let death = data.death && typeof data.death === 'object' ? (data.death as Row) : {};
          const byOption = data.byOption && typeof data.byOption === 'object' && !Array.isArray(data.byOption) ? (data.byOption as Row) : {};
          for (const [spec, value] of Object.entries(byOption)) {
            const [option, choice] = spec.split('=');
            const chosen = value && typeof value === 'object' ? (value as Row).death : undefined;
            if (option && choices[option] === choice && chosen && typeof chosen === 'object') death = { ...death, ...(chosen as Row) };
          }
          return { homebrew: pack?.kind === 'homebrew' ? 1 : 0, priority: Number(cp.priority ?? 0), at: death.at };
        });
    })
    .filter((x) => typeof x.at === 'number' && Number.isInteger(x.at));
  saying.sort((a, b) => b.homebrew - a.homebrew || b.priority - a.priority);
  return saying.length > 0 ? (saying[0]!.at as number) : null;
}

/** Like private.is_down_or_dead: an approved character or hireling that is dead, or in play with HP at or under the Down mark. */
function isDownOrDeadIn(tables: FakeWorld['tables'], actor: Row | undefined): boolean {
  if (!actor || ((actor.kind ?? 'pc') !== 'pc' && actor.kind !== 'hireling') || actor.approval !== 'approved') return false;
  const status = actor.status ?? 'active';
  if (status === 'dead') return true;
  if (status !== 'active' && status !== 'benched') return false;
  const downAt = downAtIn(tables, actor.campaign_id);
  return downAt !== null && typeof actor.hp_current === 'number' && actor.hp_current <= downAt;
}
type EventLog = (
  table: (typeof LOGGED)[number],
  before: Row | null,
  after: Row | null,
  tag: { type: string; level: string; requestId: string; fiat?: boolean; reason?: string | null; whatFor?: string | null } | null,
  reverting?: Row,
) => void;

function snapshotLogged(tables: FakeWorld['tables']) {
  return new Map(
    LOGGED.map((table) => [
      table,
      new Map(tables[table].map((row) => [String(row.id ?? row.actor_id ?? `${String(row.campaign_id)}/${String(row.user_id)}`), structuredClone(row)])),
    ]),
  );
}

/** The command's tag from the request header, decoded like the database does. */
function readTag(headers: Headers): { type: string; level: string; requestId: string; fiat?: boolean; reason?: string | null } | null {
  const value = headers.get('x-grimoire-command');
  if (!value) return null;
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { type: string; level: string; requestId: string; fiat?: boolean; reason?: string | null; whatFor?: unknown };
    // Like the database: a purse line's own words come from the function, never from the header (dec-6b review).
    delete parsed.whatFor;
    return parsed;
  } catch {
    return null;
  }
}


/** Like the database (M5 step 6): a line kept for Downtime reaches members once the campaign has gone into Downtime after it. */
function revealedEvent(tables: FakeWorld['tables'], event: Row): boolean {
  if (event.reveal_at !== 'downtime') return true;
  // A revealed check result's lines (open, in Downtime, or by the GM's hand).
  if (event.target_table === 'check_results' && tables.check_results.some((r) => r.id === event.target_id && r.revealed && !r.undone)) return true;
  return tables.events.some(
    (d) => d.campaign_id === event.campaign_id && Number(d.seq) > Number(event.seq) && d.target_table === 'campaigns' && (d.after as Row | null)?.mode === 'downtime',
  );
}

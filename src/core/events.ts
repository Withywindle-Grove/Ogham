// Reading the event log: loading entries a person may see (the database's rules decide), grouping everything
// one action did into one line, and saying each line in plain words. Live updates come through Realtime.
import type { Db } from './supabase.ts';
import { shownWords } from './storedWords.ts';
import type { LogLevel } from './eventTags.ts';
import { moveWords, readRows } from './marchingRows.ts';
import { groupName, groupWords } from './partyGroups.ts';
import { MOVE_ON_WORDS } from './moveWords.ts';
import { timeWords } from './timeWords.ts';
import { TRAVEL_PLACE_WORDS } from './travelWords.ts';
import { isJoin } from './undo.ts';
import { oneUpVerb, usedWords } from './useWords.ts';
import { ENCUMBRANCE_WORDS, isEncumbranceMode } from './campaignSettings.ts';

export interface LogEvent {
  id: string;
  seq: number;
  type: string;
  level: LogLevel;
  actorUserId: string | null;
  targetTable: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fiat: boolean;
  reason: string | null;
  revertsEventId: string | null;
  requestId: string | null;
  createdAt: string;
  /** For a group's line (fm-1): which group of the party it is for. A change's values don't repeat the group. */
  groupNumber?: number | null;
}

/** One line in the log: everything one action did, led by its main change. */
export interface LogEntry {
  main: LogEvent;
  events: LogEvent[];
}

/** Names to put in sentences, from what the reader can see. */
export interface LogNames {
  /** The reader, who is "You". */
  me: string;
  people: Map<string, string>;
  characters: Map<string, string>;
  companies: Map<string, string>;
  fields: Map<string, string>;
  /** Setting rules attached to the campaign, by the link's id. */
  packs: Map<string, string>;
  /** Inventory lines' item names, by line id (from M4). */
  items: Map<string, string>;
  /**
   * Inventory lines' kinds, by line id (Design on #552): what an item.use that counted a stack down was ("fired", "ate"),
   * since a count's change logs only the count. A line deleted by its last use keeps its kind in the log's copy.
   */
  itemKinds?: Map<string, { category: string; details: Record<string, unknown>; stack: number; qty?: number }>;
  /**
   * Where inventory lines are, by line id (Q2): a join's change logs only the stack's count, so its line says where the
   * stack is from this (a line that is gone: the log's last copy of it).
   */
  itemPlaces?: Map<string, { actor_id: unknown; location_id: unknown; container_line_id: unknown }>;
  /** Places items are kept, like the Party stash, by id (from M4). */
  places: Map<string, string>;
  /** Which of those places is the party stash (its kind; K28): a move out of another place is not a Take. */
  stashIds?: Set<string>;
  /**
   * A find's hoards by id, as the reader may read them (K28's requirement on K16a and K16b; loaded once hoards exist):
   * a reader the hoard's place wasn't shown to has none, and the line then names no hoard.
   */
  hoards?: Map<string, string>;
  /** The kinds of the events on the page, by id: what an undo undid ("a drop", "a gift"). */
  eventTypes?: Map<string, string>;
  /** Characters' lights by the light row's id (M5 step 7): whose it is and what it is now. */
  lights?: Map<string, { who: string; name: string }>;
  /** Statuses by id (M5 step 9): whose it is and its name (its level's, for one with levels). */
  statuses?: Map<string, { who: string; name: string }>;
  /** Rest rows by id (M5 step 9): whose they are. */
  rests?: Map<string, string>;
  /** Places by id (M5 step 11; the GM reads them all, a player only one shown to them). */
  placeNames?: Map<string, string>;
  /** Where a group is, by the row's id: the place's id. */
  groupPlaces?: Map<string, string>;
  /** Messages from the GM the reader may read, by id: the text (M5 step 11). */
  messages?: Map<string, string>;
  /** A place's pieces by id: their text (M5b g2; the GM's alone). */
  pieces?: Map<string, string>;
  /** Which piece and group each Show row is for (M5b g2; the GM's alone). */
  pieceShows?: Map<string, { piece: string; group: number }>;
  /** Expeditions whose end the GM answered In a safe place? with Yes (m8b-0 delivery 5): End's line says so. */
  safeEnds?: Set<string>;
  /** The expeditions' changes that were undone, by event id: an End undone never reads "in a safe place". */
  undoneExpeditionChanges?: Set<string>;
  /** Spells' names by their pack id (dec-8 piece A), when the reader's screen has them; a cast's line names the spell. */
  spells?: Map<string, string>;
  /** Sheet changes by id (plan m5b-sheet-revised B): whose, what and to what, for the answer's line. */
  sheetChanges?: Map<string, { actorId: string; label: string; to: number }>;
  /** Purses the reader may read, by id (December step 6b): whose (a character, or the stash when actorId is null). */
  purses?: Map<string, { actorId: string | null }>;
  /**
   * An amount of one coin in the setting's words ("40 herons"), passed in by the screen (core doesn't read the setting
   * or import a module); left out, the coin shows by its key ("40 heron").
   */
  coinAmount?: (key: string, n: number) => string;
  /** The campaign's GMs by user id (December step 6b): the GM's coin moves read as the GM's, never a character's. */
  gms?: Set<string>;
  /**
   * Moves between linked places (Move on, December step 4), by the id of the move's clock change: its turns and the
   * names of the place arrived at and the place left, as the reader may have them (public.party_moves: a player gets
   * a name only once that place has been shown to their group; null until then).
   */
  partyMoves?: Map<string, { turns: number; to: string | null; from: string | null }>;
}

const UNDONE_KIND: Record<string, string> = { 'item.use': 'a use', 'inventory.remove': 'a drop', 'inventory.empty': 'a drop', 'inventory.giveAway': 'a gift', 'inventory.decline': 'a decline' };

const PAGE = 60;

const EVENT_COLUMNS = 'id, seq, type, level, actor_user_id, target_table, target_id, before, after, fiat, reason, reverts_event_id, request_id, created_at, group_number';

type EventRow = {
  id: string;
  seq: number;
  type: string;
  level: string;
  actor_user_id: string | null;
  target_table: string;
  target_id: string | null;
  before: unknown;
  after: unknown;
  fiat: boolean;
  reason: string | null;
  reverts_event_id: string | null;
  request_id: string | null;
  created_at: string;
  group_number?: number | null;
};

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function toLogEvent(row: EventRow): LogEvent {
  return {
    id: row.id,
    seq: row.seq,
    type: row.type,
    level: row.level === 'verbose' ? 'verbose' : 'simple',
    actorUserId: row.actor_user_id,
    targetTable: row.target_table,
    targetId: row.target_id,
    before: asRecord(row.before),
    after: asRecord(row.after),
    fiat: row.fiat,
    reason: row.reason,
    revertsEventId: row.reverts_event_id,
    requestId: row.request_id,
    createdAt: row.created_at,
    groupNumber: typeof row.group_number === 'number' ? row.group_number : null,
  };
}

/**
 * The newest events this person may see, newest first: simple ones only, or every one with `verbose`.
 * `olderThan` (a seq) loads the page before it. Null if they couldn't be loaded.
 */
export async function loadLog(
  db: Db,
  campaignId: string,
  options: { verbose?: boolean; olderThan?: number } = {},
): Promise<{ events: LogEvent[]; more: boolean } | null> {
  let query = db
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('campaign_id', campaignId)
    .in('level', options.verbose ? ['simple', 'verbose'] : ['simple']);
  if (options.olderThan !== undefined) query = query.lt('seq', options.olderThan);
  const { data, error } = await query.order('seq', { ascending: false }).limit(PAGE + 1);
  if (error) return null;
  const rows = data as EventRow[];
  return { events: rows.slice(0, PAGE).map(toLogEvent), more: rows.length > PAGE };
}

/**
 * Every line one command wrote in a campaign that the reader may read, with the lines that reversed them, oldest first
 * (B15: the hoard's "Sent to …" and where a found thing is now, read from the GM's send lines). Null on error.
 */
export async function loadCommandLog(db: Db, campaignId: string, type: string): Promise<LogEvent[] | null> {
  const lines = await db.from('events').select(EVENT_COLUMNS).eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: true });
  if (lines.error) return null;
  const rows = lines.data as EventRow[];
  const ids = rows.map((r) => r.id);
  const back = ids.length > 0 ? await db.from('events').select(EVENT_COLUMNS).eq('campaign_id', campaignId).in('reverts_event_id', ids) : { data: [], error: null };
  if (back.error) return null;
  const seen = new Set(ids);
  return [...rows, ...(back.data as EventRow[]).filter((r) => !seen.has(r.id))].map(toLogEvent).sort((a, b) => a.seq - b.seq);
}

/**
 * One row's history (the Status ring's sheet, plan m5b-creation-retest-3 F: "Set by" and its log line): every log
 * entry with an event on that row, newest first, each with all the events of its request. Null on error.
 */
export async function loadTargetLog(db: Db, campaignId: string, targetTable: string, targetId: string): Promise<LogEntry[] | null> {
  const touching = await db.from('events').select(EVENT_COLUMNS).eq('campaign_id', campaignId).eq('target_table', targetTable).eq('target_id', targetId).order('seq', { ascending: true });
  if (touching.error) return null;
  const rows = (touching.data ?? []) as EventRow[];
  const requests = [...new Set(rows.flatMap((r) => (r.request_id ? [r.request_id] : [])))];
  const withRequests = requests.length > 0 ? await db.from('events').select(EVENT_COLUMNS).eq('campaign_id', campaignId).in('request_id', requests) : { data: [], error: null };
  if (withRequests.error) return null;
  const byId = new Map<string, EventRow>();
  for (const row of [...rows, ...((withRequests.data ?? []) as EventRow[])]) byId.set(row.id, row);
  return groupEntries([...byId.values()].map(toLogEvent));
}

/** Names of the people, characters, companies and fields the reader can see in this campaign. */
export async function loadLogNames(db: Db, campaignId: string, me: string): Promise<LogNames> {
  const [members, actors, companies, fields, packs, items, places, lights, statuses, rests, placeNames, groupPlaces, messages, pieces, pieceShows, safeEnds, sheetChanges, purses, partyMoves, goneLines, expeditionEvents] = await Promise.all([
    db.from('members').select('user_id, base_role, profiles!members_user_id_fkey(display_name)').eq('campaign_id', campaignId),
    db.from('actors').select('id, name').eq('campaign_id', campaignId),
    db.from('companies').select('id, name').eq('campaign_id', campaignId),
    db.from('field_definitions').select('id, label').eq('campaign_id', campaignId),
    db.from('campaign_packs').select('id, pack_name').eq('campaign_id', campaignId),
    db.from('inventory_lines').select('id, name, category, item_data, stack, qty, actor_id, location_id, container_line_id').eq('campaign_id', campaignId),
    db.from('locations').select('id, name, kind').eq('campaign_id', campaignId),
    db.from('character_lights').select('id, actor_id, name').eq('campaign_id', campaignId),
    db.from('character_statuses').select('id, actor_id, name, levels, level').eq('campaign_id', campaignId),
    db.from('character_rests').select('id, actor_id').eq('campaign_id', campaignId),
    db.from('places').select('id, name').eq('campaign_id', campaignId),
    db.from('group_places').select('id, place_id').eq('campaign_id', campaignId),
    db.from('gm_messages').select('id, body').eq('campaign_id', campaignId),
    db.from('place_pieces').select('id, body').eq('campaign_id', campaignId),
    db.from('piece_shows').select('id, piece_id, group_number').eq('campaign_id', campaignId),
    db.from('expeditions').select('id').eq('campaign_id', campaignId).eq('ended_safe', true),
    db.from('sheet_changes').select('id, actor_id, label, to_value').eq('campaign_id', campaignId),
    // December step 6b: only the purses the reader may read (the read rule decides), so a line names whose it is.
    db.from('purses').select('id, actor_id').eq('campaign_id', campaignId),
    db.rpc('party_moves', { campaign: campaignId }),
    // The log's copies of item lines that are gone (used up, dropped, given out of the party), oldest first: earlier
    // lines keep their names and kinds ("fired a reed arrow", not "used an item"; the #552 look-back). Read under the
    // log's own rules, so a reader gets only copies already in their log.
    db.from('events').select('target_id, before, seq').eq('campaign_id', campaignId).eq('target_table', 'inventory_lines').is('after', null).order('seq', { ascending: true }),
    // The expeditions' changes the reader may see, for which were undone: an End that was undone isn't the one the
    // GM answered In a safe place? for.
    db.from('events').select('reverts_event_id').eq('campaign_id', campaignId).eq('target_table', 'expeditions'),
  ]);
  const characters = new Map((actors.data ?? []).map((a) => [a.id, a.name]));
  const lines = itemLinesWithGone(items.data ?? [], goneLines.data ?? []);
  return {
    me,
    people: new Map((members.data ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? 'Someone'])),
    gms: new Set((members.data ?? []).filter((m) => m.base_role === 'gm').map((m) => m.user_id)),
    characters,
    companies: new Map((companies.data ?? []).map((c) => [c.id, c.name])),
    fields: new Map((fields.data ?? []).map((f) => [f.id, f.label])),
    packs: new Map((packs.data ?? []).map((p) => [p.id, p.pack_name])),
    items: new Map(lines.map((i) => [i.id, i.name])),
    itemKinds: new Map(
      lines.map((i) => [i.id, { category: String(i.category ?? ''), details: (i.item_data && typeof i.item_data === 'object' ? i.item_data : {}) as Record<string, unknown>, stack: Number(i.stack ?? 1), qty: Number(i.qty ?? 1) }]),
    ),
    itemPlaces: new Map(lines.map((i) => [i.id, { actor_id: i.actor_id, location_id: i.location_id, container_line_id: i.container_line_id }])),
    places: new Map((places.data ?? []).map((l) => [l.id, l.name])),
    stashIds: new Set((places.data ?? []).filter((l) => l.kind === 'stash').map((l) => l.id)),
    lights: new Map((lights.data ?? []).map((l) => [l.id, { who: characters.get(l.actor_id) ?? '', name: l.name }])),
    statuses: new Map((statuses.data ?? []).map((st) => [st.id, { who: characters.get(st.actor_id) ?? '', name: statusRowName(st) }])),
    rests: new Map((rests.data ?? []).map((r) => [r.id, characters.get(r.actor_id) ?? ''])),
    placeNames: new Map((placeNames.data ?? []).map((p) => [p.id, p.name])),
    groupPlaces: new Map((groupPlaces.data ?? []).flatMap((g) => (g.place_id ? [[g.id, g.place_id] as [string, string]] : []))),
    messages: new Map((messages.data ?? []).map((m) => [m.id, m.body])),
    pieces: new Map((pieces.data ?? []).map((p) => [p.id, p.body])),
    pieceShows: new Map((pieceShows.data ?? []).map((sh) => [sh.id, { piece: sh.piece_id, group: sh.group_number }])),
    safeEnds: new Set((safeEnds.data ?? []).map((x) => x.id)),
    undoneExpeditionChanges: new Set((expeditionEvents.data ?? []).flatMap((e) => (e.reverts_event_id ? [e.reverts_event_id] : []))),
    sheetChanges: new Map((sheetChanges.data ?? []).map((c) => [c.id, { actorId: c.actor_id, label: c.label, to: c.to_value }])),
    purses: new Map((purses.data ?? []).map((p) => [p.id, { actorId: p.actor_id }])),
    partyMoves: new Map((partyMoves.data ?? []).map((m) => [m.clock_event_id, { turns: m.turns, to: m.to_name || null, from: m.from_name || null }])),
  };
}

type ItemLineNames = { id: string; name: string; category: unknown; item_data: unknown; stack: unknown; qty: unknown; actor_id?: unknown; location_id?: unknown; container_line_id?: unknown };

/**
 * The item lines a log line can name: the ones there now and, for a line that is gone, the newest copy the log kept of
 * it (`gone` oldest first, so a later copy wins). A line there now always wins over a copy.
 */
export function itemLinesWithGone(current: readonly ItemLineNames[], gone: readonly { target_id: string | null; before: unknown }[]): ItemLineNames[] {
  const byId = new Map<string, ItemLineNames>();
  for (const event of gone) {
    const copy = event.before && typeof event.before === 'object' && !Array.isArray(event.before) ? (event.before as Record<string, unknown>) : null;
    if (!event.target_id || !copy || typeof copy.name !== 'string') continue;
    byId.set(event.target_id, {
      id: event.target_id,
      name: copy.name,
      category: copy.category,
      item_data: copy.item_data,
      stack: copy.stack,
      qty: copy.qty,
      actor_id: copy.actor_id,
      location_id: copy.location_id,
      container_line_id: copy.container_line_id,
    });
  }
  for (const line of current) byId.set(line.id, line);
  return [...byId.values()];
}

/** A status row's name as shown: its level's, for one with levels. */
function statusRowName(row: { name?: unknown; levels?: unknown; level?: unknown }): string {
  const levels = Array.isArray(row.levels) ? (row.levels as { name?: unknown }[]) : null;
  const at = typeof row.level === 'number' ? row.level : 0;
  const level = levels?.[Math.max(0, Math.min(levels.length - 1, at))]?.name;
  return typeof level === 'string' && level ? level : String(row.name ?? '');
}

/**
 * Calls `onNew` whenever an event this person may see is written in the campaign (Supabase Realtime, which
 * applies the same rules as reading); `onReady` once listening has started. Returns a function that stops listening.
 */
export function watchLog(db: Db, campaignId: string, onNew: (event?: { targetTable?: string }) => void, onReady?: () => void): () => void {
  const channel = db
    .channel(`log-${campaignId}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `campaign_id=eq.${campaignId}` }, (payload?: { new?: Record<string, unknown> }) =>
      onNew({ targetTable: typeof payload?.new?.target_table === 'string' ? payload.new.target_table : undefined }),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onReady?.();
    });
  return () => {
    void db.removeChannel(channel);
  };
}

/**
 * Calls `onChange` whenever a row this person may read changes in one of these tables of the campaign (Supabase
 * Realtime applies the same rules as reading). For what reaches players without a log line of theirs (M5 step 11: a
 * place the GM shows or hides, a message that burns after reading). Returns a function that stops listening.
 */
export function watchRows(db: Db, campaignId: string, tables: readonly string[], onChange: (table: string) => void): () => void {
  let channel = db.channel(`rows-${campaignId}-${crypto.randomUUID()}`);
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` }, () => onChange(table));
  }
  channel.subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

// Which change leads a line when one action changed several things.
const MAIN_TABLES = ['activity_runs', 'messages', 'gm_messages', 'message_recipients', 'check_results', 'reminders', 'expeditions', 'sessions', 'campaign_clocks', 'character_lights', 'character_statuses', 'character_rests', 'marching_orders', 'party_group_members', 'actors', 'character_alignments', 'campaigns', 'companies', 'field_definitions', 'invites', 'assets', 'members', 'actor_secrets', 'library_entries', 'group_places', 'places'];

/**
 * Where a find was found and whom it went to (K28), from the reason K16b's find command writes on each of its events:
 * `{"find":{"to":"<character id>" | null,"placeId":"…","hoardId"?:"…","coin"?:true}}` (`to` null: the party stash).
 * Ids only, never names nor an amount: the reason reaches every reader of the line, and each reader's own names say
 * the place and hoard only where they were shown them. Empty when no event carries it.
 */
function findOf(entry: LogEntry): { to: string | null; placeId: string | null; hoardId: string | null; coin: boolean } {
  // K16b (rp-4, the lead on #828): the party's lines carry no place; the GM's own line of the send does. The reader
  // takes the line that names the place when it can read one (the GM), else the first find it reads.
  const found = entry.events.map((e) => findIn(e)).filter((f) => f !== null);
  return found.find((f) => f.placeId !== null) ?? found[0] ?? { to: null, placeId: null, hoardId: null, coin: false };
}

function findIn(e: LogEvent): { to: string | null; placeId: string | null; hoardId: string | null; coin: boolean } | null {
  if (!e.reason?.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(e.reason) as { find?: Record<string, unknown> };
    const find = parsed.find;
    if (!find || typeof find !== 'object') return null;
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return { to: typeof find.to === 'string' ? find.to : null, placeId: text(find.placeId), hoardId: text(find.hoardId), coin: find.coin === true };
  } catch {
    return null; // Not a find's reason.
  }
}

/**
 * How a thing that joined a stack was got (Q2): public.join_added_line writes it on the add's own line as its reason,
 * `{"join":{"howGot":"bought","cost":"6 cp","note":"…"}}`; null when the line carries none.
 */
function joinOf(e: LogEvent): { howGot: string; cost: string; note: string } | null {
  if (!e.reason?.startsWith('{')) return null;
  try {
    const join = (JSON.parse(e.reason) as { join?: Record<string, unknown> }).join;
    if (!join || typeof join !== 'object') return null;
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    return { howGot: text(join.howGot) || 'found', cost: text(join.cost), note: text(join.note) };
  } catch {
    return null; // Not a join's reason.
  }
}

/** Groups events into lines (one per action), newest first. */
export function groupEntries(events: LogEvent[]): LogEntry[] {
  const groups = new Map<string, LogEvent[]>();
  for (const event of events) {
    const key = event.requestId ?? event.id;
    const group = groups.get(key);
    if (group) group.push(event);
    else groups.set(key, [event]);
  }
  const rank = (event: LogEvent) => {
    const at = MAIN_TABLES.indexOf(event.targetTable);
    return at === -1 ? MAIN_TABLES.length : at;
  };
  return [...groups.values()]
    .map((group) => {
      const ordered = [...group].sort((a, b) => a.seq - b.seq);
      const main = [...ordered].sort((a, b) => rank(a) - rank(b) || a.seq - b.seq)[0]!;
      return { main, events: ordered };
    })
    .sort((a, b) => Math.max(...b.events.map((e) => e.seq)) - Math.max(...a.events.map((e) => e.seq)));
}

// Words for a character's changed values.
const COLUMN_WORDS: Record<string, string> = {
  name: 'name',
  level: 'level',
  hp_current: 'HP',
  hp_max: 'HP max',
  backstory: 'backstory',
  notes: 'notes',
  fields: 'details',
  portrait_asset_id: 'portrait',
  company_id: 'company',
  classes: 'class',
  race_ref: 'race',
  approval: 'approval',
  status: 'status',
  // M5b step 0c: the alignment's own row, and the spell book.
  alignment: 'alignment',
  spell_book: 'spell book',
  // G-208: the expertise points spent ("edited Sedge's expertise").
  expertise: 'expertise',
};

const changedWords = (values: Record<string, unknown>) =>
  Object.entries(COLUMN_WORDS)
    .filter(([key]) => key in values)
    .map(([, word]) => word);

/** "Wren's", but "Wren of the Wardens'". */
const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

/** The review note an approval writes when it allowed exceptions (final drafts D): "Allowed: Croak and Starting coin 190". */
export const ALLOWED_PREFIX = 'Allowed: ';

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? 'details';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)!}`;
}

// K22b: the words of a told fact (pictures 6 of K22h and 4 of K22c). A tell changes one line; the facts it told are the
// revealed fields it added (an Undo's are those it took away), read beside the line's details as they stood after it.
const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const listOf = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const signedWords = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** The facts in `more` and not in `less` (what a tell added, or an Undo took away), "magic" first. */
function factsBetween(more: unknown, less: unknown): string[] {
  const had = new Set(listOf(less));
  return listOf(more).filter((f) => !had.has(f));
}

/** A bonus as the line now carries it: the setting's own words, else the magic bonus, else its first bonus against a foe. */
function bonusPhrase(details: Record<string, unknown>): { gives: string } | { bare: string } | null {
  if (typeof details.bonus === 'string' && details.bonus.trim()) return { gives: details.bonus.trim() };
  for (const block of ['weapon', 'armour']) {
    const part = details[block];
    if (isObj(part) && typeof part.magicBonus === 'number') return { bare: signedWords(part.magicBonus) };
  }
  for (const block of ['weapon', 'armour']) {
    const part = details[block];
    const vs = isObj(part) && Array.isArray(part.bonusVs) ? part.bonusVs.find(isObj) : undefined;
    const n = vs ? (typeof vs.bonus === 'number' ? vs.bonus : typeof vs.damage === 'number' ? vs.damage : null) : null;
    if (vs && typeof vs.against === 'string' && n !== null) return { bare: `${signedWords(n)} against ${vs.against}` };
  }
  return null;
}

/** The powers a line carries now that it didn't before, by name. */
function newPowers(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const had = new Set((Array.isArray(before.properties) ? before.properties : []).map((p) => JSON.stringify(p)));
  return (Array.isArray(after.properties) ? after.properties : [])
    .filter((p) => !had.has(JSON.stringify(p)))
    .map((p) => (isObj(p) && typeof p.name === 'string' ? p.name : typeof p === 'string' ? p : ''))
    .filter(Boolean);
}

/** One told fact as the end of "the Bronze ring …" ("is cursed", "gives +1 to saves", "’s Maker’s mark: …"). */
function factPhrase(fact: string, details: Record<string, unknown>, beforeDetails: Record<string, unknown>, charges: unknown): string {
  if (fact === 'magic') return ' is magic';
  if (fact === 'cursed') return ' is cursed';
  if (fact === 'bonus') {
    const bonus = bonusPhrase(details);
    return bonus === null ? ' has a bonus' : 'gives' in bonus ? ` gives ${bonus.gives}` : ` has a bonus of ${bonus.bare}`;
  }
  if (fact.startsWith('power:')) {
    const power = newPowers(beforeDetails, details)[0];
    return power ? ` has a power: ${power}` : ' has a power';
  }
  if (fact === 'charges') return typeof charges === 'number' ? ` has ${charges} ${charges === 1 ? 'charge' : 'charges'} left` : '’s charges';
  if (fact.startsWith('fields.')) {
    const label = fact.slice(7);
    const value = isObj(details.fields) ? details.fields[label] : undefined;
    return typeof value === 'string' || typeof value === 'number' ? `’s ${label}: ${String(value)}` : `’s ${label}`;
  }
  return '';
}

/** What a reader learns of a fact undone, for the GM's Undo line ("that the Bronze ring is cursed", "its true name"). */
function hiddenAgainPhrase(fact: string, item: string): string {
  if (fact === 'magic' || fact === 'cursed') return `that the ${item} is ${fact}`;
  if (fact === 'name') return `the ${item}’s true name`;
  if (fact === 'bonus') return `the ${item}’s bonus`;
  if (fact === 'charges') return `the ${item}’s charges`;
  if (fact.startsWith('power:')) return `a power of the ${item}`;
  if (fact.startsWith('fields.')) return `the ${item}’s ${fact.slice(7)}`;
  return `what was told about the ${item}`;
}

/**
 * "Out and about ended", "Out and about and Active tonight ended": the town switches a reset turned off (M5b step 6.0,
 * sw-3; the words match the module's townSwitches.ts endedWords, which core can't import). Null when none was on.
 */
function townEnded(before: { outDay: boolean; activeNight: boolean }): string | null {
  const names = [before.outDay ? 'Out and about' : '', before.activeNight ? 'Active tonight' : ''].filter(Boolean);
  return names.length ? `${names.join(' and ')} ended` : null;
}

/** What a "setting rules updated" line lists, from every part of it this person can see (the GM sees more). */
export function packUpdateLists(entry: LogEntry): { added: string[]; changed: string[]; removed: string[] } {
  const lists = { added: [] as string[], changed: [] as string[], removed: [] as string[] };
  for (const event of entry.events) {
    if (event.type !== 'library.update') continue;
    for (const part of ['added', 'changed', 'removed'] as const) {
      const names = event.after?.[part];
      // The names as stored (a patch's keeps " · "), as a person reads them.
      if (Array.isArray(names)) lists[part].push(...names.map((n) => shownWords(String(n))));
    }
  }
  return lists;
}

/** The caller (mc-76; S12), when a campaigns write changed it: the new caller's id, null for none; undefined if unchanged. */
function callerChanged(entry: LogEntry): string | null | undefined {
  const write = entry.events.find((e) => e.targetTable === 'campaigns');
  if (!write) return undefined;
  const callerOf = (row: Record<string, unknown> | null) => {
    const settings = row?.settings;
    const value = settings && typeof settings === 'object' ? (settings as { caller?: unknown }).caller : undefined;
    return typeof value === 'string' ? value : null;
  };
  const was = callerOf(write.before);
  const now = callerOf(write.after);
  return was === now ? undefined : now;
}

/** The `ruleKey` group picks that changed in an entry's campaign settings write (07: one choice per group), as topics. */
function ruleGroupsChanged(entry: LogEntry): { added: string[]; removed: string[]; changed: string[] } {
  const none = { added: [], removed: [], changed: [] };
  const write = entry.events.find((e) => e.targetTable === 'campaigns');
  if (!write) return none;
  const picks = (row: Record<string, unknown> | null) => {
    const settings = row?.settings;
    const groups = settings && typeof settings === 'object' ? (settings as { ruleGroups?: unknown }).ruleGroups : undefined;
    return groups && typeof groups === 'object' && !Array.isArray(groups) ? (groups as Record<string, unknown>) : {};
  };
  const was = picks(write.before);
  const now = picks(write.after);
  const topic = (key: string) => key.replace(/[-_]+/g, ' ');
  return {
    added: Object.keys(now).filter((key) => !(key in was)).map(topic),
    removed: Object.keys(was).filter((key) => !(key in now)).map(topic),
    changed: Object.keys(now).filter((key) => key in was && was[key] !== now[key]).map(topic),
  };
}

/** A weapon mode's name from an item's `weapon.modes` (07, G-211); null when the item doesn't list it (never the id). */
function modeNameOf(details: Record<string, unknown>, id: string): string | null {
  const weapon = details.weapon && typeof details.weapon === 'object' ? (details.weapon as Record<string, unknown>) : {};
  const modes = weapon.modes && typeof weapon.modes === 'object' ? (weapon.modes as Record<string, unknown>) : {};
  const found = (Array.isArray(modes.list) ? modes.list : []).find((m): m is Record<string, unknown> => !!m && typeof m === 'object' && (m as Record<string, unknown>).id === id);
  return typeof found?.name === 'string' && found.name.trim() ? found.name.trim() : null;
}

/** One log line in plain words, e.g. "Sam set Wren's HP to 9 (was 11)." */
export function describeEntry(entry: LogEntry, names: LogNames): string {
  const { main } = entry;
  const before = main.before ?? {};
  const after = main.after ?? {};
  const who =
    main.actorUserId === null ? null : main.actorUserId === names.me ? 'You' : (names.people.get(main.actorUserId) ?? 'Someone');
  const named = (map: Map<string, string>, id: unknown, fallback: string) =>
    (typeof id === 'string' ? map.get(id) : undefined) ?? fallback;
  const thing = (map: Map<string, string>, fallback: string) =>
    String(after.name ?? before.name ?? '') || named(map, main.targetId, fallback);
  const character = () => named(names.characters, main.targetId, '') || String(after.name ?? before.name ?? 'a character');
  const company = (id: unknown) => named(names.companies, id, 'a company');
  const field = () => String(after.label ?? before.label ?? '') || named(names.fields, main.targetId, 'a field');
  // The pack's link, even when the entry's main event is the campaign's settings (a ruleKey pick pinned or cleared).
  const packEvent = main.targetTable === 'campaign_packs' ? main : (entry.events.find((e) => e.targetTable === 'campaign_packs') ?? main);
  const pack = () =>
    String(packEvent.after?.pack_name ?? packEvent.before?.pack_name ?? '') || named(names.packs, packEvent.targetId, 'setting rules');
  // A homebrew entry's name: its own, or the one inside its data (a change logs only what changed).
  const entryName = () => {
    const inData = (row: Record<string, unknown>) => (row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>).name : undefined);
    const fallback = main.targetTable === 'library_entry_secrets' ? 'the hidden details of an entry' : 'an entry';
    return String(after.name ?? inData(after) ?? before.name ?? inData(before) ?? fallback);
  };
  const by = (sentence: string) => `${who ?? 'Someone'} ${sentence}.`;
  // Travel (M5b step 1): the group a travel row is for, and the pack's unit word ("points" unless the row says). A
  // change's values don't repeat the group, so the line's own group (fm-1) says which it was.
  const travelGroup = (row: Record<string, unknown>, event?: LogEvent) => {
    const group = typeof row.group_number === 'number' ? row.group_number : (event?.groupNumber ?? null);
    return group !== null && group !== 1 ? groupName(group) : 'the party';
  };
  // The place a group is entering, by name (fm-1), as it was `before` or `after` the change. The GM's own name for it
  // is in the GM-only part of the travel row (travel_group_secrets), whose line only the GM's log holds; the travel
  // row itself holds what the group's players may read: the place's players' name once it has been shown to them, else
  // nothing, and the line then says "the next place". (A travel line older than fm-1 is the GM's alone and names the
  // place in the travel row.)
  const enteringName = (which: 'before' | 'after', row: Record<string, unknown>): string | null => {
    const kept = entry.events.find((e) => e.targetTable === 'travel_group_secrets')?.[which];
    const gmName = typeof kept?.pending_place_name === 'string' && kept.pending_place_name ? kept.pending_place_name : null;
    return gmName ?? (typeof row.pending_place_name === 'string' && row.pending_place_name ? row.pending_place_name : null);
  };
  // The log doesn't know the pack's unit word: points.
  const unitWord = () => 'points';
  // A place the entry set on arrival (the group_places row a move made), by name.
  const placeFromEntry = () => {
    const made = entry.events.find((e) => e.targetTable === 'group_places' && e.before === null)?.after;
    return made ? named(names.placeNames ?? new Map(), made.place_id, '') : '';
  };
  // Where a group is (M5 step 11): its place's name, from the group's row.
  const groupPlaceName = (id: unknown) => {
    const placeId = typeof id === 'string' ? names.groupPlaces?.get(id) : undefined;
    return named(names.placeNames ?? new Map(), placeId, 'the place');
  };
  // An inventory line: its item's name, "×3" when there's more than one, and where it's carried.
  const item = (row: Record<string, unknown> = after, id: unknown = main.targetId) =>
    String(row.name ?? '') || named(names.items, id, 'an item');
  const counted = (name: string, qty: unknown) => (typeof qty === 'number' && qty > 1 ? `${name} ×${qty}` : name);
  // A count in the item's own words (K28; as the Pack's countWords says it, kept here as core imports no module): its
  // `unitName` for one and `pluralName` for more ("2 torches"), else "Torch ×2".
  const pieces = (name: string, details: unknown, qty: unknown) => {
    const data = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>;
    const word = (key: string) => (typeof data[key] === 'string' && String(data[key]).trim() ? String(data[key]).trim() : null);
    const n = typeof qty === 'number' && qty > 1 ? qty : 1;
    if (n === 1) return word('unitName') ?? name;
    const many = word('pluralName');
    return many ? `${n} ${many}` : `${name} ×${n}`;
  };
  const carrier = (row: Record<string, unknown>) =>
    row.location_id ? `the ${named(names.places, row.location_id, 'Party stash')}` : named(names.characters, row.actor_id, 'a character');
  // Where a line was or is: "Wren's pack", or "the Party stash".
  const packOf = (row: Record<string, unknown>) => (row.location_id ? carrier(row) : `${possessive(carrier(row))} pack`);
  const backWith = (row: Record<string, unknown>) => (row.location_id ? `back in ${carrier(row)}` : `back with ${carrier(row)}`);
  // A light, as "Ash's torch": its character's, and its name (the one the change gave it, else the one it has now).
  const lightName = (e: LogEvent = main) => {
    const known = typeof e.targetId === 'string' ? names.lights?.get(e.targetId) : undefined;
    const what = String(e.after?.name ?? e.before?.name ?? known?.name ?? '').trim().toLowerCase() || 'light';
    return known?.who ? `${possessive(known.who)} ${what}` : `a ${what}`;
  };
  // The lights a time move burnt out (not those Keep lit lit again), for "Ran out with the clock: …".
  const burntOut = () =>
    entry.events.filter((e) => e.targetTable === 'character_lights' && e.type === 'light.burnOut' && e.after?.out_at != null && e.after?.lit_at == null).map((e) => lightName(e));
  // A status, as "Weary on Ash" (M5 step 9): its name (what the change gave it, else what it has now) and whose.
  const statusName = (e: LogEvent = main, joiner = 'on') => {
    const known = typeof e.targetId === 'string' ? names.statuses?.get(e.targetId) : undefined;
    const made = e.before === null && e.after ? statusRowName(e.after) : '';
    const who = known?.who || (typeof e.after?.actor_id === 'string' ? (names.characters.get(e.after.actor_id) ?? '') : '');
    const what = made || known?.name || 'a status';
    return who ? `${what} ${joiner} ${who}` : what;
  };
  // What a time move ended (M5 step 9): statuses whose timers ran out, and who rested.
  const timerEnds = () => entry.events.filter((e) => e.targetTable === 'character_statuses' && e.type === 'status.timerEnd').map((e) => statusName(e));
  const restedNames = () =>
    entry.events.filter((e) => e.targetTable === 'character_rests' && e.type === 'rest.taken').map((e) => (typeof e.targetId === 'string' ? names.rests?.get(e.targetId) : undefined) || 'someone');
  // The shared rest flow applied with a Next turn (M5b g6, B5): one record of who rested, who pushed on (with the
  // condition they now carry) and who called it. "Rest called by Wren · rested: everyone".
  const restRecord = (): string | null => {
    const rows = entry.events.filter((e) => e.targetTable === 'character_rests' && e.type === 'rest.applied');
    if (rows.length === 0) return null;
    const restName = (e: LogEvent) => (typeof e.targetId === 'string' ? names.rests?.get(e.targetId) : undefined) || 'someone';
    const rested = rows.filter((e) => e.after?.rested_at != null).map(restName);
    const pushed = rows.filter((e) => e.after?.rested_at == null);
    const marks = new Map<string, string>();
    for (const e of entry.events.filter((x) => x.targetTable === 'character_statuses' && x.type === 'rest.applied' && x.after?.ended_at == null)) {
      const known = typeof e.targetId === 'string' ? names.statuses?.get(e.targetId) : undefined;
      const actor = typeof e.after?.actor_id === 'string' ? e.after.actor_id : null;
      const who = known?.who || (actor ? (names.characters.get(actor) ?? '') : '');
      const what = (e.before === null && e.after ? statusRowName(e.after) : '') || known?.name || 'the condition';
      const stacks = typeof e.after?.stacks === 'number' ? e.after.stacks : 1;
      if (who) marks.set(who, `${what} ×${stacks}`);
    }
    const caller = rows.map((e) => e.before?.called_by).find((id): id is string => typeof id === 'string');
    const calledBy = caller ? names.characters.get(caller) : undefined;
    const pushedWords = pushed.map((e) => {
      const who = restName(e);
      const mark = marks.get(who);
      return mark ? `${who} (${mark})` : who;
    });
    const restedWords = pushed.length === 0 ? 'everyone' : rested.join(', ') || 'no one';
    // SC-g6-3 (ruled B, 2026-11-03): when the next rest falls due, as the GM's Next turn sent it; lines from before
    // (no next_due) read as they did.
    const due = rows.map((e) => e.after?.next_due).find((d): d is Record<string, unknown> => typeof d === 'object' && d !== null && !Array.isArray(d));
    const dueWords = due && typeof due.unit === 'string' && typeof due.number === 'number' ? `, next rest due ${due.unit} ${due.number}` : '';
    return `Rest${calledBy ? ` called by ${calledBy}` : ''}, rested: ${restedWords}${pushedWords.length > 0 ? `, pushed on: ${pushedWords.join(', ')}` : ''}${dueWords}`;
  };
  const ranOutWords = () => {
    const out = [...burntOut(), ...timerEnds()];
    const rested = restedNames();
    const record = restRecord();
    return `${out.length > 0 ? ` Ran out with the clock: ${out.join(', ')}.` : ''}${rested.length > 0 ? ` Rested: ${rested.join(', ')}.` : ''}${record ? ` ${record}.` : ''}`;
  };
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  // Purses (December step 6b): whose purse each line touched, how much moved, and which way. The coin in the setting's
  // words when the screen passes them in (names.coinAmount, from the coin-words helpers), else by its key.
  const purseLines = entry.events.filter((e) => e.targetTable === 'purses');
  const coinChange = (e: LogEvent) => {
    const was = (e.before?.coins ?? {}) as Record<string, unknown>;
    const now = (e.after?.coins ?? {}) as Record<string, unknown>;
    return [...new Set([...Object.keys(was), ...Object.keys(now)])]
      .sort()
      .map((key) => ({ key, n: Number(now[key] ?? 0) - Number(was[key] ?? 0) }))
      .filter((c) => Number.isFinite(c.n) && c.n !== 0);
  };
  const coinAmount = () => {
    const first = purseLines.map(coinChange).find((c) => c.length > 0) ?? [];
    return first.map((c) => names.coinAmount?.(c.key, Math.abs(c.n)) ?? `${Math.abs(c.n)} ${c.key}`).join(', ') || 'some coin';
  };
  const purseWhose = (e: LogEvent | undefined) => {
    const purse = e && typeof e.targetId === 'string' ? names.purses?.get(e.targetId) : undefined;
    if (!purse) return null;
    return purse.actorId ? named(names.characters, purse.actorId, 'a character') : 'the stash';
  };
  const gaining = purseLines.find((e) => coinChange(e).some((c) => c.n > 0));
  const losing = purseLines.find((e) => coinChange(e).some((c) => c.n < 0));
  // A move's line keeps the other side as its reason ("with:<character id>" or "with:stash"; the purse functions set
  // it), so a reader who sees only one side's line still reads both names, and never an amount they couldn't read.
  const otherSide = (e: LogEvent | undefined) => {
    const said = e?.reason?.startsWith('with:') ? e.reason.slice(5) : null;
    return said === null ? null : said === 'stash' ? 'the stash' : named(names.characters, said, 'a character');
  };
  const side = (mine: LogEvent | undefined, theirs: LogEvent | undefined) => purseWhose(mine) ?? otherSide(theirs) ?? 'someone';

  // The purse lines in the approved words (Francis, 2026-11-13; plan dec-6-purse, "Piece c's pictures and words";
  // pu-7): characters' names, never players'; no closing full stop, as written there.
  switch (main.type) {
    // A find (K28; its command is K16b's): "Your GM gave <Name> <thing>, from <hoard> at <place>." or "Your GM put
    // <thing> in the party stash, …"; "…, at <place>." where the piece names no hoard. Coin names its amount only for a
    // reader who reads the purse's change (its line is the receiver's player's and the GM's); everyone else reads "coin".
    case 'find.give': {
      const find = findOf(entry);
      const things = entry.events
        .filter((e) => e.targetTable === 'inventory_lines' && e.before === null && e.after)
        .map((e) => pieces(item(e.after!, e.targetId), e.after!.item_data, e.after!.qty));
      const money = purseLines.some((e) => coinChange(e).length > 0) ? coinAmount() : find.coin ? 'coin' : null;
      const list = [...things, ...(money ? [money] : [])].join(', ') || 'something';
      // Where (the lead, 2026-11-14): named only for a reader whose group has been shown the place (names.placeNames
      // holds only those, by their shown names); the hoard, only as the reader may read it (names.hoards).
      const place = find.placeId ? names.placeNames?.get(find.placeId) : undefined;
      const hoard = place && find.hoardId ? names.hoards?.get(find.hoardId) : undefined;
      const where = !place ? '' : hoard ? `, from ${hoard} at ${place}` : `, at ${place}`;
      return find.to === null ? `Your GM put ${list} in the party stash${where}.` : `Your GM gave ${named(names.characters, find.to, 'a character')} ${list}${where}.`;
    }
    // A find undone (K16b, pk-12; the GM's own Undo, public.undo_find): "Your GM took back <thing>, <coin>." Coin names
    // its amount only for a reader of the purse's change, as above. Words not yet ruled (K16b's status file asks).
    case 'find.undo': {
      const things = entry.events
        .filter((e) => e.targetTable === 'inventory_lines' && e.before && e.after === null)
        .map((e) => pieces(item(e.before!, e.targetId), e.before!.item_data, e.before!.qty));
      const money = purseLines.some((e) => coinChange(e).length > 0) ? coinAmount() : null;
      const list = [...things, ...(money ? [money] : [])].join(', ') || 'a find';
      return `Your GM took back ${list}.`;
    }
    case 'purse.spend':
      return `${capital(purseWhose(losing) ?? 'someone')} spent ${coinAmount()}${main.reason ? `: ${main.reason}` : ''}`;
    case 'purse.add': {
      const to = purseWhose(gaining);
      return to === 'the stash' ? `Your GM put ${coinAmount()} in the stash` : `Your GM gave ${to ?? 'someone'} ${coinAmount()}`;
    }
    case 'purse.remove':
      return `Your GM took ${coinAmount()} from ${purseWhose(losing) ?? 'someone'}`;
    // "<Name> took 10 herons from the stash"; from a Down or dead character, "<Name> took 10 herons from <Other>".
    // The GM's moves are never credited to a character (the lead, 2026-11-13): "Your GM moved 10 herons from Wren to
    // Moss." and "Your GM gave Moss 10 herons from the stash."
    case 'purse.take': {
      const taker = side(gaining, losing);
      const from = side(losing, gaining);
      if (main.actorUserId !== null && names.gms?.has(main.actorUserId)) {
        return from === 'the stash' ? `Your GM gave ${taker} ${coinAmount()} from the stash.` : `Your GM moved ${coinAmount()} from ${from} to ${taker}.`;
      }
      return `${capital(taker)} took ${coinAmount()} from ${from}`;
    }
    // "<Name> gave <Other> 5 herons" (the one line both read); "<Name> put 10 herons in the stash".
    case 'purse.give': {
      const giver = capital(side(losing, gaining));
      const to = side(gaining, losing);
      return to === 'the stash' ? `${giver} put ${coinAmount()} in the stash` : `${giver} gave ${to} ${coinAmount()}`;
    }
    case 'event.undo': {
      // A move between linked places undone (Move on; ruled by the lead, 2026-11-11): the line says the party is back,
      // and where. The GM's copy has the move's record in it; a player's has the clock's part alone, and names a place
      // only when it has been shown to their group (public.party_moves).
      if (main.targetTable === 'campaign_clocks' && (names.partyMoves?.has(main.revertsEventId ?? '') || names.eventTypes?.get(main.revertsEventId ?? '') === 'place.moveOn')) {
        const move = names.partyMoves?.get(main.revertsEventId ?? '');
        if (!entry.events.some((e) => e.targetTable === 'place_moves')) return MOVE_ON_WORDS.playerUndone(move?.from ?? null);
        // The visit the move made is the one marked undone; the visit it left is current again.
        const made = entry.events.find((e) => e.targetTable === 'group_places' && e.after?.undone === true);
        const left = entry.events.find((e) => e.targetTable === 'group_places' && e.after?.moved_on === false);
        const nameOf = (visit: LogEvent | undefined) => (visit ? named(names.placeNames ?? new Map(), names.groupPlaces?.get(String(visit.targetId)), '') : '');
        return by(MOVE_ON_WORDS.gmUndone(nameOf(made) || move?.to || null, nameOf(left) || move?.from || null));
      }
      // A tell undone (K22b, K22h picture 6): the GM's line alone (k22-10), "You undid a reveal: that the Bronze ring is
      // cursed is hidden again." A look edit undone: the GM's too (pick 3).
      if (main.targetTable === 'inventory_lines' && 'revealed_fields' in before && 'revealed_fields' in after) {
        // An Undo of that Undo tells the facts again (review of #40, finding 7): the tell's own line is the players'
        // again, and this one stays the GM's.
        const again = factsBetween(after.revealed_fields, before.revealed_fields);
        const facts = again.length > 0 ? again : factsBetween(before.revealed_fields, after.revealed_fields);
        const real = facts.filter((f) => f !== 'magic');
        const said = real.length > 0 ? real : facts;
        // The name it goes by while the fact is hidden (its face, if its name is what comes and goes).
        const shown = String((again.length > 0 ? before.name : after.name) ?? '') || item();
        const what = said.length === 1 ? hiddenAgainPhrase(said[0]!, shown) : `what was told about the ${shown}`;
        return again.length > 0 ? by(`undid an Undo: ${what} is told again`) : by(`undid a reveal: ${what} is hidden again`);
      }
      if (main.targetTable === 'inventory_lines' && ('appears_as' in after || 'noticed' in after) && main.before !== null) {
        return by(`undid a change to what players see of the ${String(after.name ?? '') || item()}`);
      }
      // A drop or a gift outside the party undone (ruled 2026-10-25): the item is back where it was.
      if (main.targetTable === 'inventory_lines' && main.before === null) {
        const back = entry.events.filter((e) => e.targetTable === 'inventory_lines' && e.before === null).length;
        // The words guide's log line (ruled 2026-10-25): "You undid a drop: 3 torches are back with you."
        const kind = UNDONE_KIND[names.eventTypes?.get(main.revertsEventId ?? '') ?? ''] ?? 'that';
        return by(`undid ${kind}: ${back === 1 ? `${counted(item(), after.qty)} is` : `${back} items are`} ${backWith(after)}`);
      }
      // Starting a session or an expedition undone (M5 step 5): the record is marked undone, never removed.
      if ((main.targetTable === 'sessions' || main.targetTable === 'expeditions') && after.undone === true) {
        return by(`undid starting ${main.targetTable === 'sessions' ? 'a session' : 'an expedition'}`);
      }
      // A reminder made or a check recorded, undone (M5 step 6): marked undone, never removed.
      if (main.targetTable === 'reminders' && after.undone === true) return by('undid making a reminder');
      if (main.targetTable === 'check_results' && after.undone === true) return by('undid a check result');
      // A status put on, undone (M5 step 9): marked undone, never removed.
      if (main.targetTable === 'character_statuses' && after.undone === true) return by(`undid putting on ${statusName()}`);
      if (main.targetTable !== 'actors') {
        const what =
          main.targetTable === 'campaigns'
            ? 'the campaign'
            : main.targetTable === 'campaign_clocks'
              ? 'the clock'
            : main.targetTable === 'sessions'
              ? 'the session'
            : main.targetTable === 'expeditions'
              ? 'the expedition'
            : main.targetTable === 'reminders'
              ? 'a reminder'
            : main.targetTable === 'check_results'
              ? 'a check result'
            : main.targetTable === 'companies'
              ? `the company ${named(names.companies, main.targetId, '')}`.trim()
              : main.targetTable === 'field_definitions'
                ? `the field ${field()}`
                : main.targetTable === 'library_entries'
                  ? `${entryName()} in the campaign’s homebrew`
                : main.targetTable === 'campaign_pack_secrets'
                  ? 'which setting rules win for an entry'
                : main.targetTable === 'campaign_packs'
                  ? 'priority' in after
                    ? 'the order of the setting rules'
                    : 'overrides' in after
                      ? 'which setting rules win for an entry'
                      : `the optional rules of ${pack()}`
                  : main.targetTable === 'inventory_lines'
                    ? item()
                    : main.targetTable === 'character_lights'
                      ? lightName()
                    : main.targetTable === 'character_statuses'
                      ? statusName()
                    : main.targetTable === 'character_rests'
                      ? 'a rest'
                      : main.targetTable === 'marching_orders'
                        ? 'the marching order'
                        : main.targetTable === 'party_group_members'
                          ? 'the groups'
                          : 'something';
        return by(`undid a change to ${what}`);
      }
      const back = 'hp_current' in after ? ` (back to ${String(after.hp_current ?? 'full')})` : '';
      return by(`undid a change to ${possessive(character())} ${listWords(changedWords(after))}${back}`);
    }
    case 'inventory.add': {
      // Joined a same-name stack (Q2, sw-1): the count added, to the stack's carrier, said as any add; how it was got,
      // its price and the GM's note are kept on this line's reason (public.join_added_line), never on the stack.
      const joined = isJoin(main.type, main);
      const kept = joined ? joinOf(main) : null;
      const added: Record<string, unknown> = joined
        ? { ...((typeof main.targetId === 'string' ? names.itemPlaces?.get(main.targetId) : undefined) ?? {}), how_got: kept?.howGot ?? 'found', cost: kept?.cost ?? '', notes: kept?.note ?? '', approval: 'approved' }
        : after;
      const what = counted(item(), joined ? Number(after.qty) - Number(before.qty) : after.qty);
      if (added.how_got === 'bought') {
        const cost = String(added.cost ?? '').trim();
        return `${by(`bought ${what} for ${carrier(added)}${cost ? ` (${cost})` : ''}`)} Cost noted; purses arrive later.`;
      }
      // Given by the GM (2026-10-23), with the GM's note; a player's other choice is No cost.
      if (added.how_got === 'given') {
        const note = String(added.notes ?? '').trim();
        return by(`gave ${carrier(added)} ${what}${note ? `: ${note}` : ''}`);
      }
      return added.approval === 'pending'
        ? by(`made ${what} for ${carrier(added)}, waiting for the GM`)
        : by(`added ${what} to ${carrier(added)} (no cost)`);
    }
    case 'inventory.remove':
      return main.after === null
        ? by(`dropped ${counted(item(before), before.qty)} from ${packOf(before)}`)
        : by(`dropped ${Number(before.qty) - Number(after.qty)} of ${item()} (${String(after.qty)} left)`);
    // Use one up (Design on #552): what happened, by the item's kind, never "dropped" for a drink.
    case 'item.use': {
      // The last one: the log's copy of the line has its kind. A count down: the line as it is now (names.itemKinds),
      // or, once it's gone, the log's last copy of it (itemLinesWithGone; the #552 look-back).
      const known = typeof main.targetId === 'string' ? names.itemKinds?.get(main.targetId) : undefined;
      const details = (before.item_data && typeof before.item_data === 'object' ? before.item_data : (known?.details ?? {})) as Record<string, unknown>;
      const category = String(before.category ?? known?.category ?? '');
      const verb = oneUpVerb({ category, details, stack: Number(before.stack ?? known?.stack ?? 1), qty: Number(before.qty ?? 1) }) ?? 'Use';
      // The mode's last one (ah-3; Design on #569, round 3): a fresh weapon's spent mode was kept in the same request.
      const kept = entry.events.find((e) => e !== main && e.targetTable === 'inventory_lines' && e.after && 'mode_id' in e.after);
      const said = by(usedWords(verb, item(before.name ? before : after), details, main.after === null ? 0 : Number(after.qty)));
      return kept ? `${said} ${item(kept.after ?? {}, kept.targetId)}: nothing chosen.` : said;
    }
    // A weapon's mode chosen (ah-3; Design on #569: "Short bow: silver arrows"), by the mode's name in the pack.
    case 'item.setMode': {
      const known = typeof main.targetId === 'string' ? names.itemKinds?.get(main.targetId) : undefined;
      const data = (after.item_data && typeof after.item_data === 'object' ? after.item_data : (known?.details ?? {})) as Record<string, unknown>;
      const id = after.mode_id;
      if (typeof id !== 'string') return by(`chose ${item()}: nothing`);
      // Never the bare id (Design, 2026-11-10): a mode the line's copy doesn't name (one from the pack entry only).
      const modeName = modeNameOf(data, id);
      return modeName ? by(`chose ${item()}: ${modeName.toLowerCase()}`) : by(`changed how ${item()} is used`);
    }
    case 'inventory.setQty':
      return by(`set ${item()} to ${String(after.qty)} (was ${String(before.qty)})`);
    case 'inventory.equip':
      return after.equipped ? by(`equipped ${item()}`) : by(`took off ${item()}`);
    case 'inventory.equipAnyway':
      return by(`equipped ${item()} despite a warning`);
    case 'inventory.setBaseArmour':
      // bq3-8 (ruled 2026-11-04): a base the wearer's class can't wear takes the armour off in the same change.
      return before.equipped === true && after.equipped === false
        ? `${by(`picked the base armour for ${item()}`)} It came off and is carried: the class can't wear that base.`
        : by(`picked the base armour for ${item()}`);
    case 'rule.skipped':
      return `A rule couldn’t be checked: ${String(after.hook ?? 'a rule')}.`;
    case 'inventory.pin':
      return after.pinned ? by(`pinned ${item()} to At hand`) : by(`unpinned ${item()} from At hand`);
    case 'inventory.atHand':
      return after.at_hand_hidden ? by(`hid ${item()} from At hand`) : by(`showed ${item()} in At hand again`);
    case 'inventory.setCharges': {
      // The roll behind it, when there was one: "2d10 → 13".
      const roll = (row: Record<string, unknown>) => (typeof row.last_roll === 'string' && row.last_roll ? `: ${row.last_roll}` : '');
      const secret = entry.events.find((e) => e.targetTable === 'inventory_line_secrets' && e.after);
      if (secret?.after) return by(`set the hidden charges of ${item({}, secret.targetId)} to ${String(secret.after.charges_total)}${roll(secret.after)}`);
      return 'charges_left' in after ? by(`set the charges of ${item()} to ${String(after.charges_left)}${roll(after)}`) : by(`set the charges of ${item()}`);
    }
    case 'inventory.useCharge': {
      const left = 'charges_left' in after ? ` (${String(after.charges_left)} left)` : '';
      // Used with none left: nothing happens, and now the holder knows (ruled 2026-10-24).
      if (after.spent_shown === true) return `${by(`used ${item()}`)} Nothing happens: it seems spent.`;
      const spent = entry.events.some((e) => e.targetTable === 'inventory_line_secrets' && e.after?.spent === true) ? ' No charges left.' : '';
      return `${by(`used a charge of ${item()}${left}`)}${spent}`;
    }
    case 'inventory.recharge': {
      const changed = entry.events.find((e) => e.after && typeof e.after.last_roll === 'string');
      return by(`recharged ${item({}, changed?.targetId ?? main.targetId)}${changed?.after ? `: ${String(changed.after.last_roll)}` : ''}`);
    }
    case 'inventory.revealSpent':
      return by(`showed that ${item()} is spent`);
    case 'inventory.revealCharges':
      return by(`showed how many charges ${item()} has left (${String(after.charges_left ?? '?')})`);
    case 'load.tier':
      return `${character()} is now ${String(after.tier ?? '')}.`;
    case 'inventory.giveAway': {
      const gone = entry.events.find((e) => e.after === null && e.before);
      const row = gone?.before ?? before;
      return by(`gave ${counted(item(row, gone?.targetId), row.qty)} to ${String(row.given_to ?? 'someone outside the party')}`);
    }
    case 'inventory.approve':
      return by(`approved ${item()}`);
    case 'inventory.decline':
      return by(`declined ${item(before)}`);
    case 'inventory.showAll':
      return by('changed who sees every item in Add item');
    case 'inventory.reveal':
      return by(`revealed more about ${item()}`);
    case 'inventory.tell': {
      // K22b (K22h picture 6): the GM's "You told Wren the Bronze ring is cursed.", the players' "Wren learned the
      // Bronze ring is cursed." (the holder and the party read it, k22-9); the true name's, every player's (sw-8).
      const facts = factsBetween(after.revealed_fields, before.revealed_fields);
      const real = facts.filter((f) => f !== 'magic');
      const said = real.length > 0 ? real : facts;
      const details = isObj(after.item_data) ? after.item_data : {};
      const beforeDetails = isObj(before.item_data) ? before.item_data : {};
      const place = names.itemPlaces?.get(String(main.targetId));
      const inStash = typeof place?.location_id === 'string';
      const holder = inStash ? 'the party' : named(names.characters, place?.actor_id, 'someone');
      const Holder = inStash ? 'The party' : holder;
      // The name it went by before this tell (the face), and the one it has after (the true name, when told).
      const was = String(before.name ?? '') || item();
      const now = String(after.name ?? '') || item();
      const gmReads = names.gms?.has(names.me) === true;
      if (said.length > 1) {
        if (gmReads) return by(`told ${holder} everything about the ${now}`);
        const traits = listWords(['magic', 'cursed'].filter((f) => facts.includes(f)));
        const bonus = facts.includes('bonus') ? bonusPhrase(details) : null;
        const parts = [
          facts.includes('name') ? `the ${now}` : '',
          facts.includes('magic') || facts.includes('cursed') ? traits : '',
          bonus ? ('gives' in bonus ? bonus.gives : bonus.bare) : '',
          ...newPowers(beforeDetails, details),
        ].filter(Boolean);
        return `${Holder} learned what the ${was} is: ${parts.join(', ')}.`;
      }
      const fact = said[0] ?? 'magic';
      if (fact === 'name') {
        return gmReads ? by(`showed the players the ${was}’s true name: ${now}`) : `${Holder} learned the ${was}’s true name: ${now}.`;
      }
      const phrase = factPhrase(fact, details, beforeDetails, after.charges_left);
      return gmReads ? by(`told ${holder} the ${was}${phrase}`) : `${Holder} learned the ${was}${phrase}.`;
    }
    case 'inventory.editLook': {
      // K22c picture 4: the GM's alone (pick 3; the database keeps the line from players).
      const place = names.itemPlaces?.get(String(main.targetId));
      const was = String(before.name ?? '') || item();
      const whose = typeof place?.location_id === 'string' ? `the party’s ${was}` : `${named(names.characters, place?.actor_id, 'someone')}’s ${was}`;
      return by(`changed what players see of ${whose}`);
    }
    case 'inventory.move': {
      // Joined a same-name stack where it landed (Q2, sw-6, sw-9): the count moved, said as any move of it is.
      const join = entry.events.find((e) => isJoin(main.type, e));
      if (join?.after && join.before) {
        const placeOf = (id: unknown) => (typeof id === 'string' ? names.itemPlaces?.get(id) : undefined) ?? {};
        const into: Record<string, unknown> = placeOf(join.targetId);
        // Where it came from: the merged line's copy, or the stack it was counted off.
        const gone = entry.events.find((e) => e.after === null && e.before);
        const countedOff = entry.events.find((e) => e !== join && e.before && e.after && 'qty' in e.after);
        const from: Record<string, unknown> = gone?.before ?? placeOf(countedOff?.targetId);
        const moved = Number(join.after.qty) - Number(join.before.qty);
        const known = typeof join.targetId === 'string' ? names.itemKinds?.get(join.targetId) : undefined;
        const name = counted(item({}, join.targetId), moved);
        const fromStash = typeof from.location_id === 'string' && !!names.stashIds?.has(from.location_id) && typeof into.actor_id === 'string';
        if (fromStash) {
          const taker = main.actorUserId !== null && names.gms?.has(main.actorUserId) ? 'Your GM' : named(names.characters, into.actor_id, 'a character');
          return `${taker} took ${pieces(item({}, join.targetId), known?.details, moved)} from the party stash.`;
        }
        if (into.actor_id !== from.actor_id || into.location_id !== from.location_id) return by(`moved ${name} to ${carrier(into)}`);
        if (into.container_line_id) return by(`put ${name} in ${named(names.items, into.container_line_id, 'a container')}`);
        return by(`took ${name} out of ${named(names.items, from.container_line_id, 'a container')}`);
      }
      // Part of a stack moves as a new line (made, then handed over); a whole line just changes carrier.
      const made = entry.events.find((e) => e.before === null && e.after);
      const handed = entry.events.find((e) => e.after && ('actor_id' in e.after || 'location_id' in e.after) && e.before !== null);
      const name = made?.after ? counted(item(made.after), made.after.qty) : item(after, handed?.targetId ?? main.targetId);
      // Take (K28, pk-3): a move out of the party stash itself (its kind, never another place) onto a character. A
      // player's reads as the character's: "Wren took 2 torches from the party stash." (pu-7's voice: characters' names,
      // never players'); the GM's as "Your GM took 2 torches from the party stash." (the lead, 2026-11-14).
      const fromStash = typeof handed?.before?.location_id === 'string' && !!names.stashIds?.has(handed.before.location_id) && typeof handed.after?.actor_id === 'string';
      if (handed?.after && fromStash) {
        // A part of a stack: the split-off line's own count. A whole line: the move logs only its change of carrier, so
        // its count is the line's as the log's names read it now (right until the line changes again; the status file).
        const known = typeof handed.targetId === 'string' ? names.itemKinds?.get(handed.targetId) : undefined;
        const what = made?.after ? pieces(item(made.after), made.after.item_data, made.after.qty) : known?.qty !== undefined ? pieces(item(after, handed.targetId), known.details, known.qty) : item(after, handed.targetId);
        const taker = main.actorUserId !== null && names.gms?.has(main.actorUserId) ? 'Your GM' : named(names.characters, handed.after.actor_id, 'a character');
        return `${taker} took ${what} from the party stash.`;
      }
      if (handed?.after) return by(`moved ${name} to ${carrier(handed.after)}`);
      if (after.container_line_id) return by(`put ${name} in ${named(names.items, after.container_line_id, 'a container')}`);
      return by(`took ${name} out of ${named(names.items, before.container_line_id, 'a container')}`);
    }
    case 'inventory.empty': {
      // One change for everything that was inside (ruled 2026-10-24): where it went, and how many.
      const moved = entry.events.filter((e) => e.targetTable === 'inventory_lines');
      const first = moved[0];
      const bag = named(names.items, String(first?.before?.container_line_id ?? ''), 'a container');
      const n = moved.length === 1 ? '1 item' : `${moved.length} items`;
      if (!first?.after) return by(`emptied ${bag} and dropped what was in it (${n})`);
      if ('actor_id' in first.after || 'location_id' in first.after) return by(`emptied ${bag} into ${carrier(first.after)} (${n})`);
      return by(`emptied ${bag} (${n} now carried)`);
    }
    // The clock, sessions and expeditions (M5 step 5). The clock's lines say how far it moved, in plain time, and
    // (M5 step 7) what ran out with it: lights the database burnt out in the same move (05, Set time…).
    case 'time.advance':
    case 'time.advanceBy':
      return `${by(`moved the clock on ${timeWords(Number(after.seconds ?? 0) - Number(before.seconds ?? 0))}`)}${ranOutWords()}`;
    // Next part of day (M5b step 6a, ST1): Simple, a third of the day.
    case 'time.partOfDay':
      return `${by(`moved on to the next part of the day (${timeWords(Number(after.seconds ?? 0) - Number(before.seconds ?? 0))})`)}${ranOutWords()}`;
    case 'time.downtime':
      return `${by(`let ${timeWords(Number(after.seconds ?? 0) - Number(before.seconds ?? 0))} pass in downtime`)}${ranOutWords()}`;
    case 'time.set': {
      const moved = Number(after.seconds ?? 0) - Number(before.seconds ?? 0);
      return `${by(`set the clock ${moved < 0 ? 'back' : 'on'} ${timeWords(moved)} (a correction)`)}${ranOutWords()}`;
    }
    // The first day's start time (B13, ruled 2026-11-01): the setting and, on a clock that hadn't moved, the clock.
    case 'time.start': {
      const setting = entry.events.find((e) => e.targetTable === 'campaigns')?.after?.settings;
      const start = setting && typeof setting === 'object' && !Array.isArray(setting) ? (setting as Record<string, unknown>).startTime : null;
      const hm = start && typeof start === 'object' && !Array.isArray(start) ? (start as Record<string, unknown>) : null;
      const at = hm && Number.isInteger(hm.hour) && Number.isInteger(hm.minute) ? ` to ${String(hm.hour).padStart(2, '0')}:${String(hm.minute).padStart(2, '0')}` : '';
      const clock = entry.events.find((e) => e.targetTable === 'campaign_clocks');
      return `${by(`set the first day's start time${at}${clock ? ', and the clock with it' : ''}`)}${ranOutWords()}`;
    }
    // Lights (M5 step 7): lit, put out, Keep lit, refilled; and burnt out with the clock (in the Simple log, where
    // the routine time step that burnt it out isn't shown).
    case 'light.light':
      return by(`lit ${lightName()}`);
    case 'light.douse':
      return by(`put out ${lightName()}`);
    case 'light.keepLit':
      return by(`switched Keep lit ${after.keep_lit === true ? 'on' : 'off'} for ${lightName()}`);
    case 'light.refill':
      return by(`refilled ${lightName()}`);
    case 'light.burnOut': {
      const out = burntOut();
      const relit = entry.events.filter((e) => e.targetTable === 'character_lights' && e.type === 'light.burnOut' && e.after?.lit_at != null).map((e) => lightName(e));
      const parts = [out.length === 1 ? `${capital(out[0]!)} burnt out` : out.length > 1 ? `Burnt out: ${out.join(', ')}` : '', relit.length > 0 ? `Keep lit lit another: ${relit.join(', ')}` : ''];
      return `${parts.filter(Boolean).join('. ') || 'A light burnt out'}.`;
    }
    // Marching order (M5 step 8): every move, in the Simple log ("Sam moved Ash to the front."); a saved order used
    // or saved, and the GM's lock.
    case 'marching.set': {
      const nameOf = (id: string) => names.characters.get(id) ?? 'someone';
      return 'rows' in after ? by(moveWords(readRows(before.rows), readRows(after.rows), nameOf)) : by('changed the marching order');
    }
    case 'marching.usePreset':
      return by(`put the party in the saved order “${String(after.last_preset ?? before.last_preset ?? '').trim() || 'saved'}”`);
    case 'marching.savePreset': {
      const saved = Array.isArray(after.presets) ? (after.presets as { name?: unknown }[]) : [];
      const was = new Set((Array.isArray(before.presets) ? (before.presets as { name?: unknown }[]) : []).map((p) => JSON.stringify(p)));
      const named = saved.find((p) => !was.has(JSON.stringify(p)))?.name;
      return by(`saved the marching order as “${typeof named === 'string' ? named : 'a preset'}”`);
    }
    case 'marching.deletePreset': {
      const kept = new Set((Array.isArray(after.presets) ? (after.presets as { name?: unknown }[]) : []).map((p) => JSON.stringify(p)));
      const gone = (Array.isArray(before.presets) ? (before.presets as { name?: unknown }[]) : []).find((p) => !kept.has(JSON.stringify(p)))?.name;
      return by(`deleted the saved order “${typeof gone === 'string' ? gone : 'saved'}”`);
    }
    // Party groups (M5 step 8, DG14): Split the party and Join up.
    case 'party.chooseGroup':
    case 'party.joinUp': {
      const number = (row: Record<string, unknown> | null) => (row && typeof row.group_number === 'number' ? row.group_number : null);
      const changes = entry.events
        .filter((e) => e.targetTable === 'party_group_members')
        .map((e) => ({ id: e.targetId, before: number(e.before), after: number(e.after) }));
      return by(groupWords(main.type as 'party.chooseGroup' | 'party.joinUp', changes, (id) => names.characters.get(id) ?? 'someone'));
    }
    // Statuses and rest (M5 step 9): put on, removed, stepped, ended by the clock; Rest this turn, Push on, rested.
    case 'status.add':
    case 'rest.pushOn': {
      const touched = entry.events.filter((e) => e.targetTable === 'character_statuses');
      const stacked = touched.find((e) => e.before !== null && typeof e.after?.stacks === 'number');
      const words = touched.map((e) => statusName(e));
      const what = words.length > 1 ? words.join(', ') : (words[0] ?? statusName());
      if (main.type === 'rest.pushOn') return by(`pushed on without rest: ${what}`);
      if (stacked && touched.length === 1) return by(`put ${what} on again (×${String(stacked.after!.stacks)})`);
      if (touched.length === 1 && touched[0]!.before !== null && 'level' in (touched[0]!.after ?? {})) return by(`stepped up ${what}`);
      return by(`put ${what}`);
    }
    case 'status.remove':
      return by(`removed ${statusName(main, 'from')}`);
    case 'status.step':
      return after.ended_at != null ? by(`stepped down ${statusName()}, which ends it`) : by(`changed the level of ${statusName()}`);
    // The GM's time-left stepper (follow-up to the status rings): the time on the status itself, or its secret timer.
    case 'status.setTime':
      return by(`changed the time left of ${statusName()}`);
    case 'status.timerEnd': {
      const ended = timerEnds();
      return ended.length > 0 ? `Ended with the clock: ${ended.join(', ')}.` : 'A status ended with the clock.';
    }
    case 'rest.choose': {
      const whose = entry.events.filter((e) => e.targetTable === 'character_rests').map((e) => (typeof e.targetId === 'string' ? names.rests?.get(e.targetId) : undefined) || 'someone');
      const list = whose.join(', ') || 'someone';
      return after.chosen_at == null ? by(`said ${list} won't rest after all`) : by(`chose rest for ${list}`);
    }
    case 'rest.applied':
      return restRecord() ?? 'A rest was applied.';
    case 'rest.call':
      return by(`called a rest for ${named(names.characters, String(entry.events.find((e) => e.targetTable === 'character_rests')?.after?.called_by ?? ''), 'the group')}'s group`);
    case 'rest.answer': {
      const whose = entry.events.filter((e) => e.targetTable === 'character_rests').map((e) => (typeof e.targetId === 'string' ? names.rests?.get(e.targetId) : undefined) || 'someone');
      const list = whose.join(', ') || 'someone';
      return after.chosen_at != null ? by(`answered Rest for ${list}`) : after.pushing_at != null ? by(`answered Push on for ${list}`) : by(`took back the rest answer for ${list}`);
    }
    case 'rest.taken': {
      const rested = restedNames();
      return rested.length > 0 ? `Rested: ${rested.join(', ')}.` : 'They rested.';
    }
    case 'marching.lock':
      return by(after.locked === true ? 'locked the marching order' : 'unlocked the marching order');
    case 'session.start':
      return by(`started session ${String(after.number ?? '')}`.trim());
    case 'session.end':
      return by('ended the session');
    case 'calendar.seasonNotNow':
      return by('left the season unset until the next session');
    case 'expedition.start': {
      const made = entry.events.find((e) => e.targetTable === 'expeditions' && e.before === null)?.after ?? after;
      const went = Array.isArray(made.who_went) ? made.who_went.length : 0;
      // Where it started (DG1): only the GM's device gets the place's line (hidden means hidden), so only the GM reads it.
      const place = entry.events.find((e) => e.targetTable === 'expedition_places' && e.before === null)?.after?.name;
      return by(`started an expedition${typeof place === 'string' && place ? ` at ${place}` : ''}${went > 0 ? ` (${went === 1 ? '1 character' : `${went} characters`} went)` : ''}`);
    }
    case 'expedition.end': {
      const change = entry.events.find((e) => e.targetTable === 'expeditions');
      const ended = change?.after ?? after;
      const summary = ended.summary && typeof ended.summary === 'object' ? (ended.summary as Record<string, unknown>) : {};
      // The party stays in Adventure (dt-2, M5b step 6a): Start downtime is its own line. A Yes to In a safe place?
      // (m8b-0 delivery 5) is folded in as the line is read, from the expedition as it is now (the events stay), and
      // only into an End that wasn't undone: after End, Undo, End again and Yes, the first End says nothing of safety.
      const undone = change ? names.undoneExpeditionChanges?.has(change.id) : false;
      const safe = change?.targetId && !undone && names.safeEnds?.has(change.targetId) ? ' in a safe place' : '';
      return typeof summary.seconds === 'number' ? by(`ended the expedition${safe} after ${timeWords(summary.seconds)}`) : by(`ended the expedition${safe}`);
    }
    // Start and End downtime (M5b step 6a; ST10, ST11 as split by dt-2).
    case 'downtime.start': {
      // The town switches turn off with the move into Downtime (sw-3; the database does it in the same change).
      const town = entry.events.find((e) => e.targetTable === 'campaigns' && e.before && (e.before.out_day === true || e.before.active_night === true));
      const reset = town?.before ? townEnded({ outDay: town.before.out_day === true, activeNight: town.before.active_night === true }) : null;
      const rested = entry.events.filter((e) => e.targetTable === 'character_play').length;
      const line = by(`started downtime with a full rest${rested > 0 ? ` (${rested === 1 ? '1 character' : `${rested} characters`} got abilities back)` : ''}`);
      return reset ? `${line} ${reset}, downtime.` : line;
    }
    case 'downtime.end':
      return by('ended downtime');
    // The town switches (M5b step 6.0; sw-1 … sw-4): the GM's flips, and the morning's reset.
    // One or the other (sm-1): a turn-on that also put the other half out says both.
    case 'town.outDay': {
      const alsoOff = after.out_day === true && before.active_night === true && after.active_night === false ? ', and Active tonight off' : '';
      return by(`switched Out and about today ${after.out_day === true ? 'on' : 'off'}${alsoOff}`);
    }
    case 'town.activeNight': {
      const alsoOff = after.active_night === true && before.out_day === true && after.out_day === false ? ', and Out and about today off' : '';
      return by(`switched Active tonight ${after.active_night === true ? 'on' : 'off'}${alsoOff}`);
    }
    // Carrying treasure (area 3 order 12, eq-3): the GM's switch for one character, or back to following the pack.
    case 'inventory.carryingTreasure': {
      const now = after.carrying_treasure;
      const word = now === true ? 'on' : now === false ? 'off' : 'back to following the pack';
      return by(`switched Carrying treasure ${word} for ${character()}`);
    }
    case 'town.reset': {
      const words = townEnded({ outDay: before.out_day === true, activeNight: before.active_night === true });
      return `${words ?? 'The town switches ended'}, morning.`;
    }
    case 'expedition.fullRest':
      return by('gave the party a full rest');
    // Leave the dungeon's Use safe paths (of-5, sq-2).
    case 'expedition.safePaths':
      return by('led the party out by safe paths');
    // In a safe place? (m8b-0 delivery 5): the GM's answer, its own Verbose line.
    case 'expedition.safePlace':
      return by(after.ended_safe === true ? 'said the party ended in a safe place' : after.ended_safe === false ? 'said the party ended somewhere not safe' : 'took back the answer to In a safe place?');
    // The GM's reminders and check results (M5 step 6). A check's line reaches players at the next Downtime.
    case 'reminder.add': {
      const made = entry.events.find((e) => e.targetTable === 'reminders' && e.before === null)?.after ?? after;
      return by(`made a reminder: ${String(made.label ?? '')}`.trim());
    }
    case 'reminder.edit': {
      // A change logs only what changed, so the reminder's words show when they're what changed.
      const label = String(after.label ?? '');
      const which = label ? `the reminder ${label}` : 'a reminder';
      if (after.active === false) return by(`stopped ${which}`);
      if (after.active === true) return by(`started ${which} again`);
      return by(`changed ${which}`);
    }
    case 'check.record': {
      const made = entry.events.find((e) => e.targetTable === 'check_results' && e.before === null)?.after ?? after;
      return by(`recorded ${String(made.name ?? 'a check')}: ${made.outcome === 'hit' ? 'a hit' : 'a miss'}`);
    }
    case 'check.again': {
      const made = entry.events.find((e) => e.targetTable === 'check_results' && e.before === null)?.after ?? after;
      return by(`checked ${String(made.name ?? 'a check')} again: ${made.outcome === 'hit' ? 'a hit' : 'a miss'}`);
    }
    case 'check.now': {
      // Check now (DG3): an ad-hoc check, outside the schedule.
      const made = entry.events.find((e) => e.targetTable === 'check_results' && e.before === null)?.after ?? after;
      return by(`checked ${String(made.name ?? 'a check')} now: ${made.outcome === 'hit' ? 'a hit' : 'a miss'}`);
    }
    case 'check.reveal':
      return by('showed the players a check result');
    // Places (M5 step 11, DG9): the GM's lines alone (players learn a place on Scene once it's shown).
    case 'place.set': {
      const made = entry.events.find((e) => e.targetTable === 'group_places' && e.before === null)?.after ?? {};
      const place = named(names.placeNames ?? new Map(), made.place_id, '');
      const group = typeof made.group_number === 'number' && made.group_number !== 1 ? groupName(made.group_number) : 'the party';
      return by(`put ${group} ${place ? `at ${place}` : 'somewhere unnamed'}`);
    }
    // Move on (December step 4, piece c): the place and the clock in one line. The GM's line names the place, the way
    // taken and its turns (the move's record, place_moves, which only the GM receives). A player's device has only the
    // clock's part of it: their line says the party moved (ruled by the lead, 2026-11-11), with the place's name only
    // when it has been shown to their group (public.party_moves; null until then) and never the way.
    case 'place.moveOn': {
      const clock = entry.events.find((e) => e.targetTable === 'campaign_clocks' && e.type === 'place.moveOn');
      const record = entry.events.find((e) => e.targetTable === 'place_moves' && e.before === null)?.after;
      if (!record) {
        const move = names.partyMoves?.get(clock?.id ?? '');
        return `${MOVE_ON_WORDS.playerMoved(move?.to ?? null, move?.turns ?? null)}${ranOutWords()}`;
      }
      const passed = timeWords(Number(clock?.after?.seconds ?? 0) - Number(clock?.before?.seconds ?? 0));
      const way = typeof record.way_name === 'string' ? record.way_name.trim() : '';
      return `${by(MOVE_ON_WORDS.gmMoved(placeFromEntry(), way || null, typeof record.turns === 'number' ? record.turns : null, passed))}${ranOutWords()}`;
    }
    // A place picked from a pack (M8b slice 0): the GM's line alone; its pieces come unshown with it.
    case 'place.fromPack': {
      const made = entry.events.find((e) => e.targetTable === 'places' && e.before === null)?.after ?? after;
      const pieces = entry.events.filter((e) => e.targetTable === 'place_pieces' && e.before === null).length;
      return by(`added ${String(made.name ?? 'a place')} from a pack${pieces > 0 ? ` (${pieces === 1 ? '1 piece' : `${pieces} pieces`}, unshown)` : ''}`);
    }
    // Retired in M5b g2b (gp-6): no command writes these any more; their earlier lines still read as before.
    case 'place.show':
    case 'place.hide': {
      const place = groupPlaceName(main.targetId);
      return main.type === 'place.show' ? by(`showed players ${place}`) : by(`hid ${place} from players`);
    }
    // Pieces (M5b g2, B1): the GM's lines alone (Verbose); Hide all is one line.
    case 'place.addPiece': {
      const made = entry.events.find((e) => e.targetTable === 'place_pieces' && e.before === null)?.after ?? after;
      return by(`added a piece to ${named(names.placeNames ?? new Map(), made.place_id, 'a place')}: “${String(made.body ?? '')}”`);
    }
    case 'place.showItemTruth': {
      // B15 (p2p-29): a magic item's piece shown, and the item named wherever it is held, in one request. A reader who
      // can't read the piece (a player after its Undo, say) reads no words of it: only that an item was named.
      const made = entry.events.find((e) => e.targetTable === 'piece_shows');
      const pieceId = made?.after?.piece_id ?? names.pieceShows?.get(String(made?.targetId))?.piece;
      const groupNo = typeof made?.after?.group_number === 'number' ? made.after.group_number : (names.pieceShows?.get(String(made?.targetId))?.group ?? 1);
      const group = groupNo !== 1 ? groupName(groupNo) : 'the party';
      const text = named(names.pieces ?? new Map(), pieceId, '');
      const items = entry.events.filter((e) => e.targetTable === 'inventory_lines').length;
      const itemWords = items === 0 ? '' : items === 1 ? 'an item now carries its name' : `${items} items now carry their name`;
      if (!text) return by(itemWords ? `showed what an item is: ${itemWords}` : 'showed what an item is');
      return by(`showed ${group} “${text}”${itemWords ? `; ${itemWords}` : ''}`);
    }
    case 'place.showPiece':
    case 'place.hidePiece': {
      const show = names.pieceShows?.get(String(main.targetId));
      const made = entry.events.find((e) => e.targetTable === 'piece_shows' && e.before === null)?.after;
      const pieceId = show?.piece ?? made?.piece_id;
      const groupNo = show?.group ?? (typeof made?.group_number === 'number' ? made.group_number : 1);
      const group = groupNo !== 1 ? groupName(groupNo) : 'the party';
      const text = named(names.pieces ?? new Map(), pieceId, '');
      const what = text ? `“${text}”` : 'a piece';
      return main.type === 'place.showPiece' ? by(`showed ${group} ${what}`) : by(`hid ${what} from ${group}`);
    }
    case 'place.hideAll': {
      const count = entry.events.filter((e) => e.targetTable === 'piece_shows').length;
      const first = names.pieceShows?.get(String(main.targetId));
      const group = first && first.group !== 1 ? groupName(first.group) : 'the party';
      return by(`hid ${count === 1 ? '1 piece' : `${count} pieces`} from ${group}`);
    }
    // After they're added (M5b g2b): an edit says the new words (the old stay in the line's record); a removal names
    // the piece; a return visit is one line with the count (its Undo hides them all again).
    case 'place.editPiece': {
      const now = named(names.pieces ?? new Map(), main.targetId, '');
      if (typeof after.body === 'string') return by(`changed a piece to “${after.body}”`);
      return by(now ? `changed the kind of “${now}”` : 'changed a piece');
    }
    case 'place.removePiece': {
      const text = named(names.pieces ?? new Map(), main.targetId, '');
      return by(text ? `removed a piece: “${text}”` : 'removed a piece');
    }
    case 'place.backAt': {
      const shows = entry.events.filter((e) => e.targetTable === 'piece_shows' && e.before === null);
      const first = shows[0]?.after ?? after;
      const groupNo = typeof first.group_number === 'number' ? first.group_number : 1;
      const group = groupNo !== 1 ? groupName(groupNo) : 'the party';
      const place = groupPlaceName(first.group_place_id);
      return by(`is back at ${place} with ${group}, ${shows.length === 1 ? '1 piece' : `${shows.length} pieces`} shown again`);
    }
    // Safe and Hostile (M5b step 6b, ST2): the GM's line alone; the place's new safety.
    case 'place.setSafety': {
      const id = entry.events.find((e) => e.targetTable === 'places')?.targetId ?? main.targetId;
      const place = named(names.placeNames ?? new Map(), id, 'a place');
      const now = entry.events.find((e) => e.targetTable === 'places')?.after?.safety ?? after.safety;
      return by(now === 'safe' ? `marked ${place} safe` : now === 'hostile' ? `marked ${place} hostile` : `marked ${place} neither safe nor hostile`);
    }
    // The town screen (M5b step 6c, ST3): the GM's lines alone; which place in town changed, and how.
    case 'town.showPlace':
    case 'town.openPlace': {
      const change = entry.events.find((e) => e.targetTable === 'places') ?? main;
      const place = named(names.placeNames ?? new Map(), change.targetId, 'a place');
      const was = (change.before?.town ?? {}) as Record<string, { name?: string; shown?: boolean; open?: boolean }>;
      const now = (change.after?.town ?? {}) as Record<string, { name?: string; shown?: boolean; open?: boolean }>;
      const field = main.type === 'town.showPlace' ? 'shown' : 'open';
      const key = Object.keys(now).find((k) => (now[k]?.[field] ?? null) !== (was[k]?.[field] ?? (field === 'open' ? true : false)));
      const what = (key && now[key]?.name) || 'a place in town';
      const on = key ? now[key]?.[field] === true : true;
      // The first show in a town players didn't see yet showed the town with it (its description piece, same request).
      const withTown = field === 'shown' && entry.events.some((e) => e.targetTable === 'piece_shows');
      if (field === 'shown') return by(on ? (withTown ? `showed players ${place} and ${what}` : `showed players ${what} in ${place}`) : `hid ${what} in ${place} from players`);
      return by(on ? `opened ${what} in ${place}` : `closed ${what} in ${place}`);
    }
    // A piece of a place in town shown or hidden (W4c, ge-1): the GM's lines alone. The piece's words when this line made
    // the show (its first show on the visit); otherwise "a piece of a place in town" (the store's change holds only shown).
    case 'town.showPiece':
    case 'town.hidePiece': {
      const made = entry.events.find((e) => e.targetTable === 'town_piece_shows' && e.before === null)?.after;
      const groupNo = typeof made?.group_number === 'number' ? made.group_number : 1;
      const group = groupNo !== 1 ? groupName(groupNo) : 'the party';
      const text = named(names.pieces ?? new Map(), made?.piece_id, '');
      const what = text ? `“${text}”` : 'a piece of a place in town';
      return main.type === 'town.showPiece' ? by(`showed ${group} ${what}`) : by(`hid ${what} from ${group}`);
    }
    // A place's rules (December dec-7 piece 3; mc-51, rg-5): the GM's lines alone; the rule and the place by the names
    // the pack gives them (kept on the switch's row).
    case 'placeRule.eye':
    case 'placeRule.inForce': {
      const row = entry.events.find((e) => e.targetTable === 'place_rule_switches')?.after ?? after;
      const rule = typeof row.rule_name === 'string' && row.rule_name ? `“${row.rule_name}”` : 'a rule';
      const place = typeof row.place_name === 'string' && row.place_name ? row.place_name : 'a place';
      const on = row.value === true;
      if (main.type === 'placeRule.eye') return by(on ? `opened ${rule} of ${place} to players` : `closed ${rule} of ${place} to players`);
      return by(on ? `put ${place}'s ${rule} back in force` : `switched off ${place}'s ${rule}: the setting's check applies there`);
    }
    // A section of a place's Knowledge shared with a group, or taken back (P4, p4s-2): the GM's line alone; the section's
    // heading and the place by the pack's words (kept on the share's row).
    case 'placeKnowledge.eye': {
      const row = entry.events.find((e) => e.targetTable === 'knowledge_shares')?.after ?? after;
      const heading = typeof row.heading === 'string' && row.heading.trim() ? `“${row.heading.trim()}”` : 'a section';
      const place = typeof row.place_name === 'string' && row.place_name ? row.place_name : 'a place';
      const group = typeof row.group_number === 'number' && row.group_number !== 1 ? groupName(row.group_number) : 'the party';
      return by(row.shared === true ? `shared ${heading} of ${place}'s knowledge with ${group}` : `took back ${heading} of ${place}'s knowledge from ${group}`);
    }
    case 'place.edit': {
      const id = entry.events.find((e) => e.targetTable === 'places' || e.targetTable === 'place_notes')?.targetId;
      return by(`wrote about ${named(names.placeNames ?? new Map(), id, 'a place')}`);
    }
    // A place's map (dec-7 5m-2): the campaign's copy tied to the place, or taken off it. The GM's line alone.
    case 'place.setMap': {
      const id = entry.events.find((e) => e.targetTable === 'places')?.targetId;
      const place = named(names.placeNames ?? new Map(), id, 'a place');
      return by(after.map_asset_id ? `added a map to ${place} (hidden)` : `took the map off ${place}`);
    }
    // A map's eye (dec-7 5m-3): the campaign's copy shared with the players, or taken back. The GM's line alone.
    case 'place.shareMap':
      return by(after.visibility === 'all' ? 'shared a map with the players' : 'took a map back from the players');
    // Travel (M5b step 1; S1–S4, D4, D7, D8): the group's lines (fm-1: its players when the line was written, and the
    // GM). The main event is the group's travel row; a move that arrives also moves the group's place on (its own
    // rows in the entry, the GM's alone). The place being entered: enteringName, above.
    case 'travel.dayStart': {
      const row = main.targetTable === 'travel_groups' ? main : (entry.events.find((e) => e.targetTable === 'travel_groups') ?? main);
      const now = row.after ?? {};
      const was = row.before;
      const group = travelGroup(now, row);
      const dayNo = typeof now.day === 'number' ? now.day + 1 : null;
      const parts = [`started day ${dayNo ?? '?'} for ${group}: ${String(now.total ?? 0)} ${unitWord()}`];
      if (was) {
        const unused = Math.max(0, Number(was.total ?? 0) - Number(was.spent ?? 0));
        if (unused > 0) parts.push(`${unused} unused lost yesterday`);
        // Points were owed and none are now: the group arrived. Some still are: say how many.
        if (typeof was.pending_owed === 'number' && now.pending_owed === null) parts.push(TRAVEL_PLACE_WORDS.arrived(enteringName('before', was)));
        else if (typeof now.pending_owed === 'number') parts.push(TRAVEL_PLACE_WORDS.owed(now.pending_owed, enteringName('after', now)));
      }
      return by(parts.join(', '));
    }
    case 'travel.move': {
      const row = main.targetTable === 'travel_groups' ? main : (entry.events.find((e) => e.targetTable === 'travel_groups') ?? main);
      const now = row.after ?? {};
      const was = row.before ?? {};
      const group = travelGroup(now, row);
      // A new Move… over an owed one at the same cost (review of #628): what's owed doesn't change, so it isn't among
      // the change's values; the place, terrain or route being entered is (or the GM's part of the row, in the GM's log).
      const owedChanged = 'pending_owed' in now || 'pending_owed' in was;
      const enteringChanged =
        entry.events.some((e) => e.targetTable === 'travel_group_secrets') ||
        ['pending_place_name', 'pending_place_id', 'pending_terrain_id', 'pending_route_id'].some((key) => key in now || key in was);
      if (!owedChanged && enteringChanged) return by(TRAVEL_PLACE_WORDS.rerouted(group, enteringName('before', was), enteringName('after', now)));
      const cost = Number(now.spent ?? 0) - Number(was.spent ?? 0) + Number(now.pending_owed ?? 0);
      const parts: string[] = [];
      if (typeof now.pending_owed === 'number') parts.push(TRAVEL_PLACE_WORDS.entering(group, now.pending_owed, enteringName('after', now)));
      else parts.push(`moved ${group}${placeFromEntry() ? ` into ${placeFromEntry()}` : ''}, ${cost} ${unitWord()}`);
      if (typeof was.pending_owed === 'number') parts.push(TRAVEL_PLACE_WORDS.dropped(was.pending_owed, enteringName('before', was)));
      return by(parts.join(', '));
    }
    case 'travel.setBudget':
      return by(`set ${travelGroup(after, main)}'s ${unitWord()} to ${String(after.total ?? 0)}${after.pace && after.pace !== 'foot' ? ` (${after.pace === 'riding' ? 'riding' : 'by cart'})` : ''}`);
    case 'travel.forceMarch': {
      const row = main.targetTable === 'travel_groups' ? main : (entry.events.find((e) => e.targetTable === 'travel_groups') ?? main);
      const added = Number(row.after?.total ?? 0) - Number(row.before?.total ?? 0);
      return by(`forced the march with ${travelGroup(row.after ?? {}, row)}: +${added} ${unitWord()}, rest due this evening`);
    }
    case 'travel.spendDay': {
      const used = Number(after.spent ?? 0) - Number(before.spent ?? 0);
      return by(`spent the day looking with ${travelGroup(after, main)}, ${used} ${unitWord()}`);
    }
    // Activities (M5b step 3, D3, S4-8): one line per activity done, everyone's: who acted, what it cost, what was
    // found and by whom (the run row is the main event; the travel row and the yield's line share its request).
    // An activity undone (its own undo): the run marked undone, the yield out of the pack, the points back.
    case 'activity.undo':
      return by(`undid ${String((main.targetTable === 'activity_runs' ? after : (entry.events.find((e) => e.targetTable === 'activity_runs')?.after ?? {})).activity_name ?? 'an activity')}`);
    case 'activity.apply': {
      const run = entry.events.find((e) => e.targetTable === 'activity_runs' && e.before === null)?.after ?? after;
      const actors = Array.isArray(run.actor_ids) ? run.actor_ids.map((id) => named(names.characters, id, 'someone')) : [];
      const parts = [`${String(run.activity_name ?? 'an activity')}${actors.length > 0 ? ` (${actors.join(', ')})` : ''}`];
      if (run.outcome === 'failed') parts.push('it didn’t work');
      const spent = Number(run.spent ?? 0);
      if (spent > 0) parts.push(`${spent} ${unitWord()}`);
      const qty = Number(run.yield_qty ?? 0);
      if (qty > 0) parts.push(`${qty} ${String(run.yield_name ?? 'items')} → ${named(names.characters, run.finder_id, 'the finder')}'s pack`);
      return by(`did ${parts.join(', ')}`);
    }
    case 'travel.lost.set':
      return by(`marked ${travelGroup(after)} lost${after.note ? `: ${String(after.note)}` : ''}`);
    case 'travel.lost.roll':
      return by(`entered the recovery roll for ${travelGroup(after)}: ${String(after.roll ?? '')}`);
    case 'travel.lost.resolve':
      return by(after.found_day !== null && after.found_day !== undefined ? `said ${travelGroup(after)} found the way` : `said ${travelGroup(after)} is still lost`);
    // Messaging (M5b g4, B3): one line per send, naming the characters written to (the GM) or "the GM" (a player);
    // the text stays in the line (a disappearing one's line is the GM's alone). Old Send lines (M5 step 11, D26)
    // read as before.
    case 'message.send': {
      const written = entry.events.filter((e) => e.targetTable === 'messages' && e.before === null).map((e) => e.after ?? {});
      if (written.length > 0) {
        const first = written[0]!;
        const to = first.from_gm === true ? written.map((m) => named(names.characters, m.actor_id, 'a character')).join(', ') : 'the GM';
        const how = first.disappears === true ? ' (disappears once read)' : '';
        const what = [String(first.body ?? '').trim() ? `“${String(first.body)}”` : '', first.attachment_name ? `a picture (${String(first.attachment_name)})` : ''].filter(Boolean).join(' and ');
        return by(`wrote to ${to}${how}: ${what}`);
      }
      const sent = entry.events.find((e) => e.targetTable === 'gm_messages' && e.before === null)?.after;
      if (sent) {
        const count = entry.events.filter((e) => e.targetTable === 'message_recipients' && e.before === null).length;
        const to = sent.everyone === true ? 'everyone' : count === 1 ? '1 character' : `${count} characters`;
        const how = sent.burn === true ? ' (burn after reading)' : sent.keep === true ? ' (kept in Handouts)' : '';
        return by(`sent ${to}${how}: “${String(sent.body ?? '')}”`);
      }
      const body = named(names.messages ?? new Map(), after.message_id, '');
      return `The GM sent you a message${body ? `: “${body}”` : ''}.`;
    }
    case 'message.close':
      return by('read a message from the GM');
    case 'message.read':
      return by('read a message');
    // Got it (K20, pk-13): a verbose line, read by the character's player and the GM alone, in the Pack's voice (the
    // character's name, never the player's). Words not given in the brief: the status file's question.
    // Got it on a call (P7, p7-1): a verbose line, its player's and the GM's alone. Words of the builder's, for Francis.
    // Its author is never empty when written (only a signed-in player can mark), so an empty one means that player's
    // account was deleted since (#77 ⚑ 1, Francis, 24 Nov): "A former player …". A name not loaded stays "Someone".
    case 'hook.seen':
      return main.actorUserId === null ? 'A former player marked a call as seen.' : by('marked a call as seen');
    case 'character.seenFinds':
      return `${named(names.characters, after.actor_id ?? before.actor_id, 'A character')} saw the new finds.`;
    // Sheet changes (plan m5b-sheet-revised B): a player asks the GM for a score or Max HP; the GM approves or refuses.
    // The lines are the player's own, the GM reads every one.
    case 'sheet.requestChange':
    case 'sheet.takeBackChange':
    case 'sheet.approveChange':
    case 'sheet.refuseChange': {
      const event = entry.events.filter((e) => e.targetTable === 'sheet_changes').find((e) => main.type !== 'sheet.requestChange' || e.after?.status === 'waiting');
      // An answer logs only the columns it changed: the request's own words come from its row (names.sheetChanges).
      const known = event?.targetId ? names.sheetChanges?.get(event.targetId) : undefined;
      const row: Record<string, unknown> = { ...(known ? { actor_id: known.actorId, label: known.label, to_value: known.to } : {}), ...(event?.after ?? after) };
      const whose = possessive(named(names.characters, row.actor_id, 'a character'));
      const what = `${String(row.label ?? 'a figure')}`;
      if (main.type === 'sheet.requestChange') return by(`asked the GM to change ${whose} ${what} from ${row.from_value ?? 'nothing'} to ${String(row.to_value ?? '')}`);
      if (main.type === 'sheet.takeBackChange') return by(`took back the change to ${whose} ${what}`);
      if (main.type === 'sheet.approveChange') return by(`approved ${whose} ${what} ${String(row.to_value ?? '')}`);
      return by(`refused ${whose} ${what} ${String(row.to_value ?? '')}${typeof row.reason === 'string' && row.reason ? `: “${row.reason}”` : ''}`);
    }
    // Requests (M5 step 12): a player asks, the GM answers; the requester reads their own lines, the GM every one.
    case 'request.send': {
      const made = entry.events.find((e) => e.targetTable === 'requests' && e.before === null)?.after ?? after;
      return by(`asked the GM for ${named(names.characters, made.actor_id, 'a character')}: “${String(made.text ?? '')}”`);
    }
    case 'request.withdraw':
      return by('took back a request');
    // M5b step 6e: a lodging picked from the town's list; a reply to a priced answer (buy it or leave it, an offer).
    case 'town.stay': {
      const made = entry.events.find((e) => e.targetTable === 'requests' && e.before === null)?.after ?? after;
      const cost = typeof made.cost_text === 'string' && made.cost_text ? `, ${made.cost_text}` : '';
      return by(`${String(made.text ?? 'chose a lodging').replace(/^Staying at/, 'chose to stay at')} for ${named(names.characters, made.actor_id, 'a character')}${cost}`);
    }
    // TC12 (tn-7, tn-8): Ask for…, answered at once from the day's stock, or sent on to the GM when not decided.
    case 'town.askFor': {
      const made = entry.events.find((e) => e.targetTable === 'requests' && e.before === null)?.after ?? after;
      const answer = made.answer && typeof made.answer === 'object' ? (made.answer as Record<string, unknown>) : {};
      const whose = named(names.characters, made.actor_id, 'a character');
      const asked = `asked for ${whose}: “${String(made.text ?? '')}”`;
      if (made.status === 'answered' && answer.kind === 'buy') return by(`${asked}, ${answer.result === 'inStock' ? `In stock: ${String(answer.price ?? '')}` : 'Not here'} (today's stock)`);
      return by(`${asked}, sent to the GM`);
    }
    case 'request.reply': {
      const reply = entry.events.find((e) => e.targetTable === 'requests' && e.before && e.after)?.after ?? after;
      const answer = reply.answer && typeof reply.answer === 'object' ? (reply.answer as Record<string, unknown>) : {};
      const price = typeof answer.price === 'string' && answer.price ? ` for ${answer.price}` : '';
      const yes = reply.reply === 'accept';
      const what = reply.kind === 'sell' ? (yes ? `accepted the offer${price}` : 'declined the offer') : yes ? `bought it${price}` : 'left it';
      return by(`${what}: “${String(reply.text ?? '')}”`);
    }
    // W11b (bu-1): a purchase undone by its buyer: the bought item out of the pack (the line kept in the log).
    case 'request.undoBuy': {
      const gone = entry.events.find((e) => e.targetTable === 'inventory_lines')?.before ?? {};
      return by(`undid buying ${String(gone.name ?? 'an item')}`);
    }
    case 'request.enter':
      return by(`entered ${possessive(named(names.characters, after.actor_id, 'the party'))} escape roll`);
    case 'request.answer': {
      const answer = after.answer && typeof after.answer === 'object' ? (after.answer as Record<string, unknown>) : {};
      const whose = named(names.characters, after.actor_id, 'the party');
      if (answer.kind === 'escape') return by(`sent ${whose} the way out: ${answer.out === true ? 'out safely' : 'lost below'}`);
      // M5b step 6e: buying (In stock, Not here, Price…) and selling (an offer), the price in words.
      if (answer.kind === 'buy') {
        const said = answer.result === 'notHere' ? 'Not here' : `${answer.result === 'inStock' ? 'In stock' : 'Priced'}, ${String(answer.price ?? '')}`;
        return by(`answered ${whose} “${String(after.text ?? '')}”: ${said}`);
      }
      if (answer.kind === 'offer') return by(`offered ${whose} ${String(answer.price ?? '')} for “${String(after.text ?? '')}”`);
      const turns = typeof answer.turns === 'number' && answer.turns > 0 ? `, ${answer.turns} ${answer.turns === 1 ? 'turn' : 'turns'}` : '';
      const note = typeof answer.note === 'string' && answer.note.trim() ? `, ${answer.note.trim()}` : '';
      // A secret activity accepted (M5b step 3, S4-3): its cost came off the group's budget in the same answer.
      const travel = entry.events.find((e) => e.targetTable === 'travel_groups' && e.before && e.after);
      const points = travel ? Number((travel.after as Record<string, unknown>).spent ?? 0) - Number((travel.before as Record<string, unknown>).spent ?? 0) : 0;
      const cost = points > 0 ? `, ${points} ${points === 1 ? 'point' : 'points'}` : '';
      const what = after.kind === 'secretActivity' && typeof after.text === 'string' && after.text ? ` ${after.text}` : '';
      return by(`answered ${whose}${what}: ${answer.yes === true ? `Yes${turns}${cost}` : 'No'}${note}`);
    }
    case 'request.ask': {
      const count = entry.events.filter((e) => e.targetTable === 'requests' && e.before === null).length;
      return by(count === 1 ? 'asked for an escape roll' : `asked for ${count} escape rolls`);
    }
    // Encounter tables, full screen (M5b step g3): pins for the session, and a row read without a hit. The log has no
    // table names, so a pin reads its table's id in words ("lower-abbey" → "Lower abbey").
    case 'tables.pin':
    case 'tables.unpin': {
      const id = String(after.table_id ?? before.table_id ?? '').replace(/[-_]+/g, ' ').trim();
      const name = id ? `${id.charAt(0).toUpperCase()}${id.slice(1)}` : 'a table';
      return by(main.type === 'tables.pin' ? `pinned ${name} for the session` : `unpinned ${name}`);
    }
    case 'tables.readByHand':
      return by(`rolled ${String(after.roll ?? '')} by hand: ${String(after.row_text ?? '')}`);
    // Encounter waiting (M5b step 2): a hit's card queued, started or dismissed (the GM's lines only).
    case 'encounter.queue':
      return by('queued an encounter from a hit');
    case 'encounter.start':
      return by('started a waiting encounter');
    case 'encounter.dismiss':
      return by('dismissed a waiting encounter');
    case 'check.setRoll':
      return after.row_text ? by(`rolled ${String(after.roll ?? '')} for a hit: ${String(after.row_text)}`) : by('changed what a hit rolled');
    case 'note.add':
      return after.about_actor_id
        ? by(`wrote a note about ${named(names.characters, after.about_actor_id, 'a character')}`)
        : by('wrote a note');
    case 'note.edit':
      return by('edited a note');
    case 'character.setHp':
      return by(`set ${possessive(character())} HP to ${String(after.hp_current)} (was ${before.hp_current === null || before.hp_current === undefined ? 'full' : String(before.hp_current)})`);
    case 'character.prepare': {
      const count = Array.isArray(after.prepared) ? after.prepared.length : 0;
      return by(`prepared ${count === 1 ? '1 spell' : `${count} spells`} for ${character()}`);
    }
    case 'character.chooseSpells': {
      // While the first spells are open the choice is ready at once (fsr-1, fsr-10): the line names it, and says so.
      // A change keeps only what changed, so `prepared` is there only when it did; a new row (no before) carries it whole,
      // and an empty one there is a clear that made the row, not a choice.
      if (Array.isArray(after.prepared) && (Array.isArray(before.prepared) || after.prepared.length > 0)) {
        const ready = after.prepared.length;
        // The last ready spell taken out while open empties the list: never "chose 0 spells".
        if (ready === 0) return by(`left ${character()} with no spells ready`);
        return by(`chose ${ready === 1 ? '1 spell' : `${ready} spells`} for ${character()}, ready at once`);
      }
      // Chosen for the next rest (mp-2; dec-8 piece A): never what is ready today.
      if (!Array.isArray(after.chosen)) return by(`cleared ${possessive(character())} spells chosen for the next rest`);
      const count = after.chosen.length;
      return by(`chose ${count === 1 ? '1 spell' : `${count} spells`} for ${possessive(character())} next rest`);
    }
    case 'character.sameAsYesterday':
      return by(`chose the same spells as yesterday for ${possessive(character())} next rest`);
    case 'character.castSpell':
    case 'character.uncastSpell': {
      // The one spell whose count of casts changed, by "<level>:<spell id>".
      const casts = (row: Record<string, unknown>) => (row.spells_cast && typeof row.spells_cast === 'object' ? (row.spells_cast as Record<string, unknown>) : {});
      const keys = [...new Set([...Object.keys(casts(before)), ...Object.keys(casts(after))])];
      const changed = keys.find((k) => casts(before)[k] !== casts(after)[k]);
      const at = changed ? changed.indexOf(':') : -1;
      const spellId = changed && at > 0 ? changed.slice(at + 1) : '';
      const level = changed && at > 0 ? changed.slice(0, at) : '';
      const spell = (spellId && names.spells?.get(spellId)) || (level ? `a level ${level} spell` : 'a spell');
      return main.type === 'character.castSpell' ? by(`cast ${spell} for ${character()}`) : by(`took back a cast of ${spell} for ${character()}`);
    }
    case 'character.pin': {
      // A spell pinned to At hand, an ability or a trait pinned to the Player tab's list (pin-2, euf-2), or unpinned: the
      // one entry that came or went. An ability's or a trait's key is its name.
      const list = (row: Record<string, unknown>) => (Array.isArray(row.pins) ? (row.pins as { kind?: unknown; key?: unknown }[]) : []);
      const id = (p: { kind?: unknown; key?: unknown }) => `${String(p.kind)}:${String(p.key)}`;
      const was = new Set(list(before).map(id));
      const now = new Set(list(after).map(id));
      const added = list(after).find((p) => !was.has(id(p)));
      const gone = list(before).find((p) => !now.has(id(p)));
      const entry = added ?? gone;
      const named =
        entry?.kind === 'trait'
          ? typeof entry.key === 'string' && entry.key
            ? entry.key
            : 'a trait'
          : ((typeof entry?.key === 'string' ? names.spells?.get(entry.key) : undefined) ?? 'a spell');
      if (entry?.kind === 'trait') return added ? by(`pinned ${named} for ${character()}`) : by(`unpinned ${named} for ${character()}`);
      return added ? by(`pinned ${named} to At hand for ${character()}`) : by(`unpinned ${named} from ${possessive(character())} At hand`);
    }
    case 'character.movePin': {
      // A pin moved in the player's order (euf-4; the detailed log), named as the command was given it. A move of one
      // pin by two places or more shifts that pin alone by more than one, so it is the one named. Moved by one place, it
      // and its neighbour simply swap and the stored lists can't tell which was moved: both are named.
      const list = (row: Record<string, unknown>) => (Array.isArray(row.pins) ? (row.pins as { kind?: unknown; key?: unknown }[]) : []);
      const id = (p: { kind?: unknown; key?: unknown }) => `${String(p.kind)}:${String(p.key)}`;
      const nameOf = (p: { key?: unknown }) => (typeof p.key === 'string' && p.key ? p.key : 'a pin');
      const beforeIds = list(before).map(id);
      const shifts = list(after)
        .map((p, i) => ({ p, by: beforeIds.indexOf(id(p)) - i }))
        .filter((s) => s.by !== 0);
      const far = shifts.filter((s) => Math.abs(s.by) > 1);
      if (far.length === 1) return by(`moved ${nameOf(far[0]!.p)} ${far[0]!.by > 0 ? 'up' : 'down'} in ${possessive(character())} pins`);
      if (shifts.length === 2) return by(`swapped ${nameOf(shifts[0]!.p)} and ${nameOf(shifts[1]!.p)} in ${possessive(character())} pins`);
      return by(`changed the order of ${possessive(character())} pins`);
    }
    case 'character.setSpells':
      return by(`changed ${possessive(character())} spells`);
    case 'character.setAc': {
      // Set AC (ruled 2026-10-29): a number set by hand, or cleared so the worked-out AC shows again.
      const now = after.ac_override;
      const was = before.ac_override;
      const shown = (n: unknown) => (typeof n === 'number' && n < 0 ? `−${-n}` : String(n));
      if (now === null || now === undefined) return by(`cleared ${possessive(character())} AC set by hand${was === null || was === undefined ? '' : ` (was ${shown(was)})`}`);
      return by(`set ${possessive(character())} AC to ${shown(now)} by hand`);
    }
    case 'character.setForm': {
      // A class form switched from the sheet (eq-8, ruled 2026-11-04); the gear the form can't use came off in the
      // same change (the request's other events, on inventory lines).
      const form = String(after.form_name ?? after.form_id ?? '') || 'the first form';
      const cameOff = entry.events.filter((e) => e.targetTable === 'inventory_lines' && e.before?.equipped === true && e.after?.equipped === false);
      // The log keeps only what changed, so a line's name may be missing: then the count.
      const itemNames = cameOff.map((e) => e.after?.name ?? e.before?.name).filter((n): n is string => typeof n === 'string' && n !== '');
      const what = itemNames.length === cameOff.length ? listWords(itemNames) : cameOff.length === 1 ? '1 item' : `${cameOff.length} items`;
      const off = cameOff.length === 0 ? '' : ` (${what} came off and ${cameOff.length === 1 ? 'is' : 'are'} carried)`;
      return by(`switched ${character()} to ${form}${off}`);
    }
    case 'character.useAbility': {
      // The one ability whose count changed: a use marked, or one given back.
      const spent = (row: Record<string, unknown>) => (row.uses_spent && typeof row.uses_spent === 'object' ? (row.uses_spent as Record<string, unknown>) : {});
      const names = [...new Set([...Object.keys(spent(before)), ...Object.keys(spent(after))])];
      const changed = names.find((n) => spent(before)[n] !== spent(after)[n]) ?? 'an ability';
      const was = Number(spent(before)[changed] ?? 0);
      const now = Number(spent(after)[changed] ?? 0);
      return now > was ? by(`used ${possessive(character())} ${changed}`) : by(`gave back a use of ${possessive(character())} ${changed}`);
    }
    case 'character.create':
      return by(`made a new character, ${character()}`);
    case 'character.edit': {
      // In a fixed order: the database doesn't keep the order values changed in.
      return by(`edited ${possessive(character())} ${listWords(changedWords(after))}`);
    }
    case 'character.review':
      // An approval that allowed exceptions says which (final drafts D, Design 2026-11-07): "approved Wren, allowing Croak".
      if (after.approval !== 'approved') return by(`sent ${character()} back`);
      return typeof after.review_note === 'string' && after.review_note.startsWith(ALLOWED_PREFIX) ? by(`approved ${character()}, allowing ${after.review_note.slice(ALLOWED_PREFIX.length)}`) : by(`approved ${character()}`);
    case 'character.send':
      return after.approval === 'approved' ? by(`made ${character()}, who joined the party`) : by(`sent ${character()} to the GM`);
    case 'character.resubmit':
      return by(`sent ${character()} to the GM again`);
    case 'character.archive':
      return by(`removed ${character()} from the campaign`);
    case 'character.restore':
      return by(`restored ${character()}`);
    case 'character.delete':
      return by(`deleted ${character()} for good`);
    case 'character.assignCompany':
      return after.company_id
        ? by(`put ${character()} in ${company(after.company_id)}`)
        : by(`took ${character()} out of ${company(before.company_id)}`);
    // M5b step 0c (creation rebuilt): the spell book, and Ask the GM to allow a race or class.
    case 'creation.spellBook.set':
      return by(`set ${possessive(character())} spell book`);
    // Change › on Scores, Race or Class after the draft exists (follow-up C, cf-7): the row's change names what moved.
    case 'creation.redo': {
      const classOf = (row: Record<string, unknown>) => (Array.isArray(row.classes) && row.classes[0] && typeof row.classes[0] === 'object' ? String((row.classes[0] as { classRef?: unknown }).classRef ?? '') : '');
      const moved = classOf(before) !== classOf(after) || before.race_ref !== after.race_ref;
      return moved ? by(`changed ${possessive(character())} race or class: the later picks were cleared`) : by(`changed ${possessive(character())} scores`);
    }
    case 'character.setPortrait':
      return by(`changed ${possessive(character())} portrait`);
    case 'character.clearPortrait':
      return by(`removed ${possessive(character())} portrait`);
    case 'character.reassign': {
      // The GM gave a character to a player, or took it back (page 13 of the December mockups): worded for its reader,
      // the GM, the player who has it now, and the player who had it.
      const moved = entry.events.find((e) => e.targetTable === 'actors') ?? main;
      const was = typeof moved.before?.owner_user_id === 'string' ? moved.before.owner_user_id : null;
      const now = typeof moved.after?.owner_user_id === 'string' ? moved.after.owner_user_id : null;
      const name = named(names.characters, moved.targetId, '') || 'a character';
      const person = (id: string | null) => (id ? (names.people.get(id) ?? 'a player') : 'a player');
      const mine = main.actorUserId === names.me;
      if (now === null) {
        if (mine) return `You took ${name} back from ${person(was)}.`;
        if (was === names.me) return `Your GM took ${name} back.`;
        return by(`took ${name} back from ${person(was)}`);
      }
      if (mine) return `You gave ${name} to ${person(now)}.`;
      if (now === names.me) return `Your GM gave you ${name}.`;
      if (was === names.me) return `Your GM gave ${name} to ${person(now)}.`;
      return by(`gave ${name} to ${person(now)}`);
    }
    case 'member.setActiveCharacter':
      return after.active_actor_id
        ? by(`switched to playing ${named(names.characters, after.active_actor_id, 'another character')}`)
        : by('set no active character');
    case 'campaign.create':
      return by(`started the campaign ${String(after.name ?? '')}`.trim());
    case 'campaign.update': {
      if ('name' in after) return by(`renamed the campaign to ${String(after.name)}`);
      const caller = callerChanged(entry);
      if (caller !== undefined) return by(caller ? `made ${named(names.characters, caller, 'a character')} the caller` : 'set no caller');
      const groups = ruleGroupsChanged(entry);
      const topics = [...groups.added, ...groups.changed];
      if (topics.length > 0) return by(`chose which pack's ${topics.join(', ')} rule the campaign uses`);
      return by('changed the campaign settings');
    }
    case 'campaign.retire':
      return by('retired the campaign');
    case 'campaign.restore':
      return by('brought the campaign back');
    case 'campaign.setSigil':
      return by('changed the campaign sigil');
    case 'campaign.clearSigil':
      return by('removed the campaign sigil');
    case 'invite.create':
      return by('made an invite');
    case 'invite.revoke':
      return by('revoked an invite');
    case 'invite.redeem':
      return by('joined the campaign');
    // Companies run by the players (ruled 2026-10-24): founding, asking, inviting and answering.
    case 'company.found': {
      const made = entry.events.find((e) => e.targetTable === 'companies' && e.after && e.before === null);
      return by(`founded the company ${String(made?.after?.name ?? 'a new company')}`);
    }
    case 'company.ask':
    case 'company.invite': {
      const inv = entry.events.find((e) => e.targetTable === 'company_invitations' && e.after)?.after ?? after;
      const who = named(names.characters, inv.actor_id, 'a character');
      const where = company(inv.company_id);
      return inv.kind === 'ask' ? by(`asked for ${who} to join ${where}`) : by(`invited ${who} to join ${where}`);
    }
    case 'company.answer': {
      const inv = entry.events.find((e) => e.targetTable === 'company_invitations' && e.after)?.after ?? after;
      const row = entry.events.find((e) => e.targetTable === 'company_invitations')?.before ?? before;
      const who = named(names.characters, row.actor_id, 'a character');
      return inv.status === 'accepted' ? `${who} joined ${company(row.company_id)}.` : by(`declined ${who} joining ${company(row.company_id)}`);
    }
    case 'company.cancel':
      return by('took back an ask or invitation to a company');
    case 'company.create':
      return by(`made the company ${thing(names.companies, 'a company')}`);
    case 'company.rename':
      return by(`renamed the company ${String(before.name)} to ${String(after.name)}`);
    case 'company.delete':
      return by(`deleted the company ${thing(names.companies, 'a company')}`);
    case 'field.create':
      return by(`added the field ${field()}`);
    case 'field.update':
      if ('hidden' in after) return by(`${after.hidden ? 'hid' : 'showed'} the field ${field()}`);
      return by(`changed the field ${field()}`);
    case 'field.reorder':
      return by('reordered the character fields');
    case 'field.delete':
      return by(`deleted the field ${field()}`);
    case 'field.useLayout': {
      const count = entry.events.filter((e) => e.targetTable === 'field_definitions').length;
      return by(`added ${count === 1 ? 'a field' : `${count} fields`} from a sheet layout`);
    }
    case 'library.update': {
      const lists = packUpdateLists(entry);
      const to = String(after.to_version ?? '');
      const from = String(after.from_version ?? '');
      const versions = from || to ? ` ${from || '?'} → ${to || '?'}` : '';
      const counts = [lists.added.length > 0 ? `${lists.added.length} added` : '', `${lists.changed.length} changed`, `${lists.removed.length} removed`];
      return `Setting rules updated: ${pack()}${versions} (${counts.filter(Boolean).join(', ')}).`;
    }
    case 'rules.attach': {
      const kept = ruleGroupsChanged(entry).added;
      return by(`added the setting rules ${pack()}${kept.length > 0 ? `; a new choice for ${kept.join(', ')} waits for you` : ''}`);
    }
    case 'rules.setOptions': {
      // One change may move several packs' choices (an add-on its parent hides, a preset; A1, A8) and the load method (A3).
      const links = entry.events.filter((e) => e.targetTable === 'campaign_packs');
      const packNames = [...new Set(links.map((e) => String(e.after?.pack_name ?? e.before?.pack_name ?? '') || named(names.packs, e.targetId, 'setting rules')))];
      const packs = packNames.length > 1 ? `${packNames.slice(0, -1).join(', ')} and ${packNames[packNames.length - 1]}` : pack();
      const write = entry.events.find((e) => e.targetTable === 'campaigns');
      const modeOf = (row: Record<string, unknown> | null) => {
        const settings = row?.settings as { encumbrance?: { mode?: unknown } } | undefined;
        return isEncumbranceMode(settings?.encumbrance?.mode) ? settings.encumbrance.mode : null;
      };
      const mode = write ? modeOf(write.after) : null;
      const load = mode && mode !== modeOf(write!.before) ? `; the load method is now ${ENCUMBRANCE_WORDS[mode].name}` : '';
      return by(`changed the optional rules of ${packs}${load}`);
    }
    case 'rules.detach': {
      const fallen = ruleGroupsChanged(entry).removed;
      return by(`removed the setting rules ${pack()} from the campaign${fallen.length > 0 ? `; the choice for ${fallen.join(', ')} falls back to the next pack` : ''}`);
    }
    case 'rules.reorder':
      return by(`moved the setting rules ${pack()} ${Number(after.priority) > Number(before.priority) ? 'up' : 'down'}`);
    case 'rules.prefer': {
      const was = (before.overrides ?? {}) as Record<string, unknown>;
      const now = (after.overrides ?? {}) as Record<string, unknown>;
      const added = Object.keys(now).find((key) => !(key in was));
      if (added) return by(`chose ${pack()} for ${String(now[added])}, whatever the order`);
      const removed = Object.keys(was).find((key) => !(key in now));
      return by(`let the order of the setting rules decide ${removed ? String(was[removed]) : 'an entry'} again`);
    }
    case 'homebrew.save':
      return main.before === null ? by(`added ${entryName()} to the campaign’s homebrew`) : by(`changed ${entryName()} in the campaign’s homebrew`);
    case 'homebrew.delete':
      return by(`removed ${entryName()} from the campaign’s homebrew`);
    case 'rules.homebrew':
      return by('started the campaign’s homebrew');
    case 'library.delete':
      return by(`deleted the setting rules ${pack()} from ${who === 'You' ? 'your' : 'their'} library, so they’re no longer in this campaign`);
  }

  // A change made outside the app's commands: say what changed, plainly.
  const what =
    main.targetTable === 'actors'
      ? character()
      : main.targetTable === 'companies'
        ? `the company ${thing(names.companies, '')}`.trim()
        : main.targetTable === 'campaigns'
          ? 'the campaign'
          : 'something';
  const verb = main.type.endsWith('.insert') ? 'added' : main.type.endsWith('.delete') ? 'removed' : 'changed';
  return who ? `${who} ${verb} ${what}.` : `${what.charAt(0).toUpperCase()}${what.slice(1)} was ${verb}.`;
}

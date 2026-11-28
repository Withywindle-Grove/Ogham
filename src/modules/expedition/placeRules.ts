// A place's own check and a place's rules (December dec-7 piece 3; docs/plans/dec-7-linked-spots-screens.md; rulings
// rg-4, rg-5, rg-5a, pf-12b in docs/design/rulings/dec-pack-formats-2026-11-11.md and dec-mockup-rulings-2026-11-12.md;
// mc-39b, mc-51, pf-12d in dec-mockup-rulings-set2-2026-11-12.md; supabase/migrations/…_dec_7_3_place_check_and_rules.sql).
//   A location (a region or a place in it) may carry `rules: [{ id, name, text, tableId?, button?, gmOnly? }]` and an
//   `encounterCheck` that may say `replacesScheduled: true` and `when: "eachMove"`. Both cover the places inside it: the
//   party at a spot reads its own and those of every place it sits in, nearest first.
//   The check: the nearest place in the chain with an encounter check decides. When that check says
//   `replacesScheduled`, it stands in for the setting's scheduled encounter check while the party is there (pf-12b),
//   unless the GM has switched it off (rg-5: a toggle on its line, on by default, logged with Undo). A check that says
//   nothing sits beside the setting's (rg-4), so the setting's stays in force.
//   A pack's `"encounterCheck": { "none": true }` (G-27, dg-1 to dg-4) is a stand-in check that never comes due.
//   The rules: open to players once the place is shown to them (mc-51), except a rule the pack marks `gmOnly` (pf-12d),
//   which never reaches a player and can't be opened (rp-3); the GM's eye closes or reopens any other rule (logged, with
//   Undo). What a player's device receives is
//   decided by the database (public.place_rules_for_players, public.encounter_check_for_players); the functions here
//   are the GM's view of the same rules and the words both screens show. Pure, apart from the loaders and commands.
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { possessive } from '../../core/nameWords.ts';
import type { Db } from '../../core/supabase.ts';
import { plainLinks } from '../library/linkMarks.ts';
import { readsAs } from './placePlay.ts';
import type { RuleBlock as ReadBlock, RuleText as ReadRuleText } from '../library/ruleText.ts';
import { readCheck, type Chance, type Check } from './modes.ts';
import { facesWords } from './partyModifiers.ts';

/**
 * One block of a rule's text, as the book sets it out (rt-1, pf-18): a paragraph (with its bold lead-in), a sub-heading,
 * a list (numbered or not), a titled table, a boxed aside holding blocks of its own, the source.
 */
export type RuleBlock =
  | { kind: 'p'; lead: string; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'list'; items: string[]; numbered?: true }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] }
  | { kind: 'box'; title: string; blocks: RuleBlock[] }
  | { kind: 'source'; text: string };

/**
 * A rule's own button as the pack gives it (pf-12e, additive to pf-12 and pf-12c): words, which may name an icon from
 * the app's set, or an icon with its words. Which icon draws, and which words show, is the screen's to say
 * (ruleButtonLook in app/PlaceRules.tsx): this module knows no icons.
 */
export type RuleButton = string | { icon: string; words: string };

export interface PlaceRule {
  id: string;
  name: string;
  blocks: RuleBlock[];
  /** The rule's own button (pf-12, pf-12c, pf-12e), null when it has none. */
  button: RuleButton | null;
  /** The book keeps it from the players (pf-12d). */
  gmOnly: boolean;
}

/** A location in the chain the party is in: the place itself first, then each place it sits in. */
export interface ChainEntry {
  packId: string;
  entryId: string;
  name: string;
  data: Record<string, unknown>;
}

/** A GM's switch on a place's rule: the eye (open to players or not) or the stand-in check's in-force toggle. */
export interface RuleSwitch {
  packId: string;
  entryId: string;
  ruleId: string;
  which: 'eye' | 'inForce';
  value: boolean;
}

/** The rule id the in-force toggle is kept under (the check is not one of `rules`; a pack's ids are kebab-case). */
export const CHECK_RULE_ID = 'encounterCheck';

/** How deep the chain of places is followed (rg-1: any depth; a loop in a pack stops here). */
export const CHAIN_MAX = 12;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const words = (value: unknown): string => (typeof value === 'string' ? plainLinks(value).trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

/**
 * A rule's `button` (pf-12e): non-empty words, or `{ icon, words? }` with a non-empty icon name ('' words when none);
 * null for anything else (no button).
 */
export function ruleButtonOf(value: unknown): RuleButton | null {
  if (typeof value === 'string') return words(value) || null;
  if (!isObject(value) || typeof value.icon !== 'string' || !value.icon.trim()) return null;
  return { icon: value.icon.trim(), words: words(value.words) };
}

/**
 * The button as the players' read sends it (public.place_rules_for_players): its `->> 'button'` is the words, or, for
 * `{ icon, words }`, that object's JSON text, which starts `{"icon"` (the database orders an object's keys by length).
 * Text that doesn't read back as an object is words ("{Tide} bell"), unless it starts `{"icon"`: that is an object the
 * link-mark strip broke (an unclosed mark at the end of its words), and it gives no button rather than raw JSON.
 */
export function ruleButtonFromRead(value: unknown): RuleButton | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text.startsWith('{')) return ruleButtonOf(value);
  try {
    const parsed: unknown = JSON.parse(text);
    if (isObject(parsed)) return ruleButtonOf(parsed);
  } catch {
    // Not JSON: words, unless it is a broken object (below).
  }
  return text.startsWith('{"icon"') ? null : ruleButtonOf(value);
}

/** Every string and number a value holds, nested ones included, in the order written (an unknown block's words). */
const allWords = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(allWords) : isObject(value) ? Object.values(value).flatMap(allWords) : words(value) ? [words(value)] : [];

/**
 * One block from the pack's shape: pf-18's (read the same way as readRuleText in library/ruleText.ts) and the looser
 * ones packs wrote before it. Anything it doesn't know still shows its words as paragraphs, nested ones included
 * (mc-34: nothing trimmed). A table named only by its id (`tableRef`) adds no words, as in pf-18a's plain words
 * (ruleTextWords): its name lives in the table.
 */
function readBlock(value: unknown): RuleBlock[] {
  if (typeof value === 'string') return value.trim() ? [{ kind: 'p', lead: '', text: words(value) }] : [];
  if (!isObject(value)) return [];
  if (isObject(value.table)) {
    const t = value.table;
    const columns = Array.isArray(t.columns) ? t.columns.map(words) : [];
    const rows = Array.isArray(t.rows) ? t.rows.filter(Array.isArray).map((row: unknown[]) => row.map(words)) : [];
    return [{ kind: 'table', title: words(t.title), columns, rows }];
  }
  if (Array.isArray(value.box)) return [{ kind: 'box', title: words(value.title), blocks: value.box.flatMap(readBlock) }];
  if (typeof value.tableRef === 'string') return [];
  if (typeof value.source === 'string') return [{ kind: 'source', text: words(value.source) }];
  const heading = words(value.h) || words(value.heading);
  if (heading) return [{ kind: 'h', text: heading }];
  const items = Array.isArray(value.list) ? value.list : Array.isArray(value.items) ? value.items : Array.isArray(value.ul) ? value.ul : null;
  if (items) return [{ kind: 'list', items: items.map(words).filter(Boolean), ...(value.numbered === true ? { numbered: true as const } : {}) }];
  const text = words(value.p) || words(value.text);
  const lead = words(value.lead);
  if (text || lead) return [{ kind: 'p', lead, text }];
  return allWords(value).map((text) => ({ kind: 'p' as const, lead: '', text }));
}

/** A rule's text as blocks: `{ blocks: [...] }`, a list of blocks, or plain text (paragraphs split at blank lines). */
export function ruleBlocks(text: unknown): RuleBlock[] {
  if (typeof text === 'string') return text.split(/\n\s*\n/).flatMap(readBlock);
  if (Array.isArray(text)) return text.flatMap(readBlock);
  if (isObject(text) && Array.isArray(text.blocks)) return text.blocks.flatMap(readBlock);
  return readBlock(text);
}

/**
 * The blocks to draw for a text the shared reader read (readRuleText, library/ruleText.ts; dec-8 B, a spell's whole
 * description): plain words are paragraphs split at blank lines; a lead-in is a paragraph with its lead; a numbered list
 * keeps its numbers; a box keeps its blocks; a table named only by its id adds nothing (as ruleBlocks). Link marks show
 * as their labels.
 */
export function blocksOfRead(value: ReadRuleText | null): RuleBlock[] {
  if (value === null) return [];
  if (typeof value === 'string') return ruleBlocks(value);
  return value.blocks.flatMap(drawnBlock);
}

function drawnBlock(block: ReadBlock): RuleBlock[] {
  switch (block.kind) {
    case 'p':
      return [{ kind: 'p', lead: '', text: words(block.text) }];
    case 'lead':
      return [{ kind: 'p', lead: words(block.lead), text: words(block.text) }];
    case 'h':
    case 'source':
      return [{ kind: block.kind, text: words(block.text) }];
    case 'list':
      return [{ kind: 'list', items: block.items.map(words), ...(block.numbered ? { numbered: true as const } : {}) }];
    case 'table':
      return [{ kind: 'table', title: words(block.title), columns: block.columns.map(words), rows: block.rows.map((row) => row.map(words)) }];
    case 'tableRef':
      return [];
    case 'box':
      return [{ kind: 'box', title: words(block.title ?? ''), blocks: block.blocks.flatMap(drawnBlock) }];
  }
}

/** A location's own rules, in the pack's order; a rule with no id or name is left out. */
export function readPlaceRules(data: Record<string, unknown>): PlaceRule[] {
  if (!Array.isArray(data.rules)) return [];
  return data.rules.flatMap((value: unknown) => {
    if (!isObject(value)) return [];
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const name = words(value.name);
    if (!id || !name) return [];
    return [{ id, name, blocks: ruleBlocks(value.text), button: ruleButtonOf(value.button), gmOnly: value.gmOnly === true }];
  });
}

/** The place and the places it sits in, nearest first (the pack's `parentId`, in the same pack), at most CHAIN_MAX. */
export function chainOf(entries: readonly ChainEntry[], packId: string, entryId: string): ChainEntry[] {
  const chain: ChainEntry[] = [];
  let at = entries.find((e) => e.packId === packId && e.entryId === entryId);
  while (at && chain.length < CHAIN_MAX && !chain.includes(at)) {
    chain.push(at);
    const parent = typeof at.data.parentId === 'string' ? at.data.parentId : '';
    at = parent ? entries.find((e) => e.packId === packId && e.entryId === parent) : undefined;
  }
  return chain;
}

/** The GM's switch, if there is one. */
export function switchOf(switches: readonly RuleSwitch[], packId: string, entryId: string, ruleId: string, which: RuleSwitch['which']): boolean | null {
  return switches.find((s) => s.packId === packId && s.entryId === entryId && s.ruleId === ruleId && s.which === which)?.value ?? null;
}

/** A place's own encounter check, as the chain gives it. */
export interface PlaceCheck {
  /** The place whose check it is. */
  owner: ChainEntry;
  check: Check;
  /** `when: "eachMove"` (pf-12): raised on each move, not on the clock. */
  eachMove: boolean;
  /** `replacesScheduled: true` (pf-12b): it stands in for the setting's scheduled encounter check. */
  replaces: boolean;
  /** It stands in now: it replaces, and the GM hasn't switched it off (rg-5). */
  inForce: boolean;
  /**
   * The pack's `"encounterCheck": { "none": true }` (G-27, dg-1, dg-2): a stand-in that never comes due. It has no
   * chance, no table and no `when`; it replaces; its name is NO_ENCOUNTERS_NAME.
   */
  none: boolean;
  /** Its name (`checkNameOf`): the check's own, else its table's, else "Encounter check"; `check.name` is the same. */
  name: string;
  /**
   * The pack's own sentence for the check (its `note`, word for word, link marks as their labels), shown on the place
   * page's check card (p2p-14: no sentence written by the app); '' when the pack gives none.
   */
  sentence: string;
}

/**
 * A place's check's own sentence (p2p-14, plan scene-point-to-point B3): the pack's `note` as written (`notes` read as
 * its alias, as a mode's check reads it), its link marks as their labels; '' when it gives none. Never words of the app's.
 */
export function checkSentenceOf(raw: Record<string, unknown>): string {
  return words(raw.note) || words(raw.notes);
}

/** A check's name where it has none of its own and names no table the setting has (p2p-18). */
export const UNNAMED_CHECK = 'Encounter check';

/**
 * A check's name on every screen (p2p-18, plan scene-point-to-point B9): its own, else its table's, else "Encounter
 * check". Never its id: an id is machine text ("jetty-check").
 */
export function checkNameOf(own: string, tableName?: string | null): string {
  return own.trim() || tableName?.trim() || UNNAMED_CHECK;
}

/** A "none" check's name (G-27, dg-17): the switch's toasts and the GM's log say it. */
export const NO_ENCOUNTERS_NAME = 'No encounters here';

/**
 * The check of the nearest place in the chain that has one; null when none has. Its id is the pack's, else
 * "<place>-check" (kept apart from every other check's); its name is never that id (`checkNameOf`): `tableName` reads
 * the name of the table it rolls, where the caller knows the setting's tables.
 */
export function placeCheckOf(chain: readonly ChainEntry[], switches: readonly RuleSwitch[], tableName?: (tableId: string) => string | null): PlaceCheck | null {
  const owner = chain.find((e) => isObject(e.data.encounterCheck));
  if (!owner) return null;
  const raw = owner.data.encounterCheck as Record<string, unknown>;
  const off = switchOf(switches, owner.packId, owner.entryId, CHECK_RULE_ID, 'inForce') === false;
  // A `none` that isn't `true` is no check at all (dg-1; pack:check warns on it).
  if ('none' in raw && raw.none !== true) return null;
  if (raw.none === true) {
    const check: Check = { ...readCheck({ id: `${owner.entryId}-check` })!, name: NO_ENCOUNTERS_NAME };
    return { owner, check, eachMove: false, replaces: true, inForce: !off, none: true, name: NO_ENCOUNTERS_NAME, sentence: checkSentenceOf(raw) };
  }
  const eachMove = raw.when === 'eachMove';
  const read = readCheck({ ...raw, id: typeof raw.id === 'string' ? raw.id : `${owner.entryId}-check`, when: eachMove ? null : raw.when });
  if (!read) return null;
  const name = checkNameOf(words(raw.name), read.onHit.tableId ? tableName?.(read.onHit.tableId) : null);
  const check = { ...read, name };
  const replaces = raw.replacesScheduled === true;
  return { owner, check, eachMove, replaces, inForce: replaces && !off, none: false, name, sentence: checkSentenceOf(raw) };
}

/**
 * A "none" check's card (G-27, dg-3; dg-17 findings 2 and 4), on the place page's "Checks here" and the Rules sheet:
 * in force, "No encounters here." over the pack's sentence and whose rule it is only; switched off, "Encounters as usual
 * here." over the setting's check applying again. `setting` is "the setting's <check>", as the built toasts say it.
 */
export function noEncountersWords(check: Pick<PlaceCheck, 'owner' | 'inForce' | 'sentence'>, setting: string): { title: string; line: string } {
  if (!check.inForce) return { title: 'Encounters as usual here.', line: `${setting.charAt(0).toUpperCase()}${setting.slice(1)} applies here again, until you switch this back.` };
  const own = `${possessive(check.owner.name)} own rule.`;
  return { title: 'No encounters here.', line: check.sentence ? `${check.sentence} ${own}` : own };
}

/**
 * A check that is a roll on its table (p2p-19, plan scene-point-to-point B9): it names a table and has no chance, so
 * it always rolls the table. There is nothing to hit or miss and no modifier to count: its card offers one Enter
 * roll… and the Move sheet's Then line reads "a roll on <the table>". A chance worked out from the terrain is a
 * chance, so a `byTerrain` check never is one.
 */
export function rollsItsTable(check: Pick<Check, 'chance' | 'byTerrain' | 'onHit'>): boolean {
  return check.chance === null && !check.byTerrain && !!check.onHit.tableId;
}

/**
 * The "no camp here" mark on the Location the party is at (plan scene-point-to-point B18; p2p-23, p2p-31; 07: a
 * location's `noCamp: true`): the place's name, for the pop-up, or null where camp may be made. The mark is the
 * Location's own: only the first place of the chain is read, never the places it sits in (nothing is ruled for a mark
 * higher up), and only a plain `true` counts.
 */
export function noCampHere(chain: readonly ChainEntry[]): { name: string } | null {
  const here = chain[0];
  return here && here.data.noCamp === true ? { name: here.name } : null;
}

/**
 * The "way out" mark on the Location the party is at (plan scene-point-to-point B10; p2p-22, p2p-31; 07: a location's
 * `wayOut: true`): leaving is Move on's last row there, "End expedition". Like "no camp here", the mark is the
 * Location's own: only the first place of the chain is read, never the places it sits in, and only a plain `true`
 * counts.
 */
export function wayOutHere(chain: readonly Pick<ChainEntry, 'data'>[]): boolean {
  return chain[0]?.data.wayOut === true;
}

/** A rule with where it comes from and whether players read it. */
export interface PlaceRuleRow {
  owner: ChainEntry;
  rule: PlaceRule;
  /** Open to the players: never a rule the pack keeps for the GM (`gmOnly`); else the GM's eye, open unless closed. */
  open: boolean;
}

/** Why a rule the pack keeps for the GM can't be opened (the lead's ruling, 2026-11-13; the database says the same). */
export const GM_ONLY_RULE_WHY = 'The book keeps this for the GM: players never see it.';

/** Every rule of the chain, nearest place first, each in its pack's order, with its eye. */
export function placeRulesOf(chain: readonly ChainEntry[], switches: readonly RuleSwitch[]): PlaceRuleRow[] {
  return chain.flatMap((owner) =>
    readPlaceRules(owner.data).map((rule) => ({ owner, rule, open: !rule.gmOnly && switchOf(switches, owner.packId, owner.entryId, rule.id, 'eye') !== false })),
  );
}

/** "On every move", "Every turn", "Every 2 turns" (mc-39b: when the check is rolled, on one line). */
export function checkWhenWords(check: { eachMove?: boolean; every: { value: number; unit: string } | null }, fallbackUnit = 'turn'): string {
  if (check.eachMove) return 'On every move';
  const every = check.every ?? { value: 1, unit: fallbackUnit };
  const unit = every.unit.trim().toLowerCase().replace(/s$/, '');
  return every.value === 1 ? `Every ${unit}` : `Every ${every.value} ${unit}s`;
}

/** The chance as "1 in 6" (a die's faces), the faces alone with no die named, null with no chance (the table is always rolled). */
export function checkChanceWords(chance: Chance | null): string | null {
  if (!chance || chance.on.length === 0) return null;
  const sides = chance.die ? Number(/^d(\d+)$/i.exec(chance.die.trim())?.[1] ?? NaN) : NaN;
  const faces = new Set(chance.on).size;
  return Number.isFinite(sides) ? `${faces} in ${sides}` : `on ${facesWords(chance.on)}`;
}

/** The check a player's device may read for one group (public.encounter_check_for_players). */
export interface PlayersCheck {
  group: number;
  /** The place whose check stands in (the last place shown to the group, or one it sits in). */
  placeName: string;
  eachMove: boolean;
  every: { value: number; unit: string } | null;
  chance: Chance | null;
}

/** A rule a player's device may read (public.place_rules_for_players). */
export interface PlayersRule {
  group: number;
  /** The place the rule belongs to, as players know it (the shown place's name for a place they weren't shown). */
  placeName: string;
  name: string;
  blocks: RuleBlock[];
  button: RuleButton | null;
}

const gmOnlyRule = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** The GM's switches on the campaign's place rules (the GM's alone; null when they can't be read). */
export async function loadRuleSwitches(db: Db, campaignId: string): Promise<RuleSwitch[] | null> {
  const { data, error } = await db.from('place_rule_switches').select('pack_id, entry_id, rule_id, which, value').eq('campaign_id', campaignId).eq('undone', false);
  if (error) return null;
  return (data ?? []).map((r) => ({ packId: String(r.pack_id), entryId: String(r.entry_id), ruleId: String(r.rule_id), which: r.which === 'inForce' ? 'inForce' : 'eye', value: r.value === true }));
}

/** The chain the GM's device reads from the library (location entries are the GM's): the place, then the places it sits in. */
export async function loadPlaceChain(db: Db, packId: string, entryId: string): Promise<ChainEntry[] | null> {
  const chain: ChainEntry[] = [];
  let next = entryId;
  while (next && chain.length < CHAIN_MAX && !chain.some((c) => c.entryId === next)) {
    const { data, error } = await db.from('library_entries').select('pack_entry_id, name, data').eq('pack_id', packId).eq('kind', 'location').eq('pack_entry_id', next).maybeSingle();
    if (error) return null;
    if (!data) break;
    const entry: ChainEntry = { packId, entryId: String(data.pack_entry_id), name: typeof data.name === 'string' ? data.name : '', data: (data.data ?? {}) as Record<string, unknown> };
    chain.push(entry);
    next = typeof entry.data.parentId === 'string' ? entry.data.parentId : '';
  }
  return chain;
}

/**
 * The GM's view of where the party's first group is (as loadRegionNow reads it): its place's chain from the pack and the
 * GM's switches. Null when there is no pack place there; 'unread' when it can't be read, so a screen can keep what it
 * last read well through a network blip (the strip's chain, S7; as useLastGoodRules does for a player's rules).
 */
export async function readPlaceRulesNow(db: Db, campaignId: string, expeditionId: string): Promise<{ chain: ChainEntry[]; switches: RuleSwitch[] } | null | 'unread'> {
  const rows = await db.from('group_places').select('group_number, place_id, created_at').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false).eq('moved_on', false).order('group_number').order('created_at', { ascending: false });
  if (rows.error) return 'unread';
  const first = (rows.data ?? [])[0];
  if (!first?.place_id) return null;
  const place = await db.from('places').select('pack_id, pack_entry_id').eq('id', String(first.place_id)).maybeSingle();
  if (place.error) return 'unread';
  if (!place.data?.pack_id || !place.data.pack_entry_id) return null;
  const [chain, switches] = await Promise.all([loadPlaceChain(db, String(place.data.pack_id), String(place.data.pack_entry_id)), loadRuleSwitches(db, campaignId)]);
  return chain && switches ? { chain, switches } : 'unread';
}

/** The strip's place chain after a read (S7): a failed read keeps the last good chain; no place there is none. */
export function chainAfterRead(last: readonly ChainEntry[], read: { chain: ChainEntry[] } | null | 'unread'): readonly ChainEntry[] {
  if (read === 'unread') return last;
  return read?.chain ?? [];
}

/** The rules a player reads, by group (only what the database gives them); null when they can't be read. */
export async function loadPlayersRules(db: Db, campaignId: string, asPlayer?: string): Promise<PlayersRule[] | null> {
  const { data, error } = await db.rpc('place_rules_for_players', readsAs(campaignId, asPlayer));
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    group: Number(r.group_number),
    placeName: String(r.place_name ?? ''),
    name: String(r.name ?? ''),
    blocks: ruleBlocks(r.body),
    button: ruleButtonFromRead(r.button),
  }));
}

/** The place's check a player reads, by group (none for a group where the setting's check holds); null when it can't be read. */
export async function loadPlayersCheck(db: Db, campaignId: string, asPlayer?: string): Promise<PlayersCheck[] | null> {
  const { data, error } = await db.rpc('encounter_check_for_players', readsAs(campaignId, asPlayer));
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const raw = isObject(r.checked) ? r.checked : {};
    const check = readCheck({ ...raw, id: 'place-check', when: null });
    return { group: Number(r.group_number), placeName: String(r.place_name ?? ''), eachMove: raw.when === 'eachMove', every: check?.every ?? null, chance: check?.chance ?? null };
  });
}

type SwitchInput = { campaignId: string; packId: string; entryId: string };

/** The GM's eye on a place's rule (mc-51): open to the players, or closed. At once, logged, with Undo. */
export const setRuleEye = defineCommand({
  name: 'placeRule.eye',
  target: (input: SwitchInput & { ruleId: string; open: boolean }) => ({ campaignId: input.campaignId }),
  allowed: gmOnlyRule,
  run: async (db, _user, input): Promise<CommandResult<boolean>> => {
    const { error } = await db.rpc('set_place_rule_switch', { campaign: input.campaignId, pack: input.packId, entry_id: input.entryId, rule_id: input.ruleId, which: 'eye', value: input.open });
    return error ? fromError(error) : ok(input.open);
  },
});

/** The stand-in check's toggle (rg-5): on, the place's check stands in; off, the setting's is back in force there. Logged, with Undo. */
export const setCheckInForce = defineCommand({
  name: 'placeRule.inForce',
  target: (input: SwitchInput & { on: boolean }) => ({ campaignId: input.campaignId }),
  allowed: gmOnlyRule,
  run: async (db, _user, input): Promise<CommandResult<boolean>> => {
    const { error } = await db.rpc('set_place_rule_switch', { campaign: input.campaignId, pack: input.packId, entry_id: input.entryId, rule_id: CHECK_RULE_ID, which: 'inForce', value: input.on });
    return error ? fromError(error) : ok(input.on);
  },
});

export const PLACE_RULE_COMMANDS = [setRuleEye, setCheckInForce] as const;

// The town screen's pure part (M5b step 6c; docs/plans/m5b-6-settlements.md "Step 6c"; ruled 2026-10-30, ST3, ST12;
// bq3-1: a place marked Safe or Hostile is a settlement place). What the setting says about towns (07 Settlements,
// st-2: `settlement.services[]`; the Downtime section's `lodgings[]` and `lifestyles[]`, dt-46), read from the rules
// sets (the pack on top wins, as the other readers), and what the GM has set for each place in town (places.town:
// shown to players or not, open or closed; supabase/migrations/20261104170000_m5b_6c_town_screen.sql).
//   Places in town: the services that are places to go (buy, sell, identify, store, loan), grouped as shops and
//   others, and the lodgings with their rates. Things to do: the services of kind `other` (07: offered as a town
//   activity). M8b adds named shops, temples, people and rumours from adventures.

import { optionGate, type Choices } from '../library/optionGate.ts';

export type ServiceKind = 'buy' | 'sell' | 'identify' | 'store' | 'loan' | 'other';
const SERVICE_KINDS: readonly ServiceKind[] = ['buy', 'sell', 'identify', 'store', 'loan', 'other'];

/** A settlement service (07, st-2): `{ id, name, kind, rate?, note }`; a seller's `rate` is the share of the price it pays. */
export interface TownService {
  id: string;
  name: string;
  kind: ServiceKind;
  rate: number | null;
  note: string;
}

/** A lodging (07 Downtime, dt-46): its name and its rate in words ("2 sp a night"). */
export interface TownLodging {
  name: string;
  rate: string;
  sleeps: number | null;
  /** Its quality word as the pack writes it (pf-5, "Comfortable"); '' if none. */
  grade?: string;
  /** The pack's place (a location id) that offers it, the inn (pf-5); '' if none. */
  placeId?: string;
}

/** A lifestyle (07 Downtime): one daily cost by tier, as text until purses (M7b). */
export interface TownLifestyle {
  name: string;
  rate: string;
}

export interface TownRules {
  services: TownService[];
  lodgings: TownLodging[];
  lifestyles: TownLifestyle[];
}

/** How the screen groups the places in town (ST3: shops, lodgings, temples, others; temples come with M8b). */
export type TownGroup = 'shop' | 'lodging' | 'other';
export const TOWN_GROUPS: readonly TownGroup[] = ['shop', 'lodging', 'other'];
export const TOWN_GROUP_WORDS: Record<TownGroup, string> = { shop: 'Shops', lodging: 'Lodgings', other: 'Others' };
const GROUP_ONE: Record<TownGroup, string> = { shop: 'Shop', lodging: 'Lodging', other: 'Other' };

/** One place in town: its key in places.town, its name, its group, and what it does in a few words. */
export interface TownPlace {
  key: string;
  name: string;
  group: TownGroup;
  /** "Shop · pays 50% of the price", "Lodging · 2 sp a night". */
  words: string;
  note: string;
  /** A lodging's inn, as the pack's location id (pf-5); '' or left out when the pack names none. */
  placeId?: string;
}

/** What the GM has set for a place in town (places.town); a place nobody touched is hidden and open. */
export interface TownEntry {
  name: string;
  kind: string;
  shown: boolean;
  open: boolean;
}
export type TownState = Readonly<Record<string, TownEntry>>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const records = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : []);

/** An amount in words: text as written, a number as it is, coins as "1 gp 5 sp". Empty when there's none. */
export function amountWords(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n !== 0)
      .map(([coin, n]) => `${n as number} ${coin}`)
      .join(' ');
  }
  return '';
}

/** A rate and its period: "2 sp a night"; "2 sp" with no period; "5 gp per week" when the period is several words. */
export function rateWords(rate: unknown, per: unknown): string {
  const amount = amountWords(rate);
  const period = text(per);
  if (!amount) return '';
  if (!period) return amount;
  return /^[a-z]+$/i.test(period) ? `${amount} a ${period}` : `${amount} ${period}`;
}

/** An entry's key for merging a list (ov-1): its id, else its name (lodgings and lifestyles are often unnamed by id). */
const keyOf = (entry: Record<string, unknown>): string => text(entry.id) || (text(entry.name) || text(entry.tier)).toLowerCase();

/**
 * One of the town's lists across the stack, lowest rules set first. A rules set with the list replaces what's below
 * (the pack on top wins, as the other readers), except a rules overlay's fragment (`extends` a rules set below it,
 * ov-1's list rule): its entries merge by id, the overlay's copy taking the same id's place, new ids appended.
 */
function stackedList(rulesSets: readonly Record<string, unknown>[], section: string, list: string): Record<string, unknown>[] {
  let out: Record<string, unknown>[] = [];
  const below = new Set<string>();
  for (const set of rulesSets) {
    const part = set[section];
    if (isRecord(part) && Array.isArray(part[list])) {
      const entries = records(part[list]);
      const base = text(set.extends);
      if (base && below.has(base)) {
        const merged = [...out];
        for (const entry of entries) {
          const key = keyOf(entry);
          const at = key ? merged.findIndex((e) => keyOf(e) === key) : -1;
          if (at >= 0) merged[at] = entry;
          else merged.push(entry);
        }
        out = merged;
      } else out = entries;
    }
    if (text(set.id)) below.add(text(set.id));
  }
  return out;
}

/**
 * What the setting says about towns (services from `settlement`, lodgings and lifestyles from `downtime`), across the
 * stack (stackedList), each entry as the campaign's choices make it: one carrying `option` (a spec or a list, of-3,
 * of-12) only while its choice is on, its `byOption` applied (optionGate); with no choices given, every option is
 * off. Null when no rules set says anything.
 */
export function readTown(rulesSets: readonly Record<string, unknown>[], choices: Choices = {}): TownRules | null {
  const inPlay = (entries: Record<string, unknown>[]) =>
    entries.flatMap((data) => {
      const gated = optionGate({ kind: 'townEntry', data }, choices);
      return gated.inPlay ? [gated.data] : [];
    });
  const services = inPlay(stackedList(rulesSets, 'settlement', 'services')).flatMap((s): TownService[] => {
    const id = text(s.id);
    const name = text(s.name);
    const kind = SERVICE_KINDS.find((k) => k === s.kind) ?? 'other';
    if (!id || !name) return [];
    return [{ id, name, kind, rate: typeof s.rate === 'number' && Number.isFinite(s.rate) ? s.rate : null, note: text(s.note) }];
  });
  const lodgings = inPlay(stackedList(rulesSets, 'downtime', 'lodgings')).flatMap((l): TownLodging[] => {
    const name = text(l.name);
    if (!name) return [];
    const lodging: TownLodging = { name, rate: rateWords(l.rate, l.per), sleeps: typeof l.sleeps === 'number' && Number.isInteger(l.sleeps) ? l.sleeps : null };
    // pf-5: the quality word and the pack's inn that offers it, when the pack gives them.
    if (text(l.grade)) lodging.grade = text(l.grade);
    if (text(l.placeId)) lodging.placeId = text(l.placeId);
    return [lodging];
  });
  const lifestyles = inPlay(stackedList(rulesSets, 'downtime', 'lifestyles')).flatMap((l): TownLifestyle[] => {
    const name = text(l.name) || text(l.tier);
    const rate = rateWords(l.rate ?? l.cost, l.per ?? 'day');
    return name ? [{ name, rate }] : [];
  });
  if (services.length === 0 && lodgings.length === 0 && lifestyles.length === 0) return null;
  return { services, lodgings, lifestyles };
}

/** What a service does, in a few words ("pays 50% of the price"). */
function serviceWords(s: TownService): string {
  switch (s.kind) {
    case 'buy':
      return 'sells';
    case 'sell':
      return s.rate !== null ? `buys at ${s.rate}% of the price` : 'buys';
    case 'identify':
      return 'identifies and values';
    case 'store':
      return 'keeps things safe';
    case 'loan':
      return 'lends money';
    default:
      return '';
  }
}

/** The places in town, in the screen's order: shops, lodgings, others; each in the pack's order. */
export function townPlacesOf(rules: TownRules | null): TownPlace[] {
  if (!rules) return [];
  const services = rules.services.filter((s) => s.kind !== 'other');
  const place = (s: TownService): TownPlace => {
    const group: TownGroup = s.kind === 'store' || s.kind === 'loan' ? 'other' : 'shop';
    const does = serviceWords(s);
    return { key: `service:${s.id}`, name: s.name, group, words: does ? `${GROUP_ONE[group]}, ${does}` : GROUP_ONE[group], note: s.note };
  };
  const lodging = (l: TownLodging): TownPlace => ({
    key: `lodging:${l.name.toLowerCase()}`,
    name: l.name,
    group: 'lodging',
    words: [GROUP_ONE.lodging, l.grade ?? '', l.rate, l.sleeps !== null ? `sleeps ${l.sleeps}` : ''].filter(Boolean).join(', '),
    note: '',
    ...(l.placeId ? { placeId: l.placeId } : {}),
  });
  const all = [...services.map(place), ...rules.lodgings.map(lodging)];
  return TOWN_GROUPS.flatMap((g) => all.filter((p) => p.group === g));
}

/** Things to do in town (07: a service of kind `other` is offered as a town activity). */
export const thingsToDoOf = (rules: TownRules | null): TownService[] => (rules ? rules.services.filter((s) => s.kind === 'other') : []);

/**
 * The places the GM shows that are still in play: a setting's service or lodging the campaign's choices now take away
 * (its option off) is left out, as on the GM's list; any other place stays, and all stay while there are no rules read.
 */
export function shownInPlay<T extends { key: string }>(shown: readonly T[], rules: TownRules | null): T[] {
  if (!rules) return [...shown];
  const known = new Set([...townPlacesOf(rules).map((p) => p.key), ...rules.services.map((s) => `service:${s.id}`)]);
  return shown.filter((p) => !/^(?:service|lodging):/.test(p.key) || known.has(p.key));
}

/** A place in town as the GM has set it (hidden and open until touched). */
export function entryOf(state: TownState | null | undefined, place: Pick<TownPlace, 'key' | 'name' | 'group'>): TownEntry {
  return state?.[place.key] ?? { name: place.name, kind: place.group, shown: false, open: true };
}

/** The town with one place changed (its name and kind as the screen shows them now). */
export function withEntry(state: TownState | null | undefined, place: Pick<TownPlace, 'key' | 'name' | 'group'>, change: Partial<Pick<TownEntry, 'shown' | 'open'>>): Record<string, TownEntry> {
  const was = entryOf(state, place);
  return { ...(state ?? {}), [place.key]: { name: place.name, kind: place.group, shown: change.shown ?? was.shown, open: change.open ?? was.open } };
}

/** places.town as stored, read safely: entries that aren't written right are left out. */
export function readTownState(value: unknown): Record<string, TownEntry> {
  if (!isRecord(value)) return {};
  const out: Record<string, TownEntry> = {};
  for (const [key, v] of Object.entries(value)) {
    if (!isRecord(v) || !text(v.name) || typeof v.shown !== 'boolean' || typeof v.open !== 'boolean') continue;
    out[key] = { name: text(v.name), kind: text(v.kind), shown: v.shown, open: v.open };
  }
  return out;
}

/** "3 of 7 shown to players": the town's count for the GM. */
export function shownWords(places: readonly TownPlace[], state: TownState | null | undefined): string {
  const shown = places.filter((p) => entryOf(state, p).shown).length;
  return `${shown} of ${places.length} shown to players`;
}

/** A player's line for a shown place: "Shop · sells · Open" (their own pack's words when it has the place). */
export function playerWords(entry: { key: string; kind: string; open: boolean }, places: readonly TownPlace[]): string {
  const known = places.find((p) => p.key === entry.key);
  const kind = known ? known.words : GROUP_ONE[TOWN_GROUPS.find((g) => g === entry.kind) ?? 'other'];
  return `${kind}, ${entry.open ? 'Open' : 'Closed'}`;
}

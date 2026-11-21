// Sleep difficulty from facts (ruled 2026-10-30, D19; 05 "Exploration modes", Camp): where the pack says so, each
// character's difficulty is looked up from the season, whether the campfire is lit and the bedding that covers that
// character, shown with its reasons and changeable by the GM. Bedding can be shared: an item covers its `shares`
// characters (a tent covers two), its carrier first. A difficulty's `result` says what follows: a good or a bad rest
// with no roll, or the sleep check, which uses the pack's ability with the difficulty's and the camp's modifiers (campfire talk…). Pure.
import type { BeddingCondition, SleepDifficulty, SleepResult, SleepRow, SleepRules } from './wildPack.ts';

export interface Sleeper {
  id: string;
  name: string;
  /** The item ids the character carries, one entry per item (two tents: the id twice). */
  itemIds: readonly string[];
}

/** The camp's facts. */
export interface CampFacts {
  season: string | null;
  /** The campfire is lit (D16: read from the campfire light). */
  fire: boolean;
  /** Other camp facts the pack's sleep modifiers name ("campfire-talk"…). */
  flags?: readonly string[];
}

export interface SleepModifier {
  label: string;
  add: number;
}

/** The bedding covering one character: its item id, and who carries it when it's someone else's. */
export interface Cover {
  itemId: string;
  from: { id: string; name: string } | null;
}

export interface SleepFor {
  characterId: string;
  /** Null: no row of the pack matches; the GM picks. */
  difficulty: SleepDifficulty | null;
  /** The facts behind it, in plain words ("Season: Frost", "No fire", "Bedding: Tent, shared with Bog lurker"). */
  reasons: string[];
  /** The bedding covering the character. */
  covers: Cover[];
  /** The difficulty's result: "good" or "bad" (no roll), "check" (roll); null: the GM decides (no difficulty yet). */
  outcome: SleepResult | null;
  ability: string | null;
  /** The difficulty's own and the camp's modifiers to the roll; empty with no roll. */
  modifiers: SleepModifier[];
  /** The total of the modifiers. */
  add: number;
  /** The GM changed it. */
  overridden: boolean;
}

export interface Names {
  season?: (id: string) => string;
  item?: (id: string) => string;
}

/**
 * Who each bedding item covers (D19): every bedding item a character carries covers them; one with `shares` above 1
 * also covers that many less one others who have nothing of that item yet, in the order given.
 */
export function shareBedding(rules: SleepRules, sleepers: readonly Sleeper[]): Map<string, Cover[]> {
  const covers = new Map<string, Cover[]>(sleepers.map((s) => [s.id, []]));
  const has = (id: string, itemId: string) => covers.get(id)!.some((c) => c.itemId === itemId);
  for (const sleeper of sleepers) {
    for (const itemId of sleeper.itemIds) {
      const item = rules.beddingItems.find((b) => b.id === itemId);
      if (!item) continue;
      let left = item.shares;
      if (!has(sleeper.id, itemId)) {
        covers.get(sleeper.id)!.push({ itemId, from: null });
        left--;
      }
      for (const other of sleepers) {
        if (left <= 0) break;
        if (other.id === sleeper.id || has(other.id, itemId) || other.itemIds.includes(itemId)) continue;
        covers.get(other.id)!.push({ itemId, from: { id: sleeper.id, name: sleeper.name } });
        left--;
      }
    }
  }
  return covers;
}

function beddingMatches(condition: BeddingCondition, covers: readonly Cover[]): boolean {
  if (condition === 'none') return covers.length === 0;
  const ids = covers.map((c) => c.itemId);
  return 'any' in condition ? condition.any.some((id) => ids.includes(id)) : condition.all.every((id) => ids.includes(id));
}

function rowMatches(row: SleepRow, facts: CampFacts, covers: readonly Cover[]): boolean {
  if (row.seasons.length && !(facts.season && row.seasons.includes(facts.season))) return false;
  if (row.fire !== null && row.fire !== facts.fire) return false;
  return row.bedding === null || beddingMatches(row.bedding, covers);
}

function reasonsFor(row: SleepRow, facts: CampFacts, covers: readonly Cover[], names: Names): string[] {
  const out: string[] = [];
  if (row.seasons.length && facts.season) out.push(`Season: ${names.season?.(facts.season) ?? facts.season}`);
  if (row.fire !== null) out.push(facts.fire ? 'Fire lit' : 'No fire');
  if (row.bedding === 'none') out.push('No bedding');
  else if (row.bedding) {
    const named = 'any' in row.bedding ? row.bedding.any : row.bedding.all;
    for (const cover of covers.filter((c) => named.includes(c.itemId))) {
      const item = names.item?.(cover.itemId) ?? cover.itemId;
      out.push(cover.from ? `Bedding: ${item}, shared with ${cover.from.name}` : `Bedding: ${item}`);
    }
  }
  return out;
}

/**
 * One character's sleep: the first of the pack's rows that matches gives the difficulty (D19). `covers` is the
 * bedding covering them (from shareBedding; by default only what they carry themselves). `override` is the GM's pick
 * (a difficulty id); it keeps the reasons and is marked as changed.
 */
export function sleepFor(
  rules: SleepRules,
  sleeper: Sleeper,
  facts: CampFacts,
  options: { override?: string | null; names?: Names; ability?: string | null; covers?: readonly Cover[] } = {},
): SleepFor {
  const names = options.names ?? {};
  const covers = [...(options.covers ?? shareBedding(rules, [sleeper]).get(sleeper.id)!)];
  const row = rules.rows.find((r) => rowMatches(r, facts, covers)) ?? null;
  const looked = row ? (rules.difficulties.find((d) => d.id === row.difficulty) ?? null) : null;
  const picked = options.override ? (rules.difficulties.find((d) => d.id === options.override) ?? null) : null;
  const difficulty = picked ?? looked;
  const outcome = difficulty ? difficulty.result : null;
  const roll = outcome === 'check';
  const modifiers: SleepModifier[] = [];
  if (roll) {
    if (difficulty!.add) modifiers.push({ label: difficulty!.name, add: difficulty!.add });
    for (const m of rules.modifiers) if (facts.flags?.includes(m.when) && m.add) modifiers.push({ label: m.note ?? m.when, add: m.add });
  }
  return {
    characterId: sleeper.id,
    difficulty,
    reasons: row ? reasonsFor(row, facts, covers, names) : [],
    covers,
    outcome,
    ability: roll ? (options.ability ?? rules.checkAbility) : null,
    modifiers,
    add: modifiers.reduce((sum, m) => sum + m.add, 0),
    overridden: picked !== null && picked.id !== looked?.id,
  };
}

/** Everyone's sleep, in the order given, with bedding shared; `overrides` maps a character id to the GM's pick. */
export function campSleep(
  rules: SleepRules,
  sleepers: readonly Sleeper[],
  facts: CampFacts,
  options: { overrides?: Readonly<Record<string, string>>; names?: Names; ability?: string | null } = {},
): SleepFor[] {
  const covers = shareBedding(rules, sleepers);
  return sleepers.map((s) => sleepFor(rules, s, facts, { override: options.overrides?.[s.id] ?? null, names: options.names, ability: options.ability, covers: covers.get(s.id)! }));
}

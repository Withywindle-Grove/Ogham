// A check's prompt (docs/05 "Checks and their modifiers"; 07 "Exploration", Checks and onHit, G-07): dice stay at
// the table, so the prompt shows the chance with its modifiers already counted ("Roll 1d6 · lost on 1–3") and lists
// each modifier with its source. Modifiers come from a fixed list (weatherTag, routeType, trackId / byTrack) plus
// what the party's abilities and the GM's "+ Modifier" add. On a hit the prompt says which table to roll: one
// table, the GM's pick of several (by depth), a column (the terrain's own beats the GM's pick), the region's table
// (through the rules set's wildEncounters), or a note only. Pure.
//   Engine rulings of 2026-10-29: a byTerrain check names its terrain chance (`terrainChance`; the step's symbol is
// only a warned fallback); terrain faces take the check's die, then the mode's `chanceDie`, then d6; the table on a
// hit is the GM's pick, then the place's default, then the terrain's (wanderChance checks only), then the check's
// own; a lost check always rolls its own onHit.
import type { Check, Chance, ExplorationRules, Icon, SpecialSeason, Terrain, TerrainChance } from './modes.ts';
import { bestChance, facesWords, partyReach, type PartyMember } from './partyModifiers.ts';
import { optionSpecOn, type Choices } from '../library/optionGate.ts';

export interface CheckContext {
  terrain?: Terrain | null;
  /** The route the party follows (road, track…), for routeType modifiers. */
  routeType?: string | null;
  /** The region's name (until G-05 rules region ids), for onHit.regionTables. */
  region?: string | null;
  /** Today's weather tags (GM-side). */
  weatherTags?: readonly string[];
  /** Track values by track id. */
  tracks?: Readonly<Record<string, number>>;
  /** Special seasons switched on. */
  specialSeasons?: readonly SpecialSeason[];
  /** What the party's abilities and the GM's "+ Modifier" add, by check id. */
  extra?: readonly ExtraModifier[];
  /** The mode's chanceDie: the die for terrain faces when the check names none. */
  chanceDie?: string | null;
  /** The encounter table the GM picked for now (it beats every other table). */
  pickedTableId?: string | null;
  /** The current place's default encounter table. */
  placeTableId?: string | null;
  /** Who is in the group the check is for (their classes and skills), for modifiers keyed to the party (ex-2, ga-3). */
  party?: readonly PartyMember[];
  /** The campaign's optional-rule choices: a modifier with `onlyWithOption` applies only while it's on (of-4). */
  choices?: Choices;
}

export interface ExtraModifier {
  checkId: string;
  source: 'party' | 'hand';
  label: string;
  add: number;
  /** Players may see it (party abilities are public; the GM's hand modifiers aren't). */
  public: boolean;
}

export interface ModifierLine {
  source: 'rules' | 'party' | 'hand';
  /**
   * What it comes from: a weather tag, route type, track or terrain id, or the label given; `trait`: the pack's
   * modifier keyed to the party (ex-2, ga-3), its label naming who has what ("a Reed Witch in the party").
   */
  kind: 'terrain' | 'weatherTag' | 'routeType' | 'track' | 'party' | 'hand' | 'trait';
  label: string;
  /** Faces added (or taken away); null when it replaces the chance or rules the roll out. */
  add: number | null;
  /** The chance it puts in place, when it replaces it. */
  replaces: Chance | null;
  /** It rules the roll out ("never" on a road). */
  never: boolean;
  public: boolean;
  note: string | null;
  /** A self modifier's character (`who: "self"`): it counts for their roll only and leaves the group's chance alone. */
  actor?: { id: string; name: string } | null;
}

export interface HitPlan {
  /** The table(s) to roll on a hit: one, or several for the GM to pick from (`pick`). Empty: a note only. */
  tables: string[];
  /** Where the table comes from (engine ruling 3): the GM's pick, the place, the terrain or the check; null: none. */
  tableFrom: 'gm' | 'place' | 'terrain' | 'check' | null;
  pick: boolean;
  /** The column, when the terrain names it (it beats the GM's pick). */
  column: string | null;
  /** Columns for the GM to pick from, when the terrain names none. */
  columns: string[];
  /** The region's table (onHit.regionTables, through wildEncounters), when the region is known. */
  regionTable: string | null;
  regionTables: boolean;
  /** A special season's swap: on this chance, roll its table instead. */
  swap: { season: string; chance: Chance; tableId: string } | null;
  noteOnly: boolean;
  note: string | null;
  /**
   * The tables a hit may roll, for the GM's Which table? list (ruled 2026-10-30, D12; M5 gate B2): in D12's order
   * (the place's default, the terrain's for a wanderChance check, the region's, a special season's swap, the
   * check's own), each once; the first is the likely one. A lost check (or one that isn't an encounter check)
   * offers only its own.
   */
  candidates: TableCandidate[];
}

/** One table a hit may roll, and why it's offered. */
export interface TableCandidate {
  tableId: string;
  /** `none`: offered with no tag (d5-13: the method's tables at a place whose own check stands in). */
  why: 'place' | 'terrain' | 'region' | 'season' | 'check' | 'none';
  /** The special season whose swap it is (`why: 'season'`). */
  season: string | null;
}

export interface CheckPrompt {
  checkId: string;
  name: string;
  icon: Icon;
  /** The chance with modifiers counted; null when the GM must judge it (no chance known). */
  chance: Chance | null;
  /** The chance in words ("1–2 on d6"); null with no chance. */
  chanceText: string | null;
  /** Which terrain chance a byTerrain check used; null when it isn't byTerrain. */
  terrainChance: TerrainChance | null;
  /** What the pack should say and doesn't (a terrain chance guessed from the symbol), for the GM and pack:check. */
  warnings: string[];
  /** No chance at all: always roll the table (`chance: null` in the encounter-check shape). */
  always: boolean;
  /** A modifier rules the roll out (no roll needed). */
  ruledOut: boolean;
  modifiers: ModifierLine[];
  hit: HitPlan;
  when: Check['when'];
  /** checks[].secret: players see the result only at Downtime (or when the GM reveals it). */
  secret: boolean;
  note: string | null;
}

const sidesOf = (die: string | null) => {
  const match = die ? /^d(\d+)$/i.exec(die.trim()) : null;
  return match ? Number(match[1]) : null;
};

/** Faces added to a chance: the next faces up from the highest (or from 1), or the highest taken away; within the die. */
export function addFaces(chance: Chance, add: number): Chance {
  const sides = sidesOf(chance.die);
  let on = [...chance.on].sort((a, b) => a - b);
  if (add > 0) {
    let next = (on[on.length - 1] ?? 0) + 1;
    for (let i = 0; i < add; i++, next++) if (sides === null || next <= sides) on.push(next);
  } else if (add < 0) on = on.slice(0, Math.max(0, on.length + add));
  return { die: chance.die, on };
}

/** "1–2 on d6", "1, 3 on d8", "1" (faces only, no die). Runs of faces are joined with an en dash. */
export function chanceText(chance: Chance): string {
  const faces = facesWords(chance.on);
  return chance.die ? `${faces} on ${chance.die}` : faces;
}

/**
 * Which terrain chance a byTerrain check uses (engine ruling 1): its `terrainChance`, else a guess from the symbol of
 * the step that runs it ("lost" means lostChance, anything else wanderChance), marked as guessed. Null when the
 * check isn't byTerrain.
 */
export function terrainChanceOf(check: Check, icon: Icon): { field: TerrainChance; guessed: boolean } | null {
  if (!check.byTerrain) return null;
  if (check.terrainChance) return { field: check.terrainChance, guessed: false };
  return { field: icon === 'lost' ? 'lostChance' : 'wanderChance', guessed: true };
}

/** A lost check (it uses the terrain's lostChance, or runs from a "lost" step): never an encounter check. */
export function isLostCheck(check: Check, icon: Icon): boolean {
  const terrain = terrainChanceOf(check, icon);
  return terrain ? terrain.field === 'lostChance' : icon === 'lost';
}

/** A check counts as an encounter check when its symbol says so or a hit rolls a table (05: the wandering check). */
export function isEncounterCheck(check: Check, icon: Icon): boolean {
  if (isLostCheck(check, icon)) return false;
  if (icon === 'encounter' || icon === 'monster') return true;
  const hit = check.onHit;
  return hit.tableId !== null || hit.tableChoices.length > 0 || hit.columns.length > 0 || hit.regionTables;
}

/**
 * The table a hit rolls (engine ruling 3): the GM's pick, then the place's default, then the terrain's
 * encounterTableId (only for a check that uses wanderChance), then the check's own onHit (tableChoices for the GM
 * to pick from, or tableId). A lost check always rolls its own onHit; so does any check that isn't an encounter check.
 */
function tablesFor(check: Check, icon: Icon, encounter: boolean, ctx: CheckContext): { tables: string[]; from: HitPlan['tableFrom'] } {
  const hit = check.onHit;
  const own = hit.tableChoices.length ? hit.tableChoices : hit.tableId ? [hit.tableId] : [];
  if (encounter) {
    if (ctx.pickedTableId) return { tables: [ctx.pickedTableId], from: 'gm' };
    if (ctx.placeTableId) return { tables: [ctx.placeTableId], from: 'place' };
    const terrainTable = terrainChanceOf(check, icon)?.field === 'wanderChance' ? (ctx.terrain?.encounterTableId ?? null) : null;
    if (terrainTable) return { tables: [terrainTable], from: 'terrain' };
  }
  return { tables: own, from: own.length ? 'check' : null };
}

function hitPlan(check: Check, icon: Icon, encounter: boolean, rules: ExplorationRules | null, ctx: CheckContext): HitPlan {
  const hit = check.onHit;
  const terrain = ctx.terrain ?? null;
  const { tables, from } = tablesFor(check, icon, encounter, ctx);
  const column = encounter ? (terrain?.encounterColumn ?? null) : null;
  const regionTable = hit.regionTables && ctx.region ? (rules?.wildEncounters?.regionalTables[ctx.region] ?? null) : null;
  const swapSeason = encounter ? (ctx.specialSeasons ?? []).find((s) => s.encounterSwap) : undefined;
  const candidates: TableCandidate[] = [];
  const offer = (tableId: string | null | undefined, why: TableCandidate['why'], season: string | null = null) => {
    if (tableId && !candidates.some((c) => c.tableId === tableId)) candidates.push({ tableId, why, season });
  };
  if (encounter) {
    offer(ctx.placeTableId, 'place');
    if (terrainChanceOf(check, icon)?.field === 'wanderChance') offer(terrain?.encounterTableId, 'terrain');
    offer(regionTable, 'region');
    offer(swapSeason?.encounterSwap?.tableId, 'season', swapSeason?.id ?? null);
  }
  for (const id of hit.tableChoices.length ? hit.tableChoices : hit.tableId ? [hit.tableId] : []) offer(id, 'check');
  return {
    tables,
    tableFrom: from,
    pick: tables.length > 1,
    column,
    columns: column ? [] : hit.columns,
    regionTable,
    regionTables: hit.regionTables,
    swap: swapSeason?.encounterSwap ? { season: swapSeason.id, chance: swapSeason.encounterSwap.chance, tableId: swapSeason.encounterSwap.tableId } : null,
    noteOnly: tables.length === 0 && !hit.regionTables,
    note: hit.note,
    candidates,
  };
}

/**
 * A check's prompt in this context. The chance starts from the check (or, with byTerrain, the terrain's chance its
 * `terrainChance` names, with the check's die, else the mode's chanceDie, else d6); a route or track may replace it
 * or rule it out; then weather tags, tracks, the party and the GM add faces.
 */
export function checkPrompt(check: Check, icon: Icon, rules: ExplorationRules | null, ctx: CheckContext = {}): CheckPrompt {
  const encounter = isEncounterCheck(check, icon);
  const lines: ModifierLine[] = [];
  const warnings: string[] = [];
  let chance = check.chance;
  const terrain = ctx.terrain ?? null;
  const which = terrainChanceOf(check, icon);
  if (which?.guessed) warnings.push(`Check "${check.id}" doesn't name its terrainChance; ${which.field} was guessed from the step's symbol.`);
  if (which && terrain) {
    const faces = terrain[which.field];
    if (faces) {
      chance = { die: check.chance?.die ?? ctx.chanceDie ?? 'd6', on: faces };
      lines.push({ source: 'rules', kind: 'terrain', label: terrain.id, add: null, replaces: chance, never: false, public: true, note: terrain.note });
    }
  }
  let ruledOut = false;
  // of-4 (G-100): a modifier behind an option applies only while that option is on (the shared reader).
  const modifiers = check.modifiers.filter((m) => !m.onlyWithOption || optionSpecOn(m.onlyWithOption, ctx.choices ?? {}));
  for (const m of modifiers) {
    if (m.kind === 'routeType' && ctx.routeType === m.route) {
      if (m.never) ruledOut = true;
      else if (m.chance) chance = m.chance;
      lines.push({ source: 'rules', kind: 'routeType', label: m.route, add: null, replaces: m.never ? null : m.chance, never: m.never, public: true, note: m.note });
    }
    if (m.kind === 'track') {
      const value = ctx.tracks?.[m.trackId];
      const inRange = value !== undefined && (m.min === null || value >= m.min) && (m.max === null || value <= m.max);
      if (!inRange) continue;
      if (m.chance) chance = m.chance;
      // Countdown-linked chances are GM-only (05, What players see).
      lines.push({ source: 'rules', kind: 'track', label: m.trackId, add: m.chance ? null : m.add, replaces: m.chance, never: false, public: false, note: m.note });
    }
  }
  // Modifiers keyed to the party (ex-2, ga-3): one that sets the faces replaces the chance (the best for the party,
  // the fewest faces, wins of several); one that adds joins the adds below; a self modifier is its character's only.
  const adds: { line: ModifierLine; add: number }[] = [];
  const sets: { chance: Chance; line: ModifierLine }[] = [];
  const own = new Map<string, { chance: Chance; line: ModifierLine }[]>();
  const ownAdds: ModifierLine[] = [];
  for (const m of modifiers) {
    if (m.kind !== 'party') continue;
    const reach = partyReach(m.when, ctx.party ?? [], terrain);
    if (!reach) continue;
    const set = m.chance ? { die: m.chance.die ?? chance?.die ?? check.chance?.die ?? ctx.chanceDie ?? 'd6', on: m.chance.on } : null;
    const lineFor = (label: string, actor: ModifierLine['actor']): ModifierLine => ({ source: 'party', kind: 'trait', label, add: set ? null : m.add, replaces: set, never: false, public: true, note: m.note, actor });
    if (reach.scope === 'party') {
      if (set) sets.push({ chance: set, line: lineFor(reach.label, null) });
      else adds.push({ add: m.add, line: lineFor(reach.label, null) });
      continue;
    }
    for (const { member, label } of reach.members) {
      const line = lineFor(label, { id: member.id, name: member.name });
      if (set) own.set(member.id, [...(own.get(member.id) ?? []), { chance: set, line }]);
      else ownAdds.push(line);
    }
  }
  const bestSet = bestChance(sets, 'fewer');
  if (bestSet) {
    chance = bestSet.chance;
    lines.push(bestSet.line);
  }
  for (const m of modifiers) {
    if (m.kind === 'weatherTag' && ctx.weatherTags?.includes(m.tag)) {
      adds.push({ add: m.add, line: { source: 'rules', kind: 'weatherTag', label: m.tag, add: m.add, replaces: null, never: false, public: true, note: m.note } });
    }
    if (m.kind === 'track' && !m.chance && m.add) {
      const value = ctx.tracks?.[m.trackId];
      if (value !== undefined && (m.min === null || value >= m.min) && (m.max === null || value <= m.max)) adds.push({ add: m.add, line: lines.find((l) => l.kind === 'track' && l.label === m.trackId)! });
    }
  }
  for (const e of ctx.extra ?? []) {
    if (e.checkId !== check.id || !e.add) continue;
    adds.push({ add: e.add, line: { source: e.source, kind: e.source, label: e.label, add: e.add, replaces: null, never: false, public: e.public, note: null } });
  }
  for (const { add, line } of adds) {
    if (chance) chance = addFaces(chance, add);
    if (!lines.includes(line)) lines.push(line);
  }
  for (const list of own.values()) lines.push(bestChance(list, 'fewer')!.line);
  lines.push(...ownAdds);
  return {
    checkId: check.id,
    name: check.name,
    icon,
    chance,
    chanceText: chance ? chanceText(chance) : null,
    terrainChance: which?.field ?? null,
    warnings,
    always: check.chance === null && !check.byTerrain,
    ruledOut,
    modifiers: lines,
    hit: hitPlan(check, icon, encounter, rules, ctx),
    when: check.when,
    secret: check.secret !== false,
    note: check.note,
  };
}

// Modifiers keyed to the party (ruled 2026-11-03: ex-2, `design/rulings/m5b-pack-review-area-2-2026-11-03.md`; ga-3,
// `…-area-2-gaps-2026-11-03.md`; 07 Exploration, "Party modifiers…" and "…set chances…"). A check's or an activity's
// modifier may carry:
//   ifPartyHas { class } | { skill }   it applies while someone in the group has that class or skill;
//   who: "self" (with ifClass)          it applies to that character only (a class surprised less often);
//   onlyOnTerrain [terrain or class]    only on those terrains;
//   chance { on: [faces] }              it sets the chance's faces instead of adding (`add`); when several set it, the
//                                       best for the party wins (fewer faces on a check, more on an activity).
// The roll line names each source ("a Reed Witch in the party"). Pure.
import type { Chance, Terrain } from './modes.ts';

/** What the app knows of one character in the group: their class (pack id and name) and their skills (code → name). */
export interface PartyMember {
  id: string;
  name: string;
  classId: string | null;
  className: string | null;
  skills: ReadonlyMap<string, string>;
}

export type PartyHas = { class: string } | { skill: string };

/** The conditions a modifier keyed to the party carries. */
export interface PartyCondition {
  ifPartyHas: PartyHas | null;
  /** "self": that character only (the members who have `ifClass`, else what `ifPartyHas` names). */
  who: 'self' | null;
  ifClass: string | null;
  /** Terrain ids or terrain class ids; empty: any terrain. */
  onlyOnTerrain: string[];
}

/** A modifier keyed to the party, as read from the pack: it adds faces, or sets them (`chance`). */
export interface PartyModifier {
  when: PartyCondition;
  add: number;
  chance: Chance | null;
  note: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** `chance: { on: [faces], die? }` (modes.ts reads this module, so it isn't imported from there). */
function chanceOf(value: unknown): Chance | null {
  if (!isRecord(value) || !Array.isArray(value.on) || !value.on.every((f) => Number.isInteger(f))) return null;
  return { die: typeof value.die === 'string' && value.die.trim() ? value.die.trim() : null, on: value.on as number[] };
}
const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/**
 * The party condition on a modifier, or null when it carries none of `ifPartyHas`, `who: "self"` or `ifClass` (then
 * it isn't a party modifier; `onlyOnTerrain` alone doesn't make one).
 */
export function readPartyCondition(data: Record<string, unknown>): PartyCondition | null {
  const has = isRecord(data.ifPartyHas) ? data.ifPartyHas : null;
  const ifPartyHas: PartyHas | null = has && text(has.class) ? { class: text(has.class)! } : has && text(has.skill) ? { skill: text(has.skill)! } : null;
  const who = data.who === 'self' ? 'self' : null;
  const ifClass = text(data.ifClass);
  if (!ifPartyHas && !who && !ifClass) return null;
  const terrain = Array.isArray(data.onlyOnTerrain) ? data.onlyOnTerrain.flatMap((t) => text(t) ?? []) : text(data.onlyOnTerrain) ? [text(data.onlyOnTerrain)!] : [];
  return { ifPartyHas, who, ifClass, onlyOnTerrain: terrain };
}

/** A party modifier from the pack's data: its condition, with `add` or `chance`; null when it has neither. */
export function readPartyModifier(data: Record<string, unknown>, note: string | null): PartyModifier | null {
  const when = readPartyCondition(data);
  if (!when) return null;
  const add = typeof data.add === 'number' && Number.isInteger(data.add) ? data.add : 0;
  const chance = chanceOf(data.chance);
  return add !== 0 || chance ? { when, add, chance, note } : null;
}

/** Whether the terrain is one `onlyOnTerrain` lists (its own id or its class's); an empty list is every terrain. */
export function onTerrain(only: readonly string[], terrain: Pick<Terrain, 'id' | 'classId'> | null | undefined): boolean {
  if (only.length === 0) return true;
  if (!terrain) return false;
  return only.includes(terrain.id) || (terrain.classId !== null && only.includes(terrain.classId));
}

const hasIt = (member: PartyMember, has: PartyHas) => ('class' in has ? member.classId === has.class : member.skills.has(has.skill));

/** "a Reed Witch", "Wade" (a skill's name): what a member has that the modifier names. */
function whatWords(has: PartyHas, member: PartyMember | undefined): string {
  if ('class' in has) return `a ${member?.className ?? has.class}`;
  return member?.skills.get(has.skill) ?? has.skill;
}

/** What a self modifier asks the character to have: its `ifClass`, else what `ifPartyHas` names. */
const selfHas = (when: PartyCondition): PartyHas | null => (when.ifClass ? { class: when.ifClass } : when.ifPartyHas);

/** Where a modifier applies: to the whole group (with the words naming why), or to some of its members only. */
export type PartyReach = { scope: 'party'; label: string } | { scope: 'self'; members: { member: PartyMember; label: string }[] } | null;

/**
 * Whether a party modifier applies here, and to whom. A self modifier (`who: "self"`, or `ifClass` alone) reaches the
 * members who have it ("a Mire Stalker"); `ifPartyHas` the whole group while someone has it ("a Reed Witch in the
 * party"). Null when it doesn't apply (not on this terrain, or nobody has it).
 */
export function partyReach(when: PartyCondition, party: readonly PartyMember[], terrain: Pick<Terrain, 'id' | 'classId'> | null | undefined): PartyReach {
  if (!onTerrain(when.onlyOnTerrain, terrain)) return null;
  if (when.who === 'self' || (when.ifClass && !when.ifPartyHas)) {
    const has = selfHas(when);
    if (!has) return null;
    const members = party.filter((m) => hasIt(m, has) && (!when.ifPartyHas || party.some((o) => hasIt(o, when.ifPartyHas!))));
    return members.length ? { scope: 'self', members: members.map((member) => ({ member, label: whatWords(has, member) })) } : null;
  }
  const has = when.ifPartyHas!;
  const holder = party.find((m) => hasIt(m, has));
  if (!holder) return null;
  if (when.ifClass && !party.some((m) => m.classId === when.ifClass)) return null;
  return { scope: 'party', label: `${whatWords(has, holder)} in the party` };
}

/** Of several chances that set the faces, the best for the party: fewest faces on a check (a hit is bad), most on an activity. */
export function bestChance<T extends { chance: Chance }>(sets: readonly T[], better: 'fewer' | 'more'): T | null {
  let best: T | null = null;
  for (const s of sets) {
    if (!best) best = s;
    else if (better === 'fewer' ? s.chance.on.length < best.chance.on.length : s.chance.on.length > best.chance.on.length) best = s;
  }
  return best;
}

/** The faces in words without the die ("1", "1–2"), for the roll line ("Only on 1 · a Reed Witch in the party"). */
export function facesWords(on: readonly number[]): string {
  const faces = [...new Set(on)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < faces.length; ) {
    let j = i;
    while (j + 1 < faces.length && faces[j + 1] === faces[j]! + 1) j++;
    runs.push(j > i ? `${faces[i]}–${faces[j]}` : String(faces[i]));
    i = j + 1;
  }
  return runs.length ? runs.join(', ') : 'none';
}

// The full sheet's Advancement section (sr-5, ruled 2026-11-04): the XP with a bar to the next level and the words
// beside it, the prime-requisite XP bonus with its reason (rc-1), and the level title. Replaces the lone "XP
// modifier". Pure: from the XP, the class's XP table, the class and the scores.
import { primeXpBonus } from './creationSteps.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const count = (n: number) => n.toLocaleString('en');

/** The fills the Advancement section shows: a layout field filled with one of these moves here, not into its group. */
export const ADVANCEMENT_FILLS = ['primeXp', 'title'] as const;

export interface Advancement {
  level: number;
  /** "Level 1 · 0 XP". */
  line: string;
  /** The experience over the next level's figure, 0 to 1 (the bar); null at the table's top or without a table. */
  fraction: number | null;
  /** "2,000 to level 2", "Enough for level 2"; empty at the table's top or without a table. */
  next: string;
  /** The prime-requisite bonus ("+5%") and its reason ("prime MUS 13"); null when the class has none to say. */
  bonus: { value: string; reason: string } | null;
  /** The level title from the class ("Lamplighter"); empty without one. */
  title: string;
}

export function advancementOf(input: {
  xp: number | null;
  level: number;
  xpTable: Record<string, unknown> | null;
  klass: Record<string, unknown> | null;
  rulesSets: readonly Record<string, unknown>[];
  scores: Record<string, number>;
  /** The setting's short name for an ability ("MUS"). */
  shortName: (ability: string) => string;
  /** The filled title (the `title` fill). */
  title: unknown;
}): Advancement {
  const xp = input.xp ?? 0;
  const rows = (Array.isArray(input.xpTable?.levels) ? input.xpTable.levels : []).filter(isRecord);
  const at = (level: number) => num(rows.find((r) => r.level === level)?.xp);
  const nextXp = at(input.level + 1);
  let fraction: number | null = null;
  let next = '';
  if (nextXp !== null) {
    // The bar is the experience over the next level's figure, as the line beside it reads ("2,400 of 4,000" is 60 %;
    // tf-A5, frames P1 and P2 of ps-9): never progress within the level, which left a character at a level's start
    // with an empty bar.
    fraction = nextXp > 0 ? Math.min(1, Math.max(0, xp / nextXp)) : 1;
    next = xp >= nextXp ? `Enough for level ${input.level + 1}` : `${count(nextXp - xp)} to level ${input.level + 1}`;
  }
  let bonus: Advancement['bonus'] = null;
  const klass = input.klass;
  const raw = klass?.primeRequisites;
  // A list of abilities, or an object keyed by them (as primeXpBonus reads it).
  const primes = Array.isArray(raw) ? raw.map(String) : isRecord(raw) ? Object.keys(raw) : [];
  if (klass && primes.length > 0) {
    const value = primeXpBonus({ packEntryId: '', name: '', data: klass }, input.rulesSets, input.scores);
    if (value !== null) bonus = { value: `${signed(value)}%`, reason: `prime ${primes.map((p) => `${input.shortName(p)} ${input.scores[p] ?? '?'}`).join(', ')}` };
  }
  return {
    level: input.level,
    line: `Level ${input.level}, ${count(xp)} XP`,
    fraction,
    next,
    bonus,
    title: typeof input.title === 'string' ? input.title.trim() : '',
  };
}

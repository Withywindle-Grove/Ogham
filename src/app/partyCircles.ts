// The marching order's circles, worked out (S12 of the whole-Scene plan; mc-5, mo-1; pictures R1 and page 16 T10).
// Pure: no database and no drawing. PartyCircle.tsx draws one circle; MarchingOrder.tsx sets them in ranks.
import { namesWords } from '../core/marchingRows.ts';
import { possessive } from '../core/nameWords.ts';

const firstLetter = (word: string) => word.charAt(0).toUpperCase();

/** With no portrait, each circle's letters: one initial, or two letters each where initials clash (mc-5). */
export function circleInitials(people: readonly { id: string; name: string }[]): Map<string, string> {
  const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);
  const one = (name: string) => firstLetter(words(name)[0] ?? '') || '?';
  const two = (name: string) => {
    const [a = '', b] = words(name);
    if (!a) return '?';
    return b ? firstLetter(a) + firstLetter(b) : firstLetter(a) + a.charAt(1).toLowerCase();
  };
  const count = new Map<string, number>();
  for (const p of people) count.set(one(p.name), (count.get(one(p.name)) ?? 0) + 1);
  return new Map(people.map((p) => [p.id, (count.get(one(p.name)) ?? 0) > 1 && one(p.name) !== '?' ? two(p.name) : one(p.name)]));
}

/** A lit light under its circle: its name and what is left, without "left" ("Torch, 4 turns"). */
export function lightLine(light: string, words: string): string {
  return `${light}, ${words.replace(/ left$/, '')}`;
}

/** The caller (mc-76), kept in the campaign's settings as a character's id (the lead, 2026-11-14): null for none, or
 * when it names someone no longer in the party. */
export function callerOf(settings: unknown, party: readonly string[]): string | null {
  const value = settings && typeof settings === 'object' ? (settings as { caller?: unknown }).caller : undefined;
  return typeof value === 'string' && party.includes(value) ? value : null;
}

/**
 * A split party, as a player in one group sees their order (page 18, PL6; ap-10): "Your group. Ash and Tam are
 * elsewhere." Who, never where: the others' names only. Null when nobody is elsewhere.
 */
export function elsewhereLine(others: readonly string[]): string | null {
  if (others.length === 0) return null;
  return `Your group. ${namesWords(others)} ${others.length === 1 ? 'is' : 'are'} elsewhere.`;
}

const COUNT_WORDS =['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** The line over the ranks: the lights lit ("One light lit: Ash’s torch, 4 turns."); null when none is. */
export function litSummary(lit: readonly { who: string; light: string; words: string }[]): string | null {
  if (lit.length === 0) return null;
  const count = COUNT_WORDS[lit.length] ?? String(lit.length);
  const each = lit.map((l) => `${possessive(l.who)} ${l.light.charAt(0).toLowerCase()}${l.light.slice(1)}, ${l.words.replace(/ left$/, '')}`);
  return `${count} light${lit.length === 1 ? '' : 's'} lit: ${each.join('; ')}.`;
}

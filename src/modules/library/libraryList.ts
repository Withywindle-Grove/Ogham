// The Rules library's list (docs/05 "Rules library", 06 Components: Rules library list, Pack row; ruling lr-1, lr-2,
// 2026-11-02). Pure: the groups by the pack's `meta.kind`, the chips' counts, the sort, the find field, and the
// pack row's lines (its own description and what it needs, what it holds in the pack's own words, who uses it).
// No new pack fields: the description is `meta.description`, the needs are `meta.requires`, the words come from the
// pack's `creationGuide.<step>.title` (ruled 2026-11-02, "Kindred") where the pack names a kind.
import { KIND_WORDS } from './kindWords.ts';
import type { EntryKind, PackKind } from './packFile.ts';

/** The three groups, in the library's order, with their headings (lr-1). */
export const KIND_GROUPS: readonly { kind: PackKind; title: string }[] = [
  { kind: 'setting', title: 'Setting rules' },
  { kind: 'adventure', title: 'Adventures' },
  { kind: 'homebrew', title: 'Homebrew' },
];

/** The find field shows from this many packs (lr-1). */
export const FIND_FROM = 8;

export type PackSort = 'name' | 'updated';

/** The packs of each kind present, in the library's order; kinds with none are left out. */
export function groupByKind<T extends { kind: PackKind }>(items: readonly T[]): { kind: PackKind; title: string; items: T[] }[] {
  return KIND_GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.kind === group.kind) })).filter((group) => group.items.length > 0);
}

/** By name (the default; case and accents aside), or the last updated first. */
export function sortPacks<T extends { name: string; importedAt: string }>(items: readonly T[], by: PackSort): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return [...items].sort(by === 'name' ? byName : (a, b) => b.importedAt.localeCompare(a.importedAt) || byName(a, b));
}

/** The packs whose name or description has the words typed, case aside; everything when nothing is typed. */
export function findPacks<T extends { name: string; description: string }>(items: readonly T[], typed: string): T[] {
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const text = `${item.name} ${item.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** One and many of a word the pack gives in the singular ("Kindred" → kindred, kindreds). */
export function wordPair(word: string): [string, string] {
  const trimmed = word.trim();
  // "Kindred" → "kindred", but an all-capitals word ("XP") stays as it is.
  const one = trimmed === trimmed.toUpperCase() ? trimmed : trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  if (/(s|x|z|ch|sh)$/i.test(one)) return [one, `${one}es`];
  if (/[^aeiou]y$/i.test(one)) return [one, `${one.slice(0, -1)}ies`];
  return [one, `${one}s`];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The creation steps whose title is the word for a kind of entry ("Kindred" for races). */
const STEP_KINDS: Partial<Record<string, EntryKind>> = { race: 'race', class: 'class' };

/** The pack's own words for its kinds, from its rules set's `creationGuide.<step>.title`; empty when it names none. */
export function packWords(creationGuide: unknown): Partial<Record<EntryKind, [string, string]>> {
  if (!isRecord(creationGuide)) return {};
  const words: Partial<Record<EntryKind, [string, string]>> = {};
  for (const [step, kind] of Object.entries(STEP_KINDS)) {
    const entry = creationGuide[step];
    const title = isRecord(entry) ? text(entry.title) : '';
    if (kind && title) words[kind] = wordPair(title);
  }
  return words;
}

/**
 * "20 classes, 8 kindreds, 62 spells, 1 rules set" in the app's fixed order, the pack's words where it has them
 * (lr-2), and the rules sets last, after the other counts (lr-2a, 2026-11-13): every kind the pack holds is counted,
 * so '' (the row's "Nothing in it yet") only when it holds nothing.
 */
export function holdsLine(counts: Partial<Record<EntryKind, number>>, words: Partial<Record<EntryKind, [string, string]>> = {}): string {
  const kinds = (Object.keys(KIND_WORDS) as EntryKind[]).filter((kind) => kind !== 'rulesSet');
  return [...kinds, 'rulesSet' as const]
    .filter((kind) => counts[kind])
    .map((kind) => {
      const [one, many] = words[kind] ?? KIND_WORDS[kind];
      return `${counts[kind]} ${counts[kind] === 1 ? one : many}`;
    })
    .join(', ');
}

/** The ids a pack's `meta.requires` names: `[{ packId }]` as 07 says, or plain ids. */
export function requiredIds(requires: unknown): string[] {
  const list = Array.isArray(requires) ? requires : requires === undefined || requires === null ? [] : [requires];
  return list.map((need) => (isRecord(need) ? text(need.packId) : text(need))).filter(Boolean);
}

/** "Needs: Fen Rules, Advanced." from the ids, by the library's names (an id not in the library stays as it is). */
export function needsLine(ids: readonly string[], names: ReadonlyMap<string, string>): string {
  if (ids.length === 0) return '';
  return `Needs: ${ids.map((id) => names.get(id) ?? id).join(', ')}.`;
}

/** Who uses it (lr-2): the first campaign by name and how many more; null when none does. */
export function usedBy(campaigns: readonly string[]): { first: string; more: number } | null {
  if (campaigns.length === 0) return null;
  return { first: campaigns[0]!, more: campaigns.length - 1 };
}

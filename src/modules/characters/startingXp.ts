// Experience at a higher starting level (cs-13, plan dec-10 X1): a character made above level 1 starts with the
// minimum experience its class needs for that level. Pure: from the class, the campaign's XP tables and the level.
//
// A class reads its own XP table, by its own table id: from its own pack, else from the nearest pack below its own in
// the campaign's stack (a homebrew copy of a class may lean on the rules pack under it), never from a pack above it,
// and never through the stacked setting (one entry per kind and id, the winner), which would hand two same-named
// classes in two packs the winner's table (ruled by the lead on #691).
import { stackOrder } from '../library/stack.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** An XP table's copy in one pack, as the campaign plays it (`CampaignSetting.xpTables`). */
export interface PackedTable {
  kind: string;
  packEntryId: string;
  packId: string;
  data: Record<string, unknown>;
  /** Set when an option or a patch switches this copy off: then the pack doesn't carry it. */
  optionOff?: string;
}

/**
 * The class's XP table: the copy with the class's `xpTableId` in the class's own pack, else in the nearest pack below
 * it in the stack (`packs`, in any order: stackOrder sorts them). A copy switched off is not carried. Null without a
 * table id, or when neither its pack nor any below carries the table: no table, so no experience.
 */
export function classXpTable(
  klass: { packId: string; data: Record<string, unknown> } | null,
  tables: readonly PackedTable[],
  packs: readonly { packId: string; priority: number; kind?: string }[],
): Record<string, unknown> | null {
  const id = klass?.data.xpTableId;
  if (!klass || typeof id !== 'string' || !id) return null;
  const order = stackOrder([...packs]).map((p) => p.packId);
  const at = order.indexOf(klass.packId);
  // Its own pack, then those below it, nearest first; a class from a pack not in the stack reads only its own.
  const searched = at < 0 ? [klass.packId] : order.slice(at);
  for (const packId of searched) {
    const found = tables.find((e) => e.kind === 'xpTable' && e.packEntryId === id && e.packId === packId && !e.optionOff);
    if (found) return isRecord(found.data) ? found.data : null;
  }
  return null;
}

/**
 * The experience a character starts with at a level: at level 1 (or below: 0 or a negative level reads as 1), 0, as
 * before cs-13; above it, the
 * table's figure for that level. Without a table, or without a whole figure for that level in it, 0: nothing is
 * invented.
 */
export function startingXp(level: number, xpTable: Record<string, unknown> | null): number {
  if (!Number.isInteger(level) || level <= 1 || !xpTable) return 0;
  const rows = (Array.isArray(xpTable.levels) ? xpTable.levels : []).filter(isRecord);
  const xp = rows.find((r) => r.level === level)?.xp;
  return typeof xp === 'number' && Number.isInteger(xp) && xp >= 0 ? xp : 0;
}

/**
 * A class's level table for its entry (dec-10 C, cs-16; picture creation/final 16-A2b): a row a level, the columns the
 * class has, nothing invented. Title from `levelTitles` (strings in level order, or `{ level, title }`), a gap carrying
 * the title before it as the sheet does, empty past the last; Experience from the class's own table (`classXpTable`),
 * level 1 being 0; Hit dice from `progression`. A level one source lacks has an empty cell there. Null when the class
 * has none of the three.
 */
export function classLevelTable(klass: Record<string, unknown>, xpTable: Record<string, unknown> | null): { head: string[]; rows: string[][] } | null {
  const titleList = Array.isArray(klass.levelTitles) ? klass.levelTitles : [];
  const titles = new Map<number, string>();
  titleList.forEach((t, i) => {
    if (typeof t === 'string' && t.trim()) titles.set(i + 1, t.trim());
    else if (isRecord(t) && Number.isInteger(t.level) && typeof t.title === 'string' && t.title.trim()) titles.set(t.level as number, t.title.trim());
  });
  const xpRows = (isRecord(xpTable) && Array.isArray(xpTable.levels) ? xpTable.levels : []).filter(isRecord);
  const xp = new Map<number, number>();
  for (const r of xpRows) if (Number.isInteger(r.level) && typeof r.xp === 'number' && Number.isInteger(r.xp) && r.xp >= 0) xp.set(r.level as number, r.xp);
  if (xp.size > 0 && !xp.has(1)) xp.set(1, 0);
  const dice = new Map<number, string>();
  for (const r of (Array.isArray(klass.progression) ? klass.progression : []).filter(isRecord))
    if (Number.isInteger(r.level) && typeof r.hitDice === 'string' && r.hitDice.trim()) dice.set(r.level as number, r.hitDice.trim());
  if (titles.size + xp.size + dice.size === 0) return null;
  const levels = [...new Set([...titles.keys(), ...xp.keys(), ...dice.keys()])].filter((l) => l >= 1).sort((a, b) => a - b);
  // A level between two titled ones carries the earlier title, as the sheet does (fills.ts); past the last, empty.
  const lastTitled = Math.max(0, ...titles.keys());
  const titleAt = (l: number) => (l > lastTitled ? '' : (titles.get(Math.max(...[...titles.keys()].filter((t) => t <= l))) ?? ''));
  const columns: [string, (level: number) => string][] = [
    ...(titles.size > 0 ? [['Title', titleAt] as [string, (level: number) => string]] : []),
    ...(xp.size > 0 ? [['Experience', (l: number) => (xp.has(l) ? xp.get(l)!.toLocaleString('en-GB') : '')] as [string, (level: number) => string]] : []),
    ...(dice.size > 0 ? [['Hit dice', (l: number) => dice.get(l) ?? ''] as [string, (level: number) => string]] : []),
  ];
  return { head: ['Level', ...columns.map(([h]) => h)], rows: levels.map((l) => [String(l), ...columns.map(([, cell]) => cell(l))]) };
}

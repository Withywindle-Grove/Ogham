// Setting rules stack in one order (docs/07-content-packs.md, Homebrew): when two packs in a campaign have the
// same entry (same kind and id), the higher one wins, unless the GM made an exception for that entry, which
// picks a pack for it whatever the order. Two layers (ruled 2026-10-24): every homebrew pack sits above every
// setting and adventure pack, and the order inside each layer is the GM's. Optional rules are each pack's own and
// never compete. Pure functions: the browser, and later character creation and items, all use these.
import type { CampaignEntry } from './campaignPacks.ts';
import type { PackKind } from './packFile.ts';
import type { PatchLine } from './patches.ts';

export interface StackPack {
  /** The campaign's link to the pack. */
  id: string;
  packId: string;
  name: string;
  priority: number;
  kind: PackKind;
  /** The GM's exceptions: entries ("kind:id" → the entry's name) this pack wins whatever the order. */
  overrides: Record<string, string>;
}

export type ResolvedEntry = CampaignEntry & {
  /** The other packs (ids) that have this entry too, top first. */
  alsoIn: string[];
  /** Won by the GM's exception rather than the order. */
  preferred: boolean;
  /**
   * Set when the campaign's options switch it off (its `option` spec, of-3; optionGate.ts): kept in the setting so a
   * character who already has it still shows it, and left out of every list (`entriesInPlay`).
   */
  optionOff?: string;
  /** The words for `optionOff` on a row ("Off · Bronze": the choice that switches it off; bq3-17 (6)). */
  offLabel?: string;
  /** Every figure an attached pack's patch changed, for the breakdown ("AC −1 · Bronze, Mire zine"; of-13). */
  patched?: PatchLine[];
};

export const entryKey = (entry: { kind: string; packEntryId: string }) => `${entry.kind}:${entry.packEntryId}`;

const layer = (pack: { kind?: string }) => (pack.kind === 'homebrew' ? 0 : 1);

/** Top of the stack first: the homebrew layer, then the rest; equal priorities (possible after an undo) fall back to a fixed order. */
export const stackOrder = <T extends { priority: number; packId: string; kind?: string }>(packs: T[]): T[] =>
  [...packs].sort((a, b) => layer(a) - layer(b) || b.priority - a.priority || a.packId.localeCompare(b.packId));

/** One entry per kind and id: the winner, with where else it appears. */
export function resolveStack(entries: CampaignEntry[], packs: StackPack[]): ResolvedEntry[] {
  const order = stackOrder(packs);
  const rank = new Map(order.map((pack, index) => [pack.packId, index]));
  const rankOf = (packId: string) => rank.get(packId) ?? order.length;
  const groups = new Map<string, CampaignEntry[]>();
  const resolved: ResolvedEntry[] = [];
  for (const entry of entries) {
    // Options are each pack's own and never compete; so are patches (of-13: every attached pack's apply).
    if (entry.kind === 'option' || entry.kind === 'patch') {
      resolved.push({ ...entry, alsoIn: [], preferred: false });
      continue;
    }
    const key = entryKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const [key, group] of groups) {
    const ranked = [...group].sort((a, b) => rankOf(a.packId) - rankOf(b.packId));
    const chosen = order.find((pack) => key in pack.overrides && group.some((e) => e.packId === pack.packId));
    const winner = (chosen && ranked.find((e) => e.packId === chosen.packId)) ?? ranked[0]!;
    resolved.push({ ...winner, alsoIn: ranked.filter((e) => e !== winner).map((e) => e.packId), preferred: Boolean(chosen) });
  }
  return resolved;
}

export type PriorityChange = { id: string; priority: number };

/** Priorities numbered from the top (n … 1), in stack order. */
const numbered = (packs: StackPack[]) => {
  const order = stackOrder(packs);
  return order.map((pack, index) => ({ pack, priority: order.length - index }));
};

/** Moving one pack up or down a place: the changed priorities, the moved pack first. Nothing at the ends. */
export function moveInStack(packs: StackPack[], linkId: string, direction: 'up' | 'down'): PriorityChange[] {
  const rows = numbered(packs);
  const at = rows.findIndex((row) => row.pack.id === linkId);
  const other = direction === 'up' ? at - 1 : at + 1;
  if (at === -1 || other < 0 || other >= rows.length) return [];
  const [moved, neighbour] = [rows[at]!, rows[other]!];
  // Each layer keeps to itself: homebrew never goes below a setting pack, nor a setting pack above homebrew.
  if (layer(moved.pack) !== layer(neighbour.pack)) return [];
  [moved.priority, neighbour.priority] = [neighbour.priority, moved.priority];
  const changed = rows.filter((row) => row.priority !== row.pack.priority);
  return [...changed.filter((row) => row === moved), ...changed.filter((row) => row !== moved)].map((row) => ({ id: row.pack.id, priority: row.priority }));
}

/** Where newly attached rules go: homebrew on top; anything else on top but under the homebrew at the top. */
export function placeNewPack(packs: StackPack[], kind: PackKind): { priority: number; shift: PriorityChange[] } {
  const top = Math.max(0, ...packs.map((pack) => pack.priority));
  const rows = numbered(packs);
  const leading = rows.findIndex((row) => row.pack.kind !== 'homebrew');
  const homebrewOnTop = leading === -1 ? rows.length : leading;
  if (kind === 'homebrew' || homebrewOnTop === 0) return { priority: top + 1, shift: [] };
  for (const row of rows.slice(0, homebrewOnTop)) row.priority += 1;
  const priority = rows[homebrewOnTop - 1]!.priority - 1;
  return { priority, shift: rows.filter((row) => row.priority !== row.pack.priority).map((row) => ({ id: row.pack.id, priority: row.priority })) };
}

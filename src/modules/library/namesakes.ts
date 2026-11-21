// Same-named entries from different packs (sn-1, ruled 2026-11-05, docs/design/rulings/packs-same-names-and-content-note-2026-11-05.md;
// plan dec-1-creation 1d). Two entries of one kind with the same name and different ids, from different packs, are
// different things: wherever both can appear (creation's race and class rows, the Rules browser, the sheet's class
// and race), each shows its pack's short name: in creation's list rows a quiet last line, "From Fen rules" (Francis,
// 2026-11-12; the Rules browser keeps it under the name); in a one-line place
// "Lantern Warden (from Fen rules)" (never a middle dot, words rule 11; the lead's correction of the plan). An entry with no
// namesake shows nothing extra, so a campaign with one setting looks as it always did. Entries with the same kind and
// id are one entry already (the stack keeps the winner, stack.ts), so they never count as namesakes here.
// `pack:check` lists the same pairs across the files it is given (`sameNamePairs`, scripts/pack-library.mjs).
//
// A pinned copy (sn-1b, docs/design/rulings/dec-pinned-source-2026-11-13.md): a class or race may carry `pinnedFrom`,
// the id (`meta.id`) of the pack it was copied from. For the source line it then counts as that pack's, when that pack
// is attached; else its own pack's, as before. So a pack holding its own class beside a pinned copy of another pack's
// class of the same name shows both: "From <the pack pinned from>" and "From <its own pack>". Other kinds keep their own pack.

/** The name two entries share when they differ only in capitals or spaces ("Lantern  warden" is "Lantern Warden"). */
export const sameNameKey = (name: unknown): string =>
  String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** The words a name's source adds in a one-line place (NameFrom's, src/ui/parts.tsx): " (from <pack>)", or nothing. */
export const nameFromWords = (from: string | null | undefined): string => (from ? ` (from ${from})` : '');

interface Named {
  kind: string;
  name: string;
  packId?: string;
  packEntryId: string;
  /** The entry's fields: read for `pinnedFrom` (sn-1b). */
  data?: Record<string, unknown>;
}

/** The kinds whose pinned copy names the pack it was pinned from (sn-1b); every other kind keeps its own pack. */
const PINNED_KINDS = new Set(['class', 'race']);

/** An entry's `pinnedFrom` (sn-1b): the id of the pack it was copied from, trimmed; '' without one or for another kind. */
export function pinnedFromOf(entry: { kind: string; data?: Record<string, unknown> }): string {
  const value = entry.data?.pinnedFrom;
  return PINNED_KINDS.has(entry.kind) && typeof value === 'string' ? value.trim() : '';
}

/** A campaign's pack as the source line finds it: its id in the campaign, and its own `meta.id` when known. */
export interface PinnablePack {
  packId: string;
  metaId?: string;
}

/**
 * From the entries in play (one per kind and id, as the stack resolves them), a reader that gives an entry's source
 * words (its pack's short name, from `packName`) when another entry of its kind, from another pack and with another
 * id, has the same name; else null. Options and patches are each pack's own and are never listed by name: left out.
 * With the campaign's packs (`packs`), a pinned class or race counts as the pack it names when that pack is attached
 * (sn-1b): its `pinnedFrom` matched against each pack's `meta.id`, or its id in the campaign.
 */
export function namesakeSource(pool: readonly Named[], packName: (packId: string) => string, packs: readonly PinnablePack[] = []): (entry: Named) => string | null {
  // The pack an entry counts as: the attached pack its pinnedFrom names (a class or race), else its own.
  const packOf = (entry: Named): string | undefined => {
    const pinned = pinnedFromOf(entry);
    const named = pinned ? packs.find((p) => p.metaId === pinned || p.packId === pinned) : undefined;
    return named?.packId ?? entry.packId;
  };
  const byName = new Map<string, { entry: Named; pack: string }[]>();
  for (const entry of pool) {
    if (entry.kind === 'option' || entry.kind === 'patch' || !entry.packId) continue;
    const key = `${entry.kind}:${sameNameKey(entry.name)}`;
    byName.set(key, [...(byName.get(key) ?? []), { entry, pack: packOf(entry)! }]);
  }
  return (entry) => {
    if (!entry.packId) return null;
    const others = byName.get(`${entry.kind}:${sameNameKey(entry.name)}`) ?? [];
    // The pool's copy carries the entry's fields (`pinnedFrom`) when the one asked about doesn't.
    const own = others.find((o) => o.entry.packEntryId === entry.packEntryId && o.entry.packId === entry.packId);
    const pack = own?.pack ?? packOf(entry)!;
    const namesake = others.some((other) => other.pack !== pack && other.entry.packEntryId !== entry.packEntryId);
    return namesake ? packName(pack) || null : null;
  };
}

export interface NamePairPack {
  name: string;
  /** The pack's `meta.id`, which another pack's pinned copy names (sn-1b); absent or null without one. */
  id?: string | null;
  entries: readonly { kind: string; packEntryId: string; name: string; data?: Record<string, unknown> }[];
}

export interface SameNamePair {
  kind: string;
  /** The name as the first pack writes it. */
  name: string;
  /**
   * Each pack and its entry's id, in the order the packs were given. A pinned copy (sn-1b) is listed under the pack it
   * was pinned from, when that pack is among those given, with the pack it sits in as `pinnedIn`.
   */
  found: { pack: string; id: string; pinnedIn?: string }[];
}

/**
 * Every name that two or more of the packs give an entry of the same kind, with different ids (sn-1 point 4): for
 * `pack:check`, as information, so the choice to keep both (each showing its source) or point one at the other is
 * made on purpose. A shared id is the stack's case (the pack on top wins), not this one. Options (their own note,
 * by ruleKey) and patches are left out.
 */
export function sameNamePairs(packs: readonly NamePairPack[]): SameNamePair[] {
  const found = new Map<string, SameNamePair>();
  for (const pack of packs) {
    for (const entry of pack.entries) {
      if (entry.kind === 'option' || entry.kind === 'patch') continue;
      const key = `${entry.kind}:${sameNameKey(entry.name)}`;
      if (sameNameKey(entry.name) === '') continue;
      const pair = found.get(key) ?? { kind: entry.kind, name: entry.name, found: [] };
      // A pinned class or race (sn-1b) counts as the pack it names, when that pack is among those given.
      const pinned = pinnedFromOf(entry);
      const from = pinned ? packs.find((p) => p !== pack && p.id === pinned) : undefined;
      const listed = from ? { pack: from.name, id: entry.packEntryId, pinnedIn: pack.name } : { pack: pack.name, id: entry.packEntryId };
      const same = pair.found.find((f) => f.pack === listed.pack && f.id === listed.id);
      // The named pack's own entry of that id and the copy are one line, which still says where the copy sits.
      if (!same) pair.found.push(listed);
      else if ('pinnedIn' in listed && !same.pinnedIn) same.pinnedIn = listed.pinnedIn;
      found.set(key, pair);
    }
  }
  // A pair needs two entries that differ in both pack and id (as namesakeSource asks): a shared id alone is the stack's
  // case, and two same-named ids inside one pack are that pack's own business, unless one is pinned from another (sn-1b).
  return [...found.values()].filter((pair) => pair.found.some((a) => pair.found.some((b) => a.pack !== b.pack && a.id !== b.id)));
}

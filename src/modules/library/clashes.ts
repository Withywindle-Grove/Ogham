// The same item id in two packs (pack review area 3, build order 12; ruled 2026-11-04, eq-4,
// docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md; 07 "Packs stack in one priority order"). In a campaign
// the pack on top wins and the entry says "also in <pack>" (stack.ts `resolveStack`, the Rules browser); here is the
// plain list of such clashes for the import preview and `npm run pack:check`, before anything is attached.

export interface ClashPack {
  name: string;
  entries: readonly { kind: string; packEntryId: string; name: string }[];
}

export interface ItemClash {
  id: string;
  /** The item's name in the first pack that has it. */
  name: string;
  /** The names of every pack that has the id, in the order given. */
  packs: string[];
}

/** Item ids that two or more of the packs share, with the packs' names (the first pack's item name for the line). */
export function itemClashes(packs: readonly ClashPack[]): ItemClash[] {
  const found = new Map<string, ItemClash>();
  for (const pack of packs) {
    const seen = new Set<string>();
    for (const entry of pack.entries) {
      if (entry.kind !== 'item' || seen.has(entry.packEntryId)) continue;
      seen.add(entry.packEntryId);
      const clash = found.get(entry.packEntryId);
      if (clash) clash.packs.push(pack.name);
      else found.set(entry.packEntryId, { id: entry.packEntryId, name: entry.name, packs: [pack.name] });
    }
  }
  return [...found.values()].filter((c) => c.packs.length > 1);
}

/** The clashes of one pack (first) against the packs it would sit with: "Marsh pearl (marsh-pearl) · also in Fen rules". */
export function clashLines(pack: ClashPack, others: readonly ClashPack[]): string[] {
  return itemClashes([pack, ...others])
    .filter((c) => c.packs[0] === pack.name)
    .map((c) => `${c.name} (${c.id}), also in ${c.packs.slice(1).join(', ')}`);
}

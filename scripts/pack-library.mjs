// Checks that need several packs at once (a library), for npm run pack:check with more than one file
// (M5b step 0d.5; ruling design/rulings/m5b-0d-library-and-campaign-rules-2026-11-02.md, "Pack checker").
// 07, ruleKey: options from different packs with the same ruleKey form one choice; options without one stand alone.
// So two packs that both carry an option of the same name, where one of them has no ruleKey, show the GM two
// separate rules for one topic in a campaign that uses both: the clash a missing key hides.

import { itemClashes } from "../src/modules/library/clashes.ts";
import { sameNamePairs } from "../src/modules/library/namesakes.ts";

const sameName = (name) =>
  String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * packs: [{ name, entries }] as the app's reader returns them (entries of kind 'option' carry data.ruleKey).
 * Returns one note per option name that two or more packs carry, when at least one of them has no ruleKey.
 */
export function sameNameOptionNotes(packs) {
  const byName = new Map();
  for (const pack of packs) {
    for (const entry of pack.entries ?? []) {
      if (entry.kind !== "option") continue;
      const key = sameName(entry.name ?? entry.data?.name);
      if (!key) continue;
      const ruleKey =
        typeof entry.data?.ruleKey === "string" &&
        entry.data.ruleKey.trim() !== ""
          ? entry.data.ruleKey.trim()
          : null;
      if (!byName.has(key)) byName.set(key, []);
      byName
        .get(key)
        .push({
          pack: pack.name,
          name: entry.name ?? entry.data?.name,
          ruleKey,
        });
    }
  }
  const notes = [];
  for (const found of byName.values()) {
    const packNames = [...new Set(found.map((f) => f.pack))];
    if (packNames.length < 2) continue;
    const unkeyed = [
      ...new Set(found.filter((f) => f.ruleKey === null).map((f) => f.pack)),
    ];
    if (unkeyed.length === 0) continue;
    notes.push(
      `option "${found[0].name}" is in ${packNames.map((p) => `"${p}"`).join(" and ")}, with no ruleKey in ${unkeyed.map((p) => `"${p}"`).join(" and ")}: ` +
        "a campaign using both shows two separate rules. If they are the same rule, give each the same ruleKey (07); if not, rename one.",
    );
  }
  return notes;
}

/**
 * The same item id in two or more packs (pack review area 3, eq-4; 07 "Packs stack in one priority order"): one note
 * per id, naming the packs. In a campaign using them the pack on top wins and the entry says "also in"; the note is
 * for the pack author, to keep one copy or make the ids differ when they are different items. An overlay that
 * `requires` the other pack (07, meta.requires) carries the id on purpose, to replace the base's entry: no note.
 * packs: [{ name, entries, id?, requires? }] as the app's reader returns them (`id` and `requires` from the file's meta).
 */
export function itemClashNotes(packs) {
  const byName = new Map(packs.map((p) => [p.name, p]));
  const overlays = (a, b) =>
    (a?.requires ?? []).includes(b?.id) || (b?.requires ?? []).includes(a?.id);
  const deliberate = (names) =>
    names.every((a) =>
      names.every((b) => a === b || overlays(byName.get(a), byName.get(b))),
    );
  return itemClashes(
    packs.map((p) => ({ name: p.name, entries: p.entries ?? [] })),
  )
    .filter((c) => !deliberate(c.packs))
    .map(
      (c) =>
        `item "${c.name}" (${c.id}) is in ${c.packs.map((p) => `"${p}"`).join(" and ")}: a campaign using both takes the pack on top and says "also in" on the entry. ` +
        "Keep one copy, or give them different ids if they are different items.",
    );
}

/**
 * Every same-named pair of one kind across the packs, different ids (sn-1 point 4, plan dec-1-creation 1d): one line
 * per name, for information only (never a warning, the exit code stays). In a campaign using both, each shows its
 * pack's short name after its name; identical ones could instead be one entry the later pack points at.
 * packs: [{ name, entries }] as the app's reader returns them.
 */
export function sameNamePairLines(packs) {
  return sameNamePairs(
    packs.map((p) => ({ name: p.name, id: p.id ?? null, entries: p.entries ?? [] })),
  ).map(
    (pair) =>
      // A pinned copy (sn-1b) is listed with the pack it was pinned from, and says which pack it sits in.
      `${pair.kind} "${pair.name}": ${pair.found.map((f) => `"${f.pack}" (${f.id}${f.pinnedIn ? `, pinned copy in "${f.pinnedIn}"` : ""})`).join(", ")}`,
  );
}

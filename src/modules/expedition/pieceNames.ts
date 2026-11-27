// The pack's ids in a piece's GM-only facts, named as a person would (plan dec-scene-quickfix Q7; F20 c, F21 b).
// `composePackPlace` writes three shapes into those columns: a treasure's "<value>, Item: <item id>", a person's
// "NPC: <npc id>", and a creature's "<stat block id> ×<count> (<note>)". The stored words keep the id; the name is
// found when the line is drawn, on the GM's device, so places made before this fix read by name too. Only those three
// shapes are read, and a known id is named wherever it is. An id nobody knows is left as stored on a place the GM made
// by hand (a typed "asleep" or "wolves ×3" reads as typed), and left out on a place made from a pack ("a creature" for
// a stat block), never printed there (the pack checker is where a wrong id is reported).
// sf-6 keeps the look-up when the line becomes a detail row.

export type NamedKind = 'item' | 'npc' | 'statBlock';
/**
 * A pack entry's name by `<kind>/<id>` (an id with no entry, or a name that is only its id, is not in `byId`), and the
 * pack the place was made from (null: made by hand), which decides what an unknown id reads as.
 */
export interface PieceNames {
  readonly byId: ReadonlyMap<string, string>;
  readonly packId: string | null;
}
export interface GmFacts {
  value: string;
  trigger: string;
  statLine: string;
}
/** A pack entry, as the campaign's setting rules hold it (`CampaignEntry`). */
export interface NamedEntry {
  packId: string;
  kind: string;
  packEntryId: string;
  name: string;
}

const ID = '[a-z0-9][a-z0-9_.-]*';
const ITEM = new RegExp(`(^|, )Item: (${ID})$`);
const NPC = new RegExp(`^NPC: (${ID})$`);
// The stat block's id first, then nothing, its count or its note.
const CREATURE = new RegExp(`^(${ID})(?=$| ×| \\()(.*)$`);

/** The ids a piece's GM facts name, each with the kind of entry it names. */
export function idsInFacts(gm: GmFacts): { kind: NamedKind; id: string }[] {
  const found: { kind: NamedKind; id: string }[] = [];
  const item = ITEM.exec(gm.value);
  if (item) found.push({ kind: 'item', id: item[2]! });
  const npc = NPC.exec(gm.statLine);
  if (npc) found.push({ kind: 'npc', id: npc[1]! });
  else {
    const creature = CREATURE.exec(gm.statLine);
    if (creature) found.push({ kind: 'statBlock', id: creature[1]! });
  }
  return found;
}

/**
 * The GM facts with each known id named ("Item: Silver-tipped arrows", "NPC: Oswy", "Bog lurker ×6"). An unknown id
 * stays as stored on a hand-made place; on a pack-made one it is left out ("a creature ×3" for a stat block).
 */
export function namedFacts(gm: GmFacts, names: PieceNames): GmFacts {
  const fromPack = names.packId !== null;
  const value = gm.value.replace(ITEM, (all: string, before: string, id: string) => {
    const name = names.byId.get(`item/${id}`);
    return name ? `${before}Item: ${name}` : fromPack ? '' : all;
  });
  let statLine = gm.statLine;
  const npc = NPC.exec(statLine);
  if (npc) {
    const name = names.byId.get(`npc/${npc[1]}`);
    statLine = name ? `NPC: ${name}` : fromPack ? '' : statLine;
  } else {
    const creature = CREATURE.exec(statLine);
    const name = creature && names.byId.get(`statBlock/${creature[1]}`);
    if (creature && (name || fromPack)) statLine = `${name || 'a creature'}${creature[2]}`.trim();
  }
  return { ...gm, value, statLine };
}

/**
 * The names of the entries the pieces name, from the campaign's entries: the place's own pack first, then the packs
 * in the campaign's order (`packOrder`, top of the stack first). A name that is only its id counts as unknown.
 */
export function pieceNamesFrom(entries: readonly NamedEntry[], packOrder: readonly string[], facts: readonly GmFacts[], packId: string | null): PieceNames {
  const byId = new Map<string, string>();
  const wanted = new Set(facts.flatMap(idsInFacts).map((w) => `${w.kind}/${w.id}`));
  const order = packId ? [packId, ...packOrder.filter((p) => p !== packId)] : [...packOrder];
  const rank = (p: string) => (order.indexOf(p) < 0 ? order.length : order.indexOf(p));
  const named = entries.filter((e) => wanted.has(`${e.kind}/${e.packEntryId}`) && order.includes(e.packId));
  for (const entry of [...named].sort((a, b) => rank(a.packId) - rank(b.packId))) {
    const key = `${entry.kind}/${entry.packEntryId}`;
    const name = (entry.name ?? '').trim();
    if (name && name !== entry.packEntryId && !byId.has(key)) byId.set(key, name);
  }
  return { byId, packId };
}

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

/**
 * A stat line or an item's line a place's card can print (sf-6b): an entry the place's book or a piece names, by
 * `<kind>/<id>` (`ref`), with its name (never its id) and its detail as the card draws it (null: not in your packs).
 * `line` is the identical line it prints, which decides "the same line a second time": a creature's or an item's own
 * ref; a named character with a stat block of their own, their own ref; one who uses a creature's block, that block's.
 */
export interface HandLine<D> {
  ref: string;
  kind: NamedKind;
  name: string;
  line: string;
  detail: D | null;
}
/** What a piece names: an entry's `<kind>/<id>`, and its count on that piece ("3", "1d4"; none for a thing). */
export interface PieceRef {
  ref: string;
  count?: string | null;
}
/**
 * One detail row on the card. `full`: the line itself. `short`: the line stands elsewhere on the card, so the row is the
 * name and one quiet line (`words`). `missing`: the packs lack it, said by name.
 */
export type HandRow<D> =
  | { form: 'full'; kind: NamedKind; name: string; count: string | null; detail: D }
  | { form: 'short'; kind: NamedKind; name: string; count: string | null; detail: D; words: string }
  | { form: 'missing'; kind: NamedKind; count: string | null; words: string };
/** Where each line stands: each piece's rows, in the pieces' order, and the rows left for "From the book, for the GM". */
export interface LinesAtHand<D> {
  pieces: HandRow<D>[][];
  fold: { statLines: HandRow<D>[]; items: HandRow<D>[] };
}

/** What a ref no line names reads as, so its id is never shown. */
const UNNAMED: Record<NamedKind, string> = { statBlock: 'a creature', npc: 'a character', item: 'a thing' };

/**
 * Where each stat line and item line stands on one place's card (sf-6b; ⚑ 9, "Home Two's fix"; spec scene-pack,
 * piece A). A line a piece names stands on that piece, in full; a line no piece names, in the fold, in full; the same
 * identical line a second time anywhere on the card (the pieces in order, then the fold) is the short row, "Same stat
 * line as the Ferryman.". So nothing is printed twice and no row is dropped: every line given stands at least once.
 * Pure: the card draws what it returns (piece B).
 */
export function linesAtHand<D>(pieces: readonly (readonly PieceRef[])[], lines: readonly HandLine<D>[]): LinesAtHand<D> {
  const byRef = new Map(lines.map((l) => [l.ref, l]));
  // The first row to print each identical line, by the line's key.
  const printed = new Map<string, HandLine<D>>();
  const row = (line: HandLine<D>, count: string | null): HandRow<D> => {
    if (line.detail === null) return { form: 'missing', kind: line.kind, count, words: `Not in your packs: ${line.name}` };
    const first = printed.get(line.line);
    if (!first) {
      printed.set(line.line, line);
      return { form: 'full', kind: line.kind, name: line.name, count, detail: line.detail };
    }
    return { form: 'short', kind: line.kind, name: line.name, count, detail: line.detail, words: sameLineWords(first) };
  };
  const named = new Set<string>();
  const onPieces = pieces.map((refs) =>
    refs.map((r): HandRow<D> => {
      named.add(r.ref);
      const line = byRef.get(r.ref);
      if (line) return row(line, r.count ?? null);
      const given = r.ref.split('/')[0] as NamedKind;
      const kind = given in UNNAMED ? given : 'statBlock';
      return { form: 'missing', kind, count: r.count ?? null, words: `Not in your packs: ${UNNAMED[kind]}` };
    }),
  );
  const fold: LinesAtHand<D>['fold'] = { statLines: [], items: [] };
  for (const line of lines) {
    if (named.has(line.ref)) continue;
    named.add(line.ref);
    (line.kind === 'item' ? fold.items : fold.statLines).push(row(line, null));
  }
  return { pieces: onPieces, fold };
}

/**
 * The short row's quiet line, after the row that prints the line first: "Same stat line as the Ferryman." (sf-24); a
 * named character goes by name alone ("Same stat line as Old Harl."), and an item reads "Same item as the Bronze ring.".
 */
const sameLineWords = (first: { kind: NamedKind; name: string }): string =>
  first.kind === 'item' ? `Same item as the ${first.name}.` : `Same stat line as ${first.kind === 'npc' ? '' : 'the '}${first.name}.`;

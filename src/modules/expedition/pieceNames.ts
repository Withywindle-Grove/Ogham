// The pack's ids in a piece's GM-only facts, named as a person would (plan dec-scene-quickfix Q7; F20 c, F21 b).
// `composePackPlace` writes three shapes into those columns: a treasure's "<value>, Item: <item id>", a person's
// "NPC: <npc id>", and a creature's "<stat block id> ×<count> (<note>)". The stored words keep the id; the name is
// found when the line is drawn, on the GM's device, so places made before this fix read by name too. An id nobody
// knows is left out of the line, never printed (the pack checker is where a wrong id is reported). Words a GM typed
// by hand are never touched: only a pack id's shape (lower case, no spaces) in one of the three places is read.
// sf-6 keeps the look-up when the line becomes a detail row.
import type { Db } from '../../core/supabase.ts';

export type NamedKind = 'item' | 'npc' | 'statBlock';
/** A pack entry's name by `<kind>/<id>`; an id with no entry (or a name that is only its id) is not in it. */
export type PieceNames = ReadonlyMap<string, string>;
export interface GmFacts {
  value: string;
  trigger: string;
  statLine: string;
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

/** The GM facts with each id named ("Item: Silver-tipped arrows", "NPC: Oswy", "Bog lurker ×6"), an unknown id left out. */
export function namedFacts(gm: GmFacts, names: PieceNames): GmFacts {
  const value = gm.value.replace(ITEM, (_all, before: string, id: string) => {
    const name = names.get(`item/${id}`);
    return name ? `${before}Item: ${name}` : '';
  });
  let statLine = gm.statLine;
  const npc = NPC.exec(statLine);
  if (npc) statLine = names.has(`npc/${npc[1]}`) ? `NPC: ${names.get(`npc/${npc[1]}`)}` : '';
  else {
    const creature = CREATURE.exec(statLine);
    if (creature) statLine = `${names.get(`statBlock/${creature[1]}`) ?? ''}${creature[2]}`.trim();
  }
  return { ...gm, value, statLine };
}

/**
 * The names of the entries the pieces name, from the campaign's attached packs (the first pack in the campaign's order
 * wins where two name one id). An empty map when nothing is named or the read fails: the line then leaves the ids out.
 */
export async function loadPieceNames(db: Db, campaignId: string, facts: readonly GmFacts[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const wanted = facts.flatMap(idsInFacts);
  if (wanted.length === 0) return names;
  const links = await db.from('campaign_packs').select('pack_id, priority').eq('campaign_id', campaignId);
  if (links.error || links.data.length === 0) return names;
  const order = links.data.sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0)).map((l) => l.pack_id);
  const rows = await db
    .from('library_entries')
    .select('pack_id, kind, pack_entry_id, name')
    .in('pack_id', order)
    .in('kind', [...new Set(wanted.map((w) => w.kind))])
    .in('pack_entry_id', [...new Set(wanted.map((w) => w.id))]);
  if (rows.error) return names;
  const byPack = [...rows.data].sort((a, b) => order.indexOf(a.pack_id) - order.indexOf(b.pack_id));
  for (const row of byPack) {
    const key = `${row.kind}/${row.pack_entry_id}`;
    const name = (row.name ?? '').trim();
    if (name && name !== row.pack_entry_id && !names.has(key)) names.set(key, name);
  }
  return names;
}

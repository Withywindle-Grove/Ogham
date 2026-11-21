// The edge-case characters (design note docs/design/notes/seed-edge-cases-2026-11-05.md): eight characters in one extra
// campaign, made to show screens with messy data. Planned from the pack's own entries, never from a book's numbers:
// where a row depends on the pack (the class with the most traits, the heaviest armour, the load limit, an XP
// threshold) the rule is here and the pack supplies the figure. Pure: no network.
import { unmet, withRace } from '../src/modules/characters/creation.ts';
import { equipBlocks } from '../src/modules/inventory/equipWarnings.ts';
import { isKitContainer } from '../src/modules/characters/kitPlaces.ts';
import { contextOf, typicalHitPoints } from './seed-plan.mjs';
import { forSale } from './seed-extras.mjs';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value) => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const byName = (a, b) => a.name.localeCompare(b.name);

/** How many abilities (traits) an entry lists. */
export const traitCount = (entry) => (Array.isArray(entry?.data.abilities) ? entry.data.abilities.length : 0);

/** The load the rules set allows in coin mode: the last tier's limit (`maxLoadCoin`); null when the rules give none. */
export const loadLimit = (encumbrance) => whole(encumbrance?.coin?.maxLoadCoin);

/** XP the class's table asks for a level (the row `level`); null when there is no such row. */
export function xpFor(entries, klass, level) {
  const table = entries.find((e) => e.kind === 'xpTable' && e.packEntryId === klass.data.xpTableId);
  const row = (Array.isArray(table?.data.levels) ? table.data.levels : []).filter(isRecord).find((r) => r.level === level);
  return whole(row?.xp);
}

/**
 * What to add to a carrier to reach a load: `base` is what it carries, `goal` is 'exact' (the limit itself) or 'over'
 * (past the limit by at least 1 and at most a tenth of it). Heavy items first, a light one to make up the rest; the
 * counts come from whole items of known weight. `pool` is [{ id, weight }] (ordinary items, each its own weight).
 * Returns { adds: [{ id, qty }], total } or { reason }.
 */
export function loadFill({ base, limit, goal, pool }) {
  const usable = pool.filter((p) => Number.isInteger(p.weight) && p.weight > 0);
  if (usable.length === 0) return { reason: 'no ordinary item with a weight to load it with' };
  const lowest = goal === 'exact' ? limit : limit + 1;
  const highest = goal === 'exact' ? limit : limit + Math.floor(limit / 10);
  if (base > highest) return { reason: `it already carries ${base}, past ${highest}` };
  const heavy = [...usable].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))[0];
  const light = [...usable].sort((a, b) => a.weight - b.weight || a.id.localeCompare(b.id))[0];
  for (let heavyQty = Math.floor((highest - base) / heavy.weight); heavyQty >= 0; heavyQty -= 1) {
    const sofar = base + heavyQty * heavy.weight;
    const lightQty = Math.max(0, Math.ceil((lowest - sofar) / light.weight));
    const total = sofar + lightQty * light.weight;
    if (total >= lowest && total <= highest) {
      const adds = [];
      if (heavyQty > 0) adds.push({ id: heavy.id, qty: heavyQty });
      if (lightQty > 0) adds.push({ id: light.id, qty: lightQty });
      return { adds, total };
    }
  }
  return { reason: `no whole number of items reaches ${lowest} to ${highest}` };
}

/** The ordinary things to load a carrier with: sold, weighed, whole, not a bag, armour, magic, a mount or a bundle. */
export function loadPool(items, encumbrance) {
  const apart = new Set(encumbrance?.separateCategories ?? []);
  return items
    .filter((e) => forSale(e) && !isKitContainer(e.data) && e.data.slot !== 'armour' && !apart.has(String(e.data.category ?? '')) && !(whole(e.data.bundle) > 1) && !(e.data.treasure === true))
    .map((e) => ({ id: e.packEntryId, name: e.name, weight: whole(e.data.weightCoin) ?? 0 }));
}

/** The heaviest armour a class may wear (by weight, then name), as the Pack's equip check sees it; null when none. */
export function heaviestArmour(items, klass, race) {
  const forClass = { name: klass.name, level: 1, class: { ...klass.data, id: klass.packEntryId, name: klass.name }, race: race ? { ...race.data, id: race.packEntryId, name: race.name } : null };
  const worn = items
    .filter((e) => e.data.slot === 'armour' && forSale(e) && whole(e.data.weightCoin) !== null)
    .filter((e) => equipBlocks(forClass, { ...e.data, id: e.packEntryId, name: e.name }).length === 0);
  return [...worn].sort((a, b) => b.data.weightCoin - a.data.weightCoin || a.name.localeCompare(b.name))[0] ?? null;
}

const NAMES = {
  A: 'Bram Alder',
  B: 'Marrowby Thistledown of the Farthest Fen',
  C: 'Odo Quillfeather',
  D: 'Tansy Underbough',
  E: 'Garrick Two-Sacks',
  F: 'Old Hesper Many-Winters',
  G: 'Ix',
  H: 'Wend the Unbowed',
};

/**
 * The eight edge-case characters of one setting, from its entries and option choices. Each has what a planned seed
 * character has (name, class, kindred, scores, hit points) plus `level`, `xp`, `carry` ('kit' | 'nothing' |
 * { heavyArmour, goal }) and `why`. Anything the pack can't give comes back in `notes`; the character is left out then.
 */
export function planEdgeCases(entries, choices, setting) {
  const ctx = contextOf(entries, choices);
  const notes = [];
  const items = setting?.items ?? entries.filter((e) => e.kind === 'item');
  const method = ctx.methods[0] ?? null;
  const plain = ctx.classes.filter((k) => k.data.kindredClass !== true);
  const casters = plain.filter((k) => isRecord(k.data.spellcasting));
  const noCasting = plain.filter((k) => !isRecord(k.data.spellcasting));
  const out = [];

  const find = (list, pattern) => [...list].sort(byName).find((k) => pattern.test(k.name));
  const biggestDie = (list) => [...list].sort((a, b) => (typicalHitPoints(b.data.hitDie) ?? 0) - (typicalHitPoints(a.data.hitDie) ?? 0) || byName(a, b))[0];
  const fighter = find(noCasting, /fight|warrior/i) ?? biggestDie(noCasting);
  const thief = find(noCasting, /thie|rogue/i) ?? [...noCasting].sort(byName).find((k) => k !== fighter);
  const book = [...casters].sort(byName).find((k) => k.data.spellcasting.type === 'book');
  const human = ctx.races.find((r) => /^human$/i.test(r.name)) ?? null;
  if (!human) notes.push('no kindred called human: A, G and H use the first kindred that fits');
  const nothing = [...noCasting].sort(byName).find((k) => k !== fighter && k !== thief) ?? thief ?? fighter;

  /** Place a class (on a given kindred if it fits), with scores raised or set by `over`; reason when it can't be. */
  const place = (klass, preferred, over = {}) => {
    const found = ctx.attempt(klass, method, preferred ?? undefined);
    const fallback = preferred && found.reason ? ctx.attempt(klass, method, undefined) : found;
    if (fallback.reason) return fallback;
    if (fallback.race) ctx.used.set(fallback.race.packEntryId, (ctx.used.get(fallback.race.packEntryId) ?? 0) + 1);
    const rolled = { ...fallback.rolled, ...over };
    const scores = withRace(rolled, fallback.race);
    const problem = unmet(klass.data.requirements, scores) ?? (fallback.race ? unmet(fallback.race.data.requirements, rolled) : null);
    return problem ? { reason: problem } : { race: fallback.race, rolled, scores };
  };

  const add = (letter, klass, placed, extra) => {
    if (!klass) return notes.push(`${letter}: the setting has no class for this row`);
    if (placed.reason) return notes.push(`${letter}: ${klass.name}: ${placed.reason}`);
    const level = extra.level ?? 1;
    out.push({
      letter,
      name: NAMES[letter],
      classId: klass.packEntryId,
      className: klass.name,
      raceId: placed.race?.packEntryId ?? null,
      raceName: placed.race?.name ?? null,
      method: method?.id ?? null,
      rolled: placed.rolled,
      scores: placed.scores,
      hpMax: extra.hpMax ?? (typicalHitPoints(klass.data.hitDie) === null ? null : typicalHitPoints(klass.data.hitDie) * level),
      level,
      xp: extra.xp ?? 0,
      carry: extra.carry ?? 'kit',
      why: extra.why,
    });
  };
  const order = ctx.keys; // the pack's own order of abilities

  // A: uneven scores (in the pack's own order), the human kindred, the plain fighting class.
  const uneven = [17, 5, 13, 9, 10, 8];
  add('A', fighter, fighter ? place(fighter, human, Object.fromEntries(order.map((k, i) => [k, uneven[i] ?? 10]))) : { reason: '' }, { why: 'modifiers above and below zero; an XP bonus from a high prime score' });
  // B: the 40-character name, the thief class, any kindred.
  add('B', thief, thief ? place(thief, null) : { reason: '' }, { why: 'the heading and every place a name shows at 375 px' });
  // C: level 5 caster halfway to the next level; its prime score at 16.
  if (book) {
    const level = Math.min(5, whole(book.data.maxLevel) ?? 5);
    const low = xpFor(entries, book, level);
    const high = xpFor(entries, book, level + 1);
    const prime = Array.isArray(book.data.primeRequisites) ? book.data.primeRequisites[0] : null;
    const key = typeof prime === 'string' ? order.find((k) => k === prime || k.toLowerCase().startsWith(prime.toLowerCase())) ?? prime : null;
    if (low === null || high === null) notes.push(`C: ${book.name}: the XP table has no rows for levels ${level} and ${level + 1}`);
    else add('C', book, place(book, null, key && order.includes(key) ? { [key]: 16 } : {}), { level, xp: Math.floor((low + high) / 2), why: 'the Advancement bar half-way, spell pips, traits already earned' });
  } else notes.push('C: the setting has no class that casts from a book');
  // D: the kindred and class pair whose traits add up the most.
  let best = null;
  for (const klass of ctx.classes) {
    for (const race of ctx.races.length > 0 ? ctx.races : [null]) {
      const found = ctx.attempt(klass, method, race ?? undefined);
      if (found.reason || (race && found.race?.packEntryId !== race.packEntryId)) continue;
      const total = traitCount(klass) + traitCount(race);
      if (!best || total > best.total || (total === best.total && `${klass.name}${race?.name}` < `${best.klass.name}${best.race?.name}`)) best = { klass, race, total };
    }
  }
  if (best) add('D', best.klass, place(best.klass, best.race), { why: `the most trait chips (${best.total}), drawbacks, later-level traits; a spent use is left out (nothing in the app spends one for a seed)` });
  else notes.push('D: no kindred and class pair could be placed');
  // E and F: the class that may wear the heaviest armour, loaded past the limit and exactly at it.
  const armoured = [...plain].sort(byName).map((k) => ({ klass: k, armour: heaviestArmour(items, k, null) })).filter((x) => x.armour).sort((a, b) => b.armour.data.weightCoin - a.armour.data.weightCoin || Number(isRecord(a.klass.data.spellcasting)) - Number(isRecord(b.klass.data.spellcasting)));
  const heavy = armoured[0]?.klass;
  for (const [letter, goal, why] of [['E', 'over', 'the load bar past its end, the over-the-limit words, Movement with no figure'], ['F', 'exact', "the boundary: the last tier's limit, not over"]]) {
    // F takes another kindred than E where the class allows one, so the two differ.
    const before = out.find((c) => c.letter === 'E');
    const other = before ? ctx.races.find((r) => r.packEntryId !== before.raceId) : null;
    add(letter, heavy, heavy ? place(heavy, other) : { reason: '' }, { carry: { heavyArmour: true, goal }, why });
  }
  // G: nothing at all, one hit point.
  add('G', nothing, nothing ? place(nothing, human) : { reason: '' }, { hpMax: 1, carry: 'nothing', why: 'every empty state: no items, spells or weapons at hand' });
  // H: the plain fighting class at its last level with a long XP number.
  if (fighter) add('H', fighter, place(fighter, null), { level: whole(fighter.data.maxLevel) ?? 1, xp: 999999, why: 'Advancement with no next level; a long number' });
  return { characters: out.sort((a, b) => a.letter.localeCompare(b.letter)), notes };
}

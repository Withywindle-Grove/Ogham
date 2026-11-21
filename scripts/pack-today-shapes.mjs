// Format checks for the shapes ruled 2026-11-05 (after-m5b-gate.md, "pack:check learns today's shapes"):
// a caster class's `spellcasting.duplicates` and `listId` as a list (a5-3, a5-6), a spell's `reversed` and `conjures`
// (a5-5, a5-7), a stat block variant's `casterLevel` and `turnAs` (a5-5, mp-13), a drain's `levelLoss.xp` (a5-4),
// a turning ability's `turning` block (mp-11 … mp-13), items' `availability` (a6-2), `meta.contentNote` (cn-1),
// a place's `encounterCheck.tableRef` (G-154) and `settlement` (G-157). A list-keyed `reversible` (a5-1) is
// pack-reversible.mjs's, in the held pull request #486; `uses.per` of turn, year and ever is USES_PER in
// pack-format.mjs; the score value columns and `forClasses` across the stack were already checked.
// Notes only: they say what the app won't read as written. Nothing here reads a rule's content.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isWhole = (value) => Number.isInteger(value);
const list = (values) => values.join(', ');
const entriesOf = (file, part) => (Array.isArray(file?.[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** What a drain's `levelLoss.xp` may say (07, a5-4); the rules set's own also takes `levelStart` or a formula. */
export const DRAIN_XP = ['midpoint', 'minimum'];

/** An item's `availability.chance` (07, a6-2): "x-in-6" or "always". */
const CHANCE = /^(always|\d+-in-\d+)$/;

/** The settlement sizes a file's rules sets name (`settlement.availability.bySize[].size`). */
export function settlementSizes(file) {
  const sizes = new Set();
  for (const rules of entriesOf(file, 'rulesSets')) {
    const by = rules.settlement?.availability?.bySize;
    if (Array.isArray(by)) for (const row of by) if (isObject(row) && isText(row.size)) sizes.add(row.size);
  }
  return sizes;
}

/** `meta.requires` as a list of pack ids (ids or `{ packId }`). */
export function requiredIds(file) {
  return Array.isArray(file?.meta?.requires)
    ? file.meta.requires.map((r) => (typeof r === 'string' ? r : r?.packId)).filter(isText)
    : [];
}

function classNotes(file) {
  const notes = [];
  for (const entry of entriesOf(file, 'classes')) {
    const where = `classes: "${label(entry)}"`;
    const casting = entry.spellcasting;
    if (isObject(casting)) {
      if (casting.duplicates !== undefined && typeof casting.duplicates !== 'boolean') notes.push(`${where}: spellcasting.duplicates is true or false (false when the same spell can't be prepared twice).`);
      const id = casting.listId;
      if (Array.isArray(id)) {
        if (id.length === 0 || !id.every(isText)) notes.push(`${where}: spellcasting.listId as a list should hold spell list ids, like ["list-a", "list-b"].`);
        else {
          if (new Set(id).size !== id.length) notes.push(`${where}: spellcasting.listId lists the same spell list twice.`);
          if (id.length === 1) notes.push(`${where}: spellcasting.listId is a list of one; write the id alone (a list is a choice picked at creation).`);
        }
      } else if (id !== undefined && id !== null && !isText(id)) notes.push(`${where}: spellcasting.listId should be a spell list id, or a list of them to choose from.`);
    }
    for (const ability of Array.isArray(entry.abilities) ? entry.abilities.filter(isObject) : []) notes.push(...turningNotes(`${where}, ability "${label(ability)}"`, ability));
  }
  for (const entry of entriesOf(file, 'races')) {
    for (const ability of Array.isArray(entry.abilities) ? entry.abilities.filter(isObject) : []) notes.push(...turningNotes(`races: "${label(entry)}", ability "${label(ability)}"`, ability));
  }
  return notes;
}

/** An ability's `turning: { outcomes: [words], uses?: { count, per }, note? }` (mp-11 … mp-13); `usesPer` is USES_PER. */
let usesPerList = ['day', 'rest', 'fight', 'week', 'turn', 'year', 'ever'];
function turningNotes(where, ability) {
  const notes = [];
  const turning = ability.turning;
  if (turning === undefined) {
    if (ability.turningTableId !== undefined && !isText(ability.turningTableId)) notes.push(`${where}: turningTableId should be a table id.`);
    return notes;
  }
  if (!isObject(turning)) return [`${where}: turning should be { outcomes: [words], uses?: { count, per }, note? }.`];
  if (!(Array.isArray(turning.outcomes) && turning.outcomes.length > 0 && turning.outcomes.every(isText))) notes.push(`${where}: turning.outcomes should be a list of words for the log's chips, like ["turned", "destroyed"].`);
  else if (new Set(turning.outcomes).size !== turning.outcomes.length) notes.push(`${where}: turning.outcomes repeats a word.`);
  if (turning.uses !== undefined) {
    const uses = turning.uses;
    if (!isObject(uses) || !isWhole(uses.count) || uses.count < 1) notes.push(`${where}: turning.uses should be { count: <a whole number of 1 or more>, per: ${list(usesPerList)} }.`);
    else if (!usesPerList.includes(uses.per)) notes.push(`${where}: turning.uses.per "${uses.per}" isn't one of ${list(usesPerList)}.`);
  }
  if (turning.note !== undefined && !isText(turning.note)) notes.push(`${where}: turning.note should be words.`);
  const known = ['outcomes', 'uses', 'note'];
  for (const key of Object.keys(turning).filter((k) => !known.includes(k) && k !== 'source')) notes.push(`${where}: turning.${key} isn't a field the format reads (${list(known)}).`);
  return notes;
}

/** A spell's `reversed: { name, range?, duration? }` (a5-7) and `conjures: [{ statBlockId, count?, note? }]` (a5-5). */
function spellNotes(file) {
  const notes = [];
  for (const spell of entriesOf(file, 'spells')) {
    const where = `spells: "${label(spell)}"`;
    const reversed = spell.reversed;
    if (reversed !== undefined && reversed !== null) {
      if (!isObject(reversed)) notes.push(`${where}: reversed should be { name, range?, duration? }, the reversed form's own figures.`);
      else {
        if (!isText(reversed.name)) notes.push(`${where}: reversed needs a name.`);
        for (const key of ['range', 'duration']) if (reversed[key] !== undefined && !isText(reversed[key]) && !isObject(reversed[key])) notes.push(`${where}: reversed.${key} should be written as the spell's own ${key} is.`);
        if (isText(spell.reversedName) && isText(reversed.name) && spell.reversedName !== reversed.name) notes.push(`${where}: reversedName and reversed.name differ; reversed.name is read.`);
      }
    }
    if (spell.conjures !== undefined) {
      if (!Array.isArray(spell.conjures) || spell.conjures.length === 0) notes.push(`${where}: conjures should be a list like [{ statBlockId, count?, note? }].`);
      else {
        for (const [i, row] of spell.conjures.entries()) {
          const at = `${where}, conjures ${i + 1}`;
          if (!isObject(row)) {
            notes.push(`${at} should be { statBlockId, count?, note? }.`);
            continue;
          }
          const id = row.statBlockId;
          if (!(isText(id) || (Array.isArray(id) && id.length > 0 && id.every(isText)))) notes.push(`${at}: statBlockId should be a stat block id, or a list of them (the caster picks one at casting).`);
          if (Array.isArray(id) && id.length === 1) notes.push(`${at}: statBlockId is a list of one; write the id alone (a list is a choice).`);
          if (row.count !== undefined && !((isWhole(row.count) && row.count >= 1) || isText(row.count))) notes.push(`${at}: count should be a whole number, dice ("1d4") or a formula in the caster's level.`);
          if (row.note !== undefined && !isText(row.note)) notes.push(`${at}: note should be words.`);
        }
      }
    }
  }
  return notes;
}

/** Every `levelLoss` found anywhere in a stat block or an item (a drain's own XP rule, a5-4). */
function drainNotes(file) {
  const notes = [];
  const walk = (value, where) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i + 1}]`));
    else if (isObject(value)) {
      for (const [key, inner] of Object.entries(value)) {
        if (key === 'levelLoss') {
          if (!isObject(inner)) notes.push(`${where}: levelLoss should be { xp: "midpoint" | "minimum" }.`);
          else if (inner.xp !== undefined && !DRAIN_XP.includes(inner.xp)) notes.push(`${where}: levelLoss.xp "${inner.xp}" isn't one of ${list(DRAIN_XP)}.`);
        } else walk(inner, `${where}.${key}`);
      }
    }
  };
  for (const part of ['statBlocks', 'items']) for (const entry of entriesOf(file, part)) walk(entry, `${part}: "${label(entry)}"`);
  return notes;
}

/** A variant's `casterLevel: { min, max? }` picks it by the caster's level (a5-5); `turnAs` names a turning column. */
function statBlockNotes(file) {
  const notes = [];
  for (const block of entriesOf(file, 'statBlocks')) {
    const where = `statBlocks: "${label(block)}"`;
    if (block.turnAs !== undefined && !isText(block.turnAs)) notes.push(`${where}: turnAs should be the name of the turning table's column.`);
    if (!Array.isArray(block.variants)) continue;
    const ranges = [];
    for (const [i, variant] of block.variants.entries()) {
      if (!isObject(variant) || variant.casterLevel === undefined) continue;
      const at = `${where}, variant ${isText(variant.name) ? `"${variant.name}"` : i + 1}`;
      const level = variant.casterLevel;
      if (!isObject(level) || !isWhole(level.min) || level.min < 1 || (level.max !== undefined && !(isWhole(level.max) && level.max >= level.min))) {
        notes.push(`${at}: casterLevel should be { min: <whole number, 1 or more>, max?: <whole number, not under min> }.`);
        continue;
      }
      ranges.push({ at, min: level.min, max: level.max ?? Infinity });
    }
    for (const [i, a] of ranges.entries()) for (const b of ranges.slice(i + 1)) if (a.min <= b.max && b.min <= a.max) notes.push(`${a.at} and ${b.at}: their casterLevel ranges overlap; one level would pick two variants.`);
    if (ranges.length > 0 && ranges.length < block.variants.length) notes.push(`${where}: only some variants have a casterLevel; the others are never picked by level.`);
  }
  return notes;
}

/** An item's `availability: { where?, chance?, rarity?, note? }` (a6-2); `sizes` is the settlement sizes known, if any. */
function availabilityNotes(file, sizes) {
  const notes = [];
  for (const item of entriesOf(file, 'items')) {
    const a = item.availability;
    if (a === undefined) continue;
    const where = `items: "${label(item)}": availability`;
    if (!isObject(a)) {
      notes.push(`${where} should be { where?: [settlement sizes], chance?: "x-in-6" | "always", rarity?, note? }.`);
      continue;
    }
    if (a.where !== undefined) {
      if (!(Array.isArray(a.where) && a.where.length > 0 && a.where.every(isText))) notes.push(`${where}.where should be a list of settlement sizes.`);
      else if (sizes) for (const size of a.where.filter((s) => !sizes.has(s))) notes.push(`${where}.where names "${size}", which isn't a size of the setting's settlement.availability.bySize (${list([...sizes])}).`);
    }
    if (a.chance !== undefined && !(isText(a.chance) && CHANCE.test(a.chance.trim()))) notes.push(`${where}.chance should be "x-in-6" (any number in any number) or "always".`);
    for (const key of ['rarity', 'note']) if (a[key] !== undefined && !isText(a[key])) notes.push(`${where}.${key} should be words.`);
  }
  return notes;
}

/** A place's `settlement: { size, population? }` (G-157) and `encounterCheck.tableRef` (G-154). */
function placeNotes(file, sizes) {
  const notes = [];
  const requires = requiredIds(file);
  for (const place of entriesOf(file, 'locations')) {
    const where = `locations: "${label(place)}"`;
    const s = place.settlement;
    if (s !== undefined && s !== null) {
      if (!isObject(s) || !isText(s.size)) notes.push(`${where}: settlement should be { size, population? }.`);
      else {
        if (sizes && !sizes.has(s.size)) notes.push(`${where}: settlement.size "${s.size}" isn't a size of the setting's settlement.availability.bySize (${list([...sizes])}).`);
        if (s.population !== undefined && !(isWhole(s.population) && s.population >= 0)) notes.push(`${where}: settlement.population should be a whole number.`);
      }
    }
    const check = place.encounterCheck;
    if (!isObject(check) || check.tableRef === undefined) continue;
    const at = `${where}: encounterCheck.tableRef`;
    if (check.tableId !== undefined) notes.push(`${at}: the check has tableId as well; use one or the other, never both.`);
    const ref = check.tableRef;
    const m = isText(ref) ? /^([^:\s]+):(\S+)$/.exec(ref.trim()) : null;
    if (!m) notes.push(`${at} should be "<meta.id>:<table id>".`);
    else if (!requires.includes(m[1]) && m[1] !== file.meta?.id) notes.push(`${at} names pack "${m[1]}", which isn't in meta.requires.`);
  }
  return notes;
}

function metaNotes(file) {
  const note = file.meta?.contentNote;
  if (note === undefined) return [];
  if (!isText(note)) return ['meta.contentNote should be one or two lines of words.'];
  return note.trim().split(/\r?\n/).filter((l) => l.trim() !== '').length > 2 ? ['meta.contentNote is more than two lines; it is shown at the top of the import preview, so keep it to one or two.'] : [];
}

/**
 * Format notes for today's shapes. `usesPer` is the list `uses.per` may take (pack-format's USES_PER); `sizes` the
 * settlement sizes to check a place or an item against, when known (this file's own, or the whole stack's).
 */
export function todayShapeNotes(file, usesPer, sizes = null) {
  if (!isObject(file)) return [];
  if (Array.isArray(usesPer)) usesPerList = usesPer;
  const own = settlementSizes(file);
  const known = sizes ?? (own.size > 0 ? own : null);
  return [...metaNotes(file), ...classNotes(file), ...spellNotes(file), ...drainNotes(file), ...statBlockNotes(file), ...availabilityNotes(file, known), ...placeNotes(file, known)];
}

/**
 * What only the stack shows (packs = [{ name, file, id }]): sizes a place or an item names against every pack's
 * settlement sizes, a conjured creature's stat block, and a `tableRef`'s table in the pack it names.
 * Only notes checking each file alone didn't give.
 */
export function todayShapeLibraryNotes(packs, usesPer) {
  const sizes = new Set(packs.flatMap((p) => [...settlementSizes(p.file)]));
  const alone = new Set(packs.flatMap((p) => todayShapeNotes(p.file, usesPer)));
  const notes = packs.flatMap((p) => todayShapeNotes(p.file, usesPer, sizes.size > 0 ? sizes : null)).filter((n) => !alone.has(n));
  const blocks = new Set(packs.flatMap((p) => entriesOf(p.file, 'statBlocks').map((b) => b.id).filter(isText)));
  for (const p of packs) {
    for (const spell of entriesOf(p.file, 'spells')) {
      for (const row of Array.isArray(spell.conjures) ? spell.conjures.filter(isObject) : []) {
        const ids = Array.isArray(row.statBlockId) ? row.statBlockId : [row.statBlockId];
        for (const id of ids.filter((i) => isText(i) && !blocks.has(i))) notes.push(`${p.name}: spells: "${label(spell)}": conjures names stat block "${id}", which none of these packs has.`);
      }
    }
    for (const place of entriesOf(p.file, 'locations')) {
      const ref = place.encounterCheck?.tableRef;
      const m = isText(ref) ? /^([^:\s]+):(\S+)$/.exec(ref.trim()) : null;
      if (!m) continue;
      const target = packs.find((q) => q.id === m[1]);
      if (!target) notes.push(`${p.name}: locations: "${label(place)}": encounterCheck.tableRef names pack "${m[1]}", which isn't among the files checked together.`);
      else if (!entriesOf(target.file, 'tables').some((t) => t.id === m[2])) notes.push(`${p.name}: locations: "${label(place)}": encounterCheck.tableRef names table "${m[2]}", which pack "${m[1]}" doesn't have.`);
    }
  }
  return notes;
}

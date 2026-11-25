// The pack checker's format checks for the fields ruled 2026-11-01 from the zine-compendium survey (docs/07,
// "Format additions from the zine-compendium survey"; design/rulings/m5b-zine-gaps-2026-11-01.md; register rows
// G-42 and G-48 to G-67). Every field here is format-only until its release (08): the importer keeps it, the app
// reads it later. These checks say, in plain lines, whether a pack writes them the way 07 says. Nothing blocks an import.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-additions.test.mjs with invented packs.

import { APP_MODE_PREFIX } from '../src/modules/expedition/modes.ts';
import { ROUTE_UNITS } from '../src/modules/library/routes.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isWhole = (value) => Number.isInteger(value);
const isDice = (value) => isText(value) && /^\d*d\d+(?:\s*[+−-]\s*\d+)?$/.test(value.trim());
const list = (values) => values.join(', ');
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
const idsOf = (file, part) => new Set(entriesOf(file, part).map((e) => e.id).filter(isText));

/** Whether the pack names other packs it needs: then an id this file doesn't have may be one of theirs (07 References §13). */
const hasRequires = (file) => isObject(file.meta) && Array.isArray(file.meta.requires) && file.meta.requires.length > 0;

/** The kinds of place a location may be (07 Adventure packs §2). */
export const LOCATION_TYPES = ['region', 'site', 'area', 'floor', 'room', 'building'];

/** A route's `type` (07 Adventure packs §3). */
export const ROUTE_TYPES = ['path', 'road', 'river', 'door', 'stairs', 'secret', 'other'];

/** What a material does on a natural 1 (G-51). */
export const ON_NATURAL_1 = ['bend', 'break'];

/** Where a condition may sit (G-52): a character by default, or an item. */
export const CONDITION_APPLIES_TO = ['character', 'item'];

/** Old progression columns the zine conversion used before the ruling, and the field that holds each now. */
const OLD_PROGRESSION_KEYS = { mentalPowers: 'spellcasting.known', naturalArmourClass: 'armourClass', unarmedDamage: 'extra' };

/** `meta.sources[]` (G-55): which part of a growing source each stage came from; `meta.overlays` isn't a key. */
function metaNotes(file) {
  const meta = isObject(file.meta) ? file.meta : null;
  if (!meta) return [];
  const notes = [];
  if (meta.overlays !== undefined) notes.push('meta.overlays isn\'t a format key: meta.requires is the only link to the pack this one overlays (07, Rules overlay packs).');
  if (meta.sources !== undefined) {
    if (!Array.isArray(meta.sources)) notes.push('meta.sources should be a list like [{ "part": "issue 5", "pages": "12–21", "kinds": ["traitLists"] }].');
    else {
      for (const [i, source] of meta.sources.entries()) {
        const at = `meta.sources, entry ${i + 1}`;
        if (!isObject(source)) {
          notes.push(`${at} should be { part, pages?, kinds? }.`);
          continue;
        }
        if (source.issue !== undefined && source.part === undefined) notes.push(`${at}: "issue" is the old key; write part ("issue 5").`);
        else if (!isText(source.part)) notes.push(`${at}: part should be words ("issue 5", "volume 2").`);
        if (source.pages !== undefined && !isText(source.pages)) notes.push(`${at}: pages should be words ("12–21").`);
        if (source.kinds !== undefined && !(Array.isArray(source.kinds) && source.kinds.every(isText))) notes.push(`${at}: kinds should be a list of part names.`);
      }
    }
  }
  // G-212: meta.sourceTitles { "<code>": "<the book's own title>" }, "" the pack's own book (retest 4 T6).
  if (meta.sourceTitles !== undefined) {
    if (!isObject(meta.sourceTitles)) notes.push('meta.sourceTitles should be { "<code>": "<the book\'s own title>" }, "" for the pack\'s own book.');
    else for (const [code, title] of Object.entries(meta.sourceTitles)) if (!isText(title)) notes.push(`meta.sourceTitles "${code}" should be the book's title in words.`);
  }
  return notes;
}

/**
 * A row's `statBlockIds` (G-68; pf-2, ruled 2026-11-11): each entry a plain id or { statBlockId | statBlockRef, count };
 * a count is dice or a whole number of 1 or more; an entry with no count of its own goes by the row's `count`, and one
 * with neither is noted.
 */
function creatureNotes(row, at) {
  if (row.statBlockIds === undefined) return [];
  if (!Array.isArray(row.statBlockIds)) return [`${at}: statBlockIds should be a list of stat block ids or { "statBlockId" | "statBlockRef", "count" }.`];
  const isCount = (value) => (isWhole(value) && value >= 1) || isDice(value) || (isText(value) && /^\d+$/.test(value.trim()) && Number(value) >= 1);
  const rowCount = isCount(row.count);
  const notes = [];
  row.statBlockIds.forEach((entry, j) => {
    const where = `${at}, creature ${j + 1}`;
    if (isText(entry)) {
      if (!rowCount) notes.push(`${where} ("${entry}") has no count, and the row has none either.`);
      return;
    }
    if (!isObject(entry) || !(isText(entry.statBlockId) || isText(entry.statBlockRef))) {
      notes.push(`${where} should be a stat block id or { "statBlockId" | "statBlockRef", "count" }.`);
      return;
    }
    if (isText(entry.statBlockId) && isText(entry.statBlockRef)) notes.push(`${where}: give statBlockId (this pack) or statBlockRef (another pack), not both.`);
    if (entry.count !== undefined && !isCount(entry.count)) notes.push(`${where}: count should be dice ("1d4") or a whole number of 1 or more.`);
    else if (entry.count === undefined && !rowCount) notes.push(`${where} ("${entry.statBlockRef ?? entry.statBlockId}") has no count, and the row has none either.`);
  });
  // A row that mixes counted and plain creatures gives each plain one the row's count (pf-2): with two or more plain
  // ones that reads as that many of each, so the checker asks for a count on each.
  const plain = row.statBlockIds.filter((e) => isText(e) || (isObject(e) && e.count === undefined)).length;
  const counted = row.statBlockIds.filter((e) => isObject(e) && e.count !== undefined).length;
  if (counted > 0 && plain >= 2) notes.push(`${at}: some creatures have a count and ${plain} don't, so each of those takes the row's count; give each creature its own count.`);
  return notes;
}

/** `rows[].tableId` (G-42): a row that keeps its text and opens a sub-table; the sub-table must be in this pack. */
function rowTableNotes(file) {
  const tables = idsOf(file, 'tables');
  const notes = [];
  for (const table of entriesOf(file, 'tables')) {
    const rows = Array.isArray(table.rows) ? table.rows.filter(isObject) : [];
    rows.forEach((row, i) => {
      notes.push(...creatureNotes(row, `tables: "${label(table)}", row ${i + 1}`));
      if (row.tableId === undefined) return;
      const at = `tables: "${label(table)}", row ${i + 1}`;
      if (!isText(row.tableId)) notes.push(`${at}: tableId should be a table id.`);
      else if (row.tableId === table.id) notes.push(`${at}: tableId names the table itself.`);
      else if (!tables.has(row.tableId)) notes.push(`${at}: tableId "${row.tableId}" isn't a table in this pack.`);
      if (row.result === undefined || !isText(row.result)) notes.push(`${at}: a row with tableId keeps its own result text (the sub-table opens from it).`);
    });
  }
  return notes;
}

/** Dice units the Gear step offers as rows to tap (startingGear.ts unitsDice): one to three dice, up to 20 sides, at most 30 results. */
function tappableDice(value) {
  const m = /^(\d*)d(\d+)$/i.exec(String(value).replace(/\s+/g, ''));
  if (!m) return false;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  return count >= 1 && count <= 3 && sides >= 2 && sides <= 20 && count * sides - count + 1 <= 30;
}

/**
 * A kit-shaped gear line: { itemId | name, qty?, units?, ifSize?, oneOf? } with qty a whole number or dice (G-48,
 * G-57); `units` single pieces of a bundle, a number or dice (G-92); `ifSize` swaps and `oneOf` choices (G-88). `own`:
 * a kit's own `items`, the only lines where dice `units` and `oneOf` are settled by the player (cs-6).
 */
function gearLineNotes(at, line, items, lenient, own = false) {
  if (!isObject(line)) return [`${at} should be { itemId | name, qty? }.`];
  const notes = [];
  const known = (id) => lenient || items.has(id);
  if (line.itemId === undefined && line.name === undefined) notes.push(`${at} needs an itemId or a name.`);
  if (line.itemId !== undefined) {
    if (!isText(line.itemId)) notes.push(`${at}: itemId should be an item id.`);
    else if (!known(line.itemId)) notes.push(`${at}: itemId "${line.itemId}" isn't an item in this pack (name a required pack in meta.requires if it's theirs).`);
  }
  if (line.itemRef !== undefined) notes.push(`${at}: itemRef isn't read on a gear line; with meta.requires a plain itemId may name the other pack's item.`);
  if (line.name !== undefined && !isText(line.name)) notes.push(`${at}: name should be words.`);
  // rc-3: a line by name is a one-off at creation (no weight or price), noted so the pack prefers an item id.
  else if (line.itemId === undefined && isText(line.name)) notes.push(`${at}: "${line.name}" is a one-off by name (no weight or price; it joins the new character's pack at once, covered by the character's approval); give an itemId if the pack has the item.`);
  if (line.qty !== undefined && !((isWhole(line.qty) && line.qty >= 1) || isDice(line.qty))) notes.push(`${at}: qty should be a whole number of 1 or more, or dice like "1d6".`);
  if (line.units !== undefined) {
    if (!((isWhole(line.units) && line.units >= 1) || isDice(line.units))) notes.push(`${at}: units should be a whole number of 1 or more (single pieces of the bundle), or dice like "1d6".`);
    else if (isDice(line.units) && !own) notes.push(`${at}: units as dice are read on a kit's own items only; here the line gives one bundle.`);
    else if (isDice(line.units) && !tappableDice(line.units)) notes.push(`${at}: units "${line.units}" has too many results to tap (one to three dice of up to 20 sides, at most 30 results, no + or −); the line gives one bundle.`);
  }
  if (line.oneOf !== undefined) {
    if (!Array.isArray(line.oneOf) || !line.oneOf.every(isText)) notes.push(`${at}: oneOf should be a list of item ids (the choice; itemId is the default).`);
    else {
      for (const id of line.oneOf.filter((id) => !known(id))) notes.push(`${at}: oneOf names "${id}", which isn't an item in this pack.`);
      if (!own) notes.push(`${at}: oneOf is read on a kit's own items only; here the line gives its itemId.`);
    }
  }
  if (line.ifSize !== undefined) {
    if (!isObject(line.ifSize) || !Object.values(line.ifSize).every((swap) => isObject(swap) && isText(swap.itemId))) notes.push(`${at}: ifSize should be { "<size>": { "itemId": "<item id>" } }.`);
    else for (const swap of Object.values(line.ifSize).filter((swap) => !known(swap.itemId))) notes.push(`${at}: ifSize names "${swap.itemId}", which isn't an item in this pack.`);
  }
  return notes;
}

/** Trait-list entries' `items` and `spells` (G-48, G-62), and kit lines' dice and other-pack ids (G-57). */
function gearAndSpellNotes(file) {
  const items = idsOf(file, 'items');
  const spells = idsOf(file, 'spells');
  const lenient = hasRequires(file);
  const notes = [];
  for (const kit of entriesOf(file, 'startingKits')) {
    const where = `startingKits: "${label(kit)}"`;
    (Array.isArray(kit.items) ? kit.items : []).forEach((line, i) => notes.push(...gearLineNotes(`${where}, line ${i + 1}`, line, items, lenient, true)));
    // A roll's rows give gear lines too (cs-6: `ifSize` swaps sit there).
    (Array.isArray(kit.rolls) ? kit.rolls : []).filter(isObject).forEach((roll, r) =>
      (Array.isArray(roll.rows) ? roll.rows : []).filter(isObject).forEach((row, w) =>
        (Array.isArray(row.items) ? row.items : []).forEach((line, i) => notes.push(...gearLineNotes(`${where}, roll ${r + 1}, row ${w + 1}, line ${i + 1}`, line, items, lenient))),
      ),
    );
  }
  // A kindred's armour substitutes (cs-6, G-88): { "<item id>": "<item id>" }, read on kit lines.
  for (const race of entriesOf(file, 'races').filter((r) => r.armourSubstitutes !== undefined)) {
    const at = `races: "${label(race)}": armourSubstitutes`;
    if (!isObject(race.armourSubstitutes) || !Object.values(race.armourSubstitutes).every(isText)) notes.push(`${at} should be { "<item id>": "<the kindred's item id>" }.`);
    else for (const id of [...Object.keys(race.armourSubstitutes), ...Object.values(race.armourSubstitutes)].filter((id) => !lenient && !items.has(id))) notes.push(`${at} names "${id}", which isn't an item in this pack.`);
  }
  for (const traitList of entriesOf(file, 'traitLists')) {
    for (const entry of (Array.isArray(traitList.entries) ? traitList.entries : []).filter(isObject)) {
      const where = `traitLists: "${label(traitList)}", "${label(entry)}"`;
      if (entry.items !== undefined) {
        if (!Array.isArray(entry.items)) notes.push(`${where}: items should be a list of { itemId | name, qty? } (the kit shape).`);
        else entry.items.forEach((line, i) => notes.push(...gearLineNotes(`${where}, item ${i + 1}`, line, items, lenient)));
      }
      // rc-2: coins added to starting money; a whole number is read; dice later, when a pack uses them (bq3-19 B).
      // G-213: the powers an entry gives, the classes' shape; `uses` { count, per } for the dots, `spellId` any pack's spell.
      if (entry.abilities !== undefined) {
        if (!Array.isArray(entry.abilities)) notes.push(`${where}: abilities should be a list of { name, note, uses?, spellId? } (the classes' shape).`);
        else entry.abilities.forEach((a, i) => {
          const at = `${where}, ability ${i + 1}`;
          if (!isObject(a) || !isText(a.name)) return notes.push(`${at} should be { name, note, uses?: { count, per }, spellId? }.`);
          if (a.uses !== undefined && !(isObject(a.uses) && isWhole(a.uses.count) && a.uses.count > 0)) notes.push(`${at} ("${a.name}"): uses should be { count: <a whole number over 0>, per: "day" | "rest" | … }.`);
          if (a.spellId !== undefined && !isText(a.spellId)) notes.push(`${at} ("${a.name}"): spellId should be a spell's id.`);
          else if (isText(a.spellId) && !spells.has(a.spellId) && !lenient) notes.push(`${at} ("${a.name}"): spellId "${a.spellId}" isn't a spell in this pack (name a required pack in meta.requires if it's theirs).`);
        });
      }
      if (entry.money !== undefined) {
        if (isDice(entry.money)) notes.push(`${where}: money as dice ("${entry.money}") isn't added by the app: the entry's pop-up says to roll it at the table and the GM adds it (a whole number is added at once).`);
        else if (!isWhole(entry.money) || entry.money < 0) notes.push(`${where}: money should be a whole number (coins added to starting money).`);
      }
      if (entry.spells === undefined) continue;
      const at = `${where}: spells`;
      if (!isObject(entry.spells)) {
        notes.push(`${at} should be { add?: [spell ids], replace?: [{ spellId, with }], roll?: { listId, level } }.`);
        continue;
      }
      for (const key of Object.keys(entry.spells).filter((k) => !['add', 'replace', 'roll'].includes(k))) notes.push(`${at}.${key} isn't read; the block takes add, replace and roll.`);
      // rc-2, bq3-18: one spell of a list's level, rolled under the entry's pick on its own step.
      if (entry.spells.roll !== undefined) notes.push(...spellRollNotes(`${at}.roll`, entry.spells.roll, file, lenient));
      if (entry.spells.add !== undefined) {
        if (!Array.isArray(entry.spells.add)) notes.push(`${at}.add should be a list of spell ids.`);
        else for (const id of entry.spells.add) {
          if (!isText(id)) notes.push(`${at}.add has an entry that isn't a spell id.`);
          else if (!spells.has(id)) notes.push(`${at}.add names "${id}", which isn't a spell in this pack.`);
        }
      }
      if (entry.spells.replace !== undefined) {
        if (!Array.isArray(entry.spells.replace)) notes.push(`${at}.replace should be a list of { spellId, with }.`);
        else entry.spells.replace.forEach((swap, i) => {
          if (!isObject(swap) || !isText(swap.spellId) || !isText(swap.with)) {
            notes.push(`${at}.replace, entry ${i + 1} should be { spellId: "<the spell replaced>", with: "<this pack's spell>" }.`);
            return;
          }
          if (!spells.has(swap.with)) notes.push(`${at}.replace: with "${swap.with}" isn't a spell in this pack.`);
          if (!spells.has(swap.spellId) && !lenient) notes.push(`${at}.replace: spellId "${swap.spellId}" isn't a spell in this pack (name a required pack in meta.requires if it's theirs).`);
        });
      }
    }
  }
  return notes;
}

/** The spell lists a pack names: its `spellLists` ids and every key of its spells' `lists`. */
function spellListIds(file) {
  const ids = idsOf(file, 'spellLists');
  for (const spell of entriesOf(file, 'spells')) if (isObject(spell.lists)) for (const key of Object.keys(spell.lists)) ids.add(key);
  return ids;
}

/** A trait-list entry's `spells.roll { listId, level }` (rc-2): the list exists (in a required pack, for an overlay). */
function spellRollNotes(at, roll, file, lenient) {
  if (!isObject(roll) || !isText(roll.listId) || !isWhole(roll.level) || roll.level < 0) return [`${at} should be { listId: "<spell list id>", level: <a whole number, 0 for cantrips> }.`];
  if (lenient || spellListIds(file).has(roll.listId)) return [];
  return [`${at}: listId "${roll.listId}" isn't a spell list in this pack (name a required pack in meta.requires if it's theirs).`];
}

/** `spellcasting.known` (G-49, G-63): spells known rather than slotted; `type: "known"` isn't a type. */
function knownNotes(where, spellcasting, file, classId) {
  const notes = [];
  if (spellcasting.type === 'known') notes.push(`${where}: spellcasting.type "known" isn't a type; write spellcasting.known: { byLevel, usesPerDay?, memorise?, listLevel? } (with or without slots).`);
  const known = spellcasting.known;
  if (known === undefined) return notes;
  const at = `${where}: spellcasting.known`;
  if (!isObject(known)) return [...notes, `${at} should be { byLevel: [{ level, count }], usesPerDay?, memorise?, listLevel? }.`];
  const rows = known.byLevel;
  if (!(Array.isArray(rows) && rows.length > 0 && rows.every((r) => isObject(r) && isWhole(r.level) && isWhole(r.count) && r.count >= 0))) {
    notes.push(`${at}.byLevel should be a list like [{ "level": 1, "count": 2 }].`);
  }
  if (known.usesPerDay !== undefined && !(isWhole(known.usesPerDay) && known.usesPerDay >= 1)) notes.push(`${at}.usesPerDay should be a whole number of 1 or more.`);
  if (known.memorise !== undefined && !(known.memorise === 'all' || (isWhole(known.memorise) && known.memorise >= 0))) notes.push(`${at}.memorise should be "all" or a whole number.`);
  // of-6 (G-119): any list level; noted only when it isn't a level number, or the class's list has no spells there.
  if (known.listLevel !== undefined) {
    if (!(isWhole(known.listLevel) && known.listLevel >= 0)) notes.push(`${at}.listLevel should be a list level: a whole number, 0 (the default) or more.`);
    else {
      const levels = listLevelsOf(file, isText(spellcasting.listId) ? spellcasting.listId.trim() : '', classId);
      if (levels && !levels.has(known.listLevel)) notes.push(`${at}.listLevel ${known.listLevel}: the class's spell list has no spells at that level in this pack, so creation asks for none.`);
    }
  }
  return notes;
}

/**
 * The levels of a class's spell list that hold spells in this pack: its `spellLists` entry's `levels`, and every
 * spell naming the list (or the class) with a level. Null when the pack has none of the list (it may be another
 * pack's, an overlay's base): then nothing is said.
 */
function listLevelsOf(file, listId, classId) {
  const levels = new Set();
  let found = false;
  const list = entriesOf(file, 'spellLists').find((l) => l.id === listId);
  for (const l of (list && Array.isArray(list.levels) ? list.levels : []).filter(isObject)) {
    found = true;
    if (isWhole(l.level) && Array.isArray(l.spells) && l.spells.length > 0) levels.add(l.level);
  }
  for (const spell of entriesOf(file, 'spells')) {
    const on = isObject(spell.lists) ? (spell.lists[listId] ?? spell.lists[classId]) : undefined;
    if (!isWhole(on)) continue;
    found = true;
    levels.add(on);
  }
  return found ? levels : null;
}

/** `progression[].armourClass` and `extra` (G-61); `skills.mode: "points"` (G-66). */
function classNotes(file) {
  const notes = [];
  for (const entry of entriesOf(file, 'classes')) {
    const where = `classes: "${label(entry)}"`;
    if (isObject(entry.spellcasting)) notes.push(...knownNotes(where, entry.spellcasting, file, entry.id));
    for (const row of (Array.isArray(entry.progression) ? entry.progression : []).filter(isObject)) {
      const at = `${where}: level ${row.level ?? '?'}`;
      for (const [old, now] of Object.entries(OLD_PROGRESSION_KEYS)) if (row[old] !== undefined) notes.push(`${at}: ${old} isn't a progression field; write ${now}.`);
      const ac = row.armourClass;
      if (ac !== undefined && !(isWhole(ac) || (isObject(ac) && (isWhole(ac.ac) || isWhole(ac.aac)) && Object.keys(ac).every((k) => ['ac', 'aac'].includes(k))))) {
        notes.push(`${at}: armourClass should be a whole number or { ac, aac } (the unarmoured AC at this level).`);
      }
      if (row.extra !== undefined && !(isObject(row.extra) && Object.values(row.extra).every((v) => isText(v) || typeof v === 'number'))) {
        notes.push(`${at}: extra should map a label to a value, like { "Unarmed damage": "1d4" }.`);
      }
    }
    const skills = entry.skills;
    // What each class skill does (G-210, R3-13): `notes` maps a skill key to its words, keyed like names and byLevel;
    // `note` is the class-wide line. A string `notes` (older packs) is read as the class-wide line.
    if (isObject(skills) && skills.notes !== undefined) {
      const said = skills.notes;
      if (isObject(said)) {
        const keys = new Set([...(isObject(skills.names) ? Object.keys(skills.names) : []), ...(Array.isArray(skills.byLevel) ? skills.byLevel.filter(isObject).flatMap((r) => Object.keys(r).filter((k) => k !== 'level')) : [])]);
        const strays = Object.keys(said).filter((k) => !keys.has(k));
        if (strays.length > 0) notes.push(`${where}: skills.notes names ${list(strays.map((k) => `"${k}"`))}, not a skill in this class's skills.names or skills.byLevel; the sheet shows no words for it.`);
        const wordless = Object.keys(said).filter((k) => typeof said[k] !== 'string');
        if (wordless.length > 0) notes.push(`${where}: skills.notes ${list(wordless.map((k) => `"${k}"`))} should be words (what the skill does).`);
      } else if (typeof said !== 'string') {
        notes.push(`${where}: skills.notes should map a skill key to its words, like { "snare": "Catching small game." } (the class-wide line is skills.note).`);
      }
    }
    if (isObject(skills) && skills.mode !== undefined) {
      if (skills.mode !== 'points') notes.push(`${where}: skills.mode "${skills.mode}" isn't read; the one mode is "points" (leave it out for a by-level table).`);
      else {
        const pool = skills.pool;
        if (!(Array.isArray(pool) && pool.length > 0 && pool.every((r) => isObject(r) && isWhole(r.level) && isWhole(r.points) && r.points >= 0))) notes.push(`${where}: skills.pool should be a list like [{ "level": 1, "points": 4 }].`);
        if (skills.cap !== undefined && !(isWhole(skills.cap) && skills.cap >= 1)) notes.push(`${where}: skills.cap should be a whole number (the most a skill can reach).`);
      }
    }
  }
  return notes;
}

/** `items[].applies` (G-53) and `armour.tier` (G-65). */
function itemNotes(file) {
  const conditions = idsOf(file, 'conditions');
  const armourTypes = new Set(entriesOf(file, 'items').map((i) => i.armourType).filter(isText));
  const notes = [];
  for (const item of entriesOf(file, 'items')) {
    const where = `items: "${label(item)}"`;
    const applies = item.applies;
    if (applies !== undefined) {
      if (!isObject(applies)) notes.push(`${where}: applies should be { conditionId, save, saveMod?, onset?, noticed? }.`);
      else {
        if (!isText(applies.conditionId)) notes.push(`${where}: applies.conditionId should be a condition id.`);
        else if (!conditions.has(applies.conditionId)) notes.push(`${where}: applies.conditionId "${applies.conditionId}" isn't a condition in this pack.`);
        if (!isText(applies.save)) notes.push(`${where}: applies.save should name the save ("poison"); the damage pad shows it.`);
        if (applies.saveMod !== undefined && !isWhole(applies.saveMod)) notes.push(`${where}: applies.saveMod should be a whole number (+6, −2).`);
        for (const key of ['onset', 'noticed'].filter((k) => applies[k] !== undefined && !isText(applies[k]))) notes.push(`${where}: applies.${key} should be words (shown to the GM as text).`);
      }
    }
    const armour = item.armour;
    if (isObject(armour) && armour.tier !== undefined) {
      if (!isText(armour.tier)) notes.push(`${where}: armour.tier should be an armourType id ("leather").`);
      else if (armour.tier === item.armourType) notes.push(`${where}: armour.tier repeats the item's own armourType; tier names the type whose wearers may also wear this.`);
      else if (!armourTypes.has(armour.tier) && !hasRequires(file)) notes.push(`${where}: armour.tier "${armour.tier}" isn't an armourType any item in this pack has (fine if a required pack's is meant).`);
    }
  }
  return notes;
}

/** `conditions[].appliesTo` (G-52): a damaged-item state. */
function conditionNotes(file) {
  return entriesOf(file, 'conditions')
    .filter((c) => c.appliesTo !== undefined && !CONDITION_APPLIES_TO.includes(c.appliesTo))
    .map((c) => `conditions: "${label(c)}": appliesTo "${c.appliesTo}" isn't one of ${list(CONDITION_APPLIES_TO)}.`);
}

/** `statBlocks[].variants` and `parts` (G-60, G-59); the old "Sizes" and "Head hp" fields. */
function statBlockNotes(file) {
  const notes = [];
  for (const block of entriesOf(file, 'statBlocks')) {
    const where = `statBlocks: "${label(block)}"`;
    const fields = isObject(block.fields) ? block.fields : {};
    if (fields.Sizes !== undefined) notes.push(`${where}: a "Sizes" field isn't read; write variants: [{ name, fields, hp?, hpAverage? }], one per size.`);
    if (fields['Head hp'] !== undefined) notes.push(`${where}: a "Head hp" field isn't read; write parts: [{ name, hp, count }].`);
    if (block.variants !== undefined) {
      if (!Array.isArray(block.variants) || block.variants.length === 0) notes.push(`${where}: variants should be a list of { name, fields, hp?, hpAverage? }.`);
      else block.variants.forEach((v, i) => {
        const at = `${where}, variant ${i + 1}`;
        if (!isObject(v) || !isText(v.name)) notes.push(`${at} needs a name ("Small").`);
        if (isObject(v) && v.fields !== undefined && !isObject(v.fields)) notes.push(`${at}: fields should map stat names to values (they override the block's).`);
        if (isObject(v) && v.hp !== undefined && !(isText(v.hp) || isWhole(v.hp))) notes.push(`${at}: hp should be dice text or a whole number.`);
        if (isObject(v) && v.hpAverage !== undefined && !isWhole(v.hpAverage)) notes.push(`${at}: hpAverage should be a whole number.`);
      });
      for (const [key, value] of Object.entries(fields)) {
        if (isText(value) && value.split(' / ').length === block.variants.length && block.variants.length > 1) notes.push(`${where}: field "${key}" still lists one value per size; the variants carry those now.`);
      }
    }
    if (block.parts !== undefined) {
      if (!Array.isArray(block.parts) || block.parts.length === 0) notes.push(`${where}: parts should be a list of { name, hp, count }.`);
      else block.parts.forEach((part, i) => {
        const at = `${where}, part ${i + 1}`;
        if (!isObject(part) || !isText(part.name)) notes.push(`${at} needs a name ("Head").`);
        if (isObject(part) && !(isWhole(part.hp) && part.hp >= 1)) notes.push(`${at}: hp should be a whole number (the part's own pool).`);
        if (isObject(part) && part.count !== undefined && !((isWhole(part.count) && part.count >= 1) || isDice(part.count))) notes.push(`${at}: count should be a whole number or dice ("1d3+2").`);
      });
    }
  }
  return notes;
}

/** The coin keys this file's own rules sets name (`currency[].key`); empty for a pack with none of its own (an adventure). */
function currencyKeys(file) {
  return [...new Set(entriesOf(file, 'rulesSets').flatMap((r) => (Array.isArray(r.currency) ? r.currency : [])).filter((c) => isObject(c) && isText(c.key)).map((c) => c.key.trim()))];
}

/**
 * A treasure entry's coin (pf-24, pf-24a, ruled 2026-11-14; K16a): `coins` is coin to hand out, `{ <coin key>: <whole
 * number, 0 or more> }`; an odd coin word is stored under the coin it is read as, with `coinsReadAs: { printed, note }`.
 * A key is checked against the file's own coins only: an adventure's coins are its setting's, in another pack.
 */
function treasureCoinNotes(where, treasure, coinKeys) {
  if (!Array.isArray(treasure)) return [];
  const notes = [];
  treasure.forEach((entry, i) => {
    if (!isObject(entry)) return;
    const at = `${where}: treasure ${i + 1}`;
    if (entry.coins !== undefined) {
      if (!isObject(entry.coins)) notes.push(`${at}: coins should be { <coin key>: <whole number> } (pf-24).`);
      else
        for (const [key, amount] of Object.entries(entry.coins)) {
          // A stray space is said as that: the app reads a key exactly, so it wouldn't hand that coin out as written.
          if (key !== key.trim() && key.trim() !== '') notes.push(`${at}: coins key "${key}" has spaces around it; write "${key.trim()}" (the app reads the key exactly).`);
          else if (coinKeys.length > 0 && !coinKeys.includes(key)) notes.push(`${at}: coins names "${key}", which isn't one of this setting's coins (${list(coinKeys)}); store the amount under the coin it is read as and say how in coinsReadAs (pf-24a).`);
          // Both at once (rv-3): an unknown key with an odd amount gets its amount note too.
          if (!(isWhole(amount) && amount >= 0)) notes.push(`${at}: coins "${key}" should be a whole number of 0 or more, not ${JSON.stringify(amount)}.`);
        }
    }
    if (entry.coinsReadAs !== undefined) {
      if (entry.coins === undefined) notes.push(`${at}: coinsReadAs without coins: store the amount under the coin it is read as, in coins (pf-24a).`);
      const readAs = isObject(entry.coinsReadAs) ? entry.coinsReadAs : {};
      const missing = ['printed', 'note'].filter((k) => !isText(readAs[k]));
      if (missing.length > 0) notes.push(`${at}: coinsReadAs should be { printed, note }: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing.`);
    }
  });
  return notes;
}

/** Conclusions `noticed` must not draw (07 `noticed`: the senses only, never magic, cursed, enchanted, sentient or +N). */
const NOTICED_LEAKS = /\b(magic(al)?|cursed|enchanted|sentient)\b|\+\s*\d/i;

/**
 * B15 (p2p-28, p2p-29; 07 Adventure packs §2): a hoard's own words (`hoards: [{ name, text }]`, one piece in the book's
 * words for the treasure entries naming that hoard), a treasure entry's `qty` (b15f-1; a whole number of 1 or more), and
 * a magic item's truth (`magicItem: { name, text, noticed?, source? }`, a piece of its own, the GM's until its eye).
 * `noticed` (b15f-2) is the players' to read: the leak check notes one that draws a conclusion or names the item.
 */
function hoardNotes(where, loc) {
  const notes = [];
  const treasure = Array.isArray(loc.treasure) ? loc.treasure : [];
  const named = new Set(treasure.filter((t) => isObject(t) && isText(t.hoard)).map((t) => t.hoard.trim()));
  if (loc.hoards !== undefined) {
    if (!Array.isArray(loc.hoards)) notes.push(`${where}: hoards should be a list of { name, text } (a hoard's own words, p2p-28).`);
    else
      loc.hoards.forEach((hoard, i) => {
        const at = `${where}: hoards ${i + 1}`;
        if (!isObject(hoard) || !isText(hoard.name) || !isText(hoard.text)) notes.push(`${at} should be { name, text }: the hoard's name, as treasure entries name it, and its words as the book prints them.`);
        else if (!named.has(hoard.name.trim())) notes.push(`${at}: no treasure entry here names the hoard "${hoard.name.trim()}", so its words show nowhere.`);
      });
  }
  treasure.forEach((entry, i) => {
    if (!isObject(entry)) return;
    const at = `${where}: treasure ${i + 1}`;
    if (entry.qty !== undefined && !(isWhole(entry.qty) && entry.qty >= 1)) notes.push(`${at}: qty should be a whole number of 1 or more, not ${JSON.stringify(entry.qty)} (it is read as 1).`);
    if (entry.magicItem !== undefined) {
      const magic = isObject(entry.magicItem) ? entry.magicItem : {};
      const missing = ['name', 'text'].filter((k) => !isText(magic[k]));
      if (missing.length > 0) notes.push(`${at}: magicItem should be { name, text, noticed?, source? }: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing, so it makes no piece (p2p-29).`);
      if (magic.source !== undefined && !isText(magic.source)) notes.push(`${at}: magicItem's source should be text.`);
      if (magic.noticed !== undefined && !isText(magic.noticed)) notes.push(`${at}: magicItem's noticed should be text (what the senses tell, b15f-2).`);
      else if (isText(magic.noticed)) {
        const leak = magic.noticed.match(NOTICED_LEAKS)?.[0];
        if (leak) notes.push(`${at}: leak: magicItem's noticed says "${leak.trim()}", a conclusion; say only what the senses tell (07 noticed).`);
        if (isText(magic.name) && magic.noticed.toLowerCase().includes(magic.name.trim().toLowerCase())) notes.push(`${at}: leak: magicItem's noticed names the item ("${magic.name.trim()}"); players read it before the eye.`);
      }
    }
  });
  return notes;
}

/** `locations` in a rules or overlay pack (G-58): a light check on the adventure shape (07 Adventure packs §2). */
function locationNotes(file) {
  if (file.locations === undefined) return [];
  if (!Array.isArray(file.locations)) return ['locations should be a list of places (07 Adventure packs §2).'];
  const tables = idsOf(file, 'tables');
  const coinKeys = currencyKeys(file);
  const ids = new Set();
  const notes = [];
  for (const [i, loc] of file.locations.entries()) {
    if (!isObject(loc)) {
      notes.push(`locations: entry ${i + 1} isn't a place.`);
      continue;
    }
    const where = `locations: "${label(loc)}"`;
    if (!isText(loc.id)) notes.push(`locations: entry ${i + 1} has no id.`);
    else if (ids.has(loc.id)) notes.push(`${where} appears twice.`);
    else ids.add(loc.id);
    if (!isText(loc.name)) notes.push(`${where} has no name.`);
    if (loc.type !== undefined && !LOCATION_TYPES.includes(loc.type)) notes.push(`${where}: type "${loc.type}" isn't one of ${list(LOCATION_TYPES)}.`);
    if (loc.playerView !== undefined && loc.playerView !== null && !isObject(loc.playerView)) notes.push(`${where}: playerView should be { name?, text, people?, exits? } (or null while the place has no player view).`);
    if (isObject(loc.playerView) && loc.playerView.text !== undefined && !isText(loc.playerView.text)) notes.push(`${where}: playerView.text should be words.`);
    if (loc.gm !== undefined && !isObject(loc.gm)) notes.push(`${where}: gm should be { notes, secrets? }.`);
    const check = loc.encounterCheck;
    if (check !== undefined && check !== null) {
      if (!isObject(check)) notes.push(`${where}: encounterCheck should be { every?, chance?, tableId, note? } or null.`);
      else if (isText(check.tableId) && !tables.has(check.tableId)) notes.push(`${where}: encounterCheck.tableId "${check.tableId}" isn't a table in this pack.`);
    }
    if (loc.tables !== undefined) {
      if (!(Array.isArray(loc.tables) && loc.tables.every(isText))) notes.push(`${where}: tables should be a list of table ids.`);
      else for (const id of loc.tables.filter((t) => !tables.has(t))) notes.push(`${where}: tables names "${id}", which isn't a table in this pack.`);
    }
    // "No camp here" (p2p-31; the app reads it from B18): `noCamp: true` on the Location itself.
    if (loc.noCamp !== undefined && typeof loc.noCamp !== 'boolean') notes.push(`${where}: noCamp should be true or false (true marks "no camp here"; 07 Adventure packs §2).`);
    else if (loc.noCamp === true && (loc.type === 'site' || loc.type === 'region')) notes.push(`${where}: noCamp marks this place alone, not the Locations in it: mark each Location where there is no camp.`);
    // "A way out" (p2p-22, p2p-31; the app reads it from B10): `wayOut: true` on the Location itself.
    if (loc.wayOut !== undefined && typeof loc.wayOut !== 'boolean') notes.push(`${where}: wayOut should be true or false (true marks "a way out"; 07 Adventure packs §2).`);
    else if (loc.wayOut === true && (loc.type === 'site' || loc.type === 'region')) notes.push(`${where}: wayOut marks this place alone, not the Locations in it: mark each Location the party can leave from.`);
    notes.push(...treasureCoinNotes(where, loc.treasure, coinKeys));
    notes.push(...hoardNotes(where, loc));
  }
  for (const loc of file.locations.filter(isObject)) {
    if (isText(loc.parentId) && !ids.has(loc.parentId)) notes.push(`locations: "${label(loc)}": parentId "${loc.parentId}" isn't a place in this pack.`);
  }
  return notes;
}

/**
 * An adventure's `routes` (07 Adventure packs §3; December step 4, pt-f1): each { id, from, to, travel, type?, hidden?,
 * oneWay?, notes? }, where `travel` is one amount { value, unit } or a list of ways of moving, each
 * { by, name, value, unit }. The app reads them from December step 4 (src/modules/library/routes.ts).
 */
function routeNotes(file) {
  if (file.routes === undefined) return [];
  if (!Array.isArray(file.routes)) return ['routes should be a list like [{ "id", "from", "to", "travel": { "value", "unit" } }] (07 Adventure packs §3).'];
  const places = idsOf(file, 'locations');
  const ids = new Set();
  const notes = [];
  const amountNote = (where, amount) => {
    if (!isObject(amount)) return `${where} should be { "value": <whole number>, "unit": "<${list(ROUTE_UNITS)}>" }.`;
    if (!(isWhole(amount.value) && amount.value >= 0)) return `${where}: value should be a whole number, 0 or more.`;
    if (!ROUTE_UNITS.includes(amount.unit)) return `${where}: unit should be one of ${list(ROUTE_UNITS)}.`;
    return null;
  };
  for (const [i, route] of file.routes.entries()) {
    if (!isObject(route)) {
      notes.push(`routes: entry ${i + 1} isn't a route.`);
      continue;
    }
    const where = `routes: "${label(route)}"`;
    if (!isText(route.id)) notes.push(`routes: entry ${i + 1} has no id.`);
    else if (ids.has(route.id)) notes.push(`${where} appears twice.`);
    else ids.add(route.id);
    for (const end of ['from', 'to']) {
      if (!isText(route[end])) notes.push(`${where} has no ${end} (a place's id), so the app can't use it.`);
      else if (places.size > 0 && !places.has(route[end]) && !hasRequires(file)) notes.push(`${where}: ${end} "${route[end]}" isn't a place in this pack.`);
    }
    if (route.type !== undefined && !ROUTE_TYPES.includes(route.type)) notes.push(`${where}: type "${route.type}" isn't one of ${list(ROUTE_TYPES)}.`);
    for (const flag of ['hidden', 'oneWay']) if (route[flag] !== undefined && typeof route[flag] !== 'boolean') notes.push(`${where}: ${flag} should be true or false.`);
    if (route.travel === undefined) notes.push(`${where} has no travel, so moving along it takes no time.`);
    else if (Array.isArray(route.travel)) {
      if (route.travel.length === 0) notes.push(`${where}: travel is an empty list; give at least one way of moving.`);
      const ways = new Set();
      for (const [j, way] of route.travel.entries()) {
        const at = `${where}: travel, way ${j + 1}`;
        if (!isObject(way)) {
          notes.push(`${at} should be { "by", "name", "value", "unit" }.`);
          continue;
        }
        if (!isText(way.by)) notes.push(`${at} has no by (a short id like "row"), so the app leaves it out.`);
        else if (ways.has(way.by)) notes.push(`${at}: by "${way.by}" appears twice; the app keeps the first.`);
        else ways.add(way.by);
        if (!isText(way.name)) notes.push(`${at} has no name, so the app shows its id.`);
        const off = amountNote(at, way);
        if (off) notes.push(off);
      }
    } else {
      const off = amountNote(`${where}: travel`, route.travel);
      if (off) notes.push(off);
    }
    notes.push(...barrierNotes(where, route.barrier, places, hasRequires(file)));
  }
  return notes;
}

/**
 * A route's `barrier` (pf-12, pf-12f; "Obstacle" on screen, mc-41): { name?, extraTurns, needsApproval, through?, note }, read by
 * src/modules/library/routes.ts (`readBarrier`). The GM's alone: its note and its need for approval never reach a
 * player (mc-28a).
 */
function barrierNotes(where, barrier, places, requires) {
  if (barrier === undefined || barrier === null) return [];
  const at = `${where}: barrier`;
  if (!isObject(barrier)) return [`${at} should be { "name"?, "extraTurns"?, "needsApproval"?, "through"?, "note" }.`];
  const notes = [];
  // extraTurns and needsApproval are optional (07: missing is 0 and false; review of #755); only a wrong one is named.
  if (barrier.extraTurns !== undefined && !(isWhole(barrier.extraTurns) && barrier.extraTurns >= 0)) notes.push(`${at}: extraTurns should be a whole number, 0 or more; the app leaves the barrier out.`);
  if (barrier.needsApproval !== undefined && typeof barrier.needsApproval !== 'boolean') notes.push(`${at}: needsApproval should be true or false.`);
  if (barrier.through !== undefined) {
    if (!isText(barrier.through)) notes.push(`${at}: through should be a place's id.`);
    else if (places.size > 0 && !places.has(barrier.through) && !requires) notes.push(`${at}: through "${barrier.through}" isn't a place in this pack.`);
  }
  if (!isText(barrier.note)) notes.push(`${at} has no note, so the GM reads nothing about it.`);
  // Its name (pf-12f): its own, else the place it passes, else "Obstacle" alone on screen. A note, not a fault.
  if (barrier.name !== undefined && !isText(barrier.name)) notes.push(`${at}: name should be words.`);
  else if (barrier.name === undefined && !isText(barrier.through)) notes.push(`${at} has no name and no through, so it shows as "Obstacle" alone.`);
  return notes;
}

/** GM reference panels at the pack's top level (G-55): the same shape as on a rules set. */
function topPanelNotes(file) {
  if (file.gmReference === undefined) return [];
  if (!Array.isArray(file.gmReference)) return ['gmReference at the top level should be a list of panels [{ id, title, entries: [{ heading, text, tableId? }] }].'];
  const tables = idsOf(file, 'tables');
  const notes = [];
  for (const [i, panel] of file.gmReference.entries()) {
    const where = `gmReference: ${isObject(panel) && isText(panel.id) ? `"${panel.id}"` : `panel ${i + 1}`}`;
    if (!isObject(panel) || !isText(panel.id) || !isText(panel.title)) {
      notes.push(`${where} needs an id and a title.`);
      continue;
    }
    if (!Array.isArray(panel.entries) || panel.entries.length === 0) notes.push(`${where} has no entries.`);
    else for (const entry of panel.entries) {
      if (!isObject(entry) || !isText(entry.heading) || !isText(entry.text)) notes.push(`${where}: each entry needs a heading and text.`);
      else if (entry.tableId !== undefined && !(isText(entry.tableId) && tables.has(entry.tableId))) notes.push(`${where}, "${entry.heading}": tableId isn't a table in this pack.`);
    }
  }
  return notes;
}

/** `levelZero` (G-50), `materials` (G-51) and `encumbrance.mode: "items"` (G-67) on a rules set. */
function rulesSetNotes(file) {
  const notes = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    const where = `rulesSets: "${label(rules)}"`;
    // An exploration mode's id starting "app:" is the app's own (p2p-6; B8's Departures): the app leaves such a mode out.
    const modes = isObject(rules.exploration) && Array.isArray(rules.exploration.modes) ? rules.exploration.modes.filter(isObject) : [];
    for (const mode of modes) {
      if (isText(mode.id) && mode.id.trim().toLowerCase().startsWith(APP_MODE_PREFIX)) notes.push(`${where}: exploration mode "${mode.id}": ids starting "${APP_MODE_PREFIX}" are the app's own, so the app leaves this mode out. Give it another id.`);
    }
    const zero = rules.levelZero;
    if (zero !== undefined) {
      if (!isObject(zero)) notes.push(`${where}: levelZero should be { hitDie, attack, saves?, note }.`);
      else {
        if (!isDice(zero.hitDie)) notes.push(`${where}: levelZero.hitDie should be dice ("1d4").`);
        if (zero.attack === undefined) notes.push(`${where}: levelZero has no attack (a THAC0 or attack bonus for the classless).`);
        if (zero.note !== undefined && !isText(zero.note)) notes.push(`${where}: levelZero.note should be words.`);
      }
    }
    const materials = rules.materials;
    if (materials !== undefined) {
      if (!Array.isArray(materials)) notes.push(`${where}: materials should be a list of { id, name, costFactor, ac?, attack?, damage?, weightFactor?, onNatural1? }.`);
      else {
        const seen = new Set();
        for (const [i, m] of materials.entries()) {
          const at = `${where}: materials, ${isObject(m) && isText(m.id) ? `"${m.id}"` : `entry ${i + 1}`}`;
          if (!isObject(m) || !isText(m.id) || !isText(m.name)) {
            notes.push(`${at} needs an id and a name.`);
            continue;
          }
          if (seen.has(m.id)) notes.push(`${at} appears twice.`);
          seen.add(m.id);
          if (!(typeof m.costFactor === 'number' && m.costFactor > 0)) notes.push(`${at}: costFactor should be a number above 0 (1 is the usual price).`);
          for (const key of ['ac', 'attack', 'damage'].filter((k) => m[k] !== undefined && !isWhole(m[k]))) notes.push(`${at}: ${key} should be a whole number (+1, −1).`);
          if (m.weightFactor !== undefined && !(typeof m.weightFactor === 'number' && m.weightFactor > 0)) notes.push(`${at}: weightFactor should be a number above 0.`);
          if (m.onNatural1 !== undefined && !ON_NATURAL_1.includes(m.onNatural1)) notes.push(`${at}: onNatural1 "${m.onNatural1}" isn't one of ${list(ON_NATURAL_1)}.`);
        }
      }
    }
    const enc = rules.encumbrance;
    if (isObject(enc) && enc.mode === 'items') {
      const at = `${where}: encumbrance`;
      const bands = enc.bands;
      if (!isObject(bands) || !Array.isArray(bands.equipped) || !Array.isArray(bands.packed)) notes.push(`${at}.bands should be { equipped: [{ max, effect }], packed: [{ max, effect }] } when mode is "items".`);
      else for (const side of ['equipped', 'packed']) {
        const rows = bands[side];
        if (!rows.every((b) => isObject(b) && isWhole(b.max) && isText(b.effect))) notes.push(`${at}.bands.${side} should be a list like [{ "max": 3, "effect": "110' (35')" }].`);
        else if (rows.some((b, i) => i > 0 && b.max <= rows[i - 1].max)) notes.push(`${at}.bands.${side} should go up: each max above the one before.`);
      }
      if (enc.strengthAdjust !== undefined && !isObject(enc.strengthAdjust)) notes.push(`${at}.strengthAdjust should be an object (an option and a note, or the adjustment).`);
    }
  }
  return notes;
}

/** The format notes for the 2026-11-01 additions: a list of plain lines, empty when all is as 07 says. Never throws. */
export function additionNotes(file) {
  if (!isObject(file)) return [];
  return [...metaNotes(file), ...rowTableNotes(file), ...gearAndSpellNotes(file), ...classNotes(file), ...itemNotes(file), ...conditionNotes(file), ...statBlockNotes(file), ...locationNotes(file), ...routeNotes(file), ...topPanelNotes(file), ...rulesSetNotes(file)];
}

/** How many of each addition a pack holds, for the checker's summary (only parts that are there). */
export function additionCounts(file) {
  if (!isObject(file)) return {};
  const counts = {};
  const add = (key, n) => {
    if (n > 0) counts[key] = n;
  };
  const rows = entriesOf(file, 'tables').flatMap((t) => (Array.isArray(t.rows) ? t.rows.filter(isObject) : []));
  add('rows that open a sub-table', rows.filter((r) => r.tableId !== undefined).length);
  const traits = entriesOf(file, 'traitLists').flatMap((t) => (Array.isArray(t.entries) ? t.entries.filter(isObject) : []));
  add('trait-list entries with gear', traits.filter((e) => e.items !== undefined).length);
  add('trait-list entries that change spells', traits.filter((e) => e.spells !== undefined).length);
  const kitLines = [...entriesOf(file, 'startingKits').flatMap((k) => (Array.isArray(k.items) ? k.items : [])), ...traits.flatMap((e) => (Array.isArray(e.items) ? e.items : []))].filter(isObject);
  add('gear lines with rolled quantities', kitLines.filter((l) => isDice(l.qty)).length);
  add('classes with spells known', entriesOf(file, 'classes').filter((c) => isObject(c.spellcasting) && c.spellcasting.known !== undefined).length);
  add('classes with level-scaled features', entriesOf(file, 'classes').filter((c) => Array.isArray(c.progression) && c.progression.some((r) => isObject(r) && (r.armourClass !== undefined || r.extra !== undefined))).length);
  add('classes with point-buy skills', entriesOf(file, 'classes').filter((c) => isObject(c.skills) && c.skills.mode === 'points').length);
  add('items that put on a condition', entriesOf(file, 'items').filter((i) => i.applies !== undefined).length);
  add('armour with a tier', entriesOf(file, 'items').filter((i) => isObject(i.armour) && i.armour.tier !== undefined).length);
  add('damaged-item states', entriesOf(file, 'conditions').filter((c) => c.appliesTo === 'item').length);
  add('stat blocks with variants', entriesOf(file, 'statBlocks').filter((b) => Array.isArray(b.variants)).length);
  add('stat blocks with parts', entriesOf(file, 'statBlocks').filter((b) => Array.isArray(b.parts)).length);
  add('rules sets with level zero', entriesOf(file, 'rulesSets').filter((r) => r.levelZero !== undefined).length);
  add('rules sets with materials', entriesOf(file, 'rulesSets').filter((r) => Array.isArray(r.materials)).length);
  add('rules sets with item-count encumbrance', entriesOf(file, 'rulesSets').filter((r) => isObject(r.encumbrance) && r.encumbrance.mode === 'items').length);
  return counts;
}

/**
 * The editor's strict check on a kit line's quantity ("How many must be a whole number") predates dice quantities
 * (G-57): when every non-whole qty on the kit is dice, that finding is the format's, not a mistake.
 */
export function kitDiceFinding(kit, finding) {
  if (!isObject(kit) || !Array.isArray(kit.items) || !/How many must be a whole number/.test(finding)) return false;
  return kit.items.filter(isObject).every((line) => line.qty === undefined || isWhole(line.qty) || isDice(line.qty));
}

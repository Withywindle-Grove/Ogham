// Format checks for three fields the app now reads (ruled 2026-11-12 and 2026-11-13):
// - a place's rule's `id` (letters and digits joined by single dashes or underscores: the GM's eye is kept under it)
//   and its `gmOnly` (pf-12d; `locations[].rules[]`, the rule shape of pf-12): true or false, and a
//   warning when a rule kept for the GM also carries a `button`; and its `button` (pf-12e): words, or { icon, words? },
//   with a note for an icon the app's set doesn't have;
// - an encounter check's `name` (rp-6; `locations[].encounterCheck.name`): words when given; absent is fine (the app
//   says "Encounter check"); its `none` (G-27, dg-1): a warning when it isn't true, or when a chance, tableId,
//   tableRef, every or byTrack stands beside it;
// - a coin's `unitName` and `pluralName` (pf-17; `rulesSets[].currency[]`): words when given, a warning when one comes
//   without the other (the app uses them only together), and an error for a key listed twice in one list;
// - an item category's `singular` and an item's `looks` (K22, ⚑ 4 and ⚑ 5, 2026-11-22): words when given, else a warning;
// - an item that starts unidentified or cursed whose id shares a word with its true name (2026-11-22): a warning;
// - an item's `charges.unit` and `charges.units` (G-233, dg-5, dg-18): words when given, and a unit that doesn't end in
//   "s" (a plural, or an uncountable word, given as the unit), else a warning;
// - a person's `holds` (G-228, dg-10, dg-15): an item it can't find, a qty that isn't whole and 1 or more, an item held by
//   two people (warnings), and a person with holds whom no place names (a note).
// Each finding has a level, error, warning or note; the checker prints them among its format notes, each starting "Error:",
// "Warning:" or "Note:". An error makes the command exit 1 (check-pack.mjs; the lead's ruling, 2026-11-13); a warning alone
// doesn't. A pack that uses none of the three gets nothing from here.

import { SET_ICON_NAMES } from '../src/ui/iconSet.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file?.[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

// A rule's `button` (pf-12e): words (which may name an icon of the app's set), or `{ icon, words? }` with an icon name
// and, when given, words. Absent or null is no button. An icon the app's set doesn't have is a note: the button then
// shows the generic mark with its words.
function buttonFindings(button, at) {
  if (button === undefined || button === null) return [];
  if (typeof button === 'string') return isText(button) ? [] : [{ level: 'error', text: `${at}: button should be words, or { "icon", "words" } (leave it out for no button).` }];
  if (!isObject(button) || !isText(button.icon)) return [{ level: 'error', text: `${at}: button should be words, or { "icon", "words" } with an icon name from the app's set.` }];
  const found = [];
  if (button.words !== undefined && !isText(button.words)) found.push({ level: 'error', text: `${at}: button.words should be words (leave it out and the rule's name is the button's label).` });
  if (!SET_ICON_NAMES.includes(button.icon)) found.push({ level: 'note', text: `${at}: button.icon "${button.icon}" isn't in the app's icon set (${SET_ICON_NAMES.join(', ')}); the button shows the generic mark with its words.` });
  return found;
}

/** What a check that comes due gives, so a "none" beside it contradicts itself (dg-1). */
const NONE_CONTRADICTS = ['chance', 'tableId', 'tableRef', 'every', 'byTrack'];

function placeFindings(file) {
  const found = [];
  for (const place of entriesOf(file, 'locations')) {
    const where = `locations: "${label(place)}"`;
    for (const rule of Array.isArray(place.rules) ? place.rules.filter(isObject) : []) {
      const at = `${where}, rule "${label(rule)}"`;
      // The GM's eye on a rule is kept under the rule's id, letters and digits joined by single dashes or underscores
      // (place_rule_switches.rule_id, dec-7 piece 3; review of #726): any other id could never be closed to players.
      if (rule.id !== undefined && !(typeof rule.id === 'string' && /^[A-Za-z0-9]+([-_][A-Za-z0-9]+)*$/.test(rule.id) && rule.id.length <= 120)) found.push({ level: 'error', text: `${at}: a rule's id is letters and digits joined by single dashes or underscores, at most 120 long (the GM couldn't close any other to players).` });
      if (rule.gmOnly !== undefined && typeof rule.gmOnly !== 'boolean') found.push({ level: 'error', text: `${at}: gmOnly is true or false (true keeps the rule from the players).` });
      if (rule.gmOnly === true && rule.button != null) found.push({ level: 'warning', text: `${at} is gmOnly but has a button: players would see a button for a rule they may never read.` });
      found.push(...buttonFindings(rule.button, at));
    }
    const check = place.encounterCheck;
    if (isObject(check) && check.name !== undefined && !isText(check.name)) found.push({ level: 'error', text: `${where}: encounterCheck.name should be words; leave it out and the app says "Encounter check".` });
    // A place with no encounters (G-27, dg-1): `"none": true`, with only a `note` and a `name` beside it.
    if (isObject(check) && check.none !== undefined) {
      if (check.none !== true) found.push({ level: 'warning', text: `${where}: encounterCheck.none should be true (leave it out for a check that comes due); the app reads this check as no check at all.` });
      const beside = NONE_CONTRADICTS.filter((key) => check[key] !== undefined && check[key] !== null);
      if (check.none === true && beside.length > 0) found.push({ level: 'warning', text: `${where}: encounterCheck says "none" but also gives ${beside.join(', ')}; a "none" check never comes due, so leave them out (or drop "none").` });
    }
  }
  return found;
}

function coinFindings(file) {
  const found = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    if (!Array.isArray(rules.currency)) continue;
    const where = `rulesSets: "${label(rules)}"`;
    const seen = new Set();
    const twice = new Set();
    for (const coin of rules.currency.filter(isObject)) {
      const name = isText(coin.key) ? coin.key : label(coin);
      const at = `${where}: currency "${name}"`;
      if (isText(coin.key)) {
        if (seen.has(coin.key)) twice.add(coin.key);
        seen.add(coin.key);
      }
      const shown = isText(coin.label) ? coin.label : name;
      const unit = coin.unitName !== undefined;
      const plural = coin.pluralName !== undefined;
      if (unit && !isText(coin.unitName)) found.push({ level: 'error', text: `${at}: unitName should be words (the name for one of "${shown}").` });
      if (plural && !isText(coin.pluralName)) found.push({ level: 'error', text: `${at}: pluralName should be words (the name for more than one of "${shown}").` });
      if (unit !== plural) {
        const [has, lacks] = unit ? ['a unitName', 'pluralName'] : ['a pluralName', 'unitName'];
        found.push({ level: 'warning', text: `${at} has ${has} and no ${lacks}; the app uses them only together, so it prints the label "${shown}" for every amount.` });
      }
    }
    for (const key of twice) found.push({ level: 'error', text: `${where}: currency lists the key "${key}" more than once; a purse keeps one amount per key.` });
  }
  return found;
}

// K22 (Francis, 2026-11-22, ⚑ 4 and ⚑ 5 of docs/plans/k22-reveal.md): an item category's `singular` (what an
// unidentified item of it reads as when it has no appearsAs) and an item's `looks` (the look line players see), each
// words when given. Absent is fine: the category's name as given, and no look line.
function unidentifiedFindings(file) {
  const found = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    for (const category of Array.isArray(rules.itemCategories) ? rules.itemCategories.filter(isObject) : []) {
      if (category.singular !== undefined && !isText(category.singular)) {
        found.push({ level: 'warning', text: `rulesSets: "${label(rules)}": itemCategories "${label(category)}": singular should be words (one of the category, "Ring"); without it an unidentified item reads as the category's name.` });
      }
    }
  }
  // An entry that starts unidentified (its category is marked so in this file) or cursed reaches a player's device by
  // its id (Francis, 2026-11-22, "A", on finding 2 of the review of #40): the id must not hint at its truth. Warned when
  // the id shares a word of three letters or more with its true name, common words aside, and words its face shows
  // anyway aside (its category's id, name and singular, its appearsAs): "ring-07" for a ring is fine.
  const categories = entriesOf(file, 'rulesSets').flatMap((rules) => (Array.isArray(rules.itemCategories) ? rules.itemCategories.filter(isObject) : []));
  const unidentified = new Set(categories.filter((c) => c.unidentified === true && isText(c.id)).map((c) => c.id));
  const faceWords = (item) =>
    hintWords(
      [item.category, item.appearsAs, ...categories.filter((c) => c.id === item.category).flatMap((c) => [c.name, c.singular])]
        .filter(isText)
        .join(' '),
    );
  const negative = (block) => isObject(block) && typeof block.magicBonus === 'number' && block.magicBonus < 0;
  for (const item of entriesOf(file, 'items')) {
    if (item.looks !== undefined && !isText(item.looks)) {
      found.push({ level: 'warning', text: `items: "${label(item)}": looks should be words (what players see of it, "A plain band of old bronze."); it is left out.` });
    }
    const hidden = (isText(item.category) && unidentified.has(item.category)) || item.cursed === true || negative(item.weapon) || negative(item.armour);
    if (!hidden || !isText(item.id) || !isText(item.name)) continue;
    const shown = faceWords(item);
    const shared = [...hintWords(item.id)].filter((word) => hintWords(item.name).has(word) && !shown.has(word));
    if (shared.length > 0) {
      found.push({ level: 'warning', text: `items: "${item.id}" starts unidentified or cursed, and its id shares "${shared.join('", "')}" with its true name; players' devices get the id, so give it one that hints at nothing ("ring-07").` });
    }
  }
  return found;
}

// G-233 (dg-5, dg-18, dgb-3): an item's `charges.unit` ("portion") and `units` ("portions") name what its count counts.
// Each must be words (letters, with spaces, hyphens or apostrophes between them), as the app reads them
// (src/core/chargeUnit.ts); a unit ending in "s" is warned on, since it is likely a plural or a word like "oil" that isn't
// counted. The checker can't know every uncountable word: 07 says the rest (a unit is a countable word).
const UNIT_WORDS = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;
function chargeUnitFindings(file) {
  const found = [];
  for (const item of entriesOf(file, 'items')) {
    if (!isObject(item.charges)) continue;
    const { unit, units } = item.charges;
    const at = `items: "${label(item)}": charges`;
    const words = (value) => typeof value === 'string' && UNIT_WORDS.test(value.trim());
    if (unit !== undefined && !words(unit)) {
      found.push({ level: 'warning', text: `${at}: unit should be one countable word ("portion"); the app says "charges" instead.` });
    } else if (unit !== undefined && /s$/i.test(unit.trim())) {
      found.push({ level: 'warning', text: `${at}: unit "${unit.trim()}" ends in "s"; give the word for one ("portion", not "portions"), and a countable word ("flask", not "oil").` });
    }
    if (units !== undefined && !words(units)) {
      found.push({ level: 'warning', text: `${at}: units should be words ("portions"); the app says the unit plus "s" instead.` });
    }
    if (units !== undefined && unit === undefined) {
      found.push({ level: 'warning', text: `${at}: units comes without a unit; the app reads units only with a unit, so it says "charges".` });
    }
  }
  return found;
}

// G-228 (dg-10, dg-15; #192): what a person carries, `npcs[].holds`, each line one item (`itemId` in this pack, or
// `itemRef` "<pack>:<item id>"), `qty` a whole number of 1 or more (1 if left out) and the book's `note`. Warnings: an
// item this pack doesn't have (an itemRef to another pack is checked only with that pack given too, `holdsRefNotes`), a
// line naming no item, a qty that isn't whole and 1 or more, holds that isn't a list, an item held by two people (a held
// thing has one home). A note: a person with holds whom no place's `playerView.people` names (the app shows her nowhere).
const MISSING_SEEN = 'the GM sees "One thing she carries isn’t in your packs."';
/** A line's item as `{ pack, id, ref }` (pack null: this pack's itemId), or null when it names none. */
function heldItemOf(line) {
  if (!isObject(line)) return null;
  if (isText(line.itemId)) return { pack: null, id: line.itemId.trim(), ref: line.itemId.trim() };
  if (!isText(line.itemRef)) return null;
  const ref = line.itemRef.trim();
  const at = ref.indexOf(':');
  return at < 0 ? { pack: null, id: ref, ref } : { pack: ref.slice(0, at).trim(), id: ref.slice(at + 1).trim(), ref };
}
const itemIdsOf = (file) => new Set(entriesOf(file, 'items').flatMap((item) => (isText(item.id) ? [item.id.trim()] : [])));

function holdsFindings(file) {
  const found = [];
  const own = isText(file.meta?.id) ? file.meta.id.trim() : null;
  const items = itemIdsOf(file);
  const named = new Set(entriesOf(file, 'locations').flatMap((place) => (isObject(place.playerView) && Array.isArray(place.playerView.people) ? place.playerView.people.filter(isObject).map((p) => p.npcId) : [])).filter(isText).map((id) => id.trim()));
  const holder = new Map();
  for (const person of entriesOf(file, 'npcs')) {
    if (person.holds === undefined) continue;
    const at = `npcs: "${label(person)}"`;
    if (!Array.isArray(person.holds)) {
      found.push({ level: 'warning', text: `${at}: holds should be a list of lines ({ "itemId": … }); the app reads none.` });
      continue;
    }
    person.holds.forEach((line, i) => {
      const item = heldItemOf(line);
      if (!item) return found.push({ level: 'warning', text: `${at}: holds line ${i + 1} names no item; give its itemId (this pack) or itemRef ("<pack>:<item id>").` });
      const ours = item.pack === null || item.pack === own;
      if (ours && !items.has(item.id)) found.push({ level: 'warning', text: `${at}: holds line ${i + 1} names "${item.ref}", which isn’t an item in this pack; ${MISSING_SEEN}` });
      if (line.qty !== undefined && !(Number.isInteger(line.qty) && line.qty >= 1)) found.push({ level: 'warning', text: `${at}: holds line ${i + 1}: qty should be a whole number of 1 or more; the app reads 1.` });
      const key = `${ours ? '' : item.pack}:${item.id}`;
      const first = holder.get(key);
      if (first !== undefined && first !== label(person)) found.push({ level: 'warning', text: `${at}: holds "${item.ref}", which "${first}" holds too; a held thing has one home, so list it on one person.` });
      else holder.set(key, label(person));
    });
    if (person.holds.length > 0 && !(isText(person.id) && named.has(person.id.trim()))) {
      found.push({ level: 'note', text: `${at} holds things, but no place’s playerView.people names this person, so the app shows them nowhere yet; the GM can use Add item.` });
    }
  }
  return found;
}

/**
 * Across the files given together (`[{ name, file }]`): each `holds` itemRef naming another of them by its meta id, checked
 * against that pack's items. An itemRef to a pack not given is left alone (checked alone, it can't be seen).
 */
export function holdsRefNotes(packs) {
  const byId = new Map(packs.flatMap((p) => (isText(p.file?.meta?.id) ? [[p.file.meta.id.trim(), p]] : [])));
  const notes = [];
  for (const p of packs) {
    const own = isText(p.file?.meta?.id) ? p.file.meta.id.trim() : null;
    for (const person of entriesOf(p.file, 'npcs')) {
      if (!Array.isArray(person.holds)) continue;
      person.holds.forEach((line, i) => {
        const item = heldItemOf(line);
        const other = item && item.pack !== null && item.pack !== own ? byId.get(item.pack) : undefined;
        if (other && !itemIdsOf(other.file).has(item.id)) notes.push(`${p.name}, npcs: "${label(person)}": holds line ${i + 1} names "${item.ref}", which isn’t an item in ${other.name}; ${MISSING_SEEN}`);
      });
    }
  }
  return notes;
}

/** Common words that hint at nothing, whatever the item. */
const COMMON_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'onto', 'its', 'his', 'her', 'their', 'that', 'this', 'not']);

/**
 * The words of an id or a name, lower case: three letters or more, common words aside. Each word is taken both split at
 * its apostrophes (’ or ') and hyphens and with them folded away (#176), so "Warden’s" gives "warden" and "wardens",
 * and "Bog-warden’s" also "bogwardens": an id spelling either way is caught.
 */
function hintWords(text) {
  const lower = text.toLowerCase();
  const split = lower.split(/[^\p{L}\p{N}]+/u);
  const folded = lower.replace(/[’'-]+/gu, '').split(/[^\p{L}\p{N}]+/u);
  return new Set([...split, ...folded].filter((word) => word.length >= 3 && !COMMON_WORDS.has(word)));
}

/** Every finding on the ruled fields, `{ level: 'error' | 'warning' | 'note', text }`, in file order. Never throws. */
export function ruledFieldFindings(file) {
  if (!isObject(file)) return [];
  return [...placeFindings(file), ...coinFindings(file), ...unidentifiedFindings(file), ...chargeUnitFindings(file), ...holdsFindings(file)];
}

/** The findings as the checker's format notes, each starting with its level ("Error: …", "Warning: …"). */
export function ruledFieldNotes(file) {
  return ruledFieldFindings(file).map((f) => `${f.level === 'error' ? 'Error' : f.level === 'note' ? 'Note' : 'Warning'}: ${f.text}`);
}

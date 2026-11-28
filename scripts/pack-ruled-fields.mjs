// Format checks for three fields the app now reads (ruled 2026-11-12 and 2026-11-13):
// - a place's rule's `id` (letters and digits joined by single dashes or underscores: the GM's eye is kept under it)
//   and its `gmOnly` (pf-12d; `locations[].rules[]`, the rule shape of pf-12): true or false, and a
//   warning when a rule kept for the GM also carries a `button`; and its `button` (pf-12e): words, or { icon, words? },
//   with a note for an icon the app's set doesn't have;
// - an encounter check's `name` (rp-6; `locations[].encounterCheck.name`): words when given; absent is fine (the app
//   says "Encounter check");
// - a coin's `unitName` and `pluralName` (pf-17; `rulesSets[].currency[]`): words when given, a warning when one comes
//   without the other (the app uses them only together), and an error for a key listed twice in one list;
// - an item category's `singular` and an item's `looks` (K22, ⚑ 4 and ⚑ 5, 2026-11-22): words when given, else a warning;
// - an item that starts unidentified or cursed whose id shares a word with its true name (2026-11-22): a warning.
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
  return [...placeFindings(file), ...coinFindings(file), ...unidentifiedFindings(file)];
}

/** The findings as the checker's format notes, each starting with its level ("Error: …", "Warning: …"). */
export function ruledFieldNotes(file) {
  return ruledFieldFindings(file).map((f) => `${f.level === 'error' ? 'Error' : f.level === 'note' ? 'Note' : 'Warning'}: ${f.text}`);
}

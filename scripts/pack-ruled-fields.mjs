// Format checks for three fields the app now reads (ruled 2026-11-12 and 2026-11-13):
// - a place's rule's `id` (letters and digits joined by single dashes or underscores: the GM's eye is kept under it)
//   and its `gmOnly` (pf-12d; `locations[].rules[]`, the rule shape of pf-12): true or false, and a
//   warning when a rule kept for the GM also carries a `button`; and its `button` (pf-12e): words, or { icon, words? },
//   with a note for an icon the app's set doesn't have;
// - an encounter check's `name` (rp-6; `locations[].encounterCheck.name`): words when given; absent is fine (the app
//   says "Encounter check");
// - a coin's `unitName` and `pluralName` (pf-17; `rulesSets[].currency[]`): words when given, a warning when one comes
//   without the other (the app uses them only together), and an error for a key listed twice in one list.
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

/** Every finding on the three fields, `{ level: 'error' | 'warning' | 'note', text }`, in file order. Never throws. */
export function ruledFieldFindings(file) {
  if (!isObject(file)) return [];
  return [...placeFindings(file), ...coinFindings(file)];
}

/** The findings as the checker's format notes, each starting with its level ("Error: …", "Warning: …"). */
export function ruledFieldNotes(file) {
  return ruledFieldFindings(file).map((f) => `${f.level === 'error' ? 'Error' : f.level === 'note' ? 'Note' : 'Warning'}: ${f.text}`);
}

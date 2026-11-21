// The pack checker's format checks for creation rules as data (docs/07, "Creation rules as data"; ruled 2026-11-01,
// design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-19 … cr-24). Guided creation can enforce only what a pack
// says as data: the Scores step needs `scores`, Adjust scores needs `abilityAdjustment` as an object, the Languages
// step needs a `languages` list and a numeric `extraLanguages` column, derived sheet fields need `fill`, and the
// entry pop-up reads abilities' `kind`. These checks say, in plain lines, whether a pack writes them the way 07 says.
// Nothing here blocks an import: the importer keeps the fields, the app reads them from m5b-0c.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-creation.test.mjs with invented packs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isWhole = (value) => Number.isInteger(value);
const isDice = (value) => isText(value) && /^\d*d\d+(?:\s*[+−-]\s*\d+)?$/.test(value.trim());
const list = (values) => values.join(', ');
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
const idsOf = (file, part) => new Set(entriesOf(file, part).map((e) => e.id).filter(isText));

/** Whether the pack names other packs it needs: then an id this file doesn't have may be one of theirs. */
const hasRequires = (file) => isObject(file.meta) && Array.isArray(file.meta.requires) && file.meta.requires.length > 0;

/** Who sees a character's alignment (cr-22, 03). */
export const ALIGNMENT_VISIBILITY = ['owner', 'all'];

/** What an ability is for the entry pop-up's headings (cr-24). */
export const ABILITY_KINDS = ['advantage', 'disadvantage'];

/** The usual names of sheet fields the rules work out; without `fill`, creation asks for them by hand (cr-23). */
export const DERIVED_FIELDS = [
  { name: 'AC', test: /^(ac|aac|armou?r ?class)$/i },
  { name: 'movement', test: /^(mv|movement|speed|move)$/i },
  { name: 'attack', test: /^(attack|thac0|attack ?bonus|to ?hit)$/i },
  { name: 'saves', test: /^save/i },
  { name: 'title', test: /^(title|level ?title)$/i },
  { name: 'literacy', test: /^literacy$/i },
  { name: 'skills', test: /^skill/i },
];

/** The ability keys a rules set names (`abilities: [{ key }]` or plain keys); empty when it has none. */
function abilityKeys(rules) {
  if (!Array.isArray(rules.abilities)) return [];
  return rules.abilities.map((a) => (isObject(a) ? a.key : a)).filter(isText);
}

function keyListNotes(at, value, keys) {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isText)) return [`${at} should be a list of ability keys.`];
  if (keys.length === 0) return [];
  const unknown = value.filter((k) => !keys.includes(k));
  return unknown.length > 0 ? [`${at} names ${list(unknown.map((k) => `"${k}"`))}, not among the rules set's abilities (${list(keys)}).`] : [];
}

function scoresNotes(where, rules, file) {
  const scores = rules.scores;
  if (scores === undefined) {
    // An overlay (one that requires a base pack) adds classes to a rules set the base already completes.
    return entriesOf(file, 'classes').length > 0 && !hasRequires(file) ? [`${where}: no scores block ({ dice, min, max, startOver? }); the Scores step needs one (07, Creation rules as data).`] : [];
  }
  if (!isObject(scores)) return [`${where}: scores should be { dice, min, max, startOver? }.`];
  const notes = [];
  if (!isDice(scores.dice)) notes.push(`${where}: scores.dice should be dice ("3d6").`);
  if (!isWhole(scores.min) || !isWhole(scores.max) || scores.min > scores.max) notes.push(`${where}: scores.min and max should be whole numbers, min no more than max.`);
  const over = scores.startOver;
  if (over !== undefined) {
    if (!isObject(over)) notes.push(`${where}: scores.startOver should be { everyAtMost?, countAtMost?: { count, value }, option?, note }.`);
    else {
      if (over.everyAtMost === undefined && over.countAtMost === undefined) notes.push(`${where}: scores.startOver needs everyAtMost or countAtMost to say when it triggers.`);
      if (over.everyAtMost !== undefined && !isWhole(over.everyAtMost)) notes.push(`${where}: scores.startOver.everyAtMost should be a whole number.`);
      if (over.countAtMost !== undefined && !(isObject(over.countAtMost) && isWhole(over.countAtMost.count) && isWhole(over.countAtMost.value))) {
        notes.push(`${where}: scores.startOver.countAtMost should be { count, value } (whole numbers: "two or more at 6 or less").`);
      }
      if (over.option !== undefined) {
        if (!isText(over.option)) notes.push(`${where}: scores.startOver.option should be an option id.`);
        else if (!idsOf(file, 'options').has(over.option) && !hasRequires(file)) notes.push(`${where}: scores.startOver.option "${over.option}" isn't an option of this pack.`);
      }
      if (over.note !== undefined && !isText(over.note)) notes.push(`${where}: scores.startOver.note should be words.`);
    }
  }
  return notes;
}

function adjustmentNotes(where, rules, file) {
  const adj = rules.abilityAdjustment;
  if (adj === undefined) return [];
  if (isText(adj)) return [`${where}: abilityAdjustment is words, so creation has no Adjust scores step; write { lowerBy, raiseBy, lowerable, raise, floor, cap?, classExceptions?, note } for one.`];
  if (!isObject(adj)) return [`${where}: abilityAdjustment should be words (reference only) or { lowerBy, raiseBy, lowerable, raise, floor, cap?, classExceptions?, note }.`];
  const notes = [];
  const keys = abilityKeys(rules);
  for (const key of ['lowerBy', 'raiseBy'].filter((k) => !(isWhole(adj[k]) && adj[k] >= 1))) notes.push(`${where}: abilityAdjustment.${key} should be a whole number of 1 or more.`);
  if (adj.lowerable !== 'nonPrime') notes.push(...keyListNotes(`${where}: abilityAdjustment.lowerable`, adj.lowerable, keys).map((n) => n.replace('should be a list of ability keys.', 'should be "nonPrime" or a list of ability keys.')));
  if (adj.raise !== 'prime') notes.push(...keyListNotes(`${where}: abilityAdjustment.raise`, adj.raise, keys).map((n) => n.replace('should be a list of ability keys.', 'should be "prime" or a list of ability keys.')));
  if (!isWhole(adj.floor)) notes.push(`${where}: abilityAdjustment.floor should be a whole number (the lowest a score may be lowered to).`);
  if (adj.cap !== undefined && !(isWhole(adj.cap) && (!isWhole(adj.floor) || adj.cap >= adj.floor))) notes.push(`${where}: abilityAdjustment.cap should be a whole number, no less than floor.`);
  if (adj.classExceptions !== undefined) {
    if (!Array.isArray(adj.classExceptions)) notes.push(`${where}: abilityAdjustment.classExceptions should be a list of { classId, cannotLower }.`);
    else {
      const classIds = idsOf(file, 'classes');
      for (const [i, x] of adj.classExceptions.entries()) {
        const at = `${where}: abilityAdjustment.classExceptions, entry ${i + 1}`;
        if (!isObject(x) || !isText(x.classId)) notes.push(`${at} needs a classId.`);
        else if (!classIds.has(x.classId) && !hasRequires(file)) notes.push(`${at}: class "${x.classId}" isn't in this pack.`);
        if (isObject(x)) notes.push(...keyListNotes(`${at}: cannotLower`, x.cannotLower, keys));
      }
    }
  }
  if (adj.note !== undefined && !isText(adj.note)) notes.push(`${where}: abilityAdjustment.note should be words.`);
  return notes;
}

/** The languages a race or class names should be ids of the rules set's list; a bare name is matched by name with a note. */
function languageIdNotes(file, lang) {
  const notes = [];
  if (!isObject(lang) || !Array.isArray(lang.list)) return notes;
  const ids = new Set(lang.list.filter(isObject).map((l) => l.id).filter(isText));
  const byName = new Map(lang.list.filter(isObject).filter((l) => isText(l.name) && isText(l.id)).map((l) => [l.name.trim().toLowerCase(), l.id]));
  for (const part of ['races', 'classes']) {
    for (const entry of entriesOf(file, part)) {
      if (!Array.isArray(entry.languages)) continue;
      for (const l of entry.languages) {
        if (!isText(l)) notes.push(`${part}: "${label(entry)}": languages should be a list of ids from the rules set's languages list.`);
        else if (ids.has(l)) continue;
        // An overlay's languages merge into its base's (cs-6, G-93): an id may be the required pack's.
        else if (hasRequires(file)) continue;
        else if (byName.has(l.trim().toLowerCase())) notes.push(`${part}: "${label(entry)}": languages names "${l}" by name; write its id ("${byName.get(l.trim().toLowerCase())}").`);
        else notes.push(`${part}: "${label(entry)}": languages names "${l}", which isn't in the rules set's languages list.`);
      }
    }
  }
  return notes;
}

function languagesNotes(where, rules, file) {
  const lang = rules.languages;
  const named = [...entriesOf(file, 'races'), ...entriesOf(file, 'classes')].some((e) => Array.isArray(e.languages) && e.languages.length > 0);
  if (lang === undefined) return named && !hasRequires(file) ? [`${where}: no languages section ({ common, alignment, list, extraFrom }); races and classes name languages the Languages step can't find.`] : [];
  if (!isObject(lang)) return [`${where}: languages should be { common: [ids], alignment: true | false, list: [{ id, name, blurb?, note?, source? }], extraFrom: "INT" }.`];
  const notes = [];
  if (!Array.isArray(lang.list)) {
    const old = ['learnable', 'obscure', 'unlearnable'].filter((k) => lang[k] !== undefined);
    notes.push(`${where}: languages.list is missing${old.length > 0 ? ` (${list(old)} aren't read)` : ''}; write list: [{ id, name, blurb?, note? }].`);
  } else {
    const seen = new Set();
    for (const [i, l] of lang.list.entries()) {
      const at = `${where}: languages.list, ${isObject(l) && isText(l.id) ? `"${l.id}"` : `entry ${i + 1}`}`;
      if (!isObject(l) || !isText(l.id) || !isText(l.name)) {
        notes.push(`${at} needs an id and a name.`);
        continue;
      }
      if (seen.has(l.id)) notes.push(`${at} appears twice.`);
      seen.add(l.id);
      for (const key of ['blurb', 'note', 'source'].filter((k) => l[k] !== undefined && !isText(l[k]))) notes.push(`${at}: ${key} should be words.`);
      // cs-6 (G-90): a range on the extra-languages die, and who may learn it (creature types; soft = the GM's leave).
      if (l.roll !== undefined && !(isObject(l.roll) && isText(l.roll.die) && Number.isInteger(l.roll.min) && (l.roll.max === undefined || (Number.isInteger(l.roll.max) && l.roll.max >= l.roll.min)))) notes.push(`${at}: roll should be { die: "d6", min, max } with whole numbers.`);
      const by = l.learnableBy;
      if (by !== undefined && !(Array.isArray(by) ? by.every(isText) : isObject(by) && Array.isArray(by.types) && by.types.every(isText) && (by.soft === undefined || typeof by.soft === 'boolean'))) notes.push(`${at}: learnableBy should be a list of creature types (["mortal"]), or { types: [...], soft: true } for "with the GM's leave".`);
      else if (by !== undefined && (Array.isArray(by) ? by.length === 0 : by.types.length === 0 && by.soft !== true)) notes.push(`${at}: learnableBy names no creature type, so it limits nothing; name the types, or write { types: [], soft: true } for "only with the GM's leave".`);
    }
    for (const c of (Array.isArray(lang.common) ? lang.common : []).filter((c) => isText(c) && !seen.has(c))) notes.push(`${where}: languages.common names "${c}", which isn't in languages.list.`);
  }
  // An overlay's list merges into its base's (cs-6, G-93): it may leave `common` to the base.
  const overlay = hasRequires(file) && lang.common === undefined;
  if (!overlay && (!Array.isArray(lang.common) || !lang.common.every(isText))) notes.push(`${where}: languages.common should be a list of ids everyone starts with (["common"]).`);
  if (lang.alignment !== undefined && typeof lang.alignment !== 'boolean') notes.push(`${where}: languages.alignment should be true or false (whether alignment tongues exist).`);
  const keys = abilityKeys(rules);
  if (lang.extraFrom !== undefined && !(isText(lang.extraFrom) && (keys.length === 0 || keys.includes(lang.extraFrom)))) {
    notes.push(`${where}: languages.extraFrom should be one of the rules set's ability keys${keys.length > 0 ? ` (${list(keys)})` : ''}.`);
  }
  return [...notes, ...languageIdNotes(file, lang)];
}

/** The ability modifier table's `extraLanguages` column is a whole number; "Native + 1" in a `languages` column is the old way. */
function extraLanguagesNotes(where, rules) {
  const key = isObject(rules.languages) && isText(rules.languages.extraFrom) ? rules.languages.extraFrom : 'INT';
  const rows = isObject(rules.abilityModifiers) && Array.isArray(rules.abilityModifiers[key]) ? rules.abilityModifiers[key].filter(isObject) : [];
  const notes = [];
  const oldWay = rows.filter((r) => r.extraLanguages === undefined && isText(r.languages));
  if (oldWay.length > 0) {
    notes.push(`${where}: abilityModifiers.${key}: ${oldWay.length === 1 ? 'row' : 'rows'} ${list(oldWay.map((r) => `"${r.range ?? '?'}"`))} say languages in words ("${oldWay[0].languages}"), the old way; write extraLanguages as a whole number.`);
  }
  for (const r of rows.filter((r) => r.extraLanguages !== undefined && !isWhole(r.extraLanguages))) {
    notes.push(`${where}: abilityModifiers.${key} row "${r.range ?? '?'}": extraLanguages should be a whole number.`);
  }
  return notes;
}

/** A modifier column's words as the app shows them before a text value: "openDoors" → "open doors" (columnWords, creationSteps.ts). */
const columnWords = (column) => (column.toLowerCase() === 'ac' ? 'AC' : column.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase());

/**
 * A text cell in the ability modifier table that repeats its own column's name (gate walk 2026-11-05): the app shows
 * a text value after the column's words ("open doors 2-in-6"), so a cell that says "open doors 2-in-6" reads
 * "open doors open doors 2-in-6" on the score tile. The cell should hold the value alone.
 */
function modifierColumnRepeatNotes(where, rules) {
  const table = isObject(rules.abilityModifiers) ? rules.abilityModifiers : {};
  const notes = [];
  for (const [key, rows] of Object.entries(table)) {
    if (!Array.isArray(rows)) continue;
    const repeats = new Map();
    for (const row of rows.filter(isObject)) {
      for (const [column, value] of Object.entries(row)) {
        if (column === 'range' || !isText(value)) continue;
        const words = columnWords(column).toLowerCase();
        if (value.toLowerCase().replace(/\s+/g, ' ').includes(words)) repeats.set(column, [...(repeats.get(column) ?? []), row]);
      }
    }
    for (const [column, hit] of repeats) {
      notes.push(`${where}: abilityModifiers.${key}, column "${column}": ${hit.length === 1 ? 'row' : 'rows'} ${list(hit.map((r) => `"${r.range ?? '?'}"`))} repeat the column's name ("${hit[0][column]}"); the app puts "${columnWords(column)}" before the value, so write the value alone ("2-in-6", not "${columnWords(column)} 2-in-6").`);
    }
  }
  return notes;
}

/**
 * `abilityModifierColumns: { <column>: "value" }` (Design's shape, 2026-11-05): the abilityModifiers columns a book
 * prints as plain figures (shown "loyalty 7", no sign); every other column is a modifier ("+1 melee"). Names a kind
 * that isn't "value" or "modifier", and a column no row of the rules set's table has.
 */
function modifierColumnsNotes(where, rules) {
  const marks = rules.abilityModifierColumns;
  if (marks === undefined) return [];
  if (!isObject(marks)) return [`${where}: abilityModifierColumns should be { <column>: "value" } (the columns printed as plain figures).`];
  const table = isObject(rules.abilityModifiers) ? rules.abilityModifiers : {};
  const columns = new Set(Object.values(table).filter(Array.isArray).flatMap((rows) => rows.filter(isObject).flatMap((r) => Object.keys(r))));
  const notes = [];
  for (const [column, kind] of Object.entries(marks)) {
    if (kind !== 'value' && kind !== 'modifier') notes.push(`${where}: abilityModifierColumns "${column}" is "${kind}"; write "value" (a plain figure) or leave the column out (a modifier).`);
    if (!columns.has(column)) notes.push(`${where}: abilityModifierColumns names "${column}", which no row of abilityModifiers has; it changes nothing.`);
  }
  return notes;
}

/**
 * `alignmentBlurbs: { <alignment>: "one line" }` (Design's shape, 2026-11-05): each alignment row's one line on Who
 * they are, beside `alignmentNotes`' full text for its entry. Names a blurb that isn't text, and one keyed by a name
 * that isn't among the setting's alignments (the rules sets' `alignments` or a sheet field's alignment choices).
 */
function alignmentBlurbsNotes(where, rules, file) {
  const blurbs = rules.alignmentBlurbs;
  if (blurbs === undefined) return [];
  if (!isObject(blurbs)) return [`${where}: alignmentBlurbs should be { <alignment>: "one line" }.`];
  const names = new Set([
    ...entriesOf(file, 'rulesSets').flatMap((r) => (Array.isArray(r.alignments) ? r.alignments.filter(isText) : [])),
    ...entriesOf(file, 'fieldTemplates').flatMap((t) => (Array.isArray(t.fields) ? t.fields.filter((f) => isObject(f) && /align/i.test(String(f.key ?? '')) && Array.isArray(f.choices)).flatMap((f) => f.choices.filter(isText)) : [])),
  ]);
  const notes = [];
  for (const [name, line] of Object.entries(blurbs)) {
    if (!isText(line)) notes.push(`${where}: alignmentBlurbs "${name}" should be one line of text.`);
    if (names.size > 0 && !names.has(name)) notes.push(`${where}: alignmentBlurbs names "${name}", which isn't one of the setting's alignments (${list([...names])}); its row won't show it.`);
  }
  return notes;
}

function kindNotes(file) {
  const notes = [];
  for (const part of ['classes', 'races']) {
    for (const entry of entriesOf(file, part)) {
      if (!Array.isArray(entry.abilities)) continue;
      for (const a of entry.abilities.filter(isObject)) {
        if (a.kind !== undefined && !ABILITY_KINDS.includes(a.kind)) notes.push(`${part}: "${label(entry)}", ability "${a.name ?? '?'}": kind "${a.kind}" isn't one of ${list(ABILITY_KINDS)}.`);
      }
    }
  }
  return notes;
}

const PRIME_XP_SHAPES = '{ "type": "standard" } or { "type": "rules", "rules": [{ "all" | "any": { "<ABILITY>": <min> }, "bonus": <n> }] }';

/**
 * Prime XP in the packs' shape (rc-1, docs/07 classes): a class's `primeXp` is `standard` (the rules set's
 * `primeRequisiteXp` rows `[{ range, xp }]`) or `rules` thresholds; `primeRequisiteRule` is "lowest". The app's old
 * `{ any | all: [{ min, bonus }] }` shape gets a line saying what to write instead.
 */
function primeXpNotes(file) {
  const notes = [];
  const rulesSets = entriesOf(file, 'rulesSets');
  for (const rules of rulesSets) {
    const where = `rulesSets: "${label(rules)}"`;
    if (rules.primeRequisiteRule !== undefined && rules.primeRequisiteRule !== 'lowest') {
      notes.push(`${where}: primeRequisiteRule should be "lowest" (the lowest prime decides); other values, words included, aren't read (keep the book's words in a note).`);
    }
    if (rules.primeRequisiteXp === undefined) continue;
    if (!Array.isArray(rules.primeRequisiteXp)) notes.push(`${where}: primeRequisiteXp should be a list of { range, xp } rows.`);
    else rules.primeRequisiteXp.forEach((row, i) => {
      if (!isObject(row) || !isText(row.range) || !isWhole(row.xp)) notes.push(`${where}: primeRequisiteXp[${i}] should be { range, xp } (a range such as "13-15" and a whole-number XP percentage).`);
    });
  }
  const hasTable = rulesSets.some((r) => Array.isArray(r.primeRequisiteXp));
  for (const klass of entriesOf(file, 'classes')) {
    if (klass.primeXp === undefined) continue;
    const where = `classes: "${label(klass)}"`;
    const p = klass.primeXp;
    if (Array.isArray(p) || (isObject(p) && p.type === undefined && (p.any !== undefined || p.all !== undefined))) {
      notes.push(`${where}: primeXp is the old shape; write ${PRIME_XP_SHAPES}.`);
    } else if (!isObject(p) || (p.type !== 'standard' && p.type !== 'rules')) {
      notes.push(`${where}: primeXp.type "${isObject(p) ? p.type : p}" isn't "standard" or "rules"; write ${PRIME_XP_SHAPES}.`);
    } else if (p.type === 'standard') {
      if (!hasTable && !hasRequires(file)) notes.push(`${where}: primeXp "standard" reads the rules set's primeRequisiteXp, and no rules set here has one.`);
    } else {
      const rules = Array.isArray(p.rules) ? p.rules : [];
      if (rules.length === 0) notes.push(`${where}: primeXp "rules" needs a rules list.`);
      rules.forEach((rule, i) => {
        const thresholds = isObject(rule) ? (rule.all ?? rule.any) : undefined;
        const ok = isObject(thresholds) && Object.keys(thresholds).length > 0 && Object.values(thresholds).every(isWhole) && isWhole(rule.bonus);
        if (!ok) notes.push(`${where}: primeXp.rules[${i}] should be { "all" | "any": { "<ABILITY>": <min> }, "bonus": <n> }.`);
      });
    }
  }
  return notes;
}

/**
 * Fields the rules usually work out, left without `fill`: creation will ask for them by hand (cr-23). And a field's
 * `atCreation` (ruled B 2026-11-03): `false` when creation never asks it; anything but true or false is noted.
 */
function fillNotes(file) {
  const notes = [];
  for (const template of entriesOf(file, 'fieldTemplates')) {
    const where = `fieldTemplates: "${label(template)}"`;
    for (const f of (Array.isArray(template.fields) ? template.fields : []).filter(isObject)) {
      if (f.atCreation !== undefined && typeof f.atCreation !== 'boolean') notes.push(`${where}: field "${f.label ?? f.key}": atCreation should be true or false (false: creation never asks it; it stays on the sheet).`);
      if (f.fill !== undefined || f.atCreation === false) continue;
      const names = [f.key, f.label].filter(isText);
      const derived = DERIVED_FIELDS.find((d) => names.some((n) => d.test.test(n.trim())));
      if (derived) notes.push(`${where}: field "${f.label ?? f.key}" (${derived.name}) has no fill; creation will ask for it by hand. Write fill: "<what works it out>" if the rules do.`);
    }
  }
  return notes;
}

/** `hitPoints { startMinimum?, minimumPerDie?, reroll?: { atMost, option?, note? } }` (cf-1, cf-2); the rest is reference text. */
function hitPointsNotes(where, block, file) {
  if (block === undefined) return [];
  if (!isObject(block)) return [`${where}: hitPoints should be { startMinimum?, minimumPerDie?, reroll? } (more keys are kept as reference text).`];
  const notes = [];
  for (const key of ['startMinimum', 'minimumPerDie'].filter((k) => block[k] !== undefined && !(isWhole(block[k]) && block[k] >= 0))) {
    notes.push(`${where}: hitPoints.${key} should be a whole number (0 or more).`);
  }
  const reroll = block.reroll;
  if (reroll !== undefined) {
    if (!isObject(reroll)) notes.push(`${where}: hitPoints.reroll should be { atMost, option?, note? }.`);
    else {
      if (!(isWhole(reroll.atMost) && reroll.atMost >= 1)) notes.push(`${where}: hitPoints.reroll.atMost should be a whole number of 1 or more (the die roll that offers Roll again).`);
      if (reroll.option !== undefined) {
        if (!isText(reroll.option)) notes.push(`${where}: hitPoints.reroll.option should be an option id.`);
        else if (!idsOf(file, 'options').has(reroll.option) && !hasRequires(file)) notes.push(`${where}: hitPoints.reroll.option "${reroll.option}" isn't an option of this pack.`);
      }
      if (reroll.note !== undefined && !isText(reroll.note)) notes.push(`${where}: hitPoints.reroll.note should be words.`);
    }
  }
  return notes;
}

/**
 * `startingGear { shop? }` and `startingEquipment` (cf-4; item ids, or lines `{ itemId, qty?, units? }` and picks
 * `{ pick: { tableId, upTo } }`, cs-6 and of-11); either may sit in a `byOption` override.
 */
function startingGearNotes(where, rules, file) {
  const notes = [];
  const gear = rules.startingGear;
  if (gear !== undefined) {
    if (!isObject(gear)) notes.push(`${where}: startingGear should be { shop: false } (or left out).`);
    else if (gear.shop !== undefined && typeof gear.shop !== 'boolean') notes.push(`${where}: startingGear.shop should be true or false.`);
  }
  const given = rules.startingEquipment;
  if (given !== undefined) {
    const isPick = (l) => isObject(l) && isObject(l.pick);
    const isLine = (l) => isText(l) || (isObject(l) && (isText(l.itemId) || isText(l.name)) && (l.qty === undefined || (Number.isInteger(l.qty) && l.qty >= 1)) && (l.units === undefined || (Number.isInteger(l.units) && l.units >= 1)));
    if (!Array.isArray(given) || !given.every((l) => isLine(l) || isPick(l))) notes.push(`${where}: startingEquipment should be a list of item ids or { itemId, qty?, units? } lines (a pick is { pick: { tableId, upTo } }).`);
    else {
      const items = idsOf(file, 'items');
      const tables = idsOf(file, 'tables');
      const ids = given.flatMap((l) => (isText(l) ? [l] : isObject(l) && isText(l.itemId) ? [l.itemId] : []));
      const unknown = [...new Set(ids.filter((id) => !items.has(id)))];
      if (unknown.length > 0 && !hasRequires(file)) notes.push(`${where}: startingEquipment names ${list(unknown.map((id) => `"${id}"`))}, not among this pack's items.`);
      for (const l of given.filter((l) => isObject(l) && !isText(l.itemId) && isText(l.name))) notes.push(`${where}: startingEquipment's "${l.name}" is a one-off by name (no weight or price); give an itemId if the pack has the item.`);
      for (const { pick } of given.filter(isPick)) {
        if (!isText(pick.tableId) || !Number.isInteger(pick.upTo) || pick.upTo < 1) notes.push(`${where}: a startingEquipment pick should be { tableId, upTo } with upTo a whole number of 1 or more.`);
        else if (!tables.has(pick.tableId) && !hasRequires(file)) notes.push(`${where}: startingEquipment's pick names table "${pick.tableId}", not among this pack's tables.`);
        else {
          const table = entriesOf(file, 'tables').find((t) => t.id === pick.tableId);
          if (table && table.gmOnly !== false) notes.push(`${where}: startingEquipment's pick table "${pick.tableId}" isn't one players can read; write "gmOnly": false on it so the Gear step can show it.`);
          if (table && !(Array.isArray(table.rows) && table.rows.some((r) => isObject(r) && Array.isArray(r.items) && r.items.length > 0))) notes.push(`${where}: startingEquipment's pick table "${pick.tableId}" has no row with items ([{ itemId, qty }]); the Gear step reads only those.`);
        }
      }
    }
  }
  return notes;
}

/** A score range the app reads ("7", "7-10", "13–15", "18+", "6 or lower", "16 or more"), as fills.ts inRange does. */
const isScoreRange = (value) =>
  isWhole(value) || (isText(value) && /^(\d+(\s*[-–]\s*\d+)?|\d+\+|\d+\s+or\s+(lower|less|below|under|higher|more|above|over))$/i.test(value.trim()));

/** The save keys the rules sets name (`saveCategories` as a list of { key | id } or a table); empty when none do. */
function saveKeys(file) {
  return entriesOf(file, 'rulesSets').flatMap((r) =>
    Array.isArray(r.saveCategories) ? r.saveCategories.filter(isObject).map((c) => c.key ?? c.id).filter(isText) : isObject(r.saveCategories) ? Object.keys(r.saveCategories) : [],
  );
}

/**
 * Races' fields the app reads beside the class limits (07 Races; the creation surveys' follow-up, 2026-11-03):
 * `saveBonusByCon` {saves, byCon [{con, bonus}]}, `optionalAbilities` {whenOption, abilityModifiers?, abilities?},
 * `skillTargets` (a number, or {value, when}) and `magicResistance` (a number a rules set's save modifier reads).
 */
function raceShapeNotes(file) {
  const notes = [];
  const options = entriesOf(file, 'options');
  const abilities = entriesOf(file, 'rulesSets').flatMap(abilityKeys);
  const saves = saveKeys(file);
  const plusRaceFields = new Set(
    entriesOf(file, 'rulesSets').flatMap((r) => (Array.isArray(r.saveModifiers) ? r.saveModifiers.filter(isObject) : [])).flatMap((m) => (isObject(m.value) ? [m.value.plusRaceField, m.value.raceField] : [])).filter(isText),
  );
  for (const race of entriesOf(file, 'races')) {
    const where = `races: "${label(race)}"`;
    const bonus = race.saveBonusByCon;
    if (bonus !== undefined) {
      if (!isObject(bonus) || !Array.isArray(bonus.saves) || !Array.isArray(bonus.byCon)) notes.push(`${where}: saveBonusByCon should be { saves: [save keys], byCon: [{ con, bonus }] }.`);
      else {
        if (!bonus.saves.every(isText)) notes.push(`${where}: saveBonusByCon.saves should be save keys ("D", or "D(poison)" for the bonus against poison only).`);
        else if (saves.length > 0) {
          const unknown = bonus.saves.map((s) => s.replace(/\(.*\)\s*$/, '').trim()).filter((k) => !saves.includes(k));
          if (unknown.length > 0) notes.push(`${where}: saveBonusByCon.saves names ${list([...new Set(unknown)].map((k) => `"${k}"`))}, not among the rules sets' saveCategories (${list(saves)}).`);
        }
        for (const row of bonus.byCon) {
          if (!isObject(row) || !isScoreRange(row.con) || !isWhole(row.bonus)) notes.push(`${where}: saveBonusByCon.byCon row ${JSON.stringify(row)} should be { con: a score range ("7-10", "6 or lower", "18"), bonus: a whole number }.`);
        }
        if (abilities.length > 0 && !abilities.includes('CON')) notes.push(`${where}: saveBonusByCon reads the CON score, and the rules sets have no CON ability (${list(abilities)}); the bonus won't show.`);
      }
    }
    const optional = race.optionalAbilities;
    if (optional !== undefined) {
      if (!isObject(optional) || !isText(optional.whenOption)) notes.push(`${where}: optionalAbilities should be { whenOption: "<option id>=<choice id>", abilityModifiers?, abilities? }.`);
      else {
        const [optionId, choiceId] = optional.whenOption.trim().replace('=', ':').split(':').map((p) => p.trim());
        const option = options.find((o) => o.id === optionId);
        if (!option) {
          if (!hasRequires(file)) notes.push(`${where}: optionalAbilities.whenOption names "${optionId}", not an option of this pack; they'll never apply.`);
        } else if (choiceId && Array.isArray(option.choices) && !option.choices.some((c) => isObject(c) && c.id === choiceId)) {
          notes.push(`${where}: optionalAbilities.whenOption names choice "${choiceId}", not a choice of option "${optionId}"; they'll never apply.`);
        }
        if (optional.abilityModifiers !== undefined && (!isObject(optional.abilityModifiers) || !Object.values(optional.abilityModifiers).every(isWhole))) {
          notes.push(`${where}: optionalAbilities.abilityModifiers should be { <ability key>: a whole number }.`);
        }
        if (optional.abilities !== undefined && (!Array.isArray(optional.abilities) || !optional.abilities.every((a) => isObject(a) && isText(a.name)))) {
          notes.push(`${where}: optionalAbilities.abilities should be a list of { name, note? }.`);
        }
      }
    }
    if (race.skillTargets !== undefined) {
      if (!isObject(race.skillTargets)) notes.push(`${where}: skillTargets should be { <skill id>: a number, or { value, when } }.`);
      else {
        for (const [id, target] of Object.entries(race.skillTargets)) {
          if (isWhole(target)) continue;
          if (isObject(target) && isWhole(target.value) && isText(target.when)) continue;
          notes.push(`${where}: skillTargets "${id}" should be a whole number, or { value: a whole number, when: "the situation" }.`);
        }
      }
    }
    if (race.magicResistance !== undefined) {
      if (!isWhole(race.magicResistance)) notes.push(`${where}: magicResistance should be a whole number.`);
      else if (entriesOf(file, 'rulesSets').length > 0 && !plusRaceFields.has('magicResistance')) {
        notes.push(`${where}: magicResistance is read through a rules set's saveModifiers (value.plusRaceField "magicResistance"), and none names it; it won't show.`);
      }
    }
  }
  return notes;
}

/**
 * The armour states an AC bonus's `when` names, or null when it isn't about armour (the same reading as
 * src/modules/characters/bonuses.ts readArmourWhen; keep the two in step).
 */
function armourWhen(when) {
  const parts = when
    .toLowerCase()
    .replace(/[.;]/g, ' ')
    .split(/,|\bor\b/)
    .map((p) => p.replace(/\b(when|while|if|in|wearing|only|is|are)\b/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.every((p) => /^(unarmou?red|no armou?r|not armou?red|without armou?r)$/.test(p) || /^(light|medium|heavy)( armou?r)?$/.test(p)) ? parts : null;
}

/**
 * The kindred's and class's own bonuses (cs-7, 07 the survey's fields): `acBonus` a whole number or { value, when? }
 * (a `when` the app can't read as armour is counted at the table, not in AC); a class's progression `acBonus` by
 * level; `saveBonus` a whole number, { bonus, vs?, saves? } or a list of them (shown beside the saves).
 */
function bonusNotes(file) {
  const notes = [];
  const saves = saveKeys(file);
  const entries = [...entriesOf(file, 'races').map((e) => ['races', e]), ...entriesOf(file, 'classes').map((e) => ['classes', e])];
  for (const [kind, entry] of entries) {
    const where = `${kind}: "${label(entry)}"`;
    const ac = entry.acBonus;
    if (ac !== undefined && !isWhole(ac)) {
      if (!isObject(ac) || !isWhole(ac.value) || (ac.when !== undefined && !isText(ac.when))) notes.push(`${where}: acBonus should be a whole number, or { value: a whole number, when?: "unarmoured or light armour" }.`);
      else if (isText(ac.when) && armourWhen(ac.when) === null) notes.push(`${where}: acBonus when "${ac.when}" isn't about armour (unarmoured, light, medium or heavy armour), so it's named in AC's breakdown and counted at the table, not in AC.`);
    }
    if (kind === 'classes' && Array.isArray(entry.progression)) {
      const bad = entry.progression.filter((r) => isObject(r) && r.acBonus !== undefined && !isWhole(r.acBonus));
      if (bad.length > 0) notes.push(`${where}: progression acBonus should be a whole number (level ${list(bad.map((r) => String(r.level)))}).`);
    }
    if (entry.saveBonus !== undefined) {
      const list_ = Array.isArray(entry.saveBonus) ? entry.saveBonus : [entry.saveBonus];
      for (const b of list_) {
        if (isWhole(b)) continue;
        const amount = isObject(b) ? (b.bonus ?? b.value) : undefined;
        if (!isObject(b) || !isWhole(amount) || (b.vs !== undefined && !isText(b.vs)) || (b.saves !== undefined && (!Array.isArray(b.saves) || !b.saves.every(isText)))) {
          notes.push(`${where}: saveBonus ${JSON.stringify(b)} should be a whole number, or { bonus: a whole number, vs?: "what it's against", saves?: [save keys] }.`);
          continue;
        }
        const unknown = Array.isArray(b.saves) && saves.length > 0 ? b.saves.filter((k) => !saves.includes(k.trim())) : [];
        if (unknown.length > 0) notes.push(`${where}: saveBonus.saves names ${list(unknown.map((k) => `"${k}"`))}, not among the rules sets' saveCategories (${list(saves)}).`);
      }
    }
  }
  return notes;
}

/** The rules set and each `byOption` override, for the shapes an option may change. */
const withOverrides = (where, rules) => [
  { at: where, part: rules },
  ...(isObject(rules.byOption) ? Object.entries(rules.byOption).filter(([, o]) => isObject(o)).map(([key, o]) => ({ at: `${where}, byOption "${key}"`, part: o })) : []),
];

/** The format notes for creation rules as data: plain lines, empty when all is as 07 says. Never throws. */
export function creationNotes(file) {
  if (!isObject(file)) return [];
  const notes = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    const where = `rulesSets: "${label(rules)}"`;
    notes.push(...scoresNotes(where, rules, file), ...adjustmentNotes(where, rules, file), ...languagesNotes(where, rules, file), ...extraLanguagesNotes(where, rules), ...modifierColumnRepeatNotes(where, rules), ...modifierColumnsNotes(where, rules), ...alignmentBlurbsNotes(where, rules, file));
    for (const { at, part } of withOverrides(where, rules)) notes.push(...hitPointsNotes(at, part.hitPoints, file), ...startingGearNotes(at, part, file));
    // How many kits a character may take (Design, 2026-11-07, final drafts D): a positive whole number; absent, 1.
    const kitsPick = isObject(rules.creation) && isObject(rules.creation.kits) ? rules.creation.kits.pick : undefined;
    if (kitsPick !== undefined && !(Number.isInteger(kitsPick) && kitsPick > 0)) {
      notes.push(`${where}: creation.kits.pick should be a positive whole number (how many kits a character may take); the app reads 1.`);
    }
    if (rules.alignmentVisibility !== undefined && !ALIGNMENT_VISIBILITY.includes(rules.alignmentVisibility)) {
      notes.push(`${where}: alignmentVisibility "${rules.alignmentVisibility}" isn't one of ${list(ALIGNMENT_VISIBILITY)}.`);
    }
  }
  return [...notes, ...kindNotes(file), ...primeXpNotes(file), ...fillNotes(file), ...raceShapeNotes(file), ...bonusNotes(file)];
}

/** How many of the creation shapes a pack holds, for the checker's summary (only parts that are there). */
export function creationCounts(file) {
  if (!isObject(file)) return {};
  const counts = {};
  const add = (key, n) => {
    if (n > 0) counts[key] = n;
  };
  const rules = entriesOf(file, 'rulesSets');
  add('rules sets with scores', rules.filter((r) => isObject(r.scores)).length);
  add('rules sets with ability adjustment as data', rules.filter((r) => isObject(r.abilityAdjustment)).length);
  add('rules sets with a languages list', rules.filter((r) => isObject(r.languages) && Array.isArray(r.languages.list)).length);
  const anyWay = (r, test) => withOverrides('', r).some(({ part }) => test(part));
  add('rules sets with a hit-points re-roll', rules.filter((r) => anyWay(r, (p) => isObject(p.hitPoints) && isObject(p.hitPoints.reroll))).length);
  add('rules sets with starting equipment', rules.filter((r) => anyWay(r, (p) => Array.isArray(p.startingEquipment) && p.startingEquipment.length > 0)).length);
  add('rules sets without a shop (some or all of the time)', rules.filter((r) => anyWay(r, (p) => isObject(p.startingGear) && p.startingGear.shop === false)).length);
  add('rules sets hiding alignment', rules.filter((r) => r.alignmentVisibility === 'owner').length);
  const abilities = [...entriesOf(file, 'classes'), ...entriesOf(file, 'races')].flatMap((e) => (Array.isArray(e.abilities) ? e.abilities.filter(isObject) : []));
  const races = entriesOf(file, 'races');
  add('races with a save bonus by CON', races.filter((r) => isObject(r.saveBonusByCon)).length);
  add('races with optional abilities behind an option', races.filter((r) => isObject(r.optionalAbilities)).length);
  add('races with a skill target in a situation', races.filter((r) => isObject(r.skillTargets) && Object.values(r.skillTargets).some(isObject)).length);
  add('abilities tagged disadvantage', abilities.filter((a) => a.kind === 'disadvantage').length);
  add('sheet fields with fill', entriesOf(file, 'fieldTemplates').flatMap((t) => (Array.isArray(t.fields) ? t.fields.filter(isObject) : [])).filter((f) => f.fill !== undefined).length);
  return counts;
}

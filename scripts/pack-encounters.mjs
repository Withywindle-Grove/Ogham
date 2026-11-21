// The pack checker's format checks for the encounter and fight fields ruled 2026-10-29 (docs/07, "Encounters and
// fights"): the rules set's pursuit, death's structured helped (and healed, stabilised), morale triggers' events
// (leaderDown and employerDown among them), reaction-table rows' meaning, and grantsTempHp on spells, class and
// race abilities and items. Like pack-format.mjs, it only says in plain lines whether a pack writes these the way 07
// says, and names the new shape when a pack writes an old one. Nothing blocks an import.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-encounters.test.mjs with invented packs.

/** The rules set's `pursuit` keys (07): all text. */
export const PURSUIT_KEYS = ['note', 'evade', 'drop', 'source'];

/** Morale trigger events (07, `morale.triggers`; leaderDown and employerDown added 2026-10-29). */
export const MORALE_EVENTS = ['firstDeath', 'halfDown', 'firstWound', 'hpAtOrBelow', 'leaderDown', 'employerDown'];

/** Morale trigger scopes. */
export const MORALE_SCOPES = ['group', 'alone'];

/** The parts of `death` a helped shape can sit on (07): `helped`, and `healed` and `stabilised` where the rule offers them. */
const HELP_KEYS = ['helped', 'healed', 'stabilised'];

/** The table use that marks a reaction table (07, table uses registry). */
export const REACTION_USE = 'encounters.reaction';

/** One short line: past this many words, the checker says so (the same aim as a blurb). */
const LINE_MAX_WORDS = 14;

/** Dice as packs write them ("1d6", "d6", "2d4+1"). */
const DICE = /^\d*d\d+([+-]\d+)?$/i;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isWhole = (value) => Number.isInteger(value);
const isDice = (value) => isText(value) && DICE.test(value.trim());
const list = (values) => values.join(', ');
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** `pursuit`: { note, evade?, drop?, source? }, all text; the GM reads it and taps Got away or Caught. */
function pursuitNotes(where, pursuit) {
  if (pursuit === undefined) return [];
  const at = `${where}: pursuit`;
  if (typeof pursuit === 'string') return [`${at} is plain text; write { "note": "…" } (and evade, drop for the evasion and dropping rules).`];
  if (!isObject(pursuit)) return [`${at} should be { note, evade?, drop?, source? }.`];
  const notes = [];
  if (pursuit.note === undefined) notes.push(`${at} has no note; the Escape step would show Got away and Caught with no rule.`);
  for (const key of PURSUIT_KEYS) if (pursuit[key] !== undefined && !isText(pursuit[key])) notes.push(`${at}.${key} should be words.`);
  for (const key of Object.keys(pursuit).filter((k) => !PURSUIT_KEYS.includes(k))) notes.push(`${at}.${key} isn't read; pursuit takes ${list(PURSUIT_KEYS)} (all text).`);
  return notes;
}

/**
 * One structured help (`helped`, `healed`, `stabilised`): text, or { wake: { roll, unit } } or
 * { hp, abilityLoss: { roll, enter: true } }, each with an optional note. `abilityLoss.pick` is the old way.
 */
function helpNotes(at, help) {
  if (help === undefined || isText(help)) return [];
  const shape = '{ "wake": { "roll": "<dice>", "unit": "<unit>" } } or { "hp": <whole number>, "abilityLoss": { "roll": "<dice>", "enter": true } }';
  if (!isObject(help)) return [`${at} should be text, or ${shape}.`];
  const notes = [];
  if (help.note !== undefined && !isText(help.note)) notes.push(`${at}.note should be words.`);
  const hasWake = help.wake !== undefined;
  const hasHp = help.hp !== undefined || help.abilityLoss !== undefined;
  if (!hasWake && !hasHp) return [...notes, `${at} should be text, or ${shape}.`];
  if (hasWake && hasHp) notes.push(`${at} has both wake and hp; give one shape.`);
  if (hasWake && !(isObject(help.wake) && isDice(help.wake.roll) && isText(help.wake.unit))) {
    notes.push(`${at}.wake should be { "roll": "<dice>", "unit": "<unit>" } (a wake-up timer from a roll the GM enters).`);
  }
  if (help.hp !== undefined && !(isWhole(help.hp) && help.hp >= 0)) notes.push(`${at}.hp should be a whole number (the HP restored).`);
  const loss = help.abilityLoss;
  if (loss !== undefined) {
    if (!isObject(loss)) notes.push(`${at}.abilityLoss should be { "roll": "<dice>", "enter": true }.`);
    else {
      if (loss.pick !== undefined) notes.push(`${at}.abilityLoss.pick is the old way (the loss is rolled, not chosen); write { "roll": "<dice>", "enter": true }.`);
      if (!isDice(loss.roll)) notes.push(`${at}.abilityLoss.roll should be dice like "1d3" (rolled at the table).`);
      if (loss.enter !== true) notes.push(`${at}.abilityLoss.enter should be true (the result is entered).`);
    }
  }
  return notes;
}

/** `death`'s helps, on its own dying rule and on each byOption change of it. */
function deathNotes(where, death) {
  if (!isObject(death)) return [];
  const notes = [];
  const dyings = [[`${where}: death.dying`, death.dying]];
  if (isObject(death.byOption)) {
    for (const [key, change] of Object.entries(death.byOption)) if (isObject(change)) dyings.push([`${where}: death.byOption "${key}" dying`, change.dying]);
  }
  for (const [at, dying] of dyings) {
    if (!isObject(dying)) continue;
    for (const key of HELP_KEYS) notes.push(...helpNotes(`${at}.${key}`, dying[key]));
  }
  return notes;
}

/** `morale.triggers`: [{ id, event, scope, name, fraction? }]; the app has no triggers of its own. */
function moraleNotes(where, morale) {
  if (!isObject(morale) || morale.triggers === undefined) return [];
  if (!Array.isArray(morale.triggers)) return [`${where}: morale.triggers should be a list like [{ "id": "…", "event": "firstDeath", "scope": "group", "name": "…" }].`];
  const notes = [];
  const seen = new Set();
  for (const [i, trigger] of morale.triggers.entries()) {
    const at = `${where}: morale trigger ${isObject(trigger) && isText(trigger.id) ? `"${trigger.id}"` : `#${i + 1}`}`;
    if (!isObject(trigger)) {
      notes.push(`${at} should be { id, event, scope, name }.`);
      continue;
    }
    if (!isText(trigger.id)) notes.push(`${at} has no id.`);
    else if (seen.has(trigger.id)) notes.push(`${at} appears twice.`);
    else seen.add(trigger.id);
    if (!isText(trigger.name)) notes.push(`${at} has no name (the line the GM sees).`);
    if (!MORALE_EVENTS.includes(trigger.event)) notes.push(`${at}: event "${trigger.event ?? ''}" isn't one of ${list(MORALE_EVENTS)}; it would never prompt.`);
    if (trigger.scope !== undefined && !MORALE_SCOPES.includes(trigger.scope)) notes.push(`${at}: scope "${trigger.scope}" isn't one of ${list(MORALE_SCOPES)}.`);
    if (trigger.event === 'hpAtOrBelow' && !(typeof trigger.fraction === 'number' && trigger.fraction > 0 && trigger.fraction <= 1)) {
      notes.push(`${at}: hpAtOrBelow needs a fraction from 0 to 1 (0.5 is half).`);
    }
  }
  return notes;
}

/** A table's uses: `uses` (a list, or one string), or the older `use`. */
const usesOf = (table) => {
  const uses = table.uses ?? table.use;
  return typeof uses === 'string' ? [uses] : Array.isArray(uses) ? uses.filter(isText) : [];
};

/** Reaction tables' rows may carry `meaning`: one short line. Elsewhere it isn't read. */
function reactionNotes(file) {
  const notes = [];
  for (const table of entriesOf(file, 'tables')) {
    const rows = Array.isArray(table.rows) ? table.rows.filter(isObject) : [];
    const withMeaning = rows.filter((r) => r.meaning !== undefined);
    if (withMeaning.length === 0) continue;
    const where = `tables: "${label(table)}"`;
    if (!usesOf(table).includes(REACTION_USE)) {
      notes.push(`${where}: rows carry meaning, which is only read on a reaction table; add "${REACTION_USE}" to its uses if it is one.`);
      continue;
    }
    for (const row of withMeaning) {
      const at = `${where}, row ${row.min ?? row.key ?? '?'}${row.max !== undefined && row.max !== row.min ? `–${row.max}` : ''}`;
      if (!isText(row.meaning)) notes.push(`${at}: meaning should be one line of words.`);
      else if (/\n/.test(row.meaning)) notes.push(`${at}: meaning should be one line.`);
      else if (words(row.meaning) > LINE_MAX_WORDS) notes.push(`${at}: meaning has ${words(row.meaning)} words; one short line is the aim.`);
    }
  }
  return notes;
}

/** `grantsTempHp`: { dice | formula, duration } on spells, class and race abilities, and items. */
function tempHpNotes(where, grant) {
  if (grant === undefined) return [];
  const shape = '{ "dice": "1d6", "duration": "…" } or { "formula": "…", "duration": "…" }';
  if (!isObject(grant)) return [`${where}: grantsTempHp should be ${shape}.`];
  const notes = [];
  const hasDice = grant.dice !== undefined;
  const hasFormula = grant.formula !== undefined;
  if (hasDice === hasFormula) notes.push(`${where}: grantsTempHp needs dice or a formula (one of them).`);
  if (hasDice && !isDice(grant.dice)) notes.push(`${where}: grantsTempHp.dice should be dice like "1d6".`);
  if (hasFormula && !isText(grant.formula)) notes.push(`${where}: grantsTempHp.formula should be a formula ("level").`);
  if (!isText(grant.duration)) notes.push(`${where}: grantsTempHp has no duration; the bonus HP would have no timer.`);
  return notes;
}

function tempHpAll(file) {
  const notes = [];
  for (const part of ['spells', 'items']) for (const entry of entriesOf(file, part)) notes.push(...tempHpNotes(`${part}: "${label(entry)}"`, entry.grantsTempHp));
  for (const part of ['classes', 'races']) {
    for (const entry of entriesOf(file, part)) {
      for (const ability of (Array.isArray(entry.abilities) ? entry.abilities : []).filter(isObject)) {
        notes.push(...tempHpNotes(`${part}: "${label(entry)}", ability "${ability.name ?? ability.id ?? '?'}"`, ability.grantsTempHp));
      }
    }
  }
  return notes;
}

/** Everything this file checks, for a parsed pack. Never throws on odd input. */
export function encounterNotes(file) {
  if (!isObject(file)) return [];
  const notes = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    const where = `rulesSets: "${label(rules)}"`;
    notes.push(...pursuitNotes(where, rules.pursuit), ...deathNotes(where, rules.death), ...moraleNotes(where, rules.morale));
  }
  return [...notes, ...reactionNotes(file), ...tempHpAll(file)];
}

/** Counts for the checker's summary. */
export function encounterCounts(file) {
  if (!isObject(file)) return {};
  const rulesSets = entriesOf(file, 'rulesSets');
  const abilities = [...entriesOf(file, 'classes'), ...entriesOf(file, 'races')].flatMap((e) => (Array.isArray(e.abilities) ? e.abilities.filter(isObject) : []));
  return {
    'rules sets with pursuit': rulesSets.filter((r) => r.pursuit !== undefined).length,
    'morale triggers': rulesSets.reduce((n, r) => n + (isObject(r.morale) && Array.isArray(r.morale.triggers) ? r.morale.triggers.length : 0), 0),
    'reaction tables': entriesOf(file, 'tables').filter((t) => usesOf(t).includes(REACTION_USE)).length,
    'entries granting temporary HP': [...entriesOf(file, 'spells'), ...entriesOf(file, 'items'), ...abilities].filter((e) => e.grantsTempHp !== undefined).length,
  };
}

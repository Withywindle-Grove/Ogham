// The pack checker's format checks for fields and kinds that docs/07 defines but the app doesn't read yet
// (M7 and M7b, ruled 2026-10-28; docs/07, "Characters, XP and spells"). The app's importer (src/modules/library)
// is left as it is: these checks only say, in plain lines, whether a pack writes the new parts the way 07 says,
// so a converter can fix a pack before the milestone that reads it lands. Nothing here blocks an import.
//
// Used by scripts/check-pack.mjs; tested in scripts/pack-format.test.mjs with invented packs.
//
// Also the fields ruled 2026-10-29 (docs/design/rulings/rulings-2026-10-29.md): the rules set's abilities[],
// classes' race, xp.retainerShare, progression rows' hpGain, combat.spellDisruption, spellcasting's scrollCopy,
// firstSpells and learnByLevel, dungeonExit, and blurb on every kind with summary read as its alias. The
// exploration fields (G-07) are in pack-exploration.mjs. An old shape a ruling replaced gets a line naming the
// new shape.
//
// Also the second batch of 2026-10-29: an item's armour block ({ base?, ac?, aac?, acBonus?, type?, magicBonus? },
// or a plain number meaning base) with the rules set's attack.shieldBonus and attack.style, and a class's race
// naming a race no entry in the pack has.
//
// Also the engine rulings of 2026-10-29: magic armour's armour.baseArmour { choose: [item ids] } (each id an armour
// item in the pack), and armour.class or armour.bulk named as old keys whose place is type.
//
// Also attack.damageScore (ruled 2026-11-01, the M5 gate's C3 follow-up): the score whose modifier adds to damage.
//
// Also the encounter and fight fields of 2026-10-29 (pursuit, death's structured helped, morale events, reaction
// rows' meaning, grantsTempHp), in pack-encounters.mjs, and meta.replaces (ruled 2026-10-30; replacesNotes below).
//
// Also the additions ruled 2026-11-01 from the zine-compendium survey (G-42, G-48 to G-67), in pack-additions.mjs.
//
// Also the notes ruled 2026-11-05: a carry bonus in a banded stack (cb-1, pack-carry-as.mjs), a weapon's magic bonus
// (mw-1, mw-2, pack-weapon-bonus.mjs) and spells found in play (us-1, pack-uncommon-spells.mjs).
import { ruledFieldNotes } from './pack-ruled-fields.mjs';
import { encounterCounts, encounterNotes } from './pack-encounters.mjs';
import { monsterOverlayNotes } from './pack-monster-overlay.mjs';
import { todayShapeNotes } from './pack-today-shapes.mjs';
import { descriptionNotes } from './pack-descriptions.mjs';
import { gmReferenceNotes } from './pack-reference.mjs';
import { explorationCounts, explorationNotes, tableOptionNotes } from './pack-exploration.mjs';
import { additionCounts, additionNotes } from './pack-additions.mjs';
import { creationCounts, creationNotes } from './pack-creation.mjs';
import { linkNotes } from './pack-links.mjs';
import { townNotes } from './pack-town.mjs';
import { procedureNotes } from './pack-procedure.mjs';
import { ruleTextNotes } from './pack-rule-text.mjs';
import { rollsNotes } from './pack-rolls.mjs';
import { adventureHookNotes } from './pack-adventure-hooks.mjs';
import { equipmentNotes } from './pack-equipment.mjs';
import { patchNotes } from './pack-option-gates.mjs';
import { carryBonusBandNotes } from './pack-carry-as.mjs';
import { reversibleNotes } from './pack-reversible.mjs';
import { weaponBonusNotes } from './pack-weapon-bonus.mjs';
import { uncommonReferenceNotes, uncommonSpellNotes } from './pack-uncommon-spells.mjs';
import { saveModifierNotes } from './pack-save-modifiers.mjs';
import { expertiseNotes } from './pack-expertise.mjs';

/** Parts of a pack file that 07 defines and the app's importer doesn't read yet (trait lists import since M5b step 0b). */
// `locations` and top-level `gmReference` import since 2026-11-03 (G-58, G-55; ruled A); `patches` (of-13) since
// options-gates PR 3b (2026-11-04, kind `patch`). `sheetFields` (sr-10) is a checker's list, never imported: the
// checker reads it (scripts/pack-sheet-fields.mjs), so it isn't "unknown" here. `overlays` and `modifications` (M6-13)
// are read by the app later; the checker reads their shape now (scripts/pack-monster-overlay.mjs, fi-5).
// `adventureHooks` (pf-7a) import since dec-12 piece B (kind `adventureHook`), so they are counted with the entries.
export const FORMAT_ONLY_PARTS = ['sheetFields', 'overlays', 'modifications'];

/** Guided creation's steps, as `creationGuide` and `creation.require` name them (07). */
export const CREATION_STEPS = ['method', 'scores', 'race', 'class', 'who', 'spells', 'gear', 'languages', 'weaponSkills', 'expertise', 'traits', 'details'];

/** When spells come back (`spellcasting.recover`). */
export const RECOVER = ['rest', 'restAndStudy', 'prayer'];

/** When a character's ability uses come back (`uses.per`). */
export const USES_PER = ['day', 'rest', 'fight', 'week', 'turn', 'year', 'ever'];

/** When a character may level (`levelUp.when`). */
export const LEVEL_WHEN = ['downtime', 'anyTime'];

/** The keys an item's `armour` block may have (07, "The armour block on items"). */
export const ARMOUR_KEYS = ['base', 'ac', 'aac', 'acBonus', 'type', 'magicBonus', 'baseArmour', 'tier'];

/** Old keys on an armour block that `type` replaced (ruled 2026-10-29). */
const ARMOUR_OLD_TYPE_KEYS = ['class', 'bulk'];

/** An armour block's `type`. */
export const ARMOUR_TYPES = ['light', 'medium', 'heavy'];

/** A one-line summary should be short: 8 to 12 words is the aim; past this, the checker says so. */
export const BLURB_MAX_WORDS = 14;

/** Fields named in meta.proposedExtensions that the format now has. */
const NOW_IN_FORMAT = /\b(terrainChance|chanceDie|baseArmour|blurb|creationGuide|creation\.require|spellcasting\.recover|uses\.per|traitLists|retainerShare|hpGain|scrollCopy|firstSpells|learnByLevel|dungeonExit|turnsPerHour|onlyWithOption|costPer|tableChoices|encounterColumn|onlyOnTerrain|wildEncounters|pursuit|grantsTempHp|abilityLoss|leaderDown|employerDown|damageScore|meta\.replaces|meta\.sources|meta\.sourceTitles|entries\[\]\.abilities|rows\[\]\.tableId|entries\[\]\.items|entries\[\]\.spells|spellcasting\.known|applies|appliesTo|variants|parts|armourClass|extra|tier|levelZero|materials|skills\.mode|encumbrance\.mode|locations|gmReference|scores|abilityAdjustment|extraLanguages|alignmentVisibility|languages\.list)\b/;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isWhole = (value) => Number.isInteger(value);
const textList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);
const list = (values) => values.join(', ');
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;

/** The entries of a pack part, when it's a list of entries. */
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** `blurb` on any entry; an older `summary` is read as its alias (E39, ruled 2026-10-29). */
function blurbNotes(where, entry) {
  if (entry.blurb !== undefined && entry.summary !== undefined) {
    return [...lineNotes(where, 'blurb', entry.blurb, entry.name), `${where}: has both blurb and summary; blurb is read, summary can go.`];
  }
  if (entry.blurb !== undefined) return lineNotes(where, 'blurb', entry.blurb, entry.name);
  if (entry.summary !== undefined) return lineNotes(where, 'summary (read as blurb)', entry.summary, entry.name);
  return [];
}

function lineNotes(where, field, text, name) {
  if (!isText(text)) return [`${where}: ${field} should be one line of words.`];
  const notes = [];
  const count = words(text);
  if (count > BLURB_MAX_WORDS) notes.push(`${where}: ${field} has ${count} words; aim for 8 to 12 (one line under the name).`);
  if (isText(name) && text.trim().toLowerCase() === name.trim().toLowerCase()) {
    notes.push(`${where}: ${field} only repeats the name; say what it does in play.`);
  }
  if (/\n/.test(text)) notes.push(`${where}: ${field} should be one line.`);
  return notes;
}

function usesNotes(where, ability) {
  const notes = [];
  if (ability.refill !== undefined) notes.push(`${where}: "refill" is the old name; write uses.per (${list(USES_PER)}).`);
  if (ability.usesPerDayPerLevel !== undefined) notes.push(`${where}: usesPerDayPerLevel isn't a form the format reads; write uses: { byLevel: [{ level, count }], per: "day" }.`);
  const uses = ability.uses;
  if (uses === undefined) return notes;
  if (!isObject(uses)) return [...notes, `${where}: uses should be { count, per } or { byLevel, per }; a bare number doesn't say when the uses come back.`];
  if (uses.count === undefined && uses.byLevel === undefined) notes.push(`${where}: uses needs a count or a byLevel list.`);
  if (uses.count !== undefined && (!Number.isInteger(uses.count) || uses.count < 1)) notes.push(`${where}: uses.count should be a whole number of 1 or more.`);
  if (uses.byLevel !== undefined) {
    const rows = Array.isArray(uses.byLevel) ? uses.byLevel : null;
    if (!rows || rows.length === 0 || rows.some((row) => !isObject(row) || !Number.isInteger(row.level) || !Number.isInteger(row.count))) {
      notes.push(`${where}: uses.byLevel should be a list like [{ "level": 1, "count": 1 }].`);
    }
  }
  if (uses.per === undefined) notes.push(`${where}: uses has no per; the uses would never come back. Write per: ${list(USES_PER)}.`);
  else if (!USES_PER.includes(uses.per)) notes.push(`${where}: uses.per "${uses.per}" isn't one of ${list(USES_PER)}.`);
  return notes;
}

function traitListNotes(file) {
  const notes = [];
  const seen = new Set();
  for (const [index, raw] of (Array.isArray(file.traitLists) ? file.traitLists : []).entries()) {
    if (!isObject(raw)) {
      notes.push(`traitLists: entry ${index + 1} isn't a list entry.`);
      continue;
    }
    const where = `traitLists: "${label(raw)}"`;
    if (!isText(raw.id)) notes.push(`traitLists: entry ${index + 1} has no id.`);
    else if (seen.has(raw.id)) notes.push(`${where} appears twice.`);
    else seen.add(raw.id);
    if (!isText(raw.name)) notes.push(`${where} has no name.`);
    if (raw.die !== undefined && !(isText(raw.die) && /^\d*d\d+$/.test(raw.die.trim()))) notes.push(`${where}: die should be dice like "d6" or "2d6".`);
    // The list's own Help me choose words (07, ruled 2026-11-02).
    if (raw.help !== undefined && typeof raw.help !== 'string') notes.push(`${where}: help should be text (the list's Help me choose words).`);
    // of-7 (G-120): a list rolled more than once may say its results must differ.
    if (raw.distinct !== undefined && typeof raw.distinct !== 'boolean') notes.push(`${where}: distinct should be true or false (true: rolled more than once, the results differ).`);
    // pf-16 (ruled 2026-11-13): how many times a character rolls or picks on the list at creation; absent is 1.
    if (raw.rolls !== undefined && !(Number.isInteger(raw.rolls) && raw.rolls >= 1)) notes.push(`${where}: rolls should be a whole number of 1 or more (how many times a character rolls or picks on the list), not ${JSON.stringify(raw.rolls)}.`);
    if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
      notes.push(`${where} has no entries.`);
      continue;
    }
    const entryIds = new Set();
    for (const [n, entry] of raw.entries.entries()) {
      if (!isObject(entry)) {
        notes.push(`${where}: entry ${n + 1} isn't an entry.`);
        continue;
      }
      const at = `${where}, "${label(entry)}"`;
      if (!isText(entry.id)) notes.push(`${where}: entry ${n + 1} has no id.`);
      else if (entryIds.has(entry.id)) notes.push(`${at} appears twice.`);
      else entryIds.add(entry.id);
      if (!isText(entry.name)) notes.push(`${at} has no name.`);
      const hasRange = entry.min !== undefined || entry.max !== undefined;
      if (hasRange && !(Number.isInteger(entry.min) && Number.isInteger(entry.max) && entry.min <= entry.max)) {
        notes.push(`${at}: min and max should be whole numbers, min no more than max.`);
      }
      if (hasRange && raw.die === undefined) notes.push(`${at} has a roll range but the list has no die.`);
      notes.push(...blurbNotes(at, entry));
    }
  }
  return notes;
}

function stepListNotes(where, steps) {
  if (!Array.isArray(steps)) return [`${where} should be a list of step names (${list(CREATION_STEPS)}).`];
  return steps.filter((step) => !CREATION_STEPS.includes(step)).map((step) => `${where} names "${step}", which isn't a creation step (${list(CREATION_STEPS)}).`);
}

function rulesSetNotes(file) {
  const notes = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    const where = `rulesSets: "${label(rules)}"`;
    if (rules.creationGuide !== undefined) {
      if (!isObject(rules.creationGuide)) notes.push(`${where}: creationGuide should map step names to { why, help }.`);
      else {
        for (const [step, guide] of Object.entries(rules.creationGuide)) {
          if (!CREATION_STEPS.includes(step)) notes.push(`${where}: creationGuide names "${step}", which isn't a creation step (${list(CREATION_STEPS)}).`);
          if (isText(guide)) continue; // A plain line is the step's why-line.
          if (!isObject(guide) || (guide.why === undefined && guide.help === undefined && guide.title === undefined)) notes.push(`${where}: creationGuide.${step} should be a line, or { why, help, title? }.`);
          else for (const key of ['why', 'help', 'title'].filter((k) => guide[k] !== undefined && !isText(guide[k]))) notes.push(`${where}: creationGuide.${step}.${key} should be words.`);
          if (isObject(guide) && isText(guide.why) && words(guide.why) > BLURB_MAX_WORDS) notes.push(`${where}: creationGuide.${step}.why has ${words(guide.why)} words; one short line is the aim (longer advice goes in help).`);
        }
      }
    }
    if (rules.creation !== undefined) {
      if (!isObject(rules.creation)) notes.push(`${where}: creation should be { require: [step names] }.`);
      else if (rules.creation.require !== undefined) notes.push(...stepListNotes(`${where}: creation.require`, rules.creation.require));
    }
    if (isObject(rules.levelUp) && rules.levelUp.when !== undefined && !LEVEL_WHEN.includes(rules.levelUp.when)) {
      notes.push(`${where}: levelUp.when "${rules.levelUp.when}" isn't one of ${list(LEVEL_WHEN)}.`);
    }
    if (isObject(rules.xp)) {
      const treasure = rules.xp.treasure;
      if (treasure !== undefined && !(isObject(treasure) && typeof treasure.perGp === 'number' && treasure.perGp >= 0)) {
        notes.push(`${where}: xp.treasure should be { perGp: <number>, note? } (0 means treasure gives no XP).`);
      }
      if (rules.xp.treasureXpPerGp !== undefined) notes.push(`${where}: xp.treasureXpPerGp: the format reads xp.treasure.perGp; write it there.`);
      if (rules.xp.rounding !== undefined && !['nearest', 'down', 'up'].includes(rules.xp.rounding)) {
        notes.push(`${where}: xp.rounding "${rules.xp.rounding}" isn't one of nearest, down, up.`);
      }
      const share = rules.xp.retainerShare;
      if (share !== undefined && !(typeof share === 'number' && share >= 0 && share <= 1)) {
        notes.push(`${where}: xp.retainerShare should be a fraction from 0 to 1 (0.5 is half a share).`);
      }
      if (rules.xp.retainerXpPenalty !== undefined) notes.push(`${where}: xp.retainerXpPenalty: the format reads xp.retainerShare (a fraction such as 0.5); write it there.`);
    }
    if (isObject(rules.retainers) && rules.retainers.xpPenalty !== undefined) {
      notes.push(`${where}: retainers.xpPenalty: Award XP reads xp.retainerShare (a fraction such as 0.5); write it there.`);
    }
    notes.push(...abilitiesNotes(where, rules.abilities));
    notes.push(...spellDisruptionNotes(where, isObject(rules.combat) ? rules.combat.spellDisruption : undefined));
    if (rules.startingSpellBooks !== undefined) notes.push(`${where}: startingSpellBooks: the format reads each book-casting class's spellcasting.firstSpells ({ choose?, given?, rollTable? }); write it there.`);
    notes.push(...explorationNotes(rules, where, file));
  }
  return notes;
}

/** The rules set's `abilities` (B6, ruled 2026-10-29): [{ key, name, short?, blurb? }]; a plain key still reads. */
function abilitiesNotes(where, abilities) {
  if (abilities === undefined) return [];
  if (!Array.isArray(abilities)) return [`${where}: abilities should be a list like [{ "key": "MUS", "name": "Muscle", "short": "MUS" }].`];
  const notes = [];
  const seen = new Set();
  const plain = abilities.filter((a) => typeof a === 'string');
  if (plain.length > 0) notes.push(`${where}: abilities lists ${plain.length} plain key${plain.length === 1 ? '' : 's'}; { key, name } gives pop-ups and creation a long name.`);
  for (const [i, ability] of abilities.entries()) {
    const key = typeof ability === 'string' ? ability : isObject(ability) ? ability.key : undefined;
    const at = `${where}, ability ${isText(key) ? `"${key}"` : `#${i + 1}`}`;
    if (!isText(key)) {
      notes.push(`${at}: needs a key ("MUS").`);
      continue;
    }
    if (seen.has(key)) notes.push(`${at} appears twice.`);
    seen.add(key);
    if (!isObject(ability)) continue;
    if (!isText(ability.name)) notes.push(`${at}: needs a name (the long name pop-ups use).`);
    if (ability.short !== undefined && !isText(ability.short)) notes.push(`${at}: short should be the short name ("MUS").`);
    notes.push(...blurbNotes(at, ability));
  }
  return notes;
}

/** `combat.spellDisruption` (E41, ruled 2026-10-29): { lostWhenHit, beforeActing, note }. */
function spellDisruptionNotes(where, rule) {
  if (rule === undefined) return [];
  const at = `${where}: combat.spellDisruption`;
  if (typeof rule === 'string') return [`${at} is plain text; write { "lostWhenHit": true, "beforeActing": true, "note": "…" } so the damage pad can offer "Spell lost?".`];
  if (!isObject(rule)) return [`${at} should be { lostWhenHit, beforeActing, note }.`];
  const notes = [];
  for (const key of ['lostWhenHit', 'beforeActing']) if (rule[key] !== undefined && typeof rule[key] !== 'boolean') notes.push(`${at}.${key} is true or false.`);
  if (rule.lostWhenHit === undefined) notes.push(`${at} has no lostWhenHit; without it the damage pad never offers "Spell lost?".`);
  const note = rule.note ?? rule.notes;
  if (note !== undefined && !isText(note)) notes.push(`${at}.note should be words.`);
  return notes;
}

function classNotes(file) {
  const notes = [];
  for (const part of ['classes', 'races']) {
    for (const entry of entriesOf(file, part)) {
      const where = `${part}: "${label(entry)}"`;
      notes.push(...blurbNotes(where, entry));
      for (const ability of (Array.isArray(entry.abilities) ? entry.abilities : []).filter(isObject)) {
        const at = `${where}, ability "${ability.name ?? ability.id ?? '?'}"`;
        notes.push(...blurbNotes(at, ability), ...usesNotes(at, ability));
      }
      if (part === 'classes' && isObject(entry.spellcasting) && entry.spellcasting.recover !== undefined && !RECOVER.includes(entry.spellcasting.recover)) {
        notes.push(`${where}: spellcasting.recover "${entry.spellcasting.recover}" isn't one of ${list(RECOVER)}.`);
      }
      if (part === 'classes') notes.push(...classFieldNotes(where, entry, file));
    }
  }
  return notes;
}

/** Each table a player rolls on for first spells must be shared (`"gmOnly": false`, fs-1) and give spells on every row (`spells`, fs-2). */
function rollTableNotes(where, rollTable, file) {
  const notes = [];
  const tables = entriesOf(file, 'tables');
  for (const id of isText(rollTable) ? [rollTable] : rollTable) {
    const table = tables.find((t) => t.id === id);
    if (!table) {
      notes.push(`${where}: firstSpells.rollTable "${id}" isn't a table in this pack (fine if another attached pack has it, marked "gmOnly": false).`);
      continue;
    }
    if (table.gmOnly !== false) {
      notes.push(`${where}: firstSpells.rollTable "${id}" is a table players can't read; write "gmOnly": false on the table so the First spells step can show it.`);
    }
    const rows = Array.isArray(table.rows) ? table.rows : [];
    const without = rows.filter((row) => !isObject(row) || !textList(row.spells)).length;
    if (without > 0) notes.push(`${where}: firstSpells.rollTable "${id}": ${without} row${without === 1 ? '' : 's'} without spells (a list of spell ids); the step reads nothing else.`);
  }
  return notes;
}

/**
 * A kindred's grants at creation (cs-2, 2026-11-03): `firstSpells` with `given` and `rollTable` (the class shape; a
 * kindred has no spell list, so `choose` isn't read) and `startingItems` as item ids, both added to the class's.
 */
function kindredGrantNotes(file) {
  const notes = [];
  const itemIds = new Set(entriesOf(file, 'items').map((i) => i.id).filter(isText));
  for (const race of entriesOf(file, 'races')) {
    const where = `races: "${label(race)}"`;
    const first = race.firstSpells;
    if (first !== undefined) {
      const okGiven = first?.given === undefined || textList(first.given);
      const okRoll = first?.rollTable === undefined || isText(first.rollTable) || textList(first.rollTable);
      if (!isObject(first) || (first.given === undefined && first.rollTable === undefined) || !okGiven || !okRoll) {
        notes.push(`${where}: firstSpells should be { given?: [spell ids], rollTable?: <table id> | [<table ids>], note? } (at least one).`);
      } else if (first.rollTable !== undefined) notes.push(...rollTableNotes(where, first.rollTable, file));
      if (isObject(first) && first.choose !== undefined) notes.push(`${where}: firstSpells.choose isn't read: a kindred has no spell list to pick from. Use rollTable (a shared table; "rolled or chosen" is a tap either way) or given.`);
    }
    if (race.startingItems !== undefined) {
      if (!textList(race.startingItems)) notes.push(`${where}: startingItems should be a list of item ids, like ["reed-flute"].`);
      else if (itemIds.size > 0) {
        for (const id of race.startingItems.filter((id) => !itemIds.has(id))) notes.push(`${where}: startingItems names "${id}", which isn't an item in this pack (fine if another attached pack has it).`);
      }
    }
  }
  return notes;
}

const KINDRED_TABLE_KEYS = ['names', 'trinket', 'details', 'growth'];

/**
 * A kindred's own creation tables (cs-1, 2026-11-03): `tables { names?, trinket?, details?: [table ids], growth? }`,
 * each an ordinary table players can read (`"gmOnly": false`): the Name field's roll, the trinket in Gear, the Details
 * step and the growth on it. A name table's `columns` go with each row's `cells`.
 */
function kindredTableNotes(file) {
  const notes = [];
  const tables = entriesOf(file, 'tables');
  for (const race of entriesOf(file, 'races')) {
    if (race.tables === undefined) continue;
    const where = `races: "${label(race)}"`;
    if (!isObject(race.tables)) {
      notes.push(`${where}: tables should be { names?, trinket?, details?: [table ids], growth? }.`);
      continue;
    }
    for (const key of Object.keys(race.tables).filter((k) => !KINDRED_TABLE_KEYS.includes(k))) notes.push(`${where}: tables.${key} isn't read (${list(KINDRED_TABLE_KEYS)}).`);
    const named = [];
    for (const key of ['names', 'trinket', 'growth']) {
      const id = race.tables[key];
      if (id === undefined) continue;
      if (!isText(id)) notes.push(`${where}: tables.${key} should be a table id.`);
      else named.push([`tables.${key}`, id]);
    }
    if (race.tables.details !== undefined) {
      if (!textList(race.tables.details)) notes.push(`${where}: tables.details should be a list of table ids.`);
      else for (const id of race.tables.details) named.push(['tables.details', id]);
    }
    for (const [at, id] of named) {
      const table = tables.find((t) => t.id === id);
      if (!table) {
        notes.push(`${where}: ${at} "${id}" isn't a table in this pack (fine if another attached pack has it, marked "gmOnly": false).`);
        continue;
      }
      if (table.gmOnly !== false) notes.push(`${where}: ${at} "${id}" is a table players can't read; write "gmOnly": false on the table so creation can show it.`);
      if (at === 'tables.names' && Array.isArray(table.columns) && table.columns.length > 0) {
        const rows = Array.isArray(table.rows) ? table.rows : [];
        const short = rows.filter((row) => !isObject(row) || !Array.isArray(row.cells) || row.cells.length !== table.columns.length).length;
        if (short > 0) notes.push(`${where}: ${at} "${id}": ${short} row${short === 1 ? '' : 's'} without one cell per column (${table.columns.length}); the Name roll taps a cell in each column.`);
      }
    }
    for (const key of ['age', 'height', 'weight']) {
      if (race[key] !== undefined && !isText(race[key])) notes.push(`${where}: ${key} should be words with the dice ("2d6 × 10 years"); the Details step shows it beside the box.`);
    }
  }
  return notes;
}

/**
 * The table uses registry (07, "Table uses registry"): the base paths the app knows, the item-table uses (it-1) and the
 * creation slots (ct-5, 2026-11-06, design/rulings/m5b-creation-tables-2026-11-06.md). A pack adds its own through
 * meta.tableUses [{ path, name, group }].
 */
export const BASE_TABLE_USES = ['encounters', 'encounters.reaction', 'encounters.signs', 'fights.tactics', 'fights.crit', 'fights.fumble', 'treasure', 'treasure.itemFound', 'treasure.itemUse', 'treasure.itemReference', 'places.dressing', 'people.names', 'people.traits', 'world.weather', 'world.rumours'];

/** The creation slots a table can offer to a race without its own (ct-5); src/modules/characters/kindredTables.ts CREATION_SLOTS. */
export const CREATION_TABLE_USES = ['creation.names', 'creation.details', 'creation.trinket'];

/**
 * The weather tables a rules set names, as the database reads them (private.weather_table_ids_in,
 * 20261031090000_m5b_weather_roll.sql): `weather.tables`, each exploration mode's `weather.tables`, a weather step's
 * `tableId` and `tableBySeason`, and each special season's `weatherTableId`; the same in each `byOption` choice.
 */
function weatherTableIdsIn(rules) {
  const ids = [];
  const values = (o) => (isObject(o) ? Object.values(o).filter(isText) : []);
  const read = (r) => {
    if (!isObject(r)) return;
    ids.push(...values(r.weather?.tables));
    for (const mode of Array.isArray(r.exploration?.modes) ? r.exploration.modes.filter(isObject) : []) {
      ids.push(...values(mode.weather?.tables));
      for (const step of Array.isArray(mode.procedure) ? mode.procedure.filter(isObject) : []) {
        if (step.icon !== 'weather') continue;
        if (isText(step.tableId)) ids.push(step.tableId);
        ids.push(...values(step.tableBySeason));
      }
    }
    for (const season of Array.isArray(r.specialSeasons) ? r.specialSeasons.filter(isObject) : []) if (isText(season.weatherTableId)) ids.push(season.weatherTableId);
  };
  read(rules);
  for (const choice of isObject(rules.byOption) ? Object.values(rules.byOption) : []) read(choice);
  return [...new Set(ids.map((id) => id.trim()))];
}

/**
 * A weather table that is a table of rumours (dec-12 E follow-up, the lead after the rm-3 findings): a player who
 * rolls the weather would read a rumour's words from it. Errors, so the check fails. Only this pack's tables are known.
 */
export function rumourWeatherErrors(file) {
  // A pack read from Markdown, or one that couldn't be read, has no JSON to check here.
  if (!isObject(file)) return [];
  const rumours = new Set(rumourTableIds(file));
  return weatherNamings(file)
    .filter(({ id }) => rumours.has(id))
    .map(({ where, id }) => `rulesSets: "${where}" names "${id}" as a weather table, but it is a table of rumours: a player rolling the weather would read its rumours. Name a weather table instead.`);
}

/**
 * The same across the packs given together (the review of #835): the database looks a weather table up in every pack
 * attached to the campaign (private.campaign_table), so a setting's weather table may be an adventure's table of
 * rumours. Only what no file shows alone: a rules set naming a table of rumours in another file given here.
 */
export function rumourWeatherLibraryErrors(files) {
  const packs = files.filter(isObject);
  const owner = new Map();
  packs.forEach((file, i) => {
    for (const id of rumourTableIds(file)) if (!owner.has(id)) owner.set(id, i);
  });
  return packs.flatMap((file, i) => {
    const here = new Set(rumourTableIds(file));
    return weatherNamings(file)
      .filter(({ id }) => owner.has(id) && !here.has(id))
      .map(({ where, id }) => {
        const other = packs[owner.get(id)];
        const name = isText(other.meta?.name) ? other.meta.name.trim() : 'another pack';
        return `rulesSets: "${where}" names "${id}" as a weather table, but ${name} has it as a table of rumours: a player rolling the weather would read its rumours. Name a weather table instead.`;
      });
  });
}

/** The ids of a file's tables of rumours: the use `world.rumours` (in `uses` or `use`), or the older `"kind": "rumours"`. */
function rumourTableIds(file) {
  return entriesOf(file, 'tables')
    .filter((t) => isText(t.id) && (tableUsesOf(t).map((u) => u.trim()).includes('world.rumours') || t.kind === 'rumours'))
    .map((t) => t.id.trim());
}

/** Each weather table a file's rules sets name, with the rules set that names it. */
function weatherNamings(file) {
  return entriesOf(file, 'rulesSets').flatMap((rules, i) => {
    const where = isText(rules.id) ? rules.id.trim() : isText(rules.name) ? rules.name.trim() : `#${i + 1}`;
    return weatherTableIdsIn(rules).map((id) => ({ where, id }));
  });
}

/**
 * A table's uses: `uses` and the older `use`, each a list or one string, both read (as private.is_rumours_table reads
 * them; the review of #835).
 */
const tableUsesOf = (table) => {
  const listOf = (uses) => (isText(uses) ? [uses] : Array.isArray(uses) ? uses.filter(isText) : []);
  return [...listOf(table.uses), ...listOf(table.use)];
};

/**
 * A table's uses (07 registry) and its `join` (ct-7): a use neither in the registry nor declared in meta.tableUses is
 * named (it's filed under Other); a creation-slot table players can't read is named (creation couldn't show it); a
 * `join` that isn't text is named (a space is read instead); so is a `rollPrompt` that isn't words (R3-2).
 */
function tableUseNotes(file) {
  const notes = [];
  const declared = new Set((Array.isArray(file.meta?.tableUses) ? file.meta.tableUses : []).flatMap((u) => (isObject(u) && isText(u.path) ? [u.path.trim()] : [])));
  const known = new Set([...BASE_TABLE_USES, ...CREATION_TABLE_USES, ...declared]);
  for (const table of entriesOf(file, 'tables')) {
    const where = `tables: "${label(table)}"`;
    const uses = tableUsesOf(table).map((u) => u.trim());
    for (const use of uses.filter((u) => !known.has(u))) {
      const near = use.startsWith('creation') ? ` The creation slots are ${list(CREATION_TABLE_USES)}.` : '';
      notes.push(`${where}: use "${use}" isn't in the table uses registry or meta.tableUses; it's filed under Other.${near}`);
    }
    // A table of rumours is the GM's (dec-12 E, hard rule 5): opened to players, each rumour's truth would reach them.
    // The importer skips it (src/modules/library/packFile.ts), so it is named here.
    if (table.gmOnly === false && (uses.includes('world.rumours') || table.kind === 'rumours')) {
      notes.push(`${where}: a table of rumours marked "gmOnly": false would show players whether each rumour is true, so the app won't import it. Take "gmOnly": false off: a rumour reaches players when the GM gives it.`);
    }
    const slots = uses.filter((u) => CREATION_TABLE_USES.includes(u));
    if (slots.length > 0 && table.gmOnly !== false) notes.push(`${where}: ${slots.join(', ')} offers it at creation, but players can't read it; write "gmOnly": false on the table.`);
    // forRaces (G-203): a creation-slot table bound to kindreds is theirs; a race id another pack has is fine.
    if (table.forRaces !== undefined) {
      const ids = typeof table.forRaces === 'string' ? [table.forRaces] : Array.isArray(table.forRaces) ? table.forRaces : null;
      const raceIds = new Set(entriesOf(file, 'races').map((r) => r.id).filter(isText));
      if (!ids || !ids.every(isText)) notes.push(`${where}: forRaces should be a list of race ids.`);
      else if (slots.length === 0) notes.push(`${where}: forRaces is read only on a table with a creation slot (${list(CREATION_TABLE_USES)}).`);
      else for (const id of ids.filter((r) => !raceIds.has(r.trim()))) notes.push(`${where}: forRaces "${id}" isn't a race in this pack (fine if another attached pack has it).`);
    }
    // rollPrompt (R3-2): the pack's own words at the top of the table's sheet; text, else the app's fallback is shown.
    if (table.rollPrompt !== undefined && !isText(table.rollPrompt)) notes.push(`${where}: rollPrompt should be words ("Roll d20 twice: a first name, then a house name"); the app's own line is shown instead.`);
    if (table.join !== undefined && typeof table.join !== 'string') notes.push(`${where}: join should be the words between name columns ("" for two halves of one word, " " for a space); a space is read instead.`);
  }
  return notes;
}

/** The class fields ruled 2026-10-29: race (B10), hpGain (E44), and spellcasting's scrollCopy, firstSpells and learnByLevel (E42, E43). */
function classFieldNotes(where, entry, file) {
  const notes = [];
  if (entry.race !== undefined) {
    const raceIds = new Set(entriesOf(file, 'races').map((r) => r.id).filter(isText));
    if (!isText(entry.race)) notes.push(`${where}: race should be a race id.`);
    else if (!raceIds.has(entry.race)) notes.push(`${where}: race "${entry.race}" isn't a race in this pack (fine if another attached pack has it).`);
  }
  const rows = Array.isArray(entry.progression) ? entry.progression.filter(isObject) : [];
  for (const row of rows) {
    if (row.hpGain === undefined) continue;
    const gain = row.hpGain;
    if (!isObject(gain) || !(isWhole(gain.fixed) && gain.fixed >= 0) || (gain.addCon !== undefined && typeof gain.addCon !== 'boolean')) {
      notes.push(`${where}: level ${row.level ?? '?'} hpGain should be { "fixed": <whole number>, "addCon": true | false }.`);
    }
  }
  if (entry.hpAfter10 !== undefined || rows.some((row) => row.hpAfter10 !== undefined)) {
    notes.push(`${where}: hpAfter10 isn't read; write hpGain: { fixed, addCon } on each progression row with a set gain.`);
  }
  if (entry.replacesRaceTraits !== undefined && typeof entry.replacesRaceTraits !== 'boolean') {
    notes.push(`${where}: replacesRaceTraits should be true or false (a kindred-class replaces its kindred's traits unless it says false).`);
  }
  const sc = isObject(entry.spellcasting) ? entry.spellcasting : null;
  if (entry.startingSpellBooks !== undefined || (sc && sc.startingSpellBooks !== undefined)) {
    notes.push(`${where}: startingSpellBooks: write spellcasting.firstSpells ({ choose?, given?, rollTable? }).`);
  }
  if (!sc) return notes;
  if (sc.knownByLevel !== undefined) notes.push(`${where}: spellcasting.knownByLevel is read as learnByLevel; write spellcasting.learnByLevel: [{ level, count }].`);
  const first = sc.firstSpells;
  if (first !== undefined) {
    const okChoose = first?.choose === undefined || (isWhole(first.choose) && first.choose >= 1);
    // A caster whose spells start after 1st level (fromLevel above 1) writes firstSpells { given: [], note } (cr-13: every caster says).
    const laterStart = isWhole(sc.fromLevel) && sc.fromLevel > 1;
    const okGiven = first?.given === undefined || textList(first.given) || (laterStart && Array.isArray(first.given) && first.given.length === 0);
    // rollTable is one table id or a list of ids, one roll per table (fs-3, 2026-11-02).
    const okRoll = first?.rollTable === undefined || isText(first.rollTable) || textList(first.rollTable);
    const any = isObject(first) && ['choose', 'given', 'rollTable'].some((k) => first[k] !== undefined);
    if (!isObject(first) || !any || !okChoose || !okGiven || !okRoll) {
      notes.push(`${where}: spellcasting.firstSpells should be { choose?: <number>, given?: [spell ids], rollTable?: <table id> | [<table ids>] } (at least one).`);
    } else if (first.rollTable !== undefined) {
      notes.push(...rollTableNotes(where, first.rollTable, file));
    }
  }
  const learn = sc.learnByLevel;
  if (learn !== undefined && !(Array.isArray(learn) && learn.length > 0 && learn.every((r) => isObject(r) && isWhole(r.level) && isWhole(r.count) && r.count >= 0))) {
    notes.push(`${where}: spellcasting.learnByLevel should be a list like [{ "level": 2, "count": 1 }].`);
  }
  const copy = sc.scrollCopy;
  if (copy !== undefined) {
    if (typeof copy === 'string') notes.push(`${where}: spellcasting.scrollCopy is plain text; write { "note": "…", "consumesScroll": true }.`);
    else if (!isObject(copy) || (copy.consumesScroll !== undefined && typeof copy.consumesScroll !== 'boolean') || (copy.note !== undefined && !isText(copy.note))) {
      notes.push(`${where}: spellcasting.scrollCopy should be { note, consumesScroll: true | false }.`);
    }
  }
  return notes;
}

const ARMOUR_SHAPE = `a whole number (the base AC) or a block { ${list(ARMOUR_KEYS)} }`;

/** An armour item a magic armour's base can be: worn in the armour slot, giving its own AC (not another choice). */
const isBaseArmour = (item) =>
  item.slot === 'armour' && (isWhole(item.armour) || (isObject(item.armour) && item.armour.baseArmour === undefined && ['base', 'ac', 'aac'].some((k) => isWhole(item.armour[k]))));

/**
 * An item's `armour` block (ruled 2026-10-29): a whole number (the base), or { base?, ac?, aac?, acBonus?, type?,
 * magicBonus?, baseArmour? }. `baseArmour: { choose: [item ids] }` is magic armour whose base is picked when it's
 * found: each id must be an armour item in this pack.
 */
function armourNotes(where, armour, itemsById) {
  if (armour === undefined || armour === null) return [];
  if (typeof armour === 'number') return isWhole(armour) ? [] : [`${where}: armour should be ${ARMOUR_SHAPE}.`];
  if (!isObject(armour)) return [`${where}: armour should be ${ARMOUR_SHAPE}.`];
  const notes = [];
  for (const key of Object.keys(armour).filter((k) => !ARMOUR_KEYS.includes(k))) {
    if (ARMOUR_OLD_TYPE_KEYS.includes(key)) {
      notes.push(`${where}: armour.${key} isn't a format key; write type ("${ARMOUR_TYPES.join('", "')}").`);
      continue;
    }
    const instead = key === 'ascending' ? ' (write aac)' : key === 'descending' ? ' (write ac)' : '';
    notes.push(`${where}: armour.${key} isn't read${instead}; the block takes ${list(ARMOUR_KEYS)}.`);
  }
  for (const key of ARMOUR_KEYS.filter((k) => k !== 'type' && k !== 'baseArmour' && k !== 'tier' && armour[k] !== undefined && !isWhole(armour[k]))) {
    notes.push(`${where}: armour.${key} should be a whole number.`);
  }
  if (armour.type !== undefined && !ARMOUR_TYPES.includes(armour.type)) notes.push(`${where}: armour.type "${armour.type}" isn't one of ${list(ARMOUR_TYPES)}.`);
  if (armour.baseArmour !== undefined) {
    const choose = isObject(armour.baseArmour) ? armour.baseArmour.choose : undefined;
    if (!textList(choose)) notes.push(`${where}: armour.baseArmour should be { choose: ["<armour item id>", …] }.`);
    else {
      for (const id of choose) {
        const item = itemsById.get(id);
        if (!item) notes.push(`${where}: armour.baseArmour.choose names "${id}", which isn't an item in this pack.`);
        else if (!isBaseArmour(item)) notes.push(`${where}: armour.baseArmour.choose names "${id}", which isn't armour with its own AC (slot "armour" and a base, ac or aac).`);
      }
    }
    if (['base', 'ac', 'aac'].some((k) => armour[k] !== undefined)) notes.push(`${where}: armour has both baseArmour and its own AC; with baseArmour, AC is the chosen base's plus magicBonus.`);
  }
  return notes;
}

/** Each item's armour block, and the rules set's shield bonus and AC style that go with it. */
function armourBlockNotes(file) {
  const notes = [];
  const items = entriesOf(file, 'items');
  const itemsById = new Map(items.filter((i) => isText(i.id)).map((i) => [i.id, i]));
  for (const item of items) notes.push(...armourNotes(`items: "${label(item)}"`, item.armour, itemsById));
  for (const rules of entriesOf(file, 'rulesSets')) {
    const attack = isObject(rules.attack) ? rules.attack : null;
    if (!attack) continue;
    const where = `rulesSets: "${label(rules)}"`;
    if (attack.shieldBonus !== undefined && !isWhole(attack.shieldBonus)) notes.push(`${where}: attack.shieldBonus should be a whole number.`);
    if (attack.style !== undefined && !['ascending', 'descending'].includes(attack.style)) notes.push(`${where}: attack.style "${attack.style}" isn't ascending or descending.`);
    notes.push(...damageScoreNotes(where, attack.damageScore, rules.abilities));
  }
  return notes;
}

/**
 * `attack.damageScore` (M5 gate C3's follow-up, ruled 2026-11-01): the key of the ability score whose modifier adds to
 * weapon damage; absent means the damage die alone. When the rules set lists its abilities, it should be one of them.
 */
function damageScoreNotes(where, score, abilities) {
  if (score === undefined) return [];
  if (!isText(score)) return [`${where}: attack.damageScore should be an ability's key, like "MUS".`];
  const keys = (Array.isArray(abilities) ? abilities : []).map((a) => (typeof a === 'string' ? a : isObject(a) ? a.key : null)).filter(isText);
  if (keys.length > 0 && !keys.includes(score)) return [`${where}: attack.damageScore "${score}" isn't one of the rules set's abilities (${list(keys)}).`];
  return [];
}

/** The kinds of food an item may be (07, items; ruled 2026-10-30). */
export const FOOD_KINDS = ['fresh', 'preserved', 'cooked'];

/** An item's `food`: "fresh", "preserved" or "cooked". */
function foodNotes(file) {
  return entriesOf(file, 'items')
    .filter((item) => item.food !== undefined && !FOOD_KINDS.includes(item.food))
    .map((item) => `items: "${label(item)}": food "${item.food}" isn't one of ${FOOD_KINDS.join(', ')}.`);
}

/**
 * `meta.replaces` (ruled 2026-10-30): the ids this pack used before, as a list. Never the pack's own `meta.id`.
 * Whether an id belongs to another pack in the library can't be seen from one file: check-pack.mjs says so.
 */
export function replacesNotes(file) {
  const meta = isObject(file) && isObject(file.meta) ? file.meta : null;
  if (!meta || meta.replaces === undefined) return [];
  const replaces = meta.replaces;
  if (!Array.isArray(replaces)) return [`meta.replaces should be a list of old ids, like ["<old id>"].`];
  const notes = [];
  if (replaces.length === 0) notes.push('meta.replaces is an empty list; leave it out or name the old ids.');
  const seen = new Set();
  for (const [i, id] of replaces.entries()) {
    if (!isText(id)) {
      notes.push(`meta.replaces: entry ${i + 1} should be an id.`);
      continue;
    }
    const clean = id.trim();
    if (isText(meta.id) && clean === meta.id.trim()) notes.push(`meta.replaces lists "${clean}", the pack's own meta.id; a pack can't replace itself.`);
    else if (seen.has(clean)) notes.push(`meta.replaces lists "${clean}" twice.`);
    seen.add(clean);
  }
  if (!isText(meta.id)) notes.push('meta.replaces is given but the pack has no meta.id; the new id is what the old ones point to.');
  return notes;
}

/**
 * The format notes for a parsed pack file: a list of plain lines, empty when everything the new parts say
 * is written the way 07 says. Never throws on odd input.
 */
/**
 * Short labels for choices (07, ruled 2026-11-03, tf-3): an option of 2 or 3 choices shows them side by side on the
 * Rules row when every choice has a `short` label (or a name of up to 14 letters); without, the row falls back to its
 * button. A note, not an error.
 */
export function shortLabelNotes(file) {
  return entriesOf(file, 'options')
    .filter((o) => Array.isArray(o.choices) && o.choices.filter(isObject).length >= 2 && o.choices.filter(isObject).length <= 3)
    // A name short already ("On", "Off") stands in for the label, as on the row (src/ui/ruleRows.tsx, segmentLabels).
    .filter((o) => o.choices.filter(isObject).some((c) => !(typeof c.short === 'string' && c.short.trim() !== '') && !(isText(c.name) && c.name.length <= 14)))
    .map((o) => `options: "${label(o)}" has ${o.choices.filter(isObject).length} choices, some long and without a short label (choices[].short, about 14 letters); the Rules row shows them side by side only with one.`);
}

/**
 * An option extending a base option (07, of-1, ruled 2026-11-03): `extends` joins the base's choices as one option,
 * `ruleKey` makes a whole-rule rival; an option with both is a mistake. A note, not an error.
 */
export function extendsNotes(file) {
  return entriesOf(file, 'options')
    .filter((o) => o.extends !== undefined && o.ruleKey !== undefined)
    .map((o) => `options: "${label(o)}" has both extends and ruleKey; extends joins its choices to the base option (one option), ruleKey makes it a rival rule. Keep one (07, of-1).`);
}

/**
 * A spell list's names for its levels (pf-22, lv-1): `levelNames`, a map from a level (a whole number, 0 or more) to
 * { one, many }. A key that isn't a level, and an entry without both words, are notes: the app shows nothing for the
 * first and its fallback ("Level N") for the second.
 */
export function levelNamesNotes(file) {
  const notes = [];
  for (const list of entriesOf(file, 'spellLists')) {
    if (list.levelNames === undefined) continue;
    const where = `spellLists: "${label(list)}" levelNames`;
    if (!isObject(list.levelNames)) {
      notes.push(`${where} should be a map from a level to { one, many } (pf-22); the app reads nothing from it.`);
      continue;
    }
    for (const [key, value] of Object.entries(list.levelNames)) {
      if (!/^(0|[1-9][0-9]*)$/.test(key)) notes.push(`${where} has the key "${key}", which isn't a spell level (a whole number, 0 or more); the app never shows it.`);
      else if (!isObject(value) || !isText(value.one) || !isText(value.many)) notes.push(`${where} "${key}" needs both "one" (one spell) and "many" (a heading, several); without both the app writes "Level ${key}".`);
    }
  }
  return notes;
}

export function formatNotes(file) {
  if (!isObject(file)) return [];
  const notes = [...replacesNotes(file), ...traitListNotes(file), ...rulesSetNotes(file), ...classNotes(file), ...armourBlockNotes(file), ...encounterNotes(file), ...tableOptionNotes(file), ...shortLabelNotes(file), ...extendsNotes(file), ...foodNotes(file), ...descriptionNotes(file), ...additionNotes(file), ...creationNotes(file), ...kindredGrantNotes(file), ...kindredTableNotes(file), ...tableUseNotes(file), ...gmReferenceNotes(file), ...linkNotes(file), ...townNotes(file), ...procedureNotes(file), ...ruleTextNotes(file), ...rollsNotes(file), ...adventureHookNotes(file), ...equipmentNotes(file), ...patchNotes(file), ...carryBonusBandNotes([file]), ...weaponBonusNotes(file), ...uncommonSpellNotes(file), ...uncommonReferenceNotes([file]), ...reversibleNotes(file), ...saveModifierNotes([file]), ...levelNamesNotes(file), ...expertiseNotes(file)];
  // blurb is one field name on every kind (E39); classes, races and trait lists are checked above.
  for (const part of ['spells', 'items', 'startingKits', 'statBlocks', 'conditions', 'lightTypes', 'spellLists', 'options']) {
    for (const entry of entriesOf(file, part)) notes.push(...blurbNotes(`${part}: "${label(entry)}"`, entry));
  }
  // Today's shapes (after-m5b-gate.md) and the overlay and modification shapes (fi-5); in their own modules.
  notes.push(...todayShapeNotes(file, USES_PER), ...monsterOverlayNotes(file));
  // A place's rule kept for the GM (pf-12d), an encounter check's name (rp-6), a coin's unitName and pluralName (pf-17).
  notes.push(...ruledFieldNotes(file));
  const proposed = isObject(file.meta) && Array.isArray(file.meta.proposedExtensions) ? file.meta.proposedExtensions : [];
  for (const line of proposed.filter((p) => typeof p === 'string' && NOW_IN_FORMAT.test(p))) {
    notes.push(`meta.proposedExtensions lists "${line}", which is now part of the format (07); it can come off the list.`);
  }
  return notes;
}

/** How many of each new part a pack holds, for the checker's summary (only parts that are there). */
export function formatCounts(file) {
  if (!isObject(file)) return {};
  const counts = {};
  const add = (key, n) => {
    if (n > 0) counts[key] = (counts[key] ?? 0) + n;
  };
  add('trait lists', entriesOf(file, 'traitLists').length);
  add('patches', Array.isArray(file.patches) ? file.patches.length : 0);
  const abilities = [...entriesOf(file, 'classes'), ...entriesOf(file, 'races')].flatMap((e) => (Array.isArray(e.abilities) ? e.abilities.filter(isObject) : []));
  const traits = entriesOf(file, 'traitLists').flatMap((t) => (Array.isArray(t.entries) ? t.entries.filter(isObject) : []));
  const withBlurb = [...['spells', 'classes', 'races', 'items', 'startingKits'].flatMap((p) => entriesOf(file, p)), ...abilities, ...traits].filter((e) => e.blurb !== undefined);
  add('blurbs', withBlurb.length);
  add('abilities with uses', abilities.filter((a) => a.uses !== undefined).length);
  add('rules sets with creationGuide', entriesOf(file, 'rulesSets').filter((r) => r.creationGuide !== undefined).length);
  add('classes with spellcasting.recover', entriesOf(file, 'classes').filter((c) => isObject(c.spellcasting) && c.spellcasting.recover !== undefined).length);
  add('rules sets with named abilities', entriesOf(file, 'rulesSets').filter((r) => Array.isArray(r.abilities) && r.abilities.some(isObject)).length);
  add('classes with race', entriesOf(file, 'classes').filter((c) => c.race !== undefined).length);
  add('races with creation tables', entriesOf(file, 'races').filter((r) => isObject(r.tables)).length);
  add('tables offered at creation', entriesOf(file, 'tables').filter((t) => tableUsesOf(t).some((u) => CREATION_TABLE_USES.includes(u.trim()))).length);
  add('items with an armour block', entriesOf(file, 'items').filter((i) => i.armour !== undefined && i.armour !== null).length);
  add('magic armour with a base to choose', entriesOf(file, 'items').filter((i) => isObject(i.armour) && i.armour.baseArmour !== undefined).length);
  add('progression rows with hpGain', entriesOf(file, 'classes').flatMap((c) => (Array.isArray(c.progression) ? c.progression.filter(isObject) : [])).filter((r) => r.hpGain !== undefined).length);
  add('classes with first spells or learnByLevel', entriesOf(file, 'classes').filter((c) => isObject(c.spellcasting) && (c.spellcasting.firstSpells !== undefined || c.spellcasting.learnByLevel !== undefined)).length);
  for (const [key, n] of Object.entries(explorationCounts(file))) add(key, n);
  for (const [key, n] of Object.entries(encounterCounts(file))) add(key, n);
  for (const [key, n] of Object.entries(additionCounts(file))) add(key, n);
  for (const [key, n] of Object.entries(creationCounts(file))) add(key, n);
  return counts;
}

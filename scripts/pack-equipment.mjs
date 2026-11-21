// The pack checker's equipment notes from the independent re-check of pack review area 3 (equipment and
// encumbrance, 2026-11-03; plan docs/plans/m5b-review-area-3.md): things the app would quietly get wrong.
// - a startingKits roll without a name, a die or rows (07 "rolled kit"): the app leaves it out without a word
//   (src/modules/characters/startingGear.ts, kitRolls), and a row without whole min and max likewise;
// - an item whose name says how many it holds ("Reed darts (12)", "Pouch of 20 beads") but has no `bundle`
//   (07 items, bundle): buying one would add a single unit;
// - an item the pack places as treasure (a location's treasure[].itemId) that the app won't count as treasure:
//   treasure is a category the rules set's encumbrance.treasureWeights names, or an item's `treasure: true`
//   (bq3-9, ruled 2026-11-04; 07 Encumbrance), never where it's placed. The placing is only the hint.
// - a kit roll's `forClasses` (eq-9) that isn't a list of class ids, or names a class the same file doesn't have
//   (checked only when the file has classes): the roll would show to no one, or to the wrong class.
// - a kit roll's `distinct` (bq-1) that isn't true or false: the app reads only `true`, so repeats stay allowed.
// - a container's weightEmpty / weightFull (eq-5) the app can't read as a pair, or can't tell how full by;
// - an item's carryBonus (eq-6) that isn't a whole number above 0, or sits on an item that can't be worn or held;
// - an item's slot the app doesn't know (armour, shield, hand, and worn since mb-5).
// - a rules set's `weaponRules` entry the app can't read, or that names a class category no class here carries or
//   excepts an id that isn't a class (eq-7, mb-4); a class `forms` entry the app leaves out (no id), a repeated id,
//   or a form with no limits (eq-8). Area 3 order 10; tested in scripts/pack-weapon-rules-forms.test.mjs.
// Warnings only; nothing blocks an import. Used by scripts/pack-format.mjs; tested in scripts/pack-equipment.test.mjs.

import { weaponModeNotes } from './pack-weapon-modes.mjs';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

const ROLL_SHAPE = 'a roll needs a name, a die and rows [{ min, max, items }]';

/** Kit rolls the app's reader drops (kitRolls): no name, no die, no rows, or no row with whole min and max. */
function kitRollNotes(file) {
  const notes = [];
  for (const kit of entriesOf(file, 'startingKits')) {
    if (!Array.isArray(kit.rolls)) continue;
    kit.rolls.forEach((roll, i) => {
      const at = `startingKits: "${label(kit)}", roll ${i + 1}`;
      if (!isObject(roll)) {
        notes.push(`${at} isn't { name, die, rows }; the app leaves it out.`);
        return;
      }
      const named = typeof roll.name === 'string' ? `${at} ("${roll.name}")` : at;
      const missing = [typeof roll.name !== 'string' && 'name', typeof roll.die !== 'string' && 'die', !Array.isArray(roll.rows) && 'rows'].filter(Boolean);
      if (missing.length > 0) {
        notes.push(`${named} has no ${missing.join(', no ')}; the app leaves the roll out (${ROLL_SHAPE}).`);
        return;
      }
      let readable = 0;
      roll.rows.forEach((row, r) => {
        if (isObject(row) && Number.isInteger(row.min) && Number.isInteger(row.max)) readable += 1;
        else notes.push(`${named}, row ${r + 1} needs whole-number min and max; the app leaves the row out.`);
      });
      if (readable === 0) notes.push(`${named} has no row the app can read; the app leaves the roll out.`);
    });
  }
  return notes;
}

/** Kit rolls' `forClasses` (eq-9): a list of class ids, each one a class in this file (when it has classes). */
function kitRollClassNotes(file) {
  const classes = new Set(entriesOf(file, 'classes').filter((c) => isText(c.id)).map((c) => c.id.trim()));
  const notes = [];
  for (const kit of entriesOf(file, 'startingKits')) {
    if (!Array.isArray(kit.rolls)) continue;
    kit.rolls.forEach((roll, i) => {
      if (!isObject(roll) || roll.forClasses === undefined) return;
      const at = `startingKits: "${label(kit)}", roll ${i + 1}${typeof roll.name === 'string' ? ` ("${roll.name}")` : ''}`;
      const ids = roll.forClasses;
      if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isText)) {
        notes.push(`${at}: forClasses should be a list of class ids, such as ["<class id>"].`);
        return;
      }
      if (classes.size === 0) return;
      const unknown = ids.map((id) => id.trim()).filter((id) => !classes.has(id));
      if (unknown.length > 0) notes.push(`${at}: forClasses names ${unknown.map((id) => `"${id}"`).join(', ')}, which isn't a class in this pack; no character of that class will see the roll.`);
    });
  }
  return notes;
}

/** Kit rolls' `distinct` (bq-1): true or false; the app reads only `true` (a row can't be picked twice). */
function kitRollDistinctNotes(file) {
  const notes = [];
  for (const kit of entriesOf(file, 'startingKits')) {
    if (!Array.isArray(kit.rolls)) continue;
    kit.rolls.forEach((roll, i) => {
      if (!isObject(roll) || roll.distinct === undefined || typeof roll.distinct === 'boolean') return;
      const at = `startingKits: "${label(kit)}", roll ${i + 1}${typeof roll.name === 'string' ? ` ("${roll.name}")` : ''}`;
      notes.push(`${at}: distinct should be true or false; the app reads only true, so the same row can still be picked twice.`);
    });
  }
  return notes;
}

/** How many a name says the item holds: "Reed darts (12)" or "Pouch of 20 beads" (bag, pouch or case); else null. */
export function countInName(name) {
  if (!isText(name)) return null;
  const found = /\((\d+)\)\s*$/.exec(name) ?? /\b(?:bag|pouch|case)s?\s+of\s+(\d+)\b/i.exec(name);
  const n = found ? Number(found[1]) : null;
  return n !== null && n >= 2 ? n : null;
}

/** Items named as a bundle with no `bundle` field. */
function bundleNameNotes(file) {
  return entriesOf(file, 'items')
    .filter((item) => item.bundle === undefined && countInName(item.name) !== null)
    .map((item) => {
      const n = countInName(item.name);
      return `items: "${label(item)}": the name says ${n} ("${item.name}") but there is no bundle; give "bundle": ${n} and a unitName, so buying one adds ${n}.`;
    });
}

/**
 * Items placed as treasure (locations' treasure[].itemId) that a rules set won't count as treasure: their category
 * isn't in its treasureWeights and they don't say `treasure: true` (bq3-9).
 */
function treasureWeightNotes(file) {
  const items = new Map(entriesOf(file, 'items').filter((i) => isText(i.id)).map((i) => [i.id, i]));
  const placed = [];
  for (const location of entriesOf(file, 'locations')) {
    for (const t of (Array.isArray(location.treasure) ? location.treasure : []).filter(isObject)) {
      const item = isText(t.itemId) ? items.get(t.itemId) : undefined;
      if (item && isText(item.category) && !placed.includes(item)) placed.push(item);
    }
  }
  const notes = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    const weights = isObject(rules.encumbrance) && isObject(rules.encumbrance.treasureWeights) ? rules.encumbrance.treasureWeights : null;
    if (!weights) continue;
    const lacking = new Map();
    for (const item of placed.filter((i) => !(i.category in weights) && i.treasure !== true)) lacking.set(item.category, [...(lacking.get(item.category) ?? []), item]);
    for (const [category, found] of lacking) {
      notes.push(
        `rulesSets: "${label(rules)}": encumbrance.treasureWeights has no "${category}", but the pack places items of that category as treasure (${found.map((i) => (isText(i.name) ? i.name : i.id)).join(', ')}); the app won't count them as treasure. Name the category there, or give each item "treasure": true.`,
      );
    }
  }
  return notes;
}

const isWhole = (value) => Number.isInteger(value) && value >= 0;

/**
 * A container's weight by fill (eq-5): `weightEmpty` and `weightFull`, inside its `container` block or next to it,
 * both whole numbers; the app reads them only as a pair. A pair that differs needs a capacity to tell how full the
 * bag is (without one the app counts it full), and a full bag lighter than an empty one is likely a slip.
 */
function containerWeightNotes(file) {
  const notes = [];
  for (const item of entriesOf(file, 'items')) {
    const block = { ...(isObject(item.container) ? item.container : {}), ...Object.fromEntries(['weightEmpty', 'weightFull'].filter((k) => k in item).map((k) => [k, item[k]])) };
    const has = ['weightEmpty', 'weightFull'].filter((k) => block[k] !== undefined);
    if (has.length === 0) continue;
    const at = `items: "${label(item)}"`;
    const odd = has.filter((k) => !isWhole(block[k]));
    if (odd.length > 0) {
      notes.push(`${at}: ${odd.join(' and ')} should be a whole number (in the encumbrance unit); the app doesn't weigh the bag by fill.`);
      continue;
    }
    if (has.length === 1) {
      notes.push(`${at} gives ${has[0]} but not ${has[0] === 'weightEmpty' ? 'weightFull' : 'weightEmpty'}; the app weighs a bag by fill only with both (equal values for a fixed weight).`);
      continue;
    }
    if (block.weightFull < block.weightEmpty) notes.push(`${at}: weightFull (${block.weightFull}) is less than weightEmpty (${block.weightEmpty}), so the bag gets lighter as it fills.`);
    if (block.weightFull !== block.weightEmpty && block.capacityCoin === undefined && block.capacitySlots === undefined) {
      notes.push(`${at} weighs by fill but gives no capacityCoin or capacitySlots, so the app can't tell how full it is and always counts weightFull.`);
    }
  }
  return notes;
}

/**
 * An item's `carryBonus` (eq-6): a whole number above 0, in the encumbrance unit, counted only while the item is
 * worn or held, which needs a `slot` (armour, shield, hand or worn; `worn` for gloves, rings and belts, mb-5).
 */
function carryBonusNotes(file) {
  const notes = [];
  for (const item of entriesOf(file, 'items').filter((i) => i.carryBonus !== undefined)) {
    const at = `items: "${label(item)}"`;
    if (!Number.isInteger(item.carryBonus) || item.carryBonus <= 0) notes.push(`${at}: carryBonus should be a whole number above 0 (in the encumbrance unit); the app leaves it out.`);
    else if (!SLOTS.includes(item.slot)) {
      notes.push(`${at} has a carryBonus but no slot (armour, shield, hand or worn), so it can't be worn or held in the app and the bonus never counts; "slot": "worn" puts it on without taking a hand.`);
    }
  }
  return notes;
}

/** The slots the app puts items on in (07 items; `worn` added by mb-5, 2026-11-04). */
const SLOTS = ['armour', 'shield', 'hand', 'worn'];

/** An item's `slot` the app doesn't know: it can't be put on. */
function slotNotes(file) {
  return entriesOf(file, 'items')
    .filter((item) => item.slot !== undefined && item.slot !== null && !SLOTS.includes(item.slot))
    .map((item) => `items: "${label(item)}": slot ${JSON.stringify(item.slot)} isn't one the app knows (armour, shield, hand or worn), so it can't be put on.`);
}

/** The equipment notes for a parsed pack file; empty when nothing's amiss. Never throws on odd input. */
/**
 * A rules set's `weaponRules` (eq-7, mb-4; 07 Equipment): each `{ category, classCategories, exceptClasses?, note? }`.
 * The app reads a rule only with a text category and a list of class categories; an entry it can't read is left out
 * without a word, so it's noted. When the file has classes, a class category no class carries (as its
 * weaponProficiencyCategory) and an exceptClasses id that isn't a class here are noted too: the rule would reach
 * nobody, or except nobody.
 */
function weaponRuleNotes(file) {
  const notes = [];
  const classes = entriesOf(file, 'classes');
  const classIds = new Set(classes.filter((c) => isText(c.id)).map((c) => c.id.trim()));
  const categories = new Set(classes.filter((c) => isText(c.weaponProficiencyCategory)).map((c) => c.weaponProficiencyCategory.trim()));
  for (const rules of entriesOf(file, 'rulesSets')) {
    if (rules.weaponRules === undefined) continue;
    const at = `rulesSets: "${label(rules)}", weaponRules`;
    if (!Array.isArray(rules.weaponRules)) {
      notes.push(`${at} should be a list of { category, classCategories }; the app reads none of it.`);
      continue;
    }
    rules.weaponRules.forEach((rule, i) => {
      const here = `${at} ${i + 1}`;
      if (!isObject(rule) || !isText(rule.category) || !Array.isArray(rule.classCategories) || !rule.classCategories.every(isText)) {
        notes.push(`${here} needs a text category and classCategories as a list of class categories; the app leaves the rule out.`);
        return;
      }
      const named = `${here} ("${rule.category}")`;
      if (rule.exceptClasses !== undefined && (!Array.isArray(rule.exceptClasses) || !rule.exceptClasses.every(isText))) {
        notes.push(`${named}: exceptClasses should be a list of class ids; the app excepts no class.`);
      }
      if (rule.note !== undefined && typeof rule.note !== 'string') notes.push(`${named}: note should be text; the app shows none.`);
      if (classes.length === 0) return;
      for (const category of rule.classCategories) {
        if (!categories.has(category.trim())) notes.push(`${named} names the class category "${category}", which no class here carries as weaponProficiencyCategory.`);
      }
      if (Array.isArray(rule.exceptClasses)) {
        for (const id of rule.exceptClasses.filter(isText)) {
          if (!classIds.has(id.trim())) notes.push(`${named}: exceptClasses names "${id}", which isn't a class here.`);
        }
      }
    });
  }
  return notes;
}

/**
 * A class's `forms` (eq-8; 07 classes): each `{ id, name, weaponsAllowed?, armourAllowed?, note }`. The app reads a
 * form only with an id (a form without one is left out, so it's noted), takes the first as the form a character
 * starts in, and reads a form's limits like the class's own. Noted too: two forms with one id (the second can never
 * be the current form), and a form with neither limit (it changes nothing but the name).
 */
function formNotes(file) {
  const notes = [];
  for (const cls of entriesOf(file, 'classes')) {
    if (cls.forms === undefined) continue;
    const at = `classes: "${label(cls)}", forms`;
    if (!Array.isArray(cls.forms)) {
      notes.push(`${at} should be a list of { id, name, weaponsAllowed?, armourAllowed?, note }; the app reads none of it.`);
      continue;
    }
    const seen = new Set();
    cls.forms.forEach((form, i) => {
      const here = `${at} ${i + 1}`;
      if (!isObject(form) || !isText(form.id)) {
        notes.push(`${here} has no id; the app leaves the form out.`);
        return;
      }
      const named = `${here} ("${form.id}")`;
      if (seen.has(form.id.trim())) notes.push(`${named} repeats an earlier form's id; only the first can be the current form.`);
      seen.add(form.id.trim());
      if (!isText(form.name)) notes.push(`${named} has no name; the switch shows its id.`);
      if (form.weaponsAllowed !== undefined && !isObject(form.weaponsAllowed)) notes.push(`${named}: weaponsAllowed should be a rule like the class's; the app reads the class's instead.`);
      if (form.armourAllowed !== undefined && !isObject(form.armourAllowed)) notes.push(`${named}: armourAllowed should be a rule like the class's; the app reads the class's instead.`);
      if (!isObject(form.weaponsAllowed) && !isObject(form.armourAllowed)) notes.push(`${named} has neither weaponsAllowed nor armourAllowed; it changes nothing but the name.`);
    });
  }
  return notes;
}

/** A weapon block's `improvised` (R3-12): true or false; anything else is named (read as not improvised). */
function improvisedNotes(file) {
  return entriesOf(file, 'items').flatMap((item) =>
    isObject(item.weapon) && item.weapon.improvised !== undefined && typeof item.weapon.improvised !== 'boolean'
      ? [`items: "${label(item)}": weapon.improvised should be true or false; it's read as not improvised.`]
      : [],
  );
}

export function equipmentNotes(file) {
  if (!isObject(file)) return [];
  return [...improvisedNotes(file), ...kitRollNotes(file), ...kitRollClassNotes(file), ...kitRollDistinctNotes(file), ...bundleNameNotes(file), ...treasureWeightNotes(file), ...containerWeightNotes(file), ...carryBonusNotes(file), ...slotNotes(file), ...weaponRuleNotes(file), ...formNotes(file), ...weaponModeNotes(file)];
}

// The pack checker's notes on a weapon's magic bonus (ruled 2026-11-05: mw-1,
// docs/design/rulings/m6-weapon-magic-bonus-2026-11-05.md, G-147; mw-2, docs/design/rulings/m6-weapon-magic-bonus-2-2026-11-05.md).
// The app reads the fields in M6; the packs fill them now, by script from the bonus text, so the checker catches drift:
// - a weapon (an item with a `weapon` block) whose bonus text (`fields.Bonus`) says one bonus and whose
//   `weapon.magicBonus` says another, or none; the text's bonus is its first signed whole number that isn't an
//   against-a-kind bonus ("+1 to hit and damage; +3 vs dragons" says +1). Text with no such number isn't compared.
//   A `magicBonus` that isn't a whole number is noted too (mw-1 1: a whole number, negative when cursed).
// - a stray top-level `bonus` key on an item (mw-1 5): a weapon's bonus is `weapon.magicBonus`, armour's
//   `armour.magicBonus`.
// - a `weapon.bonusVs` entry with both `bonus` and `damage`, or neither (mw-2): `{ against, bonus }` is the total
//   bonus against that kind, `{ against, damage }` the total damage bonus with the attack bonus unchanged.
// Warnings only; nothing blocks an import. Used by scripts/pack-format.mjs; tested in scripts/pack-weapon-bonus.test.mjs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
const signed = (n) => (n > 0 ? `+${n}` : String(n));

/**
 * The bonus a weapon's text gives: its first signed whole number ("+2", "-1", "−1") not followed by "vs" or
 * "against"; null when it gives none.
 */
export function bonusInText(text) {
  if (!isText(text)) return null;
  for (const found of text.matchAll(/(?<!\w)([+\-−–])\s*(\d+)\b(?!\s*(?:vs\b|versus\b|against\b))/gi)) {
    const n = Number(found[2]);
    return found[1] === '+' ? n : -n;
  }
  return null;
}

/** mw-1: the bonus text against `weapon.magicBonus`, and `magicBonus` a whole number. */
function magicBonusNotes(file) {
  const notes = [];
  for (const item of entriesOf(file, 'items').filter((i) => isObject(i.weapon))) {
    const at = `items: "${label(item)}"`;
    const number = item.weapon.magicBonus;
    if (number !== undefined && !Number.isInteger(number)) {
      notes.push(`${at}: weapon.magicBonus should be a whole number (negative when cursed), not ${JSON.stringify(number)}.`);
      continue;
    }
    const text = isObject(item.fields) ? item.fields.Bonus : undefined;
    const said = bonusInText(text);
    if (said === null) continue;
    if (number === undefined) notes.push(`${at}: the bonus text says ${signed(said)} ("${text.trim()}") but there is no weapon.magicBonus; give "magicBonus": ${said} in its weapon block (mw-1).`);
    else if (number !== said) notes.push(`${at}: the bonus text says ${signed(said)} ("${text.trim()}") but weapon.magicBonus is ${signed(number)}; make them agree (mw-1).`);
  }
  return notes;
}

/** mw-1 5: a top-level `bonus` key on an item. */
function strayBonusNotes(file) {
  return entriesOf(file, 'items')
    .filter((item) => item.bonus !== undefined)
    .map((item) => `items: "${label(item)}" has a top-level bonus (${JSON.stringify(item.bonus)}), which the app doesn't read: a weapon's magic bonus is weapon.magicBonus (and weapon.bonusVs against a kind of foe), armour's is armour.magicBonus (mw-1).`);
}

/** mw-2: each `weapon.bonusVs` entry has `bonus` or `damage`, never both. */
function bonusVsNotes(file) {
  const notes = [];
  for (const item of entriesOf(file, 'items').filter((i) => isObject(i.weapon) && i.weapon.bonusVs !== undefined)) {
    const at = `items: "${label(item)}", weapon.bonusVs`;
    if (!Array.isArray(item.weapon.bonusVs)) {
      notes.push(`${at} should be a list of { against, bonus } or { against, damage } (mw-1, mw-2).`);
      continue;
    }
    item.weapon.bonusVs.forEach((entry, i) => {
      if (!isObject(entry)) {
        notes.push(`${at} ${i + 1} should be { against, bonus } or { against, damage } (mw-1, mw-2).`);
        return;
      }
      const named = `${at} ${i + 1}${isText(entry.against) ? ` ("${entry.against.trim()}")` : ''}`;
      const has = ['bonus', 'damage'].filter((k) => entry[k] !== undefined);
      if (has.length === 2) notes.push(`${named} has both bonus and damage; keep one: bonus is the total bonus against that kind, damage the total damage bonus with the attack bonus unchanged (mw-2).`);
      if (has.length === 0) notes.push(`${named} has neither bonus nor damage; give the total bonus against that kind as bonus, or the total damage bonus as damage (mw-2).`);
    });
  }
  return notes;
}

/** The weapon-bonus notes for a parsed pack file; empty when nothing's amiss. Never throws on odd input. */
export function weaponBonusNotes(file) {
  if (!isObject(file)) return [];
  return [...magicBonusNotes(file), ...strayBonusNotes(file), ...bonusVsNotes(file)];
}

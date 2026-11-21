// The pack checker's rules for a rules set's `rolls` (docs/design/rulings/dec-player-screen-2026-11-14.md, pf-20): per
// roll type (`save`, `abilityCheck` and, since tfs-2, `skill`), `{ "die": "d20", "pass": "atOrOver" | "atOrUnder" }`, read as the app
// reads it (src/modules/library/rolls.ts).
//   errors    a `rolls` that isn't an object; a roll type's entry that isn't one; a `die` the app cannot draw; a `pass`
//             that is neither value (each names the rules set and the roll type)
//   notes     a rules set with saves (`saveCategories`) and no `rolls.save`: the Saves section shows no line
// A roll type the app doesn't know yet is left alone (others come later, pf-20). Optional and additive: a rules set
// without `rolls` is fine.
//
// Used by scripts/check-pack.mjs (errors) and scripts/pack-format.mjs (notes); tested in scripts/pack-rolls.test.mjs.
import { ROLL_DICE, ROLL_PASS, ROLL_TYPES, rollDie } from '../src/modules/library/rolls.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const label = (rules, i) => (isText(rules.id) ? rules.id.trim() : isText(rules.name) ? rules.name.trim() : `#${i + 1}`);
const dice = ROLL_DICE.map((n) => `d${n}`).join(', ');

/** Whether a rules set has saves: its `saveCategories` names any. */
const hasSaves = (rules) => (Array.isArray(rules.saveCategories) ? rules.saveCategories.length > 0 : isObject(rules.saveCategories) && Object.keys(rules.saveCategories).length > 0);

/** Every rules set's `rolls`, checked: `{ errors, notes }`. Never throws on odd input. */
export function rollsCheck(file) {
  const errors = [];
  const notes = [];
  if (!isObject(file) || !Array.isArray(file.rulesSets)) return { errors, notes };
  file.rulesSets.forEach((rules, i) => {
    if (!isObject(rules)) return;
    const where = `rulesSets: "${label(rules, i)}": rolls`;
    const rolls = rules.rolls;
    if (rolls !== undefined && !isObject(rolls)) errors.push(`${where} should be keyed by roll type, like { "save": { "die": "d20", "pass": "atOrOver" } }.`);
    if (isObject(rolls)) {
      for (const type of ROLL_TYPES) {
        const roll = rolls[type];
        if (roll === undefined) continue;
        if (!isObject(roll)) {
          errors.push(`${where}.${type} should be { "die": "d20", "pass": "atOrOver" } (or "atOrUnder").`);
          continue;
        }
        if (!rollDie(roll.die)) errors.push(`${where}.${type}: die ${JSON.stringify(roll.die)} isn't a die the app can draw (${dice}).`);
        if (!ROLL_PASS.includes(roll.pass)) errors.push(`${where}.${type}: pass ${JSON.stringify(roll.pass)} should be "atOrOver" or "atOrUnder".`);
      }
    }
    if (hasSaves(rules) && !(isObject(rolls) && rolls.save !== undefined)) {
      notes.push(`rulesSets: "${label(rules, i)}" has saves and no rolls.save, so the Saves section shows no line saying what passes (fine if another attached pack's rules set carries it).`);
    }
  });
  return { errors, notes };
}

/** The errors alone, for scripts/check-pack.mjs. */
export const rollsErrors = (file) => rollsCheck(file).errors;

/** The notes alone, for scripts/pack-format.mjs. */
export const rollsNotes = (file) => rollsCheck(file).notes;

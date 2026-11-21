// The pack checker's rules for a `procedure` on a place and on the rules set (docs/design/rulings/
// dec-mockup-rulings-set2-2026-11-12.md pf-14, dec-mockup-rulings-sets3-5-2026-11-12.md pf-14a; 07, "`procedure` on a
// place and on the rules set"). The list shape the exploration modes already carry,
// `[{ id, name, icon?, kind?, checkId?, text? }]`, may also sit on a location (a region or a place in it) and on a rules
// set as its default.
//
// Errors (the checker exits 1): a procedure that isn't a list of steps; a step with no id or no name; two steps of
// one procedure with the same id; a step's `text` that is there but blank (empty words, only spaces, or null).
// Warnings, worded as a mode's steps get them (scripts/pack-exploration.mjs, stepNotes): a `kind` that isn't one of
// STEP_KINDS; a check step's checkId naming no check in this pack (it may live in another attached pack); and a
// procedure on any other kind of entry. A step's icon isn't checked here: an unknown name falls back
// in the app (pf-12c). A mode's own procedure keeps today's checks (scripts/pack-exploration.mjs), so a pack whose
// modes carry procedures reports what it did before.
//
// A step's `text` is the same thing as a rule's `text` (the lead, 2026-11-13, corrected the same day), so it is
// checked once, by the shared rule-text check (scripts/pack-rule-text.mjs, `ruleTextCheck`, pf-18 and pf-18a), with its
// words and its levels: that check's `ruleTextFields` reads every step's text on a place, a rules set, a mode and its
// camp. The one thing said here is a fact about the step, not the text's shape (the lead, 2026-11-13): a step with text
// is a tap that opens something, so text that is there but blank, which the shared check reads as words or as no text,
// would open nothing. An absent `text` is fine. So one fault is never reported twice.
//
// Used by scripts/check-pack.mjs (errors) and scripts/pack-format.mjs (warnings); tested in
// scripts/pack-procedure.test.mjs with invented packs.
import { STEP_KINDS } from './pack-exploration.mjs';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const label = (entry, fallback) => (isText(entry.id) ? entry.id.trim() : isText(entry.name) ? entry.name.trim() : fallback);
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);

/** The parts whose entries may carry a procedure of their own: a place, and the rules set as its default. */
const HOMES = ['locations', 'rulesSets'];

/** Every check id this pack carries: its modes' checks (a place's encounterCheck has no id in the format, 07). */
function checkIdsOf(file) {
  const ids = new Set();
  for (const rules of entriesOf(file, 'rulesSets')) {
    const modes = isObject(rules.exploration) && Array.isArray(rules.exploration.modes) ? rules.exploration.modes.filter(isObject) : [];
    for (const mode of modes) for (const check of Array.isArray(mode.checks) ? mode.checks.filter(isObject) : []) if (isText(check.id)) ids.add(check.id.trim());
  }
  return ids;
}

/** One procedure's errors and warnings, said at `where` ("locations: \"ew-jetty\""). */
function procedureFindings(where, procedure, checkIds) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(procedure)) {
    errors.push(`${where}: procedure should be a list of steps, each { id, name, icon?, kind?, checkId?, text? }.`);
    return { errors, warnings };
  }
  const seen = new Set();
  procedure.forEach((step, i) => {
    if (!isObject(step)) return errors.push(`${where}: procedure step ${i + 1} isn't a step; write { id, name, icon?, kind?, checkId?, text? }.`);
    const at = `${where}: procedure step "${label(step, `#${i + 1}`)}"`;
    if (!isText(step.id)) errors.push(`${at} has no id.`);
    else if (seen.has(step.id.trim())) errors.push(`${where}: procedure has two steps with the id "${step.id.trim()}"; each step needs its own.`);
    else seen.add(step.id.trim());
    if (!isText(step.name)) errors.push(`${at} has no name.`);
    if (step.text === null || (typeof step.text === 'string' && step.text.trim() === '')) {
      errors.push(`${at}: text should be the step's own words, or { "blocks": [ … ] } with at least one block, not ${JSON.stringify(step.text)}.`);
    }
    if (step.kind !== undefined && !STEP_KINDS.includes(step.kind)) warnings.push(`${at}: kind "${step.kind}" isn't one of ${STEP_KINDS.join(', ')}.`);
    if (step.kind === 'check' && isText(step.checkId) && !checkIds.has(step.checkId.trim())) warnings.push(`${at}: checkId "${step.checkId.trim()}" names no check in this pack (fine if another attached pack has it).`);
  });
  return { errors, warnings };
}

/** Everything this file checks: `{ errors, warnings }`, each a list of lines. Never throws on odd input. */
export function procedureCheck(file) {
  const errors = [];
  const warnings = [];
  if (!isObject(file)) return { errors, warnings };
  const checkIds = checkIdsOf(file);
  for (const part of HOMES) {
    entriesOf(file, part).forEach((entry, i) => {
      if (entry.procedure === undefined) return;
      const found = procedureFindings(`${part}: "${label(entry, `#${i + 1}`)}"`, entry.procedure, checkIds);
      errors.push(...found.errors);
      warnings.push(...found.warnings);
    });
  }
  for (const [part, value] of Object.entries(file)) {
    if (part === 'meta' || HOMES.includes(part) || !Array.isArray(value)) continue;
    value.filter(isObject).forEach((entry, i) => {
      if (entry.procedure !== undefined) warnings.push(`${part}: "${label(entry, `#${i + 1}`)}" has a procedure; only an exploration mode, a place or the rules set may carry one, so the app won't read it.`);
    });
  }
  return { errors, warnings };
}

/** The warnings alone, for scripts/pack-format.mjs. */
export const procedureNotes = (file) => procedureCheck(file).warnings;

/** The errors alone, for scripts/check-pack.mjs. */
export const procedureErrors = (file) => procedureCheck(file).errors;

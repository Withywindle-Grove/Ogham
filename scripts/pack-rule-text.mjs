// The pack checker's rules for rule text set out like the book (docs/design/rulings/dec-rule-text-blocks-2026-11-13.md,
// pf-18 and pf-18a): one shared function, `ruleTextCheck`, validates a value wherever a pack may carry rule text — a
// place rule's `text`, an area's `gm.text`, a GM section's `text` (pf-18b), a procedure step's `text` (on a place, a
// rules set, a mode or its camp), and a class's or a kindred's trait note, `abilities[].note` (tfb-5, 2026-11-19; also
// a kindred's `optionalAbilities.abilities[].note`). A trait note's links stay with the town check, which reads every
// string in a pack, so its links are not said twice; everything else is checked here by the one rule.
// It reads the value the way the app does (src/modules/library/ruleText.ts):
//   errors    whatever the reader leaves out (a value that is neither words nor { blocks }, a block with no known
//             marker or two, a block missing what it requires, a box inside a box, a list item that isn't words …)
//   warnings  no blocks at all ({ blocks: [] }: the app shows nothing); a source block that isn't the last; an empty title (a table's or a box's); a tableRef naming no table in
//             this pack, and a link naming nothing in this pack (either may live in another attached pack); a link of
//             a kind no link may name
// A plain string is always valid; only its links are checked. Links elsewhere in a pack stay with the town check
// (scripts/pack-town.mjs), which leaves these four fields to this one (RULE_TEXT_PATH), so nothing is said twice.
//
// Used by scripts/pack-format.mjs (warnings) and scripts/check-pack.mjs (errors, exit 1); tested in
// scripts/pack-rule-text.test.mjs with invented packs.
import { LINK_KINDS, linksIn } from '../src/modules/library/linkMarks.ts';
import { isRuleTextBlocks, readRuleText } from '../src/modules/library/ruleText.ts';
import { PART_OF } from './pack-town.mjs';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const list = (value) => (Array.isArray(value) ? value : []);

/** What a pack carries that a link or a tableRef may name: its own id, and its ids by link kind. */
export function ruleTextContext(file) {
  const ids = {};
  for (const [kind, part] of Object.entries(PART_OF)) ids[kind] = new Set(list(file?.[part]).filter((e) => isObject(e) && isText(e.id)).map((e) => e.id.trim()));
  return { own: isObject(file?.meta) && isText(file.meta.id) ? file.meta.id.trim() : '', ids };
}

/** Every string inside a value with its path ("locations[0].gm.text.blocks[2].p"). */
function stringsIn(value, path, out = []) {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => stringsIn(v, `${path}[${i}]`, out));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) stringsIn(v, `${path}.${k}`, out);
  return out;
}

/** The link notes for one text: a kind no link may name, or a link to this pack naming nothing in it. */
function linkWarnings(path, value, ctx) {
  const warnings = [];
  for (const [at, text] of stringsIn(value, path)) {
    if (!text.includes('[[')) continue;
    for (const link of linksIn(text)) {
      if (!LINK_KINDS.includes(link.kind)) warnings.push(`${at}: the link [[${link.kind}:${link.id}|${link.label}]] names "${link.kind}", which isn't a kind a link may name (${LINK_KINDS.join(', ')}).`);
      else if (link.kind !== 'rule' && (!link.packId || link.packId === ctx.own) && !ctx.ids[link.kind]?.has(link.id)) {
        warnings.push(`${at}: the link to ${link.kind} "${link.id}" names nothing in this pack (fine if another attached pack has it); the app shows "${link.label}" as plain text.`);
      }
    }
  }
  return warnings;
}

/** The warnings a list of raw blocks gets: a source not last (top level only), an empty title, a tableRef naming nothing. */
function blockWarnings(path, blocks, ctx, top) {
  const warnings = [];
  blocks.forEach((block, i) => {
    if (!isObject(block)) return;
    const at = `${path}[${i}]`;
    if (top && 'source' in block && blocks.slice(i + 1).some(isObject)) warnings.push(`${at}: a source block should be the last block; the app shows the source last.`);
    if (isObject(block.table) && typeof block.table.title === 'string' && !block.table.title.trim()) warnings.push(`${at}: the table's title is empty.`);
    if (Array.isArray(block.box)) {
      if (typeof block.title === 'string' && !block.title.trim()) warnings.push(`${at}: the box's title is empty; leave it out for a box with no title.`);
      warnings.push(...blockWarnings(`${at}.box`, block.box, ctx, false));
    }
    if (isText(block.tableRef) && !ctx.ids.table.has(block.tableRef.trim())) warnings.push(`${at}: tableRef "${block.tableRef.trim()}" names no table in this pack (fine if another attached pack has it).`);
  });
  return warnings;
}

/**
 * The shared check for one rule text at `path` (as the town check writes paths: "locations[0].gm.text"): `{ errors,
 * warnings }`. `ctx` is ruleTextContext(file). Never throws on odd input.
 */
export function ruleTextCheck(value, path, ctx, { links = true } = {}) {
  // No text: absent, or null (as before this reader).
  if (value === undefined || value === null) return { errors: [], warnings: [] };
  const { leftOut } = readRuleText(value);
  const errors = leftOut.map((line) => `${path}: ${line}`);
  const warnings = [];
  // The one test of rule text in blocks, the screens' too (isRuleTextBlocks): anything else was an error above.
  if (isRuleTextBlocks(value)) {
    if (value.blocks.length === 0) warnings.push(`${path}: has no blocks; the app shows nothing. Leave the text out, or give it blocks.`);
    warnings.push(...blockWarnings(`${path}.blocks`, value.blocks, ctx, true));
  }
  if (links && (typeof value === 'string' || isRuleTextBlocks(value))) warnings.push(...linkWarnings(path, value, ctx));
  return { errors, warnings };
}

/**
 * Every trait note a pack carries, as [path, value] (tfb-5): a class's and a kindred's `abilities[].note`, a kindred's
 * `optionalAbilities.abilities[].note`, and the abilities a `byOption` choice gives either. A plain string is always valid; `{ blocks }` takes pf-18's shape.
 */
export function traitNoteFields(file) {
  if (!isObject(file)) return [];
  const fields = [];
  const notes = (path, abilities) => list(abilities).forEach((a, j) => isObject(a) && a.note !== undefined && fields.push([`${path}.abilities[${j}].note`, a.note]));
  for (const part of ['classes', 'races']) {
    list(file[part]).forEach((entry, i) => {
      if (!isObject(entry)) return;
      notes(`${part}[${i}]`, entry.abilities);
      if (part === 'races' && isObject(entry.optionalAbilities)) notes(`${part}[${i}].optionalAbilities`, entry.optionalAbilities.abilities);
      // A choice's abilities (`byOption`, cs-5 and of-3): read by the app as any other trait once that choice is made.
      if (isObject(entry.byOption)) for (const [key, change] of Object.entries(entry.byOption)) if (isObject(change)) notes(`${part}[${i}].byOption["${key}"]`, change.abilities);
    });
  }
  return fields;
}

/** Every rule text a pack carries, as [path, value]: the four fields wherever 07 allows them (pf-18, pf-18b, pf-14). */
export function ruleTextFields(file) {
  if (!isObject(file)) return [];
  const fields = [];
  const steps = (path, procedure) => list(procedure).forEach((step, i) => isObject(step) && step.text !== undefined && fields.push([`${path}.procedure[${i}].text`, step.text]));
  list(file.locations).forEach((place, i) => {
    if (!isObject(place)) return;
    list(place.rules).forEach((rule, j) => isObject(rule) && rule.text !== undefined && fields.push([`locations[${i}].rules[${j}].text`, rule.text]));
    if (isObject(place.gm) && place.gm.text !== undefined) fields.push([`locations[${i}].gm.text`, place.gm.text]);
    if (isObject(place.gm)) list(place.gm.sections).forEach((section, j) => isObject(section) && section.text !== undefined && fields.push([`locations[${i}].gm.sections[${j}].text`, section.text]));
    steps(`locations[${i}]`, place.procedure);
  });
  list(file.rulesSets).forEach((rules, i) => {
    if (!isObject(rules)) return;
    steps(`rulesSets[${i}]`, rules.procedure);
    const modes = isObject(rules.exploration) ? list(rules.exploration.modes) : [];
    modes.forEach((mode, k) => {
      if (!isObject(mode)) return;
      steps(`rulesSets[${i}].exploration.modes[${k}]`, mode.procedure);
      if (isObject(mode.camp)) steps(`rulesSets[${i}].exploration.modes[${k}].camp`, mode.camp.procedure);
    });
  });
  return fields;
}

/** Every rule text in the file, checked: `{ errors, warnings }`. */
export function ruleTextFileCheck(file) {
  const ctx = ruleTextContext(file);
  const errors = [];
  const warnings = [];
  for (const [path, value] of ruleTextFields(file)) {
    const found = ruleTextCheck(value, path, ctx);
    errors.push(...found.errors);
    warnings.push(...found.warnings);
  }
  for (const [path, value] of traitNoteFields(file)) {
    const found = ruleTextCheck(value, path, ctx, { links: false });
    errors.push(...found.errors);
    warnings.push(...found.warnings);
  }
  return { errors, warnings };
}

/** The warnings alone, for scripts/pack-format.mjs. */
export const ruleTextNotes = (file) => ruleTextFileCheck(file).warnings;

/** The errors alone, for scripts/check-pack.mjs. */
export const ruleTextErrors = (file) => ruleTextFileCheck(file).errors;

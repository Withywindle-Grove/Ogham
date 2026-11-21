// The pack checker's format checks for the one-line descriptions ruled at the M5 gate (2026-11-01; docs/07):
// - tables (B2, G-44): a table's `description`, each row's `note`, and the `description` of a stat block a row
//   names (the row shows it when it has no note). 07 says pack:check warns when one isn't text; a missing one
//   is fine (converters fill `note` only where the book gives one).
// - conditions (B6): `notes` is the brief effect shown under the status's name everywhere; 07 says pack:check
//   warns when it's missing. A `notes` that isn't text is treated as missing (nothing could show).
// - classes and races (ruled by Francis 2026-11-07): `description`, the book's descriptive paragraphs shown in the
//   entry after the blurb, must be text when given.
// - conditions' look (R3-6, 2026-11-08): `tone`, when given, is one of light, harm, boon or neutral (the Status
//   ring's colour); `icon`, when given, names one of the app's status symbols (src/modules/expedition/statusLook.ts).
//   Anything else is read as none (an ink ring, the first letter), so the checker warns.
// `conditions[].family` (G-46) has no check: 07 doesn't say what to warn on. Nothing here blocks an import.
//
// Used by scripts/pack-format.mjs (JSON packs) and scripts/check-pack.mjs (Markdown packs' conditions);
// tested in scripts/pack-descriptions.test.mjs with invented packs.

import { STATUS_SYMBOLS, STATUS_TONES } from '../src/modules/expedition/statusLook.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
/** Present (not left out, not null) but not words. An empty string counts as left out. */
const notText = (value) => value !== undefined && value !== null && value !== '' && !isText(value);
const rowLabel = (row, i) => {
  if (row.min !== undefined) return `row ${row.min}${row.max !== undefined && row.max !== row.min ? `–${row.max}` : ''}`;
  if (row.key !== undefined) return `row ${row.key}`;
  return `row #${i + 1}`;
};

/** Tables: description, rows' note, and the description of each stat block a row names. */
export function tableDescriptionNotes(file) {
  if (!isObject(file)) return [];
  const notes = [];
  const named = new Set();
  for (const table of entriesOf(file, 'tables')) {
    const where = `tables: "${label(table)}"`;
    if (notText(table.description)) notes.push(`${where}: description should be one line of words (what the table covers).`);
    const rows = Array.isArray(table.rows) ? table.rows : [];
    rows.forEach((row, i) => {
      if (!isObject(row)) return;
      if (notText(row.note)) notes.push(`${where}, ${rowLabel(row, i)}: note should be one line of words.`);
      if (isText(row.statBlockId)) named.add(row.statBlockId.trim());
    });
  }
  for (const block of entriesOf(file, 'statBlocks')) {
    if (isText(block.id) && named.has(block.id.trim()) && notText(block.description)) {
      notes.push(`statBlocks: "${label(block)}": description should be one line of words; table rows that name it show it.`);
    }
  }
  return notes;
}

/** Conditions: each needs `notes`, its brief effect. Takes the list of conditions (JSON or Markdown, read the same). */
export function conditionNoteNotes(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions
    .filter(isObject)
    .filter((condition) => !isText(condition.notes))
    .map((condition) => `conditions: "${label(condition)}": no notes; the brief effect shown under the status's name would be blank.`);
}

/**
 * Conditions' look on the Status ring (R3-6): a `tone` outside light, harm, boon and neutral, or an `icon` outside the
 * app's status symbols, is read as none; say so. Takes the list of conditions (JSON or Markdown, read the same).
 */
export function conditionLookNotes(conditions) {
  if (!Array.isArray(conditions)) return [];
  const notes = [];
  for (const condition of conditions.filter(isObject)) {
    const where = `conditions: "${label(condition)}"`;
    if (condition.tone !== undefined && condition.tone !== null && !STATUS_TONES.includes(condition.tone)) {
      notes.push(`${where}: tone "${String(condition.tone)}" isn't one of ${STATUS_TONES.join(', ')}; its ring would be ink.`);
    }
    if (condition.icon !== undefined && condition.icon !== null && !STATUS_SYMBOLS.includes(condition.icon)) {
      notes.push(`${where}: icon "${String(condition.icon)}" isn't one of the app's status symbols; its ring would show its first letter.`);
    }
  }
  return notes;
}

/** Classes and races: a `description`, when given, is plain text (one or two paragraphs). */
export function entryDescriptionNotes(file) {
  if (!isObject(file)) return [];
  return ['classes', 'races'].flatMap((part) =>
    entriesOf(file, part)
      .filter((entry) => entry.description !== undefined && typeof entry.description !== 'string')
      .map((entry) => `${part}: "${label(entry)}": description should be text (the book's paragraphs); it won't show.`),
  );
}

/** Everything this file checks, for a parsed JSON pack. Never throws on odd input. */
export function descriptionNotes(file) {
  if (!isObject(file)) return [];
  return [...tableDescriptionNotes(file), ...conditionNoteNotes(file.conditions), ...conditionLookNotes(file.conditions), ...entryDescriptionNotes(file)];
}

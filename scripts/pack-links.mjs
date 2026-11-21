// The pack checker's notes from the independent re-check of pack review area 2 (2026-11-03): the links between a
// pack's parts that the app reads quietly. A check's onHit.columns or a terrain's encounterColumn naming a column its
// table doesn't have (the app opens the table's first column instead); a table's nextTablePattern filling in ids that
// aren't tables (that row leads nowhere); a row's next table by terrain (next.byTerrain or next.default, ga-2)
// naming a table this file doesn't have; and an encumbrance movement written as a number (the app reads it now; text
// is preferred). Warnings only; nothing blocks. The table links use the app's own reading (src/modules/expedition/
// tables.ts), so the checker matches ids the way the app does: any case, a trailing marker such as "*" trimmed.
//
// Used by scripts/pack-format.mjs; tested in scripts/pack-links.test.mjs with invented packs.
import { readTable, resultAsId, resultOf, rowLabel, rowLeadsTo, tableLookup } from '../src/modules/expedition/tables.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry, fallback = '(no id)') => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : fallback);
const textList = (value) => (Array.isArray(value) ? value.filter(isText) : []);

/** The columns of each table in this file, by id, as the app reads them. */
function tableColumns(file) {
  const byId = new Map();
  for (const t of entriesOf(file, 'tables')) {
    if (!isText(t.id)) continue;
    byId.set(t.id, Array.isArray(t.columns) ? t.columns.map((c) => (typeof c === 'string' ? c.trim() : typeof c === 'number' ? String(c) : '')).filter(Boolean) : []);
  }
  return byId;
}

/** `"Marsh" isn't a column of table "fen-kinds" (Road, Wild); …`; with `which`, `"Marsh", which isn't …`. */
const missing = (column, id, columns, which = false) => `"${column}"${which ? ', which' : ''} isn't a column of table "${id}" (${columns.join(', ')}); the app would open its first column instead.`;

/** A check's onHit table ids (tableId or tableChoices). */
const onHitTables = (onHit) => (isObject(onHit) ? (textList(onHit.tableChoices).length ? textList(onHit.tableChoices) : isText(onHit.tableId) ? [onHit.tableId] : []) : []);

/**
 * onHit.columns and encounterColumn against the table they pick a column of (07, Terrain; Checks). A table this file
 * doesn't hold, or one with fewer than two columns (no column to pick), is left alone.
 */
export function columnNotes(file) {
  if (!isObject(file)) return [];
  const columnsOf = tableColumns(file);
  const picks = (id) => (columnsOf.get(id)?.length ?? 0) > 1;
  const notes = [];
  for (const rules of entriesOf(file, 'rulesSets')) {
    const modes = isObject(rules.exploration) && Array.isArray(rules.exploration.modes) ? rules.exploration.modes.filter(isObject) : [];
    for (const mode of modes) {
      const where = `rulesSets: "${label(rules)}", mode "${label(mode, '?')}"`;
      const checks = (Array.isArray(mode.checks) ? mode.checks : []).filter(isObject);
      for (const [i, check] of checks.entries()) {
        const at = `${where}, check "${label(check, `#${i + 1}`)}"`;
        const columns = isObject(check.onHit) ? textList(check.onHit.columns) : [];
        for (const id of onHitTables(check.onHit).filter(picks)) {
          for (const column of columns) if (!columnsOf.get(id).includes(column)) notes.push(`${at}: onHit.columns names ${missing(column, id, columnsOf.get(id), true)}`);
        }
      }
      // A terrain's column picks its own encounter table's, else the column of what the mode's checks roll.
      const checkTables = [...new Set(checks.flatMap((c) => onHitTables(c.onHit)))].filter(picks);
      for (const [i, t] of (Array.isArray(mode.terrain) ? mode.terrain : []).entries()) {
        if (!isObject(t) || !isText(t.encounterColumn)) continue;
        const at = `${where}, terrain "${label(t, `#${i + 1}`)}"`;
        const targets = isText(t.encounterTableId) ? [t.encounterTableId].filter(picks) : checkTables;
        if (targets.length === 0 || targets.some((id) => columnsOf.get(id).includes(t.encounterColumn))) continue;
        for (const id of targets) notes.push(`${at}: encounterColumn ${missing(t.encounterColumn, id, columnsOf.get(id))}`);
      }
    }
  }
  return notes;
}

/** A table's nextTablePattern, filled in with each result, against the tables in this file (the app's matching). */
export function nextTablePatternNotes(file) {
  if (!isObject(file)) return [];
  const tables = entriesOf(file, 'tables');
  const known = tableLookup(tables.map((t) => t.id).filter(isText));
  const notes = [];
  for (const t of tables) {
    if (!isText(t.nextTablePattern) || !isText(t.id)) continue;
    const read = readTable(t.id, isText(t.name) ? t.name : t.id, t);
    if (!read) continue;
    const columns = read.columns.length > 1 ? read.columns : [null];
    const unmatched = new Set();
    for (const row of read.rows) {
      for (const column of columns) {
        const result = resultOf(read, row, column);
        if (!result || result === '—' || rowLeadsTo(read, row, column, known)) continue;
        unmatched.add(read.nextTablePattern.replace('{result}', resultAsId(result)));
      }
    }
    for (const id of unmatched) {
      notes.push(`tables: "${t.id}": nextTablePattern "${t.nextTablePattern}" fills in "${id}", which isn't a table in this pack; that row leads nowhere (fine if another attached pack has it).`);
    }
  }
  return notes;
}

/** A row's `next: { byTerrain, default }` (ga-2) naming a table this file doesn't hold (the app's matching). */
export function nextByTerrainNotes(file) {
  if (!isObject(file)) return [];
  const tables = entriesOf(file, 'tables');
  const known = tableLookup(tables.map((t) => t.id).filter(isText));
  const notes = [];
  for (const t of tables) {
    if (!isText(t.id)) continue;
    const read = readTable(t.id, isText(t.name) ? t.name : t.id, t);
    if (!read) continue;
    for (const row of read.rows) {
      if (!row.next) continue;
      const at = `tables: "${t.id}", row "${rowLabel(row)}"`;
      for (const { key, tableId } of row.next.byTerrain) {
        if (!known(tableId)) notes.push(`${at}: next.byTerrain "${key}" names "${tableId}", which isn't a table in this pack; in that terrain the row opens its default instead (fine if another attached pack has it).`);
      }
      if (row.next.default && !known(row.next.default)) notes.push(`${at}: next.default names "${row.next.default}", which isn't a table in this pack; elsewhere the row leads nowhere (fine if another attached pack has it).`);
    }
  }
  return notes;
}

/** Encumbrance movement written as a number (a tier's movement, an armour row's withoutTreasure or withTreasure). */
export function movementNumberNotes(file) {
  if (!isObject(file)) return [];
  const notes = [];
  const note = (where, field, value) => notes.push(`${where}: ${field} is the number ${value}; the app reads it as "${value}", but text is preferred ("${value} ft").`);
  for (const rules of entriesOf(file, 'rulesSets')) {
    const enc = isObject(rules.encumbrance) ? rules.encumbrance : null;
    if (!enc) continue;
    const where = `rulesSets: "${label(rules)}"`;
    for (const mode of ['coin', 'slot']) {
      const tiers = isObject(enc[mode]) && Array.isArray(enc[mode].tiers) ? enc[mode].tiers.filter(isObject) : [];
      for (const [i, tier] of tiers.entries()) {
        if (typeof tier.movement === 'number') note(`${where}: encumbrance.${mode}.tiers "${isText(tier.label) ? tier.label : `#${i + 1}`}"`, 'movement', tier.movement);
      }
    }
    const rows = isObject(enc.armour) && Array.isArray(enc.armour.movement) ? enc.armour.movement.filter(isObject) : [];
    for (const [i, row] of rows.entries()) {
      for (const field of ['withoutTreasure', 'withTreasure']) {
        if (typeof row[field] === 'number') note(`${where}: encumbrance.armour.movement "${isText(row.armour) ? row.armour : `#${i + 1}`}"`, field, row[field]);
      }
    }
  }
  return notes;
}

/** Everything this file checks. */
export function linkNotes(file) {
  return [...columnNotes(file), ...nextTablePatternNotes(file), ...nextByTerrainNotes(file), ...movementNumberNotes(file)];
}

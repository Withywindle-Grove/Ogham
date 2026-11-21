// The pack checker's notes on a pack's `sheetFields` (ruled 2026-11-04, docs/design/rulings/m5b-sheet-review-2026-11-04.md
// sr-10 and its technical confirmation; 07, `sheetFields`; docs/plans/m5b-sheet.md, build order 6).
// A setting pack lists its printed character sheet's fields, `[{ name, home, option? }]`; `home` names a field key in
// one of the stack's layouts, an app figure (SHEET_FIGURES) or `pack` (the Pack tab). A field with `option` counts only
// while that choice is on. A rules overlay (`meta.requires`) may carry its own, for the fields its rules add.
//   sheetFieldNotes: the list's shape and its option gates (format notes).
//   homelessFields: the printed fields with no home: no `home`, or a home that names nothing. Checked alone, an
//     overlay's home that isn't in its own layout waits for the stack (its base's layout may have it).
//   ungatedHomes: a printed field with `option` homed in a layout field that has none: the app reads only the
//     layout's gate (of-9; `sheetFields` is never imported), so the sheet would show it with the option off.
// Notes, never errors. Used by scripts/check-pack.mjs; tested in scripts/pack-sheet-fields.test.mjs (invented packs).
import { optionGateNotes } from './pack-option-gates.mjs';

/** The app's own figures a printed field may live in (07, `sheetFields`). */
export const SHEET_FIGURES = ['name', 'class', 'portrait', 'hp', 'ac', 'attack', 'level', 'xp', 'saves', 'movement', 'skills', 'traits', 'magic', 'languages', 'notes'];
/** The Pack tab. */
export const PACK_TAB = 'pack';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';

/** The pack file's `sheetFields` that are objects (none when it has none or isn't JSON). */
export function sheetFieldsOf(file) {
  return Array.isArray(file?.sheetFields) ? file.sheetFields.filter(isObject) : [];
}

/** Whether a pack file is a rules overlay (it requires another pack, 07 `meta.requires`). */
export function isOverlay(file) {
  return Array.isArray(file?.meta?.requires) && file.meta.requires.length > 0;
}

/** Every field key in the entries' layouts (`fieldTemplates`). */
export function layoutKeys(entries) {
  const keys = new Set();
  for (const layout of entries.filter((e) => e.kind === 'fieldTemplate')) {
    for (const field of Array.isArray(layout.data.fields) ? layout.data.fields : []) if (isObject(field) && isText(field.key)) keys.add(field.key.trim());
  }
  return keys;
}

const label = (field) => (isText(field.name) ? field.name.trim() : '(no name)');
const optionText = (option) => (Array.isArray(option) ? option.join(' or ') : String(option));
/** " (only with a=b or a=c)" for a gated field, else "". */
const onlyWith = (field) => (field.option === undefined ? '' : ` (only with ${optionText(field.option)})`);

/**
 * The shape of `sheetFields` and its option gates, as format notes. options: the option entries to check gates
 * against (the pack's own; with `library`, every pack's).
 */
export function sheetFieldNotes(file, options, library = false) {
  if (file?.sheetFields === undefined) return [];
  if (!Array.isArray(file.sheetFields)) return ['sheetFields should be a list of { name, home } (07, sr-10).'];
  const notes = [];
  file.sheetFields.forEach((field, i) => {
    if (!isObject(field)) notes.push(`sheetFields: item ${i + 1} should be { name, home }.`);
    else if (!isText(field.name)) notes.push(`sheetFields: item ${i + 1} has no name (the printed field's name).`);
    else if (field.home !== undefined && typeof field.home !== 'string') notes.push(`sheetFields: "${field.name}": home should be a layout field key, a figure (${SHEET_FIGURES.join(', ')}) or "pack".`);
  });
  // The option gates read like any entry's (of-3, of-12): one choice or a list, each a choice the option has.
  const gated = sheetFieldsOf(file)
    .filter((f) => f.option !== undefined)
    .map((f) => ({ kind: 'sheetFields', packEntryId: label(f), data: { option: f.option } }));
  if (gated.length > 0) notes.push(...optionGateNotes([...options, ...gated], library).filter((n) => n.startsWith('sheetFields:')));
  return notes;
}

/**
 * The printed fields with no home, one line each: "<name>" for a field with no `home`, or why its home names nothing.
 * keys: the layout field keys it may name (the pack's own; across a stack, every pack's). waitForStack: an overlay
 * checked alone, whose unknown homes aren't counted (returned in `waiting` instead).
 */
export function homelessFields(file, keys, waitForStack = false) {
  const homeless = [];
  const waiting = [];
  for (const field of sheetFieldsOf(file).filter((f) => isText(f.name))) {
    const where = `"${label(field)}"${onlyWith(field)}`;
    if (field.home === undefined || (typeof field.home === 'string' && field.home.trim() === '')) {
      homeless.push(where);
      continue;
    }
    if (typeof field.home !== 'string') continue; // a shape note already says so
    const home = field.home.trim();
    if (home === PACK_TAB || SHEET_FIGURES.includes(home) || keys.has(home)) continue;
    if (waitForStack) waiting.push(`${where}: home "${home}"`);
    else homeless.push(`${where}: home "${home}" isn't a figure, the Pack tab or a field in ${keys.size > 0 ? 'the layout' : 'any layout (none given)'}`);
  }
  return { homeless, waiting };
}

/**
 * The printed fields gated by an option whose home is a layout field with no gate of its own, one note each. The app
 * hides a field only by its layout's `option` (of-9), the `from` list it reads or its layout's own `option`;
 * `sheetFields` is the checker's list and never imported (pack-format.mjs), so such a field shows with its option off.
 * A home an ungated printed field also lives in is meant to show always and isn't noted. entries: the layouts to
 * look in (the pack's own; across a stack, every pack's); files: the pack files whose printed fields share homes (the
 * pack alone; across a stack, every pack). A home in no layout is left to homelessFields.
 */
export function ungatedHomes(file, entries, files = [file]) {
  const homes = new Map();
  for (const layout of entries.filter((e) => e.kind === 'fieldTemplate')) {
    const layoutGated = layout.data.option !== undefined || layout.data.onlyWithOption !== undefined;
    for (const field of Array.isArray(layout.data.fields) ? layout.data.fields : []) {
      if (!isObject(field) || !isText(field.key)) continue;
      const gated = layoutGated || field.option !== undefined || isText(field.from);
      const key = field.key.trim();
      homes.set(key, (homes.get(key) ?? false) || gated);
    }
  }
  // A home an ungated printed field shares (a gated note inside an ability, say) is meant to show always.
  const alwaysHomes = new Set(files.flatMap(sheetFieldsOf).filter((f) => f.option === undefined && isText(f.home)).map((f) => f.home.trim()));
  const notes = [];
  for (const field of sheetFieldsOf(file).filter((f) => isText(f.name) && f.option !== undefined && isText(f.home))) {
    const home = field.home.trim();
    if (homes.get(home) !== false || alwaysHomes.has(home)) continue;
    notes.push(
      `sheetFields: "${label(field)}" counts only with ${optionText(field.option)}, but its home "${home}" in the layout has no option, so the sheet shows it with that option off: give the layout field the same option (of-9).`,
    );
  }
  return notes;
}

// pack:check on a save modifier read from a kindred's field alone (pf-21, docs/design/rulings/dec-player-screen-2026-11-14.md):
// a rules set's `saveModifiers` entry whose `value` is { "raceField": "<field>" }. The shape is accepted; a `raceField`
// that isn't a field name is noted, so is one no kindred carries with a number that shows, and so is one beside `fill`
// or `from` (the reader takes only one shape). Checked alone, a file is only noted when it has
// kindreds of its own (an overlay's may come from its base); checked together, across every file given.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (Array.isArray(file?.[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** Each rules set's save modifiers with a `raceField`: where, and the field. */
function raceFieldModifiers(file) {
  return entriesOf(file, 'rulesSets').flatMap((rules) =>
    (Array.isArray(rules.saveModifiers) ? rules.saveModifiers.filter(isObject) : [])
      .filter((m) => isObject(m.value) && 'raceField' in m.value)
      .map((m) => ({ where: `rulesSets: "${label(rules)}": saveModifiers "${label(m)}"`, field: m.value.raceField, beside: ['fill', 'from'].filter((k) => k in m.value) })),
  );
}

/**
 * The notes for one file alone, or (together) for every file given as one stack. Together, only the fields no
 * kindred in any of the files carries; a malformed `raceField` is said by the file alone.
 */
export function saveModifierNotes(files, together = false) {
  const notes = [];
  const races = files.flatMap((f) => entriesOf(f, 'races'));
  // A kindred carries the field when it holds a whole number other than nought there: the only value that shows (pf-21).
  const carried = new Set(races.flatMap((r) => Object.keys(r).filter((k) => Number.isInteger(r[k]) && r[k] !== 0)));
  for (const { where, field, beside } of files.flatMap(raceFieldModifiers)) {
    // The reader takes one shape (fill, then raceField, then from): a raceField beside another is half ignored.
    if (!together && beside.length > 0) {
      notes.push(`${where}: value has raceField beside ${beside.join(' and ')}; the app reads only ${beside.includes('fill') ? 'fill' : 'raceField'}. Keep one shape (pf-21).`);
    }
    if (!isText(field)) {
      if (!together) notes.push(`${where}: value.raceField should name a kindred's field, like "hexWard" (pf-21).`);
      continue;
    }
    if (races.length === 0 && !together) continue;
    if (!carried.has(field.trim())) notes.push(`${where}: value.raceField "${field}" is a field no kindred ${together ? 'in these packs' : 'in this pack'} carries with a whole number other than nought, so it shows for no one.`);
  }
  return notes;
}

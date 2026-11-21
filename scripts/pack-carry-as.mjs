// The pack checker's two load notes ruled 2026-11-05 (docs/plans/m5b-review-area-3.md, build orders 14 and 15):
// - al-1 (docs/design/rulings/m5b-armour-load-type-2026-11-05.md, G-145): an armour's `armour.type` is the category it
//   carries as (load and movement); `armourType` alone decides who may wear it. `carriesAsList` LISTS every item whose
//   two fields differ (a list, not a warning), so a typo in a near-twin field shows. `armourType` is often an id
//   ("leather") rather than a category, so the comparison reads it as a category: itself when it is light, medium or
//   heavy, else the row the stack's rules sets map it to (`encumbrance.armour.armourTypes`); an id no rules set maps
//   can't be compared and stays off the list (checked together with its rules set's pack, it is compared).
//   Chosen-base armour (`armourType: "chosen"`) that names its own `armour.type` carries as that, whatever base is
//   picked, so it is listed too.
// - cb-1 (docs/design/rulings/m5b-carry-bonus-band-2026-11-05.md): with slot bands (`encumbrance.slot.bands`) a
//   `carryBonus` adds its room to the stowed band; `carryBonusBandNotes` notes each such item, so the question comes
//   back to Francis when a real one exists.
// Both take a list of parsed pack files: one file alone, or every file of a stack (scripts/check-pack.mjs prints only
// what the stack adds). Never throws on odd input. Tested in scripts/pack-carry-as.test.mjs (invented packs).

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (isObject(file) && Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** The categories an armour may carry as (07, the armour block's `type`). */
const CATEGORIES = ['light', 'medium', 'heavy'];

/** Every rules set's `encumbrance.armour.armourTypes` across the files, merged (the first file's mapping wins). */
function armourTypeRows(files) {
  const rows = new Map();
  for (const rules of files.flatMap((f) => entriesOf(f, 'rulesSets'))) {
    const map = isObject(rules.encumbrance) && isObject(rules.encumbrance.armour) && isObject(rules.encumbrance.armour.armourTypes) ? rules.encumbrance.armour.armourTypes : {};
    for (const [type, row] of Object.entries(map)) if (isText(row) && !rows.has(type)) rows.set(type, row.trim());
  }
  return rows;
}

/**
 * al-1: one line per armour whose `armour.type` (what it carries as) differs from the category its `armourType` wears
 * as: "<item>: worn as <armourType>, carries as <armour.type>". Empty when none do.
 */
export function carriesAsList(files) {
  const rows = armourTypeRows(files);
  const lines = [];
  for (const item of files.flatMap((f) => entriesOf(f, 'items'))) {
    const carries = isObject(item.armour) && isText(item.armour.type) ? item.armour.type.trim() : null;
    if (carries === null || !isText(item.armourType)) continue;
    const worn = item.armourType.trim();
    const name = isText(item.name) ? ` (${item.name.trim()})` : '';
    if (worn === 'chosen') {
      lines.push(`"${label(item)}"${name}: the base is chosen when found, but it carries as ${carries} whatever base is picked`);
      continue;
    }
    const wornAs = CATEGORIES.includes(worn) ? worn : rows.get(worn);
    if (wornAs === undefined || wornAs === carries) continue;
    lines.push(`"${label(item)}"${name}: worn as ${worn}${wornAs === worn ? '' : ` (${wornAs})`}, carries as ${carries}`);
  }
  return lines;
}

/** cb-1: a note per item with a `carryBonus` when a rules set in the files uses slot bands. */
export function carryBonusBandNotes(files) {
  const banded = files
    .flatMap((f) => entriesOf(f, 'rulesSets'))
    .filter((r) => isObject(r.encumbrance) && isObject(r.encumbrance.slot) && r.encumbrance.slot.bands !== undefined)
    .map((r) => `"${label(r)}"`);
  if (banded.length === 0) return [];
  return files
    .flatMap((f) => entriesOf(f, 'items'))
    .filter((item) => item.carryBonus !== undefined)
    .map((item) => `items: "${label(item)}" has a carryBonus and the rules set ${banded.join(', ')} uses slot bands: a carry bonus goes to the stowed band (cb-1). Ask for a ruling if it should raise the equipped band instead.`);
}

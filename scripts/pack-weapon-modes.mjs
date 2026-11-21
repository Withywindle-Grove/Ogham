// The pack checker's notes on an item's `weapon.modes` (G-211; 07 items): { button, list: [{ id, name, draws?,
// qualities?, damage?, toHit?, note? }] }. The app reads it in src/modules/inventory/weaponModes.ts (weaponModesOf);
// these notes name what it would quietly drop or ignore:
// - a button outside quiver, pouch, grip, stance (the app reads no modes at all);
// - a mode with no id or no name (left out), or two modes with the same id;
// - a mode quality the weapon's own `qualities` don't carry (compared trimmed, ignoring case);
// - a toHit that isn't a whole number, or a damage that isn't dice (ignored);
// - fewer than two modes (the app shows no button for one);
// - a `draws.itemId` that no item has, by id or as a baseId (across every file given together).
// Warnings and notes only; nothing blocks an import. Used by scripts/pack-equipment.mjs (the file's own parts) and
// scripts/check-pack.mjs (draws, across the files). Tested in scripts/pack-weapon-modes.test.mjs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
const DICE = /^\d*d\d+([+-]\d+)?$/i;
const BUTTONS = ['quiver', 'pouch', 'grip', 'stance'];

const itemsOf = (file) => (isObject(file) && Array.isArray(file.items) ? file.items.filter(isObject) : []);

/** The notes on one file's weapon modes, apart from the item ids a mode draws (those need every file). */
export function weaponModeNotes(file) {
  const notes = [];
  for (const item of itemsOf(file)) {
    if (!isObject(item.weapon) || item.weapon.modes === undefined) continue;
    const at = `items: "${label(item)}": weapon.modes`;
    const block = item.weapon.modes;
    if (!isObject(block)) {
      notes.push(`${at} should be { button, list: [{ id, name, … }] }; the app reads none of it.`);
      continue;
    }
    const button = isText(block.button) ? block.button.trim().toLowerCase() : null;
    if (!BUTTONS.includes(button)) notes.push(`${at}: button should be one of ${BUTTONS.join(', ')}; the app reads no modes without it.`);
    if (!Array.isArray(block.list)) {
      notes.push(`${at}: list should be a list of modes; the app reads none.`);
      continue;
    }
    if (block.list.length < 2) notes.push(`${at} has ${block.list.length === 0 ? 'no mode' : 'one mode'}; the app shows no button for fewer than two.`);
    const weaponQualities = new Set((Array.isArray(item.weapon.qualities) ? item.weapon.qualities : []).filter((q) => typeof q === 'string').map((q) => q.trim().toLowerCase()));
    const seen = new Set();
    block.list.forEach((mode, i) => {
      if (!isObject(mode)) {
        notes.push(`${at}: mode ${i + 1} isn't { id, name, … }; the app leaves it out.`);
        return;
      }
      const named = isText(mode.id) ? `${at}: mode "${mode.id}"` : `${at}: mode ${i + 1}`;
      const missing = [!isText(mode.id) && 'id', !isText(mode.name) && 'name'].filter(Boolean);
      if (missing.length > 0) notes.push(`${named} has no ${missing.join(' or ')}; the app leaves it out.`);
      if (isText(mode.id)) {
        if (seen.has(mode.id.trim())) notes.push(`${named}: the id is used by another mode of this weapon; give each its own.`);
        seen.add(mode.id.trim());
      }
      if (mode.qualities !== undefined) {
        if (!Array.isArray(mode.qualities)) notes.push(`${named}: qualities should be a list of the weapon's own quality strings; the app reads none.`);
        else
          for (const q of mode.qualities) {
            if (typeof q !== 'string' || !weaponQualities.has(q.trim().toLowerCase())) notes.push(`${named}: quality ${JSON.stringify(q)} isn't one of the weapon's own qualities, so it won't match the weapon's tags.`);
          }
      }
      if (mode.toHit !== undefined && !(typeof mode.toHit === 'number' && Number.isInteger(mode.toHit))) notes.push(`${named}: toHit should be a whole number; the app ignores it.`);
      if (mode.damage !== undefined && !(typeof mode.damage === 'string' && DICE.test(mode.damage.trim()))) notes.push(`${named}: damage should be dice like "1d6" or "1d8+1"; the app shows it as written and can't roll it.`);
    });
  }
  return notes;
}

/**
 * Every `draws.itemId` against the items of all the files given (an item's id, or a baseId, as the app matches it).
 * `packs` is [{ name, file }]; the files may be one or several.
 */
export function weaponModeDrawsNotes(packs) {
  const known = new Set();
  for (const p of packs) for (const item of itemsOf(p.file)) for (const id of [item.id, item.baseId]) if (isText(id)) known.add(id.trim());
  const several = packs.length > 1;
  const notes = [];
  for (const p of packs)
    for (const item of itemsOf(p.file)) {
      const list = isObject(item.weapon) && isObject(item.weapon.modes) && Array.isArray(item.weapon.modes.list) ? item.weapon.modes.list : [];
      for (const mode of list) {
        if (!isObject(mode) || !isObject(mode.draws) || mode.draws.itemId === undefined) continue;
        const id = mode.draws.itemId;
        if (!isText(id) || !known.has(id.trim())) notes.push(`${several ? `${p.name}, ` : ''}items: "${label(item)}": weapon.modes mode "${isText(mode.id) ? mode.id : '(no id)'}" draws ${JSON.stringify(id)}, which no item has as its id or baseId${several ? ' in these files' : ''}; the mode would find nothing to spend.`);
      }
    }
  return notes;
}

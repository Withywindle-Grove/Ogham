// The pack checker's notes on spells found in play (us-1, ruled 2026-11-05,
// docs/design/rulings/m7-uncommon-spells-2026-11-05.md; G-149; 07 "Spells found in play"; the app in M7).
// An uncommon spell is an entry in `spells` with no `lists`, carrying
// `uncommon: { lists: { <list id>: <rank> }, foundAt: [{ placeId?, hex?, note? }] }`. The ruling's three warnings:
// - an uncommon spell that also has `lists` (anything reading the lists would offer it before it's found);
// - a list id in `uncommon.lists` that isn't a spell list or a class (a spell's `lists` may name either, 07);
// - a `foundAt` `placeId` that isn't a location id in the attached packs.
// `uncommonSpellNotes(file)` gives the first (and the block's shape); `uncommonReferenceNotes(files, together)` the
// other two: checked alone, an id this file lacks may be in a pack it goes with (a region pack holds the places), so
// the note asks for both files together; checked together (`together`), an id no file has is noted as such.
// Warnings only. Used by scripts/pack-format.mjs and scripts/check-pack.mjs; tested in scripts/pack-uncommon-spells.test.mjs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const entriesOf = (file, part) => (isObject(file) && Array.isArray(file[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

const uncommonOf = (file) => entriesOf(file, 'spells').filter((s) => s.uncommon !== undefined);
const SHAPE = 'uncommon should be { lists: { <list id>: <rank> }, foundAt: [{ placeId?, hex?, note? }] } (us-1)';

/** An uncommon spell with `lists`, and an `uncommon` block the checker can't read. */
export function uncommonSpellNotes(file) {
  const notes = [];
  for (const spell of uncommonOf(file)) {
    const at = `spells: "${label(spell)}"`;
    if (spell.lists !== undefined) notes.push(`${at} is uncommon but also has lists, so the lists would offer it before anyone finds it; drop lists (uncommon.lists says where it joins once found; us-1).`);
    const block = spell.uncommon;
    if (!isObject(block)) {
      notes.push(`${at}: ${SHAPE}.`);
      continue;
    }
    if (!isObject(block.lists) || Object.keys(block.lists).length === 0) notes.push(`${at}: uncommon.lists should name the list and rank it joins once found, such as { "<list id>": 3 } (us-1).`);
    else for (const [id, rank] of Object.entries(block.lists)) if (!Number.isInteger(rank) || rank < 0) notes.push(`${at}: uncommon.lists "${id}" should be a whole-number rank, not ${JSON.stringify(rank)}.`);
    if (block.foundAt !== undefined && (!Array.isArray(block.foundAt) || !block.foundAt.every(isObject))) notes.push(`${at}: uncommon.foundAt should be a list of { placeId?, hex?, note? } (us-1).`);
  }
  return notes;
}

/**
 * Unknown list ids and placeIds in uncommon spells. files: one file alone, or every file checked together.
 * together: the files are the whole set (an unknown id is in none of them); else the note asks for the pack that has it.
 */
export function uncommonReferenceNotes(files, together = false) {
  const lists = new Set([...files.flatMap((f) => entriesOf(f, 'spellLists')), ...files.flatMap((f) => entriesOf(f, 'classes'))].filter((e) => isText(e.id)).map((e) => e.id.trim()));
  const places = new Set(files.flatMap((f) => entriesOf(f, 'locations')).filter((l) => isText(l.id)).map((l) => l.id.trim()));
  const where = together ? "isn't in any of these packs" : "isn't in this pack; check it together with the pack that has it (npm run pack:check -- <this file> <that file>)";
  const notes = [];
  for (const spell of files.flatMap(uncommonOf).filter((s) => isObject(s.uncommon))) {
    const at = `spells: "${label(spell)}"`;
    if (isObject(spell.uncommon.lists)) {
      for (const id of Object.keys(spell.uncommon.lists).filter((k) => !lists.has(k.trim()))) notes.push(`${at}: uncommon.lists names "${id}", a spell list or class that ${where}.`);
    }
    for (const found of (Array.isArray(spell.uncommon.foundAt) ? spell.uncommon.foundAt : []).filter(isObject)) {
      if (found.placeId === undefined) continue;
      if (!isText(found.placeId)) notes.push(`${at}: uncommon.foundAt placeId should be a location id, not ${JSON.stringify(found.placeId)}.`);
      else if (!places.has(found.placeId.trim())) notes.push(`${at}: uncommon.foundAt names the place "${found.placeId}", a location that ${where}.`);
    }
  }
  return notes;
}

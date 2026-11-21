// The shape check for `overlays` and `modifications` (fi-5, ruled 2026-11-04, area-4 build order 2; 07 "New kinds"):
// the fields 07 lists, `meta.requires` present, every `links[].statBlockId` resolving in the required pack (when its
// file is passed, in stack order), reaction rows with a `result`. Shape only: the importer and the app's reading of
// the data stay M6-13. The shapes no ruling has settled yet (G-131 a reaction table with a column per creature,
// G-132 `reactionColumn`, G-133 words as a stat change, `adds.triggers`) are listed as notes, never errors.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const list = (values) => values.join(', ');
const entriesOf = (file, part) => (Array.isArray(file?.[part]) ? file[part].filter(isObject) : []);
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
const ids = (file) =>
  Array.isArray(file?.meta?.requires) ? file.meta.requires.map((r) => (typeof r === 'string' ? r : r?.packId)).filter(isText) : [];

export const PROFILE_KEYS = ['wants', 'appearance', 'voice', 'intelligence', 'morality', 'other'];
export const NUDGE_WHEN = ['start', 'winning', 'losing', 'belowHalf', 'alone', 'leaderDown', 'any'];
export const TRIGGER_EVENTS = ['firstSight', 'death', 'belowFraction', 'eachRound', 'round', 'firstWound'];
const BEHAVIOUR_KEYS = ['id', 'name', 'profile', 'nudges', 'abilities', 'triggers', 'actionMenu', 'tables', 'numbers', 'source'];
/** Not in 07 yet; a note names the gap that holds each. */
const UNRULED_BEHAVIOUR_KEYS = { reactionColumn: 'G-132' };
const REACTION_USE = 'encounters.reaction';

const usesOf = (table) => (Array.isArray(table.uses) ? table.uses : isText(table.uses) ? [table.uses] : isText(table.use) ? [table.use] : []);

function profileNotes(at, profile) {
  if (profile === undefined) return [];
  if (!isObject(profile)) return [`${at}: profile should be { wants, appearance, voice, intelligence, morality?, other? }.`];
  const notes = [];
  for (const key of Object.keys(profile)) {
    if (!PROFILE_KEYS.includes(key)) notes.push(`${at}: profile has "${key}", which isn't one of ${list(PROFILE_KEYS)}; a further book line goes in other: [{ label, text }].`);
    else if (key !== 'other' && !isText(profile[key])) notes.push(`${at}: profile.${key} should be words.`);
  }
  if (profile.other !== undefined && !(Array.isArray(profile.other) && profile.other.every((o) => isObject(o) && isText(o.label) && isText(o.text)))) notes.push(`${at}: profile.other should be a list like [{ "label": "…", "text": "…" }].`);
  return notes;
}

function lineListNotes(at, field, rows, check) {
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) return [`${at}: ${field} should be a list.`];
  return rows.flatMap((row, i) => check(row, `${at}, ${field} ${i + 1}`));
}

function behaviourNotes(at, behaviour) {
  const notes = [];
  if (!isText(behaviour.id)) notes.push(`${at}: needs an id.`);
  if (!isText(behaviour.name)) notes.push(`${at}: needs a name.`);
  for (const key of Object.keys(behaviour)) {
    if (BEHAVIOUR_KEYS.includes(key)) continue;
    if (UNRULED_BEHAVIOUR_KEYS[key]) continue; // counted once per file in unruledNotes
    notes.push(`${at}: ${key} isn't a behaviour field in 07 (${list(BEHAVIOUR_KEYS.filter((k) => k !== 'source'))}).`);
  }
  notes.push(...profileNotes(at, behaviour.profile));
  notes.push(...lineListNotes(at, 'nudges', behaviour.nudges, (n, w) => {
    if (!isObject(n) || !isText(n.text)) return [`${w}: needs text.`];
    return n.when !== undefined && !NUDGE_WHEN.includes(n.when) ? [`${w}: when "${n.when}" isn't one of ${list(NUDGE_WHEN)}.`] : [];
  }));
  notes.push(...lineListNotes(at, 'abilities', behaviour.abilities, (a, w) => (isObject(a) && isText(a.name) && isText(a.text) ? [] : [`${w}: needs a name and text.`])));
  notes.push(...lineListNotes(at, 'triggers', behaviour.triggers, (t, w) => {
    if (!isObject(t) || !isText(t.text)) return [`${w}: needs text.`];
    return TRIGGER_EVENTS.includes(t.event) ? [] : [`${w}: event "${t.event}" isn't one of ${list(TRIGGER_EVENTS)}.`];
  }));
  if (behaviour.actionMenu !== undefined && !isObject(behaviour.actionMenu)) notes.push(`${at}: actionMenu should be { pick, options: [ability ids] }.`);
  else if (isObject(behaviour.actionMenu) && behaviour.actionMenu.options !== undefined && !Array.isArray(behaviour.actionMenu.options)) notes.push(`${at}: actionMenu.options should be a list of ability ids.`);
  if (behaviour.tables !== undefined && !isObject(behaviour.tables)) notes.push(`${at}: tables should be { tactics?, signs?, lair?, other: [table ids] }.`);
  if (behaviour.numbers !== undefined && !isObject(behaviour.numbers)) notes.push(`${at}: numbers should be an object of the behaviour's own figures.`);
  return notes;
}

function overlayNotes(file) {
  const notes = [];
  if (file.overlays === undefined) return notes;
  if (!Array.isArray(file.overlays)) return ['overlays should be a list of { id, name, keepNumbers?, links, behaviours }.'];
  if (ids(file).length === 0) notes.push('overlays: the file has overlays but no meta.requires; an overlay lays its behaviours on another pack\'s stat blocks, so name that pack.');
  const seen = new Set();
  const tableIds = new Set(entriesOf(file, 'tables').map((t) => t.id));
  for (const [i, overlay] of file.overlays.entries()) {
    if (!isObject(overlay)) {
      notes.push(`overlays: entry ${i + 1} isn't an overlay.`);
      continue;
    }
    const where = `overlays: "${label(overlay)}"`;
    if (!isText(overlay.id)) notes.push(`overlays: entry ${i + 1} needs an id.`);
    else if (seen.has(overlay.id)) notes.push(`${where} appears twice.`);
    else seen.add(overlay.id);
    if (!isText(overlay.name)) notes.push(`${where}: needs a name.`);
    if (overlay.keepNumbers !== undefined && typeof overlay.keepNumbers !== 'boolean') notes.push(`${where}: keepNumbers is true or false.`);
    const behaviours = Array.isArray(overlay.behaviours) ? overlay.behaviours.filter(isObject) : [];
    if (!Array.isArray(overlay.behaviours) || behaviours.length === 0) notes.push(`${where}: behaviours should be a list of { id, name, … }.`);
    const behaviourIds = new Set();
    for (const b of behaviours) {
      const at = `${where}, behaviour "${label(b)}"`;
      if (isText(b.id)) {
        if (behaviourIds.has(b.id)) notes.push(`${at} appears twice.`);
        behaviourIds.add(b.id);
      }
      notes.push(...behaviourNotes(at, b));
      if (isObject(b.tables)) for (const t of Object.values(b.tables).flat().filter((x) => isText(x) && !tableIds.has(x))) notes.push(`${at}: tables names "${t}", which isn't a table in this file (fine if the required pack has it).`);
    }
    if (overlay.links === undefined) notes.push(`${where}: has no links; the app would only suggest name matches, which the GM confirms once.`);
    else if (!Array.isArray(overlay.links)) notes.push(`${where}: links should be a list of { packId?, statBlockId, behaviourId }.`);
    else {
      const required = ids(file);
      for (const [j, link] of overlay.links.entries()) {
        const at = `${where}, link ${j + 1}`;
        if (!isObject(link) || !isText(link.statBlockId) || !isText(link.behaviourId)) {
          notes.push(`${at}: should be { packId?, statBlockId, behaviourId }.`);
          continue;
        }
        if (link.packId !== undefined && !isText(link.packId)) notes.push(`${at}: packId should be a pack id.`);
        else if (isText(link.packId) && required.length > 0 && !required.includes(link.packId)) notes.push(`${at}: packId "${link.packId}" isn't in meta.requires.`);
        if (!behaviourIds.has(link.behaviourId)) notes.push(`${at}: behaviourId "${link.behaviourId}" isn't one of this overlay's behaviours.`);
      }
    }
  }
  return notes;
}

function modificationNotes(file) {
  const notes = [];
  if (file.modifications === undefined) return notes;
  if (!Array.isArray(file.modifications)) return ['modifications should be a list of { id, name, statChanges, adds, notes }.'];
  const seen = new Set();
  for (const [i, mod] of file.modifications.entries()) {
    if (!isObject(mod)) {
      notes.push(`modifications: entry ${i + 1} isn't a modification.`);
      continue;
    }
    const where = `modifications: "${label(mod)}"`;
    if (!isText(mod.id)) notes.push(`modifications: entry ${i + 1} needs an id.`);
    else if (seen.has(mod.id)) notes.push(`${where} appears twice.`);
    else seen.add(mod.id);
    if (!isText(mod.name)) notes.push(`${where}: needs a name.`);
    if (mod.statChanges !== undefined) {
      if (!isObject(mod.statChanges)) notes.push(`${where}: statChanges should be { hd?, ac?, morale?, hp?, … }.`);
      else {
        const words = Object.entries(mod.statChanges).filter(([, v]) => typeof v !== 'number' && !isText(v));
        for (const [key] of words) notes.push(`${where}: statChanges.${key} should be a number or words.`);
      }
    }
    if (mod.adds !== undefined) {
      if (!isObject(mod.adds)) notes.push(`${where}: adds should be { abilities?, nudges? }.`);
      else {
        for (const key of ['abilities', 'nudges']) if (mod.adds[key] !== undefined && !Array.isArray(mod.adds[key])) notes.push(`${where}: adds.${key} should be a list.`);
        for (const key of Object.keys(mod.adds).filter((k) => !['abilities', 'nudges', 'triggers'].includes(k))) notes.push(`${where}: adds.${key} isn't a field in 07 (abilities, nudges); it is kept and not read.`);
      }
    }
    if (mod.notes !== undefined && !isText(mod.notes)) notes.push(`${where}: notes should be words.`);
  }
  return notes;
}

/** The shapes no ruling has settled (G-131 … G-133), one note each however many entries carry them. */
function unruledNotes(file) {
  const notes = [];
  const behaviours = entriesOf(file, 'overlays').flatMap((o) => (Array.isArray(o.behaviours) ? o.behaviours.filter(isObject) : []));
  const columns = behaviours.filter((b) => b.reactionColumn !== undefined).length;
  if (columns > 0) notes.push(`${columns} behaviour${columns === 1 ? '' : 's'} carry reactionColumn, which isn't ruled yet (G-132); kept, not read.`);
  const words = entriesOf(file, 'modifications').filter((m) => isObject(m.statChanges) && Object.values(m.statChanges).some((v) => isText(v) && !/^[+-]?\d+$/.test(v.trim())));
  if (words.length > 0) notes.push(`${words.length} modification${words.length === 1 ? ' has' : 's have'} a statChanges value in words, not a figure; not ruled yet (G-133), kept and shown, not worked out.`);
  const triggers = entriesOf(file, 'modifications').filter((m) => isObject(m.adds) && m.adds.triggers !== undefined).length;
  if (triggers > 0) notes.push(`${triggers} modification${triggers === 1 ? '' : 's'} add triggers, which isn't ruled yet (G-133); kept, not read.`);
  return notes;
}

/** Reaction tables: every row needs a `result` (a column per creature, G-131, is noted, not refused). */
function reactionRowNotes(file) {
  const notes = [];
  for (const table of entriesOf(file, 'tables').filter((t) => usesOf(t).includes(REACTION_USE))) {
    const where = `tables: "${label(table)}"`;
    const rows = Array.isArray(table.rows) ? table.rows.filter(isObject) : [];
    const byColumn = rows.filter((r) => r.result === undefined && isObject(r.results));
    if (table.columns !== undefined || byColumn.length > 0) notes.push(`${where}: a reaction table with a column per creature isn't ruled yet (G-131); its rows are kept, not read.`);
    const bare = rows.filter((r) => !isText(r.result) && !isObject(r.results));
    if (bare.length > 0) notes.push(`${where}: ${bare.length} reaction row${bare.length === 1 ? ' has' : 's have'} no result.`);
  }
  return notes;
}

/** The shape notes for one file; nothing here needs another pack. */
export function monsterOverlayNotes(file) {
  if (!isObject(file)) return [];
  return [...overlayNotes(file), ...modificationNotes(file), ...unruledNotes(file), ...(file.overlays !== undefined || file.modifications !== undefined ? reactionRowNotes(file) : [])];
}

/**
 * Each overlay link against the required pack's stat blocks, for the files given (packs = [{ name, file, id,
 * requires }], in stack order). A link names its pack, or falls back to the file's meta.requires. Returns notes and a
 * summary line per overlay (how many links resolve), the way 07 says the check lists them.
 */
export function monsterOverlayLibrary(packs) {
  const notes = [];
  const summary = [];
  for (const p of packs) {
    for (const overlay of entriesOf(p.file, 'overlays')) {
      const links = Array.isArray(overlay.links) ? overlay.links.filter((l) => isObject(l) && isText(l.statBlockId)) : [];
      let resolved = 0;
      for (const link of links) {
        const wanted = isText(link.packId) ? [link.packId] : (p.requires ?? []);
        const targets = packs.filter((q) => q !== p && wanted.includes(q.id));
        if (targets.length === 0) {
          notes.push(`${p.name}: overlays: "${label(overlay)}": link to "${link.statBlockId}" waits for ${wanted.length > 0 ? `pack "${wanted.join('", "')}"` : 'its required pack'}, which isn't among the files checked together.`);
        } else if (targets.some((t) => entriesOf(t.file, 'statBlocks').some((b) => b.id === link.statBlockId))) resolved += 1;
        else notes.push(`${p.name}: overlays: "${label(overlay)}": link to stat block "${link.statBlockId}", which ${targets.map((t) => t.name).join(' and ')} doesn't have.`);
      }
      summary.push(`${p.name}: overlay "${label(overlay)}": ${resolved} of ${links.length} links resolve to a stat block.`);
    }
  }
  return { notes, summary };
}

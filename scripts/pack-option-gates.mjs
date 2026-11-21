// The pack checker's notes on option gates with several choices (of-12) and on overlay patches (of-13), ruled
// 2026-11-03 (docs/design/rulings/m5b-options-format-2-2026-11-03.md; docs/plans/options-gates.md, build order 3).
//   optionGateNotes: an entry's `option` (one spec or a list) and `byOption` keys (one choice or several,
//     comma-separated) naming a choice its option doesn't have. Checked alone, a pack is checked against its own
//     options only (an overlay names its base's); with `library` (every pack being checked), against all of them, an
//     option that `extends` another adding its choices (of-1), and an option no pack has is a note too.
//   patchNotes: the shape of a pack's `patches[]` ({ byOption, match: { kind, category?, ids? }, change | option: null }).
//   patchLibraryNotes: a patch whose `match` finds nothing in the packs being checked, whose byOption names an
//     unknown choice, or whose `change` names a path a matched entry lacks (bq3-17 (2): it changes nothing there).
//     The app applies patches through the shared option reader (src/modules/library/patches.ts, PR 3b).
// Notes, never errors. Used by scripts/check-pack.mjs; tested in scripts/pack-option-gates.test.mjs (invented packs).
import { entryOptionSpec, specParts } from '../src/modules/library/optionGate.ts';
import { PACK_PARTS, PLAYER_FACING } from '../src/modules/library/packFile.ts';
import { adjustDice, atPath } from '../src/modules/library/patches.ts';
import { hiddenByKind, planSet, withSet } from '../src/modules/library/patchPath.ts';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const KINDS = [...new Set(Object.values(PACK_PARTS))];
const PART_OF = new Map(Object.entries(PACK_PARTS).map(([part, kind]) => [kind, part]));

/** Each option's choice ids by option id: its own and, with `library`, those of any option extending it (of-1). */
function choicesById(entries, library) {
  const out = new Map();
  const ids = (data) => (Array.isArray(data.choices) ? data.choices : []).filter(isObject).map((c) => c.id).filter(isText);
  const options = entries.filter((e) => e.kind === 'option');
  for (const o of options) if (!isText(o.data.extends)) out.set(o.packEntryId, new Set([...(out.get(o.packEntryId) ?? []), ...ids(o.data)]));
  if (library) for (const o of options.filter((e) => isText(e.data.extends))) if (out.has(o.data.extends.trim())) for (const id of ids(o.data)) out.get(o.data.extends.trim()).add(id);
  return out;
}

/** One part of a spec against the options known: a note, or null. `bare` allows "<option>" (its `on` choice). */
function partNote(where, part, known, library) {
  const choices = known.get(part.option);
  if (!choices) return library ? `${where} names option "${part.option}", which isn't in any of these packs.` : null;
  const wanted = part.choice || 'on';
  if (choices.size === 0 || choices.has(wanted)) return null;
  if (!part.choice) return `${where} names option "${part.option}" with no choice, which means its "on" choice, but it has none (${[...choices].join(', ')}); write "${part.option}=<choice>".`;
  return `${where} names choice "${part.choice}", which isn't one of option "${part.option}"'s choices (${[...choices].join(', ')}).`;
}

/** The notes on one `byOption` key: written "<option>=<choice>" (several comma-separated), each choice known. */
function keyNotes(where, key, known, library) {
  const parts = specParts(key);
  if (parts.length === 0 || parts.some((p) => !p.choice) || key.split(',').some((p) => !p.trim())) {
    return [`${where} "${key}" should be written "<option>=<choice>", several comma-separated ("<option>=<a>,<option>=<b>").`];
  }
  return parts.map((p) => partNote(`${where} "${key}"`, p, known, library)).filter((n) => n !== null);
}

/** Every `byOption` table in a rules set (it may sit in any section, 07). */
function byOptionTables(value, path, out = []) {
  if (!isObject(value)) return out;
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'byOption' && isObject(inner)) out.push({ at: path ? `${path}.byOption` : 'byOption', table: inner });
    else if (isObject(inner)) byOptionTables(inner, path ? `${path}.${key}` : key, out);
  }
  return out;
}

/**
 * Entries' `option` and `byOption` choices (of-3, of-12). entries: as the app's reader returns them ({ kind,
 * packEntryId, data }). Races' byOption keys are raceOptions.ts's; tables' onlyWithOption is pack-exploration.mjs's.
 */
export function optionGateNotes(entries, library = false) {
  const known = choicesById(entries, library);
  const notes = [];
  // Patches' `byOption` and `option: null` are their own (patchNotes, patchLibraryNotes), not gates.
  for (const entry of entries.filter((e) => e.kind !== 'option' && e.kind !== 'patch')) {
    const where = `${PART_OF.get(entry.kind) ?? entry.kind}: "${entry.packEntryId}"`;
    const { option } = entry.data;
    if (option !== undefined && !isText(option) && !(Array.isArray(option) && option.length > 0 && option.every(isText))) {
      notes.push(`${where}: option should be "<option>=<choice>" or a list of them (any of them, 07 of-12).`);
    }
    for (const part of specParts(entry.kind === 'table' ? option : entryOptionSpec(entry.data))) {
      const note = partNote(`${where}: option`, part, known, library);
      if (note) notes.push(note);
    }
    if (entry.kind === 'race') continue;
    const tables = entry.kind === 'rulesSet' ? byOptionTables(entry.data, '') : isObject(entry.data.byOption) ? [{ at: 'byOption', table: entry.data.byOption }] : [];
    for (const { at, table } of tables) for (const key of Object.keys(table)) notes.push(...keyNotes(`${where}: ${at}`, key, known, library));
  }
  return [...new Set(notes)];
}

/**
 * Sheet fields' `forClasses` and `forRaces` (cs-3, of-3): a list of class or kindred ids (one word is read as a list
 * of one), each naming one the packs have; and a field `from` a table players can't read (`gmOnly` not false: a
 * player's device never gets it, so the field is free text). Checked alone, an id is a note only when the pack has
 * entries of that kind (an overlay names its base's); with `library`, against every pack.
 */
export function fieldGateNotes(entries, library = false, waitsForStack = false) {
  const notes = [];
  const ids = (kind) => new Set(entries.filter((e) => e.kind === kind).map((e) => e.packEntryId));
  const known = { forClasses: ids('class'), forRaces: ids('race') };
  const tables = new Map(entries.filter((e) => e.kind === 'table').map((e) => [e.packEntryId, e]));
  for (const layout of entries.filter((e) => e.kind === 'fieldTemplate')) {
    for (const field of (Array.isArray(layout.data.fields) ? layout.data.fields : []).filter(isObject)) {
      const where = `fieldTemplates: "${layout.packEntryId}": field "${isText(field.key) ? field.key : '?'}"`;
      for (const gate of ['forClasses', 'forRaces']) {
        const value = field[gate];
        if (value === undefined) continue;
        const list = isText(value) ? [value] : Array.isArray(value) && value.every(isText) ? value : null;
        if (!list || list.length === 0) {
          notes.push(`${where}: ${gate} should be a list of ${gate === 'forClasses' ? 'class' : 'kindred'} ids.`);
          continue;
        }
        if (known[gate].size === 0 && !library) continue;
        for (const id of list) if (!known[gate].has(id.trim())) notes.push(`${where}: ${gate} names "${id.trim()}", which isn't a ${gate === 'forClasses' ? 'class' : 'kindred'} ${library ? 'in any of these packs' : 'in this pack'}${waitsForStack && !library ? ' (fine if a required pack has it; check the packs together)' : ''}; the field is hidden from everyone else.`);
      }
      const table = isText(field.from) ? tables.get(field.from.trim()) : undefined;
      if (table && table.data.gmOnly !== false) notes.push(`${where}: reads table "${field.from.trim()}", which players can't read (add "gmOnly": false), so creation asks it as free text.`);
    }
  }
  return [...new Set(notes)];
}

const patchLabel =(index) => `patches #${index + 1}`;

/** The shape of a pack's `patches[]` (of-13): one file alone. */
export function patchNotes(file) {
  if (!isObject(file) || file.patches === undefined) return [];
  if (!Array.isArray(file.patches)) return ['patches should be a list of { byOption, match, change } (07, of-13).'];
  const notes = [];
  file.patches.forEach((patch, i) => {
    const where = patchLabel(i);
    if (!isObject(patch)) return notes.push(`${where} should be { byOption, match, change } or { byOption, match, option: null }.`);
    if (!isText(patch.byOption)) notes.push(`${where}: byOption should name the choices it applies under, like "<option>=<choice>" (several comma-separated).`);
    else if (specParts(patch.byOption).some((p) => !p.choice) || patch.byOption.split(',').some((p) => !p.trim())) notes.push(`${where}: byOption "${patch.byOption}" should be written "<option>=<choice>", several comma-separated.`);
    const match = patch.match;
    if (!isObject(match)) notes.push(`${where}: match should be { kind, category?, ids? }.`);
    else {
      if (!isText(match.kind) || !KINDS.includes(match.kind.trim())) notes.push(`${where}: match.kind should be an entry kind (${KINDS.join(', ')}).`);
      // A patch on a kind players never read is the GM's alone (the database reads it the same way; 07, patches).
      else if (!PLAYER_FACING.includes(match.kind.trim())) notes.push(`${where}: match.kind "${match.kind.trim()}" isn’t a kind players read, so this patch reaches only the GM.`);
      if (match.category !== undefined && !isText(match.category)) notes.push(`${where}: match.category should be a category's id, like "armour".`);
      if (match.ids !== undefined && !(Array.isArray(match.ids) && match.ids.length > 0 && match.ids.every(isText))) notes.push(`${where}: match.ids should be a list of entry ids.`);
    }
    const removes = 'option' in patch;
    if (removes && patch.option !== null) notes.push(`${where}: option should be null (the matched entries don't exist under these choices), or left out.`);
    if (removes && patch.change !== undefined) notes.push(`${where}: has both change and option: null; keep one.`);
    if (!removes && !isObject(patch.change)) notes.push(`${where}: needs change ({ "<field>": value or { "delta": n } }) or option: null.`);
    if (isObject(patch.change)) {
      if (Object.keys(patch.change).length === 0) notes.push(`${where}: change is empty, so it changes nothing.`);
      for (const [field, value] of Object.entries(patch.change)) {
        if (isObject(value) && 'delta' in value && !Number.isInteger(value.delta)) notes.push(`${where}: change "${field}": delta should be a whole number.`);
        if (isObject(value) && 'times' in value && !Number.isInteger(value.times)) notes.push(`${where}: change "${field}": times should be a whole number.`);
        if (isObject(value) && 'delta' in value && 'times' in value) notes.push(`${where}: change "${field}": has both delta and times; keep one (or write two patches).`);
        // A change to a field players never read makes the patch the GM's alone (the database reads it the same way;
        // look-back review of #437, 2026-11-10; 07, patches).
        const head = field.trim().split('.')[0].trim();
        if (head === 'gmOnly') notes.push(`${where}: change "${field}" changes which fields are the GM's, so this patch reaches only the GM.`);
        else if (isObject(match) && isText(match.kind) && match.kind.trim() === 'rulesSet' && RULES_SET_GM_SECTIONS.includes(head)) notes.push(`${where}: change "${field}" is in the rules set's ${head}, which players never read, so this patch reaches only the GM.`);
      }
    }
  });
  return notes;
}

/** A change that sets a value (pf-19): not { delta } or { times }, and not null (which removes a field). */
const isSet = (value) => value !== null && !(isObject(value) && ('delta' in value || 'times' in value));

/**
 * Patch paths that can never be followed (pf-19): a step named `__proto__`, `constructor` or `prototype`, or an empty
 * step, in any change, whatever the entry; and (pf-19a, widened) any change to a field the match's kind hides from
 * players by name (a patron's `cult` or `statBlockId`). Errors: the app changes nothing there. One file alone.
 */
export function patchPathErrors(file) {
  if (!isObject(file) || !Array.isArray(file.patches)) return [];
  const errors = [];
  file.patches.forEach((patch, i) => {
    if (!isObject(patch) || !isObject(patch.change)) return;
    const kind = isObject(patch.match) && isText(patch.match.kind) ? patch.match.kind.trim() : '';
    for (const path of Object.keys(patch.change)) {
      const plan = planSet({}, path.trim());
      if (plan.kind === 'refused' && (plan.reason === 'forbidden' || plan.reason === 'empty')) errors.push(`${patchLabel(i)}: change "${path}" is refused: ${plan.text}.`);
      // A field the match's kind hides by name, by any operation (pf-19a, widened): the kind and the first step suffice.
      else {
        const hidden = kind ? hiddenByKind(kind, path.trim()) : null;
        if (hidden) errors.push(`${patchLabel(i)}: change "${path}" is refused: ${hidden.text}.`);
      }
    }
  });
  return errors;
}

/** The entries of every pack being checked that a patch's match names. */
const matchedBy = (patch, all) => {
  const match = patch.match;
  if (!isObject(match) || !isText(match.kind)) return [];
  const ids = Array.isArray(match.ids) ? match.ids.filter(isText) : null;
  return all.filter((e) => e.kind === match.kind.trim() && (!isText(match.category) || e.data.category === match.category) && (!ids || ids.includes(e.packEntryId)));
};

/**
 * What each set of a patch would do to each entry it matches, planned in the patch's own order as the app applies them
 * (a set that makes "a" is there for "a.b" after it; one that puts a number at "a" refuses "a.b"): path (trimmed) →
 * entry id → one plan per copy of that id (the same id in two packs: one copy wins in a campaign, eq-4).
 */
function planPatchSets(patch, found) {
  const plans = new Map();
  if (!isObject(patch.change)) return plans;
  for (const entry of found) {
    let data = isObject(entry.data) ? entry.data : {};
    for (const [raw, value] of Object.entries(patch.change)) {
      if (!isSet(value)) continue;
      const path = raw.trim();
      const plan = planSet(data, path, entry.kind);
      if (!plans.has(path)) plans.set(path, new Map());
      const byId = plans.get(path);
      byId.set(entry.packEntryId, [...(byId.get(entry.packEntryId) ?? []), plan]);
      if (plan.kind !== 'refused') data = withSet(data, path, value, entry.kind) ?? data;
    }
  }
  return plans;
}

/**
 * Sets that a matched entry refuses (pf-19, pf-19a), against every pack being checked: a missing step whose next step
 * is a list index; a step that is there and isn't a group of fields; a field the kind hides from players by name; a
 * section a rules set doesn't have. Errors: the app changes nothing there. (A forbidden or empty step is
 * patchPathErrors', one file alone.)
 */
export function patchLibraryErrors(packs) {
  const all = packs.flatMap((p) => p.entries ?? []);
  const errors = [];
  for (const pack of packs) {
    const patches = isObject(pack.file) && Array.isArray(pack.file.patches) ? pack.file.patches : [];
    patches.forEach((patch, i) => {
      if (!isObject(patch) || !isObject(patch.change)) return;
      // An id is refused only when no copy of it takes the set.
      for (const [path, byId] of planPatchSets(patch, matchedBy(patch, all))) {
        for (const [id, plans] of byId) {
          if (plans.some((p) => p.kind !== 'refused')) continue;
          const plan = plans[0];
          // Said by patchPathErrors, from the one file: a forbidden or empty step, a field the kind hides by name.
          if (plan.reason === 'forbidden' || plan.reason === 'empty' || plan.reason === 'hidden') continue;
          errors.push(`${pack.name}: ${patchLabel(i)}: change "${path}" is refused on ${id}: ${plan.text}.`);
        }
      }
    });
  }
  return errors;
}

/** A rules set's sections players never read (07; G-45): a patch changing one reaches only the GM. */
const RULES_SET_GM_SECTIONS = ['monsters', 'magicItems', 'procedures', 'gmReference'];

/** The fields an entry keeps from players: its gmOnly list, and a rules set's sections marked `gmOnly: true`. */
const gmOnlyFieldsOf = (entry) => [
  ...(Array.isArray(entry.data?.gmOnly) ? entry.data.gmOnly.filter(isText).map((k) => k.trim()) : []),
  ...(entry.kind === 'rulesSet' && isObject(entry.data) ? Object.entries(entry.data).filter(([, v]) => isObject(v) && v.gmOnly === true).map(([k]) => k) : []),
];

/**
 * Patches against every pack being checked (of-13): packs [{ name, entries, file }]. A match that finds nothing,
 * an id in match.ids no pack has (of the kind named), and a byOption choice no option has.
 */
export function patchLibraryNotes(packs) {
  const all = packs.flatMap((p) => p.entries ?? []);
  const known = choicesById(all, true);
  const notes = [];
  // Where some patch's set makes a path an entry lacks (pf-19): a delta or a multiplier on that path then has a field to
  // change, so it isn't "changes nothing" there. Keyed "<entry id> <path>".
  const made = new Set();
  for (const pack of packs) {
    for (const patch of isObject(pack.file) && Array.isArray(pack.file.patches) ? pack.file.patches.filter(isObject) : []) {
      for (const [path, byId] of planPatchSets(patch, matchedBy(patch, all))) for (const [id, plans] of byId) if (plans.some((p) => p.kind === 'create')) made.add(`${id} ${path}`);
    }
  }
  for (const pack of packs) {
    const patches = isObject(pack.file) && Array.isArray(pack.file.patches) ? pack.file.patches : [];
    patches.forEach((patch, i) => {
      if (!isObject(patch)) return;
      const where = `${pack.name}: ${patchLabel(i)}`;
      if (isText(patch.byOption)) notes.push(...keyNotes(`${where}: byOption`, patch.byOption, known, true));
      const match = patch.match;
      if (!isObject(match) || !isText(match.kind)) return;
      const ofKind = all.filter((e) => e.kind === match.kind.trim());
      const ids = Array.isArray(match.ids) ? match.ids.filter(isText) : null;
      const found = ofKind.filter((e) => (!isText(match.category) || e.data.category === match.category) && (!ids || ids.includes(e.packEntryId)));
      if (found.length === 0) notes.push(`${where}: match finds nothing in these packs (${match.kind}${isText(match.category) ? `, category "${match.category}"` : ''}${ids ? `, ids ${ids.join(', ')}` : ''}), so it changes nothing.`);
      else if (ids) for (const id of ids.filter((id) => !found.some((e) => e.packEntryId === id))) notes.push(`${where}: match.ids names "${id}", which no ${match.kind}${isText(match.category) ? ` of category "${match.category}"` : ''} in these packs has.`);
      // A path a matched entry lacks changes nothing there (bq3-17 (2)); a delta on words that aren't dice neither.
      // The same id in two packs: one copy wins in a campaign (eq-4), so the field counts as there when any copy has it.
      if (found.length > 0 && isObject(patch.change)) {
        const planned = planPatchSets(patch, found);
        for (const [path, value] of Object.entries(patch.change)) {
          const has = (e) => found.some((o) => o.packEntryId === e.packEntryId && atPath(o.data, path).found);
          const lacking = [...new Set(found.filter((e) => !has(e) && !made.has(`${e.packEntryId} ${path.trim()}`)).map((e) => e.packEntryId))];
          // A set value makes a path the entry lacks (pf-19): listed here, so a slip of the pen shows; a set that can't
          // be made is an error (patchLibraryErrors). Every other change on a missing path still changes nothing, unless
          // a set makes it.
          if (isSet(value)) {
            const making = [...(planned.get(path.trim()) ?? new Map())].filter(([, plans]) => plans.some((p) => p.kind === 'create')).map(([id]) => id);
            if (making.length > 0) notes.push(`${where}: change "${path}": ${making.join(', ')}: sets a path the entry doesn't have: ${path.trim()}.`);
          } else if (lacking.length === new Set(found.map((e) => e.packEntryId)).size) notes.push(`${where}: change "${path}": none of the ${found.length === 1 ? 'entry' : `${found.length} entries`} it matches has that field, so it changes nothing.`);
          else if (lacking.length > 0) notes.push(`${where}: change "${path}": ${lacking.join(', ')} ${lacking.length === 1 ? 'has' : 'have'} no such field, so nothing changes there.`);
          const isDelta = isObject(value) && ('delta' in value || 'times' in value);
          const odd = isDelta ? found.filter((e) => atPath(e.data, path).found && typeof atPath(e.data, path).value !== 'number' && !('delta' in value && typeof atPath(e.data, path).value === 'string' && adjustDice(atPath(e.data, path).value, 0) !== null)).map((e) => e.packEntryId) : [];
          if (odd.length > 0) notes.push(`${where}: change "${path}": ${'delta' in value ? 'delta' : 'times'} needs a number${'delta' in value ? ' or dice' : ''}, which ${odd.join(', ')} ${odd.length === 1 ? "doesn't" : "don't"} have there, so nothing changes there.`);
          // A field a matched entry keeps GM-only: the patch would tell players it's there, so it reaches only the GM.
          const head = path.trim().split('.')[0].trim();
          const keeping = [...new Set(found.filter((e) => gmOnlyFieldsOf(e).includes(head)).map((e) => e.packEntryId))];
          if (keeping.length > 0) notes.push(`${where}: change "${path}": ${keeping.join(', ')} ${keeping.length === 1 ? 'keeps' : 'keep'} "${head}" for the GM (gmOnly), so this patch reaches only the GM.`);
        }
      }
    });
  }
  return notes;
}

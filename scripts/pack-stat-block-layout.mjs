// The check of a pack's stat block layout for npm run pack:check (pf-13, `design/rulings/dec-stat-block-and-type-2026-11-12.md`;
// pf-13a, `design/rulings/dec-night-and-morning-2026-11-13.md`; plan `docs/plans/dec-pack-check-stat-block-layout.md`).
// The layout is `meta.statBlockLayout`: { descriptor: [field…], groups: [[[field…]…]…], hide: [field…] }, `groups` three
// levels deep (groups, each a list of lines, each a list of field names). Field names are the ones the pack's creatures
// carry in their `fields` (or a variant's); `hp` is reserved for hit points with their average.
// Errors are shapes the app can't read (the pack:check exit code becomes 1); warnings are likely typos (it stays).

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const LAYOUT_KEYS = ['descriptor', 'groups', 'hide'];
/** Hit points with their average ("2d8 (9)"): the app draws it from the stat block's own `hp`, never from `fields`. */
export const RESERVED_FIELDS = ['hp'];
const AT = 'meta.statBlockLayout';

/** Every field name a creature in the file carries: its `fields`, and each variant's. */
function creatureFields(file) {
  const names = new Set();
  const add = (fields) => {
    if (isObject(fields)) for (const name of Object.keys(fields)) names.add(name);
  };
  for (const block of Array.isArray(file?.statBlocks) ? file.statBlocks : []) {
    if (!isObject(block)) continue;
    add(block.fields);
    for (const variant of Array.isArray(block.variants) ? block.variants : []) if (isObject(variant)) add(variant.fields);
  }
  return names;
}

/** A flat list of field names (`descriptor`, `hide`): its errors, and the names when it reads. */
function flatList(key, value) {
  if (value === undefined) return { errors: [], names: [] };
  if (!Array.isArray(value) || !value.every((name) => typeof name === 'string'))
    return { errors: [`${AT}.${key} should be a list of field names, like ["Size", "Kind"].`], names: [] };
  return { errors: [], names: value };
}

/** `groups`, three levels deep: its errors, and the names placed in it, in order. */
function groupNames(groups) {
  if (groups === undefined) return { errors: [], names: [] };
  const example = 'like [[["AC", "Move"], ["Attacks"]]]';
  if (!Array.isArray(groups)) return { errors: [`${AT}.groups should be a list of groups, ${example}.`], names: [] };
  const errors = [];
  const names = [];
  groups.forEach((group, g) => {
    const at = `${AT}.groups, group ${g + 1}`;
    if (!Array.isArray(group)) {
      errors.push(`${at} should be a list of lines, each a list of field names (groups are three levels deep, ${example}).`);
      return;
    }
    if (group.some((line) => typeof line === 'string')) {
      errors.push(`${at} holds field names directly; each group is a list of lines, each a list of field names (three levels deep, ${example}).`);
      return;
    }
    group.forEach((line, l) => {
      if (!Array.isArray(line)) errors.push(`${at}, line ${l + 1} should be a list of field names.`);
      else if (!line.every((name) => typeof name === 'string')) errors.push(`${at}, line ${l + 1} should hold field names only (text).`);
      else names.push(...line);
    });
  });
  return { errors, names };
}

/**
 * What pack:check says about a pack file's stat block layout: `errors` (the app can't read it as written) and
 * `warnings` (likely typos). A file with no layout anywhere gives neither. `file` is the parsed JSON (null for Markdown).
 */
export function statBlockLayoutFindings(file) {
  const errors = [];
  const warnings = [];
  if (!isObject(file)) return { errors, warnings };
  if (file.statBlockLayout !== undefined)
    errors.push('statBlockLayout is at the top level of the file, where the app ignores it (it draws one compact group); move it into meta.');
  const layout = isObject(file.meta) ? file.meta.statBlockLayout : undefined;
  if (layout === undefined) return { errors, warnings };
  if (!isObject(layout)) {
    errors.push(`${AT} should be an object: { "descriptor": [field…], "groups": [[[field…]…]…], "hide": [field…] }.`);
    return { errors, warnings };
  }

  for (const key of Object.keys(layout))
    if (!LAYOUT_KEYS.includes(key)) warnings.push(`${AT} has "${key}", which isn't one of ${LAYOUT_KEYS.join(', ')}; the app ignores it.`);

  const descriptor = flatList('descriptor', layout.descriptor);
  const hide = flatList('hide', layout.hide);
  const groups = groupNames(layout.groups);
  errors.push(...descriptor.errors, ...groups.errors, ...hide.errors);

  // A field no creature carries is likely a typo; `hp` is the app's own.
  const known = creatureFields(file);
  const named = new Set([...descriptor.names, ...groups.names, ...hide.names]);
  for (const name of named)
    if (!RESERVED_FIELDS.includes(name) && !known.has(name))
      warnings.push(`${AT}: "${name}" isn't a field any creature in this pack carries (a typo?).`);

  // Placed twice (in the descriptor or the groups), or placed and hidden.
  const placed = [...descriptor.names, ...groups.names];
  const twice = new Set(placed.filter((name, i) => placed.indexOf(name) !== i));
  for (const name of twice) warnings.push(`${AT}: "${name}" is placed more than once; the stat block would show it twice.`);
  const hidden = new Set(hide.names);
  for (const name of new Set(placed))
    if (hidden.has(name)) warnings.push(`${AT}: "${name}" is both placed and hidden; take it out of one.`);

  return { errors, warnings };
}

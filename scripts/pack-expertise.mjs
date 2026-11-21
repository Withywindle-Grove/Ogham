// A class's expertise points (G-208, ex-1, ruled 2026-11-20, docs/design/rulings/g208-expertise-points-2026-11-20.md;
// 07 "Point-buy skills"): `skills.points: { atStart, perLevel, base, best, name? }`, on the class itself, under its
// `byOption`, or set by a `patches[]` entry on another pack's class (`change: { "skills.points": { … } }`, or a whole
// `change: { "skills": { points, … } }`). The app reads it in src/modules/characters/expertise.ts; a malformed one is
// read as no points at all. pack:check notes:
//  - a figure that isn't a whole number (atStart and perLevel also not below nought);
//  - a `best` not past `base` in each skill's direction (up for x-in-6, down for equal-or-over), read as the app reads it
//    (expertise.ts skillDirection): the skill's own `rollMode` in this file's rules sets first, else the class's; where
//    the direction can't be told, as in a patch that doesn't set it, a `best` equal to `base`;
//  - a class skill whose own `rollMode` differs from the class's (one `base` and `best` serve every skill of the class);
//  - `points` on a class whose skills' `die` isn't one die ("d6"; not "%" or "2d6").
// Used by scripts/pack-format.mjs (formatNotes); tested in scripts/pack-expertise.test.mjs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');
const whole = (value) => typeof value === 'number' && Number.isInteger(value);
const ONE_DIE = /^d\d+$/i;
const modeOf = (value) => (value === 'equal-or-over' ? 'equal-or-over' : 'x-in-6');

/** The `rollMode` each skill of this file's rules sets gives itself, by skill id (a later rules set wins, as in the app). */
function ownRollModes(file) {
  const modes = {};
  for (const rules of Array.isArray(file.rulesSets) ? file.rulesSets.filter(isObject) : []) {
    for (const skill of Array.isArray(rules.skills) ? rules.skills.filter(isObject) : []) {
      if (isText(skill.id) && skill.rollMode !== undefined) modes[skill.id] = modeOf(skill.rollMode);
    }
  }
  return modes;
}

/** A class's skill codes as the app reads them (expertise.ts classSkillCodes): its `names`, else its `byLevel` rows' keys. */
function skillCodes(skills) {
  if (isObject(skills.names)) {
    const named = Object.keys(skills.names).filter((code) => code.trim() !== '');
    if (named.length > 0) return named;
  }
  const rows = Array.isArray(skills.byLevel) ? skills.byLevel.filter(isObject) : [];
  return [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== 'level')))];
}

/** The class's skills whose own `rollMode` the rules sets give: `{ code: rollMode }`. */
const skillModesOf = (codes, own) => Object.fromEntries(codes.filter((code) => own[code] !== undefined).map((code) => [code, own[code]]));

/**
 * What's wrong with one `skills.points` (empty when it's well formed). `rollMode` and `die` are the class's (null when
 * not known here, as for a patch that doesn't set them); `skillModes` the class's skills whose own `rollMode` the
 * rules sets give, `{ code: rollMode }`.
 */
export function pointsProblems(points, { rollMode = null, die = null, skillModes = {} } = {}) {
  if (!isObject(points)) return ['should be { atStart, perLevel, base, best, name? }'];
  const problems = [];
  for (const key of ['atStart', 'perLevel', 'base', 'best']) {
    const value = points[key];
    if (!whole(value)) problems.push(`${key} should be a whole number, not ${JSON.stringify(value)}`);
    else if ((key === 'atStart' || key === 'perLevel') && value < 0) problems.push(`${key} should not be below 0`);
  }
  if (points.name !== undefined && !isText(points.name)) problems.push('name should be words');
  if (whole(points.base) && whole(points.best)) {
    const { base, best } = points;
    const classMode = rollMode === null ? null : modeOf(rollMode);
    const notPast = (mode) => (mode === null ? best === base : mode === 'equal-or-over' ? best >= base : best <= base);
    const why = (mode) => (mode === null ? '' : mode === 'equal-or-over' ? ' (equal-or-over: best is lower)' : ' (x-in-6: best is higher)');
    if (notPast(classMode)) problems.push(`best ${best} isn't past base ${base}${why(classMode)}`);
    for (const [code, mode] of Object.entries(skillModes)) {
      if (mode === classMode) continue;
      if (classMode !== null) problems.push(`skill ${code} rolls ${mode}, unlike the class's ${classMode}`);
      if (notPast(mode)) problems.push(`best ${best} isn't past base ${base} for ${code}${why(mode)}`);
    }
  }
  if (die !== null && !(typeof die === 'string' && ONE_DIE.test(die.trim()))) problems.push(`the skills' die ${JSON.stringify(die)} isn't one die (such as "d6")`);
  return problems;
}

const note = (where, problems) => `${where}: skills.points ${problems.join('; ')} (G-208, 07 Point-buy skills); the app reads no points from it.`;

/** Format notes on expertise points: on classes, their byOption overrides, and patches that set them. */
export function expertiseNotes(file) {
  if (!isObject(file)) return [];
  const notes = [];
  const ownModes = ownRollModes(file);
  for (const klass of Array.isArray(file.classes) ? file.classes.filter(isObject) : []) {
    const where = `classes: "${label(klass)}"`;
    const own = isObject(klass.skills) ? klass.skills : {};
    if (own.points !== undefined) {
      const problems = pointsProblems(own.points, { rollMode: own.rollMode ?? 'x-in-6', die: own.die ?? null, skillModes: skillModesOf(skillCodes(own), ownModes) });
      if (problems.length > 0) notes.push(note(where, problems));
    }
    for (const [key, override] of Object.entries(isObject(klass.byOption) ? klass.byOption : {})) {
      const skills = isObject(override) && isObject(override.skills) ? override.skills : null;
      if (!skills || skills.points === undefined) continue;
      const problems = pointsProblems(skills.points, {
        rollMode: skills.rollMode ?? own.rollMode ?? 'x-in-6',
        die: skills.die ?? own.die ?? null,
        skillModes: skillModesOf(skillCodes({ ...own, ...skills }), ownModes),
      });
      if (problems.length > 0) notes.push(note(`${where}, byOption "${key}"`, problems));
    }
  }
  for (const patch of Array.isArray(file.patches) ? file.patches.filter(isObject) : []) {
    const change = isObject(patch.change) ? patch.change : {};
    // The rule on its own path, or inside a whole `skills` the patch sets (review of #1087, finding 4).
    const set = isObject(change.skills) ? change.skills : {};
    const points = change['skills.points'] ?? set.points;
    if (points === undefined) continue;
    const problems = pointsProblems(points, {
      rollMode: change['skills.rollMode'] ?? set.rollMode ?? null,
      die: change['skills.die'] ?? set.die ?? null,
      skillModes: skillModesOf(skillCodes({ names: change['skills.names'] ?? set.names, byLevel: change['skills.byLevel'] ?? set.byLevel }), ownModes),
    });
    if (problems.length > 0) notes.push(note(`patches: "${label(patch)}"`, problems));
  }
  return notes;
}

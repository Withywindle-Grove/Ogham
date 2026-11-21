// A spell's `reversible` read by list (a5-1, ruled 2026-11-05, docs/design/rulings/m5c-magic-area-5-2026-11-05.md;
// G-137): besides yes or no, `reversible` may be keyed by list, as range and duration already are (07, spells: "any
// field can instead be an object keyed by class id"): `{ "<list or class id>": true | false }`, each key one of the
// spell's own `lists`. The in-app editor still asks for yes or no; pack:check accepts the keyed form and notes a
// malformed one (a value that isn't yes or no, or a key the spell's lists don't have).
// Used by scripts/check-pack.mjs and scripts/pack-format.mjs; tested in scripts/pack-reversible.test.mjs.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const label = (entry) => (isText(entry.id) ? entry.id : isText(entry.name) ? entry.name : '(no id)');

/** What's wrong with a keyed `reversible` (empty when it's well formed); null when it isn't keyed at all. */
function keyedProblems(spell) {
  const value = spell.reversible;
  if (!isObject(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0) return ['names no list'];
  const lists = isObject(spell.lists) ? Object.keys(spell.lists) : null;
  const problems = [];
  for (const key of keys) {
    if (typeof value[key] !== 'boolean') problems.push(`"${key}" should be true or false, not ${JSON.stringify(value[key])}`);
    else if (lists !== null && !lists.includes(key)) problems.push(`"${key}" isn't one of the spell's lists (${lists.join(', ') || 'none'})`);
  }
  return problems;
}

/** Whether an editor finding is only "Can be cast reversed must be yes or no" on a well-formed keyed `reversible`. */
export function keyedReversibleFinding(spell, finding) {
  if (!isObject(spell) || !/^Can be cast reversed must be yes or no\.$/.test(finding)) return false;
  const problems = keyedProblems(spell);
  return problems !== null && problems.length === 0;
}

/** Format notes on keyed `reversible` values that are malformed (a5-1). */
export function reversibleNotes(file) {
  const notes = [];
  for (const spell of isObject(file) && Array.isArray(file.spells) ? file.spells.filter(isObject) : []) {
    const problems = keyedProblems(spell);
    if (problems && problems.length > 0) notes.push(`spells: "${label(spell)}": reversible by list ${problems.join('; ')}; write { "<list id>": true | false } for each of its lists, or plain true or false (a5-1).`);
  }
  return notes;
}

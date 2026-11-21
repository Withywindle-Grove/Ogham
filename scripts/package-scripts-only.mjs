// Did a package.json change touch only its "scripts" block? (ci-pkg-scripts-1, Francis 2026-11-17)
// A change like that cannot alter a screen, so the GitHub check's changes job does not count it as a screen
// change (the picture checks are skipped for it).
//
// Usage: node scripts/package-scripts-only.mjs <baseRef>
//   reads `git show <baseRef>:package.json` and the working copy's package.json.
// Prints "scripts-only" or "other". Anything that goes wrong prints "other" (the safe default: pictures run).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Order-independent deep equality of two parsed JSON values. */
function sameJson(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]));
}

/** True when the two package.json texts are equal once "scripts" is removed from both. Bad JSON gives false. */
export function isScriptsOnly(before, after) {
  try {
    const a = JSON.parse(before);
    const b = JSON.parse(after);
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) return false;
    delete a.scripts;
    delete b.scripts;
    return sameJson(a, b);
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let result = 'other';
  try {
    const base = process.argv[2];
    if (base) {
      const before = execFileSync('git', ['show', `${base}:package.json`], { encoding: 'utf8' });
      const after = readFileSync('package.json', 'utf8');
      if (isScriptsOnly(before, after)) result = 'scripts-only';
    }
  } catch {
    result = 'other';
  }
  console.log(result);
}

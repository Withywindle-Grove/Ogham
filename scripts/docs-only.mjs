// The docs-only fast path (ruled 2026-11-05): decides whether a commit or pull request changes only docs and
// process files. If so, the pre-commit hook and the GitHub check run the docs check (and the hook the real-names
// scan) instead of the whole app's type-check, lint, tests, build, database and layout.
//
// Docs-only means every changed path (added, changed, deleted, or either side of a rename) is one of:
//   - a file under docs/, except docs/generated/ and the docs the app's code or tests read (CODE_READ_DOCS)
//   - a Markdown file at the top of the repo (README.md, CLAUDE.md, REVIEW.md, CHANGELOG.md, ...)
//   - a Markdown file under .claude/ (the agents, the README, the skills); not .claude/settings.json (the hooks)
//   - a Markdown file under skills/
// Anything else, or an empty list, means the full check (when unsure, check everything).
//
// Usage:
//   node scripts/docs-only.mjs --staged   the files staged for the next commit (the pre-commit hook)
//   node scripts/docs-only.mjs            one path per line on stdin (the GitHub check's changes job)
// Prints "docs" or "code". Anything that goes wrong prints nothing, and the callers treat that as "code".
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The docs that code imports or reads: changing one can change the app or break a test, so it needs the full
 * check. scripts/docs-only.test.mjs scans src/, scripts/, supabase/ and tests/ and fails when a new one isn't listed here.
 */
export const CODE_READ_DOCS = [
  'docs/07-content-packs.md', // bundled into the app (Convert with AI) and read by a test
  'docs/plans/m5b-0c-creation-options.md', // the creation-options tests read its table
  'docs/plans/options-audit-2026-11-03.md', // the options-audit test reads it
];

/** True when one repo-relative path (forward slashes) is a docs or process file. */
export function isDocsPath(path) {
  if (CODE_READ_DOCS.includes(path)) return false;
  if (path.startsWith('docs/generated/')) return false;
  if (path.startsWith('docs/')) return true;
  if (/^[^/]+\.md$/.test(path)) return true;
  if (/^\.claude\/.+\.md$/.test(path)) return true;
  if (/^skills\/.+\.md$/.test(path)) return true;
  return false;
}

/** True when a change made of these paths is docs-only. An empty list is not (it runs everything, to be safe). */
export function isDocsOnly(paths) {
  const list = paths.map((p) => p.trim().replace(/\\/g, '/')).filter((p) => p !== '');
  return list.length > 0 && list.every(isDocsPath);
}

function stagedPaths() {
  // --no-renames lists a rename as its deletion and its addition, so moving code into docs/ still counts as code.
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { encoding: 'utf8' });
  return out.split('\0');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const paths = process.argv.includes('--staged') ? stagedPaths() : readFileSync(0, 'utf8').split(/\r?\n/);
  console.log(isDocsOnly(paths) ? 'docs' : 'code');
}

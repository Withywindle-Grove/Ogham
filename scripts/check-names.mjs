// The real-names scan (hard rule 2, IP-clean). Reads the private denylist (packs/_design/denylist.txt, one real
// game, book, adventure or publisher name per line) and fails when a file about to be committed contains one.
// If the list is missing (GitHub, a fresh copy of the repo), it does nothing: the list is private and never committed.
//
// Usage (the git hooks in .githooks/ run it; see docs/testing.md, "Git hooks"):
//   node scripts/check-names.mjs                 scan the files staged for the next commit
//   node scripts/check-names.mjs --message FILE  scan a commit message
//   node scripts/check-names.mjs --all           scan every file in the repo
//   node scripts/check-names.mjs --hook          Claude Code PreToolUse hook (.claude/settings.json): reads the tool
//                                                call's JSON on stdin and blocks (exit 2) a Write or Edit under docs/
//                                                or src/ whose new text holds a listed name, without repeating the name
// The list's location can be overridden with GRIMOIRE_DENYLIST=<path>.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Reads the names from the denylist's text: one per line, # starts a comment, blank lines are skipped. */
export function parseDenylist(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the listed names in a text. Case doesn't matter, curly apostrophes count as straight ones, and a name
 * only counts as a whole word ("GWC" is found in "the GWC pack" but not in "gwcs").
 * Returns one entry per hit: { name, line } (line numbers start at 1).
 */
export function findNames(text, names) {
  const normal = text.replace(/[‘’]/g, "'");
  const lines = normal.split(/\r?\n/);
  const hits = [];
  for (const name of names) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name.replace(/[‘’]/g, "'"))}(?![\\p{L}\\p{N}])`, 'iu');
    lines.forEach((line, index) => {
      if (pattern.test(line)) hits.push({ name, line: index + 1 });
    });
  }
  return hits.sort((a, b) => a.line - b.line);
}

/** True when the bytes look like a binary file (a picture, say), which the scan skips. */
export function looksBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

/** The repo-relative path of a hook's file (a helper worktree's prefix removed), or null when it's outside the repo. */
export function repoPath(filePath, projectDir) {
  if (typeof filePath !== 'string' || filePath === '') return null;
  const rel = relative(projectDir, resolve(projectDir, filePath)).split('\\').join('/');
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  return rel.replace(/^\.claude\/worktrees\/[^/]+\//, '');
}

/** The new text a Write, Edit or MultiEdit call would put in the file: one entry per piece, with a label. */
export function hookTexts(toolInput) {
  const texts = [];
  if (typeof toolInput?.content === 'string') texts.push({ label: 'the new file', text: toolInput.content });
  if (typeof toolInput?.new_string === 'string') texts.push({ label: 'the new text', text: toolInput.new_string });
  if (Array.isArray(toolInput?.edits)) {
    toolInput.edits.forEach((edit, i) => {
      if (typeof edit?.new_string === 'string') texts.push({ label: `edit ${i + 1}'s new text`, text: edit.new_string });
    });
  }
  return texts;
}

/**
 * The hook's verdict on a tool call: a block message, or null to let it through. Only paths under docs/ and src/
 * are checked. The message names the file and line but never the name itself (the session transcript isn't private).
 */
export function hookVerdict(input, names, projectDir) {
  const path = repoPath(input?.tool_input?.file_path, projectDir);
  if (!path || !/^(docs|src)\//.test(path)) return null;
  const where = [];
  for (const { label, text } of hookTexts(input.tool_input)) {
    for (const hit of findNames(text, names)) where.push(`${label}, line ${hit.line}`);
  }
  if (where.length === 0) return null;
  return (
    `Blocked: ${path} would contain a name on the private denylist (${[...new Set(where)].join('; ')}).\n` +
    'Real game, book, adventure and publisher names must not reach the repo (hard rule 2). ' +
    'Use the neutral pack ID (classic-advanced, fae-woodland and so on) or invented words, then try again.'
  );
}

/** --hook: Claude Code passes the tool call as JSON on stdin; exit 2 blocks it and shows stderr to the model. */
async function runHook() {
  let input;
  try {
    // Read stdin as a stream: a plain synchronous read can fail on Windows pipes.
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    input = JSON.parse(text.replace(String.fromCharCode(0xfeff), '').trim() || '{}');
  } catch {
    return 0; // Not a tool call we understand: let it through.
  }
  const listPath = findDenylist();
  if (!listPath) return 0; // No private list here: nothing to check against.
  const names = parseDenylist(readFileSync(listPath, 'utf8'));
  if (names.length === 0) return 0;
  const message = hookVerdict(input, names, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (!message) return 0;
  console.error(message);
  return 2;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** The denylist: GRIMOIRE_DENYLIST, then this copy's packs/, then the main checkout's packs/ (helper worktrees have none). */
function findDenylist() {
  if (process.env.GRIMOIRE_DENYLIST) return existsSync(process.env.GRIMOIRE_DENYLIST) ? process.env.GRIMOIRE_DENYLIST : null;
  const candidates = [];
  try {
    candidates.push(join(git(['rev-parse', '--show-toplevel']).trim(), 'packs', '_design', 'denylist.txt'));
    const common = resolve(git(['rev-parse', '--git-common-dir']).trim());
    candidates.push(join(dirname(common), 'packs', '_design', 'denylist.txt'));
  } catch {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), '..', 'packs', '_design', 'denylist.txt'));
  }
  return candidates.find((path) => existsSync(path)) ?? null;
}

function main(argv) {
  const listPath = findDenylist();
  if (!listPath) return 0; // No private list here: nothing to check against.
  const names = parseDenylist(readFileSync(listPath, 'utf8'));
  if (names.length === 0) return 0;

  /** Each source: a label for the message, and its text (or null to skip it). */
  const sources = [];
  if (argv[0] === '--message') {
    sources.push({ label: 'the commit message', text: readFileSync(argv[1], 'utf8') });
  } else {
    const all = argv[0] === '--all';
    const files = (all ? git(['ls-files', '-z']) : git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']))
      .split('\0')
      .filter(Boolean);
    for (const file of files) {
      sources.push({ label: `${file} (its name)`, text: file });
      // Staged copies are what will be committed, so read those (not the working copy).
      const buffer = all ? (existsSync(file) ? readFileSync(file) : null) : execFileSync('git', ['show', `:${file}`], { maxBuffer: 64 * 1024 * 1024 });
      if (buffer && !looksBinary(buffer)) sources.push({ label: file, text: buffer.toString('utf8') });
    }
  }

  let found = 0;
  for (const { label, text } of sources) {
    for (const hit of findNames(text, names)) {
      found += 1;
      const where = label.endsWith('(its name)') ? label : `${label}, line ${hit.line}`;
      console.error(`Real name found: "${hit.name}" in ${where}.`);
    }
  }
  if (found > 0) {
    console.error(
      (argv[0] === '--all' ? '\n' : '\nNothing was committed. ') +
        'Real game, book, adventure and publisher names must not reach the repo (hard rule 2).\n' +
        'Use the neutral pack ID instead (classic-advanced, monster-overlay and so on: see packs/README.md), or invented words.',
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  process.exit(argv[0] === '--hook' ? await runHook() : main(argv));
}

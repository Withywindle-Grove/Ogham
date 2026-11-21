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
//   node scripts/check-names.mjs --pr BASE [HEAD] [--messages FILE] [--show]
//                                                the GitHub check's scan of a pull request (.github/workflows/check.yml,
//                                                the changes job): only what the pull request adds since BASE (added
//                                                lines, new files' names, its commit messages, and its title, text and
//                                                branch name from PR_TITLE, PR_BODY and PR_BRANCH). It says the file and
//                                                line but never the name, because that log is public; --show adds the
//                                                name, for a run on your own machine.
// The list's location can be overridden with GRIMOIRE_DENYLIST=<path>. For --pr the list itself can come in
// GRIMOIRE_NAMES (the repository secret PRIVATE_NAMES: the private lists, one name per line); with
// GRIMOIRE_NAMES_REQUIRED=true a missing list fails the scan instead of passing it unscanned.
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

/**
 * The lines a diff adds. Reads the text of `git diff --unified=0 --no-renames` and returns one entry per added line:
 * { file, line, text } (line numbers are the new file's, starting at 1). A binary file has no lines and is skipped.
 */
export function addedLines(diffText) {
  const added = [];
  let file = null;
  let line = 0;
  let inHunk = false;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      file = null;
      inHunk = false;
    } else if (!inHunk && raw.startsWith('+++ ')) {
      // Git puts a tab after a name that holds a space; /dev/null is a deleted file, which adds nothing.
      const name = raw.slice(4).replace(/\t$/, '');
      file = name === '/dev/null' ? null : name.replace(/^b\//, '');
    } else if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(raw)) {
      inHunk = true;
      line = Number(/ \+(\d+)/.exec(raw)[1]);
    } else if (inHunk && raw.startsWith('+')) {
      if (file) added.push({ file, line, text: raw.slice(1) });
      line += 1;
    }
  }
  return added;
}

/**
 * Where the listed names sit in what a pull request adds. `diffText` is the diff (see addedLines), `newFiles` the
 * paths it creates, and `texts` its other words: { label, text } for each of the title, the text, the branch's name
 * and the commit messages. Returns one entry per place: { where, name }. The caller decides whether to show the name.
 */
export function findInPullRequest({ diffText = '', newFiles = [], texts = [] }, names) {
  const found = [];
  for (const file of newFiles) {
    for (const hit of findNames(file, names)) found.push({ where: `${file} (its name)`, name: hit.name });
  }
  // One search per file, over its added lines only: the hit's line is then looked up in that file's own numbering.
  const byFile = new Map();
  for (const { file, line, text } of addedLines(diffText)) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ line, text });
  }
  for (const [file, lines] of byFile) {
    for (const hit of findNames(lines.map((entry) => entry.text).join('\n'), names)) {
      found.push({ where: `${file}, line ${lines[hit.line - 1].line}`, name: hit.name });
    }
  }
  for (const { label, text } of texts) {
    const oneLine = !text.includes('\n');
    for (const hit of findNames(text, names)) found.push({ where: oneLine ? label : `${label}, line ${hit.line}`, name: hit.name });
  }
  return found;
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

/**
 * --pr: the scan of a pull request, for the GitHub check. Exit 1 on a hit (or when the list is required and missing).
 * The names are never printed unless --show is given: the check's log is public.
 */
function runPullRequest(argv) {
  const show = argv.includes('--show');
  const messagesAt = argv.indexOf('--messages');
  const messagesFile = messagesAt >= 0 ? argv[messagesAt + 1] : null;
  const refs = argv.filter((arg, i) => !arg.startsWith('--') && (messagesAt < 0 || i !== messagesAt + 1));
  const [base, head = 'HEAD'] = refs;
  if (!base) {
    console.error('Usage: node scripts/check-names.mjs --pr BASE [HEAD] [--messages FILE] [--show]');
    return 1;
  }

  const listPath = findDenylist();
  const listText = process.env.GRIMOIRE_NAMES || (listPath ? readFileSync(listPath, 'utf8') : '');
  const names = parseDenylist(listText);
  if (names.length === 0) {
    if (process.env.GRIMOIRE_NAMES_REQUIRED === 'true') {
      console.error(
        'The private-names scan has no list to check against: the repository secret PRIVATE_NAMES is missing or empty.\n' +
          'Nothing was scanned, so this fails. See docs/testing.md, The private-names scan.',
      );
      return 1;
    }
    console.log(
      'Not scanned for private names: no list here (a pull request from a fork or from Dependabot gets no secrets).\n' +
        'Before merging a pull request from outside, scan it where the private list is.',
    );
    return 0;
  }

  // What the pull request adds is measured from where it left the base branch; if that can't be found (a shallow
  // copy), from the base itself.
  let from = base;
  try {
    from = git(['merge-base', base, head]).trim() || base;
  } catch {
    from = base;
  }
  const diffText = git(['-c', 'core.quotepath=off', 'diff', '--unified=0', '--no-renames', '--no-color', '--no-ext-diff', from, head]);
  const newFiles = git(['-c', 'core.quotepath=off', 'diff', '--name-only', '--no-renames', '--diff-filter=A', '-z', from, head])
    .split('\0')
    .filter(Boolean);
  const texts = [];
  if (process.env.PR_TITLE) texts.push({ label: "the pull request's title", text: process.env.PR_TITLE });
  if (process.env.PR_BODY) texts.push({ label: "the pull request's text", text: process.env.PR_BODY });
  if (process.env.PR_BRANCH) texts.push({ label: "the branch's name", text: process.env.PR_BRANCH });
  const messages = messagesFile ? readFileSync(messagesFile, 'utf8') : git(['log', '--format=%B', `${from}..${head}`]);
  // A trailing line break keeps a one-message list from reading as a one-line text.
  texts.push({ label: 'the commit messages', text: `${messages.trimEnd()}\n` });

  const found = findInPullRequest({ diffText, newFiles, texts }, names);
  if (found.length === 0) {
    console.log(
      `No private name in what this pull request adds (${addedLines(diffText).length} added lines, ${newFiles.length} new files, ` +
        'its commit messages, title, text and branch name).',
    );
    return 0;
  }
  const places = [...new Set(found.map((hit) => (show ? `${hit.where}: "${hit.name}"` : hit.where)))];
  for (const place of places) console.error(`A private name was found in ${place}.`);
  console.error(
    '\nReal game, book, adventure and publisher names, and private names, must not reach the public repository (hard rule 2).\n' +
      (show ? '' : 'The name is not shown because this log is public. ') +
      'What was pushed is already public: stop, and tell the driver, before pushing a fix.\n' +
      'To see the name, run this where the private list is: node scripts/check-names.mjs --pr origin/main --show',
  );
  return 1;
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
  process.exit(argv[0] === '--hook' ? await runHook() : argv[0] === '--pr' ? runPullRequest(argv.slice(1)) : main(argv));
}

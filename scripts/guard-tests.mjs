// Claude Code hook (.claude/settings.json, PreToolUse on Write, Edit and MultiEdit): on a branch whose name starts
// with "fix-", guards the test files so a fix can't pass by weakening its test (ruled 2026-11-01, P5; bq-6, 2026-11-03).
// The ruled method: the first commit adds the failing test marked `it.fails` / `test.fails` (the check passes because
// it fails); the fix commit removes `.fails` and changes nothing else in that test, which must now pass. So on a fix
// branch the guard lets through exactly two kinds of change to a test file:
//   (a) adding new tests, every one marked `.fails` (with any `import` lines they need, as their own edit if need be);
//   (b) removing `.fails` from existing tests, with no other change.
// Anything else to a test file, or anything it can't read for sure, is blocked with the message below.
// Except (gd-1, 2026-11-14): a test that is in no commit on the branch yet may be edited, rewritten or deleted freely,
// and a test file in no commit yet is wholly free; the two rules above hold from the first commit that contains it.
// The branch is read from the folder of the file being edited, so a helper agent's worktree uses its own branch.
// Claude Code passes the tool call as JSON on stdin; exit code 2 blocks it and shows the message on stderr.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { basename, dirname, join, relative, resolve } from 'node:path';

// Matched in any case: Windows opens Src/ruleText.Test.ts as src/ruleText.test.ts (review-815 second round).
const TEST_FILES = [
  /(?:^|\/)src\/(?:.+\/)?[^/]+\.test\.[^/]+$/i, // src/**/*.test.*
  /(?:^|\/)supabase\/tests\//i, // supabase/tests/**
  /(?:^|\/)tests\/layout\//i, // tests/layout/**
  /(?:^|\/)scripts\/[^/]+\.test\.mjs$/i, // scripts/*.test.mjs
];

export const MESSAGE =
  'On a fix branch the test comes first and then stays as it is (bq-6). Commit the failing test marked ' +
  '`it.fails` / `test.fails` (the check passes because it fails); then the fix removes `.fails` and changes ' +
  'nothing else in that test, which must now pass. A test not in a commit yet may be changed freely (gd-1); a ' +
  'committed test allows only two edits: add new tests that are all marked `.fails` (any `import` lines they need ' +
  'as their own edit), or remove `.fails` alone. ' +
  'Keep helpers inside the new test. To change a test any other way, say so to Francis or use a non-fix branch.';

/**
 * The path as Windows reads it: forward slashes, and each name without the trailing dots or spaces Windows drops, and
 * the last without a `::$DATA` suffix, which opens the file itself (review-815, third round).
 */
function windowsForm(filePath) {
  let path = filePath.replace(/\\/g, '/');
  for (let before = ''; before !== path; ) {
    before = path;
    path = path.replace(/::\$DATA$/i, '');
    path = path
      .split('/')
      .map((name) => (name === '.' || name === '..' ? name : name.replace(/[. ]+$/, '')))
      .join('/');
  }
  return path;
}

/** True when the path is one of the test files the guard protects. */
export function isTestFile(filePath) {
  if (typeof filePath !== 'string') return false;
  const path = windowsForm(filePath);
  return TEST_FILES.some((pattern) => pattern.test(path));
}

/**
 * The path with its longest existing part resolved by the system (long names for 8.3 short ones, the real case), the
 * rest kept as given. The path as given when nothing of it can be resolved.
 */
export function canonicalPath(filePath) {
  const full = resolve(windowsForm(filePath));
  const rest = [];
  let dir = full;
  while (!existsSync(dir) && dirname(dir) !== dir) {
    rest.unshift(basename(dir));
    dir = dirname(dir);
  }
  try {
    return join(realpathSync.native(dir), ...rest);
  } catch {
    return full;
  }
}

// `.fails` straight after `it` or `test`: the marker the ruled method adds and later removes.
const FAILS_MARK = /(?<![\w$.])(?:it|test)\.fails(?=\s*\()/;
const FAILS_MARKS = new RegExp(FAILS_MARK.source, 'g');

/** True when `after` is `before` with one or more `.fails` marks removed and nothing else changed. */
export function onlyRemovesFails(before, after) {
  if (before === after) return false;
  const parts = [];
  let last = 0;
  for (const match of before.matchAll(FAILS_MARKS)) {
    const end = match.index + match[0].length; // Just after ".fails".
    parts.push(before.slice(last, end - '.fails'.length));
    last = end;
  }
  if (parts.length === 0) return false;
  parts.push(before.slice(last));
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${parts.map(escape).join('(?:\\.fails)?')}$`).test(after);
}

/**
 * Reads JavaScript or TypeScript text far enough to find its top level. Returns `code` (the text with strings emptied
 * to '' and comments removed) and `top` (the same, with every bracketed group collapsed to its outer brackets:
 * `it.fails('a', () => { ... });` becomes `it.fails();`). Returns null if the text doesn't close every string,
 * comment and bracket it opens, or closes one it didn't open: an insertion like that could swallow the tests around it.
 */
function readCode(text) {
  const closers = { '(': ')', '[': ']', '{': '}' };
  const stack = []; // Closing brackets awaited; '${' for a template's expression, whose } goes back into the template.
  let code = ''; // Everything, strings and comments emptied; a template's ${...} kept as code (review-815, third).
  let top = ''; // Only what sits outside every bracket.
  const put = (piece) => {
    code += piece;
    if (stack.length === 0) top += piece;
  };
  let inTemplate = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inTemplate) {
      if (c === '\\') i += 2;
      else if (c === '`') {
        inTemplate = false;
        put("''");
        i += 1;
      } else if (c === '$' && next === '{') {
        code += ' ('; // The expression is read as code, set apart from what's around it.
        stack.push('${');
        inTemplate = false;
        i += 2;
      } else i += 1;
      continue;
    }
    if (c === '`') {
      inTemplate = true;
      i += 1;
      continue;
    }
    if (c === '}' && stack[stack.length - 1] === '${') {
      stack.pop();
      code += ') ';
      inTemplate = true;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) return null;
      i = end + 2;
      put(' ');
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== c) {
        if (text[j] === '\\') j += 1;
        else if (text[j] === '\n') return null;
        j += 1;
      }
      if (j >= text.length) return null;
      put("''");
      i = j + 1;
      continue;
    }
    if (c === '/' && isRegexStart(text, i)) {
      const end = skipQuoted(text, i); // A regular expression: emptied like a string.
      if (end === -1) return null;
      put("''");
      i = end;
      continue;
    }
    if (c in closers) {
      if (stack.length === 0) top += c;
      code += c;
      stack.push(closers[c]);
      i += 1;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return null;
      code += c;
      if (stack.length === 0) top += c;
      i += 1;
      continue;
    }
    put(c);
    i += 1;
  }
  return stack.length === 0 && !inTemplate ? { code, top } : null;
}

// What an added piece's top level may hold: `.fails` tests, describe blocks, imports, and the semicolons between.
const TOP_STATEMENT = new RegExp(
  '^\\s*(?:' +
    [
      "(?:it|test)\\.fails\\s*\\(\\)", // it.fails(...)
      'describe\\s*\\(\\)', // describe(...)
      "import\\s*''", // import '...'
      "import\\s+(?:type\\s+)?(?:[\\w$]+\\s*,?\\s*)?(?:\\*\\s*as\\s+[\\w$]+\\s*|\\{\\}\\s*)?from\\s*''", // import x from '...'
    ].join('|') +
    ')\\s*;?\\s*',
);
// Never in an added piece: a test without `.fails`, a hook or mock that reaches the tests around it, .only / .skip.
const FORBIDDEN = [
  /(?<![\w$.])(?:it|test)\s*\(/, // a plain it( or test(
  /(?<![\w$.])(?:it|test)\s*\.\s*(?!fails\b)[\w$]+/, // it.skip, test.only, it.each, ...
  /(?<![\w$.])describe\s*\./, // describe.only, describe.skip, ...
  /\.\s*(?:only|skip|todo|skipIf|runIf)\b/,
  /(?<![\w$.])(?:before|after)(?:Each|All)\b/,
  // Mocks, stubs, spies and fake clocks outlive the test that sets them (review-815), as vi.x, vi?.x, vitest.x and
  // globalThis.vi.x alike.
  /(?<![\w$])(?:vi|vitest)\s*(?:\?\.|\.)\s*(?:mock|doMock|unmock|doUnmock|hoisted|stubGlobal|stubEnv|spyOn|useFakeTimers|setSystemTime|resetModules)\b/,
  /(?<![\w$.])(?:only|skip|todo|skipIf|runIf)\s*:/, // the options form: it('a', { only: true }, ...)
  /(?<![\w$.])(?:import|require)\s*\(/, // a module loaded at run time, which could hand vi over under another name
  // Code run from text, where the scan can't read it (review-815, third round).
  /(?<![\w$.])(?:eval|Function)\b/,
  /(?<![\w$])constructor\b/, // (() => {}).constructor('...') is Function by another road
];
// Read in the raw text, where strings are still whole.
const FORBIDDEN_RAW = [
  /(['"`])(?:only|skip|todo|skipIf|runIf)\1\s*:/, // the options with a quoted key
  /\bimport\s*\{[^}]*\b(?:vi|vitest)\s+as\b/, // import { vi as v }: vi under another name
  /\bimport\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\*\s*as\s+[\w$]+\s*from\s*(['"])vitest\1/, // import * as V from 'vitest'
  /\bimport\s+(?:type\s+)?[\w$]+\s*(?:,[^;]*)?from\s*(['"])vitest\1/, // import V from 'vitest'
];
// vi or vitest used as anything but `vi.name` / `vi?.name` (handed on, destructured, indexed with brackets).
const BARE_VI = /(?<![\w$])(?:vi|vitest)\b(?!\s*(?:\?\.|\.)\s*[\w$])/;

/** True when the code holds something the guard never lets into a test on a fix branch (strings and comments aside). */
function reachesOtherTests(text) {
  const read = readCode(text);
  if (!read) return true;
  if (FORBIDDEN.some((pattern) => pattern.test(read.code))) return true;
  if (FORBIDDEN_RAW.some((pattern) => pattern.test(text))) return true;
  if (/\\u/.test(read.code)) return true; // A unicode escape in a name (vi) hides it from every pattern here.
  // The plain import lists (import { describe, vi } from '...') name vi without using it; everything else may not. An
  // import is only taken as one at the start of a line that opens a statement: the start, or after ; or }.
  const IMPORT_LINE = /^[ \t]*import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{[^}]*\}\s*from\s*''\s*;?/gm;
  const withoutImports = read.code.replace(IMPORT_LINE, (match, offset, all) =>
    /(?:^|[;}])\s*$/.test(all.slice(0, offset)) ? '' : match,
  );
  return BARE_VI.test(withoutImports);
}

/** True when `piece` is only new tests marked `.fails` (in describe blocks or not), or only import lines. */
export function isAddedFailsTests(piece) {
  if (piece.trim() === '') return false;
  const read = readCode(piece);
  if (!read) return false;
  let rest = read.top;
  let statements = 0;
  let tests = 0;
  while (rest.trim() !== '') {
    const match = TOP_STATEMENT.exec(rest);
    if (!match || match[0] === '') return false;
    statements += 1;
    if (!/^\s*import/.test(match[0])) tests += 1;
    rest = rest.slice(match[0].length);
  }
  if (statements === 0) return false;
  if (reachesOtherTests(piece)) return false;
  if (tests > 0 && !FAILS_MARK.test(read.code)) return false; // describe blocks alone add no failing test.
  return true;
}

/** True when `after` is `before` with one piece inserted somewhere, and that piece is only `.fails` tests. */
export function onlyAddsFailsTests(before, after) {
  if (after.length <= before.length) return false;
  let prefix = 0;
  while (prefix < before.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
    suffix += 1;
  }
  // The insertion can sit anywhere between `before.length - suffix` and `prefix`: try each place, nearest line first.
  const low = before.length - suffix;
  if (low > prefix) return false; // More than one place changed.
  const inserted = after.length - before.length;
  for (let at = prefix, tries = 0; at >= low && tries < 2000; at -= 1, tries += 1) {
    if (isAddedFailsTests(after.slice(at, at + inserted))) return true;
  }
  return false;
}

/** True when changing `before` into `after` is one of the two edits the ruled method allows on a fix branch. */
export function isAllowedTestChange(before, after) {
  if (typeof before !== 'string' || typeof after !== 'string') return false;
  if (before === after) return true; // Nothing changes.
  return onlyRemovesFails(before, after) || onlyAddsFailsTests(before, after);
}

// gd-1 (Francis, 2026-11-14): a test that is in no commit yet may be edited freely; from the first commit that holds
// it, the rule above applies. "A test" is an `it(` / `test(` / `it.fails(` / `test.fails(` call whose title is a plain
// string; it counts as committed when any version of the file the branch has committed (from its merge base with
// origin/main to HEAD, and every earlier tip in HEAD's or the branch's reflog, so a reset, an amend or a remade branch
// frees nothing) has a test
// with the same title. A new test is taken out of the comparison, but its own text is still checked: nothing in it
// may reach the tests around it (a mock, a stub, a spy, a fake clock, a hook, the only / skip options).

const TEST_CALL = /(?:it|test)(?:\.fails)?\s*\(/y;
const DESCRIBE_CALL = /describe\s*\(/y;

/** Index just past the string or comment starting at `i`, or -1 when it doesn't close; `i` itself when there is none. */
function skipQuoted(text, i) {
  const c = text[i];
  const next = text[i + 1];
  if (c === '/' && next === '/') {
    const end = text.indexOf('\n', i);
    return end === -1 ? text.length : end;
  }
  if (c === '/' && next === '*') {
    const end = text.indexOf('*/', i + 2);
    return end === -1 ? -1 : end + 2;
  }
  if (c === "'" || c === '"' || c === '`') {
    let j = i + 1;
    while (j < text.length && text[j] !== c) {
      if (text[j] === '\\') j += 1;
      else if (c !== '`' && text[j] === '\n') return -1;
      j += 1;
    }
    return j >= text.length ? -1 : j + 1;
  }
  if (c === '/' && isRegexStart(text, i)) {
    let j = i + 1;
    let inClass = false;
    while (j < text.length && (inClass || text[j] !== '/')) {
      if (text[j] === '\n') return -1;
      if (text[j] === '\\') j += 1;
      else if (text[j] === '[') inClass = true;
      else if (text[j] === ']') inClass = false;
      j += 1;
    }
    if (j >= text.length) return -1;
    j += 1;
    while (/[a-z]/.test(text[j] ?? '')) j += 1; // Flags.
    return j;
  }
  return i;
}

/** True when the `/` at `i` starts a regular expression, not a division: what comes before it can't end a value. */
function isRegexStart(text, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j -= 1;
  if (j < 0) return true;
  if (text[j] === '!' && /[\w$)\]]/.test(text[j - 1] ?? '')) return false; // TypeScript's value! / other.
  // Not <, > or } (JSX's </tag>, <a /> and <a b={c} />), except an arrow's =>.
  if ('(,=:[!&|?{;+-*%~^'.includes(text[j]) || (text[j] === '>' && text[j - 1] === '=')) return true;
  return /(?<![\w$.])(?:return|typeof|case|in|of|void|delete|throw|new|instanceof|yield|await)$/.test(
    text.slice(Math.max(0, j - 10), j + 1),
  );
}

/**
 * Every `it(` / `test(` (with or without `.fails`) and `describe(` call in the text, at any depth:
 * `{ kind, start, end, title, args }`, where `end` takes in a following `;`, `title` is the first argument when it is a
 * plain string (else null) and `args` is the text after the title up to the closing bracket. Null when the text doesn't
 * close every string, comment and bracket it opens: then nothing can be told for sure.
 */
export function findCalls(text) {
  if (typeof text !== 'string') return null;
  const calls = [];
  const closers = { '(': ')', '[': ']', '{': '}' };
  const open = []; // [closer, call or null] for each open bracket.
  let i = 0;
  while (i < text.length) {
    const skipped = skipQuoted(text, i);
    if (skipped === -1) return null;
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const c = text[i];
    let found = null;
    if (!/[\w$.]/.test(text[i - 1] ?? '')) {
      for (const [kind, pattern] of [['test', TEST_CALL], ['describe', DESCRIBE_CALL]]) {
        pattern.lastIndex = i;
        const match = pattern.exec(text);
        if (match) {
          found = { kind, paren: i + match[0].length - 1 };
          break;
        }
      }
    }
    if (found) {
      let at = found.paren + 1;
      while (/\s/.test(text[at] ?? '')) at += 1;
      const end = skipQuoted(text, at);
      if (end === -1) return null;
      const quoted = end > at && /['"`]/.test(text[at]) ? text.slice(at, end) : null;
      const plain = quoted !== null && !(quoted[0] === '`' && quoted.includes('${'));
      const call = {
        kind: found.kind,
        start: i,
        title: plain ? quoted.slice(1, -1) : null,
        argsFrom: plain ? end : found.paren + 1,
      };
      calls.push(call);
      open.push([')', call]);
      i = plain ? end : found.paren + 1;
      continue;
    }
    if (c in closers) {
      open.push([closers[c], null]);
    } else if (c === ')' || c === ']' || c === '}') {
      const [closer, call] = open.pop() ?? [];
      if (closer !== c) return null;
      if (call) {
        call.args = text.slice(call.argsFrom, i);
        const semicolon = /^[ \t]*;/.exec(text.slice(i + 1));
        call.end = i + 1 + (semicolon ? semicolon[0].length : 0);
      }
    }
    i += 1;
  }
  return open.length === 0 ? calls : null;
}

/** The titles of the tests and describe blocks in a file's committed text, or null when it can't be read for sure. */
export function committedTitles(text) {
  const calls = findCalls(text);
  if (!calls) return null;
  const titles = { test: new Set(), describe: new Set() };
  for (const call of calls) if (call.title !== null) titles[call.kind].add(call.title);
  return titles;
}

/** Removes each call `strip` picks, with the blank space in front of it; null when the text can't be read. */
function removeCalls(text, strip) {
  const calls = findCalls(text);
  if (!calls) return null;
  const chosen = calls.filter((call) => strip(call, calls));
  let out = text;
  for (const call of chosen.sort((a, b) => b.start - a.start)) {
    let from = call.start;
    while (from > 0 && /\s/.test(out[from - 1])) from -= 1;
    out = out.slice(0, from) + out.slice(call.end);
  }
  return { text: out, removed: chosen.map((call) => call.args) };
}

/**
 * `text`: the file with every uncommitted test taken out, then every uncommitted describe block left empty by that
 * (what is left is what the rule of the committed tests applies to); `removed`: what came after each removed test's
 * title, its options and body. Null when the text can't be read for sure.
 */
export function withoutNewTests(text, titles) {
  const inside = (call, calls) => calls.some((other) => other !== call && other.start > call.start && other.start < call.end);
  const tests = removeCalls(text, (call, calls) =>
    call.kind === 'test' && call.title !== null && !titles.test.has(call.title) && !inside(call, calls));
  if (!tests) return null;
  let out = tests.text;
  for (let round = 0; round < 50; round += 1) {
    const blocks = removeCalls(out, (call, calls) =>
      call.kind === 'describe' && call.title !== null && !titles.describe.has(call.title) &&
      /^\s*,\s*(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{\s*\}\s*$/.test(call.args) && !inside(call, calls));
    if (!blocks) return null;
    if (blocks.removed.length === 0) return { text: out, removed: tests.removed };
    out = blocks.text;
  }
  return null;
}

/**
 * The file's whole text before and after the tool call (line ends as \n), or null when it can't be worked out for
 * sure: the file can't be read, or an Edit's text isn't in it exactly once (or at all, for replace_all).
 */
function wholeChangeOf(input, readFile) {
  const tool = input?.tool_name;
  const args = input?.tool_input ?? {};
  const current = readFile(args.file_path);
  const lf = (text) => text.replace(/\r\n/g, '\n');
  if (tool === 'Write') return typeof args.content === 'string' ? [lf(current ?? ''), lf(args.content)] : null;
  if (typeof current !== 'string') return null;
  const edits = tool === 'Edit' ? [args] : tool === 'MultiEdit' && Array.isArray(args.edits) ? args.edits : [];
  if (edits.length === 0) return null;
  const before = lf(current);
  let after = before;
  for (const one of edits) {
    if (typeof one?.old_string !== 'string' || typeof one?.new_string !== 'string' || one.old_string === '') return null;
    const from = lf(one.old_string);
    const pieces = after.split(from);
    if (pieces.length < 2 || (!one.replace_all && pieces.length !== 2)) return null;
    after = pieces.join(lf(one.new_string));
  }
  return [before, after];
}

/**
 * True when the tool call touches only tests that are in no commit yet (gd-1), or changes the committed ones only the
 * ruled way, and no new test holds anything that reaches the tests around it. `committed` is every version of the
 * file the branch has committed (a list; empty when none has it; one text alone is taken as a list of one; null as
 * none), or undefined when it can't tell.
 */
export function onlyTouchesNewTests(input, readFile, committed) {
  const versions = typeof committed === 'string' ? [committed] : committed === null ? [] : committed;
  if (!Array.isArray(versions) || versions.some((text) => typeof text !== 'string')) return false;
  if (versions.length === 0) return true; // A test file in no commit yet: all of it is new.
  const titles = { test: new Set(), describe: new Set() };
  for (const text of versions) {
    const found = committedTitles(text);
    if (!found) return false;
    for (const kind of ['test', 'describe']) for (const title of found[kind]) titles[kind].add(title);
  }
  const whole = wholeChangeOf(input, readFile);
  if (!whole) return false;
  const before = withoutNewTests(whole[0], titles);
  const after = withoutNewTests(whole[1], titles);
  if (before === null || after === null) return false;
  if (after.removed.some(reachesOtherTests)) return false; // review-815: a new test can't carry in a fake.
  return isAllowedTestChange(before.text, after.text);
}

/** Every (before, after) pair the tool call makes, or null when it can't be read for sure. */
function changesOf(input, readFile) {
  const tool = input?.tool_name;
  const args = input?.tool_input ?? {};
  if (tool === 'Write') {
    const current = readFile(args.file_path);
    if (current === undefined) return null; // There but unreadable: a Write can't be checked (review-815, nit 4).
    return [[current ?? '', args.content]];
  }
  if (tool === 'Edit') return [[args.old_string, args.new_string]];
  if (tool === 'MultiEdit') {
    if (!Array.isArray(args.edits) || args.edits.length === 0) return null;
    return args.edits.map((edit) => [edit?.old_string, edit?.new_string]);
  }
  return null;
}

/**
 * The block message, or null to let the edit through. `branchOf(filePath)` gives the branch the file is on;
 * `readFile(filePath)` gives the file's text now, null if it doesn't exist, undefined if it exists but can't be read;
 * `committedOf(filePath)` gives every version of it the branch has committed (see onlyTouchesNewTests), undefined
 * when it can't tell.
 */
export function decide(input, branchOf, readFile = () => null, committedOf = () => undefined, canonical = (p) => p) {
  const given = input?.tool_input?.file_path;
  if (typeof given !== 'string') return null;
  const filePath = canonical(given); // In the hook: long names and real case for the folders that exist.
  // A ~ left in a name is an 8.3 short name the system couldn't resolve, which may open a test file (review-815, 3rd).
  const shortName = windowsForm(filePath).split('/').some((name) => name.includes('~'));
  if (!isTestFile(filePath) && !shortName) return null;
  const branch = branchOf(filePath);
  if (typeof branch !== 'string' || !branch.startsWith('fix-')) return null;
  if (!isTestFile(filePath)) {
    return `Blocked: ${given.replace(/\\/g, '/')} has a short (~) name the guard can't resolve, on the fix branch ${branch}. Use the file's full name.`;
  }
  const blocked = `Blocked: ${given.replace(/\\/g, '/')} is a test file and this is the fix branch ${branch}.\n${MESSAGE}`;
  if (readFile(filePath) === undefined) return blocked; // There but unreadable: nothing can be checked.
  const changes = changesOf(input, readFile);
  if (changes && changes.every(([before, after]) => isAllowedTestChange(before, after))) return null;
  if (onlyTouchesNewTests(input, readFile, committedOf(filePath))) return null;
  return blocked;
}

/**
 * The current branch of the repo that holds this file (its nearest existing folder), or null. Read through runGit, so
 * an inherited GIT_DIR can't make it read another repo's branch (review-815 second round).
 */
export function branchOf(filePath, git = runGit) {
  let dir = dirname(resolve(filePath));
  while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], dir).trim();
  } catch {
    return null; // Not in a repo (or git isn't there): let it through.
  }
}

/**
 * Runs git in `cwd` and gives its output; throws when git fails. GIT_* variables (set inside git's own hooks) are left
 * out, so the repo asked about is always the one that holds `cwd`.
 */
export function runGit(args, cwd, input, extraEnv = {}) {
  // `extraEnv` is added after GIT_* are left out: tests use it for an isolated git config (review-815, 3rd, nit 4).
  const inherited = Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'));
  const env = { ...Object.fromEntries(inherited), ...extraEnv };
  const stdio = [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'];
  const options = { cwd, env, input, encoding: 'utf8', stdio, maxBuffer: 256 * 1024 * 1024 };
  return execFileSync('git', args, options);
}

/**
 * Every version of the file its branch has committed: at the merge base with origin/main, and in each commit after it
 * reachable from HEAD or from any earlier tip in HEAD's or the branch's reflog (so a reset, an amend or a deleted and
 * remade branch frees nothing). The path
 * is matched without regard to case, so a path spelled in another case finds the same file. An empty list when no
 * such commit holds it; undefined when it can't tell (no repo, no commit, no origin/main, or any git step failing),
 * which keeps the rule for committed tests. `git(args, cwd)` runs git (replaceable in tests).
 */
export function committedOf(filePath, git = runGit) {
  const full = resolve(filePath);
  let dir = dirname(full);
  while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
  try {
    git(['rev-parse', '--verify', 'HEAD'], dir);
    const top = git(['rev-parse', '--show-toplevel'], dir).trim();
    const path = relative(resolve(top), full).replace(/\\/g, '/');
    if (path === '' || path.startsWith('../')) return undefined;
    const base = git(['merge-base', 'refs/remotes/origin/main', 'HEAD'], top).trim();
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], top).trim();
    const lines = (text) => text.split('\n').filter(Boolean);
    // Earlier tips: the branch's own reflog, and HEAD's, which outlives a deleted and remade branch (review-815, 2nd).
    const tips = lines(git(['reflog', 'show', '--format=%H', 'HEAD', '--'], top));
    if (branch !== 'HEAD') tips.push(...lines(git(['reflog', 'show', '--format=%H', `refs/heads/${branch}`, '--'], top)));
    const commits = new Set([base]);
    // The commits go in on stdin: a long reflog would overflow a command line.
    const revs = ['HEAD', ...new Set(tips), `^${base}`].join('\n') + '\n';
    const log = git(['log', '--format=%H', '--stdin', '--', `:(icase)${path}`], top, revs);
    for (const sha of lines(log)) commits.add(sha);
    const versions = [];
    for (const commit of commits) {
      const names = lines(git(['ls-tree', '-r', '--name-only', '--full-tree', commit], top));
      for (const name of names.filter((one) => one.toLowerCase() === path.toLowerCase())) {
        versions.push(git(['show', `${commit}:${name}`], top));
      }
    }
    return versions;
  } catch {
    return undefined;
  }
}

/** The file's text; null when it isn't there; undefined when it is there but can't be read. */
function readFile(filePath) {
  try {
    return readFileSync(resolve(filePath), 'utf8');
  } catch (error) {
    return error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? null : undefined;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let input = {};
  try {
    // Read stdin as a stream: a plain synchronous read can fail on Windows pipes.
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    const BOM = String.fromCharCode(0xfeff);
    input = JSON.parse(text.replace(BOM, '').trim() || '{}');
  } catch {
    process.exit(0); // Not a tool call we understand: let it through.
  }
  const message = decide(input, branchOf, readFile, committedOf, canonicalPath);
  if (message) {
    console.error(message);
    process.exit(2);
  }
  process.exit(0);
}

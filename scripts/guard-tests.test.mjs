// Tests for the Claude Code hook that keeps tests fixed on fix branches (scripts/guard-tests.mjs; P5, bq-6).
import { describe, expect, it } from 'vitest';
import { decide, isTestFile, onlyAddsFailsTests, onlyRemovesFails } from './guard-tests.mjs';
import { branchOf, canonicalPath, committedOf, runGit } from './guard-tests.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = '/repo/src/core/commands.test.ts';
const edit = (old_string, new_string, file_path = FILE) => ({
  tool_name: 'Edit',
  tool_input: { file_path, old_string, new_string },
});
const write = (content, file_path = FILE) => ({ tool_name: 'Write', tool_input: { file_path, content } });
const multi = (edits, file_path = FILE) => ({ tool_name: 'MultiEdit', tool_input: { file_path, edits } });
const on = (branch) => () => branch;
const fix = on('fix-undo-stack');
const fileHolds = (text) => () => text;

const EXISTING = [
  "import { expect, it } from 'vitest';",
  "import { undo } from './commands';",
  '',
  "it('undoes a give', () => {",
  '  expect(undo(2)).toBe(1);',
  '});',
  '',
].join('\n');
const FAILING_TEST = [
  "it.fails('undoes a partial give back into its stack', () => {",
  "  const note = 'it( inside a string is only text';",
  '  expect(undo(3)).toBe(2);',
  '});',
  '',
].join('\n');
const MARKED = EXISTING + '\n' + FAILING_TEST;
const UNMARKED = EXISTING + '\n' + FAILING_TEST.replace('it.fails(', 'it(');

describe('the fix-branch test guard: which files', () => {
  it('recognises each protected test location, in Windows and Unix paths', () => {
    expect(isTestFile('/repo/src/core/commands.test.ts')).toBe(true);
    expect(isTestFile('C:\\repo\\src\\app\\smoke.test.tsx')).toBe(true);
    expect(isTestFile('/repo/supabase/tests/m3-health.test.ts')).toBe(true);
    expect(isTestFile('/repo/supabase/tests/helpers/people.ts')).toBe(true);
    expect(isTestFile('/repo/tests/layout/layout.spec.ts')).toBe(true);
    expect(isTestFile('C:\\repo\\scripts\\guard-tests.test.mjs')).toBe(true);
  });

  // review-815 second round, 2: NTFS opens the same file whatever the case, so the guard must recognise it too.
  it('recognises a test file whatever the case of its path', () => {
    expect(isTestFile('C:\\repo\\Src\\modules\\library\\ruleText.test.ts')).toBe(true);
    expect(isTestFile('/repo/src/modules/library/ruleText.Test.ts')).toBe(true);
    expect(isTestFile('/repo/SUPABASE/Tests/m3-health.test.ts')).toBe(true);
    expect(isTestFile('/repo/Tests/Layout/layout.spec.ts')).toBe(true);
    expect(isTestFile('/repo/Scripts/guard-tests.TEST.mjs')).toBe(true);
    expect(decide(edit('a', 'b', '/repo/Src/core/commands.Test.ts'), on('fix-undo-stack'))).toMatch(/Blocked/);
  });

  // review-815 third round, 2: Windows opens the same file through a trailing dot or space, or ::$DATA.
  it('recognises a test file behind a trailing dot or space, or a ::$DATA suffix', () => {
    expect(isTestFile('C:\\repo\\src\\modules\\library\\ruleText.test.ts.')).toBe(true);
    expect(isTestFile('C:\\repo\\src\\modules\\library\\ruleText.test.ts . .')).toBe(true);
    expect(isTestFile('C:\\repo\\src\\modules\\library\\ruleText.test.ts::$DATA')).toBe(true);
    expect(isTestFile('C:\\repo\\src\\modules\\library\\ruleText.test.ts::$data. ')).toBe(true);
    expect(isTestFile('C:\\repo\\src.\\core\\commands.test.ts')).toBe(true);
    expect(isTestFile('/repo/scripts /guard-tests.test.mjs')).toBe(true);
    expect(decide(edit('a', 'b', 'C:\\repo\\src\\core\\commands.test.ts.'), on('fix-undo-stack'))).toMatch(/Blocked/);
  });

  // review-815 third round, 2: an 8.3 short name (RULETE~1.TS) the guard can't resolve to a long one is refused.
  it('refuses a path still holding a ~ on a fix branch, and lets it through elsewhere', () => {
    expect(decide(edit('a', 'b', 'C:\\repo\\src\\modules\\library\\RULETE~1.TS'), fix)).toMatch(/Blocked/);
    expect(decide(edit('a', 'b', 'C:\\repo\\SRC~1\\core\\x.ts'), fix)).toMatch(/Blocked/);
    expect(decide(edit('a', 'b', 'C:\\repo\\src\\modules\\library\\RULETE~1.TS'), on('m5b-weather'))).toBeNull();
  });

  it('resolves the path through the folders that exist before matching', () => {
    const root = mkdtempSync(join(tmpdir(), 'guard-paths-'));
    try {
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src', 'a.test.ts'), '');
      expect(canonicalPath(join(root, 'src', 'a.test.ts'))).toBe(realpathSync.native(join(root, 'src', 'a.test.ts')));
      const missing = canonicalPath(join(root, 'src', 'later', 'b.test.ts'));
      expect(missing).toBe(join(realpathSync.native(join(root, 'src')), 'later', 'b.test.ts'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat code, migrations or other scripts as tests', () => {
    expect(isTestFile('/repo/src/core/commands.ts')).toBe(false);
    expect(isTestFile('/repo/supabase/migrations/20261020000000_first.sql')).toBe(false);
    expect(isTestFile('/repo/scripts/guard-tests.mjs')).toBe(false);
    expect(isTestFile(undefined)).toBe(false);
  });

  it('lets non-test files through on a fix- branch', () => {
    expect(decide(edit('a', 'b', '/repo/src/core/commands.ts'), fix)).toBeNull();
    expect(decide(edit('a', 'b', '/repo/docs/05-features.md'), fix)).toBeNull();
    expect(decide({}, fix)).toBeNull();
  });
});

describe('the fix-branch test guard: adding a failing test (the first commit)', () => {
  it('allows adding a new test marked it.fails after the last test', () => {
    expect(decide(edit('});\n', '});\n\n' + FAILING_TEST), fix)).toBeNull();
  });

  it('allows adding a test.fails test in front of an existing test', () => {
    const before = "it('undoes a give', () => {";
    const after = "test.fails('undoes twice', () => {\n  expect(undo(undo(2))).toBe(0);\n});\n\n" + before;
    expect(decide(edit(before, after), fix)).toBeNull();
  });

  it('allows a new describe block holding only .fails tests', () => {
    const block = "\ndescribe('partial gives', () => {\n" + FAILING_TEST + '});\n';
    expect(decide(edit('});\n', '});\n' + block), fix)).toBeNull();
  });

  it('allows the import lines a new test needs, as their own edit', () => {
    const before = "import { undo } from './commands';";
    const after = before + "\nimport { give, type Stack } from './items';";
    expect(decide(edit(before, after), fix)).toBeNull();
  });

  it('allows writing a whole new test file whose tests are all .fails', () => {
    const content = "import { expect, it } from 'vitest';\nimport { undo } from './commands';\n\n" + FAILING_TEST;
    expect(decide(write(content, '/repo/src/core/undo.test.ts'), fix, () => null)).toBeNull();
  });

  it('allows rewriting an existing test file when the only change is an added .fails test', () => {
    expect(decide(write(MARKED), fix, fileHolds(EXISTING))).toBeNull();
  });
});

describe('the fix-branch test guard: removing .fails (the fix commit)', () => {
  it('allows removing .fails and nothing else', () => {
    expect(decide(edit("it.fails('undoes a partial give", "it('undoes a partial give"), fix)).toBeNull();
    expect(decide(write(UNMARKED), fix, fileHolds(MARKED))).toBeNull();
  });

  it('allows removing .fails from one test of several, or in a MultiEdit', () => {
    const two = "it.fails('a', () => {});\ntest.fails('b', () => {});";
    expect(onlyRemovesFails(two, "it('a', () => {});\ntest.fails('b', () => {});")).toBe(true);
    const edits = [
      { old_string: "it.fails('a'", new_string: "it('a'" },
      { old_string: "test.fails('b'", new_string: "test('b'" },
    ];
    expect(decide(multi(edits), fix)).toBeNull();
  });

  it('blocks removing .fails when the test body changes too', () => {
    const changedBody = UNMARKED.replace('toBe(2)', 'toBe(3)');
    expect(decide(write(changedBody), fix, fileHolds(MARKED))).toMatch(/Blocked/);
    const before = "it.fails('a', () => {\n  expect(undo(3)).toBe(2);\n});";
    const after = "it('a', () => {\n  expect(undo(3)).toBe(3);\n});";
    expect(decide(edit(before, after), fix)).toMatch(/Blocked/);
  });
});

describe('the fix-branch test guard: everything else is blocked, with the ruled method', () => {
  it('blocks changing an existing assertion, and the message says how to do it the ruled way', () => {
    const message = decide(edit('expect(undo(2)).toBe(1);', 'expect(undo(2)).toBe(2);'), fix);
    expect(message).toMatch(/fix-undo-stack/);
    expect(message).toMatch(/marked `it\.fails` \/ `test\.fails`/);
    expect(message).toMatch(/the fix removes `\.fails` and changes nothing else in that test/);
    expect(message).toMatch(/say so to Francis or use a non-fix branch/);
  });

  it('blocks adding a test that is not marked .fails', () => {
    expect(decide(edit('});\n', '});\n\n' + FAILING_TEST.replace('it.fails(', 'it(')), fix)).toMatch(/Blocked/);
    expect(decide(write(UNMARKED), fix, fileHolds(EXISTING))).toMatch(/Blocked/);
  });

  it('blocks marking an existing passing test .fails', () => {
    expect(decide(edit("it('undoes a give'", "it.fails('undoes a give'"), fix)).toMatch(/Blocked/);
  });

  it('blocks a new .fails test that also skips, focuses or hooks into the tests around it', () => {
    const added = (text) => decide(edit('});\n', '});\n' + text), fix);
    expect(added("it.fails.only('a', () => {});\n")).toMatch(/Blocked/);
    expect(added("it.fails('a', () => {});\nit.skip('b', () => {});\n")).toMatch(/Blocked/);
    expect(added("describe.only('a', () => {\n  it.fails('b', () => {});\n});\n")).toMatch(/Blocked/);
    expect(added("beforeEach(() => {});\nit.fails('a', () => {});\n")).toMatch(/Blocked/);
    expect(added("vi.mock('./commands');\nit.fails('a', () => {});\n")).toMatch(/Blocked/);
    expect(added("const helper = 1;\nit.fails('a', () => {});\n")).toMatch(/Blocked/);
    expect(added("describe('only describes', () => {});\n")).toMatch(/Blocked/);
  });

  it('blocks an insertion that leaves a comment, string or bracket open', () => {
    expect(onlyAddsFailsTests('a\nb', "a\nit.fails('a', () => {});\n/*\nb")).toBe(false);
    expect(onlyAddsFailsTests('a\nb', "a\nit.fails('a', () => {\nb")).toBe(false);
    expect(onlyAddsFailsTests('a\nb', "a\n});\nit.fails('a', () => {});\nb")).toBe(false);
  });

  it('blocks adding a .fails test while changing something else in the file', () => {
    const elsewhere = MARKED.replace('toBe(1)', 'toBe(5)');
    expect(decide(write(elsewhere), fix, fileHolds(EXISTING))).toMatch(/Blocked/);
  });

  it('blocks deleting a test, and a MultiEdit where any edit is not allowed', () => {
    expect(decide(write(EXISTING), fix, fileHolds(MARKED))).toMatch(/Blocked/);
    const edits = [
      { old_string: "it.fails('a'", new_string: "it('a'" },
      { old_string: 'toBe(1)', new_string: 'toBe(2)' },
    ];
    expect(decide(multi(edits), fix)).toMatch(/Blocked/);
  });

  it('blocks a tool call it cannot read for sure', () => {
    expect(decide(multi([]), fix)).toMatch(/Blocked/);
    expect(decide({ tool_name: 'NotebookEdit', tool_input: { file_path: FILE } }, fix)).toMatch(/Blocked/);
    expect(decide({ tool_name: 'Edit', tool_input: { file_path: FILE } }, fix)).toMatch(/Blocked/);
  });
});

// gd-1 (Francis, 2026-11-14): a new test may be edited freely until the first commit that contains it.
describe('the fix-branch test guard: a test not yet committed (gd-1)', () => {
  const inHead = (text) => () => text; // The file as the branch's last commit holds it.
  const notInHead = () => null; // The file is in no commit yet.
  const NEW_TEST = FAILING_TEST.replace('it.fails(', 'it('); // Not committed, and run without .fails.

  it('lets an uncommitted new test be edited, rewritten or deleted, with or without .fails', () => {
    const now = EXISTING + '\n' + NEW_TEST;
    const changed = edit('expect(undo(3)).toBe(2);', 'expect(undo(3)).toEqual(2);\n  expect(undo(4)).toBe(3);');
    expect(decide(changed, fix, fileHolds(now), inHead(EXISTING))).toBeNull();
    expect(decide(write(UNMARKED.replace('a partial give', 'a split stack')), fix, fileHolds(now), inHead(EXISTING)))
      .toBeNull();
    expect(decide(write(MARKED), fix, fileHolds(now), inHead(EXISTING))).toBeNull();
    expect(decide(write(EXISTING), fix, fileHolds(now), inHead(EXISTING))).toBeNull();
  });

  it('lets a new test be added without .fails before the first commit', () => {
    const added = edit('});\n', '});\n\n' + NEW_TEST);
    expect(decide(added, fix, fileHolds(EXISTING), inHead(EXISTING))).toBeNull();
  });

  it('keeps today\'s rule for a committed test: its body may not change', () => {
    const now = EXISTING + '\n' + NEW_TEST;
    const changed = edit('expect(undo(2)).toBe(1);', 'expect(undo(2)).toBe(2);');
    expect(decide(changed, fix, fileHolds(now), inHead(EXISTING))).toMatch(/Blocked/);
    expect(decide(write(now.replace('toBe(1)', 'toBe(2)')), fix, fileHolds(now), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('keeps today\'s rule for the committed tests of a file that is in the last commit', () => {
    // Deleting a committed test, or giving it .fails, is still refused; removing a committed .fails alone still passes.
    expect(decide(write(NEW_TEST), fix, fileHolds(EXISTING + '\n' + NEW_TEST), inHead(EXISTING))).toMatch(/Blocked/);
    const marking = edit("it('undoes a give'", "it.fails('undoes a give'");
    expect(decide(marking, fix, fileHolds(EXISTING), inHead(EXISTING))).toMatch(/Blocked/);
    expect(decide(write(UNMARKED), fix, fileHolds(MARKED), inHead(MARKED))).toBeNull();
  });

  it('lets a test file that is in no commit yet be edited freely', () => {
    const file = '/repo/src/core/undo.test.ts';
    const anything = "import { beforeEach, it } from 'vitest';\nbeforeEach(() => {});\nit('a', () => {});\n";
    expect(decide(write(anything, file), fix, () => null, notInHead)).toBeNull();
    expect(decide(edit("it('a'", "it.skip('b'", file), fix, fileHolds(anything), notInHead)).toBeNull();
  });

  it('refuses a mixed edit that touches a committed test beyond today\'s allowance', () => {
    const now = EXISTING + '\n' + NEW_TEST;
    const edits = [
      { old_string: 'expect(undo(3)).toBe(2);', new_string: 'expect(undo(3)).toBe(9);' },
      { old_string: 'expect(undo(2)).toBe(1);', new_string: 'expect(undo(2)).toBe(2);' },
    ];
    expect(decide(multi(edits), fix, fileHolds(now), inHead(EXISTING))).toMatch(/Blocked/);
    const both = now.replace('toBe(2)', 'toBe(9)').replace('toBe(1)', 'toBe(5)');
    expect(decide(write(both), fix, fileHolds(now), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('allows a mixed edit that changes a new test and only removes .fails from a committed one', () => {
    const now = MARKED + "\nit('splits a stack', () => {\n  expect(undo(5)).toBe(4);\n});\n";
    const after = now.replace("it.fails('undoes a partial", "it('undoes a partial").replace('toBe(4)', 'toBe(3)');
    expect(decide(write(after), fix, fileHolds(now), inHead(MARKED))).toBeNull();
  });

  it('counts a new test that shares a committed test\'s title as committed', () => {
    const now = EXISTING + "\nit('undoes a give', () => {\n  expect(undo(7)).toBe(6);\n});\n";
    const changed = edit('expect(undo(7)).toBe(6);', 'expect(undo(7)).toBe(7);');
    expect(decide(changed, fix, fileHolds(now), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('refuses what reaches the committed tests even beside a new test: .only, hooks, a changed line outside', () => {
    const add = (text) => decide(edit('});\n', '});\n' + text), fix, fileHolds(EXISTING), inHead(EXISTING));
    expect(add("it.only('a', () => {});\n")).toMatch(/Blocked/);
    expect(add("beforeEach(() => {});\nit('a', () => {});\n")).toMatch(/Blocked/);
    expect(add("const helper = 1;\nit('a', () => {});\n")).toMatch(/Blocked/);
  });

  it('lets a new describe block holding only new tests be edited', () => {
    const block = "\ndescribe('partial gives', () => {\n" + NEW_TEST + '});\n';
    const now = EXISTING + block;
    expect(decide(edit('toBe(2)', 'toBe(4)'), fix, fileHolds(now), inHead(EXISTING))).toBeNull();
    expect(decide(edit('});\n', '});\n' + block), fix, fileHolds(EXISTING), inHead(EXISTING))).toBeNull();
  });

  it('reads files with regular expressions, JSX and TypeScript around the tests', () => {
    const head = [
      "it('matches brackets', () => {",
      "  expect(/\\(\\[\\{'/.test('(')).toBe(true);",
      '  render(<Frame label={name} />);',
      "  expect(width! / 2).toBe(1); // 'a quote in a comment",
      '});',
      '',
    ].join('\n');
    const now = head + "\nit('a new one', () => {\n  expect(/}/.test('}')).toBe(true);\n});\n";
    const changed = edit("expect(/}/.test('}')).toBe(true);", "expect(/]/.test(']')).toBe(true);");
    expect(decide(changed, fix, fileHolds(now), inHead(head))).toBeNull();
    const committed = edit('render(<Frame label={name} />);', 'render(<Frame />);');
    expect(decide(committed, fix, fileHolds(now), inHead(head))).toMatch(/Blocked/);
  });

  // review-815, 1: a new test is taken out of the comparison, so its own text is checked for what reaches other tests.
  it('refuses a new test holding vi.mock, beside the removal of .fails from a committed test', () => {
    const mocking = "\nit('setup', () => {\n  vi.mock('./split', () => ({ split: () => 2 }));\n});\n";
    expect(decide(write(UNMARKED + mocking), fix, fileHolds(MARKED), inHead(MARKED))).toMatch(/Blocked/);
  });

  it('refuses a new test that stubs, spies, fakes timers or mocks, with or without .fails', () => {
    const add = (body, mark = 'it') =>
      decide(edit('});\n', `});\n\n${mark}('n', () => {\n  ${body}\n});\n`), fix, fileHolds(EXISTING), inHead(EXISTING));
    for (const body of [
      "vi.stubGlobal('fetch', () => 1);",
      "vi.stubEnv('MODE', 'x');",
      'vi.useFakeTimers();',
      "vi.spyOn(Math, 'random').mockReturnValue(0);",
      "vi.doMock('./commands');",
      'beforeEach(() => {});',
    ]) {
      expect(add(body)).toMatch(/Blocked/);
      expect(add(body, 'it.fails')).toMatch(/Blocked/);
    }
  });

  // review-815 second round, 1: other spellings of vi, and vi under another name.
  it('refuses a new test that reaches vi through ?., brackets, vitest or another name', () => {
    const withBody = (body) =>
      decide(
        write(UNMARKED.replace("it('undoes a partial", `it('setup', () => {\n  ${body}\n});\n\nit('undoes a partial`)),
        fix,
        fileHolds(MARKED),
        inHead(MARKED),
      );
    for (const body of [
      "vi?.spyOn(Math, 'random').mockReturnValue(0);",
      "vi['useFakeTimers']();",
      "vi?.['spyOn'](Math, 'random');",
      "vitest.mock('./split', () => ({ split: () => 2 }));",
      "const v = vi;\n  v.spyOn(Math, 'random');",
      "const { spyOn } = vi;\n  spyOn(Math, 'random');",
      "const { vi: v } = await import('vitest');\n  v.useFakeTimers();",
      "globalThis.vi.useFakeTimers();",
    ]) {
      expect(withBody(body)).toMatch(/Blocked/);
    }
  });

  it('refuses importing vi or vitest under another name, or vitest whole', () => {
    const importing = (line) =>
      decide(edit("import { undo } from './commands';", `import { undo } from './commands';\n${line}`), fix);
    expect(importing("import { vi as v } from 'vitest';")).toMatch(/Blocked/);
    expect(importing("import { expect, vitest as t } from 'vitest';")).toMatch(/Blocked/);
    expect(importing("import * as V from 'vitest';")).toMatch(/Blocked/);
    expect(importing("import V from 'vitest';")).toMatch(/Blocked/);
    expect(importing("import { describe, vi } from 'vitest';")).toBeNull(); // A plain import stays allowed.
  });

  // review-815 third round, 1: code hidden in a template's ${…}, a unicode escape, eval, Function, and an import
  // stripper that swallowed ordinary code.
  it('refuses vi hidden in a template, behind an escape, in eval or Function, or after a stray import', () => {
    const withBody = (body) =>
      decide(
        write(UNMARKED.replace("it('undoes a partial", `it('setup', () => {\n  ${body}\n});\n\nit('undoes a partial`)),
        fix,
        fileHolds(MARKED),
        inHead(MARKED),
      );
    for (const body of [
      "const s = `${vi.spyOn(Math, 'random').mockReturnValue(0)}`;",
      'const s = `a ${`b ${vi.useFakeTimers()}`} c`;',
      'v\\u0069.useFakeTimers();',
      '\\u{76}i.useFakeTimers();',
      'eval("vi.spyOn(Math, \'random\')");',
      "new Function('vi', 'vi.useFakeTimers()')(vi);",
      "(() => {}).constructor('return 1')();",
      'const a = cfg.import, b = vi, c = tag.from`x`;\n  b.useFakeTimers();',
      'const a = cfg.\nimport, b = vi, c = tag.from`x`;\n  b.useFakeTimers();',
    ]) {
      expect(withBody(body)).toMatch(/Blocked/);
    }
  });

  it('still lets a new test use a template with plain values, and a unicode escape inside a string', () => {
    const added = "\nit('n', () => {\n  const n = 2;\n  expect(`${n} gives`).toBe('2 gives\\u0021'.slice(0, 7));\n});\n";
    expect(decide(edit('});\n', '});\n' + added), fix, fileHolds(EXISTING), inHead(EXISTING))).toBeNull();
  });

  it('still lets a new test use vi.fn and the like', () => {
    const added = "\nit('n', () => {\n  const spy = vi.fn();\n  expect(spy).not.toHaveBeenCalled();\n});\n";
    expect(decide(edit('});\n', '});\n' + added), fix, fileHolds(EXISTING), inHead(EXISTING))).toBeNull();
  });

  it('refuses the only, skip and todo options on a new test, with or without .fails', () => {
    const add = (text) => decide(edit('});\n', '});\n\n' + text), fix, fileHolds(EXISTING), inHead(EXISTING));
    expect(add("it('n', { only: true }, () => {});\n")).toMatch(/Blocked/);
    expect(add("it('n', { skip: true }, () => {});\n")).toMatch(/Blocked/);
    expect(add("it('n', { 'todo': true }, () => {});\n")).toMatch(/Blocked/);
    expect(add("it.fails('n', { skip: true }, () => {});\n")).toMatch(/Blocked/);
    expect(add("it.fails('n', { only: true }, () => {});\n")).toMatch(/Blocked/);
  });

  // review-815, 3: committed means any version on the branch, so a reset or an amend can't free a committed test.
  it('counts a test committed earlier on the branch as committed, though HEAD no longer has it', () => {
    const versions = () => [EXISTING, MARKED]; // MARKED was committed, then reset away.
    const changed = edit('expect(undo(3)).toBe(2);', 'expect(undo(3)).toBe(9);');
    expect(decide(changed, fix, fileHolds(MARKED), versions)).toMatch(/Blocked/);
    expect(decide(changed, fix, fileHolds(MARKED), () => [EXISTING])).toBeNull();
  });

  // review-815, nit 4.
  it('refuses a Write to a test file that is there but cannot be read', () => {
    const unreadable = () => undefined;
    expect(decide(write(EXISTING), fix, unreadable, inHead(EXISTING))).toMatch(/Blocked/);
    expect(decide(write(MARKED), fix, unreadable, notInHead)).toMatch(/Blocked/);
  });

  it('refuses renaming a committed test', () => {
    const renamed = edit("it('undoes a give'", "it('undoes one give'");
    expect(decide(renamed, fix, fileHolds(EXISTING), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('refuses moving a committed test into a new describe block', () => {
    const moved = EXISTING.replace("it('undoes a give'", "describe('gives', () => {\nit('undoes a give'") + '});\n';
    expect(decide(write(moved), fix, fileHolds(EXISTING), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('keeps today\'s rule for a new test named by a template, or made by it.each', () => {
    const template = EXISTING + '\nit(`undoes ${2} gives`, () => {\n  expect(undo(3)).toBe(2);\n});\n';
    const changed = edit('expect(undo(3)).toBe(2);', 'expect(undo(3)).toBe(9);');
    expect(decide(changed, fix, fileHolds(template), inHead(EXISTING))).toMatch(/Blocked/);
    const each = EXISTING + "\nit.each([3])('undoes %i', (n) => {\n  expect(undo(n)).toBe(2);\n});\n";
    const eachChanged = edit('expect(undo(n)).toBe(2);', 'expect(undo(n)).toBe(9);');
    expect(decide(eachChanged, fix, fileHolds(each), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('refuses describe.only around new tests', () => {
    const block = "\ndescribe.only('partial gives', () => {\n" + NEW_TEST + '});\n';
    expect(decide(edit('});\n', '});\n' + block), fix, fileHolds(EXISTING), inHead(EXISTING))).toMatch(/Blocked/);
  });

  it('keeps today\'s rule when it cannot tell what the last commit holds', () => {
    const now = EXISTING + '\n' + NEW_TEST;
    const changed = edit('expect(undo(3)).toBe(2);', 'expect(undo(3)).toBe(9);');
    expect(decide(changed, fix, fileHolds(now))).toMatch(/Blocked/);
    expect(decide(changed, fix, fileHolds(now), () => undefined)).toMatch(/Blocked/);
    expect(decide(changed, fix, () => null, inHead(EXISTING))).toMatch(/Blocked/); // The file can't be read.
    expect(decide(changed, fix, fileHolds(now), inHead("it('unclosed', () => {"))).toMatch(/Blocked/);
  });

  it('says in its message that a test not yet committed may be changed freely', () => {
    expect(decide(edit('toBe(1)', 'toBe(2)'), fix)).toMatch(/not in a commit yet may be changed freely \(gd-1\)/);
  });
});

// review-815, 2 and 3, against real git: what the branch has committed, read so that a failure refuses.
describe('the fix-branch test guard: reading what the branch has committed (gd-1)', () => {
  const OLD = "it('old', () => {\n  expect(1).toBe(1);\n});\n";
  const BRANCH = OLD + "\nit('branch one', () => {\n  expect(2).toBe(2);\n});\n";
  let root; // A temporary folder holding the repo and an empty git config; removed after each test.
  let repo;
  // Without the GIT_* variables a pre-commit hook sets (GIT_DIR, GIT_INDEX_FILE ...), which would aim these calls at the
  // repo being committed instead of the temporary one; and without the user's own or the system's git config (hooks,
  // signing, templates), read from an empty file instead.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const git = (...args) =>
    execFileSync(
      'git',
      [
        ...['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false'],
        ...['-c', 'init.templateDir=', '-c', 'core.autocrlf=false'],
        ...args,
      ],
      {
        cwd: repo,
        encoding: 'utf8',
        env: { ...inherited, GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' },
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  const texts = (versions) => (Array.isArray(versions) ? versions.map((text) => text.replace(/\r\n/g, '\n')) : versions);
  // The guard's own git calls, here with the same isolated config (review-815 third round, nit 4).
  const isolatedGit = (args, cwd, input) =>
    runGit(args, cwd, input, {
      GIT_CONFIG_NOSYSTEM: '1',
      ...(root ? { GIT_CONFIG_GLOBAL: join(root, 'gitconfig') } : {}),
    });
  const committedHere = (path) => committedOf(path, isolatedGit);
  const cleanUp = () => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  };

  // One repo per test: main holds OLD; the fix branch committed BRANCH, then reset it away (soft) and unstaged it.
  const setUp = () => {
    root = mkdtempSync(join(tmpdir(), 'guard-tests-'));
    writeFileSync(join(root, 'gitconfig'), '');
    repo = join(root, 'repo');
    mkdirSync(repo);
    git('init', '-q', '-b', 'main');
    mkdirSync(join(repo, 'src'));
    writeFileSync(join(repo, 'src', 'ruleText.test.ts'), OLD);
    git('add', '.');
    git('commit', '-q', '-m', 'main');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '-q', '-b', 'fix-demo');
    writeFileSync(join(repo, 'src', 'ruleText.test.ts'), BRANCH);
    git('commit', '-q', '-am', 'the failing test');
    git('reset', '-q', '--soft', 'HEAD~1');
    git('reset', '-q');
  };

  it('reads every version the branch committed, even one reset away, and main\'s', () => {
    try {
      setUp();
      const versions = texts(committedHere(join(repo, 'src', 'ruleText.test.ts')));
      expect(versions).toContain(OLD);
      expect(versions).toContain(BRANCH);
      // So the reset-away test stays committed: changing its body is refused.
      const changed = edit('expect(2).toBe(2);', 'expect(2).toBe(3);', join(repo, 'src', 'ruleText.test.ts'));
      expect(decide(changed, fix, fileHolds(BRANCH), committedHere)).toMatch(/Blocked/);
    } finally {
      cleanUp();
    }
  });

  // review-815 second round, 4: a branch's reflog goes with the branch; HEAD's stays.
  it('still finds a test committed on a branch that was deleted and made again from main', () => {
    try {
      setUp();
      const committed = git('rev-parse', 'fix-demo@{1}').trim(); // The commit that held BRANCH.
      git('checkout', '-q', 'main');
      git('branch', '-q', '-D', 'fix-demo');
      git('checkout', '-q', '-b', 'fix-demo', 'refs/remotes/origin/main');
      git('checkout', committed, '--', 'src/ruleText.test.ts');
      expect(texts(committedHere(join(repo, 'src', 'ruleText.test.ts')))).toContain(BRANCH);
      const changed = edit('expect(2).toBe(2);', 'expect(2).toBe(3);', join(repo, 'src', 'ruleText.test.ts'));
      expect(decide(changed, fix, fileHolds(BRANCH), committedHere)).toMatch(/Blocked/);
    } finally {
      cleanUp();
    }
  });

  // review-815 second round, 3: the branch is read without an inherited GIT_DIR pointing elsewhere.
  it('reads the branch of the file\'s own repo even when GIT_DIR points at another', () => {
    const saved = process.env.GIT_DIR;
    try {
      setUp();
      mkdirSync(join(root, 'elsewhere'));
      process.env.GIT_DIR = join(root, 'elsewhere');
      expect(branchOf(join(repo, 'src', 'ruleText.test.ts'), isolatedGit)).toBe('fix-demo');
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
      cleanUp();
    }
  });

  it('finds the committed versions through a path spelled in another case, so its tests stay protected', () => {
    try {
      setUp();
      const wrongCase = join(repo, 'src', 'RuleText.test.ts');
      expect(texts(committedHere(wrongCase))).toContain(OLD);
      const changed = edit('expect(1).toBe(1);', 'expect(1).toBe(2);', wrongCase);
      expect(decide(changed, fix, fileHolds(BRANCH), committedHere)).toMatch(/Blocked/);
    } finally {
      cleanUp();
    }
  });

  it('says a file no commit holds is new, and cannot tell outside a repo or without origin/main', () => {
    try {
      setUp();
      expect(committedHere(join(repo, 'src', 'brandNew.test.ts'))).toEqual([]);
      git('update-ref', '-d', 'refs/remotes/origin/main');
      expect(committedHere(join(repo, 'src', 'brandNew.test.ts'))).toBeUndefined();
    } finally {
      cleanUp();
    }
    const outside = mkdtempSync(join(tmpdir(), 'guard-tests-none-'));
    try {
      expect(committedHere(join(outside, 'a.test.ts'))).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('refuses when a git lookup fails, instead of treating the file as new', () => {
    const failing = (failOn) => (args) => {
      if (args[0] === failOn) throw new Error('git failed');
      if (args.includes('--show-toplevel')) return '/repo\n';
      if (args.includes('--abbrev-ref')) return 'fix-demo\n';
      if (args[0] === 'ls-tree') return 'src/a.test.ts\n';
      if (args[0] === 'log' || args[0] === 'reflog') return '';
      return 'abc123\n';
    };
    for (const step of ['rev-parse', 'merge-base', 'reflog', 'log', 'ls-tree', 'show']) {
      expect(committedOf('/repo/src/a.test.ts', failing(step))).toBeUndefined();
    }
    const changed = edit('toBe(1)', 'toBe(2)', '/repo/src/a.test.ts');
    expect(decide(changed, fix, fileHolds(EXISTING), (path) => committedOf(path, failing('show')))).toMatch(/Blocked/);
  });
});

describe('the fix-branch test guard: other branches', () => {
  it('allows every test edit on any branch not starting with fix-, as before', () => {
    const anyEdit = edit('expect(undo(2)).toBe(1);', 'expect(undo(2)).toBe(2);');
    expect(decide(anyEdit, on('m5b-weather'))).toBeNull();
    expect(decide(edit('a', 'b', '/repo/supabase/tests/a.test.ts'), on('main'))).toBeNull();
    expect(decide(edit('a', 'b', '/repo/tests/layout/layout.spec.ts'), on('prefix-fix-later'))).toBeNull();
    expect(decide(write(EXISTING), on('bq-6-test-fails-guard'), fileHolds(MARKED))).toBeNull();
    expect(decide(anyEdit, on(null))).toBeNull();
  });
});

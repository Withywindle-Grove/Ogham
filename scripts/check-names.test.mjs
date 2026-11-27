// Tests for the real-names scan (scripts/check-names.mjs). The names here are invented.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crc32, deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withoutGitVariables } from './git-test-env.mjs';
import { addedLines, findInPullRequest, findNames, hookVerdict, looksBinary, parseDenylist } from './check-names.mjs';

describe('the real-names scan', () => {
  it('reads one name per line and skips comments and blank lines', () => {
    expect(parseDenylist('# a comment\n\nGloomwater Codex\r\n  GWC  \n# another\n')).toEqual(['Gloomwater Codex', 'GWC']);
  });

  it('finds a listed name whatever its case, and says which line it is on', () => {
    const hits = findNames('first line\nwe used the gloomwater codex here', ['Gloomwater Codex']);
    expect(hits).toEqual([{ name: 'Gloomwater Codex', line: 2 }]);
  });

  it('only counts a short form as a whole word, so ordinary words that contain it pass', () => {
    expect(findNames('the gwcs and agwc', ['GWC'])).toEqual([]);
    expect(findNames('the GWC pack', ['GWC'])).toEqual([{ name: 'GWC', line: 1 }]);
  });

  it('finds a folder-style name with hyphens, but not inside a longer word', () => {
    expect(findNames('see gwc-advanced/ for it', ['gwc-advanced'])).toHaveLength(1);
    expect(findNames('see gwc-advancedness', ['gwc-advanced'])).toEqual([]);
  });

  it('treats a curly apostrophe like a straight one', () => {
    expect(findNames('the Warden’s Ledger', ["Warden's Ledger"])).toHaveLength(1);
  });

  it('skips binary files such as pictures', () => {
    expect(looksBinary(Buffer.from([0x89, 0x50, 0x00, 0x47]))).toBe(true);
    expect(looksBinary(Buffer.from('plain text'))).toBe(false);
  });
});

describe('the real-names scan as a Claude Code hook (--hook)', () => {
  const project = resolve('/repo');
  const names = ['Gloomwater Codex'];
  const call = (filePath, toolInput) => ({ tool_name: 'Write', tool_input: { file_path: filePath, ...toolInput } });
  const script = fileURLToPath(new URL('./check-names.mjs', import.meta.url));
  const runHook = (input, denylist) =>
    spawnSync(process.execPath, [script, '--hook'], {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: { ...process.env, GRIMOIRE_DENYLIST: denylist, CLAUDE_PROJECT_DIR: project },
    });

  it('blocks a write under docs/ that holds a listed name, naming the file and line but not the name', () => {
    const message = hookVerdict(call(join(project, 'docs', 'a.md'), { content: 'one\nthe Gloomwater Codex' }), names, project);
    expect(message).toContain('docs/a.md');
    expect(message).toContain('line 2');
    expect(message).toContain('a name on the private denylist');
    expect(message.toLowerCase()).not.toContain('gloomwater');
  });

  it('checks an edit under src/, including each piece of a multi-edit', () => {
    expect(hookVerdict(call(join(project, 'src', 'x.ts'), { new_string: 'gloomwater codex' }), names, project)).toContain('src/x.ts');
    const multi = call(join(project, 'src', 'x.ts'), { edits: [{ new_string: 'fine' }, { new_string: 'Gloomwater Codex' }] });
    expect(hookVerdict(multi, names, project)).toContain("edit 2's new text");
  });

  it('checks a helper worktree copy of docs/ the same way', () => {
    const file = join(project, '.claude', 'worktrees', 'agent-1', 'docs', 'b.md');
    expect(hookVerdict(call(file, { content: 'Gloomwater Codex' }), names, project)).toContain('docs/b.md');
  });

  it('lets through clean text, paths outside docs/ and src/, and paths outside the repo', () => {
    expect(hookVerdict(call(join(project, 'docs', 'a.md'), { content: 'the Bog lurker' }), names, project)).toBeNull();
    expect(hookVerdict(call(join(project, 'scripts', 'a.mjs'), { content: 'Gloomwater Codex' }), names, project)).toBeNull();
    expect(hookVerdict(call(resolve('/elsewhere/docs/a.md'), { content: 'Gloomwater Codex' }), names, project)).toBeNull();
  });

  it('exits 2 with the message on stderr when run as a hook and the list holds the name, and 0 for clean text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'names-'));
    const list = join(dir, 'denylist.txt');
    writeFileSync(list, '# invented\nGloomwater Codex\n');
    try {
      const blocked = runHook(call(join(project, 'docs', 'a.md'), { content: 'Gloomwater Codex' }), list);
      expect(blocked.status).toBe(2);
      expect(blocked.stderr).toContain('a name on the private denylist');
      expect(blocked.stderr.toLowerCase()).not.toContain('gloomwater');
      expect(runHook(call(join(project, 'docs', 'a.md'), { content: 'clean' }), list).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 0 when the private list is missing', () => {
    const missing = join(tmpdir(), 'no-such-denylist-here.txt');
    expect(runHook(call(join(project, 'docs', 'a.md'), { content: 'Gloomwater Codex' }), missing).status).toBe(0);
  });
});

describe('the real-names scan without its private list, outside a pull request', () => {
  const script = fileURLToPath(new URL('./check-names.mjs', import.meta.url));
  const runScan = (args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: tmpdir(),
      encoding: 'utf8',
      env: withoutGitVariables(process.env, { GRIMOIRE_DENYLIST: join(tmpdir(), 'no-such-denylist-here.txt'), GITHUB_ACTIONS: '' }),
    });

  // Purpose: `npm run names:check` (--all), a scan someone runs on purpose, passes without the list but says, in a
  // framed warning, that nothing was checked, so it never looks like a clean scan (check 7, review of #138).
  it('npm run names:check warns that nothing was checked', () => {
    const result = runScan(['--all']);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('WARNING: not scanned for private names');
    expect(result.stderr).toContain('no file at GRIMOIRE_DENYLIST');
    expect(result.stderr).not.toContain('GRIMOIRE_NAMES empty');
  });

  // Purpose: the commit hooks stay quiet without the list (a cloud session never has one), and still pass.
  it('the commit hooks pass quietly', () => {
    for (const args of [[], ['--message', join(tmpdir(), 'no-such-message.txt')]]) {
      const result = runScan(args);
      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).toBe('');
    }
  });
});

describe("the real-names scan of a pull request (--pr), the GitHub check's scan", () => {
  const names = ['Gloomwater Codex', 'GWC'];
  const script = fileURLToPath(new URL('./check-names.mjs', import.meta.url));
  const diff = [
    'diff --git a/docs/a.md b/docs/a.md',
    'index 1111111..2222222 100644',
    '--- a/docs/a.md',
    '+++ b/docs/a.md',
    '@@ -3 +3,2 @@ a heading',
    '-the Gloomwater Codex was named here before',
    '+a clean line',
    '+now the GWC pack is named',
    '@@ -20,0 +22 @@',
    '+++ a line that starts with two plus signs',
    'diff --git a/old.md b/old.md',
    'deleted file mode 100644',
    '--- a/old.md',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-Gloomwater Codex',
    'diff --git a/pic.png b/pic.png',
    'Binary files a/pic.png and b/pic.png differ',
  ].join('\n');

  it('reads only the lines a diff adds, each with its file and its line number in the new file', () => {
    expect(addedLines(diff)).toEqual([
      { file: 'docs/a.md', line: 3, text: 'a clean line' },
      { file: 'docs/a.md', line: 4, text: 'now the GWC pack is named' },
      { file: 'docs/a.md', line: 22, text: '++ a line that starts with two plus signs' },
    ]);
  });

  it('finds a name in an added line, and not in a line the pull request removes or in a deleted file', () => {
    expect(findInPullRequest({ diffText: diff }, names)).toEqual([{ where: 'docs/a.md, line 4', name: 'GWC' }]);
  });

  it("finds a name in a new file's name, the title, the text, the branch's name and the commit messages", () => {
    const found = findInPullRequest(
      {
        newFiles: ['docs/gwc/notes.md', 'docs/fine.md'],
        texts: [
          { label: "the pull request's title", text: 'B6: the GWC table' },
          { label: "the pull request's text", text: 'What is built\n\nThe Gloomwater Codex table.' },
          { label: "the branch's name", text: 'b6-table' },
          { label: 'the commit messages', text: 'B6: a table\n\nfrom the gloomwater codex\n' },
        ],
      },
      names,
    );
    expect(found.map((hit) => hit.where)).toEqual([
      "a new file's name (new file 1 of 2)",
      "the pull request's title",
      "the pull request's text, line 3",
      'the commit messages, line 3',
    ]);
  });

  it('never spells out a path that itself holds a name, and reads a name in a UTF-16 file', () => {
    const inNamedFile = ['diff --git a/docs/gwc/notes.md b/docs/gwc/notes.md', '--- /dev/null', '+++ b/docs/gwc/notes.md', '@@ -0,0 +1 @@', '+the Gloomwater Codex'].join('\n');
    const where = findInPullRequest({ diffText: inNamedFile }, names).map((hit) => hit.where);
    expect(where).toEqual(['a file whose own name holds a private name, line 1']);
    const utf16 = ['diff --git a/a.txt b/a.txt', '--- /dev/null', '+++ b/a.txt', '@@ -0,0 +1 @@', `+${[...'the GWC pack'].join('\0')}\0`].join('\n');
    expect(findInPullRequest({ diffText: utf16 }, names)).toEqual([{ where: 'a.txt, line 1', name: 'GWC' }]);
  });

  it("finds a name in one commit's own diff, and says which commit", () => {
    const commitDiff = ['diff --git a/a.md b/a.md', '--- a/a.md', '+++ b/a.md', '@@ -1,0 +2 @@', '+the GWC pack'].join('\n');
    expect(findInPullRequest({ commits: [{ sha: 'abc1234def', diffText: commitDiff }] }, names)).toEqual([
      { where: 'commit abc1234: a.md, line 2', name: 'GWC' },
    ]);
  });

  /** A throwaway repository: a base commit, then a pull request's commit that adds the given files. */
  function repoWith(files, message = 'B6: a clean message') {
    const dir = mkdtempSync(join(tmpdir(), 'names-pr-'));
    const run = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', env: withoutGitVariables() });
    run('init', '-q', '-b', 'main');
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs', 'old.md'), 'The Gloomwater Codex was here before the pull request.\n');
    run('add', '.');
    run('commit', '-q', '-m', 'base');
    run('checkout', '-q', '-b', 'b6-table');
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    run('add', '.');
    run('commit', '-q', '-m', message);
    return dir;
  }
  /** One more commit on that pull request: the given files written (or, for null, deleted). */
  function commitMore(dir, files, message = 'B6: more') {
    const run = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', env: withoutGitVariables() });
    for (const [name, text] of Object.entries(files)) {
      if (text === null) rmSync(join(dir, name));
      else writeFileSync(join(dir, name), text);
    }
    run('add', '-A');
    run('commit', '-q', '-m', message);
  }
  const scan = (dir, env = {}, args = []) =>
    spawnSync(process.execPath, [script, '--pr', 'main', 'HEAD', ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: withoutGitVariables(process.env, { GRIMOIRE_DENYLIST: join(dir, 'no-list.txt'), GRIMOIRE_NAMES: '', GRIMOIRE_NAMES_REQUIRED: '', GITHUB_ACTIONS: '', PR_TITLE: '', PR_BODY: '', PR_BRANCH: '', ...env }),
    });
  const list = '# invented\nGloomwater Codex\nGWC\n';

  // Purpose: a throwaway repository built inside a git hook (where git exports GIT_DIR and GIT_INDEX_FILE) is built in
  // its own folder, and the repository those variables point at keeps its config, refs, worktree and index exactly.
  // On 24 Nov this helper, run by the pre-commit hook in a linked worktree, committed "base" to a real branch, switched
  // that worktree to b6-table, and its `git init` set core.bare = true in the real repository's shared config.
  it("builds its throwaway repository in its own folder even when git's hook variables point at another one", () => {
    const outer = mkdtempSync(join(tmpdir(), 'names-outside-'));
    const main = join(outer, 'main');
    const worktree = join(outer, 'wt');
    mkdirSync(main);
    const plain = withoutGitVariables(process.env, { GIT_CONFIG_NOSYSTEM: '1' });
    const at = (cwd) => (...args) =>
      execFileSync('git', ['-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', env: plain });
    at(main)('init', '-q', '-b', 'trunk');
    at(main)('config', 'user.name', 'Outer');
    writeFileSync(join(main, 'keep.md'), 'untouched\n');
    at(main)('add', '.');
    at(main)('commit', '-q', '-m', 'outside');
    at(main)('worktree', 'add', '-q', '-b', 'side', worktree);
    const snapshot = () =>
      [
        at(main)('config', '--local', '--list'),
        at(main)('for-each-ref', '--format=%(refname) %(objectname)'),
        at(main)('symbolic-ref', 'HEAD'),
        at(worktree)('symbolic-ref', 'HEAD'),
        at(main)('ls-files', '--stage'),
        at(worktree)('ls-files', '--stage'),
      ].join('\n');
    const before = snapshot();
    expect(before).toContain('core.bare=false');
    expect(before).toContain('user.name=Outer');
    // As the pre-commit hook in that worktree would have them.
    const gitDir = at(worktree)('rev-parse', '--absolute-git-dir').trim();
    const saved = { GIT_DIR: process.env.GIT_DIR, GIT_INDEX_FILE: process.env.GIT_INDEX_FILE };
    process.env.GIT_DIR = gitDir;
    process.env.GIT_INDEX_FILE = join(gitDir, 'index');
    let dir;
    try {
      dir = repoWith({ 'docs/new.md': 'clean\n' });
    } catch {
      // A helper that followed the variables may also fail part-way; the comparison below says what it touched.
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    try {
      expect(snapshot()).toBe(before);
      const own = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: plain }).trim();
      expect(own('rev-parse', '--abbrev-ref', 'HEAD')).toBe('b6-table');
      expect(own('log', '--format=%s')).toBe('B6: a clean message\nbase');
    } finally {
      rmSync(outer, { recursive: true, force: true });
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails on a name the pull request adds, saying the file and line but never the name', () => {
    const dir = repoWith({ 'docs/new.md': 'one\ntwo\nthe Gloomwater Codex\n' });
    try {
      const result = scan(dir, { GRIMOIRE_NAMES: list });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('A private name was found in docs/new.md, line 3.');
      expect((result.stdout + result.stderr).toLowerCase()).not.toContain('gloomwater');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes a clean pull request even though an older file on the base branch holds a name', () => {
    const dir = repoWith({ 'docs/new.md': 'the Bog lurker\n' });
    try {
      const result = scan(dir, { GRIMOIRE_NAMES: list });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('No private name in what this pull request adds (1 added lines, 1 new files, 1 commits');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails on a name in a commit message or in the pull request's title", () => {
    const dir = repoWith({ 'docs/new.md': 'clean\n' }, 'B6: from the GWC');
    try {
      expect(scan(dir, { GRIMOIRE_NAMES: list }).stderr).toContain('A private name was found in the commit messages, line 1.');
      const messages = join(dir, 'messages.txt');
      writeFileSync(messages, 'B6: a clean message\n');
      const titled = scan(dir, { GRIMOIRE_NAMES: list, PR_TITLE: 'B6: the Gloomwater Codex table' }, ['--messages', messages]);
      expect(titled.status).toBe(1);
      expect(titled.stderr).toContain("A private name was found in the pull request's title.");
      expect(titled.stderr).not.toContain('the commit messages');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails on a name that one commit adds and a later commit takes out again: it is still public', () => {
    const dir = repoWith({ 'docs/new.md': 'one\nthe Gloomwater Codex\n' });
    try {
      commitMore(dir, { 'docs/new.md': 'one\nthe Bog lurker\n' });
      const result = scan(dir, { GRIMOIRE_NAMES: list });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/A private name was found in commit [0-9a-f]{7}: docs\/new\.md, line 2\./);
      expect(result.stderr).not.toContain('found in docs/new.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails on a name in a file the pull request itself marks as not for diffing, and in a file with a NUL byte', () => {
    const dir = repoWith({ '.gitattributes': '*.md -diff\n', 'docs/new.md': 'the Gloomwater Codex\n', 'docs/odd.txt': 'a\0b\nthe GWC pack\n' });
    try {
      const result = scan(dir, { GRIMOIRE_NAMES: list });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('A private name was found in docs/new.md, line 1.');
      expect(result.stderr).toContain('A private name was found in docs/odd.txt, line 2.');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // A picture's compressed pixel bytes can spell a short name by chance (PR #64): the scan skips them.
  it("passes a picture whose pixel bytes happen to spell a name, in the end result and in each commit", () => {
    const chunk = (type, data) => {
      const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
      const out = Buffer.alloc(12 + data.length);
      out.writeUInt32BE(data.length, 0);
      body.copy(out, 4);
      out.writeUInt32BE(crc32(body), 8 + data.length);
      return out;
    };
    const png = (pixels) =>
      Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk('IDAT', Buffer.from(pixels, 'latin1')), chunk('IEND', Buffer.alloc(0))]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x07]), Buffer.from('quiet'), Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.from('\x01 GWC \x02', 'latin1'), Buffer.from([0xff, 0xd9])]);
    const dir = repoWith({ 'docs/pic.png': png('\x01 GWC \x02'), 'docs/photo.jpg': jpeg });
    try {
      commitMore(dir, { 'docs/pic.png': png('\x03\nthe Gloomwater Codex\n\x04') });
      const result = scan(dir, { GRIMOIRE_NAMES: list });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Skipping the pixels must not skip the words a picture carries, nor a text file that is only named like a picture.
  it("still finds a name in a picture's text (a PNG's tEXt, zTXt and iTXt, a JPEG's comment) and in a text file named .png", () => {
    const chunk = (type, data) => {
      const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
      const out = Buffer.alloc(12 + data.length);
      out.writeUInt32BE(data.length, 0);
      body.copy(out, 4);
      out.writeUInt32BE(crc32(body), 8 + data.length);
      return out;
    };
    const png = (textChunk) =>
      Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), textChunk, chunk('IDAT', Buffer.from('clean')), chunk('IEND', Buffer.alloc(0))]);
    const tEXt = chunk('tEXt', Buffer.from('Comment\0the Gloomwater Codex', 'latin1'));
    const zTXt = chunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0', 'latin1'), deflateSync(Buffer.from('the Gloomwater Codex'))]));
    const iTXt = chunk('iTXt', Buffer.concat([Buffer.from('Comment\0\x01\0en\0\0', 'latin1'), deflateSync(Buffer.from('the GWC pack'))]));
    const comment = Buffer.from('the GWC pack');
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, comment.length + 2]), comment, Buffer.from([0xff, 0xda, 0x00, 0x02, 0x10, 0xff, 0xd9])]);
    const dir = repoWith({ 'docs/a.png': png(tEXt), 'docs/b.png': png(zTXt), 'docs/c.png': png(iTXt), 'docs/photo.jpg': jpeg, 'docs/fake.png': 'one\nthe GWC pack\n' });
    try {
      const result = scan(dir, { GRIMOIRE_NAMES: list });
      expect(result.status).toBe(1);
      for (const file of ['docs/a.png', 'docs/b.png', 'docs/c.png', 'docs/photo.jpg']) {
        expect(result.stderr).toContain(`A private name was found in ${file} (the text it carries).`);
        expect(result.stderr).toMatch(new RegExp(`A private name was found in commit [0-9a-f]{7}: ${file.replace('.', '\\.')} \\(the text it carries\\)\\.`));
      }
      expect(result.stderr).toContain('A private name was found in docs/fake.png, line 2.');
      expect(result.stderr.toLowerCase()).not.toContain('gloomwater');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails without showing anything it read when a git command fails or the commit list is unreadable', () => {
    const dir = repoWith({ 'docs/new.md': 'the Gloomwater Codex\n' });
    try {
      const commits = join(dir, 'commits.txt');
      writeFileSync(commits, '0000000000000000000000000000000000000000\n');
      const missing = scan(dir, { GRIMOIRE_NAMES: list }, ['--commits', commits]);
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain('The private-names scan could not finish');
      writeFileSync(commits, '--output=/tmp/x\n');
      const odd = scan(dir, { GRIMOIRE_NAMES: list }, ['--commits', commits]);
      expect(odd.status).toBe(1);
      expect(odd.stderr).toContain('a commit list it cannot read');
      for (const result of [missing, odd]) expect((result.stdout + result.stderr).toLowerCase()).not.toContain('gloomwater');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shows the name only when asked with --show, for a run on your own machine', () => {
    const dir = repoWith({ 'docs/new.md': 'the GWC pack\n' });
    try {
      expect(scan(dir, { GRIMOIRE_NAMES: list }, ['--show']).stderr).toContain('docs/new.md, line 1: "GWC"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Check 7 (docs/specs/hard-rule-and-size-checks.md): a scan without its list says so where a person will see it.
  // Purpose: with the list, the scan runs as before and prints no warning about a missing list.
  it('scans as before, with no warning, when the list is there', () => {
    const dir = repoWith({ 'docs/new.md': 'a clean line\n' });
    try {
      const result = scan(dir, { GRIMOIRE_NAMES: list, GITHUB_ACTIONS: 'true' });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('No private name in what this pull request adds');
      expect(result.stdout + result.stderr).not.toContain('WARNING');
      expect(result.stdout).not.toContain('::warning');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Purpose: run by hand without the list, the scan passes but prints a warning that stands out from the lines around it.
  it('passes without the list on your own machine, with a warning that stands out', () => {
    const dir = repoWith({ 'docs/new.md': 'the Gloomwater Codex\n' });
    try {
      const result = scan(dir);
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('WARNING: not scanned for private names');
      expect(result.stderr).toContain('Before merging a pull request from outside, scan it where the private list is: node scripts/check-names.mjs --pr origin/main --show');
      // On your own machine the cause is a missing file, so it says where it looked (a path, never a name), not secrets.
      expect(result.stderr).toContain(`no file at GRIMOIRE_DENYLIST (${join(dir, 'no-list.txt')})`);
      expect(result.stderr).not.toContain('Dependabot');
      // Not a GitHub annotation: that only means something on GitHub.
      expect(result.stdout + result.stderr).not.toContain('::warning');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Purpose: on GitHub without the list and without the required flag (a fork, Dependabot), the scan passes and puts a
  // warning on the run's summary page (a ::warning annotation), so whoever merges sees it was not scanned.
  it("passes without the list on a Dependabot or fork pull request, with a warning on the run's summary page", () => {
    const dir = repoWith({ 'docs/new.md': 'the Gloomwater Codex\n' });
    try {
      const result = scan(dir, { GITHUB_ACTIONS: 'true', GRIMOIRE_NAMES_REQUIRED: 'false' });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/^::warning title=Not scanned for private names::.*Dependabot.*scan it where the private list is: node scripts\/check-names\.mjs --pr origin\/main --show$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Purpose: on our own pull requests the list is required, so a missing one still fails the scan, as before.
  it('fails without the list when the list is required', () => {
    const dir = repoWith({ 'docs/new.md': 'the Gloomwater Codex\n' });
    try {
      const required = scan(dir, { GRIMOIRE_NAMES_REQUIRED: 'true', GITHUB_ACTIONS: 'true' });
      expect(required.status).toBe(1);
      expect(required.stderr).toContain('PRIVATE_NAMES is missing or empty');
      expect(required.stdout).not.toContain('::warning');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the GitHub check scans every pull request before anything else, and our own pull requests must have the list", () => {
    const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/check.yml', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
    const changes = workflow.slice(workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  check:\n'));
    const step = changes.slice(changes.indexOf('- name: Private-names scan'), changes.indexOf('- id: what'));
    // In the changes job, before the step that decides what runs: a hit fails check, database and layout with it.
    expect(step.length).toBeGreaterThan(0);
    expect(step).toContain("if: github.event_name == 'pull_request'");
    // The list is the secret; it is required unless the pull request comes from a fork or from Dependabot.
    expect(step).toContain('GRIMOIRE_NAMES: ${{ secrets.PRIVATE_NAMES }}');
    expect(step).toContain(
      "GRIMOIRE_NAMES_REQUIRED: ${{ github.event.pull_request.head.repo.full_name == github.repository && github.actor != 'dependabot[bot]' }}",
    );
    // The pull request's own words reach the script through the environment, never pasted into the command.
    expect(step).toContain('PR_TITLE: ${{ github.event.pull_request.title }}');
    expect(step).toContain('PR_BODY: ${{ github.event.pull_request.body }}');
    expect(step).toContain('PR_BRANCH: ${{ github.event.pull_request.head.ref }}');
    expect(step.slice(step.indexOf('run: |'))).not.toContain('${{');
    // Each of the pull request's commits is fetched and scanned too; past the 250 GitHub lists, the step fails.
    expect(step).toContain('if [ "$PR_COMMITS" -gt 250 ]; then');
    expect(step).toContain('git fetch --no-tags --quiet --depth="$((PR_COMMITS + 1))" origin "+refs/pull/$PR_NUMBER/head"');
    expect(step).toContain(
      'node scripts/check-names.mjs --pr HEAD^1 HEAD --messages "$RUNNER_TEMP/pr-commit-messages.txt" --commits "$RUNNER_TEMP/pr-commits.txt"',
    );
    expect(changes).toMatch(/\n {6}pull-requests: read\n/);
  });
});

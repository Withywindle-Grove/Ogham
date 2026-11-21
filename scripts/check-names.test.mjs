// Tests for the real-names scan (scripts/check-names.mjs). The names here are invented.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
      'docs/gwc/notes.md (its name)',
      "the pull request's title",
      "the pull request's text, line 3",
      'the commit messages, line 3',
    ]);
  });

  /** A throwaway repository: a base commit, then a pull request's commit that adds the given files. */
  function repoWith(files, message = 'B6: a clean message') {
    const dir = mkdtempSync(join(tmpdir(), 'names-pr-'));
    const run = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
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
  const scan = (dir, env = {}, args = []) =>
    spawnSync(process.execPath, [script, '--pr', 'main', 'HEAD', ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GRIMOIRE_DENYLIST: join(dir, 'no-list.txt'), GRIMOIRE_NAMES: '', GRIMOIRE_NAMES_REQUIRED: '', PR_TITLE: '', PR_BODY: '', PR_BRANCH: '', ...env },
    });
  const list = '# invented\nGloomwater Codex\nGWC\n';

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
      expect(result.stdout).toContain('No private name in what this pull request adds (1 added lines, 1 new files');
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

  it('shows the name only when asked with --show, for a run on your own machine', () => {
    const dir = repoWith({ 'docs/new.md': 'the GWC pack\n' });
    try {
      expect(scan(dir, { GRIMOIRE_NAMES: list }, ['--show']).stderr).toContain('docs/new.md, line 1: "GWC"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes with a note when there is no list (a fork, Dependabot), and fails when the list is required', () => {
    const dir = repoWith({ 'docs/new.md': 'the Gloomwater Codex\n' });
    try {
      const unscanned = scan(dir);
      expect(unscanned.status).toBe(0);
      expect(unscanned.stdout).toContain('Not scanned for private names');
      const required = scan(dir, { GRIMOIRE_NAMES_REQUIRED: 'true' });
      expect(required.status).toBe(1);
      expect(required.stderr).toContain('PRIVATE_NAMES is missing or empty');
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
    expect(step).toContain('node scripts/check-names.mjs --pr HEAD^1 HEAD --messages "$RUNNER_TEMP/pr-commit-messages.txt"');
    expect(changes).toMatch(/\n {6}pull-requests: read\n/);
  });
});

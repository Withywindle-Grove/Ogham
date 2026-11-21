// Tests for the real-names scan (scripts/check-names.mjs). The names here are invented.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findNames, hookVerdict, looksBinary, parseDenylist } from './check-names.mjs';

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

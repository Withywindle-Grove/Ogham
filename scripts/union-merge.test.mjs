// Tests for the union merge of the decisions log (.gitattributes: docs/09-decisions-log.md merge=union).
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { withoutGitVariables } from './git-test-env.mjs';

const attributes = fileURLToPath(new URL('../.gitattributes', import.meta.url));
const env = withoutGitVariables(process.env, {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
});
let root;
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

describe('the decisions log merges by union', () => {
  // Two branches that each append a line at the end of 09 merge with no conflict, and the log keeps both lines.
  it('keeps both lines appended at the end on two branches, with no conflict', () => {
    root = mkdtempSync(join(tmpdir(), 'union-merge-'));
    const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' });
    const log = join(root, 'docs', '09-decisions-log.md');
    const append = (line) => writeFileSync(log, readFileSync(log, 'utf8') + line + '\n');
    git('init', '-q', '-b', 'main');
    mkdirSync(join(root, 'docs'));
    copyFileSync(attributes, join(root, '.gitattributes'));
    writeFileSync(log, '# Decisions log\n\n- 2026-11-01 [process] An older line.\n');
    git('add', '.');
    git('commit', '-qm', 'start');
    git('checkout', '-qb', 'left');
    append('- 2026-11-27 [process] A line from the left branch.');
    git('commit', '-qam', 'left');
    git('checkout', '-q', 'main');
    git('checkout', '-qb', 'right');
    append('- 2026-11-27 [process] A line from the right branch.');
    git('commit', '-qam', 'right');
    const merge = spawnSync('git', ['merge', '-q', '--no-edit', 'left'], { cwd: root, env, encoding: 'utf8' });
    expect(merge.status).toBe(0);
    const merged = readFileSync(log, 'utf8');
    expect(merged).toContain('A line from the left branch.');
    expect(merged).toContain('A line from the right branch.');
    expect(merged).not.toContain('<<<<<<<');
  });
});

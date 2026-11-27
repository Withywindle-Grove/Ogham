// Tests for npm run hooks:install (scripts/hooks-install.mjs) in a clone with a linked worktree, as in the cloud.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { withoutGitVariables } from './git-test-env.mjs';

const script = fileURLToPath(new URL('./hooks-install.mjs', import.meta.url));
const env = withoutGitVariables(process.env, {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
});
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
const gitOrEmpty = (cwd, ...args) => {
  try {
    return git(cwd, ...args);
  } catch {
    return '';
  }
};

let root;
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

/** A clone (main) with a hook that writes a marker file, and a linked worktree (wt) beside it. */
function cloneWithWorktree() {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-install-')));
  const main = join(root, 'main');
  mkdirSync(join(main, '.githooks'), { recursive: true });
  git(main, 'init', '-q');
  writeFileSync(join(main, '.githooks', 'pre-commit'), '#!/bin/sh\ntouch "$PWD/hook-ran"\n');
  chmodSync(join(main, '.githooks', 'pre-commit'), 0o755);
  git(main, 'add', '.');
  git(main, 'commit', '-qm', 'start');
  const wt = join(root, 'wt');
  git(main, 'worktree', 'add', '-q', '-b', 'side', wt);
  return { main, wt };
}

describe('npm run hooks:install', () => {
  // In a linked worktree, it turns the hooks on there by an absolute path to that worktree's own .githooks.
  it('turns the hooks on in a linked worktree, by an absolute path to its .githooks', () => {
    const { wt } = cloneWithWorktree();
    execFileSync('node', [script], { cwd: wt, env });
    expect(git(wt, 'config', '--get', 'core.hooksPath')).toBe(join(wt, '.githooks').replaceAll('\\', '/'));
    writeFileSync(join(wt, 'note.txt'), 'x');
    git(wt, 'add', 'note.txt');
    git(wt, 'commit', '-qm', 'note');
    expect(gitOrEmpty(wt, 'ls-files', '--others', 'hook-ran')).toBe('hook-ran');
  });

  // It leaves every other worktree of the clone as it was: the main checkout still has no hooks path.
  it('leaves the other worktrees of the clone untouched', () => {
    const { main, wt } = cloneWithWorktree();
    execFileSync('node', [script], { cwd: wt, env });
    expect(gitOrEmpty(main, 'config', '--get', 'core.hooksPath')).toBe('');
  });
});

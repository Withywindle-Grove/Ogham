// Tests for the check slot (scripts/check-slot.sh): it refuses a commit that would run no check, lets a docs-only
// commit through without its lock, and removes a node_modules/node_modules link before it runs. Bash and symlinks: skipped on Windows (CI runs them on Linux).
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { withoutGitVariables } from './git-test-env.mjs';

const slot = fileURLToPath(new URL('./check-slot.sh', import.meta.url));
const hasFlock = spawnSync('flock', ['--version']).status === 0;
let root;
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

/** A throwaway repository, with its own lock and log folder for the slot. */
function setUp() {
  root = mkdtempSync(join(tmpdir(), 'check-slot-'));
  const repo = join(root, 'repo');
  const locks = join(root, 'locks');
  mkdirSync(repo);
  mkdirSync(locks);
  const env = withoutGitVariables(process.env, {
    OGHAM_CHECK_TMP: locks,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  });
  execFileSync('git', ['init', '-q'], { cwd: repo, env });
  const run = (...args) => spawnSync('bash', [slot, ...args], { cwd: repo, env, encoding: 'utf8' });
  const log = () => (existsSync(join(locks, 'ogham-check-times.log')) ? readFileSync(join(locks, 'ogham-check-times.log'), 'utf8') : '');
  return { repo, env, run, log };
}

describe.skipIf(process.platform === 'win32')('the check slot', () => {
  // With no hooks path, a commit through the slot is refused, with the rule and the command that turns them on.
  it('refuses a commit when the hooks are off, naming the rule and npm run hooks:install', () => {
    const { repo, env, run } = setUp();
    writeFileSync(join(repo, 'a.txt'), 'a');
    execFileSync('git', ['add', 'a.txt'], { cwd: repo, env });
    const result = run('git', 'commit', '-qm', 'a');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('npm run check passes before every commit');
    expect(result.stdout).toContain('npm run hooks:install');
    expect(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, env }).status).not.toBe(0);
  });

  // A hooks path that holds no pre-commit counts as off too.
  it('refuses a commit when the hooks path has no pre-commit', () => {
    const { repo, env, run } = setUp();
    mkdirSync(join(repo, 'hooks'));
    execFileSync('git', ['config', 'core.hooksPath', join(repo, 'hooks')], { cwd: repo, env });
    expect(run('git', 'commit', '--allow-empty', '-qm', 'a').status).toBe(1);
  });

  // With a pre-commit reachable through the hooks path, the commit runs, and its hook with it.
  it('lets the commit through when a pre-commit hook is on', () => {
    const { repo, env, run } = setUp();
    mkdirSync(join(repo, 'hooks'));
    writeFileSync(join(repo, 'hooks', 'pre-commit'), '#!/bin/sh\ntouch hook-ran\n');
    chmodSync(join(repo, 'hooks', 'pre-commit'), 0o755);
    execFileSync('git', ['config', 'core.hooksPath', join(repo, 'hooks')], { cwd: repo, env });
    const result = run('git', 'commit', '--allow-empty', '-qm', 'a');
    expect(result.status).toBe(0);
    expect(existsSync(join(repo, 'hook-ran'))).toBe(true);
  });

  /** Hooks on, with a pre-commit that writes "free" or "held": whether the slot's lock was held while it ran. */
  function withLockProbe() {
    const ctx = setUp();
    const lock = join(root, 'locks', 'ogham-check.lock');
    mkdirSync(join(ctx.repo, 'hooks'));
    writeFileSync(
      join(ctx.repo, 'hooks', 'pre-commit'),
      `#!/bin/sh\nif flock -n "${lock}" true; then echo free >"${join(root, 'probe')}"; else echo held >"${join(root, 'probe')}"; fi\n`,
    );
    chmodSync(join(ctx.repo, 'hooks', 'pre-commit'), 0o755);
    execFileSync('git', ['config', 'core.hooksPath', join(ctx.repo, 'hooks')], { cwd: ctx.repo, env: ctx.env });
    const stage = (path, text) => {
      mkdirSync(join(ctx.repo, path, '..'), { recursive: true });
      writeFileSync(join(ctx.repo, path), text);
      execFileSync('git', ['add', path], { cwd: ctx.repo, env: ctx.env });
    };
    const probe = () => readFileSync(join(root, 'probe'), 'utf8').trim();
    return { ...ctx, stage, probe };
  }

  // A commit that stages only docs and mockups goes through without taking the slot's lock, logged as docs-only.
  it.skipIf(!hasFlock)('lets a docs-only commit through without the lock', () => {
    const { run, stage, probe, log } = withLockProbe();
    stage('docs/notes.md', 'a');
    stage('docs/design/mockups/december/screen.png', 'png');
    expect(run('git', 'commit', '-qm', 'docs').status).toBe(0);
    expect(probe()).toBe('free');
    expect(log()).toContain('start docs-only');
    expect(log()).not.toContain('start ogham-check.lock');
  });

  // A commit that stages docs and code together takes the lock, so its hook's full check waits its turn.
  it.skipIf(!hasFlock)('takes the lock for a commit that stages docs and code', () => {
    const { run, stage, probe, log } = withLockProbe();
    stage('docs/notes.md', 'a');
    stage('src/thing.ts', 'export {};');
    expect(run('git', 'commit', '-qm', 'mixed').status).toBe(0);
    expect(probe()).toBe('held');
    expect(log()).toContain('start ogham-check.lock');
    expect(log()).not.toContain('start docs-only');
  });

  // Docs staged but a tracked code file changed in the folder: `git commit -a` would commit it, so the lock is taken.
  it.skipIf(!hasFlock)('takes the lock when a tracked code file has changes not staged', () => {
    const { repo, env, run, stage, probe } = withLockProbe();
    stage('src/thing.ts', 'export {};');
    expect(run('git', 'commit', '-qm', 'code').status).toBe(0);
    writeFileSync(join(repo, 'src', 'thing.ts'), 'export const a = 1;');
    stage('docs/notes.md', 'a');
    expect(run('git', 'commit', '-aqm', 'all').status).toBe(0);
    expect(probe()).toBe('held');
    expect(execFileSync('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: repo, env, encoding: 'utf8' })).toContain('src/thing.ts');
  });

  // Any command other than a commit (a full check, say) runs whether the hooks are on or not.
  it('runs other commands with the hooks off', () => {
    const { run } = setUp();
    expect(run('true').status).toBe(0);
  });

  // A node_modules/node_modules symlink is removed before the run, and one line in the log says so.
  it('removes a node_modules/node_modules link and logs it', () => {
    const { repo, run, log } = setUp();
    mkdirSync(join(repo, 'node_modules'));
    symlinkSync(join(repo, 'node_modules'), join(repo, 'node_modules', 'node_modules'));
    expect(run('true').status).toBe(0);
    expect(existsSync(join(repo, 'node_modules', 'node_modules'))).toBe(false);
    expect(existsSync(join(repo, 'node_modules'))).toBe(true);
    expect(log().match(/removed link node_modules\/node_modules/g)).toHaveLength(1);
  });

  // A real folder of that name is left alone: only a symlink is ever removed.
  it('leaves a real node_modules/node_modules folder alone', () => {
    const { repo, run, log } = setUp();
    mkdirSync(join(repo, 'node_modules', 'node_modules'), { recursive: true });
    writeFileSync(join(repo, 'node_modules', 'node_modules', 'keep.txt'), 'k');
    expect(run('true').status).toBe(0);
    expect(lstatSync(join(repo, 'node_modules', 'node_modules')).isDirectory()).toBe(true);
    expect(existsSync(join(repo, 'node_modules', 'node_modules', 'keep.txt'))).toBe(true);
    expect(log()).not.toContain('removed link');
  });
});

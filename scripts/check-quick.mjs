// The quick check (npm run check:quick): a few minutes' run a builder makes before queueing for the full check.
// In order, stopping at the first failure: the type check; eslint on the files changed against origin/main
// (committed, staged, unstaged and new); `vitest related` on the changed source and test files, on one worker and
// within a time budget (OGHAM_QUICK_TEST_SECS, default 150): a change to a widely used file can pull in hundreds of
// test files, and those are left to the full check. It runs outside the check slot, so it can run while a full check
// holds it (docs/testing.md, "The quick check"; docs/09-decisions-log.md, [process], 27 Nov). It is not the full
// check: commit through the hook.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LINTED = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TESTED = /\.(ts|tsx|js|jsx|mjs)$/;
const TESTED_DIRS = /^(src|scripts)\//;
const WINDOWS = process.platform === 'win32';

/** The paths changed against `base`, from the lists git gives (one path per line), each once, sorted. */
export function changedPaths(lists) {
  const all = lists.flatMap((list) => list.split('\n').map((line) => line.trim()).filter(Boolean));
  return [...new Set(all)].sort();
}

/** Which changed paths eslint and `vitest related` each get. Deleted files are left out by `exists`. */
export function pickFiles(paths, exists = existsSync) {
  const present = paths.filter((path) => exists(path));
  return {
    lint: present.filter((path) => LINTED.test(path)),
    related: present.filter((path) => TESTED.test(path) && TESTED_DIRS.test(path)),
  };
}

/** The tests' time budget in seconds: OGHAM_QUICK_TEST_SECS when it is a whole number above 0, else 150. */
export function testBudget(value) {
  const secs = Number(value);
  return Number.isInteger(secs) && secs > 0 ? secs : 150;
}

function gitLines(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function step(name, command, args) {
  console.log(`\ncheck:quick: ${name}`);
  return spawnSync(command, args, { stdio: 'inherit', shell: WINDOWS }).status === 0;
}

/** Runs a command for at most `secs`; resolves 'passed', 'failed' or 'stopped' (the budget ran out). */
function timedStep(name, command, args, secs) {
  console.log(`\ncheck:quick: ${name} (at most ${secs} s)`);
  return new Promise((resolve) => {
    // Its own process group, so a stop ends the test workers too, not only npx.
    const child = spawn(command, args, { stdio: 'inherit', shell: WINDOWS, detached: !WINDOWS });
    let stopped = false;
    const stop = () => {
      if (WINDOWS) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else process.kill(-child.pid, 'SIGTERM');
    };
    const timer = setTimeout(() => {
      stopped = true;
      stop();
    }, secs * 1000);
    // Ctrl+C reaches only this process now: pass it on to the tests' group.
    const interrupt = () => {
      stop();
      process.exit(130);
    };
    process.once('SIGINT', interrupt);
    child.on('exit', (code) => {
      clearTimeout(timer);
      process.off('SIGINT', interrupt);
      resolve(stopped ? 'stopped' : code === 0 ? 'passed' : 'failed');
    });
  });
}

async function main() {
  const started = Date.now();
  const base = process.env.OGHAM_QUICK_BASE ?? 'origin/main';
  const paths = changedPaths([
    gitLines(['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`]),
    gitLines(['diff', '--name-only', '--diff-filter=d', '--cached']),
    gitLines(['diff', '--name-only', '--diff-filter=d']),
    gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  const { lint, related } = pickFiles(paths);
  const secs = () => Math.round((Date.now() - started) / 1000);
  const fail = (name) => {
    console.log(`\ncheck:quick: FAILED at ${name} after ${secs()} s. Fix what it names above, then run it again.`);
    process.exit(1);
  };

  if (!step('type check (tsc --noEmit)', 'npx', ['tsc', '--noEmit'])) fail('the type check');
  if (lint.length === 0) console.log('\ncheck:quick: lint: no changed file to lint');
  else if (!step(`lint (${lint.length} changed files)`, 'npx', ['eslint', '--no-warn-ignored', ...lint])) fail('lint');
  let tests = 'passed';
  if (related.length === 0) console.log('\ncheck:quick: tests: no changed source or test file');
  else {
    const budget = testBudget(process.env.OGHAM_QUICK_TEST_SECS);
    const args = ['vitest', 'related', '--run', '--maxWorkers=1', '--passWithNoTests', ...related];
    tests = await timedStep(`tests related to ${related.length} changed files`, 'npx', args, budget);
    if (tests === 'failed') fail('the tests');
  }
  const done = `types, lint on ${lint.length} files, tests related to ${related.length} files`;
  if (tests === 'stopped')
    console.log(
      `\ncheck:quick: passed in part in ${secs()} s (${done}): the related tests ran past their budget and were stopped; the full check runs them.`,
    );
  else console.log(`\ncheck:quick: passed in ${secs()} s (${done}). Not the full check: commit through the hook.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

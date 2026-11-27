// The slow-test report (check 9, cs-34; spec `docs/specs/hard-rule-and-size-checks.md`). It only reports: it never fails.
// Two halves, one file:
// - The default export is a Vitest reporter (vite.config.ts, `reporters`, after Vitest's own). When a test run starts
//   it deletes the last run's timings; when the run ends it saves each unit test's file, name and time, with the
//   time it saved them, to TIMINGS_FILE. It prints nothing.
// - Run as a script (`node scripts/slow-tests.mjs`, the last step of `npm run check`, after the build), it prints the
//   summary: the count of unit tests over 300 ms and the slowest 20, each with its time, and when those timings were
//   saved. `--all` lists every slow test. It always exits 0.
// The summary is printed after the build, not by the reporter, so it is the last thing the check shows. It is short
// (the slowest 20, not all of them) so it gets read (docs/09-decisions-log.md, [process], 27 Nov).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** cs-34: a unit test slower than this is reported (also the runner's `slowTestThreshold`, vite.config.ts). */
export const SLOW_TEST_MS = 300;
/** How many slow tests the short summary lists; `--all` lists them all. */
export const SHOWN_SLOW_TESTS = 20;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Where the reporter saves the timings for the summary step (ignored by git, as all of node_modules is). */
export const TIMINGS_FILE = process.env.TOME_SLOW_TESTS_FILE || join(repoRoot, 'node_modules', '.cache', 'tome-slow-tests.json');

/** Each test that has a result, as { file, name, ms }, read from the runner's test modules. The time is not rounded. */
export function collectTimings(testModules) {
  const timings = [];
  for (const mod of testModules) {
    const file = mod.relativeModuleId ?? mod.moduleId;
    for (const test of mod.children.allTests()) {
      const diagnostic = test.diagnostic();
      if (diagnostic === undefined) continue;
      timings.push({ file, name: test.fullName, ms: diagnostic.duration });
    }
  }
  return timings;
}

/** The tests over the threshold, slowest first. Compared unrounded, as the runner does (300.4 ms is slow). */
export function slowTests(timings, thresholdMs = SLOW_TEST_MS) {
  return timings.filter((t) => t.ms > thresholdMs).sort((a, b) => b.ms - a.ms);
}

/**
 * The summary the check prints: a title line, the count, then one line per slow test (the slowest `limit`, then how
 * many more and how to see them). `limit: Infinity` lists them all. Times are rounded for display only.
 */
export function formatSlowTests(timings, { thresholdMs = SLOW_TEST_MS, limit = SHOWN_SLOW_TESTS } = {}) {
  const slow = slowTests(timings, thresholdMs);
  const title = 'Slow-test report (cs-34; it never fails the check)';
  if (slow.length === 0) return `${title}\nnone over ${thresholdMs} ms (${timings.length} unit tests timed)\n`;
  const shown = slow.slice(0, limit);
  const width = String(Math.round(shown[0].ms)).length;
  const lines = shown.map((t) => `  ${String(Math.round(t.ms)).padStart(width)} ms  ${t.file} > ${t.name}`);
  const more = slow.length - shown.length;
  if (more > 0) lines.push(`  … and ${more} more: \`node scripts/slow-tests.mjs --all\``);
  const count = `${slow.length} unit ${slow.length === 1 ? 'test' : 'tests'} over ${thresholdMs} ms (of ${timings.length} timed), slowest first; each needs a reason:`;
  return `${title}\n${count}\n${lines.join('\n')}\n`;
}

/** The Vitest reporter: clears the last run's timings at the start, saves this run's at the end. Never touches the result. */
export default class SlowTestReporter {
  constructor(options = {}) {
    this.file = options.file ?? TIMINGS_FILE;
    this.now = options.now ?? (() => new Date());
  }

  onTestRunStart() {
    // So a run that saves nothing (a failure to save, or another reporter given on the command line) is never
    // reported with the last run's times.
    try {
      rmSync(this.file, { force: true });
    } catch {
      // Nothing to clear, or it can't be: the summary still shows when its timings were saved.
    }
  }

  onTestRunEnd(testModules) {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify({ savedAt: this.now().toISOString(), timings: collectTimings(testModules) }));
    } catch (error) {
      console.warn(`Slow-test report: could not save the timings (${error.message}).`);
    }
  }
}

function printSummary(argv) {
  let saved;
  try {
    saved = JSON.parse(readFileSync(TIMINGS_FILE, 'utf8'));
    if (!Array.isArray(saved?.timings) || typeof saved.savedAt !== 'string') throw new Error('not a saved run');
  } catch {
    console.log('Slow-test report: no timings saved (run `npm test` first).');
    return;
  }
  const limit = argv.includes('--all') ? Infinity : SHOWN_SLOW_TESTS;
  console.log(`\n${formatSlowTests(saved.timings, { limit })}(from the test run saved at ${saved.savedAt})\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) printSummary(process.argv.slice(2));

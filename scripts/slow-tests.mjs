// The slow-test report (check 9, cs-34; spec `docs/specs/hard-rule-and-size-checks.md`). It only reports: it never fails.
// Two halves, one file:
// - The default export is a Vitest reporter (vite.config.ts, `reporters`). When a test run ends it saves each unit
//   test's file, name and time to TIMINGS_FILE, and prints nothing.
// - Run as a script (`node scripts/slow-tests.mjs`, the last step of `npm run check`, after the build), it prints the
//   summary: the count of unit tests over 300 ms, then each with its time, slowest first. It always exits 0.
// The summary is printed after the build, not by the reporter, so it is the last thing the check shows.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** cs-34: a unit test slower than this is reported (also the runner's `slowTestThreshold`, vite.config.ts). */
export const SLOW_TEST_MS = 300;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Where the reporter saves the timings for the summary step (ignored by git, as all of node_modules is). */
export const TIMINGS_FILE = process.env.TOME_SLOW_TESTS_FILE || join(repoRoot, 'node_modules', '.cache', 'tome-slow-tests.json');

/** Each test that has a result, as { file, name, ms }, read from the runner's test modules. */
export function collectTimings(testModules) {
  const timings = [];
  for (const mod of testModules) {
    const file = mod.relativeModuleId ?? mod.moduleId;
    for (const test of mod.children.allTests()) {
      const diagnostic = test.diagnostic();
      if (diagnostic === undefined) continue;
      timings.push({ file, name: test.fullName, ms: Math.round(diagnostic.duration) });
    }
  }
  return timings;
}

/** The tests over the threshold, slowest first. */
export function slowTests(timings, thresholdMs = SLOW_TEST_MS) {
  return timings.filter((t) => t.ms > thresholdMs).sort((a, b) => b.ms - a.ms);
}

/** The summary the check prints: a title line, the count, then one line per slow test. */
export function formatSlowTests(timings, thresholdMs = SLOW_TEST_MS) {
  const slow = slowTests(timings, thresholdMs);
  const title = 'Slow-test report (cs-34; it never fails the check)';
  if (slow.length === 0) return `${title}\nnone over ${thresholdMs} ms (${timings.length} unit tests timed)\n`;
  const width = String(slow[0].ms).length;
  const lines = slow.map((t) => `  ${String(t.ms).padStart(width)} ms  ${t.file} > ${t.name}`);
  const count = `${slow.length} unit ${slow.length === 1 ? 'test' : 'tests'} over ${thresholdMs} ms (of ${timings.length} timed), slowest first; each needs a reason:`;
  return `${title}\n${count}\n${lines.join('\n')}\n`;
}

/** The Vitest reporter: saves the timings when the run ends. A failure to save never touches the run's result. */
export default class SlowTestReporter {
  constructor(options = {}) {
    this.file = options.file ?? TIMINGS_FILE;
  }

  onTestRunEnd(testModules) {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(collectTimings(testModules)));
    } catch (error) {
      console.warn(`Slow-test report: could not save the timings (${error.message}).`);
    }
  }
}

function printSummary() {
  let timings;
  try {
    timings = JSON.parse(readFileSync(TIMINGS_FILE, 'utf8'));
    if (!Array.isArray(timings)) throw new Error('not a list');
  } catch {
    console.log('Slow-test report: no timings saved (run `npm test` first).');
    return;
  }
  console.log(`\n${formatSlowTests(timings)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) printSummary();

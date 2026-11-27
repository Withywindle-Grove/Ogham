// Tests for the slow-test report (scripts/slow-tests.mjs, check 9, cs-34): the summary at the end of `npm run check`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import SlowTestReporter, { SLOW_TEST_MS, collectTimings, formatSlowTests, slowTests } from './slow-tests.mjs';

const script = fileURLToPath(new URL('./slow-tests.mjs', import.meta.url));

// Invented timings: three tests over the threshold, two under it, one exactly on it.
const planted = [
  { file: 'src/a.test.ts', name: 'lantern lights', ms: 120 },
  { file: 'src/b.test.ts', name: 'bog lurker walks the whole creation', ms: 950 },
  { file: 'src/a.test.ts', name: 'the warden counts slots', ms: 300 },
  { file: 'src/c.test.ts', name: 'the damage pad', ms: 4210 },
  { file: 'src/b.test.ts', name: 'a purse of 999', ms: 301 },
  { file: 'src/c.test.ts', name: 'an empty pack', ms: 0 },
];

// A stand-in for the runner's test modules: each module gives its tests, each test its name and time.
function fakeModule(relativeModuleId, tests) {
  return {
    relativeModuleId,
    moduleId: `/repo/${relativeModuleId}`,
    children: {
      *allTests() {
        for (const t of tests) yield { fullName: t.name, diagnostic: () => (t.ms === undefined ? undefined : { duration: t.ms }) };
      },
    },
  };
}

const dirs = [];
function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), 'slow-tests-'));
  dirs.push(dir);
  return join(dir, 'timings.json');
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runReport(file) {
  return spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, TOME_SLOW_TESTS_FILE: file } });
}

describe('which tests are slow', () => {
  // The threshold is 300 ms, the one cs-34 names.
  it('uses 300 ms', () => {
    expect(SLOW_TEST_MS).toBe(300);
  });

  // Only a test over 300 ms is listed, slowest first; one at exactly 300 ms is not.
  it('lists the tests over the threshold, slowest first', () => {
    expect(slowTests(planted).map((t) => t.ms)).toEqual([4210, 950, 301]);
  });

  // A run with no slow test lists nothing.
  it('lists nothing when no test is slow', () => {
    expect(slowTests(planted.filter((t) => t.ms <= 300))).toEqual([]);
  });
});

describe('the summary', () => {
  // The summary gives the count, then each slow test with its time and file, slowest first.
  it('gives the count and each slow test, slowest first', () => {
    const text = formatSlowTests(planted);
    expect(text).toContain('3 unit tests over 300 ms');
    const lines = text.split('\n');
    const at = (s) => lines.findIndex((l) => l.includes(s));
    expect(at('the damage pad')).toBeGreaterThan(-1);
    expect(at('the damage pad')).toBeLessThan(at('bog lurker walks the whole creation'));
    expect(at('bog lurker walks the whole creation')).toBeLessThan(at('a purse of 999'));
    expect(lines[at('the damage pad')]).toMatch(/4210 ms\s+src\/c\.test\.ts > the damage pad/);
    expect(text).not.toContain('lantern lights');
    expect(text).not.toContain('the warden counts slots');
  });

  // One slow test is "1 unit test", not "1 unit tests".
  it('says "test" for one', () => {
    expect(formatSlowTests([{ file: 'src/a.test.ts', name: 'x', ms: 400 }])).toContain('1 unit test over 300 ms');
  });

  // With no slow test the summary says so in one line and lists nothing.
  it('says none in one line when no test is slow', () => {
    const text = formatSlowTests(planted.filter((t) => t.ms <= 300));
    expect(text.trim().split('\n')).toHaveLength(2);
    expect(text).toContain('none over 300 ms');
    expect(text).not.toContain(' ms  ');
  });
});

describe('reading the runner', () => {
  // Each test's file, full name and time are read from the runner's modules; a test with no result is skipped.
  it('collects every test that has a time', () => {
    const modules = [
      fakeModule('src/a.test.ts', [{ name: 'one', ms: 12 }, { name: 'skipped', ms: undefined }]),
      fakeModule('scripts/b.test.mjs', [{ name: 'two', ms: 340.6 }]),
    ];
    expect(collectTimings(modules)).toEqual([
      { file: 'src/a.test.ts', name: 'one', ms: 12 },
      { file: 'scripts/b.test.mjs', name: 'two', ms: 341 },
    ]);
  });

  // At the end of a test run the reporter saves the timings for the summary step, and prints nothing itself.
  it('saves the timings when the run ends', () => {
    const file = tempFile();
    const reporter = new SlowTestReporter({ file });
    reporter.onTestRunEnd([fakeModule('src/a.test.ts', [{ name: 'slow one', ms: 700 }])]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([{ file: 'src/a.test.ts', name: 'slow one', ms: 700 }]);
  });
});

describe('the summary step never fails the check', () => {
  // Slow tests in the saved timings are printed, and the step still exits 0.
  it('prints the slow tests and exits 0', () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify(planted));
    const run = runReport(file);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('3 unit tests over 300 ms');
    expect(run.stdout).toContain('the damage pad');
  });

  // With no saved timings (the tests did not run), the step says so and still exits 0.
  it('exits 0 when there are no saved timings', () => {
    const run = runReport(join(tempFile(), 'missing.json'));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('no timings');
  });

  // An unreadable timings file is reported, not a failure.
  it('exits 0 when the saved timings are unreadable', () => {
    const file = tempFile();
    writeFileSync(file, 'not json');
    const run = runReport(file);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('no timings');
  });
});

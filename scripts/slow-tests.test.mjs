// Tests for the slow-test report (scripts/slow-tests.mjs, check 9, cs-34): the summary at the end of `npm run check`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import SlowTestReporter, { SHOWN_SLOW_TESTS, SLOW_TEST_MS, collectTimings, formatSlowTests, slowTests } from './slow-tests.mjs';

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

function runReport(file, args = []) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, TOME_SLOW_TESTS_FILE: file } });
}

/** A saved run, as the reporter writes it. */
const saved = (timings, savedAt = '2026-11-27T10:00:00.000Z') => JSON.stringify({ savedAt, timings });

/** Invented slow tests, `count` of them, each slower than the last listed. */
const manySlow = (count) => Array.from({ length: count }, (_, i) => ({ file: 'src/d.test.ts', name: `slow walk ${i + 1}`, ms: 400 + i }));

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

  // The time is compared before it is rounded, as the runner does: a 300.4 ms test is slow.
  it('counts a test a fraction over 300 ms as slow', () => {
    expect(slowTests([{ file: 'src/a.test.ts', name: 'x', ms: 300.4 }])).toHaveLength(1);
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

  // Times are shown rounded to the millisecond.
  it('shows each time rounded', () => {
    expect(formatSlowTests([{ file: 'src/a.test.ts', name: 'x', ms: 300.4 }])).toMatch(/ 300 ms {2}src\/a\.test\.ts > x/);
  });

  // The summary stays short so it is read: the count, the slowest 20, then how many more and how to list them all.
  it('lists the slowest 20, then how many more and the command for all of them', () => {
    const text = formatSlowTests(manySlow(25));
    expect(SHOWN_SLOW_TESTS).toBe(20);
    expect(text).toContain('25 unit tests over 300 ms');
    expect(text).toContain('slow walk 25');
    expect(text).toContain('slow walk 6\n');
    expect(text).not.toContain('slow walk 5\n');
    expect(text.trim().split('\n').at(-1)).toBe('  … and 5 more: `node scripts/slow-tests.mjs --all`');
  });

  // Asked for all of them, the summary lists every slow test and no "more" line.
  it('lists every slow test when asked for all', () => {
    const text = formatSlowTests(manySlow(25), { limit: Infinity });
    expect(text).toContain('slow walk 1\n');
    expect(text).not.toContain('more:');
  });

  // With 20 or fewer slow tests there is no "more" line.
  it('has no "more" line when all the slow tests fit', () => {
    expect(formatSlowTests(manySlow(20))).not.toContain('more:');
  });

  // With no slow test the summary gives its title and one line saying none, and lists nothing.
  it('says none in one line under the title when no test is slow', () => {
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
      { file: 'scripts/b.test.mjs', name: 'two', ms: 340.6 },
    ]);
  });

  // At the end of a test run the reporter saves the timings, and when it saved them, for the summary step.
  it('saves the timings and the time when the run ends', () => {
    const file = tempFile();
    const reporter = new SlowTestReporter({ file, now: () => new Date('2026-11-27T10:00:00Z') });
    reporter.onTestRunEnd([fakeModule('src/a.test.ts', [{ name: 'slow one', ms: 700 }])]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ savedAt: '2026-11-27T10:00:00.000Z', timings: [{ file: 'src/a.test.ts', name: 'slow one', ms: 700 }] });
  });

  // At the start of a test run the reporter deletes the last run's timings, so a run that saves none is never
  // reported with the last run's times.
  it("deletes the last run's timings when a run starts", () => {
    const file = tempFile();
    writeFileSync(file, saved(planted));
    new SlowTestReporter({ file }).onTestRunStart();
    expect(existsSync(file)).toBe(false);
    expect(runReport(file).stdout).toContain('no timings');
  });
});

describe('the summary step never fails the check', () => {
  // Slow tests in the saved timings are printed, and the step still exits 0.
  it('prints the slow tests and exits 0', () => {
    const file = tempFile();
    writeFileSync(file, saved(planted));
    const run = runReport(file);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('3 unit tests over 300 ms');
    expect(run.stdout).toContain('the damage pad');
    // It says which run the times are from.
    expect(run.stdout).toContain('saved at 2026-11-27T10:00:00.000Z');
  });

  // Run with --all, the step lists every slow test.
  it('lists every slow test with --all', () => {
    const file = tempFile();
    writeFileSync(file, saved(manySlow(25)));
    expect(runReport(file).stdout).toContain('… and 5 more');
    const all = runReport(file, ['--all']);
    expect(all.status).toBe(0);
    expect(all.stdout).toContain('slow walk 1\n');
    expect(all.stdout).not.toContain('more:');
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

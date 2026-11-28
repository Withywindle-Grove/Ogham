// Tests for scripts/ci-redraws.mjs: when a picture run may redraw announced gallery pictures itself
// (ci-announced-redraws, Francis 2026-11-20). Purposes, as sentences:
// - The announcing line in the pull request's text names the pictures; only plain picture names on that line count.
// - When the only failures are differences in announced pictures, the redraws are accepted.
// - A difference in a picture the pull request doesn't announce refuses the redraws, so the run stays red.
// - A failure in any other test refuses the redraws, even when every differing picture was announced.
// - A picture that never held still, or a shard that kept no report, refuses the redraws.
// - An announced picture that didn't change is reported.
// - The redrawn file is the 1x -actual.png Playwright compared, found in the downloaded artifact; --write copies it
//   over its approved picture and nothing else.
// - A report from an earlier attempt of the run, from other code, or that doesn't say which, refuses the redraws, so a
//   re-run never judges an older attempt's pictures.
// - After the copy, git status must show exactly the accepted pictures modified: an untracked file, another modified
//   file or no accepted picture at all stops the commit.
// - With no --count the judge reads all six layout shards, so a missing sixth shard's report refuses the redraws
//   (ci-layout-shards-6).
import { execFileSync } from 'node:child_process';
import { withoutGitVariables } from './git-test-env.mjs';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { announcedPictures, artifactPath, judge, run, runVerifyStatus, staleReport, summaryLines, verifyStatus } from './ci-redraws.mjs';

const ROOT = '/__w/Tome/Tome';
/** The run attempt and commit every report below was drawn in, unless a test says otherwise. */
const ATTEMPT = '2';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const THIS_RUN = ['--attempt', ATTEMPT, '--sha', SHA];
const COMPARISON = 'gallery (phone, light) matches the approved pictures';

/** One failed attempt of the gallery comparison, differing in the named pictures. */
function differing(names, { retry = 0, extraError, previous = false } = {}) {
  const dir = `${ROOT}/test-results/layout/gallery-phone-light-matches${retry ? `-retry${retry}` : ''}`;
  const errors = names.map((name) => ({
    message: `\x1b[2mexpect(\x1b[22m\x1b[31mlocator\x1b[39m\x1b[2m).\x1b[22mtoHaveScreenshot\x1b[2m(\x1b[22m\x1b[32mexpected\x1b[39m\x1b[2m)\x1b[22m failed\n\n  120 pixels (ratio 0.01 of all image pixels) are different.\n\n  Snapshot: ${name}\n\nCall log:\n  - Expect "toHaveScreenshot(${name})" with timeout 5000ms\n`,
  }));
  if (extraError) errors.push({ message: extraError });
  const attachments = names.flatMap((name) => {
    const base = name.replace(/\.png$/, '');
    return [
      { name: `${base}-expected.png`, contentType: 'image/png', path: `${ROOT}/tests/layout/gallery-baselines/${name}` },
      { name: `${base}-actual.png`, contentType: 'image/png', path: `${dir}/${base}-actual.png` },
      { name: `${base}-diff.png`, contentType: 'image/png', path: `${dir}/${base}-diff.png` },
      ...(previous ? [{ name: `${base}-previous.png`, contentType: 'image/png', path: `${dir}/${base}-previous.png` }] : []),
    ];
  });
  return { status: 'failed', retry, errors, attachments };
}

const test = (title, status, results = []) => ({ title, file: title.startsWith('gallery') ? 'gallery.spec.ts' : 'other.spec.ts', status, results });

/** A shard's JSON report holding the given specs. */
function report(...specs) {
  return {
    config: { configFile: `${ROOT}/playwright.config.ts`, metadata: { runAttempt: ATTEMPT, sha: SHA, actualWorkers: 2 } },
    errors: [],
    suites: [
      {
        title: 'gallery.spec.ts',
        file: 'gallery.spec.ts',
        specs: [],
        suites: [
          {
            title: 'phone light',
            file: 'gallery.spec.ts',
            specs: specs.map((s) => ({ title: s.title, file: s.file, tests: [{ status: s.status, results: s.results }] })),
          },
        ],
      },
    ],
  };
}

const passing = report(test('gallery (phone, light): fits, 44px targets, 14px text, accessible', 'expected'));

/** The same report, as drawn in another attempt or on another commit. */
const drawnIn = (shardReport, metadata) => ({ ...shardReport, config: { ...shardReport.config, metadata } });
const failedComparison = (names, options) =>
  test(COMPARISON, 'unexpected', [differing(names, options), differing(names, { ...options, retry: 1 })]);

describe('the announcing line', () => {
  it('reads the picture names on the announcing line, in any case, in a list or in backticks', () => {
    const body = [
      '6. Manual checks',
      '- Gallery pictures expected to change: `phone-light-atoms.png`, tablet-dark-atoms.png (the new chip)',
      'Not here: phone-dark-atoms.png',
      'GALLERY PICTURES EXPECTED TO CHANGE: phone-light-colour.png',
    ].join('\r\n');
    expect([...announcedPictures(body)].sort()).toEqual(['phone-light-atoms.png', 'phone-light-colour.png', 'tablet-dark-atoms.png']);
  });

  it('announces nothing for "none", a missing line, an empty text, or names that are not plain pictures', () => {
    expect(announcedPictures('Gallery pictures expected to change: none').size).toBe(0);
    expect(announcedPictures('').size).toBe(0);
    expect(announcedPictures(undefined).size).toBe(0);
    expect(announcedPictures('Gallery pictures expected to change: ../x.png, gallery/x.png, Phone.png, a.png.png').size).toBe(0);
    expect([...announcedPictures('Gallery pictures expected to change: "a.png"; (b.png).')]).toEqual(['a.png', 'b.png']);
  });
});

describe('the verdict', () => {
  const announced = new Set(['phone-light-atoms.png', 'phone-light-colour.png']);

  it('accepts when the only failures are differences in announced pictures, from the last attempt', () => {
    const result = judge(
      [
        { shard: 1, report: report(failedComparison(['phone-light-atoms.png', 'phone-light-colour.png'])) },
        { shard: 2, report: passing },
        { shard: 3, report: passing },
      ],
      announced,
    );
    expect(result.verdict).toBe('accept');
    expect(result.redraws.map((r) => [r.name, r.shard])).toEqual([
      ['phone-light-atoms.png', 1],
      ['phone-light-colour.png', 1],
    ]);
    expect(result.redraws[0].attachment).toContain('-retry1/phone-light-atoms-actual.png');
  });

  it('refuses when a differing picture was not announced', () => {
    const result = judge(
      [{ shard: 1, report: report(failedComparison(['phone-light-atoms.png', 'phone-light-sheet.png'])) }],
      announced,
    );
    expect(result.verdict).toBe('refuse');
    expect(result.unannounced).toEqual(['phone-light-sheet.png']);
    expect(summaryLines(result).join('\n')).toContain("phone-light-sheet.png differs but the pull request doesn't announce it.");
  });

  it('refuses when any other test failed, even with every differing picture announced', () => {
    const other = test('the ring leads each row', 'unexpected', [{ status: 'failed', errors: [{ message: 'Expected: 52' }], attachments: [] }]);
    const result = judge([{ shard: 2, report: report(failedComparison(['phone-light-atoms.png']), other) }], announced);
    expect(result.verdict).toBe('refuse');
    expect(result.problems).toEqual(['shard 2: "the ring leads each row" failed']);
  });

  it('refuses when the comparison test also failed on something that is not a picture', () => {
    const mixed = test(COMPARISON, 'unexpected', [differing(['phone-light-atoms.png'], { extraError: 'Error: page.goto: net::ERR' })]);
    expect(judge([{ shard: 1, report: report(mixed) }], announced).verdict).toBe('refuse');
  });

  it('refuses a picture that never held still, a timed-out attempt, or a shard with no report', () => {
    const unsteady = test(COMPARISON, 'unexpected', [differing(['phone-light-atoms.png'], { previous: true })]);
    expect(judge([{ shard: 1, report: report(unsteady) }], announced).verdict).toBe('refuse');
    const timedOut = test(COMPARISON, 'unexpected', [{ ...differing(['phone-light-atoms.png']), status: 'timedOut' }]);
    expect(judge([{ shard: 1, report: report(timedOut) }], announced).verdict).toBe('refuse');
    const result = judge(
      [
        { shard: 1, report: report(failedComparison(['phone-light-atoms.png'])) },
        { shard: 2, report: null },
      ],
      announced,
    );
    expect(result.verdict).toBe('refuse');
    expect(result.problems[0]).toMatch(/^shard 2: no report/);
  });

  it('accepts a picture that changed size and timed out retaking, but still refuses a bare timeout or a -previous.png', () => {
    // Purpose: a picture whose size changed makes Playwright retake it until its timeout (#122, run 46057493958, the
    // tablet move-on-parts pictures); that timeout is not movement, so the redraw is accepted. A timeout with no size
    // change, or a size change with a -previous.png (two takes that differed), still refuses as "never held still".
    const name = 'phone-light-atoms.png';
    const sizeLine = 'Expected an image 992px by 7709px, received 992px by 9710px. 340626 pixels (ratio 0.04 of all image pixels) are different.';
    const timedOutTake = (lines, options) => {
      const attempt = differing([name], options);
      attempt.errors = [
        {
          message: `\x1b[2mexpect(\x1b[22m\x1b[31mlocator\x1b[39m\x1b[2m).\x1b[22mtoHaveScreenshot\x1b[2m(\x1b[22m\x1b[32mexpected\x1b[39m\x1b[2m)\x1b[22m failed\n\n    Locator: locator('.gallery__section').nth(31)\n    Timeout: 5000ms\n      Timeout 5000ms exceeded.\n\n      Snapshot: ${name}\n\n    Call log:\n      - Expect "soft toHaveScreenshot(${name})" locator('.gallery__section').nth(31) with timeout 5000ms\n${lines.map((line) => `      - ${line}\n`).join('')}      - Timeout 5000ms exceeded.\n`,
        },
      ];
      return attempt;
    };
    const both = (lines, options = {}) => ({
      title: COMPARISON,
      file: 'gallery.spec.ts',
      status: 'unexpected',
      results: [timedOutTake(lines, options), timedOutTake(lines, { ...options, retry: 1 })],
    });
    const resized = judge([{ shard: 1, report: report(both([sizeLine, 'waiting 100ms before taking screenshot'])) }], announced);
    expect(resized.verdict).toBe('accept');
    expect(resized.redraws.map((r) => r.name)).toEqual([name]);
    expect(resized.redraws[0].attachment).toContain('-retry1/phone-light-atoms-actual.png');
    const bare = judge([{ shard: 1, report: report(both(['waiting for element to be stable'])) }], announced);
    expect(bare.verdict).toBe('refuse');
    expect(bare.problems.join('\n')).toContain('never held still');
    const sameSize = 'Expected an image 992px by 7709px, received 992px by 7709px. 120 pixels (ratio 0.01 of all image pixels) are different.';
    expect(judge([{ shard: 1, report: report(both([sameSize])) }], announced).verdict).toBe('refuse');
    const moved = judge([{ shard: 1, report: report(both([sizeLine], { previous: true })) }], announced);
    expect(moved.verdict).toBe('refuse');
    expect(moved.problems.join('\n')).toContain('never held still');
  });

  it('reports an announced picture that did not change, and still accepts the ones that did', () => {
    const result = judge([{ shard: 1, report: report(failedComparison(['phone-light-atoms.png'])) }], announced);
    expect(result.verdict).toBe('accept');
    expect(result.unchanged).toEqual(['phone-light-colour.png']);
    expect(summaryLines(result).join('\n')).toContain("Announced but didn't change: phone-light-colour.png.");
  });

  it('says there is nothing to redraw when no picture differed (a flaky pass is not a difference)', () => {
    const flaky = test(COMPARISON, 'flaky', [differing(['phone-light-atoms.png']), { status: 'passed', errors: [], attachments: [] }]);
    expect(judge([{ shard: 1, report: report(flaky) }], announced).verdict).toBe('none');
  });
});

describe('which run attempt drew each report', () => {
  const announced = new Set(['phone-light-atoms.png']);
  const thisRun = { attempt: ATTEMPT, sha: SHA };
  const differs = report(failedComparison(['phone-light-atoms.png']));

  it('accepts reports that name this very attempt and commit', () => {
    expect(staleReport(differs, thisRun)).toBe('');
    const result = judge(
      [
        { shard: 1, report: differs },
        { shard: 2, report: passing },
      ],
      announced,
      thisRun,
    );
    expect(result.verdict).toBe('accept');
  });

  it("refuses an earlier attempt's report, even one that differs only in announced pictures (a re-run's stale artifact)", () => {
    const result = judge(
      [
        { shard: 1, report: drawnIn(differs, { runAttempt: '1', sha: SHA }) },
        { shard: 2, report: passing },
      ],
      announced,
      thisRun,
    );
    expect(result.verdict).toBe('refuse');
    expect(result.redraws).toEqual([]);
    expect(result.problems).toEqual([
      'shard 1: its report is from attempt 1, not this attempt (2): add the ready label again for a fresh run',
    ]);
  });

  it('refuses a passing shard whose report is from an earlier attempt too, since nothing shows what this attempt drew', () => {
    const result = judge(
      [
        { shard: 1, report: differs },
        { shard: 2, report: drawnIn(passing, { runAttempt: '1', sha: SHA }) },
      ],
      announced,
      thisRun,
    );
    expect(result.verdict).toBe('refuse');
  });

  it('refuses a report drawn on another commit', () => {
    const other = drawnIn(differs, { runAttempt: ATTEMPT, sha: 'fedcba9876543210fedcba9876543210fedcba98' });
    expect(judge([{ shard: 1, report: other }], announced, thisRun).problems).toEqual([
      'shard 1: its report checked commit fedcba987654, not 0123456789ab',
    ]);
  });

  it("refuses a report that doesn't say which attempt and commit drew it, and refuses when the job gave neither", () => {
    expect(judge([{ shard: 1, report: drawnIn(differs, undefined) }], announced, thisRun).problems).toEqual([
      "shard 1: its report doesn't say which run attempt and commit it checked",
    ]);
    expect(staleReport(differs, { attempt: '', sha: '' })).toBe("this run's attempt and commit weren't given");
  });

  it('refuses in a whole run when --attempt and --sha are missing, and copies nothing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redraws-'));
    const baselines = path.join(dir, 'baselines');
    mkdirSync(baselines);
    writeFileSync(path.join(baselines, 'phone-light-atoms.png'), 'old');
    const kept = path.join(dir, 'shards', '1', 'layout', 'gallery-phone-light-matches-retry1');
    mkdirSync(kept, { recursive: true });
    writeFileSync(path.join(kept, 'phone-light-atoms-actual.png'), 'new');
    writeFileSync(path.join(dir, 'shards', '1', 'layout-report.json'), JSON.stringify(differs));
    const body = path.join(dir, 'body.txt');
    writeFileSync(body, 'Gallery pictures expected to change: phone-light-atoms.png');
    const args = ['--body', body, '--shards', path.join(dir, 'shards'), '--count', '1', '--baselines', baselines, '--write'];
    expect(run(args).verdict).toBe('refuse');
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('old');
    expect(run([...args, '--attempt', '1', '--sha', SHA]).verdict).toBe('refuse');
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('old');
    expect(run([...args, ...THIS_RUN]).verdict).toBe('accept');
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('new');
  });

  // Purpose: with no --count the judge reads all six layout shards (ci-layout-shards-6), so a run whose sixth shard
  // kept no report is refused and nothing is copied; once the sixth is there, the same run is accepted.
  it('reads six shards when --count is not given, and refuses when the sixth kept no report', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redraws-'));
    const baselines = path.join(dir, 'baselines');
    mkdirSync(baselines);
    writeFileSync(path.join(baselines, 'phone-light-atoms.png'), 'old');
    const kept = path.join(dir, 'shards', '1', 'layout', 'gallery-phone-light-matches-retry1');
    mkdirSync(kept, { recursive: true });
    writeFileSync(path.join(kept, 'phone-light-atoms-actual.png'), 'new');
    writeFileSync(path.join(dir, 'shards', '1', 'layout-report.json'), JSON.stringify(differs));
    for (const n of [2, 3, 4, 5]) {
      mkdirSync(path.join(dir, 'shards', String(n)), { recursive: true });
      writeFileSync(path.join(dir, 'shards', String(n), 'layout-report.json'), JSON.stringify(passing));
    }
    const body = path.join(dir, 'body.txt');
    writeFileSync(body, 'Gallery pictures expected to change: phone-light-atoms.png');
    const args = ['--body', body, '--shards', path.join(dir, 'shards'), '--baselines', baselines, '--write', ...THIS_RUN];
    const missing = run(args);
    expect(missing.verdict).toBe('refuse');
    expect(missing.problems).toEqual([expect.stringMatching(/^shard 6: no report/)]);
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('old');
    mkdirSync(path.join(dir, 'shards', '6'), { recursive: true });
    writeFileSync(path.join(dir, 'shards', '6', 'layout-report.json'), JSON.stringify(passing));
    expect(run(args).verdict).toBe('accept');
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('new');
  });
});

describe('the check before the redraw commit (--verify-status)', () => {
  const B = 'tests/layout/gallery-baselines';

  it('passes when git status shows exactly the accepted pictures modified', () => {
    const status = ` M ${B}/phone-light-colour.png\n M ${B}/phone-light-atoms.png\n`;
    expect(verifyStatus(status, 'phone-light-atoms.png phone-light-colour.png').ok).toBe(true);
  });

  it('stops the commit when an untracked file appeared', () => {
    const result = verifyStatus(` M ${B}/phone-light-atoms.png\n?? ${B}/phone-light-new.png\n`, 'phone-light-atoms.png');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('the redraw changed something other than the announced pictures');
    expect(result.got).toContain(`?? ${B}/phone-light-new.png`);
  });

  it('stops the commit when another file was modified too', () => {
    const status = ` M ${B}/phone-light-atoms.png\n M src/ui/Chip.tsx\n`;
    expect(verifyStatus(status, 'phone-light-atoms.png').ok).toBe(false);
  });

  it('stops the commit when an accepted picture did not actually change', () => {
    expect(verifyStatus(` M ${B}/phone-light-atoms.png\n`, 'phone-light-atoms.png phone-light-colour.png').ok).toBe(false);
  });

  it('stops the commit when no picture was accepted (an empty PICTURES), even with nothing changed', () => {
    expect(verifyStatus('', '')).toMatchObject({ ok: false, reason: 'no pictures were accepted' });
    expect(verifyStatus('', '  ')).toMatchObject({ ok: false, reason: 'no pictures were accepted' });
    expect(verifyStatus(` M ${B}/../x.png\n`, '../x.png')).toMatchObject({ ok: false, reason: 'an odd picture name' });
  });

  it('reads a real git checkout: an untracked file or an extra change stops it, the pictures alone pass', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redraws-git-'));
    // Without GIT_DIR, GIT_INDEX_FILE and the rest: inside a commit hook they point at the real repository, and
    // `git init` there would rewrite its shared config (it once set core.bare = true for every worktree).
    const env = withoutGitVariables();
    const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8', env });
    // Never let this test touch a repository other than its own temporary one.
    expect(git('init', '-q').trim()).toBe('');
    expect(realpathSync.native(git('rev-parse', '--absolute-git-dir').trim())).toBe(realpathSync.native(path.join(dir, '.git')));
    mkdirSync(path.join(dir, B), { recursive: true });
    mkdirSync(path.join(dir, 'src'));
    writeFileSync(path.join(dir, B, 'phone-light-atoms.png'), 'old');
    writeFileSync(path.join(dir, 'src', 'app.ts'), 'old');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'start');
    const status = () => git('status', '--porcelain', '--untracked-files=all');
    const args = ['--verify-status', '--pictures', 'phone-light-atoms.png'];

    writeFileSync(path.join(dir, B, 'phone-light-atoms.png'), 'new');
    expect(runVerifyStatus(args, status).ok).toBe(true);

    writeFileSync(path.join(dir, B, 'stray.png'), 'x');
    const untracked = runVerifyStatus(args, status);
    expect(untracked.ok).toBe(false);
    expect(untracked.lines[0]).toBe('::error::the redraw changed something other than the announced pictures; nothing was committed.');
    git('clean', '-fq');

    writeFileSync(path.join(dir, 'src', 'app.ts'), 'changed');
    expect(runVerifyStatus(args, status).ok).toBe(false);
    expect(runVerifyStatus(['--verify-status', '--pictures', ''], status).ok).toBe(false);
  });
});

describe('the redrawn files', () => {
  it('finds an attachment inside the downloaded artifact, and nothing outside test-results/', () => {
    const config = `${ROOT}/playwright.config.ts`;
    expect(artifactPath(`${ROOT}/test-results/layout/x/a-actual.png`, config, 'shards/1')).toBe(path.join('shards/1', 'layout', 'x', 'a-actual.png'));
    expect(artifactPath(`${ROOT}/tests/layout/gallery-baselines/a.png`, config, 'shards/1')).toBe(null);
    expect(artifactPath(`${ROOT}/test-results/a.png`, undefined, 'shards/1')).toBe(null);
  });

  it('copies each accepted -actual.png over its approved picture with --write, and touches nothing on a refusal', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redraws-'));
    const baselines = path.join(dir, 'baselines');
    mkdirSync(baselines);
    for (const name of ['phone-light-atoms.png', 'phone-light-colour.png']) writeFileSync(path.join(baselines, name), 'old');
    const shardReport = report(failedComparison(['phone-light-atoms.png']));
    for (const n of [1, 2, 3, 4, 5, 6]) {
      mkdirSync(path.join(dir, 'shards', String(n), 'layout', 'gallery-phone-light-matches-retry1'), { recursive: true });
      writeFileSync(path.join(dir, 'shards', String(n), 'layout-report.json'), JSON.stringify(n === 1 ? shardReport : passing));
    }
    writeFileSync(path.join(dir, 'shards', '1', 'layout', 'gallery-phone-light-matches-retry1', 'phone-light-atoms-actual.png'), 'new');
    const body = path.join(dir, 'body.txt');
    const args = ['--body', body, '--shards', path.join(dir, 'shards'), '--count', '6', '--baselines', baselines, '--write', ...THIS_RUN];

    writeFileSync(body, 'Gallery pictures expected to change: none');
    expect(run(args).verdict).toBe('refuse');
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('old');

    writeFileSync(body, 'Gallery pictures expected to change: phone-light-atoms.png');
    const result = run(args);
    expect(result.verdict).toBe('accept');
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('new');
    expect(readFileSync(path.join(baselines, 'phone-light-colour.png'), 'utf8')).toBe('old');
  });

  it('refuses when an announced picture has no approved picture to replace (a new picture is not a redraw)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redraws-'));
    const baselines = path.join(dir, 'baselines');
    mkdirSync(baselines);
    const kept = path.join(dir, 'shards', '1', 'layout', 'gallery-phone-light-matches-retry1');
    mkdirSync(kept, { recursive: true });
    writeFileSync(path.join(kept, 'phone-light-atoms-actual.png'), 'new');
    writeFileSync(path.join(dir, 'shards', '1', 'layout-report.json'), JSON.stringify(report(failedComparison(['phone-light-atoms.png']))));
    const body = path.join(dir, 'body.txt');
    writeFileSync(body, 'Gallery pictures expected to change: phone-light-atoms.png');
    const result = run(['--body', body, '--shards', path.join(dir, 'shards'), '--count', '1', '--baselines', baselines, '--write', ...THIS_RUN]);
    expect(result.verdict).toBe('refuse');
    expect(result.problems).toEqual(['phone-light-atoms.png: no approved picture to replace']);
  });

  it('refuses when the redrawn picture was not kept in the artifact', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redraws-'));
    const baselines = path.join(dir, 'baselines');
    mkdirSync(baselines);
    writeFileSync(path.join(baselines, 'phone-light-atoms.png'), 'old');
    mkdirSync(path.join(dir, 'shards', '1'), { recursive: true });
    writeFileSync(path.join(dir, 'shards', '1', 'layout-report.json'), JSON.stringify(report(failedComparison(['phone-light-atoms.png']))));
    const body = path.join(dir, 'body.txt');
    writeFileSync(body, 'Gallery pictures expected to change: phone-light-atoms.png');
    const result = run(['--body', body, '--shards', path.join(dir, 'shards'), '--count', '1', '--baselines', baselines, '--write', ...THIS_RUN]);
    expect(result.verdict).toBe('refuse');
    expect(result.problems).toEqual(["phone-light-atoms.png: its redrawn picture wasn't kept"]);
    expect(readFileSync(path.join(baselines, 'phone-light-atoms.png'), 'utf8')).toBe('old');
  });
});

// The workflow side (check.yml's redraw job). Purposes, as sentences:
// - It runs only on a pull request from this repository into main, after check and database passed and a layout shard
//   failed, never on Dependabot's, a run by hand or the night run.
// - It commits only the announced pictures, on top of the commit the run checked (a fast-forward), and reports check,
//   database and layout on the new commit only after that push succeeded.
// - Its checkout keeps no token, its judge is the base's ci-redraws.mjs (the head's only while the base has none), and
//   the judge is told this run's attempt and commit.
// - The layout shards keep a JSON report with their screenshots, which is what the job reads.
// - It fetches and judges exactly the shards the layout-shard matrix runs (six since ci-layout-shards-6), no fewer.
// - Triage stays quiet when the redraw replaced the commit.
describe('the redraw job in check.yml', () => {
  const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/check.yml', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  const job = workflow.slice(workflow.indexOf('\n  redraw:\n'), workflow.indexOf('\n  deploy-production:\n'));

  it('runs only on a pull request into main from this repository, after check and database passed and layout failed', () => {
    const condition = job.match(/\n {4}if: >-\n((?: {6}.+\n)+)/)[1].replace(/\s+/g, ' ').trim();
    expect(condition).toBe(
      "!cancelled() && github.event_name == 'pull_request' && github.base_ref == 'main' && github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.login != 'dependabot[bot]' && needs.changes.outputs.layout_plan == 'run' && needs.layout-shard.result == 'failure' && needs.check.result == 'success' && needs.database.result == 'success'",
    );
    expect(job).toContain('needs: [pick, changes, check, database, layout-shard]');
    expect(job).toMatch(/permissions:\n {6}actions: read[^\n]*\n {6}checks: write[^\n]*\n {6}contents: write[^\n]*\n/);
  });

  it('commits only the announced pictures on the checked commit, and carries the checks only after the push', () => {
    expect(job).toContain('ref: ${{ github.event.pull_request.head.sha }}');
    expect(job).toContain('--count 6 --baselines tests/layout/gallery-baselines --attempt "$GITHUB_RUN_ATTEMPT" --sha "$GITHUB_SHA" \\\n            --write');
    expect(job).toContain("if: steps.judge.outputs.verdict == 'accept'");
    const verify = job.indexOf('--verify-status --pictures "$PICTURES" --baselines tests/layout/gallery-baselines');
    expect(verify).toBeGreaterThan(-1);
    expect(job.indexOf('git commit')).toBeGreaterThan(verify);
    expect(job).toContain('push origin "HEAD:refs/heads/$HEAD_REF"');
    expect(job).not.toMatch(/--force|-f origin|--no-verify/);
    const push = job.indexOf('push origin');
    const carry = job.indexOf('repos/$GITHUB_REPOSITORY/check-runs');
    expect(push).toBeGreaterThan(-1);
    expect(carry).toBeGreaterThan(push);
    expect(job).toContain('for name in check database layout; do');
  });

  it('keeps no token in the checkout, takes its judge from the base, and gives the token only to the push', () => {
    expect(job).toContain('persist-credentials: false');
    expect(job).toContain('"repos/$GITHUB_REPOSITORY/contents/scripts/ci-redraws.mjs?ref=$BASE_SHA"');
    expect(job).toContain('BASE_SHA: ${{ github.event.pull_request.base.sha }}');
    // The head's copy only on a 404 (the base has none yet), never on any other failure.
    expect(job).toMatch(/elif grep -q 'HTTP 404' [^\n]+\n\s+cp scripts\/ci-redraws\.mjs "\$RUNNER_TEMP\/judge\/ci-redraws\.mjs"/);
    expect(job.match(/node scripts\/ci-redraws\.mjs/g)).toBe(null);
    expect(job.match(/node "\$RUNNER_TEMP\/judge\/ci-redraws\.mjs"/g)).toHaveLength(2);
    expect(job).toContain('git -c "http.$GITHUB_SERVER_URL/.extraheader=AUTHORIZATION: basic $auth" push origin');
    expect(job).not.toMatch(/git config[^\n]*extraheader|git remote set-url/);
    // The verify step runs without the token.
    const verifyStep = job.slice(job.indexOf('- name: Only the announced pictures changed?'), job.indexOf('- name: Commit the redraws'));
    expect(verifyStep).not.toContain('GH_TOKEN');
  });

  it('reads the JSON report the layout shards keep with their screenshots, each naming its attempt and commit', () => {
    const config = readFileSync(fileURLToPath(new URL('../playwright.config.ts', import.meta.url)), 'utf8');
    expect(config).toContain("['json', { outputFile: 'test-results/layout-report.json' }]");
    expect(config).toContain("metadata: CI ? { runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '', sha: process.env.GITHUB_SHA ?? '' } : {},");
    expect(workflow).toContain('name: layout-screens-${{ matrix.shard }}\n          path: test-results/\n');
    expect(job).toContain('gh run download "$GITHUB_RUN_ID" --name "layout-screens-$n" --dir "$RUNNER_TEMP/shards/$n"');
  });

  // Purpose: the shards the redraw job fetches (its download loop) and judges (--count) are exactly the shards the
  // layout-shard matrix runs and Playwright splits the tests into, so no shard's failure goes unjudged.
  it('fetches and judges exactly the shards the layout-shard matrix runs', () => {
    const shardJob = workflow.slice(workflow.indexOf('\n  layout-shard:\n'), workflow.indexOf('\n  layout:\n'));
    const matrix = shardJob.match(/\n {8}shard: \[([\d, ]+)\]\n/)[1].split(',').map((n) => Number(n.trim()));
    expect(matrix).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shardJob).toContain(`--shard=\${{ matrix.shard }}/${matrix.length}`);
    expect(shardJob).toContain(`name: layout shard \${{ matrix.shard }}/${matrix.length}\n`);
    const fetched = job.match(/\n {10}for n in ([\d ]+); do\n {12}gh run download/)[1].split(' ').map(Number);
    expect(fetched).toEqual(matrix);
    expect(job).toContain(`--count ${matrix.length} --baselines`);
  });

  it('keeps triage quiet when the redraw replaced the commit', () => {
    expect(workflow).toContain('needs: [pick, changes, check, database, layout, redraw]');
    expect(workflow).toContain("failure() && github.event_name == 'pull_request' && needs.redraw.outputs.pushed != 'true'");
  });
});

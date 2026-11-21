// Tests for the first-push count (scripts/first-push-count.mjs): how a merged pull request's Check runs and pushes
// are sorted into "first push" or one of the kinds of rework. The parts that read GitHub and Git are not tested here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KINDS, WAIT_JOB, WAIT_STEP, daysBetween, isLeftOut, isWaitOnly, kindOf, pushesOf, rowsFor, runsOf, summarise, tableFor } from './first-push-count.mjs';

const run = (databaseId, headSha, createdAt, conclusion = 'success', more = {}) => ({
  databaseId,
  headSha,
  createdAt,
  conclusion,
  event: 'pull_request',
  headBranch: 'm9-lantern',
  ...more,
});
const pullRequest = (more = {}) => ({
  number: 7,
  headRefName: 'm9-lantern',
  createdAt: '2026-11-06T09:00:00Z',
  mergedAt: '2026-11-06T15:00:00Z',
  files: [{ path: 'src/app/App.tsx' }],
  ...more,
});

describe('pushes', () => {
  // Two runs on the same commit (a label added, a re-run) are one push, and pushes come out oldest first.
  it('counts one push per distinct commit, oldest first', () => {
    const runs = [run(3, 'bbb', '2026-11-06T12:00:00Z'), run(1, 'aaa', '2026-11-06T10:00:00Z'), run(2, 'aaa', '2026-11-06T11:00:00Z')];
    expect(pushesOf(runs)).toEqual(['aaa', 'bbb']);
  });
});

describe('the red run that only says "add the ready label"', () => {
  const failedStep = (name) => ({ name, conclusion: 'failure' });
  const job = (name, conclusion, steps = []) => ({ name, conclusion, steps });

  // The layout job's "Follow the plan" step alone in red means no test failed: the pull request has no label yet.
  it('is recognised when the layout job is the only red job and that step its only red step', () => {
    const jobs = [job('check', 'success'), job('database', 'success'), job(WAIT_JOB, 'failure', [failedStep(WAIT_STEP)])];
    expect(isWaitOnly(jobs)).toBe(true);
  });

  // The triage job only comments on a red run, so its own failure doesn't make the run a real one.
  it('still counts as by-design when the triage job failed too', () => {
    const jobs = [job(WAIT_JOB, 'failure', [failedStep(WAIT_STEP)]), job('triage', 'failure', [failedStep('Triage')])];
    expect(isWaitOnly(jobs)).toBe(true);
  });

  // A failed layout shard, a failed database job or a failed check is a real red run, whatever the layout job says.
  it.each([
    [[job('layout shard 1/3', 'failure', [failedStep('Run the tests')]), job(WAIT_JOB, 'failure', [failedStep(WAIT_STEP)])]],
    [[job('database', 'failure', [failedStep('Sum up the shards')]), job(WAIT_JOB, 'failure', [failedStep(WAIT_STEP)])]],
    [[job('check', 'failure', [failedStep('Run npm run check')])]],
    [[job(WAIT_JOB, 'failure', [failedStep('Some other step')])]],
    [[]],
  ])('is not recognised when something else failed (%#)', (jobs) => {
    expect(isWaitOnly(jobs)).toBe(false);
  });

  // The count depends on the workflow's own names: if the job or the step is renamed, this fails and says where.
  it('matches the job and step names in the Check workflow', () => {
    const file = fileURLToPath(new URL('../.github/workflows/check.yml', import.meta.url));
    const workflow = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const layoutJob = workflow.slice(workflow.indexOf(`\n  ${WAIT_JOB}:\n`));
    expect(layoutJob.startsWith(`\n  ${WAIT_JOB}:`)).toBe(true);
    const step = layoutJob.indexOf(`- name: ${WAIT_STEP}`);
    expect(step).toBeGreaterThan(-1);
    expect(layoutJob.slice(step, step + 2500)).toContain('Pictures not checked yet');
  });
});

describe('which kind a pull request is', () => {
  // One push and nothing red is the only case that counts as first time right.
  it('says first push for one push with no real red run', () => {
    expect(kindOf({ laterPushes: [], realReds: 0 })).toBe('first push');
  });

  // Catching up with main is not rework of the step, so it has its own kind.
  it('says updates from main only when every later push is a merge', () => {
    expect(kindOf({ laterPushes: ['merge', 'merge'], realReds: 0 })).toBe('updates from main only');
  });

  // A real red run with no new commit after it was re-run or carried through an update.
  it('says red run, no new commit when a run failed but nothing new was pushed', () => {
    expect(kindOf({ laterPushes: [], realReds: 1 })).toBe('red run, no new commit');
    expect(kindOf({ laterPushes: ['merge'], realReds: 2 })).toBe('red run, no new commit');
  });

  // Any later commit is a second round, with or without a red run before it.
  it('says later commits, and adds the red run when there was one', () => {
    expect(kindOf({ laterPushes: ['merge', 'commit'], realReds: 0 })).toBe('later commits');
    expect(kindOf({ laterPushes: ['commit'], realReds: 3 })).toBe('later commits and a red run');
  });

  // A commit this copy of the repository doesn't hold can't be proved a merge, so it counts as a later commit.
  it('treats a commit it cannot read as a later commit', () => {
    expect(kindOf({ laterPushes: ['unknown'], realReds: 0 })).toBe('later commits');
  });
});

describe('which pull requests and runs are counted', () => {
  // Docs-only pull requests and Dependabot's are not builders' steps, so they stay out of the rate.
  it('leaves out docs-only pull requests and Dependabot', () => {
    expect(isLeftOut(pullRequest({ files: [{ path: 'docs/a-note.md' }] }))).toBe(true);
    expect(isLeftOut(pullRequest({ headRefName: 'dependabot/npm_and_yarn/dev-tools-1' }))).toBe(true);
    expect(isLeftOut(pullRequest())).toBe(false);
  });

  // A branch's runs after the merge (or another branch's, or a push to main) are not this pull request's.
  it('takes only the branch\'s pull-request runs up to the merge', () => {
    const runs = [
      run(1, 'aaa', '2026-11-06T10:00:00Z'),
      run(2, 'aaa', '2026-11-06T16:00:00Z'),
      run(3, 'ccc', '2026-11-06T10:30:00Z', 'success', { headBranch: 'm9-other' }),
      run(4, 'ddd', '2026-11-06T10:40:00Z', 'success', { event: 'push' }),
      run(5, 'eee', '2026-11-05T23:00:00Z'),
    ];
    expect(runsOf(pullRequest(), runs).map((r) => r.databaseId)).toEqual([1]);
  });
});

describe('the rows and the totals', () => {
  const commitKind = (sha) => ({ mmm: 'merge', fff: 'commit' })[sha] ?? 'unknown';
  const waitOnly = (id) => id === 21;

  // The whole count on four small pull requests: one clean, one waiting for its label then clean, one updated from
  // main, one fixed after a real red run; a docs one and one with no runs are left out.
  it('sorts each pull request and adds up the runs', () => {
    const pullRequests = [
      pullRequest({ number: 1, headRefName: 'a' }),
      pullRequest({ number: 2, headRefName: 'b' }),
      pullRequest({ number: 3, headRefName: 'c' }),
      pullRequest({ number: 4, headRefName: 'd' }),
      pullRequest({ number: 5, headRefName: 'e', files: [{ path: 'docs/another-note.md' }] }),
      pullRequest({ number: 6, headRefName: 'f' }),
    ];
    const on = (headBranch) => ({ headBranch });
    const runs = [
      run(10, 'a1', '2026-11-06T10:00:00Z', 'success', on('a')),
      run(21, 'b1', '2026-11-06T10:00:00Z', 'failure', on('b')),
      run(22, 'b1', '2026-11-06T11:00:00Z', 'success', on('b')),
      run(30, 'c1', '2026-11-06T10:00:00Z', 'cancelled', on('c')),
      run(31, 'mmm', '2026-11-06T11:00:00Z', 'success', on('c')),
      run(40, 'd1', '2026-11-06T10:00:00Z', 'failure', on('d')),
      run(41, 'fff', '2026-11-06T11:00:00Z', 'success', on('d')),
      run(50, 'e1', '2026-11-06T10:00:00Z', 'success', on('e')),
    ];
    const { rows, noRuns } = rowsFor(pullRequests, runs, commitKind, waitOnly);
    expect(rows.map((row) => [row.number, row.kind])).toEqual([
      [1, 'first push'],
      [2, 'first push'],
      [3, 'updates from main only'],
      [4, 'later commits and a red run'],
    ]);
    expect(noRuns).toBe(1);

    const summary = summarise(rows);
    expect(summary).toMatchObject({ pullRequests: 4, firstPushPercent: 50, runs: 7, runsPerPullRequest: 1.8, realReds: 1, waitReds: 1, cancelled: 1 });
    expect(summary.byKind).toEqual({
      'first push': 2,
      'updates from main only': 1,
      'red run, no new commit': 0,
      'later commits': 0,
      'later commits and a red run': 1,
    });
  });

  // No pull requests in the period gives zeroes, not a division by zero.
  it('gives zeroes for an empty period', () => {
    expect(summarise([])).toMatchObject({ pullRequests: 0, firstPushPercent: 0, runsPerPullRequest: 0 });
  });

  // The table has one line per kind, with the percentage on the first-push line only.
  it('writes the table the health report uses', () => {
    const summary = summarise([{ kind: KINDS[0], runs: 1, realReds: 0, waitReds: 0, cancelled: 0 }]);
    const lines = tableFor(summary, '2026-11-06', '2026-11-10');
    expect(lines[0]).toBe('| | 2026-11-06 to 2026-11-10 (UTC) |');
    expect(lines).toContain('| Merged on the first push | 1 (100%) |');
    expect(lines).toContain('| Updates from main only | 0 |');
    expect(lines).toHaveLength(3 + KINDS.length + 4);
  });
});

describe('the days of a period', () => {
  // Both ends are included, and a month's end rolls over.
  it('lists every day from the first to the last', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(daysBetween('2026-11-06', '2026-11-06')).toEqual(['2026-11-06']);
  });
});

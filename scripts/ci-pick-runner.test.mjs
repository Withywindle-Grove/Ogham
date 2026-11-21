// Tests for scripts/ci-pick-runner.mjs: which machines a workflow run uses under the CI_RUNNER switch (ci-auto-1).
// Purposes, as sentences:
// - Unset (or an unknown value) keeps every run on the PC, and github keeps every run on GitHub, exactly as before.
// - auto keeps a run on the PC while a PC lane is free: 0 or 1 other PC runs with the default two lanes.
// - auto sends a run to GitHub once every lane is taken (2 other PC runs), and marks it as overflow.
// - A run counts once however many of its jobs wait for the PC (check plus three layout shards is one run), only while
//   one of its self-hosted jobs is unfinished, and this run never counts itself.
// - When the runners list can be read, the lanes are the online PC runners, so an offline runner is not a lane.
// - CI_LOCAL_SLOTS defaults to 2 when it is unset or not a whole number of at least 1.
// - When the count can't be read, auto falls back to the PC, so a GitHub hiccup never sends a run to paid minutes.
// - The value is read as the workflows' expressions read it (no trim), and the log names the value actually set.
// - Every workflow job reads pick's answer, and the heavy queue is left only when the heavy jobs run on GitHub's machines.
// - Under auto, check and the picture shards stay on the PC even when the run overflows (ci-pc-pictures, 2026-11-20).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { choose, countPcRuns, heavyTarget, onlineLanes, outputLines, pick, readMode, readSlots } from './ci-pick-runner.mjs';

const job = (status, labels = ['self-hosted', 'grimoire']) => ({ status, labels });

/** A fake API: runs by status, and each run's jobs. */
function fakeApi(runsByStatus, jobsByRun) {
  const calls = [];
  const getJson = async (path) => {
    calls.push(path);
    const runs = path.match(/\/actions\/runs\?status=(\w+)/);
    if (runs) return { workflow_runs: (runsByStatus[runs[1]] ?? []).map((id) => ({ id })) };
    const jobs = path.match(/\/actions\/runs\/(\d+)\/jobs/);
    if (jobs) return { jobs: jobsByRun[jobs[1]] ?? [] };
    throw new Error(`unexpected ${path}`);
  };
  return { getJson, calls };
}

const env = (extra) => ({ GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '100', ...extra });

describe('the switch keeps unset and github as they were', () => {
  it('reads unset, unknown and differently cased values the way GitHub compares them', () => {
    expect(readMode(undefined)).toBe('self');
    expect(readMode('')).toBe('self');
    expect(readMode('pc')).toBe('self');
    expect(readMode('GitHub')).toBe('github');
    expect(readMode('AUTO')).toBe('auto');
    // No trim: the workflows' expressions compare ' auto ' as not auto, so pick reads it as the PC too.
    expect(readMode(' auto ')).toBe('self');
  });

  it('logs the value actually set, so a typo shows', async () => {
    const { getJson } = fakeApi({}, {});
    expect((await pick(env({}), getJson)).note).toBe('CI_RUNNER is unset: the PC.');
    expect((await pick(env({ CI_RUNNER: 'pc' }), getJson)).note).toBe("CI_RUNNER is 'pc' (not github or auto): the PC.");
    expect((await pick(env({ CI_RUNNER: 'gihtub' }), getJson)).note).toBe(
      "CI_RUNNER is 'gihtub' (not github or auto): the PC.",
    );
    expect((await pick(env({ CI_RUNNER: 'github' }), getJson)).note).toBe("CI_RUNNER is 'github': GitHub's machines.");
  });

  it('sends unset to the PC and github to GitHub without reading the API', async () => {
    const { getJson, calls } = fakeApi({}, {});
    expect(outputLines(await pick(env({}), getJson))).toEqual([
      'runs_on=["self-hosted","grimoire"]',
      'target=self',
      'overflow=false',
      'heavy_runs_on=["self-hosted","grimoire"]',
      'heavy_target=self',
    ]);
    expect(outputLines(await pick(env({ CI_RUNNER: 'github' }), getJson))).toEqual([
      'runs_on=["ubuntu-latest"]',
      'target=github',
      'overflow=false',
      'heavy_runs_on=["ubuntu-latest"]',
      'heavy_target=github',
    ]);
    expect(calls).toEqual([]);
  });
});

/** One PC run as the check workflow makes it: changes done, check running, three layout shards queued. */
const pcRun = () => [job('completed'), job('in_progress'), job('queued'), job('queued'), job('queued')];

describe('auto: the PC first, GitHub when every PC lane is taken', () => {
  it('stays on the PC while a lane is free and overflows when every lane is taken', () => {
    expect(choose({ mode: 'auto', pcRuns: 0, lanes: 2 })).toEqual({ target: 'self', overflow: false });
    expect(choose({ mode: 'auto', pcRuns: 1, lanes: 2 })).toEqual({ target: 'self', overflow: false });
    expect(choose({ mode: 'auto', pcRuns: 2, lanes: 2 })).toEqual({ target: 'github', overflow: true });
    expect(choose({ mode: 'auto', pcRuns: 0, lanes: 0 })).toEqual({ target: 'github', overflow: true });
  });

  it("counts other runs with an unfinished self-hosted job, once each, however many jobs they have", () => {
    const runs = [
      { id: 100, jobs: pcRun() }, // this run: never counted
      { id: 200, jobs: pcRun() }, // five jobs, one run
      { id: 300, jobs: [job('completed'), job('queued', ['ubuntu-latest'])] }, // finished on the PC, rest on GitHub
      { id: 400, jobs: [job('pending')] },
    ];
    expect(countPcRuns(runs, '100')).toBe(2);
  });

  for (const [others, target] of [
    [0, 'self'],
    [1, 'self'],
    [2, 'github'],
  ]) {
    it(`with ${others} other PC run(s) and the default two lanes, the run goes to ${target}`, async () => {
      const ids = [200, 300].slice(0, others);
      const { getJson, calls } = fakeApi(
        { in_progress: [100, ...ids] },
        Object.fromEntries(ids.map((id) => [id, pcRun()])),
      );
      const result = await pick(env({ CI_RUNNER: 'auto' }), getJson);
      expect(result).toMatchObject({ target, overflow: target === 'github' });
      expect(result.note).toContain(`${others} other run(s)`);
      expect(result.note).toContain('2 lane(s) from CI_LOCAL_SLOTS');
      // Each active status is listed once, and this run's own jobs aren't fetched.
      expect(calls.filter((c) => c.includes('?status=')).length).toBe(5);
      expect(calls.some((c) => c.includes('/runs/100/jobs'))).toBe(false);
    });
  }

  // ci-pc-pictures (Francis, 2026-11-20: "Yes, PC only"): an overflow run's small jobs go to GitHub, but its check and
  // picture shards stay on the PC; on GitHub a picture shard took 19 to 40 minutes and check 12 to 18.
  it('keeps the heavy jobs (check, picture shards) on the PC under auto, overflow or not', async () => {
    for (const others of [0, 2]) {
      const ids = [200, 300].slice(0, others);
      const { getJson } = fakeApi({ in_progress: ids }, Object.fromEntries(ids.map((id) => [id, pcRun()])));
      const result = await pick(env({ CI_RUNNER: 'auto' }), getJson);
      expect(result.heavy, `${others} other runs`).toBe('self');
      expect(outputLines(result).slice(3)).toEqual(['heavy_runs_on=["self-hosted","grimoire"]', 'heavy_target=self']);
    }
    const busy = fakeApi({ in_progress: [200, 300] }, { 200: pcRun(), 300: pcRun() });
    const overflow = await pick(env({ CI_RUNNER: 'auto' }), busy.getJson);
    expect(outputLines(overflow).slice(0, 3)).toEqual(['runs_on=["ubuntu-latest"]', 'target=github', 'overflow=true']);
    expect(overflow.note).toContain('except check and the picture shards');
    // A failed count falls back to the PC for everything.
    const failing = async () => {
      throw new Error('GitHub answered 500');
    };
    expect(await pick(env({ CI_RUNNER: 'auto' }), failing)).toMatchObject({ target: 'self', heavy: 'self' });
    expect(heavyTarget('github')).toBe('github');
    expect(heavyTarget('auto')).toBe('self');
    expect(heavyTarget('self')).toBe('self');
  });

  it('stays on the PC when a third lane is set and two runs are on it', async () => {
    const { getJson } = fakeApi({ in_progress: [200], queued: [300] }, { 200: pcRun(), 300: pcRun() });
    expect(await pick(env({ CI_RUNNER: 'auto', CI_LOCAL_SLOTS: '3' }), getJson)).toMatchObject({ target: 'self' });
  });

  it('uses the online runners as the lanes when the runners list can be read, so an offline runner is no lane', async () => {
    const runner = (status, name = 'grimoire') => ({ status, labels: [{ name: 'self-hosted' }, { name }] });
    expect(onlineLanes({ runners: [runner('online'), runner('offline'), runner('online', 'other')] })).toBe(1);
    expect(onlineLanes(undefined)).toBe(null);
    const base = fakeApi({ in_progress: [200] }, { 200: pcRun() });
    const withRunners = async (path) =>
      path.includes('/actions/runners') ? { runners: [runner('online'), runner('offline')] } : base.getJson(path);
    const result = await pick(env({ CI_RUNNER: 'auto' }), withRunners);
    expect(result).toMatchObject({ target: 'github', overflow: true });
    expect(result.note).toContain('1 PC runner(s) online');
    // No runner online: the PC is off, so even an empty queue goes to GitHub.
    const allOff = async (path) =>
      path.includes('/actions/runners') ? { runners: [runner('offline'), runner('offline')] } : fakeApi({}, {}).getJson(path);
    expect(await pick(env({ CI_RUNNER: 'auto' }), allOff)).toMatchObject({ target: 'github', overflow: true });
  });

  it('defaults to 2 slots for unset or odd values', () => {
    for (const value of [undefined, '', '0', '-1', '1.5', 'two']) expect(readSlots(value), String(value)).toBe(2);
    expect(readSlots('3')).toBe(3);
  });

  it('falls back to the PC when the API fails', async () => {
    const getJson = async () => {
      throw new Error('GitHub answered 403');
    };
    const result = await pick(env({ CI_RUNNER: 'auto' }), getJson);
    expect(result).toMatchObject({ target: 'self', overflow: false });
    expect(result.note).toContain('403');
  });
});

describe('the workflows read the pick', () => {
  const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../.github/workflows/${name}.yml`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  const PICK_RUNS_ON =
    "${{ (vars.CI_RUNNER == 'github' || vars.CI_RUNNER == 'auto') && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"grimoire\"]') }}";

  it('runs pick on GitHub for github and auto (so it never waits for a busy PC), and on the PC when unset', () => {
    for (const name of ['check', 'preview', 'review', 'changelog-draft']) {
      const text = read(name);
      expect(text, name).toContain(`  pick:\n`);
      expect(text, name).toContain(`runs-on: ${PICK_RUNS_ON}`);
      expect(text, name).toContain('node .pick/scripts/ci-pick-runner.mjs');
      expect(text, name).toContain('actions: read');
    }
  });

  it('fails the pick step when the script fails (pipefail) and announces an overflow run', () => {
    for (const name of ['check', 'preview', 'review', 'changelog-draft']) {
      const text = read(name);
      expect(text, name).toContain(
        '        run: |\n          set -o pipefail\n          node .pick/scripts/ci-pick-runner.mjs | tee -a "$GITHUB_OUTPUT"\n',
      );
      expect(text, name).toContain("      - if: steps.pick.outputs.overflow == 'true'\n");
      expect(text, name).toContain('::notice title=Overflow to GitHub::');
      expect(text, name).toContain('>> "$GITHUB_STEP_SUMMARY"');
    }
  });

  // On the PC a reused folder kept a sparse setting and the next job's full checkout came out almost empty (19 Nov 2026).
  it("the pick job's one-file checkout lives in its own folder, so it never changes the main folder's checkout", () => {
    for (const name of ['check', 'preview', 'review', 'changelog-draft']) {
      const job = read(name).split('\n  pick:\n')[1].split(/\n {2}[a-z][\w-]*:\n/)[0];
      expect(job, name).toContain(
        '      - uses: actions/checkout@v7\n        with:\n          path: .pick\n          sparse-checkout: scripts/ci-pick-runner.mjs\n',
      );
    }
  });

  // Each mode's group is evaluated in ci-jobs.test.mjs ("the heavy queue follows pick's decision").
  it("keys the heavy one-at-a-time queue on pick's heavy target, not on the variable", () => {
    const check = read('check');
    const heavy = [...check.matchAll(/heavy-one-at-a-time/g)].length;
    expect(heavy).toBe(2);
    expect([...check.matchAll(/needs\.pick\.outputs\.heavy_target != 'github' && /g)].length).toBe(2);
    expect(check).toContain('heavy_runs_on: ${{ steps.pick.outputs.heavy_runs_on }}');
    expect(check).toContain('heavy_target: ${{ steps.pick.outputs.heavy_target }}');
    expect(check).not.toMatch(/group: .*vars\.CI_RUNNER/);
  });
});

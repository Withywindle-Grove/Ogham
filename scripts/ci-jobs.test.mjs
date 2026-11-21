// Tests for scripts/ci-jobs.mjs: what each job of the GitHub check does on a run (the picture check waits for the
// "ready" label; adding a label doesn't redo checks that already passed for the same commit).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFER_BY_DAY, inputFromEnv, planJobs } from './ci-jobs.mjs';
import { choose, heavyTarget, readMode } from './ci-pick-runner.mjs';

const script = fileURLToPath(new URL('./ci-jobs.mjs', import.meta.url));
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/check.yml', import.meta.url)), 'utf8')
  // A Windows checkout has CRLF line endings; CI's has LF. Read both the same.
  .replace(/\r\n/g, '\n');

const screenChange = { kind: 'code', screens: true, database: true };
const DEFERRED_NOTE = 'Deferred to the night run (cq-3): the local check covers this by day.';
const DEFERRED_LAYOUT_NOTE = 'Deferred to the night run (cq-3): the pictures and browser checks run at 07:00 UTC.';

// The day plan with the cq-3 switch off, which is the default since rvw-6. The label tests below use it explicitly,
// so the ready label's wait and reuse stay tested whatever the switch is set to.
const switchedOff = (input) => planJobs({ ...input, defer: false });

// cq-3 (ruled 2026-11-13; docs/design/rulings/process-ci-by-day-2026-11-13.md): database only by day, one full run
// each night; the switch is off since rvw-6, so these tests pass defer: true to keep the deferred plan covered.
describe('by day, database only; the night run does everything (cq-3)', () => {
  // By day the full checks run (rvw-6).
  it('ships with the switch off', () => {
    expect(DEFER_BY_DAY).toBe(false);
  });

  // A push to a pull request defers check and layout and runs database, with or without the ready label.
  it('defers check and layout on a pull request push and runs database', () => {
    for (const labels of [[], ['ready']]) {
      expect(planJobs({ event: 'pull_request', action: 'synchronize', labels, ...screenChange, defer: true }), labels.join()).toEqual({
        check: 'deferred',
        database: 'run',
        layout: 'deferred',
      });
    }
  });

  // The ready label stops mattering for layout while deferral is on: no wait, and adding it changes nothing.
  it('never makes layout wait for the ready label, and adding a label still reuses a passed database', () => {
    expect(
      planJobs({ event: 'pull_request', action: 'labeled', labels: ['ready'], ...screenChange, passed: ['check', 'database'], defer: true }),
    ).toEqual({ check: 'deferred', database: 'reuse', layout: 'deferred' });
  });

  // Main's run after a merge gives the same answer: database runs, check and layout wait for the night.
  it("defers check and layout on main's push and runs database", () => {
    expect(planJobs({ event: 'push', ...screenChange, defer: true })).toEqual({ check: 'deferred', database: 'run', layout: 'deferred' });
  });

  // What doesn't change: a docs-only change keeps its fast path (the docs check runs), and a change with no screen
  // file or no database reach still skips those, exactly as before.
  it('leaves the docs-only fast path and the skips unchanged', () => {
    for (const event of ['pull_request', 'push']) {
      expect(planJobs({ event, action: 'synchronize', kind: 'docs', screens: true, database: true, defer: true }), event).toEqual({
        check: 'run',
        database: 'skip',
        layout: 'skip',
      });
    }
    expect(planJobs({ event: 'push', kind: 'code', screens: false, database: false, defer: true })).toEqual({
      check: 'deferred',
      database: 'skip',
      layout: 'skip',
    });
  });

  // The night run (schedule) is like a run by hand: no pull request, no action, no labels, everything changed, so
  // everything runs, and an earlier pass is never trusted.
  it('runs everything on the night run', () => {
    expect(planJobs({ event: 'schedule', ...screenChange, passed: ['check', 'database', 'layout'] })).toEqual({
      check: 'run',
      database: 'run',
      layout: 'run',
    });
    for (const LABELS of ['null', '[]']) {
      const env = { EVENT: 'schedule', ACTION: '', LABELS, KIND: 'code', SCREENS: 'true', DATABASE: 'true' };
      expect(planJobs(inputFromEnv(env)), LABELS).toEqual({ check: 'run', database: 'run', layout: 'run' });
    }
  });

  // The full run by hand (2026-11-09) is untouched by the switch: it still runs everything.
  it('still runs everything on a run by hand', () => {
    expect(planJobs({ event: 'workflow_dispatch', ...screenChange })).toEqual({ check: 'run', database: 'run', layout: 'run' });
  });

  // An empty or odd kind isn't deferred: unexpected values stay on the safe side and run the work.
  it("doesn't defer when the kind of change is unknown", () => {
    expect(planJobs({ event: 'pull_request', action: 'synchronize', labels: [] }).check).toBe('run');
  });

  // With the switch off, today's behaviour returns: check runs and layout waits for the ready label; on main the
  // pictures wait for the night run (2026-11-19).
  it("brings back today's behaviour, the label wait included, when the switch is off", () => {
    expect(switchedOff({ event: 'pull_request', action: 'synchronize', labels: [], ...screenChange })).toEqual({
      check: 'run',
      database: 'run',
      layout: 'wait',
    });
    expect(switchedOff({ event: 'push', ...screenChange })).toEqual({ check: 'run', database: 'run', layout: 'night' });
  });

  // The workflow starts the night run at 07:00 UTC and reads it as "everything changed", like a run by hand.
  it('has the night run at 0 7 * * *, read as everything changed', () => {
    expect(workflow).toMatch(/\n {2}schedule:\n {4}- cron: '0 7 \* \* \*'\n/);
    expect(workflow).toContain('elif [ "$GITHUB_EVENT_NAME" = "schedule" ]; then\n            files=""');
  });

  // The night run never deploys and is never triaged; its own concurrency group keeps a run on the same commit
  // (main's push run, or a run by hand) from pushing it out of the line.
  it('never deploys or triages the night run, and gives it a group of its own', () => {
    const deploy = workflow.slice(workflow.indexOf('  deploy-production:'));
    expect(deploy).toMatch(/always\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
    expect(workflow).toMatch(/failure\(\) && github\.event_name == 'pull_request'/);
    expect(workflow).toContain(
      "group: check-${{ github.event.pull_request.number || (github.event_name == 'push' && 'main') || github.sha }}${{ github.event_name == 'schedule' && '-night' || '' }}",
    );
  });

  // A deferred check or layout reports success with the note, does none of the work, and doesn't join the heavy queue.
  it('prints the note on the deferred paths and does no work there', () => {
    const job = (name, next) => workflow.slice(workflow.indexOf(`\n  ${name}:\n`), workflow.indexOf(`\n  ${next}:\n`));
    const check = job('check', 'database-shard');
    expect(check).toContain(`deferred) echo "${DEFERRED_NOTE}"`);
    // Every working step runs only on "run"; none is left keyed on "not reuse", which would run a deferred check.
    expect(check).not.toContain("env.PLAN != 'reuse'");
    expect([...check.matchAll(/- if: (.+)$/gm)].map((m) => m[1]).every((c) => c.startsWith("env.PLAN == 'run'"))).toBe(true);
    expect(check).toContain("needs.changes.outputs.check_plan == 'run' && 'heavy-one-at-a-time'");
    expect(check).toContain("needs.pick.outputs.heavy_target != 'github' && needs.changes.outputs.kind == 'code'");
    expect(job('layout', 'triage')).toContain(`deferred) echo "${DEFERRED_LAYOUT_NOTE}"`);
    // The shards run only on "run", so a deferred layout starts none.
    expect(workflow).toMatch(/\n {2}layout-shard:\n {4}needs: \[pick, changes\]\n {4}if: needs\.changes\.outputs\.layout_plan == 'run'/);
  });

  // Since check's work runs only on "run", an unknown or empty plan must turn check red, not green with no work.
  it('fails check on an unknown plan', () => {
    const check = workflow.slice(workflow.indexOf('\n  check:\n'), workflow.indexOf('\n  database-shard:\n'));
    expect(check).toMatch(
      /\n {12}\*\)\n {14}echo "::error::Unknown check plan '\$PLAN' from the changes job\."\n {14}exit 1 ;;\n {10}esac\n/,
    );
  });

  // The command line prints the plan for $GITHUB_OUTPUT, so the jobs above see it: check and database run by day
  // since rvw-6, and main's pictures wait for the night run (2026-11-19).
  it('prints the day plan as key=value lines', () => {
    const out = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, EVENT: 'push', ACTION: '', LABELS: 'null', KIND: 'code', SCREENS: 'true', DATABASE: 'true', PASSED: '' },
    });
    expect(out.trim().split(/\r?\n/)).toEqual(
      DEFER_BY_DAY
        ? ['check_plan=deferred', 'database_plan=run', 'layout_plan=deferred']
        : ['check_plan=run', 'database_plan=run', 'layout_plan=night'],
    );
  });
});

describe('a push to a pull request (opened, synchronize, reopened), with the cq-3 switch off', () => {
  // Without the ready label, a change that can affect pictures makes layout wait (fail fast) instead of running.
  it('makes layout wait when pictures could change and the ready label is missing', () => {
    expect(switchedOff({ event: 'pull_request', action: 'synchronize', labels: [], ...screenChange })).toEqual({
      check: 'run',
      database: 'run',
      layout: 'wait',
    });
  });

  // With the ready label already on, every push after it is checked in full, pictures included.
  it('runs layout on a push while the ready label is on', () => {
    expect(switchedOff({ event: 'pull_request', action: 'synchronize', labels: ['ready'], ...screenChange }).layout).toBe('run');
  });

  // Changes that can't affect pictures (docs-only, or code without screen files) still pass layout without the label.
  it('skips layout without the label when no screen file changed', () => {
    expect(switchedOff({ event: 'pull_request', action: 'opened', kind: 'docs', screens: true, database: true })).toEqual({
      check: 'run',
      database: 'skip',
      layout: 'skip',
    });
    expect(switchedOff({ event: 'pull_request', action: 'opened', kind: 'code', screens: false, database: true }).layout).toBe('skip');
  });

  // A push never reuses an earlier result, even if the API listed passes (only adding a label can).
  it('never reuses earlier passes on a push', () => {
    const plan = switchedOff({
      event: 'pull_request',
      action: 'synchronize',
      labels: ['ready'],
      ...screenChange,
      passed: ['check', 'database', 'layout'],
    });
    expect(plan).toEqual({ check: 'run', database: 'run', layout: 'run' });
  });
});

describe('adding a label, with the cq-3 switch off', () => {
  // Adding ready after check and database passed for this commit runs only layout.
  it('reuses check and database and runs layout when ready is added', () => {
    expect(
      switchedOff({ event: 'pull_request', action: 'labeled', labels: ['ready'], ...screenChange, passed: ['check', 'database'] }),
    ).toEqual({ check: 'reuse', database: 'reuse', layout: 'run' });
  });

  // If the earlier run never finished (cancelled) or failed, adding the label does the work again rather than trust it.
  it('runs check and database again when they have not passed for this commit', () => {
    expect(switchedOff({ event: 'pull_request', action: 'labeled', labels: ['ready'], ...screenChange, passed: [] })).toEqual({
      check: 'run',
      database: 'run',
      layout: 'run',
    });
  });

  // Another label (say preview) added after layout passed doesn't redo the pictures.
  it('reuses a passed layout when another label is added', () => {
    expect(
      switchedOff({
        event: 'pull_request',
        action: 'labeled',
        labels: ['ready', 'preview'],
        ...screenChange,
        passed: ['check', 'database', 'layout'],
      }),
    ).toEqual({ check: 'reuse', database: 'reuse', layout: 'reuse' });
  });

  // Another label added before ready leaves layout waiting: it must not turn the picture check green.
  it('keeps layout waiting when a label other than ready is added', () => {
    expect(
      switchedOff({ event: 'pull_request', action: 'labeled', labels: ['preview'], ...screenChange, passed: ['check', 'database'] })
        .layout,
    ).toBe('wait');
  });
});

// Francis, 2026-11-19: "a nightly picture check sounds best can you implement that?" A merge to main runs check and
// database; its pictures are checked by the night run (07:00 UTC) instead of after each merge.
describe('a push to main, with the cq-3 switch off', () => {
  // A merge that could change a screen runs check and database, and leaves layout to the night run (plan "night"),
  // whatever labels or earlier passes are passed in.
  it('runs check and database and leaves the pictures to the night run when screens changed', () => {
    for (const labels of [[], ['ready']]) {
      expect(switchedOff({ event: 'push', labels, ...screenChange, passed: ['check', 'layout'] }), labels.join()).toEqual({
        check: 'run',
        database: 'run',
        layout: 'night',
      });
    }
  });

  // A merge that changes no screen file still skips layout, as before.
  it('skips layout when no screen file changed', () => {
    expect(switchedOff({ event: 'push', kind: 'code', screens: false, database: false }).layout).toBe('skip');
  });

  // The night run and a run by hand on main still run the full picture check: only the push waits.
  it('still runs the pictures on the night run and on a run by hand', () => {
    for (const event of ['schedule', 'workflow_dispatch']) {
      expect(switchedOff({ event, ...screenChange }).layout, event).toBe('run');
    }
  });

  // A pull request is unchanged: without the ready label layout waits; with it layout runs.
  it('leaves the pull request rule as it was', () => {
    expect(switchedOff({ event: 'pull_request', action: 'synchronize', labels: [], ...screenChange }).layout).toBe('wait');
    expect(switchedOff({ event: 'pull_request', action: 'synchronize', labels: ['ready'], ...screenChange }).layout).toBe('run');
  });

  // The workflow reads "night" as success with a note, starts no layout shard on it, and keeps failing an unknown plan.
  it('turns layout green with a note on "night" and starts no shard', () => {
    const layout = workflow.slice(workflow.indexOf('\n  layout:\n'), workflow.indexOf('\n  triage:\n'));
    const night = layout.match(/\n {12}night\) ([^\n]*)\n/);
    expect(night?.[1]).toBe(
      `echo "Main's pictures are checked by the night run (07:00 UTC), not after each merge." | tee -a "$GITHUB_STEP_SUMMARY" ;;`,
    );
    expect(layout).toContain(`echo "::error::Unknown layout plan '$PLAN' from the changes job."`);
    expect(workflow).toMatch(/\n {2}layout-shard:\n {4}needs: \[pick, changes\]\n {4}if: needs\.changes\.outputs\.layout_plan == 'run'\n/);
  });

  // Going live no longer waits for layout on a merge: deploy needs check and database only, so a layout job that
  // is skipped, still running or red can't hold it back or turn it off.
  it('deploys on check and database alone, never waiting for layout', () => {
    const deploy = workflow.slice(workflow.indexOf('\n  deploy-production:\n'));
    expect(deploy).toMatch(/\n {4}needs: \[pick, check, database\]\n/);
    expect(deploy).not.toContain('needs.layout');
    expect(deploy).toMatch(/needs\.check\.result == 'success' && needs\.database\.result == 'success'\n/);
  });
});

describe('a run started by hand (the full regression run)', () => {
  // Francis can re-check the whole app at any time (ruled 2026-11-09): every job does its work, with no label, and
  // an earlier pass for the same commit is never trusted.
  it('runs check, database and layout, and never reuses an earlier pass', () => {
    expect(planJobs({ event: 'workflow_dispatch', ...screenChange, passed: ['check', 'database', 'layout'] })).toEqual({
      check: 'run',
      database: 'run',
      layout: 'run',
    });
  });

  // What the workflow passes on such a run: no action, and no pull request, so its labels come out as null or as an
  // empty list. Either way the answer is the same.
  it('reads the values a run started by hand passes', () => {
    for (const LABELS of ['null', '[]']) {
      const env = { EVENT: 'workflow_dispatch', ACTION: '', LABELS, KIND: 'code', SCREENS: 'true', DATABASE: 'true' };
      expect(planJobs(inputFromEnv(env)), LABELS).toEqual({ check: 'run', database: 'run', layout: 'run' });
    }
  });
});

describe('the command line the workflow calls', () => {
  // Odd or missing values fall on the safe side: the work runs (and layout waits on a pull request).
  it('treats empty values as "run everything"', () => {
    expect(planJobs(inputFromEnv({ EVENT: 'pull_request', ACTION: 'labeled' }))).toEqual({
      check: 'run',
      database: 'run',
      layout: 'wait',
    });
  });

  // The workflow passes the labels as a JSON list (toJSON); one per line works too.
  it('reads the labels as a JSON list or one per line', () => {
    expect(inputFromEnv({ LABELS: '["preview","ready"]' }).labels).toEqual(['preview', 'ready']);
    expect(inputFromEnv({ LABELS: '[]' }).labels).toEqual([]);
    expect(inputFromEnv({ LABELS: 'preview\nready\n' }).labels).toEqual(['preview', 'ready']);
  });

  // The passes come one per line, Windows or Unix endings alike (the command line's own test below can't show the
  // reuse while the cq-3 switch defers check).
  it('reads the passes one per line', () => {
    expect(inputFromEnv({ PASSED: 'check\r\ndatabase shard 1/3\n' }).passed).toEqual(['check', 'database shard 1/3']);
  });

  // It prints one key=value line per job, the shape $GITHUB_OUTPUT takes, reading the passes one per line.
  it('prints the plan as key=value lines', () => {
    const out = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        EVENT: 'pull_request',
        ACTION: 'labeled',
        LABELS: '["preview","ready"]',
        KIND: 'code',
        SCREENS: 'true',
        DATABASE: 'false',
        PASSED: 'check\r\ndatabase shard 1/3\n',
      },
    });
    // While the cq-3 switch is on, check and layout come out deferred; switched off, the passes are reused as before.
    expect(out.trim().split(/\r?\n/)).toEqual(
      DEFER_BY_DAY
        ? ['check_plan=deferred', 'database_plan=skip', 'layout_plan=deferred']
        : ['check_plan=reuse', 'database_plan=skip', 'layout_plan=run'],
    );
  });
});

describe('the workflow uses the plan', () => {
  // Adding a label starts a run, and the layout job carries the message that tells people what to do.
  it('runs on labeled and fails layout with the ready message while waiting', () => {
    expect(workflow).toMatch(/types: \[opened, synchronize, reopened, labeled\]/);
    expect(workflow).toContain('Pictures not checked yet: add the ready label when this pull request is finished.');
    expect(workflow).toContain('node scripts/ci-jobs.mjs');
  });

  // Docs-only pull requests never take the ready label: their "docs" answer still comes from scripts/docs-only.mjs,
  // and that answer makes layout skip (green) rather than wait.
  it('decides docs-only with scripts/docs-only.mjs, so docs-only changes merge without the label', () => {
    expect(workflow).toContain('node scripts/docs-only.mjs');
    expect(planJobs({ event: 'pull_request', action: 'synchronize', labels: [], kind: 'docs', screens: true }).layout).toBe('skip');
  });

  // The three required jobs run even if the changes job fails, so a broken plan can't show up as a skipped (green) check.
  it('keeps the required jobs from being skipped when the changes job fails', () => {
    expect(workflow).toMatch(/\n {2}check:\n {4}needs: \[pick, changes\]\n {4}if: \$\{\{ !cancelled\(\) \}\}/);
    expect(workflow).toMatch(/\n {2}layout:\n {4}needs: \[pick, changes, layout-shard\]\n {4}if: \$\{\{ !cancelled\(\) \}\}/);
  });

  // The picture check runs in three shards (2026-11-05); the job named exactly "layout" stays the required check and
  // passes only when the plan says skip or reuse, or all three shards passed.
  it('runs layout in three shards and sums them up in the required layout job', () => {
    expect(workflow).toMatch(/\n {2}layout-shard:\n {4}needs: \[pick, changes\]\n {4}if: needs\.changes\.outputs\.layout_plan == 'run'/);
    expect(workflow).toContain('name: layout shard ${{ matrix.shard }}/3');
    expect(workflow).toContain('shard: [1, 2, 3]');
    expect(workflow).toContain('npm run test:layout -- --update-snapshots=missing --shard=${{ matrix.shard }}/3');
    expect(workflow).toContain('SHARDS: ${{ needs.layout-shard.result }}');
    expect(workflow).toContain("A layout shard didn't pass");
  });

  // Francis, 2026-11-13 ("A", cq-1; widened by the lead, cq-1a): one heavy job runs on the PC at a time, across every
  // run: check and the three layout shards share one queue that waits rather than cancels (queue: max; the default
  // queue keeps one waiting job and cancels the rest). Database runs beside, outside the queue.
  // Francis, 2026-11-18: on GitHub's machines the queue is off; check and each shard run at once. The group follows
  // pick's heavy_target, so CI_RUNNER github leaves the queue; an auto run sent to GitHub (overflow) keeps its heavy
  // jobs on the PC and in the queue (ci-pc-pictures, 2026-11-20).
  it('runs check and the layout shards one at a time on the PC, the rest waiting in line rather than cancelled', () => {
    const queue = /\n {4}concurrency:\n {6}group: \$\{\{ needs\.pick\.outputs\.heavy_target != 'github' && 'heavy-one-at-a-time' \|\| format\('light-\{0\}-\{1\}-shard-\{2\}', github\.run_id, github\.run_attempt, matrix\.shard\) \}\}\n {6}cancel-in-progress: false\n {6}queue: max\n/;
    const job = (name, next) => workflow.slice(workflow.indexOf(`\n  ${name}:\n`), workflow.indexOf(`\n  ${next}:\n`));
    expect(job('layout-shard', 'layout')).toMatch(queue);
    // check joins the queue only when it runs the code's tests; a docs-only or reused check runs at once.
    expect(job('check', 'database-shard')).toMatch(
      /\n {4}concurrency:\n {6}group: \$\{\{ needs\.pick\.outputs\.heavy_target != 'github' && needs\.changes\.outputs\.kind == 'code' && needs\.changes\.outputs\.check_plan == 'run' && 'heavy-one-at-a-time' \|\| format\('light-\{0\}-\{1\}', github\.run_id, github\.run_attempt\) \}\}\n {6}cancel-in-progress: false\n {6}queue: max\n/,
    );
    expect(job('database-shard', 'database')).not.toContain('heavy-one-at-a-time');
  });

  // upload-artifact refuses a name used twice in one run, so each shard's pictures have their own name; the
  // screenshots are kept on green runs too, for Design's review after merge.
  it("keeps each shard's pictures and screenshots under its own name, on every run", () => {
    expect(workflow).toContain('name: gallery-baselines-${{ matrix.shard }}');
    expect(workflow).toContain('name: layout-screens-${{ matrix.shard }}');
    expect(workflow).toMatch(/- name: Keep the screenshots\n {8}if: always\(\)\n/);
    expect(workflow).not.toContain('Keep the screenshots when a check fails');
  });

  // A full artifact store (2026-11-09) must not turn a run red; the run says so instead, so nobody approves missing pictures.
  it('keeps the pictures without failing the run, and says when they were not kept', () => {
    expect(workflow).toMatch(/- name: Keep the gallery pictures\n {8}if: always\(\)\n {8}id: keep_gallery\n(.*\n)? {8}continue-on-error: true\n/);
    expect(workflow).toMatch(/- name: Keep the screenshots\n {8}if: always\(\)\n {8}id: keep_screens\n(.*\n)? {8}continue-on-error: true\n/);
    expect(workflow).toContain("steps.keep_gallery.outcome == 'failure' || steps.keep_screens.outcome == 'failure'");
    expect(workflow).toContain('Pictures not uploaded: storage quota');
  });

  // A merge with no database change skips the database shards; the deploy must still run when everything it
  // needs passed (2026-11-09: #574 merged green and never went live).
  // Since 2026-11-19 layout is no longer one of them (main's pictures wait for the night run).
  it('deploys a green merge even when the database shards were skipped', () => {
    const deploy = workflow.slice(workflow.indexOf('  deploy-production:'));
    expect(deploy).toMatch(/if: >-\n\s+always\(\) && github\.event_name == 'push'/);
    for (const job of ['check', 'database']) expect(deploy).toContain(`needs.${job}.result == 'success'`);
  });

  // The production deploy checks that its commit is still main's head, before the build and again just before
  // deploying, and skips otherwise (2026-11-19: runs finish out of order, and an older merge's run put its older
  // version live after a newer one's).
  it("deploys only while its commit is still main's head, checked before the build and again just before deploying", () => {
    const deploy = workflow.slice(workflow.indexOf('  deploy-production:'));
    const steps = deploy.split('\n      - ').slice(1);
    const at = (text) => steps.findIndex((step) => step.includes(text));
    const idOf = (step) => step.match(/\n {8}id: (\S+)\n/)?.[1];
    // A head check reads main's newest commit from GitHub with the job's own token and compares it with this run's.
    const isHeadCheck = (step) =>
      step.includes('GH_TOKEN: ${{ github.token }}') &&
      step.includes('gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$GITHUB_REF_NAME"') &&
      step.includes('[ "$head" = "$GITHUB_SHA" ]') &&
      step.includes('echo "current=true" >> "$GITHUB_OUTPUT"') &&
      step.includes(`echo "Not deployed: main has moved on to $head; that commit's own run deploys it." >> "$GITHUB_STEP_SUMMARY"`);
    const checks = steps.flatMap((step, i) => (isHeadCheck(step) ? [i] : []));
    expect(checks).toHaveLength(2);
    const [beforeBuild, beforeDeploy] = checks;
    // The first comes before anything is fetched or built; the second right before the deploy, after the build.
    expect(beforeBuild).toBe(0);
    expect(beforeDeploy).toBeGreaterThan(at('npm run build'));
    expect(beforeDeploy).toBe(at('vercel@62.5.0 deploy --prebuilt --prod') - 1);
    // Every later step runs only while the commit is still the head; a skip is a success, not a failure.
    const first = idOf(steps[beforeBuild]);
    const second = idOf(steps[beforeDeploy]);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    for (const step of steps.slice(1, beforeDeploy + 1)) expect(step).toContain(`if: steps.${first}.outputs.current == 'true'`);
    expect(steps[beforeDeploy + 1]).toContain(`if: steps.${second}.outputs.current == 'true'`);
    for (const step of checks.map((i) => steps[i])) expect(step).not.toMatch(/Not deployed[^\n]*\n[^\n]*exit 1/);
  });

  // On main only the newest commit's run goes on: main's push runs share one group that drops the older ones still
  // queued or running, and the newest run lists every file changed since the last main commit whose run went green
  // (an empty list, which runs everything, when that can't be found), so nothing a dropped run would have checked is
  // skipped (2026-11-19, Francis: "Yes, add it").
  it('on main, runs only the newest commit and checks everything changed since the last green main run', () => {
    // One group for every push to main, cancelling; pull requests, the night run and runs by hand keep theirs.
    expect(workflow).toContain(
      "group: check-${{ github.event.pull_request.number || (github.event_name == 'push' && 'main') || github.sha }}${{ github.event_name == 'schedule' && '-night' || '' }}",
    );
    expect(workflow).toContain(
      "cancel-in-progress: ${{ github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'labeled') }}",
    );
    const changes = workflow.slice(workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  check:\n'));
    // Reading main's earlier runs needs actions: read.
    expect(changes).toMatch(/\n {4}permissions:\n {6}contents: read\n {6}checks: read\n {6}actions: read\n/);
    // On a push, the base is the newest green push run of this workflow on main, fetched, and the list runs from it.
    const push = changes.slice(changes.indexOf('elif [ "$GITHUB_EVENT_NAME" = "push" ]; then'));
    expect(push.length).toBeLessThan(changes.length);
    expect(push).toContain(
      'gh api "repos/$GITHUB_REPOSITORY/actions/workflows/check.yml/runs?branch=main&event=push&status=success&per_page=1"',
    );
    expect(push).toContain('git fetch --no-tags --depth=1 origin "$base"');
    expect(push).toContain('files=$(git diff --name-only --no-renames "$base" HEAD)');
    expect(push).toContain('since="$base"');
    // When no green run is found, or the fetch or the list fails, the list stays empty: everything runs.
    expect(push).toMatch(/else\n\s+files=""\n\s+echo "No green main run found: everything runs\."/);
    // The package.json scripts-only test compares with the same base.
    expect(changes).toContain('node scripts/package-scripts-only.mjs "$since"');
    // A pull request still lists only what its merge brings in.
    expect(changes).toContain('since=HEAD^1');
    expect(changes).toContain('files=$(git diff --name-only --no-renames HEAD^1 HEAD)');
    // The step's gh call has the job's token.
    expect(changes).toMatch(/- id: what\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/);
  });

  // The full regression run (2026-11-09): the workflow can be started by hand, and such a run lists no changed
  // files before anything is decided, which the lines after it read as "everything changed".
  it('can be started by hand, and then treats everything as changed', () => {
    expect(workflow).toMatch(/\n {2}workflow_dispatch:\n/);
    const byHand = workflow.indexOf('if [ "$GITHUB_EVENT_NAME" = "workflow_dispatch" ]; then\n            files=""');
    expect(byHand).toBeGreaterThan(-1);
    expect(byHand).toBeLessThan(workflow.indexOf('node scripts/docs-only.mjs'));
    // An empty list counts as a screen change and a database change only because both conditions start with the
    // empty-list guard: without it, layout would be skipped on a run started by hand and still report green.
    expect(workflow).toContain(`if [ -z "$files" ] || echo "$screen_files" | grep -qE '^(src/`);
    expect(workflow).toContain(`if [ -z "$files" ] || echo "$files" | grep -qvE '^(docs/`);
  });

  // A run started by hand never goes live and asks for no triage: each of those jobs names the one event it runs on.
  it('never deploys or triages a run started by hand', () => {
    const deploy = workflow.slice(workflow.indexOf('  deploy-production:'));
    expect(deploy).toMatch(/always\(\) && github\.event_name == 'push'/);
    expect(deploy).not.toContain('workflow_dispatch');
    expect(workflow).toMatch(/failure\(\) && github\.event_name == 'pull_request'/);
  });

  // The layout shards run in Playwright's ready-made image (2026-11-06): its version must be exactly the installed
  // @playwright/test, or the browser it carries isn't the one the tests look for; and it's the Ubuntu 24.04 (noble)
  // build, like ubuntu-latest, and nothing is installed through apt any more.
  it("runs the layout shards in the Playwright image of exactly the locked version, with no apt install", () => {
    const lock = JSON.parse(readFileSync(fileURLToPath(new URL('../package-lock.json', import.meta.url)), 'utf8'));
    const version = lock.packages['node_modules/@playwright/test'].version;
    const images = [...workflow.matchAll(/image: mcr\.microsoft\.com\/playwright:v([^\s-]+)-(\w+)/g)];
    expect(images.map(([, v, base]) => `${v}-${base}`)).toEqual([`${version}-noble`]);
    expect(workflow).not.toContain('install-deps');
    expect(workflow).not.toContain('playwright install');
  });
});

// The self-hosted runner (docs/plans/ci-self-hosted-runner.md): every job in every workflow runs on Francis's PC
// unless the repository variable CI_RUNNER is "github", the one-switch way back to GitHub's runners, or "auto" with
// the PC busy (ci-auto-1). Each workflow's pick job reads the switch and every other job reads pick's answer. The database
// shards are the exception (cq-4): they run on GitHub's machines unless DB_RUNNER is "self", which sends them to the
// PC's "db" runner, so their local Supabases (fixed ports) never run side by side there.
describe('which machine runs the jobs', () => {
  const PICK_SWITCH =
    "${{ (vars.CI_RUNNER == 'github' || vars.CI_RUNNER == 'auto') && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"grimoire\"]') }}";
  const SWITCH = '${{ fromJSON(needs.pick.outputs.runs_on) }}';
  const HEAVY_SWITCH = '${{ fromJSON(needs.pick.outputs.heavy_runs_on) }}';
  const DB_SWITCH =
    "${{ vars.DB_RUNNER == 'self' && needs.pick.outputs.target == 'self' && fromJSON('[\"self-hosted\",\"grimoire\",\"db\"]') || 'ubuntu-latest' }}";

  // Purpose: the database shards default to GitHub's machines (cq-4): the PC's "db" runner is named only behind
  // DB_RUNNER == 'self', and a run pick sends to GitHub (CI_RUNNER github, or auto with the PC busy) sends them there too.
  it('runs the database shards on GitHub by default, and on the PC only when DB_RUNNER is "self"', () => {
    const shards = read('check').slice(read('check').indexOf('\n  database-shard:\n'), read('check').indexOf('\n  database:\n'));
    expect(shards).toContain(`runs-on: ${DB_SWITCH}`);
  });
  const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../.github/workflows/${name}.yml`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

  it('sends every job through the switch, and only the database shards to the db runner', () => {
    for (const name of ['check', 'preview', 'review', 'changelog-draft']) {
      const runsOn = [...read(name).matchAll(/^\s+runs-on: (.+)$/gm)].map((m) => m[1]);
      expect(runsOn.length, name).toBeGreaterThan(0);
      for (const value of runsOn) expect([PICK_SWITCH, SWITCH, DB_SWITCH, HEAVY_SWITCH], `${name}: ${value}`).toContain(value);
      expect(runsOn.filter((v) => v === DB_SWITCH).length, name).toBe(name === 'check' ? 1 : 0);
      expect(runsOn.filter((v) => v === PICK_SWITCH).length, name).toBe(1);
    }
  });

  // Purpose (ci-pc-pictures, Francis 2026-11-20: "Yes, PC only"): check and the layout shards read pick's heavy answer,
  // which keeps them on the PC under auto even when the run overflows; nothing else reads it.
  it('runs check and the layout shards, and only those, on the heavy switch', () => {
    const check = read('check');
    const jobOf = (name) => check.slice(check.indexOf(`\n  ${name}:\n`)).split(/\n {2}[a-z][\w-]*:\n/)[1];
    expect(jobOf('check')).toContain(`runs-on: ${HEAVY_SWITCH}`);
    expect(jobOf('layout-shard')).toContain(`runs-on: ${HEAVY_SWITCH}`);
    const runsOn = [...check.matchAll(/^\s+runs-on: (.+)$/gm)].map((m) => m[1]);
    expect(runsOn.filter((v) => v === HEAVY_SWITCH).length).toBe(2);
    for (const name of ['preview', 'review', 'changelog-draft']) expect(read(name), name).not.toContain('heavy_runs_on');
  });

  it('stops a Supabase a crashed run left behind before starting one', () => {
    expect(workflow.indexOf('npx supabase stop --no-backup || true')).toBeGreaterThan(-1);
    expect(workflow.indexOf('npx supabase stop --no-backup || true')).toBeLessThan(workflow.indexOf('npx supabase start'));
  });

  // A label that isn't "review" (ready, preview) must not cancel a review that is running. Such a label also starts
  // the Review workflow, and its run then skips. In the review's own group it cancelled the review first: 16 of the
  // last 40 review runs were cancelled and 4 finished (found 2026-11-10). A run that will skip gets a group of its own.
  it("doesn't let a label other than review cancel a running review", () => {
    const review = read('review');
    const reviews = "(github.event.action != 'labeled' || github.event.label.name == 'review')";
    // The group's name ends in "run" for an event that reviews and in "skip" for a label that doesn't.
    expect(review).toContain(`group: review-\${{ github.event.pull_request.number }}-\${{ ${reviews} && 'run' || 'skip' }}`);
    expect(review).toMatch(/\n {2}cancel-in-progress: true\n/);
    // The job skips on such a label by the very same condition, so the group and the job can't drift apart.
    expect(review).toContain(`github.actor != 'dependabot[bot]' && ${reviews}`);
  });
});

// The automatic review (review.yml) may fail without turning its run red, so a review that didn't happen has to say
// so on the pull request itself (2026-11-10: the credit ran out and four days of reviews failed unseen).
describe('the automatic review says when it did not run', () => {
  const review = readFileSync(fileURLToPath(new URL('../.github/workflows/review.yml', import.meta.url)), 'utf8')
    // A Windows checkout has CRLF line endings; CI's has LF. Read both the same.
    .replace(/\r\n/g, '\n');

  // Every way of ending with no review hands its reason on, as the review job's "problem" output.
  it('hands the reason on when there is no review', () => {
    expect(review).toContain('problem: ${{ steps.text.outputs.problem }}');
    expect(review).toContain(`{ echo 'problem<<GRIMOIRE_PROBLEM_EOF'; echo "$1"; echo 'GRIMOIRE_PROBLEM_EOF'; } >> "$GITHUB_OUTPUT"`);
    for (const reason of [
      'No execution file: Claude did not start.',
      'Claude stopped with an error before reviewing: $why',
      'Claude returned no review text.',
    ]) {
      expect(review, reason).toContain(`stop "${reason}"`);
    }
    // No path ends the step without a reason: the old bare exits are gone.
    expect(review).not.toMatch(/echo "::error::[^"]*"; exit 1/);
  });

  // The comment job runs when there is a review or a reason, even though the review job failed, and says which.
  it("comments that the review didn't run, and why", () => {
    expect(review).toContain("if: ${{ !cancelled() && (needs.review.outputs.result != '' || needs.review.outputs.problem != '') }}");
    expect(review).toContain('PROBLEM: ${{ needs.review.outputs.problem }}');
    expect(review).toContain(`echo "**Automatic review didn't run.** $PROBLEM"`);
    // A real review is still posted as before, under the same marker, so one comment is updated either way.
    expect(review).toContain('{ echo "**$HEADER**"; echo; echo "$RESULT"; } > review.md');
    expect(review).toContain('grimoire-review review.md');
  });
});

// ci-auto-1, after cq-1b (Francis, 2026-11-18): a heavy job (check running the code's tests, each layout shard) joins
// the PC's one-at-a-time queue only when it runs on the PC; on GitHub's machines it gets a group of its own (per run,
// attempt and shard). Under auto that follows pick's decision for this run, not the variable alone.
describe("the heavy queue follows pick's decision under each CI_RUNNER mode", () => {
  const job = (name, next) => workflow.slice(workflow.indexOf(`\n  ${name}:\n`), workflow.indexOf(`\n  ${next}:\n`));
  const groupOf = (name, next) => job(name, next).match(/\n {4}concurrency:\n {6}group: \$\{\{ (.+) \}\}\n/)[1];

  /** Evaluates a concurrency group expression the way GitHub does for these operators (string compare, && and ||). */
  function evaluate(expression, ctx) {
    const js = expression
      .replace(/needs\.pick\.outputs\.heavy_target/g, 'ctx.heavy')
      .replace(/needs\.pick\.outputs\.target/g, 'ctx.target')
      .replace(/needs\.changes\.outputs\.kind/g, 'ctx.kind')
      .replace(/needs\.changes\.outputs\.check_plan/g, 'ctx.checkPlan')
      .replace(/github\.run_id/g, 'ctx.runId')
      .replace(/github\.run_attempt/g, 'ctx.attempt')
      .replace(/matrix\.shard/g, 'ctx.shard')
      .replace(/!=/g, '!==')
      .replace(/([^!=])==([^=])/g, '$1===$2');
    // Only the names replaced above and format() may remain, so a new name in the workflow fails here, not silently.
    expect(js.replace(/'[^']*'/g, '').replace(/ctx\.\w+|format|[\s()&|!=,]/g, '')).toBe('');
    const format = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)]));
    return new Function('ctx', 'format', `return (${js});`)(ctx, format);
  }

  /** pick's answer in a mode: auto with a free lane (0 other PC runs) or busy (2 of 2 lanes taken). */
  const heavyFor = (mode, pcRuns = 0) => {
    const m = readMode(mode);
    const choice = choose({ mode: m, pcRuns, lanes: 2 });
    return { target: choice.target, overflow: choice.overflow, heavy: heavyTarget(m) };
  };
  const run = { kind: 'code', checkPlan: 'run', runId: '555', attempt: '1' };
  const check = () => groupOf('check', 'database-shard');
  const shard = () => groupOf('layout-shard', 'layout');

  // With CI_RUNNER unset or pc, every heavy job joins the PC's queue, as on main.
  it('queues check and every shard on the PC when CI_RUNNER is unset or pc', () => {
    for (const mode of [undefined, '', 'pc']) {
      const ctx = { ...run, ...heavyFor(mode) };
      expect(evaluate(check(), ctx), String(mode)).toBe('heavy-one-at-a-time');
      for (const n of [1, 2, 3]) expect(evaluate(shard(), { ...ctx, shard: n }), String(mode)).toBe('heavy-one-at-a-time');
    }
  });

  // With CI_RUNNER github, check and each shard have a group of their own, as on main (cq-1b).
  it('gives check and each shard a group of its own when CI_RUNNER is github', () => {
    const ctx = { ...run, ...heavyFor('github') };
    expect(evaluate(check(), ctx)).toBe('light-555-1');
    expect([1, 2, 3].map((n) => evaluate(shard(), { ...ctx, shard: n }))).toEqual([
      'light-555-1-shard-1',
      'light-555-1-shard-2',
      'light-555-1-shard-3',
    ]);
  });

  // ci-pc-pictures (Francis, 2026-11-20: "Yes, PC only"): under auto, check and the shards queue on the PC whether pick
  // keeps the run there or sends it to GitHub (every lane taken); only the run's small jobs overflow.
  it('under auto, queues check and the shards on the PC even when the run overflows', () => {
    const onPc = { ...run, ...heavyFor('auto', 0) };
    expect(onPc).toMatchObject({ target: 'self', heavy: 'self' });
    expect(evaluate(check(), onPc)).toBe('heavy-one-at-a-time');
    expect(evaluate(shard(), { ...onPc, shard: 2 })).toBe('heavy-one-at-a-time');
    const overflow = { ...run, ...heavyFor('auto', 2), attempt: '2' };
    expect(overflow).toMatchObject({ target: 'github', overflow: true, heavy: 'self' });
    expect(evaluate(check(), overflow)).toBe('heavy-one-at-a-time');
    for (const n of [1, 2, 3]) expect(evaluate(shard(), { ...overflow, shard: n })).toBe('heavy-one-at-a-time');
  });

  // On the PC, a docs-only or reused check still runs at once in a group of its own (cq-1a).
  it('lets a docs-only or reused check on the PC skip the queue', () => {
    const ctx = { ...run, heavy: 'self' };
    expect(evaluate(check(), { ...ctx, kind: 'docs' })).toBe('light-555-1');
    expect(evaluate(check(), { ...ctx, checkPlan: 'reuse' })).toBe('light-555-1');
  });

  // If pick gave no answer, a heavy job errs towards the PC's queue (never two heavy jobs on the PC at once).
  it('queues a heavy job when pick gave no target', () => {
    expect(evaluate(check(), { ...run, heavy: '' })).toBe('heavy-one-at-a-time');
    expect(evaluate(shard(), { ...run, heavy: '', shard: 1 })).toBe('heavy-one-at-a-time');
  });
});

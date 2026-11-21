// Decides what each job of the GitHub check (.github/workflows/check.yml) does on this run (ruled 2026-11-05: the
// picture check, layout, runs only once a pull request has the "ready" label). The changes job works out what the
// change touches (kind, screens, database) and, when a label was just added, which checks already passed for this
// commit; this script turns that into one plan per job and prints it as key=value lines for $GITHUB_OUTPUT.
//
//   check:    run | reuse | deferred
//   database: run | skip | reuse
//   layout:   run | skip | wait | reuse | deferred | night
//
// run   do the work
// skip  nothing this job tests changed: report success without doing the work
// reuse a label was just added and this job already passed for this same commit: report success again
// wait  layout only: pictures could change but the pull request has no "ready" label yet. The job fails in a few
//       seconds with a message, so the required layout check blocks the merge until the label is added.
// deferred  by day (cq-3, DEFER_BY_DAY below): check and layout do no work and report success with a note; the
//       night run (schedule) does them on main. (Off since rvw-6: the day runs do the work.) Only a code change (KIND exactly "code") on a pull request or a
//       push to main is deferred; docs-only keeps its fast path and database runs as before.
// night layout only, on a push to main (a merge; Francis, 2026-11-19: "a nightly picture check sounds best can you
//       implement that?"): the shards don't run and the job reports success with a note; main's pictures are checked
//       by the night run (schedule, 07:00 UTC). A pull request's layout is unchanged (the ready label).
//
// Inputs (environment): EVENT (github.event_name), ACTION (the pull request's action, e.g. labeled), LABELS (the
// pull request's labels, a JSON list or one per line), KIND (docs | code), SCREENS (true | false), DATABASE (true | false), PASSED
// (names of the checks that already succeeded for this commit, one per line; looked up only on a "labeled" event).
// Anything unexpected falls on the safe side: the work runs.
// A run started by hand (workflow_dispatch: the full regression run, ruled 2026-11-09) is not a pull request and its
// changes job reports everything as changed, so all three plans come out as run. The night run (schedule, cq-3) is
// read the same way: no pull request, no action, no labels, everything changed, so it runs everything too.
import { pathToFileURL } from 'node:url';

export const READY_LABEL = 'ready';

// The switch for cq-3 (ruled 2026-11-13): while it is true, a pull request's run and main's run after a merge do
// the database tests only, and check and layout are deferred to the night run (schedule, 07:00 UTC), which runs
// everything on main. It is false since rvw-6 (2026-11-17): the full checks run by day again, the ready label's
// wait included, and the night run stays. Setting it true again brings the deferral back.
export const DEFER_BY_DAY = false;

/** The events of a day run. Anything else (a run by hand, the night run, an unknown event) runs everything. */
const DAY_EVENTS = ['pull_request', 'push'];

/** Splits a one-per-line list, dropping blanks. */
function lines(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** The pull request's labels: the JSON list the workflow passes (toJSON), or one per line. */
function labelList(text) {
  const raw = (text ?? '').trim();
  if (raw.startsWith('[')) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.filter((l) => typeof l === 'string');
    } catch {
      // Not JSON after all: read it as lines below.
    }
  }
  return lines(raw);
}

/**
 * The plan for this run.
 * @param {{event?: string, action?: string, labels?: string[], kind?: string, screens?: boolean,
 *   database?: boolean, passed?: string[], defer?: boolean}} input
 *   defer is the cq-3 switch; it defaults to DEFER_BY_DAY (tests pass true to see the deferred behaviour).
 */
export function planJobs({ event, action, labels = [], kind, screens, database, passed = [], defer = DEFER_BY_DAY }) {
  const pullRequest = event === 'pull_request';
  // Only a label being added may reuse an earlier pass: the commit is the same, so the answer is too.
  const labelAdded = pullRequest && action === 'labeled';
  const already = (name) => labelAdded && passed.includes(name);
  const code = kind !== 'docs';
  // cq-3: only an explicit code change on a day event defers. An empty or odd kind still runs (the safe side).
  const deferred = defer && kind === 'code' && DAY_EVENTS.includes(event);

  let check;
  if (deferred) check = 'deferred';
  else if (already('check')) check = 'reuse';
  else check = 'run';

  let databasePlan;
  if (!(code && database !== false)) databasePlan = 'skip';
  else if (already('database')) databasePlan = 'reuse';
  else databasePlan = 'run';

  let layout;
  if (!(code && screens !== false)) layout = 'skip';
  else if (deferred) layout = 'deferred'; // no wait for the ready label while deferral is on
  else if (event === 'push') layout = 'night'; // main after a merge: the night run checks its pictures
  else if (!pullRequest) layout = 'run'; // a run by hand, the night run or an unknown event: layout follows what changed
  else if (already('layout')) layout = 'reuse';
  else if (labels.includes(READY_LABEL)) layout = 'run';
  else layout = 'wait';

  return { check, database: databasePlan, layout };
}

/** Reads the inputs from the environment (strings from the workflow). */
export function inputFromEnv(env) {
  return {
    event: env.EVENT,
    action: env.ACTION,
    labels: labelList(env.LABELS),
    kind: env.KIND,
    // Only an explicit "false" skips: an empty or odd value runs the work.
    screens: env.SCREENS !== 'false',
    database: env.DATABASE !== 'false',
    passed: lines(env.PASSED),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const plan = planJobs(inputFromEnv(process.env));
  for (const [job, what] of Object.entries(plan)) console.log(`${job}_plan=${what}`);
}

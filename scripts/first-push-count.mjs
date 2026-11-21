// First-push count (ruled 2026-11-10; .claude/README.md, Measuring): how many code pull requests merged on their
// first push, counted from GitHub instead of asked of each builder. Project Review runs it at each gate and puts the
// table in docs/health/project-review-<date>.md.
//
// How it counts, for each merged pull request that is not docs-only (scripts/docs-only.mjs) and not Dependabot's:
//   - a push is a distinct commit the Check workflow ran on for that branch (pull_request runs);
//   - a later push is an update from main (its head commit is a merge) or a later commit (anything else);
//   - a red run counts unless its only failure is the layout job saying "add the ready label" (by design, 2026-11-05).
// Each pull request then lands in one kind (KINDS below). Only "first push" is first time right.
//
// What it can't see: a later commit that was a planned second part and not rework; a failure fixed by re-running the
// same run (the run ends green); tokens and runner minutes.
//
// Usage (needs the GitHub CLI signed in, and the commits fetched: git fetch first):
//   node scripts/first-push-count.mjs --since 2026-11-06 --until 2026-11-10        dates in UTC, both included
//   node scripts/first-push-count.mjs --since 2026-11-06 --until 2026-11-10 --json
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isDocsOnly } from './docs-only.mjs';

/** The kinds a pull request can land in, in the order the table shows them. */
export const KINDS = ['first push', 'updates from main only', 'red run, no new commit', 'later commits', 'later commits and a red run'];

/** The step of the layout job that goes red, by design, while a pull request has no `ready` label. */
export const WAIT_JOB = 'layout';
export const WAIT_STEP = 'Follow the plan';

/** The distinct head commits of a pull request's runs, oldest first: one per push. */
export function pushesOf(runs) {
  const ordered = [...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...new Set(ordered.map((run) => run.headSha))];
}

/**
 * True when a red run's only failure is the layout job's "add the ready label" step: no test failed.
 * `jobs` is the run's job list as `gh run view --json jobs` gives it. A failed triage job is ignored: it only
 * comments on a red run.
 */
export function isWaitOnly(jobs) {
  const failed = jobs.filter((job) => job.conclusion === 'failure' && job.name !== 'triage');
  if (failed.length !== 1 || failed[0].name !== WAIT_JOB) return false;
  const steps = (failed[0].steps ?? []).filter((step) => step.conclusion === 'failure');
  return steps.length === 1 && steps[0].name === WAIT_STEP;
}

/**
 * Which kind one pull request is. `laterPushes` is one entry per push after the first: 'merge' (an update from
 * main), 'commit' (anything else) or 'unknown' (the commit isn't in this copy; counted as a commit, to be safe).
 * `realReds` is the number of red runs that aren't wait-only.
 */
export function kindOf({ laterPushes, realReds }) {
  const commits = laterPushes.filter((kind) => kind !== 'merge').length;
  if (commits === 0 && realReds === 0) return laterPushes.length === 0 ? KINDS[0] : KINDS[1];
  if (commits === 0) return KINDS[2];
  return realReds === 0 ? KINDS[3] : KINDS[4];
}

/** True for a pull request this count leaves out: docs-only, or one of Dependabot's. */
export function isLeftOut(pullRequest) {
  if (pullRequest.headRefName.startsWith('dependabot/')) return true;
  return isDocsOnly(pullRequest.files.map((file) => file.path));
}

/** The runs that belong to one pull request: its branch's pull_request runs between its opening day and its merge. */
export function runsOf(pullRequest, runs) {
  const from = pullRequest.createdAt.slice(0, 10);
  return runs.filter(
    (run) =>
      run.event === 'pull_request' &&
      run.headBranch === pullRequest.headRefName &&
      run.createdAt >= from &&
      run.createdAt <= pullRequest.mergedAt,
  );
}

/**
 * One row per counted pull request. `commitKind(sha)` answers 'merge', 'commit' or 'unknown'; `waitOnly(runId)`
 * answers whether a red run is the by-design one. A pull request with no Check run at all is left out and counted
 * in `noRuns`.
 */
export function rowsFor(pullRequests, runs, commitKind, waitOnly) {
  const rows = [];
  let noRuns = 0;
  for (const pullRequest of pullRequests) {
    if (isLeftOut(pullRequest)) continue;
    const mine = runsOf(pullRequest, runs);
    if (mine.length === 0) {
      noRuns += 1;
      continue;
    }
    const red = mine.filter((run) => run.conclusion === 'failure');
    const waitReds = red.filter((run) => waitOnly(run.databaseId)).length;
    const realReds = red.length - waitReds;
    const laterPushes = pushesOf(mine).slice(1).map(commitKind);
    rows.push({
      number: pullRequest.number,
      kind: kindOf({ laterPushes, realReds }),
      runs: mine.length,
      realReds,
      waitReds,
      cancelled: mine.filter((run) => run.conclusion === 'cancelled').length,
    });
  }
  return { rows, noRuns };
}

/** The totals the report's table shows. */
export function summarise(rows) {
  const total = (pick) => rows.reduce((sum, row) => sum + pick(row), 0);
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, rows.filter((row) => row.kind === kind).length]));
  const runs = total((row) => row.runs);
  return {
    pullRequests: rows.length,
    byKind,
    firstPushPercent: rows.length === 0 ? 0 : Math.round((100 * byKind[KINDS[0]]) / rows.length),
    runs,
    runsPerPullRequest: rows.length === 0 ? 0 : Math.round((10 * runs) / rows.length) / 10,
    realReds: total((row) => row.realReds),
    waitReds: total((row) => row.waitReds),
    cancelled: total((row) => row.cancelled),
  };
}

/** The summary as the lines of a Markdown table, ready for the health report. */
export function tableFor(summary, since, until) {
  const lines = [`| | ${since} to ${until} (UTC) |`, '|---|---|', `| Code pull requests | ${summary.pullRequests} |`];
  for (const kind of KINDS) {
    const count = summary.byKind[kind];
    const label = kind === KINDS[0] ? `Merged on the ${kind}` : kind[0].toUpperCase() + kind.slice(1);
    lines.push(`| ${label} | ${count}${kind === KINDS[0] ? ` (${summary.firstPushPercent}%)` : ''} |`);
  }
  lines.push(`| Check runs per pull request | ${summary.runsPerPullRequest} |`);
  lines.push(`| Red runs (a real failure) | ${summary.realReds} |`);
  lines.push(`| Red runs ("add the ready label") | ${summary.waitReds} |`);
  lines.push(`| Cancelled runs | ${summary.cancelled} |`);
  return lines;
}

/** Every day from `since` to `until`, both included, as YYYY-MM-DD. */
export function daysBetween(since, until) {
  const days = [];
  for (let day = new Date(`${since}T00:00:00Z`); day <= new Date(`${until}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

// ---- reading GitHub and Git (not covered by the tests: they need the network) ----

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function fetchPullRequests(since, until) {
  const fields = 'number,createdAt,mergedAt,files,headRefName';
  const found = [];
  // One day at a time: a long range with every pull request's files is more than one GitHub answer may hold.
  for (const day of daysBetween(since, until)) {
    found.push(...JSON.parse(gh(['pr', 'list', '--state', 'merged', '--search', `merged:${day}`, '--limit', '300', '--json', fields])));
  }
  return found;
}

function fetchRuns(firstDay, until) {
  const fields = 'databaseId,headBranch,headSha,event,conclusion,createdAt';
  const found = [];
  for (const day of daysBetween(firstDay, until)) {
    found.push(...JSON.parse(gh(['run', 'list', '--workflow', 'check.yml', '--created', day, '--limit', '1000', '--json', fields])));
  }
  return found;
}

function commitKind(sha) {
  try {
    const parents = execFileSync('git', ['show', '-s', '--format=%P', sha], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return parents.trim().split(' ').length > 1 ? 'merge' : 'commit';
  } catch {
    return 'unknown';
  }
}

function waitOnlyFromGitHub(runId) {
  try {
    return isWaitOnly(JSON.parse(gh(['run', 'view', String(runId), '--json', 'jobs'])).jobs);
  } catch {
    return false;
  }
}

function argument(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const since = argument('--since');
  const until = argument('--until');
  const isDay = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text ?? '');
  if (!isDay(since) || !isDay(until) || since > until) {
    console.error('Usage: node scripts/first-push-count.mjs --since YYYY-MM-DD --until YYYY-MM-DD [--json]');
    process.exit(1);
  }
  const pullRequests = fetchPullRequests(since, until);
  const counted = pullRequests.filter((pullRequest) => !isLeftOut(pullRequest));
  // A pull request merged in the period may have been opened before it: read the runs from the earliest opening day.
  const firstDay = counted.reduce((first, pullRequest) => (pullRequest.createdAt.slice(0, 10) < first ? pullRequest.createdAt.slice(0, 10) : first), since);
  const runs = fetchRuns(firstDay, until);
  const { rows, noRuns } = rowsFor(pullRequests, runs, commitKind, waitOnlyFromGitHub);
  const summary = summarise(rows);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ since, until, summary, noRuns, rows }, null, 2));
  } else {
    console.log(tableFor(summary, since, until).join('\n'));
    console.log(`\nLeft out: ${pullRequests.length - counted.length} docs-only or Dependabot pull requests; ${noRuns} with no Check run.`);
  }
}

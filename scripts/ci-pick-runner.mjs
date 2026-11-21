// Picks the machines a workflow run uses (ci-auto-1, Francis 18 Nov: "CI_RUNNER auto, PC first, GitHub overflow").
// Each workflow's first job, pick, runs this and every other job reads its answer, so a whole run stays on one choice
// (the database and layout shards stay together). The repository variable CI_RUNNER is the switch:
//
//   unset (or anything else)  the PC's self-hosted runners (labels self-hosted, grimoire), as before
//   github                    GitHub's ubuntu-latest, as before
//   auto                      the PC while it has room, GitHub when it's busy
//
// "Busy" for auto (ci-auto-1-fix): every PC lane is taken. A lane is one PC runner; a run takes one while any of its
// unfinished jobs asked for a self-hosted runner (queued, waiting or running). So pick counts RUNS on the PC, not jobs:
// one PC run is a check plus up to three layout shards, and counting jobs filled two lanes with a single run.
// How many lanes: the online PC runners (label grimoire) when the runners list can be read. That list needs admin
// rights, which the run's own GITHUB_TOKEN never has (it answers 403), so in practice it is CI_LOCAL_SLOTS (a
// repository variable; default 2, the PC's lanes pc-1 and pc-2). With the list, a PC with no runner online overflows.
// The runs are read with the run's own token (actions: read): no extra secret. If they can't be read, auto falls back
// to the PC, the same as unset.
//
// The heavy jobs never overflow (ci-pc-pictures, Francis 20 Nov 2026: "Yes, PC only"): check.yml's check and its three
// picture shards stay on the PC under auto even when the run overflows, and wait their turn in the PC's one-at-a-time
// queue. On GitHub's machines a picture shard took 19 to 40 minutes and check 12 to 18, against 3 to 6 on the PC.
// Only CI_RUNNER github sends them to GitHub (the way to re-run a picture run that timed out on the PC).
//
// Prints key=value lines for $GITHUB_OUTPUT:
//   runs_on         a JSON label list for runs-on (read with fromJSON)
//   target          self | github: where the run's other jobs go
//   overflow        true only when auto sent the run to GitHub (the run's page then says so)
//   heavy_runs_on   runs-on for check.yml's heavy jobs (check, the layout shards): the PC unless CI_RUNNER is github
//   heavy_target    self | github for them (they join the PC's one-at-a-time queue only when it isn't github)
import { pathToFileURL } from 'node:url';

export const SELF_LABELS = ['self-hosted', 'grimoire'];
export const GITHUB_LABELS = ['ubuntu-latest'];
export const DEFAULT_SLOTS = 2;

/** Run statuses that can still hold or start jobs. */
export const ACTIVE_RUN_STATUSES = ['in_progress', 'queued', 'waiting', 'pending', 'requested'];

/**
 * The switch's value, read the way the workflows' expressions compare it: case doesn't matter, spaces do (no trim),
 * so " auto" sends pick to the PC in the runs-on expression and is the PC here too.
 */
export function readMode(value) {
  const mode = String(value ?? '').toLowerCase();
  return mode === 'github' || mode === 'auto' ? mode : 'self';
}

/** CI_LOCAL_SLOTS as a whole number of at least 1; anything else is the default. */
export function readSlots(value) {
  const text = String(value ?? '').trim();
  const n = Number(text);
  return text !== '' && Number.isInteger(n) && n >= 1 ? n : DEFAULT_SLOTS;
}

/** True when a job asked for the PC and hasn't finished. */
function pcJobUnfinished(job) {
  return job.status !== 'completed' && (job.labels ?? []).includes('self-hosted');
}

/** How many other runs hold or wait for a PC lane: runs with at least one unfinished self-hosted job. */
export function countPcRuns(runs, thisRunId) {
  return runs.filter((run) => String(run.id) !== String(thisRunId) && (run.jobs ?? []).some(pcJobUnfinished)).length;
}

/** The PC's lanes from a runners list: its online runners labelled grimoire (null when there is no list). */
export function onlineLanes(runnersPage) {
  if (!runnersPage || !Array.isArray(runnersPage.runners)) return null;
  return runnersPage.runners.filter(
    (runner) => runner.status === 'online' && (runner.labels ?? []).some((label) => label.name === 'grimoire'),
  ).length;
}

/** The choice for a mode; pcRuns and lanes matter only for auto. */
export function choose({ mode, pcRuns = 0, lanes = DEFAULT_SLOTS }) {
  if (mode === 'github') return { target: 'github', overflow: false };
  if (mode === 'auto' && pcRuns >= lanes) return { target: 'github', overflow: true };
  return { target: 'self', overflow: false };
}

/** Where the heavy jobs (check, the picture shards) go: GitHub only when CI_RUNNER is github, never as overflow. */
export function heavyTarget(mode) {
  return mode === 'github' ? 'github' : 'self';
}

const labelsFor = (target) => (target === 'github' ? GITHUB_LABELS : SELF_LABELS);

/** The key=value lines for $GITHUB_OUTPUT. heavy is the heavy jobs' target (the PC when not given). */
export function outputLines({ target, overflow, heavy = 'self' }) {
  return [
    `runs_on=${JSON.stringify(labelsFor(target))}`,
    `target=${target}`,
    `overflow=${overflow}`,
    `heavy_runs_on=${JSON.stringify(labelsFor(heavy))}`,
    `heavy_target=${heavy}`,
  ];
}

/** Reads the repository's active runs (all but this one) and their jobs through the REST API. getJson(path) returns parsed JSON. */
export async function readActiveRuns(getJson, repo, thisRunId) {
  const runs = new Map();
  for (const status of ACTIVE_RUN_STATUSES) {
    const page = await getJson(`/repos/${repo}/actions/runs?status=${status}&per_page=100`);
    for (const run of page.workflow_runs ?? []) {
      if (String(run.id) !== String(thisRunId)) runs.set(run.id, { id: run.id });
    }
  }
  for (const run of runs.values()) {
    const page = await getJson(`/repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    run.jobs = page.jobs ?? [];
  }
  return [...runs.values()];
}

/** The PC's online runners, or null when the token can't read the list (the run's own token never can). */
export async function readLanes(getJson, repo) {
  try {
    return onlineLanes(await getJson(`/repos/${repo}/actions/runners?per_page=100`));
  } catch {
    return null;
  }
}

/** The pick log's line for github and the PC modes, with the value actually set (so a typo shows). */
export function modeNote(value, mode) {
  const raw = String(value ?? '');
  if (mode === 'github') return `CI_RUNNER is '${raw}': GitHub's machines.`;
  return raw === '' ? 'CI_RUNNER is unset: the PC.' : `CI_RUNNER is '${raw}' (not github or auto): the PC.`;
}

/** The whole decision from the environment. Never throws: a failed read of the runs falls back to the PC. */
export async function pick(env, getJson) {
  const mode = readMode(env.CI_RUNNER);
  const slots = readSlots(env.CI_LOCAL_SLOTS);
  const heavy = heavyTarget(mode);
  if (mode !== 'auto') return { ...choose({ mode }), heavy, note: modeNote(env.CI_RUNNER, mode) };
  let pcRuns;
  try {
    pcRuns = countPcRuns(await readActiveRuns(getJson, env.GITHUB_REPOSITORY, env.GITHUB_RUN_ID), env.GITHUB_RUN_ID);
  } catch (error) {
    return { ...choose({ mode: 'self' }), heavy, note: `auto: couldn't count the PC's runs (${error.message}), so the PC.` };
  }
  const online = await readLanes(getJson, env.GITHUB_REPOSITORY);
  const lanes = online ?? slots;
  const laneText = online === null ? `${slots} lane(s) from CI_LOCAL_SLOTS` : `${online} PC runner(s) online`;
  const choice = choose({ mode, pcRuns, lanes });
  const where = choice.target === 'github' ? "GitHub's machines, except check and the picture shards (the PC's queue)" : 'the PC';
  return { ...choice, heavy, note: `auto: ${pcRuns} other run(s) on or waiting for the PC, ${laneText}: ${where}.` };
}

function githubGetJson(env) {
  const api = env.GITHUB_API_URL || 'https://api.github.com';
  return async (path) => {
    const response = await fetch(`${api}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path.split('?')[0]}`);
    return response.json();
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await pick(process.env, githubGetJson(process.env));
  for (const line of outputLines(result)) console.log(line);
  console.error(result.note);
}

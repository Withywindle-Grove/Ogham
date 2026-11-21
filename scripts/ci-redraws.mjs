// Announced redraws (ci-announced-redraws, Francis 20 Nov 2026: "do the second saving too - write them both so they
// persist past this session"). A pull request that changes gallery pictures on purpose names them in its text, on one
// line:
//
//   Gallery pictures expected to change: phone-light-atoms.png, tablet-dark-atoms.png
//
// When the picture check then fails only because those pictures differ, check.yml's redraw job runs this script on
// the six layout shards' reports (layout-screens-N/layout-report.json, Playwright's JSON report). It accepts the
// redraws only when every failure in every shard is a gallery picture comparison, every differing picture was
// announced, and each comparison has its 1x *-actual.png (the picture Playwright compared, never a gallery/ 2x one).
// Anything else (an unannounced picture, any other failing test, a picture that never held still, a shard with no
// report) is refused, and the run stays red as before. An announced picture that didn't differ is reported.
// Each report must also name this very run attempt and commit (playwright.config.ts writes GITHUB_RUN_ATTEMPT and
// GITHUB_SHA into its metadata): a report left from an earlier attempt of the run, or from other code, is refused, so
// a re-run never judges an older attempt's pictures (#1082 review).
//
//   node scripts/ci-redraws.mjs --body <file> --shards <dir> --count 6 --baselines tests/layout/gallery-baselines \
//     --attempt <GITHUB_RUN_ATTEMPT> --sha <GITHUB_SHA> [--write]
//
// <dir>/<n>/ holds shard n's layout-screens-n artifact. --write copies the accepted redraws over their baselines.
// Prints a summary in Markdown; writes verdict= (accept | refuse | none) and pictures= (space-separated) to
// $GITHUB_OUTPUT when it is set. Exits 1 only when it couldn't run at all.
//
//   node scripts/ci-redraws.mjs --verify-status --pictures "<a.png b.png>" [--baselines tests/layout/gallery-baselines]
//
// After --write, in the checkout: exits 0 only when `git status` shows exactly the accepted pictures' approved files
// modified, and nothing else (no other change, no untracked file); otherwise it says what it found and exits 1.
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The announcing line's words, read without regard to case. */
export const ANNOUNCE_LINE = 'Gallery pictures expected to change:';

/** A gallery picture's file name: lowercase words and dashes, then .png. Nothing with a slash or a dot in it. */
const PICTURE = /^[a-z0-9][a-z0-9-]*\.png$/;

/** The announced pictures: every name.png on the pull request text's announcing line(s). */
export function announcedPictures(body) {
  const names = new Set();
  for (const line of String(body ?? '').split(/\r?\n/)) {
    const at = line.toLowerCase().indexOf(ANNOUNCE_LINE.toLowerCase());
    if (at < 0) continue;
    // Words split at spaces, commas and semicolons, shorn of quotes, brackets and a closing full stop; a word counts
    // only when it is a whole picture name (so "../x.png" or "gallery/x.png" never does).
    for (const word of line.slice(at + ANNOUNCE_LINE.length).split(/[\s,;]+/)) {
      const name = word.replace(/^[`'"([*]+/, '').replace(/[`'")\]*:.]+$/, '');
      if (PICTURE.test(name)) names.add(name);
    }
  }
  return names;
}

const stripColours = (text) => String(text ?? '').replace(/\x1b\[[0-9;]*m/g, '');

/** Every test in a Playwright JSON report, with its file and title. */
export function reportTests(report) {
  const found = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) found.push({ file: spec.file ?? file ?? '', title: spec.title ?? '', test });
    }
    for (const child of suite.suites ?? []) walk(child, child.file ?? file);
  };
  for (const suite of report.suites ?? []) walk(suite, suite.file);
  return found;
}

/** True for the gallery's picture comparison (tests/layout/gallery.spec.ts, "... matches the approved pictures"). */
export function isGalleryComparison({ file, title }) {
  return path.posix.basename(String(file).replace(/\\/g, '/')) === 'gallery.spec.ts' && / matches the approved pictures$/.test(title);
}

/**
 * Reads one failed gallery comparison's last attempt: the pictures that differed and their -actual.png attachments.
 * Returns { pictures: [{ name, attachment }], problem } where problem says why it can't be accepted.
 */
export function readComparison(test) {
  const result = (test.results ?? []).at(-1);
  if (!result) return { pictures: [], problem: 'no result' };
  if (result.status !== 'failed') return { pictures: [], problem: `ended ${result.status}` };
  const named = [];
  for (const error of result.errors ?? []) {
    const message = stripColours(error.message);
    if (!message.includes('toHaveScreenshot')) return { pictures: [], problem: 'failed on something other than a picture' };
    if (/^\s*Timeout:/m.test(message) || /stable screenshots/i.test(message)) {
      return { pictures: [], problem: 'a picture never held still' };
    }
    const snapshot = message.match(/^\s*Snapshot: (\S+)\s*$/m);
    if (!snapshot) return { pictures: [], problem: 'a picture failure that names no picture' };
    named.push(snapshot[1]);
  }
  const attachments = result.attachments ?? [];
  if (attachments.some((a) => /-previous\.png$/.test(a.name))) return { pictures: [], problem: 'a picture never held still' };
  const actuals = attachments.filter((a) => /-actual\.png$/.test(a.name) && a.path);
  const pictures = actuals.map((a) => ({ name: a.name.replace(/-actual\.png$/, '.png'), attachment: a.path }));
  const same =
    named.length > 0 &&
    named.length === pictures.length &&
    [...named].sort().join('\n') === pictures.map((p) => p.name).sort().join('\n');
  if (!same) return { pictures: [], problem: "the failures and the redrawn pictures don't match one for one" };
  return { pictures, problem: '' };
}

/**
 * Why a shard's report can't be judged in this run attempt, or '' when it can: it must name the attempt and commit
 * the redraw job is running for (expected: { attempt, sha }), in the metadata playwright.config.ts gives it.
 */
export function staleReport(report, expected) {
  const metadata = report?.config?.metadata ?? {};
  const attempt = String(metadata.runAttempt ?? '');
  const sha = String(metadata.sha ?? '');
  if (!expected?.attempt || !expected?.sha) return "this run's attempt and commit weren't given";
  if (!attempt || !sha) return "its report doesn't say which run attempt and commit it checked";
  if (attempt !== String(expected.attempt)) {
    return `its report is from attempt ${attempt}, not this attempt (${expected.attempt}): add the ready label again for a fresh run`;
  }
  if (sha !== String(expected.sha)) return `its report checked commit ${sha.slice(0, 12)}, not ${String(expected.sha).slice(0, 12)}`;
  return '';
}

/**
 * The verdict on all the shards' reports. shards: [{ shard, report }] (report null when the shard kept none).
 * expected: { attempt, sha }, this run's attempt and checked commit; when given, a report from another is refused.
 * Returns { verdict: 'accept' | 'refuse' | 'none', redraws: [{ name, shard, attachment }], unannounced, problems,
 * unchanged } where unchanged lists announced pictures that didn't differ.
 */
export function judge(shards, announced, expected = null) {
  const redraws = [];
  const unannounced = [];
  const problems = [];
  for (const { shard, report } of shards) {
    if (!report) {
      problems.push(`shard ${shard}: no report (the shard stopped before its tests ended, or its pictures weren't kept)`);
      continue;
    }
    const stale = expected ? staleReport(report, expected) : '';
    if (stale) {
      problems.push(`shard ${shard}: ${stale}`);
      continue;
    }
    for (const error of report.errors ?? []) problems.push(`shard ${shard}: ${stripColours(error.message).split('\n')[0]}`);
    for (const entry of reportTests(report)) {
      if (entry.test.status !== 'unexpected') continue;
      if (!isGalleryComparison(entry)) {
        problems.push(`shard ${shard}: "${entry.title}" failed`);
        continue;
      }
      const { pictures, problem } = readComparison(entry.test);
      if (problem) {
        problems.push(`shard ${shard}: "${entry.title}": ${problem}`);
        continue;
      }
      for (const picture of pictures) {
        if (!PICTURE.test(picture.name)) problems.push(`shard ${shard}: an odd picture name, ${picture.name}`);
        else if (!announced.has(picture.name)) unannounced.push(picture.name);
        else redraws.push({ ...picture, shard });
      }
    }
  }
  const names = new Set(redraws.map((r) => r.name));
  if (names.size !== redraws.length) problems.push('the same picture differed twice');
  const unchanged = [...announced].filter((name) => !names.has(name)).sort();
  let verdict = 'none';
  if (problems.length || unannounced.length) verdict = 'refuse';
  else if (redraws.length) verdict = 'accept';
  redraws.sort((a, b) => a.name.localeCompare(b.name));
  return { verdict, redraws, unannounced: [...new Set(unannounced)].sort(), problems, unchanged };
}

/** Where an attachment's file sits in the downloaded artifact (its path under test-results/), or null. */
export function artifactPath(attachment, configFile, shardDir) {
  if (!attachment || !configFile) return null;
  const root = path.posix.join(path.posix.dirname(String(configFile).replace(/\\/g, '/')), 'test-results');
  const relative = path.posix.relative(root, String(attachment).replace(/\\/g, '/'));
  if (!relative || relative.startsWith('..') || path.posix.isAbsolute(relative)) return null;
  return path.join(shardDir, ...relative.split('/'));
}

/** The summary in Markdown. */
export function summaryLines({ verdict, redraws, unannounced, problems, unchanged }) {
  const lines = ['### Announced redraws (ci-announced-redraws)', ''];
  if (verdict === 'accept') {
    lines.push(`Only announced gallery pictures differed, so they are redrawn: ${redraws.map((r) => r.name).join(', ')}.`);
  } else if (verdict === 'none') {
    lines.push('No gallery picture differed: nothing to redraw (a shard failed for another reason).');
  } else {
    lines.push('Not redrawn: the picture check stays red, as before announced redraws.');
    for (const name of unannounced) lines.push(`- ${name} differs but the pull request doesn't announce it.`);
    for (const problem of problems) lines.push(`- ${problem}`);
  }
  for (const name of unchanged) lines.push(`- Announced but didn't change: ${name}.`);
  return lines;
}

/**
 * The check after --write: `git status --porcelain --untracked-files=all` (porcelain) must list exactly the accepted
 * pictures' approved files as modified (" M <baselines>/<name>"), and nothing else. Returns { ok, want, got, reason }.
 */
export function verifyStatus(porcelain, pictures, baselines = 'tests/layout/gallery-baselines') {
  const names = String(pictures ?? '').split(/\s+/).filter(Boolean);
  const dir = String(baselines).replace(/\\/g, '/').replace(/\/+$/, '');
  const want = names.map((name) => ` M ${dir}/${name}`).sort();
  const got = String(porcelain ?? '').split(/\r?\n/).filter((line) => line.trim() !== '').sort();
  let reason = '';
  if (!names.length) reason = 'no pictures were accepted';
  else if (names.some((name) => !PICTURE.test(name))) reason = 'an odd picture name';
  else if (new Set(names).size !== names.length) reason = 'the same picture was named twice';
  else if (got.join('\n') !== want.join('\n')) reason = 'the redraw changed something other than the announced pictures';
  return { ok: !reason, want, got, reason };
}

function argsOf(argv) {
  const args = { write: false, verifyStatus: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--write') args.write = true;
    else if (key === '--verify-status') args.verifyStatus = true;
    else if (key.startsWith('--')) args[key.slice(2)] = argv[++i];
  }
  return args;
}

function readReport(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The whole job: read, judge, check every file is there, copy on --write. Returns the result with its summary. */
export function run(argv) {
  const args = argsOf(argv);
  const count = Number(args.count ?? 6);
  const announced = announcedPictures(existsSync(args.body ?? '') ? readFileSync(args.body, 'utf8') : '');
  const shards = [];
  for (let n = 1; n <= count; n++) {
    const dir = path.join(args.shards, String(n));
    shards.push({ shard: n, dir, report: readReport(path.join(dir, 'layout-report.json')) });
  }
  const result = judge(shards, announced, { attempt: args.attempt ?? '', sha: args.sha ?? '' });
  if (result.verdict === 'accept') {
    for (const redraw of result.redraws) {
      const shard = shards.find((s) => s.shard === redraw.shard);
      redraw.file = artifactPath(redraw.attachment, shard.report.config?.configFile, shard.dir);
      redraw.baseline = path.join(args.baselines, redraw.name);
      if (!redraw.file || !existsSync(redraw.file)) result.problems.push(`${redraw.name}: its redrawn picture wasn't kept`);
      if (!existsSync(redraw.baseline)) result.problems.push(`${redraw.name}: no approved picture to replace`);
    }
    if (result.problems.length) result.verdict = 'refuse';
  }
  if (result.verdict === 'accept' && args.write) {
    for (const redraw of result.redraws) copyFileSync(redraw.file, redraw.baseline);
  }
  return { ...result, summary: summaryLines(result) };
}

/** --verify-status: reads the checkout's git status and checks it. Returns the result with its lines to print. */
export function runVerifyStatus(argv, readStatus = gitStatus) {
  const args = argsOf(argv);
  const result = verifyStatus(readStatus(), args.pictures, args.baselines ?? 'tests/layout/gallery-baselines');
  const lines = result.ok
    ? [`Only the announced pictures changed: ${result.want.map((line) => line.slice(3)).join(', ')}.`]
    : [`::error::${result.reason}; nothing was committed.`, 'Expected:', ...result.want, 'Found:', ...result.got];
  return { ...result, lines };
}

function gitStatus() {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain && process.argv.includes('--verify-status')) {
  const result = runVerifyStatus(process.argv.slice(2));
  console.log(result.lines.join('\n'));
  if (!result.ok) process.exit(1);
} else if (isMain) {
  const result = run(process.argv.slice(2));
  console.log(result.summary.join('\n'));
  if (process.env.GITHUB_OUTPUT) {
    const pictures = result.verdict === 'accept' ? result.redraws.map((r) => r.name).join(' ') : '';
    appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${result.verdict}\npictures=${pictures}\n`);
  }
}

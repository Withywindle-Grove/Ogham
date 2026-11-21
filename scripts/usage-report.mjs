// Usage report (asked for by Francis, 2026-11-17; docs/reviewer/project-review-2026-11-17.md): where the sessions'
// usage went, summed from the records Claude Code keeps on this PC. It reads the token counts of each reply and
// nothing else: no message text is kept or printed. It changes nothing.
//
// What it sums, for every session folder whose name contains the project's name:
//   - by day, by model, by folder (one per worktree) and thread (the session itself, or a worker it started);
//   - by how much history each reply carried (short conversations are cheap, long ones are not);
//   - by plan row, for every worker whose brief has a line "Row: <id>" (for example "Row: C4").
// Shares are in rough "input-token equivalents": output x5, cache write x1.25, cache read x0.1.
//
// What it can't see: cloud sessions (their records aren't on this PC); how the plan's own meter weighs each model
// (so a share here is not a share of the week's allowance); which role a session started in the main folder had.
// To turn a share into a share of the week, read Settings, Usage at the reset and compare it with that week's total.
//
// Usage:
//   node scripts/usage-report.mjs                                   everything
//   node scripts/usage-report.mjs --since 2026-11-19 --until 2026-11-25   dates in UTC, both included
//   node scripts/usage-report.mjs --json
//   node scripts/usage-report.mjs --dir <folder of session records> --match <part of the folder names>
import { createReadStream, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

/** How much each kind of token counts, in input-token equivalents. Rough: the same for every model. */
export const WEIGHTS = { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };

/** The history bands, smallest first: [label, upper limit in tokens]. */
export const BANDS = [
  ['under 100k', 100_000],
  ['100k to 200k', 200_000],
  ['200k to 400k', 400_000],
  ['400k and over', Infinity],
];

/** One reply's token counts, with missing fields read as 0. */
export function countsOf(usage) {
  return {
    input: usage.input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
  };
}

/** The weighted size of a set of counts. */
export function weightOf(counts) {
  return (
    counts.input * WEIGHTS.input +
    counts.cacheWrite * WEIGHTS.cacheWrite +
    counts.cacheRead * WEIGHTS.cacheRead +
    counts.output * WEIGHTS.output
  );
}

/** The band a reply falls in, by the history it carried (everything it read before answering). */
export function bandOf(counts) {
  const carried = counts.input + counts.cacheWrite + counts.cacheRead;
  return BANDS.find(([, limit]) => carried < limit)[0];
}

/**
 * The plan row a brief names on a line of its own ("Row: C4"), or null. A batch names up to three rows joined by
 * "+" ("Row: B6 + B7"), and its cost is reported under the joined key ("B6+B7").
 */
export function rowOf(text) {
  const id = '[A-Za-z0-9][A-Za-z0-9._-]*';
  const found = new RegExp(`^\\s*Row:\\s*(${id}(?:\\s*\\+\\s*${id}){0,2})\\s*$`, 'm').exec(text ?? '');
  return found ? found[1].replace(/\s+/g, '') : null;
}

/** The text of a user message, whether it is a plain string or a list of parts. Tool results are left out. */
export function textOf(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => (part?.type === 'text' ? (part.text ?? '') : '')).join('\n');
}

/**
 * Reads one line of a session record. Returns { reply } for an assistant's reply with token counts,
 * { row } for a user message that names a plan row, or null for anything else (or a line that isn't JSON).
 */
export function readLine(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  const message = entry?.message;
  if (entry?.type === 'user') {
    const row = rowOf(textOf(message));
    return row ? { row } : null;
  }
  if (entry?.type !== 'assistant' || !message?.usage) return null;
  return {
    reply: {
      id: `${message.id ?? ''}|${entry.requestId ?? ''}`,
      day: (entry.timestamp ?? '').slice(0, 10),
      model: (message.model ?? 'unknown').replace(/^claude-/, ''),
      worker: entry.isSidechain === true,
      counts: countsOf(message.usage),
    },
  };
}

/** True when a day (YYYY-MM-DD) is inside the asked dates; an empty bound is open. */
export function inDates(day, since, until) {
  return (!since || day >= since) && (!until || day <= until);
}

/**
 * Sums replies into groups. Each reply is { day, model, folder, worker, row, counts }.
 * Returns { total, groups }: groups[kind][name] = { replies, input, cacheWrite, cacheRead, output, weight }.
 */
export function summarise(replies) {
  const blank = () => ({ replies: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, weight: 0 });
  const total = blank();
  const groups = { day: {}, model: {}, session: {}, history: {}, row: {} };
  const add = (sum, counts) => {
    sum.replies += 1;
    for (const key of ['input', 'cacheWrite', 'cacheRead', 'output']) sum[key] += counts[key];
    sum.weight += weightOf(counts);
  };
  for (const reply of replies) {
    const thread = reply.worker ? 'workers' : 'itself';
    const names = {
      day: reply.day || 'unknown',
      model: reply.model,
      session: `${reply.folder}, ${thread}`,
      history: `${thread}, ${bandOf(reply.counts)}`,
      row: reply.row ?? 'no row named',
    };
    add(total, reply.counts);
    for (const [kind, name] of Object.entries(names)) add((groups[kind][name] ??= blank()), reply.counts);
  }
  return { total, groups };
}

/** A group as lines of a Markdown table, biggest share first (days stay in date order). */
export function tableFor(title, group, total, { byName = false } = {}) {
  const millions = (n) => (n / 1e6).toFixed(1);
  const share = (sum) => (total.weight === 0 ? '0.0' : ((sum.weight / total.weight) * 100).toFixed(1));
  const rows = Object.entries(group).sort(([nameA, a], [nameB, b]) =>
    byName ? nameA.localeCompare(nameB) : b.weight - a.weight,
  );
  return [
    `| ${title} | Share % | Replies | Output (M) | Cache read (M) | Cache write (M) |`,
    '|---|---|---|---|---|---|',
    ...rows.map(
      ([name, sum]) =>
        `| ${name} | ${share(sum)} | ${sum.replies} | ${millions(sum.output)} | ${millions(sum.cacheRead)} | ${millions(sum.cacheWrite)} |`,
    ),
  ];
}

/** Every .jsonl file under a folder, as full paths. */
function recordsUnder(folder) {
  const found = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...recordsUnder(path));
    else if (entry.name.endsWith('.jsonl')) found.push(path);
  }
  return found;
}

/** Reads every record under `dir` whose top folder's name contains `match`, and returns the replies in the dates. */
async function collect({ dir, match, since, until }) {
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().includes(match.toLowerCase()))
    .map((entry) => entry.name);
  const seen = new Set();
  const replies = [];
  let files = 0;
  for (const folder of folders) {
    for (const file of recordsUnder(join(dir, folder))) {
      files += 1;
      // A worker's record sits in its own file; a line can also be marked as a worker's.
      const workerFile = relative(join(dir, folder), file).split(sep).length > 1;
      const inFile = [];
      let row = null;
      const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.includes('"usage"') && !line.includes('Row:')) continue;
        const read = readLine(line);
        if (read?.row && row === null) row = read.row;
        if (!read?.reply || seen.has(read.reply.id)) continue;
        seen.add(read.reply.id);
        if (inDates(read.reply.day, since, until)) inFile.push(read.reply);
      }
      // Show the folder from the project's name on, without the path to it on this PC.
      const shown = folder.slice(folder.toLowerCase().indexOf(match.toLowerCase()));
      for (const reply of inFile) replies.push({ ...reply, folder: shown, worker: reply.worker || workerFile, row });
    }
  }
  return { replies, files, folders: folders.length };
}

function argsOf(argv) {
  const value = (flag, fallback) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback);
  return {
    dir: value('--dir', join(homedir(), '.claude', 'projects')),
    match: value('--match', 'grimoire'),
    since: value('--since', ''),
    until: value('--until', ''),
    json: argv.includes('--json'),
  };
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const { replies, files, folders } = await collect(args);
  const { total, groups } = summarise(replies);
  if (args.json) {
    console.log(JSON.stringify({ files, folders, total, groups }, null, 2));
    return;
  }
  const dates = args.since || args.until ? `${args.since || 'the start'} to ${args.until || 'now'}` : 'all dates';
  console.log(`Usage report: ${files} session records in ${folders} folders, ${total.replies} replies, ${dates}.`);
  console.log('Shares are rough input-token equivalents; cloud sessions are not counted.\n');
  console.log([...tableFor('Day', groups.day, total, { byName: true }), ''].join('\n'));
  console.log([...tableFor('Model', groups.model, total), ''].join('\n'));
  console.log([...tableFor('Session folder, and who replied', groups.session, total), ''].join('\n'));
  console.log([...tableFor('History carried by each reply', groups.history, total), ''].join('\n'));
  console.log(tableFor('Plan row (from "Row: <id>" in a brief)', groups.row, total).join('\n'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}

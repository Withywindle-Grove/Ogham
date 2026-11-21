// Claude Code hook (.claude/settings.json, UserPromptSubmit): tells a session when its conversation has grown long
// (Francis, 2026-11-17, from docs/reviewer/project-review-2026-11-17.md: almost half of all usage went to replies
// carrying more than 400,000 tokens of history). Past the limit, each message comes with one line. A worker started
// from a brief (cloud seats included) finishes its task and never stops for it; only the driver, or another session
// Francis talks to directly, brings its handover up to date and says it is time for a fresh session (Francis, 18 Nov).
//
// How it counts: the last reply in the session's own record says how many tokens it read before answering (new input,
// plus what was read from the cache, plus what was written to it). That is the history the next reply will carry.
// It reads only those numbers, from the end of the record. A worker's replies inside the record are skipped.
//
// It never blocks: on anything it can't read it says nothing and lets the message through.
// Claude Code passes the event as JSON on stdin; what this prints on stdout is added to what the session reads.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Past this many tokens of history, the session is warned (250,000 since 18 Nov; was 150,000, rvw-5). */
export const LIMIT = 250_000;

/** How much of the end of the record is read, in bytes: enough to reach the last reply past a few large tool results. */
export const TAIL_BYTES = 4_000_000;

/** The history carried by the last reply of the session itself in these lines (newest last), or null if none is found. */
export function carriedBy(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes('"usage"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // The first line of the tail is usually cut in half.
    }
    const usage = entry?.message?.usage;
    if (entry?.type !== 'assistant' || entry.isSidechain === true || !usage) continue;
    return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  return null;
}

/** The line to add to the session's reading, or '' when the conversation is still short. */
export function messageFor(carried, limit = LIMIT) {
  if (carried === null || carried < limit) return '';
  const thousands = Math.round(carried / 1000);
  return (
    `This conversation now carries about ${thousands},000 tokens of history; the limit is ${limit / 1000},000 ` +
    '(.claude/README.md, Short conversations). A worker started from a brief (builder, reviewer, tester, docs-sync, ' +
    'pack worker, or any cloud session) carries on and finishes its task: it does not stop, hand over or start a fresh ' +
    'session because of this line, and just keeps its replies lean. Only the driver, or another session Francis talks ' +
    'to directly, brings its handover up to date at the next natural stop and tells Francis in one line that it is ' +
    'time for a fresh session.'
  );
}

/** The last `bytes` of a file, as lines. */
function tailOf(path, bytes = TAIL_BYTES) {
  const file = openSync(path, 'r');
  try {
    const size = fstatSync(file).size;
    const length = Math.min(size, bytes);
    const buffer = Buffer.alloc(length);
    readSync(file, buffer, 0, length, size - length);
    return buffer.toString('utf8').split('\n');
  } finally {
    closeSync(file);
  }
}

function main() {
  try {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (input += chunk));
    process.stdin.on('end', () => {
      try {
        const path = JSON.parse(input)?.transcript_path;
        const message = path ? messageFor(carriedBy(tailOf(path))) : '';
        if (message) console.log(message);
      } catch {
        // Say nothing: a warning that fails must never stop a message.
      }
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}

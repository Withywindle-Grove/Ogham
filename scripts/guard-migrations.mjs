// Claude Code hook (.claude/settings.json, PreToolUse on Edit and Write): blocks changes to a database migration that
// has already been applied, meaning any file in supabase/migrations/ that is already on main. Applied migrations are
// never edited (CLAUDE.md, Database changes); the fix is a new migration. New migration files are allowed.
// Claude Code passes the tool call as JSON on stdin; exit code 2 blocks it and shows the message on stderr.
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** The migration's file name if the path is inside supabase/migrations/, otherwise null. */
export function migrationName(filePath) {
  if (typeof filePath !== 'string') return null;
  const match = /(?:^|\/)supabase\/migrations\/([^/]+)$/.exec(filePath.replace(/\\/g, '/'));
  return match ? match[1] : null;
}

/** The block message, or null to let the edit through. `isOnMain(name)` says whether main already has that file. */
export function decide(input, isOnMain) {
  const name = migrationName(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path);
  if (!name || !isOnMain(name)) return null;
  return (
    `Blocked: supabase/migrations/${name} is already on main, so it has been applied and must not be edited.\n` +
    'Write a new migration that fixes forward instead (supabase/CLAUDE.md).'
  );
}

/** True when main (local or GitHub's copy) has this migration. */
function onMain(name, cwd) {
  for (const ref of ['main', 'origin/main']) {
    try {
      execFileSync('git', ['cat-file', '-e', `${ref}:supabase/migrations/${name}`], { cwd, stdio: 'ignore' });
      return true;
    } catch {
      // Not on this ref (or the ref doesn't exist here): try the next one.
    }
  }
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let input = {};
  try {
    // Read stdin as a stream: a plain synchronous read can fail on Windows pipes.
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    const BOM = String.fromCharCode(0xfeff);
    input = JSON.parse(text.replace(BOM, '').trim() || '{}');
  } catch {
    process.exit(0); // Not a tool call we understand: let it through.
  }
  const repo = process.env.CLAUDE_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const message = decide(input, (name) => onMain(name, repo));
  if (message) {
    console.error(message);
    process.exit(2);
  }
  process.exit(0);
}

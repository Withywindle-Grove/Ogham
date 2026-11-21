// Claude Code hook (.claude/settings.json, PostToolUse on Write and Edit): runs `npm run typecheck` after a file under
// src/ changes, so a type error shows up at once instead of at the next npm run check. Other paths are skipped.
// Claude Code passes the tool call as JSON on stdin; on a type error this exits 2 and prints the first lines on stderr,
// which Claude Code shows to the model (the edit has already happened; nothing is undone). It takes about 7 seconds.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repoPath } from './check-names.mjs';

/** True when the tool call changed a file under src/ (in this repo or a helper worktree of it). */
export function touchesSrc(input, projectDir) {
  const path = repoPath(input?.tool_input?.file_path, projectDir);
  return Boolean(path && path.startsWith('src/'));
}

/** The first `max` lines of the typecheck's output that say something (npm's own "> script" banner lines dropped). */
export function firstLines(text, max = 20) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.startsWith('> '))
    .slice(0, max)
    .join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let input = {};
  try {
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    input = JSON.parse(text.replace(String.fromCharCode(0xfeff), '').trim() || '{}');
  } catch {
    process.exit(0);
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (!touchesSrc(input, projectDir)) process.exit(0);
  // Typecheck the copy that was edited: a helper worktree has its own tsconfig and src/.
  const file = resolve(projectDir, input.tool_input.file_path);
  const worktree = /^(.*[\\/]\.claude[\\/]worktrees[\\/][^\\/]+)[\\/]/.exec(file);
  const cwd = worktree ? worktree[1] : projectDir;
  const result = spawnSync('npm run typecheck', { cwd, shell: true, encoding: 'utf8' });
  if (result.status === 0) process.exit(0);
  console.error(`npm run typecheck failed after this edit. First lines:\n${firstLines(`${result.stdout}\n${result.stderr}`)}`);
  process.exit(2);
}

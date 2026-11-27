// Turns the git hooks on for this worktree only (npm run hooks:install). See docs/testing.md, "Git hooks".
// It writes core.hooksPath into this worktree's own config (extensions.worktreeConfig + `git config --worktree`), as
// an absolute path to this worktree's .githooks: other worktrees of the same clone keep their own setting, and the
// hooks that run are those of the branch this worktree has checked out (docs/09-decisions-log.md, [process], 27 Nov).
// In a clone with one worktree (a PC), `--worktree` writes the same file as before. Nothing is installed.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const top = git('rev-parse', '--show-toplevel');
const hooks = join(top, '.githooks').replaceAll('\\', '/');
if (!existsSync(join(hooks, 'pre-commit'))) {
  console.error(`No .githooks/pre-commit in ${top}: nothing to turn on.`);
  process.exit(1);
}
// Lets each worktree have its own config. It changes no setting of any worktree (docs: git-worktree, CONFIGURATION).
git('config', 'extensions.worktreeConfig', 'true');
git('config', '--worktree', 'core.hooksPath', hooks);
console.log(`Git hooks on for this worktree: ${hooks}`);

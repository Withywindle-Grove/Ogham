// The environment for a test that runs git in a throwaway repository: every GIT_* variable left out.
// Inside a git hook (the pre-commit hook runs the full check), git exports GIT_DIR, GIT_INDEX_FILE and others; a
// test's own `git init` / `commit` / `checkout -b` would follow them and act on the real repository instead.
/** A copy of `env` (process.env by default) without any variable whose name starts with GIT_, plus `extra`. */
export function withoutGitVariables(env = process.env, extra = {}) {
  const kept = Object.entries(env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'));
  return { ...Object.fromEntries(kept), ...extra };
}

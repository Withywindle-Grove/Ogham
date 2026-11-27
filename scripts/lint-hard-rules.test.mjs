// The hard-rule lint checks in eslint.config.js (docs/specs/hard-rule-and-size-checks.md), tried on planted files with
// the project's own lint settings. Planted examples are invented (hard rule 2).
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = fileURLToPath(new URL('..', import.meta.url));

async function lint(code, filePath) {
  const eslint = new ESLint({ cwd: repo });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.severity === 2).map((m) => m.message);
}

const DISABLED_MESSAGE = 'Never a disabled button (hard rule 10): keep it tappable and explain why in a pop-up.';

describe('check 4: no disabled attribute (hard rule 10)', () => {
  // A component in the app that writes `disabled` on a control fails lint, and the message says what to do instead.
  it('fails a planted component with a disabled button, with the message', async () => {
    const code = 'export function LanternButton() {\n  return <button disabled>Light the lantern</button>;\n}\n';
    expect(await lint(code, 'src/ui/PlantedLantern.tsx')).toEqual([DISABLED_MESSAGE]);
  });

  // A test file may render a disabled control (for example to prove a screen never shows one), so it is not checked.
  it('leaves test files alone', async () => {
    const code = 'export function LanternButton() {\n  return <button disabled>Light the lantern</button>;\n}\n';
    expect(await lint(code, 'src/ui/PlantedLantern.test.tsx')).toEqual([]);
  });

  // An old case recorded in the suppressions file passes; once it is fixed, the check fails until its record is pruned.
  it('passes a recorded old case, and fails when the case is fixed but its record stays', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tome-lint-'));
    try {
      mkdirSync(join(dir, 'src', 'ui'), { recursive: true });
      const config = pathToFileURL(join(repo, 'eslint.config.js')).href;
      writeFileSync(join(dir, 'eslint.config.js'), `export { default } from '${config}';\n`);
      const planted = join(dir, 'src', 'ui', 'PlantedLantern.tsx');
      writeFileSync(planted, 'export function LanternButton() {\n  return <button disabled>Light</button>;\n}\n');
      const known = { 'src/ui/PlantedLantern.tsx': { 'tome/no-disabled': { count: 1 } } };
      writeFileSync(join(dir, 'eslint-suppressions.json'), JSON.stringify(known));
      const eslintCli = join(repo, 'node_modules', 'eslint', 'bin', 'eslint.js');
      const run = () => spawnSync(process.execPath, [eslintCli, '.'], { cwd: dir, encoding: 'utf8' });

      expect(run().status).toBe(0);

      writeFileSync(planted, 'export function LanternButton() {\n  return <button>Light</button>;\n}\n');
      const stale = run();
      expect(stale.status).not.toBe(0);
      expect(stale.stdout + stale.stderr).toContain('There are suppressions left that do not occur anymore');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

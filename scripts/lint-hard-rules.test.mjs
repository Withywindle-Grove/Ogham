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

const CORE_LIST_MESSAGE =
  'Modules use only the allowed core files (hard rule 6). To use another core file, add it to ALLOWED_CORE_FILES in eslint.config.js in a reviewed change.';

describe('check 1: modules use only the allowed core files (hard rule 6)', () => {
  // A module that imports a core file not on the allowed list fails lint, and the message says how to add one.
  it('fails a planted module importing an unlisted core file, with the message', async () => {
    const code = "import { brewLantern } from '../../core/lanternBrewery.ts';\nexport const lit = brewLantern;\n";
    expect(await lint(code, 'src/modules/bogwatch/plantedLantern.ts')).toEqual([expect.stringContaining(CORE_LIST_MESSAGE)]);
  });

  // The same holds when the import leaves out the file's ending, or reaches into a folder inside core.
  it('fails an unlisted core file written without its ending or inside a folder', async () => {
    const code =
      "import { a } from '../../core/lanternBrewery';\nimport { b } from '../../core/deep/commands.ts';\nexport const c = [a, b];\n";
    expect(await lint(code, 'src/modules/bogwatch/plantedLantern.ts')).toEqual([
      expect.stringContaining(CORE_LIST_MESSAGE),
      expect.stringContaining(CORE_LIST_MESSAGE),
    ]);
  });

  // A module that imports listed core files (values and types alike) passes.
  it('passes a planted module importing listed core files', async () => {
    const code =
      "import { runCommand } from '../../core/commands.ts';\nimport type { Json } from '../../core/database.types.ts';\nexport const run: (j: Json) => unknown = runCommand as never;\n";
    expect(await lint(code, 'src/modules/bogwatch/plantedLantern.ts')).toEqual([]);
  });

  // The other direction is unchanged: core still may not import a module.
  it('still fails core importing a module', async () => {
    const code = "import { lantern } from '../modules/bogwatch/lantern.ts';\nexport const l = lantern;\n";
    expect(await lint(code, 'src/core/plantedLantern.ts')).toEqual([
      expect.stringContaining('Core never imports a module (hard rule 6). Use the registry.'),
    ]);
  });
});

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

// N lines of plain code, every one counted (blank lines and comments count too).
const linesOf = (n) => Array.from({ length: n }, (_, i) => (i % 3 === 2 ? '' : `export const lantern${i} = ${i};`)).join('\n');

describe('check 8: no source file over 400 lines (cs-10)', () => {
  // A source file of 401 lines fails lint and says how long it is; one of 400 passes.
  it('fails a planted source file of 401 lines and passes one of 400', async () => {
    expect(await lint(linesOf(401), 'src/core/plantedLantern.ts')).toEqual([
      'File has too many lines (401). Maximum allowed is 400.',
    ]);
    expect(await lint(linesOf(400), 'src/core/plantedLantern.ts')).toEqual([]);
  });

  // Blank lines and comments count like any other line.
  it('counts blank lines and comments', async () => {
    const notes = Array.from({ length: 200 }, () => '// a note about the lantern');
    const blanks = Array.from({ length: 200 }, () => '');
    const code = [...notes, ...blanks, 'export const lit = true;'].join('\n');
    expect(await lint(code, 'src/ui/PlantedLantern.tsx')).toEqual([
      'File has too many lines (401). Maximum allowed is 400.',
    ]);
  });

  // Test files and the generated database types are long by nature, so they are not checked.
  it('leaves test files and the generated database types alone', async () => {
    expect(await lint(linesOf(401), 'src/ui/PlantedLantern.test.tsx')).toEqual([]);
    expect(await lint(linesOf(401), 'src/core/plantedLantern.test.ts')).toEqual([]);
    expect(await lint(linesOf(401), 'src/core/database.types.ts')).toEqual([]);
  });

  // A known long file recorded in the suppressions file stays quiet, even after it grows.
  it('passes a recorded long file, also when it grows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tome-lint-'));
    try {
      mkdirSync(join(dir, 'src', 'core'), { recursive: true });
      const config = pathToFileURL(join(repo, 'eslint.config.js')).href;
      writeFileSync(join(dir, 'eslint.config.js'), `export { default } from '${config}';\n`);
      const planted = join(dir, 'src', 'core', 'plantedLantern.ts');
      writeFileSync(planted, `${linesOf(450)}\n`);
      const known = { 'src/core/plantedLantern.ts': { 'max-lines': { count: 1 } } };
      writeFileSync(join(dir, 'eslint-suppressions.json'), JSON.stringify(known));
      const eslintCli = join(repo, 'node_modules', 'eslint', 'bin', 'eslint.js');
      const run = () => spawnSync(process.execPath, [eslintCli, '.'], { cwd: dir, encoding: 'utf8' });

      expect(run().status).toBe(0);

      writeFileSync(planted, `${linesOf(900)}\n`);
      expect(run().status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

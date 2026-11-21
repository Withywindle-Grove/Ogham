// npm run docs:gen: rewrites the generated references in docs/generated/ (commands.md and visibility-matrix.md)
// by running their tests with DOCS_GEN=1, which writes the files before checking them.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'src/testing/commandsDoc.test.ts', 'scripts/visibility-matrix.test.mjs'],
  { stdio: 'inherit', shell: true, env: { ...process.env, DOCS_GEN: '1' } },
);
if (result.status === 0) console.log('\nUpdated docs/generated/. Commit the changes with the code that caused them.');
process.exit(result.status ?? 1);

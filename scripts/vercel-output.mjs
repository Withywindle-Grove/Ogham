// Packages the built app (dist/) for Vercel, after checking it points at the expected Supabase project.
// Used by the deploy jobs in .github/workflows/check.yml: GitHub builds the app with the settings passed in
// directly, so nothing depends on Vercel handing settings to an outside build (it doesn't: that once shipped
// a build with no database address). Usage: node scripts/vercel-output.mjs <expected Supabase URL>
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const expected = (process.argv[2] ?? '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(expected)) {
  console.error('Refusing to package: no Supabase address was given for this build (is the GitHub variable or secret set?).');
  process.exit(1);
}
if (!existsSync('dist/index.html')) {
  console.error('Refusing to package: dist/ has no built app. Run npm run build first.');
  process.exit(1);
}

// The guard: the app's code must contain the expected address and a publishable key.
const code = readdirSync('dist/assets')
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(`dist/assets/${name}`, 'utf8'))
  .join('\n');
if (!code.includes(expected)) {
  console.error(`Refusing to package: the built app doesn't point at ${new URL(expected).hostname}.`);
  process.exit(1);
}
if (!/sb_publishable_[A-Za-z0-9_-]{8,}/.test(code)) {
  console.error('Refusing to package: the built app has no Supabase publishable key.');
  process.exit(1);
}

// Vercel's ready-made format (Build Output API v3): the files, and "any path → index.html" like vercel.json.
rmSync('.vercel/output', { recursive: true, force: true });
mkdirSync('.vercel/output', { recursive: true });
cpSync('dist', '.vercel/output/static', { recursive: true });
writeFileSync(
  '.vercel/output/config.json',
  JSON.stringify({ version: 3, routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' }] }, null, 2),
);
console.log(`Packaged for Vercel, pointing at ${new URL(expected).hostname}.`);

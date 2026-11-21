// Tests for the docs-only fast path (scripts/docs-only.mjs): which changes may skip the app's build, tests and layout.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CODE_READ_DOCS, isDocsOnly } from './docs-only.mjs';

const script = fileURLToPath(new URL('./docs-only.mjs', import.meta.url));

describe('is this change docs-only?', () => {
  // A change made only of docs, top-level Markdown and the agents' Markdown files skips the app check.
  it('says yes for docs, top-level Markdown, .claude Markdown and skills Markdown', () => {
    expect(isDocsOnly(['docs/09-decisions-log.md'])).toBe(true);
    expect(isDocsOnly(['docs/design/mockups/some-screen.png', 'docs/status/2026-11-05-x.md'])).toBe(true);
    expect(isDocsOnly(['README.md', 'CLAUDE.md', 'REVIEW.md', 'CHANGELOG.md'])).toBe(true);
    expect(isDocsOnly(['.claude/README.md', '.claude/agents/builder.md', '.claude/skills/design-session/SKILL.md'])).toBe(true);
    expect(isDocsOnly(['skills/pack-reader/SKILL.md'])).toBe(true);
  });

  // One code, config or CI file anywhere in the change means the full check.
  it.each([
    'src/app/App.tsx',
    'src/README.md',
    'scripts/docs-check.mjs',
    'supabase/migrations/20261105000000_x.sql',
    'tests/layout/gallery.spec.ts',
    'public/icon.svg',
    '.github/workflows/check.yml',
    '.githooks/pre-commit',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'tsconfig.json',
    '.nvmrc',
    '.claude/settings.json',
    'skills/content-pack-converter/scripts/crop.py',
    'index.html',
  ])('says no when the change also holds %s', (path) => {
    expect(isDocsOnly(['docs/09-decisions-log.md', path])).toBe(false);
  });

  // The generated references and the docs that code reads are checked by tests, so they need the full check.
  it('says no for docs/generated/ and for every doc the code reads', () => {
    expect(isDocsOnly(['docs/generated/commands.md'])).toBe(false);
    for (const path of CODE_READ_DOCS) expect(isDocsOnly(['docs/01-product-brief.md', path])).toBe(false);
  });

  // When nothing is listed (or git gave nothing), everything runs, to be safe.
  it('says no for an empty list', () => {
    expect(isDocsOnly([])).toBe(false);
    expect(isDocsOnly(['', '  '])).toBe(false);
  });

  // Windows paths and blank lines from a pasted list are read the same way.
  it('reads backslashes and skips blank lines', () => {
    expect(isDocsOnly(['docs\\plans\\x.md', '', 'README.md'])).toBe(true);
    expect(isDocsOnly(['src\\core\\x.ts', ''])).toBe(false);
  });

  // The command line prints docs or code for a list on stdin, as the GitHub check's changes job reads it.
  it('prints docs or code for a list on stdin', () => {
    const run = (input) => execFileSync(process.execPath, [script], { input, encoding: 'utf8' }).trim();
    expect(run('docs/a.md\nREADME.md\n')).toBe('docs');
    expect(run('docs/a.md\nsrc/main.tsx\n')).toBe('code');
    expect(run('')).toBe('code');
  });
});

// Files that read docs only to check that the docs check itself finds things (docs:check runs on the fast path).
const READERS_EXEMPT = ['scripts/docs-check.mjs', 'scripts/docs-check.test.mjs', 'scripts/docs-only.mjs', 'scripts/docs-only.test.mjs'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name).replace(/\\/g, '/');
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
}

describe('the list of docs that code reads', () => {
  // A new import or read of a doc in src/, scripts/, supabase/ or tests/ must be added to CODE_READ_DOCS (or live
  // in docs/generated/), or a docs-only commit could change the app or break a test without running it.
  it('names every existing doc that code imports or reads', () => {
    const missing = [];
    for (const file of ['src', 'scripts', 'supabase', 'tests'].flatMap(walk)) {
      if (READERS_EXEMPT.includes(file)) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const m of line.matchAll(/['"`](?:\.\.\/|\.\/)*(docs\/[^'"`?]+)(?:\?raw)?['"`]/g)) {
          const doc = m[1];
          if (!existsSync(doc) || statSync(doc).isDirectory() || doc.startsWith('docs/generated/')) continue;
          if (!CODE_READ_DOCS.includes(doc)) missing.push(`${file} reads ${doc}`);
        }
      });
    }
    expect(missing).toEqual([]);
  });

  // The list doesn't keep docs that no longer exist (a renamed plan would silently drop out of the full check).
  it('names only docs that exist', () => {
    for (const path of CODE_READ_DOCS) expect(existsSync(path), path).toBe(true);
  });
});

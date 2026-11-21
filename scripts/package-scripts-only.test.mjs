// Tests for scripts/package-scripts-only.mjs: a package.json change inside "scripts" alone is not a screen change.
import { describe, expect, it } from 'vitest';
import { isScriptsOnly } from './package-scripts-only.mjs';

const base = {
  name: 'x',
  version: '1.0.0',
  scripts: { test: 'vitest', build: 'vite build' },
  dependencies: { react: '^18.0.0' },
  devDependencies: { vitest: '^1.0.0' },
};
const text = (o) => JSON.stringify(o, null, 2);

describe('is a package.json change scripts-only?', () => {
  // Editing or adding a script is the case this exists for: the pictures cannot change.
  it('says yes when only the scripts block changed', () => {
    const after = { ...base, scripts: { ...base.scripts, check: 'node scripts/x.mjs' } };
    expect(isScriptsOnly(text(base), text(after))).toBe(true);
  });

  // A new dependency can change the app, so the pictures must run.
  it('says no when a dependency was added', () => {
    const after = { ...base, dependencies: { ...base.dependencies, lodash: '^4.0.0' } };
    expect(isScriptsOnly(text(base), text(after))).toBe(false);
  });

  // A version bump of a dev tool (say the test browser) can change the pictures.
  it('says no when a devDependency version changed', () => {
    const after = { ...base, devDependencies: { vitest: '^2.0.0' } };
    expect(isScriptsOnly(text(base), text(after))).toBe(false);
  });

  // Any other top-level key (version, engines, ...) is not the scripts block.
  it('says no when another top-level key changed', () => {
    expect(isScriptsOnly(text(base), text({ ...base, version: '1.0.1' }))).toBe(false);
    expect(isScriptsOnly(text(base), text({ ...base, engines: { node: '20' } }))).toBe(false);
  });

  // When the text cannot be read, the safe answer is no, so the pictures run.
  it('says no for bad JSON on either side', () => {
    expect(isScriptsOnly('{ nope', text(base))).toBe(false);
    expect(isScriptsOnly(text(base), '')).toBe(false);
  });

  // Moving keys around is not a real change.
  it('says yes when only the key order changed', () => {
    const reordered = {
      devDependencies: base.devDependencies,
      dependencies: base.dependencies,
      scripts: { build: 'vite build', test: 'vitest' },
      version: base.version,
      name: base.name,
    };
    expect(isScriptsOnly(text(base), text(reordered))).toBe(true);
  });
});

// Tests for the quick check's choice of files (scripts/check-quick.mjs): what eslint and `vitest related` get.
import { describe, expect, it } from 'vitest';
import { changedPaths, pickFiles, testBudget } from './check-quick.mjs';

describe('the quick check keeps its tests within a budget', () => {
  // The budget is 150 seconds unless OGHAM_QUICK_TEST_SECS gives a whole number above 0.
  it('reads the budget from OGHAM_QUICK_TEST_SECS, or takes 150 s', () => {
    expect(testBudget(undefined)).toBe(150);
    expect(testBudget('60')).toBe(60);
    expect(testBudget('0')).toBe(150);
    expect(testBudget('soon')).toBe(150);
    expect(testBudget('2.5')).toBe(150);
  });
});

describe('the quick check picks its files', () => {
  // A path changed in a commit, staged and unstaged is checked once, whichever lists name it.
  it('takes each changed path once from all the lists git gives', () => {
    expect(changedPaths(['src/a.ts\nsrc/b.tsx\n', 'src/a.ts\n', '', 'scripts/c.mjs\nsrc/b.tsx'])).toEqual([
      'scripts/c.mjs',
      'src/a.ts',
      'src/b.tsx',
    ]);
  });

  // Code files go to eslint; source and test files under src/ and scripts/ go to the related tests; docs go to neither.
  it('sends code to eslint and src or scripts files to the related tests', () => {
    const paths = ['docs/a-note.md', 'src/core/x.ts', 'src/ui/Y.tsx', 'scripts/z.test.mjs', 'tests/layout/g.spec.ts', 'eslint.config.js'];
    expect(pickFiles(paths, () => true)).toEqual({
      lint: ['src/core/x.ts', 'src/ui/Y.tsx', 'scripts/z.test.mjs', 'tests/layout/g.spec.ts', 'eslint.config.js'],
      related: ['src/core/x.ts', 'src/ui/Y.tsx', 'scripts/z.test.mjs'],
    });
  });

  // A file that no longer exists on disk (deleted or renamed away) is left out of both.
  it('leaves out files that are gone', () => {
    expect(pickFiles(['src/gone.ts', 'src/here.ts'], (path) => path === 'src/here.ts')).toEqual({
      lint: ['src/here.ts'],
      related: ['src/here.ts'],
    });
  });
});

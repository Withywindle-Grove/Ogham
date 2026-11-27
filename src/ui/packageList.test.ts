// Check 3 (hard rule 9; docs/specs/hard-rule-and-size-checks.md): the packages in package.json are exactly the ones
// listed in docs/02-architecture.md, "Packages". Only names are compared, never versions.
import { describe, expect, it } from 'vitest';
import { packageProblems } from './packageList.ts';

// Node's file reader is loaded by name so the app's type settings needn't include Node (as in designSystem.test.ts).
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };

const doc = (app: string[], dev: string[]) =>
  ['# 02', '', '## Stack', '', '- `left-out-pkg` (a bullet before the list)', '', '## Packages', '', '### App packages', '', ...app.map((p) => `- \`${p}\``), '', '### Dev-only packages', '', ...dev.map((p) => `- \`${p}\``), '', '## Foundation 1', '', '- `not-a-package`'].join('\n');

describe('packages equal the list in 02 (hard rule 9)', () => {
  // Purpose: a package someone installs without adding it to 02's list fails, and the message names it and the side.
  it('a package only in package.json fails, naming the package and the side it is missing from', () => {
    const problems = packageProblems(doc(['lantern-kit'], ['bog-tester']), { dependencies: { 'lantern-kit': '^1.0.0', 'warden-bells': '^2.0.0' }, devDependencies: { 'bog-tester': '1.0.0' } });
    expect(problems).toEqual(['`warden-bells` is in package.json (dependencies) but missing from the list in docs/02-architecture.md (App packages)']);
  });

  // Purpose: a package listed in 02 but no longer installed fails too, so the list never claims more than is there.
  it('a package only in the list fails, naming the package and the side it is missing from', () => {
    const problems = packageProblems(doc(['lantern-kit'], ['bog-tester', 'mire-lint']), { dependencies: { 'lantern-kit': '^1.0.0' }, devDependencies: { 'bog-tester': '1.0.0' } });
    expect(problems).toEqual(['`mire-lint` is in the list in docs/02-architecture.md (Dev-only packages) but missing from package.json (devDependencies)']);
  });

  // Purpose: an app package listed as dev-only (or the other way round) fails with one message saying to move it.
  it('a package on the wrong side of the list fails once, saying where it is listed and where it is installed', () => {
    const problems = packageProblems(doc([], ['lantern-kit']), { dependencies: { 'lantern-kit': '^1.0.0' }, devDependencies: {} });
    expect(problems).toEqual(['`lantern-kit` is listed in docs/02-architecture.md (Dev-only packages) but installed in package.json (dependencies): move it to one side']);
  });

  // Purpose: a package in a group the list doesn't cover (optional, peer or bundled) fails instead of passing unseen.
  it('an optional, peer or bundled package fails, naming the group', () => {
    const problems = packageProblems(doc(['lantern-kit'], []), {
      dependencies: { 'lantern-kit': '^1.0.0' },
      optionalDependencies: { 'mire-glow': '^1.0.0' },
      peerDependencies: { 'warden-core': '*' },
      bundleDependencies: ['lantern-kit'],
    });
    expect(problems).toEqual([
      'package.json has optionalDependencies (mire-glow): the list in docs/02-architecture.md has app and dev-only packages only',
      'package.json has peerDependencies (warden-core): the list in docs/02-architecture.md has app and dev-only packages only',
      'package.json has bundleDependencies (lantern-kit): the list in docs/02-architecture.md has app and dev-only packages only',
    ]);
  });

  // Purpose: only the name is compared, so a version bump never needs a docs change; bullets in the sections before and
  // after the list don't count.
  it('versions are not compared, and only the Packages section is read', () => {
    const problems = packageProblems(doc(['@grove/lantern-kit'], ['bog-tester']), { dependencies: { '@grove/lantern-kit': '^9.9.9' }, devDependencies: { 'bog-tester': '0.0.1' } });
    expect(problems).toEqual([]);
  });

  // Purpose: a 02 without the list fails plainly instead of passing by accident.
  it('a 02 without the Packages heading fails', () => {
    expect(packageProblems('# 02\n\n## Stack\n', { dependencies: {}, devDependencies: {} })).toEqual(['docs/02-architecture.md has no "## Packages" list with "### App packages" and "### Dev-only packages"']);
  });

  // Purpose: the real repository passes: what is installed is exactly what 02 lists.
  it('the real package.json matches the list in docs/02-architecture.md', () => {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8')) as Parameters<typeof packageProblems>[1];
    expect(packageProblems(fs.readFileSync('./docs/02-architecture.md', 'utf8'), pkg)).toEqual([]);
  });
});

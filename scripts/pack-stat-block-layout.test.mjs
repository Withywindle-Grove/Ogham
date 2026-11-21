// The stat block layout check of npm run pack:check (scripts/pack-stat-block-layout.mjs; pf-13 and pf-13a, plan
// docs/plans/dec-pack-check-stat-block-layout.md): `meta.statBlockLayout`, its `groups` three levels deep, `hp`
// reserved. Every name is invented.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { statBlockLayoutFindings } from './pack-stat-block-layout.mjs';

const lurker = { id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', fields: { Size: 'Large', Guard: '6', Move: 'Slow', Bite: '1d6' } };
const wisp = { id: 'reed-wisp', name: 'Reed wisp', hp: '1d8', fields: { Size: 'Small', Glow: 'Pale' }, variants: [{ name: 'elder', fields: { Chill: 'Deep' } }] };
const pack = (statBlockLayout, extra = {}) => ({
  meta: { name: 'Fen creatures', ...(statBlockLayout === undefined ? {} : { statBlockLayout }) },
  statBlocks: [lurker, wisp],
  ...extra,
});
const fixture = (which) => `scripts/fixtures/stat-block-layout-${which}.fixture.json`;
const run = (path) => spawnSync('node', ['scripts/check-pack.mjs', path], { encoding: 'utf8' });

describe('meta.statBlockLayout in pack:check', () => {
  // Purpose: a pack with no layout anywhere gets no error and no warning, so it reports as it did before.
  it('a pack with no layout gives no findings', () => {
    expect(statBlockLayoutFindings(pack(undefined))).toEqual({ errors: [], warnings: [] });
    expect(statBlockLayoutFindings(null)).toEqual({ errors: [], warnings: [] });
  });

  // Purpose: a layout at the file's top level is an error that says to move it into meta (the app ignores it there).
  it('a layout at the top level is an error that says to move it into meta', () => {
    const { errors } = statBlockLayoutFindings({ ...pack(undefined), statBlockLayout: { groups: [[['Guard']]] } });
    expect(errors).toEqual([expect.stringMatching(/top level.*move it into meta/)]);
  });

  // Purpose: a layout that isn't an object is an error.
  it('a layout that is not an object is an error', () => {
    for (const bad of [['Guard'], 'Guard', 3, null])
      expect(statBlockLayoutFindings(pack(bad)).errors).toEqual([expect.stringMatching(/meta\.statBlockLayout should be an object/)]);
  });

  // Purpose: a valid three-level layout, with hp and fields from a variant, passes silently.
  it('a valid three-level layout passes silently', () => {
    const layout = { descriptor: ['Size'], groups: [[['hp', 'Guard'], ['Move']], [['Bite', 'Chill']]], hide: ['Glow'] };
    expect(statBlockLayoutFindings(pack(layout))).toEqual({ errors: [], warnings: [] });
  });

  // Purpose: two-level groups (a list of lists of field names) is an error that names the group.
  it('two-level groups is an error naming the group', () => {
    const { errors } = statBlockLayoutFindings(pack({ groups: [[['Guard']], ['Move', 'Bite']] }));
    expect(errors).toEqual([expect.stringMatching(/groups, group 2 holds field names directly.*three levels deep/)]);
  });

  // Purpose: groups that aren't a list, and a group that isn't a list of lines, are errors.
  it('groups that are not a list, or a group that is not a list, are errors', () => {
    expect(statBlockLayoutFindings(pack({ groups: 'Guard' })).errors).toEqual([expect.stringMatching(/groups should be a list of groups/)]);
    expect(statBlockLayoutFindings(pack({ groups: ['Guard'] })).errors).toEqual([expect.stringMatching(/group 1 should be a list of lines/)]);
  });

  // Purpose: a non-string in descriptor, hide or a line is an error naming where it is.
  it('a non-string in descriptor, hide or a line is an error naming the key or line', () => {
    expect(statBlockLayoutFindings(pack({ descriptor: ['Size', 4] })).errors).toEqual([expect.stringMatching(/statBlockLayout\.descriptor should be a list/)]);
    expect(statBlockLayoutFindings(pack({ hide: 'Glow' })).errors).toEqual([expect.stringMatching(/statBlockLayout\.hide should be a list/)]);
    expect(statBlockLayoutFindings(pack({ groups: [[['Guard'], ['Move', { name: 'Bite' }]]] })).errors).toEqual([
      expect.stringMatching(/group 1, line 2 should hold field names only/),
    ]);
    expect(statBlockLayoutFindings(pack({ groups: [[['Guard'], 7]] })).errors).toEqual([expect.stringMatching(/group 1, line 2 should be a list of field names/)]);
  });

  // Purpose: a field no creature carries is a warning naming it, wherever it sits; hp never is.
  it('a field no creature carries is a warning naming it; hp is not', () => {
    const { errors, warnings } = statBlockLayoutFindings(pack({ descriptor: ['Sise'], groups: [[['hp', 'Guard']]], hide: ['Lantern'] }));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringMatching(/"Sise" isn't a field any creature/), expect.stringMatching(/"Lantern" isn't a field any creature/)]);
  });

  // Purpose: a field placed twice, or placed and hidden, is a warning.
  it('a field placed twice, or both placed and hidden, is a warning', () => {
    const { warnings } = statBlockLayoutFindings(pack({ descriptor: ['Size'], groups: [[['Guard', 'Size']], [['Guard', 'Move']]], hide: ['Move'] }));
    expect(warnings).toEqual([
      expect.stringMatching(/"Size" is placed more than once/),
      expect.stringMatching(/"Guard" is placed more than once/),
      expect.stringMatching(/"Move" is both placed and hidden/),
    ]);
  });

  // Purpose: a key other than descriptor, groups and hide is a warning naming it.
  it('an unknown key is a warning naming it', () => {
    const { errors, warnings } = statBlockLayoutFindings(pack({ groups: [[['Guard']]], order: ['Guard'] }));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringMatching(/has "order", which isn't one of descriptor, groups, hide/)]);
  });
});

describe('npm run pack:check with a stat block layout', () => {
  // Purpose: a pack file with no layout prints no layout section and exits 0, as before.
  it('a file with no layout prints nothing about it and exits 0', () => {
    const out = run('scripts/fixtures/pack-check-shapes-rules.fixture.json');
    expect(out.status).toBe(0);
    expect(out.stdout).not.toMatch(/Stat block layout/);
  });

  // Purpose: a valid layout in meta adds nothing to the report: the output matches the same file without it.
  it('a valid layout in meta prints exactly what the same file without it prints', () => {
    const file = JSON.parse(readFileSync(fixture('meta'), 'utf8'));
    delete file.meta.statBlockLayout;
    const bare = join(mkdtempSync(join(tmpdir(), 'layout-')), 'stat-block-layout-meta.fixture.json');
    writeFileSync(bare, JSON.stringify(file));
    const withLayout = run(fixture('meta'));
    expect(withLayout.status).toBe(0);
    expect(withLayout.stdout).toBe(run(bare).stdout);
  });

  // Purpose: a layout at the top level is printed as one to fix, saying move it into meta, and the exit code is 1.
  it('a layout at the top level prints the error and exits 1', () => {
    const out = run(fixture('top'));
    expect(out.status).toBe(1);
    expect(out.stdout).toMatch(/Stat block layout, to fix \(1\):\n {2}- statBlockLayout is at the top level.*move it into meta\./);
  });

  // Purpose: warnings alone leave the exit code at 0.
  it('a layout with only warnings exits 0 and lists them', () => {
    const file = JSON.parse(readFileSync(fixture('meta'), 'utf8'));
    file.meta.statBlockLayout.hide = ['Lantern'];
    const path = join(mkdtempSync(join(tmpdir(), 'layout-')), 'typo.fixture.json');
    writeFileSync(path, JSON.stringify(file));
    const out = run(path);
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/Stat block layout notes \(1\):\n {2}- meta\.statBlockLayout: "Lantern" isn't a field/);
  });
});


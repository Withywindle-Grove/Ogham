// pack:check on uncommon spells when several files are checked together (#486's cloud review, rv-2, finding 2): a file's
// own "check it together" notes would repeat or contradict the together run, so in a run of several files they are left
// out, as the carry-bonus notes already are; a file checked alone prints what it always printed. Invented fixtures.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (...files) => {
  try {
    return execFileSync(process.execPath, ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });
  } catch (error) {
    return String(error.stdout);
  }
};
const SPELLS = 'scripts/fixtures/pack-check-after-gate.fixture.json';
const REGION = 'scripts/fixtures/pack-check-after-gate-region.fixture.json';
const count = (text, part) => text.split(part).length - 1;

describe('uncommon spells checked together', () => {
  // Purpose: with the region pack in the same run, the place it has is named nowhere, and each unknown id prints once,
  // under "Library notes".
  it('names a place another file has nowhere, and each unknown id once, under Library notes', () => {
    const out = run(SPELLS, REGION);
    expect(out).not.toContain('drowned-chapel');
    expect(out).not.toContain('check it together with the pack that has it');
    const library = out.slice(out.indexOf('Library notes'));
    const unknown = [...out.matchAll(/uncommon\.lists names "([^"]+)"/g)].map((m) => m[1]);
    expect(unknown.length).toBeGreaterThan(0);
    for (const id of new Set(unknown)) {
      expect(count(out, `uncommon.lists names "${id}"`)).toBe(1);
      expect(library).toContain(`uncommon.lists names "${id}"`);
    }
  });

  // Purpose: a file checked alone still asks to be checked with the pack that has the place, as before.
  it('still asks for the pack that has it when a file is checked alone', () => {
    const out = run(SPELLS);
    expect(out).toContain('uncommon.foundAt names the place "drowned-chapel", a location that isn\'t in this pack; check it together with the pack that has it');
    expect(out).not.toContain('Library notes');
  });
});

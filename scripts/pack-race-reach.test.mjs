// npm run pack:check on a class's raceMaxLevels (pg-2, ruled 2026-11-03): checked alone, an add-on's race ids are
// unknown (another pack may bring them); checked with its base pack, only the ids no pack has are. Warnings, exit 0.
// The fixtures are invented (scripts/fixtures/m5b-creation and m5b-0c-race-reach).
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const base = 'scripts/fixtures/m5b-creation.fixture.json';
const addOn = 'scripts/fixtures/m5b-0c-race-reach.fixture.json';
const check = (...files) => execFileSync('node', ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });

describe('pack:check and raceMaxLevels', () => {
  it('the add-on alone: each race id it names is a warning that another attached pack must supply it, and it still exits 0', () => {
    const out = check(addOn);
    expect(out).toMatch(/raceMaxLevels names "stone-kin", which isn't one of this pack's races\. Another attached pack must supply it/);
    expect(out).toMatch(/raceMaxLevels names "race-dune-walker", which isn't one of this pack's races/);
  });

  it('with the base pack: the base race is found, and only the race no pack has is a library warning', () => {
    const out = check(base, addOn);
    expect(out).toMatch(/=== The 2 packs together/);
    expect(out).toMatch(/raceMaxLevels names "race-dune-walker", which isn't a race in any of these packs\./);
    expect(out).not.toMatch(/"stone-kin", which isn't a race in any/);
  });
});

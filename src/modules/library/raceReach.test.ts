// A class reaching other packs' races (pg-2, ruled 2026-11-03; 07 "A class reaching other packs' races"): the one
// reader merges each class's raceMaxLevels into the races' classMaxLevels, and the checker warns on an unknown race
// id or a clash. Every name is invented (hard rule 2).
import { describe, expect, it } from 'vitest';
import { classesFor, classLevelCap } from '../characters/creation.ts';
import { whyNotOpen } from '../characters/creationSteps.ts';
import { readPackJson } from './packFile.ts';
import { classReachNotes, withClassReach } from './raceReach.ts';

type Data = Record<string, unknown>;
const race = (id: string, name: string, classMaxLevels?: Data) => ({ kind: 'race', packEntryId: id, name, data: classMaxLevels ? { classMaxLevels } : {} });
const klass = (id: string, name: string, data: Data = {}) => ({ kind: 'class', packEntryId: id, name, data });

// The base pack: two races that list their classes, one with no class limits.
const reedfolk = race('race-reedfolk', 'Reedfolk', { 'bog-mage': 6 });
const stoneKin = race('race-stone-kin', 'Stone kin', { 'bog-mage': 8 });
const plainFolk = race('race-plain-folk', 'Plain folk', {});
const bogMage = klass('bog-mage', 'Bog Mage');
// The add-on: a class that reaches the reedfolk (to 9), and a class with no cap for them.
const lanternWarden = klass('lantern-warden', 'Lantern Warden', { raceMaxLevels: { 'race-reedfolk': 9 } });
const base = [reedfolk, stoneKin, plainFolk, bogMage];

const merged = (entries: ReturnType<typeof race | typeof klass>[]) => withClassReach(entries);
const raceIn = (entries: ReturnType<typeof merged>, id: string) => entries.find((e) => e.kind === 'race' && e.packEntryId === id)!;
const classesIn = (entries: ReturnType<typeof merged>) => entries.filter((e) => e.kind === 'class');
const offeredTo = (entries: ReturnType<typeof merged>, raceId: string) => classesFor(classesIn(entries), null, raceIn(entries, raceId), {}).map((o) => o.entry.packEntryId);

describe('a class reaching other packs’ races (the one reader)', () => {
  it('an add-on class is offered to the races it names, at its limit, and to no others', () => {
    const entries = merged([...base, lanternWarden]);
    expect(offeredTo(entries, 'race-reedfolk')).toEqual(['bog-mage', 'lantern-warden']);
    expect(classLevelCap(lanternWarden, raceIn(entries, 'race-reedfolk'))).toBe(9);
    expect(offeredTo(entries, 'race-stone-kin')).toEqual(['bog-mage']);
    expect(whyNotOpen(lanternWarden, null, raceIn(entries, 'race-stone-kin'))).toBe('Not open to stone kin');
  });

  it('a race that already names the class keeps its own limit', () => {
    const reaching = klass('bog-mage', 'Bog Mage', { raceMaxLevels: { 'race-reedfolk': 12 } });
    const entries = merged([reedfolk, reaching]);
    expect(raceIn(entries, 'race-reedfolk').data.classMaxLevels).toEqual({ 'bog-mage': 6 });
    expect(classLevelCap(reaching, raceIn(entries, 'race-reedfolk'))).toBe(6);
  });

  it('null offers the class to that race with no cap', () => {
    const uncapped = klass('lantern-warden', 'Lantern Warden', { raceMaxLevels: { 'race-reedfolk': null } });
    const entries = merged([...base, uncapped]);
    expect(offeredTo(entries, 'race-reedfolk')).toContain('lantern-warden');
    expect(classLevelCap(uncapped, raceIn(entries, 'race-reedfolk'))).toBeNull();
  });

  it('detaching the add-on removes the offer: without its class the races read as the base pack wrote them', () => {
    const entries = merged(base);
    expect(raceIn(entries, 'race-reedfolk').data.classMaxLevels).toEqual({ 'bog-mage': 6 });
    expect(offeredTo(entries, 'race-reedfolk')).toEqual(['bog-mage']);
  });

  it('a race with no class limits stays open to every class, and the class’s level for it is not used', () => {
    const reaching = klass('lantern-warden', 'Lantern Warden', { raceMaxLevels: { 'race-plain-folk': 5 } });
    const entries = merged([...base, reaching]);
    expect(raceIn(entries, 'race-plain-folk').data.classMaxLevels).toEqual({});
    expect(offeredTo(entries, 'race-plain-folk')).toEqual(['bog-mage', 'lantern-warden']);
  });

  it('a level that is not null or a whole number from 1 is left out of the merge', () => {
    const odd = klass('lantern-warden', 'Lantern Warden', { raceMaxLevels: { 'race-reedfolk': '9', 'race-stone-kin': 0 } });
    const entries = merged([...base, odd]);
    expect(offeredTo(entries, 'race-reedfolk')).toEqual(['bog-mage']);
    expect(offeredTo(entries, 'race-stone-kin')).toEqual(['bog-mage']);
  });
});

describe('the checker’s notes on raceMaxLevels (warnings, not errors)', () => {
  it('warns on a race id the pack does not have, saying another attached pack must supply it', () => {
    expect(classReachNotes([lanternWarden])).toEqual([expect.stringMatching(/classes: "lantern-warden": raceMaxLevels names "race-reedfolk", which isn't one of this pack's races\. Another attached pack must supply it/)]);
  });

  it('warns on a clash with a race that already names the class, saying the race’s limit counts', () => {
    const reaching = klass('bog-mage', 'Bog Mage', { raceMaxLevels: { 'race-reedfolk': 12 } });
    expect(classReachNotes([reedfolk, reaching])).toEqual([expect.stringMatching(/"race-reedfolk" 12, but that race already names this class \(6\); the race's own limit counts/)]);
  });

  it('a class naming a race that lists classes and not it gets no note', () => {
    expect(classReachNotes([...base, lanternWarden])).toEqual([]);
  });

  it('the importer shows the same notes as warnings, and the pack still imports', () => {
    const file = JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Invented add-on', version: '0.1', kind: 'setting' },
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden', raceMaxLevels: { 'race-reedfolk': 9 } }],
    });
    const read = readPackJson(file);
    expect(read.ok).toBe(true);
    expect(read.ok && read.pack.warnings.some((w) => w.includes('raceMaxLevels names "race-reedfolk"'))).toBe(true);
  });
});

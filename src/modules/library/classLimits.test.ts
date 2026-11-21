// Class limits in one place (cs-3, rc-5; cs-5 for byOption). Invented names only.
import { describe, expect, it } from 'vitest';
import { alignmentFit, classAlignmentLimit, classLimitNotes, raceClassLimit } from './classLimits.ts';
import { raceInPlay, raceOptionNotes, withRaceOptions } from './raceOptions.ts';
import { withClassReach } from './raceReach.ts';

const reedfolk = { classMaxLevels: { 'lantern-warden': 8, 'bell-ringer': { maxLevel: 6, soft: true }, 'mire-hand': null }, npcOnlyClasses: ['fen-priest'] };

describe('a race’s class limits, hard or soft (cs-3)', () => {
  it('a class the race’s table leaves out is closed (hard), and says so', () => {
    expect(raceClassLimit(reedfolk, 'ash-tender')).toEqual({ open: false, soft: false, maxLevel: null, closedBy: 'unlisted' });
  });

  it('a class the race names NPC-only is closed (hard), even when its table names it', () => {
    expect(raceClassLimit({ ...reedfolk, classMaxLevels: { ...reedfolk.classMaxLevels, 'fen-priest': 9 } }, 'fen-priest').closedBy).toBe('npc-only');
  });

  it('a soft entry is open, needs the GM’s special approval, and keeps its level cap', () => {
    expect(raceClassLimit(reedfolk, 'bell-ringer')).toEqual({ open: true, soft: true, maxLevel: 6, closedBy: null });
  });

  it('a plain level is open with that cap; null is open with none', () => {
    expect(raceClassLimit(reedfolk, 'lantern-warden')).toMatchObject({ open: true, soft: false, maxLevel: 8 });
    expect(raceClassLimit(reedfolk, 'mire-hand')).toMatchObject({ open: true, maxLevel: null });
  });

  it('no race, an empty table or no table sets no limits', () => {
    for (const race of [null, {}, { classMaxLevels: {} }, { classMaxLevels: 'every class' }]) expect(raceClassLimit(race, 'ash-tender')).toMatchObject({ open: true, soft: false, maxLevel: null });
  });

  it('a class’s raceMaxLevels merged in (pg-2) is read the same way, the race’s own entry winning', () => {
    const [race] = withClassReach([
      { kind: 'race', packEntryId: 'reedfolk', name: 'Reedfolk', data: reedfolk },
      { kind: 'class', packEntryId: 'ash-tender', name: 'Ash Tender', data: { raceMaxLevels: { reedfolk: 5 } } },
      { kind: 'class', packEntryId: 'bell-ringer', name: 'Bell Ringer', data: { raceMaxLevels: { reedfolk: 12 } } },
    ]);
    expect(raceClassLimit(race!.data, 'ash-tender')).toMatchObject({ open: true, maxLevel: 5 });
    expect(raceClassLimit(race!.data, 'bell-ringer')).toMatchObject({ open: true, soft: true, maxLevel: 6 });
  });
});

describe('a class’s alignment limits (cs-3)', () => {
  it('a list is hard: another alignment is not open', () => {
    const limit = classAlignmentLimit({ alignments: ['Lantern', 'Reed'] });
    expect(limit).toEqual({ names: ['Lantern', 'Reed'], soft: false });
    expect(alignmentFit(limit, 'reed')).toBe('ok');
    expect(alignmentFit(limit, 'Mire')).toBe('closed');
  });

  it('{ ids, soft: true } is soft: another alignment needs the GM’s special approval', () => {
    expect(alignmentFit(classAlignmentLimit({ alignments: { ids: ['Mire'], soft: true } }), 'Lantern')).toBe('soft');
  });

  it('a class with no alignments, or none picked yet, is fine', () => {
    expect(classAlignmentLimit({})).toBeNull();
    expect(alignmentFit(null, 'Mire')).toBe('ok');
    expect(alignmentFit(classAlignmentLimit({ alignments: ['Reed'] }), '')).toBe('ok');
  });
});

describe('a race’s fields switched by an option (cs-5)', () => {
  const race = {
    classMaxLevels: { 'lantern-warden': 8 },
    abilities: [{ name: 'Reed-sight' }],
    byOption: {
      'fen-kin-limits=chaplains-npc': { npcOnlyClasses: ['marsh-chaplain'] },
      'fen-kin-limits=lifted': { classMaxLevels: {}, abilities: [{ name: 'Old blood' }, { name: 'Reed-sight' }] },
    },
  };

  it('with the option’s default nothing changes: the class it would close is open', () => {
    const data = raceInPlay(race, { 'fen-kin-limits': 'kept' });
    expect(data).toBe(race);
    expect(raceClassLimit({ ...data, classMaxLevels: { 'marsh-chaplain': 8 } }, 'marsh-chaplain').open).toBe(true);
  });

  it('with the NPC-only choice, that class is closed to the race', () => {
    expect(raceClassLimit(raceInPlay(race, { 'fen-kin-limits': 'chaplains-npc' }), 'marsh-chaplain').closedBy).toBe('npc-only');
  });

  it('with the lifting choice, the race’s class table is replaced by {} (no limits) and its abilities are added once', () => {
    const data = raceInPlay(race, { 'fen-kin-limits': 'lifted' });
    expect(raceClassLimit(data, 'ash-tender')).toMatchObject({ open: true, maxLevel: null });
    expect((data.abilities as { name: string }[]).map((a) => a.name)).toEqual(['Reed-sight', 'Old blood']);
  });

  it('a lifted race stays lifted after the classes’ reach is merged (byOption first, then raceMaxLevels)', () => {
    const entries = [
      { kind: 'race', packEntryId: 'reedfolk', name: 'Reedfolk', data: race },
      { kind: 'class', packEntryId: 'ash-tender', name: 'Ash Tender', data: { raceMaxLevels: { reedfolk: 5 } } },
    ];
    const [lifted] = withClassReach(withRaceOptions(entries, { 'fen-kin-limits': 'lifted' }));
    expect(raceClassLimit(lifted!.data, 'bell-ringer').open).toBe(true);
    const [kept] = withClassReach(withRaceOptions(entries, { 'fen-kin-limits': 'kept' }));
    expect(raceClassLimit(kept!.data, 'ash-tender')).toMatchObject({ open: true, maxLevel: 5 });
    expect(raceClassLimit(kept!.data, 'bell-ringer').open).toBe(false);
  });
});

describe('pack:check’s notes on class limits', () => {
  it('warns on the three old places, which the app doesn’t read', () => {
    const notes = classLimitNotes([
      { kind: 'race', packEntryId: 'reedfolk', data: { forbiddenClasses: ['ash-tender'] } },
      { kind: 'class', packEntryId: 'ash-tender', data: { kindreds: ['reedfolk'] } },
      { kind: 'rulesSet', packEntryId: 'fen-rules', data: { creationRestrictions: { note: 'Only reedfolk ring bells.' } } },
    ]);
    expect(notes).toEqual([
      'races: "reedfolk": forbiddenClasses isn\'t read; leave those classes out of classMaxLevels instead (one place for class limits, cs-3).',
      'classes: "ash-tender": kindreds isn\'t read; name the class in each race\'s classMaxLevels instead (or in this class\'s raceMaxLevels), with { "soft": true } where the GM\'s leave is needed (cs-3).',
      'rulesSets: "fen-rules": creationRestrictions isn\'t read; put class limits in the races\' classMaxLevels and alignment limits in the classes\' alignments (cs-3).',
    ]);
  });

  it('names a class table entry or an alignments list in a shape the app doesn’t read, and passes the ruled shapes', () => {
    const notes = classLimitNotes([
      { kind: 'race', packEntryId: 'reedfolk', data: { classMaxLevels: { 'bell-ringer': { maxLevel: 6, soft: true }, 'mire-hand': null, 'ash-tender': 'eight' } } },
      { kind: 'race', packEntryId: 'stonefolk', data: { classMaxLevels: 'every class' } },
      { kind: 'class', packEntryId: 'bell-ringer', data: { alignments: { ids: ['Reed'], soft: true } } },
      { kind: 'class', packEntryId: 'mire-hand', data: { alignments: 'Reed' } },
    ]);
    expect(notes).toEqual([
      'races: "reedfolk": classMaxLevels gives "ash-tender" "eight"; it should be a level, null (no limit) or { "maxLevel": 8, "soft": true }. The class is open with no level cap.',
      'races: "stonefolk": classMaxLevels should be a table of class ids and levels, like { "lantern-warden": 8 }; it is read as no class limits.',
      'classes: "mire-hand": alignments should be a list of alignment names, like ["Lantern", "Reed"], or { "ids": [...], "soft": true }; it is left out.',
    ]);
  });

  it('names a race byOption key that isn’t "<option>=<choice>" and an unknown choice; any field may change (bq2-1)', () => {
    const notes = raceOptionNotes([
      { kind: 'option', packEntryId: 'fen-kin-limits', data: { choices: [{ id: 'kept' }, { id: 'lifted' }] } },
      { kind: 'race', packEntryId: 'reedfolk', data: { byOption: { 'fen-kin-limits': {}, 'fen-kin-limits=gone': {}, 'fen-kin-limits=lifted': { classMaxLevels: {}, hitDie: 'd4' } } } },
    ]);
    expect(notes).toEqual([
      'races: "reedfolk": byOption "fen-kin-limits" should be written "<option>=<choice>".',
      'races: "reedfolk": byOption "fen-kin-limits=gone": "gone" isn\'t one of that option\'s choices.',
    ]);
  });

  it('an option no entry has is noted only when every pack is checked together (an overlay’s races name its base’s options)', () => {
    const overlay = [{ kind: 'race', packEntryId: 'dune-walker', data: { byOption: { 'fen-kin-limits=lifted': { classMaxLevels: {} } } } }];
    expect(raceOptionNotes(overlay)).toEqual([]);
    expect(raceOptionNotes(overlay, true)).toEqual(['races: "dune-walker": byOption "fen-kin-limits=lifted" names an option that isn\'t in any of these packs.']);
  });
});

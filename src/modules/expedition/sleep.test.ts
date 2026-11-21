// Sleep difficulty from facts (ruled 2026-10-30, D19; shape confirmed the same day). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { mireRules } from './fixtures.ts';
import { readExploration } from './modes.ts';
import { campSleep, shareBedding, sleepFor, type Sleeper } from './sleep.ts';

const trek = readExploration([mireRules]).modes[0]!;
const sleep = trek.wild.sleep!;
const names = {
  season: (id: string) => ({ frost: 'Frost', thaw: 'Thaw' })[id] ?? id,
  item: (id: string) => ({ 'fleece-roll': 'Fleece roll', 'reed-mat': 'Reed mat', tent: 'Tent' })[id] ?? id,
};
const lurker: Sleeper = { id: 'a', name: 'Bog lurker', itemIds: ['rope'] };
const warden: Sleeper = { id: 'b', name: 'Lantern Warden', itemIds: ['fleece-roll', 'lantern'] };
const witch: Sleeper = { id: 'c', name: 'Reed witch', itemIds: ['reed-mat'] };

describe('reading the sleep rules', () => {
  // Purpose: each difficulty's `result` (07 camp.sleep, confirmed 2026-10-30, replacing `roll`) is read as good, check
  // or bad; anything else falls back to the check, so a pack can't skip the roll by mistake.
  it('reads difficulties with their result, shared bedding items and rows, leaving out entries with no id and rows it cannot read', () => {
    expect(sleep.difficulties.map((d) => [d.id, d.result, d.add])).toEqual([
      ['easy', 'good', 0],
      ['hard', 'check', -1],
      ['grim', 'check', -3],
      ['sodden', 'bad', 0],
      ['odd', 'check', 0],
    ]);
    expect(sleep.beddingItems).toEqual([
      { id: 'fleece-roll', shares: 1 },
      { id: 'reed-mat', shares: 1 },
      { id: 'tent', shares: 2 },
    ]);
    // The row naming an unknown difficulty and the row with a bare list for bedding are left out.
    expect(sleep.rows).toHaveLength(7);
    expect(sleep.rows.map((r) => r.bedding)).toEqual(['none', { all: ['tent', 'fleece-roll'] }, { any: ['fleece-roll', 'tent'] }, null, null, 'none', null]);
    expect(sleep.checkAbility).toBe('NERVE');
  });

  it('a mode with no sleep difficulties has no sleep rules', () => {
    expect(readExploration([{ exploration: { modes: [{ id: 'x', step: { value: 1, unit: 'day' }, camp: { sleep: { difficulties: [] } } }] } }]).modes[0]!.wild.sleep).toBeNull();
  });
});

describe('sharing bedding', () => {
  it('a tent covers its carrier and one more who has none, in order; a bedroll covers only its carrier', () => {
    const tentCarrier: Sleeper = { id: 't', name: 'Tent bearer', itemIds: ['tent'] };
    const covers = shareBedding(sleep, [tentCarrier, lurker, warden, witch]);
    expect(covers.get('t')).toEqual([{ itemId: 'tent', from: null }]);
    expect(covers.get('a')).toEqual([{ itemId: 'tent', from: { id: 't', name: 'Tent bearer' } }]);
    expect(covers.get('b')).toEqual([{ itemId: 'fleece-roll', from: null }]);
    expect(covers.get('c')).toEqual([{ itemId: 'reed-mat', from: null }]);
  });

  it('two tents carried by one character cover four: the carrier and the next three, no more', () => {
    const extra: Sleeper = { id: 'd', name: 'Mire hermit', itemIds: [] };
    const covers = shareBedding(sleep, [{ id: 't', name: 'Tent bearer', itemIds: ['tent', 'tent'] }, lurker, warden, witch, extra]);
    expect(['t', 'a', 'b', 'c', 'd'].map((id) => covers.get(id)!.some((c) => c.itemId === 'tent'))).toEqual([true, true, true, true, false]);
  });
});

describe('sleep from facts', () => {
  it('frost, no fire and no bedding is the worst row, with every reason given', () => {
    const result = sleepFor(sleep, lurker, { season: 'frost', fire: false }, { names });
    expect(result).toMatchObject({ difficulty: { id: 'grim' }, outcome: 'check', ability: 'NERVE', add: -3, overridden: false });
    expect(result.reasons).toEqual(['Season: Frost', 'No fire', 'No bedding']);
  });

  it("each character's own bedding counts: the same camp gives different difficulties", () => {
    const facts = { season: 'frost', fire: false };
    expect(campSleep(sleep, [lurker, warden, witch], facts, { names }).map((s) => [s.characterId, s.difficulty?.id, s.reasons])).toEqual([
      ['a', 'grim', ['Season: Frost', 'No fire', 'No bedding']],
      ['b', 'hard', ['Season: Frost', 'Bedding: Fleece roll']],
      ['c', 'hard', ['Season: Frost']],
    ]);
  });

  it('a shared tent counts for the one it covers, and the reason says whose it is', () => {
    const facts = { season: 'frost', fire: false };
    const [, covered] = campSleep(sleep, [{ id: 't', name: 'Tent bearer', itemIds: ['tent'] }, lurker], facts, { names });
    expect(covered).toMatchObject({ difficulty: { id: 'hard' }, reasons: ['Season: Frost', 'Bedding: Tent, shared with Tent bearer'] });
  });

  it('a row with all: needs every item named; a fleece roll under a shared tent makes frost easy', () => {
    const facts = { season: 'frost', fire: false };
    const [, both] = campSleep(sleep, [{ id: 't', name: 'Tent bearer', itemIds: ['tent'] }, warden], facts, { names });
    expect(both).toMatchObject({ difficulty: { id: 'easy' }, outcome: 'good', reasons: ['Season: Frost', 'Bedding: Tent, shared with Tent bearer', 'Bedding: Fleece roll'] });
  });

  it('Easy needs no roll and carries no modifiers', () => {
    expect(sleepFor(sleep, lurker, { season: 'thaw', fire: true, flags: ['campfire-talk'] })).toMatchObject({ difficulty: { id: 'easy' }, outcome: 'good', ability: null, modifiers: [], add: 0, reasons: ['Fire lit'] });
  });

  it("camp facts such as campfire talk add the pack's modifier to a roll", () => {
    const result = sleepFor(sleep, lurker, { season: 'thaw', fire: false, flags: ['campfire-talk'] });
    expect(result).toMatchObject({ difficulty: { id: 'hard' }, outcome: 'check', add: 0 });
    expect(result.modifiers).toEqual([
      { label: 'Hard', add: -1 },
      { label: 'Campfire talk', add: 1 },
    ]);
  });

  it("the camp step's ability wins over the sleep rules' own", () => {
    expect(sleepFor(sleep, lurker, { season: 'frost', fire: false }, { ability: 'GRIT' }).ability).toBe('GRIT');
  });

  it("the GM's pick replaces the looked-up difficulty, keeps the reasons and is marked", () => {
    const result = sleepFor(sleep, lurker, { season: 'frost', fire: false }, { override: 'easy', names });
    expect(result).toMatchObject({ difficulty: { id: 'easy' }, outcome: 'good', overridden: true, reasons: ['Season: Frost', 'No fire', 'No bedding'] });
    expect(sleepFor(sleep, lurker, { season: 'frost', fire: false }, { override: 'grim' }).overridden).toBe(false);
  });

  // Purpose: a "bad" difficulty is a bad rest with no roll (onBadRest follows), like "good" but the other way.
  it('a bad result needs no roll and carries no modifiers', () => {
    expect(sleepFor(sleep, lurker, { season: 'frost', fire: false, flags: ['campfire-talk'] }, { override: 'sodden' })).toMatchObject({
      difficulty: { id: 'sodden' },
      outcome: 'bad',
      ability: null,
      modifiers: [],
      add: 0,
      overridden: true,
    });
  });

  it('no matching row leaves the GM to decide', () => {
    const narrow = { ...sleep, rows: sleep.rows.slice(0, 1) };
    expect(sleepFor(narrow, warden, { season: 'thaw', fire: true })).toMatchObject({ difficulty: null, outcome: null, reasons: [], ability: null });
  });

  it('with no season known, rows that need one are passed over', () => {
    expect(sleepFor(sleep, lurker, { season: null, fire: false }).difficulty?.id).toBe('hard');
  });
});

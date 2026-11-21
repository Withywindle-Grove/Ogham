// The review screen's sections and what a sent-back character still needs (B18; words batch 1, §8). Invented content.
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { reviewSections, stillToDo } from './reviewSections.ts';

const field = (key: string, label: string, extra: Partial<FieldDefinition> = {}): FieldDefinition =>
  ({ id: key, campaignId: 'c', key, label, type: 'text', choices: [], group: '', order: 0, showOnCard: false, hidden: false, fill: null, required: false, from: null, ...extra });

const base = {
  name: 'Wren', // words: names
  level: 2,
  hpMax: 7,
  backstory: '',
  fields: { oath: 'The lantern', secret: 'Owes the ferryman' }, // words: names
  fieldDefs: [field('oath', 'Oath'), field('secret', 'Secret', { hidden: true })],
  editedFields: ['oath'],
  creation: { scores: { STR: 13, WIS: 16 }, rolled: { STR: 13, WIS: 14 }, startingMoney: 11, moneyCoin: { key: 'gp' } },
  made: { way: 'guided' as const, kinds: ['Lantern Warden'], scores: null, gear: 'Lantern', over: 'Over by 3 gp' }, // words: names
  flagged: ['hp'],
};

describe('review sections', () => {
  // Purpose (final drafts A5, C): hit points left at the prefilled average say so on the review and the GM's card; a
  // closed class asked for is called out with its reason.
  it('says "the average, not rolled" for an untouched average, and calls out a closed class asked for', () => {
    const hp = (creation: Record<string, unknown>) => reviewSections({ ...base, creation }).find((s) => s.id === 'hp')!.lines[0]!.text;
    expect(hp({ hpAverage: true })).toBe('HP 7, the average, not rolled');
    expect(hp({})).toBe('HP 7');
    const who = reviewSections({ ...base, creation: { specialApprovals: [{ step: 'class', entryId: 'marsh-chaplain', name: 'Marsh Chaplain', requirement: "Marsh Chaplain isn't open to stone kin" }] } }).find((s) => s.id === 'who')!.lines;
    expect(who).toContainEqual({ text: "Needs the GM's special approval: Marsh Chaplain", mark: 'broken', why: "Marsh Chaplain isn't open to stone kin" });
  });

  // Purpose (Design, 2026-11-07): on the GM's card the exceptions block above has the reason and Allow it / Take it off,
  // so the Who they are rows keep only the value with the sign inline; nothing is said twice.
  it('with the exceptions above, a row is only the value marked as an exception, with no reason', () => {
    const who = reviewSections({ ...base, exceptionsAbove: true, creation: { specialApprovals: [{ step: 'languages', entryId: 'croak', name: 'Croak', requirement: 'Usually learnt only by toad kinds' }] } }).find((s) => s.id === 'who')!.lines;
    expect(who).toContainEqual({ text: 'Croak', mark: 'exception' });
    expect(who.some((l) => (l.why ?? '').includes('toad'))).toBe(false);
  });

  it('lists the sections in reading order, marks what was changed and what breaks a rule, and flags only the ticked ones', () => {
    const sections = reviewSections(base);
    expect(sections.map((s) => s.id)).toEqual(['who', 'scores', 'hp', 'details', 'gear', 'money', 'story']);
    expect(sections.find((s) => s.id === 'scores')!.lines).toEqual([{ text: 'STR 13, WIS 16' }, { text: 'WIS 16', mark: 'override', why: 'rolled 14' }]);
    expect(sections.find((s) => s.id === 'money')!.lines[1]).toMatchObject({ mark: 'broken', text: 'Over by 3 gp: it becomes 0 when play starts' });
    expect(sections.filter((s) => s.flagged).map((s) => s.id)).toEqual(['hp']);
  });

  // Purpose (final drafts A5, slice B): the GM's card names the scores left at the average, never touched, as "the
  // average, not rolled"; a record without the list says nothing of it.
  it('names the scores left at the average (A5)', () => {
    const scores = (creation: Record<string, unknown>) => reviewSections({ ...base, creation }).find((s) => s.id === 'scores')!.lines;
    expect(scores({ ...base.creation, scoresAverage: ['STR'] })).toContainEqual({ text: 'STR 13: the average, not rolled' });
    expect(scores(base.creation).some((l) => l.text.includes('the average'))).toBe(false);
  });

  // Purpose (cw-11, the coin wording): the GM's approval card says the starting coin as the player's review does: rolled
  // or the usual, the coin a pick added (naming the pick), what was spent and what's left.
  it('says the starting coin in words, the usual or rolled, naming the pick that added coin (cw-11)', () => {
    const coins = [{ key: 'gp', label: 'Gold', valueInBase: 10 }, { key: 'sp', label: 'Silver', valueInBase: 1 }];
    const withPick = {
      ...base,
      fields: { ...base.fields, background: 'reed-cutter' },
      fieldDefs: [...base.fieldDefs, field('background', 'Background', { type: 'list', from: 'fen-backgrounds' })],
      traitLists: [{ id: 'fen-backgrounds', name: 'Backgrounds', die: 'd6', entries: [{ id: 'reed-cutter', name: 'Reed cutter' }] }] as never,
      coins,
      made: { ...base.made, over: null },
    };
    const coin = (creation: Record<string, unknown>) => reviewSections({ ...withPick, creation }).find((s) => s.id === 'money')!;
    const spent = { startingMoney: 100, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 600, traitMoney: { 'fen-backgrounds': 10 } };
    expect(coin(spent).title).toBe('Starting coin');
    expect(coin(spent).lines).toEqual([{ text: '100 rolled, +10 gp from Reed cutter, 60 gp spent: 50 gp left' }]);
    expect(coin({ ...spent, moneyTouched: false }).lines[0]!.text).toBe('100, the average (not rolled), +10 gp from Reed cutter, 60 gp spent: 50 gp left');
    // No pick added coin: no "from".
    expect(coin({ startingMoney: 100, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 600 }).lines[0]!.text).toBe('100 rolled, 60 gp spent: 40 gp left');
  });

  it('shows hidden fields only to the GM, and the edited filled field as changed', () => {
    const details = (showHidden: boolean) => reviewSections({ ...base, showHidden }).find((s) => s.id === 'details')!.lines;
    expect(details(false)).toEqual([{ text: 'Oath: The lantern', mark: 'override', why: "the setting's value was changed" }]);
    expect(details(true).map((l) => l.text)).toContain('Secret: Owes the ferryman');
  });

  it('shows the scores once: the fields holding them stay out of Details, whatever their label (N12)', () => {
    const withScores = {
      ...base,
      fields: { ...base.fields, str: 13, wis: 15 },
      fieldDefs: [...base.fieldDefs, field('str', 'STR', { type: 'number' }), field('wis', 'WISb', { type: 'number' })],
    };
    const details = reviewSections(withScores).find((s) => s.id === 'details')!.lines.map((l) => l.text);
    expect(details).toEqual(['Oath: The lantern']);
    expect(reviewSections(withScores).find((s) => s.id === 'scores')!.lines[0]).toEqual({ text: 'STR 13, WIS 16' });
  });

  it('leaves out scores, gear and money for a freeform character without them', () => {
    const sections = reviewSections({ ...base, creation: {}, made: { way: 'freeform', kinds: [], scores: null, gear: null, over: null } });
    expect(sections.map((s) => s.id)).toEqual(['who', 'hp', 'details', 'story']);
  });
});

describe('still to do before resending', () => {
  it('names HP asked again, each ticked section not changed yet, and money gone over, in reading order', () => {
    const items = stillToDo({ flagged: ['story', 'who'], changed: new Set(), hpAsked: true, hpEntered: false, over: 'Over by 3 gp' });
    expect(items.map((i) => i.text)).toEqual([
      'Who they are: your GM asks for a change.',
      'Hit points: the GM asked you to roll again.',
      'Starting coin: over by 3 gp.',
      'Backstory: your GM asks for a change.',
    ]);
    expect(items.find((i) => i.step === 'money')!.fixable).toBe(false);
  });

  it('makes gear and money fixable when the shopping can reopen (ruled 2026-10-26)', () => {
    const items = stillToDo({ flagged: ['gear'], changed: new Set(), hpAsked: false, hpEntered: false, over: 'Over by 3 gp', canShop: true });
    expect(items.map((i) => [i.step, i.fixable])).toEqual([
      ['gear', true],
      ['money', true],
    ]);
  });

  it('is empty once HP is entered and the ticked sections are changed', () => {
    expect(stillToDo({ flagged: ['who'], changed: new Set(['who']), hpAsked: true, hpEntered: true, over: null })).toEqual([]);
  });
});

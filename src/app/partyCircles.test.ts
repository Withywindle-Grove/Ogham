// The marching order's circles, worked out (S12 of the whole-Scene plan; mc-5, mo-1; pictures R1 and page 16 T10).
// Invented characters.
//   With no portrait a circle shows one initial; two characters whose initials clash show two letters each (mc-5).
//   A light's words under its circle are its name and what is left, without "left" ("Torch, 4 turns").
//   The card's line over the ranks names the lights lit ("One light lit: Ash's torch, 4 turns."); with none lit there is no line.
import { describe, expect, it } from 'vitest';
import { callerOf, circleInitials, elsewhereLine, lightLine, litSummary } from './partyCircles.ts';

//   The caller is read from the campaign's settings (the lead, 2026-11-14): a character of the party, or none when the
//   key is missing, not a string, or names someone no longer in the party.
describe('the caller', () => {
  it("reads the caller from the settings, and none where it names no one in the party", () => {
    const party = ['actor-wren', 'actor-ash'];
    expect(callerOf({ caller: 'actor-wren' }, party)).toBe('actor-wren');
    expect(callerOf({ caller: 'actor-gone' }, party)).toBeNull();
    expect(callerOf({ caller: 7 }, party)).toBeNull();
    expect(callerOf({}, party)).toBeNull();
    expect(callerOf(null, party)).toBeNull();
  });
});

describe('initials', () => {
  it('shows one initial where none clash', () => {
    const shown = circleInitials([
      { id: 'a', name: 'Ash' },
      { id: 't', name: 'Tam' },
    ]);
    expect(shown.get('a')).toBe('A');
    expect(shown.get('t')).toBe('T');
  });

  it('shows two letters each where two initials clash: two words give their first letters, one word its first two', () => {
    const shown = circleInitials([
      { id: 'w', name: 'Wren' },
      { id: 'wm', name: 'Will Marsh' },
      { id: 'b', name: 'Bram' },
    ]);
    expect(shown.get('w')).toBe('Wr');
    expect(shown.get('wm')).toBe('WM');
    expect(shown.get('b')).toBe('B');
  });

  it('copes with messy names: spaces around, a lower-case first letter, an empty name', () => {
    const shown = circleInitials([
      { id: 'x', name: '  moss  ' },
      { id: 'e', name: '' },
    ]);
    expect(shown.get('x')).toBe('M');
    expect(shown.get('e')).toBe('?');
  });
});

describe('light words', () => {
  it("drops the word 'left' and keeps the light's own name", () => {
    expect(lightLine('Torch', '4 turns left')).toBe('Torch, 4 turns');
    expect(lightLine('Lamp of the Lantern Warden', 'burns on')).toBe('Lamp of the Lantern Warden, burns on');
  });

  it('says which lights are lit over the ranks, and nothing when none is', () => {
    expect(litSummary([])).toBeNull();
    expect(litSummary([{ who: 'Ash', light: 'Torch', words: '4 turns left' }])).toBe('One light lit: Ash’s torch, 4 turns.');
    expect(
      litSummary([
        { who: 'Ash', light: 'Torch', words: '4 turns left' },
        { who: 'Wren', light: 'Lantern', words: '2 hours left' },
      ]),
    ).toBe('Two lights lit: Ash’s torch, 4 turns; Wren’s lantern, 2 hours.');
  });
});

//   A split party, as a player in one group sees their order (page 18, PL6; ap-10): one line names who is elsewhere,
//   never where ("Your group. Ash and Tam are elsewhere."); "is" for one; no line when nobody is elsewhere.
describe('who is elsewhere', () => {
  it('names the others, never where they are, and says nothing when nobody is elsewhere', () => {
    expect(elsewhereLine(['Ash', 'Tam'])).toBe('Your group. Ash and Tam are elsewhere.');
    expect(elsewhereLine(['Ash'])).toBe('Your group. Ash is elsewhere.');
    expect(elsewhereLine(['Ash', 'Moss', 'Tam'])).toBe('Your group. Ash, Moss and Tam are elsewhere.');
    expect(elsewhereLine([])).toBeNull();
  });
});

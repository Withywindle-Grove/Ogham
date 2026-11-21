import { describe, expect, it } from 'vitest';
import { roleLine, sigilLetter, sortByName, type CampaignSummary } from './myCampaigns.ts';

const base: CampaignSummary = {
  id: 'c1',
  name: 'The Reedmouth Delve',
  role: 'gm',
  playerCount: 0,
  characterName: null,
  waiting: null,
  companyName: null,
  portraitAssetId: null,
  sigilAssetId: null,
  retiredAt: null,
};

describe('the line under each campaign', () => {
  it('tells a GM how many players they have', () => {
    expect(roleLine(base)).toBe('GM, No players yet');
    expect(roleLine({ ...base, playerCount: 1 })).toBe('GM, 1 player');
    expect(roleLine({ ...base, playerCount: 3 })).toBe('GM, 3 players');
  });

  it("tells a player their active character and its company", () => {
    const player = { ...base, role: 'player' as const, characterName: 'Wren', companyName: 'The Sluice Gate Company' };
    expect(roleLine(player)).toBe('Player, Wren, The Sluice Gate Company');
    expect(roleLine({ ...player, companyName: null })).toBe('Player, Wren');
  });

  it("says plainly when a player has no character yet", () => {
    expect(roleLine({ ...base, role: 'player' })).toBe('Player, No character yet');
  });

  it('shows a character waiting for approval or sent back when there is no active one', () => {
    const player = { ...base, role: 'player' as const };
    expect(roleLine({ ...player, waiting: { name: 'Hollis', approval: 'pending' } })).toBe(
      'Player, Hollis (waiting for approval)',
    );
    expect(roleLine({ ...player, waiting: { name: 'Hollis', approval: 'rejected' } })).toBe('Player, Hollis (sent back)');
  });
});

describe('the letter in the sigil', () => {
  it('uses the first letter of the name, skipping a leading "The"', () => {
    expect(sigilLetter('The Drowned Marches')).toBe('D');
    expect(sigilLetter('barrowmoor')).toBe('B');
    expect(sigilLetter('Theodric Hold')).toBe('T');
    expect(sigilLetter('The')).toBe('T');
  });
});

describe('campaign order', () => {
  it('sorts campaigns by name, ignoring capitals', () => {
    const sorted = sortByName([{ name: 'the Ash Barrows' }, { name: 'Bog Hollow' }, { name: 'The Reedmouth Delve' }]);
    expect(sorted.map((c) => c.name)).toEqual(['Bog Hollow', 'the Ash Barrows', 'The Reedmouth Delve']);
  });
});

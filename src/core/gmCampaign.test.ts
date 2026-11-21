import { describe, expect, it } from 'vitest';
import { charactersLine, type PlayerCharacter } from './gmCampaign.ts';

const character = (
  name: string,
  approval: PlayerCharacter['approval'],
  active = false,
  archived = false,
): PlayerCharacter => ({
  id: name,
  campaignId: 'c1',
  ownerType: 'user',
  ownerUserId: 'u1',
  name,
  approval,
  active,
  archived,
  level: 1,
  hpMax: null,
  backstory: '',
  fields: {},
  portraitAssetId: null,
  companyId: null,
  classRef: null,
  raceRef: null,
  creation: {},
  editedFields: [],
  reviewSections: [],
});

describe("the line under each player's name", () => {
  it('says plainly when a player has no character yet', () => {
    expect(charactersLine([])).toBe('No character yet');
  });

  it('marks the active character, and characters waiting or sent back', () => {
    expect(
      charactersLine([
        character('Wren', 'approved', true),
        character('Old Tobin', 'approved'),
        character('Hollis', 'pending'),
        character('Sly Cob', 'rejected'),
      ]),
    ).toBe('Wren (active), Old Tobin, Hollis (waiting for approval), Sly Cob (sent back)');
  });

  it('leaves out archived characters', () => {
    expect(charactersLine([character('Wren', 'approved', true), character('Old Tobin', 'approved', false, true)])).toBe(
      'Wren (active)',
    );
    expect(charactersLine([character('Old Tobin', 'approved', false, true)])).toBe('No character yet');
  });
});

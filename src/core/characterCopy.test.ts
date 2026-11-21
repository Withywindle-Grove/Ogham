import { describe, expect, it } from 'vitest';
import { characterCopy, copyFileName } from './characterCopy.ts';

const row = {
  id: 'actor-1',
  campaign_id: 'campaign-1',
  owner_user_id: 'user-1',
  company_id: null,
  portrait_asset_id: null,
  created_by: 'user-1',
  updated_at: '2026-10-19T12:00:00Z',
  review_note: 'Pick a river-town name.',
  kind: 'pc',
  name: 'Hollis',
  level: 2,
  hp_max: 6,
  backstory: 'Raised by lock-keepers.',
  fields: { STR: 13 },
};

describe('a downloaded copy of a character', () => {
  it("keeps the character's own details and leaves out this campaign's ids and the GM's note", () => {
    const copy = characterCopy(row, 'The Ash Barrows', new Date('2026-10-19T12:00:00Z'));
    expect(copy).toEqual({
      format: 'grimoire-character',
      version: 1,
      exportedAt: '2026-10-19T12:00:00.000Z',
      campaignName: 'The Ash Barrows',
      character: { kind: 'pc', name: 'Hollis', level: 2, hp_max: 6, backstory: 'Raised by lock-keepers.', fields: { STR: 13 } },
    });
  });

  it('is named after the character and the day', () => {
    const day = new Date('2026-10-19T12:00:00Z');
    expect(copyFileName('Hollis of Reedmouth', day)).toBe('hollis-of-reedmouth-2026-10-19.json');
    expect(copyFileName('  Æther-Wren!! ', day)).toBe('ther-wren-2026-10-19.json');
    expect(copyFileName('???', day)).toBe('character-2026-10-19.json');
  });
});

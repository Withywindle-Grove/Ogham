import { describe, expect, it } from 'vitest';
import type { Db } from '../../core/supabase.ts';
import { editCharacter, type CharacterRef } from './commands.ts';

const untouchable = new Proxy({}, {
  get() {
    throw new Error('the database was touched');
  },
}) as unknown as Db;

const wren: CharacterRef = { id: 'actor-wren', campaignId: 'c', ownerType: 'user', ownerUserId: 'user-a', approval: 'approved', archived: false };

describe('who may edit the rules set figures (#567)', () => {
  const player = { id: 'user-a', roles: { c: 'player' } } as const;
  const gm = { id: 'user-gm', roles: { c: 'gm' } } as const;
  const pending: CharacterRef = { ...wren, approval: 'pending' };
  const may = (user: typeof player | typeof gm, character: CharacterRef, changes: Parameters<typeof editCharacter.target>[0]['changes'], scoreKeys: string[] = ['MUS']) =>
    editCharacter.allowed(user, editCharacter.target({ character, changes, scoreKeys }));

  // Purpose: a player's change to a score on an approved character is refused (it is a request), a detail field is not.
  it('refuses a player a score on an approved character, and allows a detail', () => {
    expect(may(player, wren, { field: { key: 'MUS', value: '14' } })).toBe(false);
    expect(may(player, wren, { fields: { MUS: 14, motto: 'x' } })).toBe(false);
    expect(may(player, wren, { field: { key: 'motto', value: 'Lights first' } })).toBe(true);
    expect(may(player, wren, { hpMax: 12 })).toBe(false);
    expect(may(player, wren, { level: 2 })).toBe(false);
    expect(may(player, wren, { backstory: 'Raised on the barges.' })).toBe(true);
  });

  // Purpose: the GM changes any of them.
  it('allows the GM', () => {
    expect(may(gm, wren, { field: { key: 'MUS', value: '14' } })).toBe(true);
    expect(may(gm, wren, { hpMax: 12 })).toBe(true);
  });

  // Purpose: before approval the player sets their own figures.
  it('allows a player on a character not approved yet', () => {
    expect(may(player, pending, { field: { key: 'MUS', value: '14' } })).toBe(true);
    expect(may(player, pending, { hpMax: 12, level: 2 })).toBe(true);
  });
});

describe('editing a character', () => {
  it("refuses HP that isn't a whole number, before reaching the database", async () => {
    const result = await editCharacter.run(untouchable, { id: 'user-a', roles: { c: 'player' } }, {
      character: wren,
      changes: { hpCurrent: 6.5 },
    });
    expect(result).toEqual({ ok: false, reason: 'failed', message: 'HP must be a whole number.' });
  });

  // Purpose: expertise points that aren't whole numbers of at least 1 under a skill code are refused before the
  // database (G-208, ex-2; the database refuses them too), and the owner may spend them, as any edit (the add-only rule
  // after approval is the database's).
  it('refuses malformed expertise points, before reaching the database', async () => {
    for (const expertise of [{ SB: 0 }, { SB: 1.5 }, { SB: '2' }, [1]]) {
      const result = await editCharacter.run(untouchable, { id: 'user-a', roles: { c: 'player' } }, { character: wren, changes: { expertise: expertise as never } });
      expect(result).toEqual({ ok: false, reason: 'failed', message: 'Each skill takes a whole number of points, from 1 to 99.' });
    }
    expect(await editCharacter.run(untouchable, { id: 'user-a', roles: { c: 'player' } }, { character: wren, changes: { expertise: { ' ': 1 } } })).toEqual({
      ok: false,
      reason: 'failed',
      message: "Each skill's points are kept under a short skill code.",
    });
    const player = { id: 'user-a', roles: { c: 'player' } } as const;
    expect(editCharacter.allowed(player, editCharacter.target({ character: wren, changes: { expertise: { SB: 2 } } }))).toBe(true);
  });

  // Purpose (review of #1087, finding 3): points past the database's limits (over 99 on a skill, a code over 40
  // characters, more than 40 skills) are refused by the app in a plain sentence, never left to the database's error.
  it("refuses expertise points past the database's limits, before reaching the database", async () => {
    const player = { id: 'user-a', roles: { c: 'player' } } as const;
    const tryIt = (expertise: Record<string, number>) => editCharacter.run(untouchable, player, { character: wren, changes: { expertise } });
    expect(await tryIt({ SB: 100 })).toEqual({ ok: false, reason: 'failed', message: 'Each skill takes a whole number of points, from 1 to 99.' });
    const shortCode = { ok: false, reason: 'failed', message: "Each skill's points are kept under a short skill code." };
    expect(await tryIt({ ['x'.repeat(41)]: 1 })).toEqual(shortCode);
    expect(await tryIt(Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`S${i}`, 1])))).toEqual(shortCode);
  });
});

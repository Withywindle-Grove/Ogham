// The speed cure (mv-2, the lead's ruling, 2026-11-14): a speed typed by hand is marked in the character's edited
// fields; a stored speed with no mark counts as filled and follows the rules in force. On invented rules.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../core/supabase.ts';
import { carriedLoad, combineEncumbrance, loadSpeed, speedOf } from '../inventory/encumbrance.ts';
import { ownSpeed, ruleFills, wholeDown } from '../library/fills.ts';
import { editCharacter, type CharacterRef } from './commands.ts';
import { movementOf } from './movement.ts';

describe('a speed typed by hand is marked; an unmarked one follows the rules (mv-2)', () => {
  it('a marked hand edit survives a pack update; an unmarked stored speed follows it', () => {
    // Purpose: a pack update changes what the rules give, never a speed the player typed by hand and marked; a speed
    // stored without a mark (the fill's, from before) follows the update.
    const region = { unencumberedMovement: { speed: 45 } };
    const before = [region, { movement: { combat: { formula: 'speed / 3', unit: 'ft' } } }];
    const after = [region, { movement: { combat: { formula: 'speed / 3', unit: 'ft' } }, unencumberedMovement: { speed: 90 } }];
    const fields = [{ key: 'mv', label: 'Movement', fill: 'movement.speed' }];
    const sheet = (rulesSets: Record<string, unknown>[], typed: Record<string, unknown>, edited: string[]) => {
      const input = { rulesSets, race: null, raceName: null, filled: ruleFills(rulesSets, { klass: null, race: null }, {}), load: null, fields, typed, edited };
      return movementOf(input);
    };
    for (const rules of [before, after]) {
      const hand = sheet(rules, { mv: '35' }, ['mv']);
      expect(hand.rows[0]!.value).toBe('35');
      expect(hand.rows[0]!.lines[0]).toBe('35 is written on the sheet.');
    }
    const unmarked = sheet(after, { mv: '45' }, []);
    expect(unmarked.rows[0]!.value).toBe('90');
    expect(unmarked.rows.find((r) => r.key === 'movement.combat')!.value).toBe('30 ft');
    expect(unmarked.rows[0]!.lines.some((l) => l.includes('written on the sheet'))).toBe(false);
  });

  it("an unmarked stored speed follows the rules once the coin-tier set carries its own speed (shaped like Francis's character), with and without a load", () => {
    // Purpose: the fault Francis met. A character made under a region's base speed keeps that number stored, unmarked;
    // once the coin-tier rules set (the highest with a movement record) carries its own base speed, the sheet shows
    // that speed and In a fight follows it, and with a load tracked the load's speed, never the stored number.
    const region = { unencumberedMovement: { speed: 45 }, defaultSpeed: 45 };
    const conversion = { name: 'A conversion with no movement of its own' };
    const coinTier = {
      movement: { combat: { formula: 'speed / 3', unit: 'ft' } },
      unencumberedMovement: { speed: 90 },
      encumbrance: { mode: 'coin', coin: { maxLoadCoin: 1500, tiers: [{ label: 'Unladen', max: 450, movement: "150' (50')" }, { label: 'Laden', max: 700, movement: "75' (25')" }, { label: 'Heavy', max: 1500, movement: "30' (10')" }] } },
    };
    const rules: Record<string, unknown>[] = [region, conversion, coinTier];
    const kindred = { name: 'Moss kin' };
    const filled = ruleFills(rules, { klass: null, race: kindred }, {});
    const fields = [{ key: 'mv', label: 'Movement', fill: 'movement.speed' }];
    const stored = { mv: '45' };
    const sheet = (load: ReturnType<typeof loadSpeed>) => {
      const input = { rulesSets: rules, race: kindred, raceName: 'Moss kin', filled, load, fields, typed: stored, edited: [] as string[] };
      return movementOf(input);
    };
    const free = sheet(null);
    expect(free.rows[0]!.value).toBe('90');
    expect(free.rows.find((r) => r.key === 'movement.combat')!.value).toBe('30 ft');
    const load = carriedLoad([{ id: 'sack', name: 'Sack of coins', category: 'treasure', qty: 1, weightCoin: 696, slots: null, stack: 1, containerLineId: null, equipped: false, container: null, armourType: null }], combineEncumbrance(rules.map((r) => (r as { encumbrance?: unknown }).encumbrance)), 'coin');
    const laden = sheet(loadSpeed(load));
    expect(laden.rows[0]!.value).toBe(String(speedOf(load)));
    expect(laden.rows.find((r) => r.key === 'movement.combat')!.value).toBe(`${wholeDown(speedOf(load)! / 3)} ft`);
  });

  it('two rules sets never mix a number and formulas: the speed comes from the highest set with a movement record, or a set above it', () => {
    // Purpose: a lower set's base speed (in its own units) is never worked through a higher set's formulas; a set
    // above the one with the movement record still gives the speed; a kindred's own speed still comes first.
    const lower = { unencumberedMovement: { speed: 45 }, defaultSpeed: 45 };
    const formulas = { movement: { combat: { formula: 'speed / 3', unit: 'ft' } } };
    expect(ownSpeed([lower, formulas], null)).toBeNull();
    expect(ruleFills([lower, formulas], { klass: null, race: null }, {})['movement.combat']).toBeUndefined();
    const m = movementOf({ rulesSets: [lower, formulas], race: null, raceName: null, filled: {}, load: null, fields: [] });
    expect(m.speed).toBeNull();
    expect(ownSpeed([formulas, lower], null)).toBe(45);
    expect(ownSpeed([lower, formulas], { speed: 20 })).toBe(20);
  });

  it("the sheet's one-field edit of a speed marks it; the GM's full edit passing the speed through unchanged does not", async () => {
    // Purpose: every place a speed can be typed records the hand edit; a save that only carries the stored speed along
    // (the GM's full edit of the scores) never turns it into a hand edit.
    const state: Record<string, unknown> = { fields: { mv: '45' }, edited_fields: [] };
    const patches: Record<string, unknown>[] = [];
    const defs = [
      { id: 'f1', campaign_id: 'c', key: 'mv', label: 'Movement', type: 'text', choices: null, field_group: null, sort_order: 1, show_on_card: false, hidden: false, created_at: '2026-11-14', fill: 'movement.speed', required: false, from_list: null },
      { id: 'f2', campaign_id: 'c', key: 'motto', label: 'Motto', type: 'text', choices: null, field_group: null, sort_order: 2, show_on_card: false, hidden: false, created_at: '2026-11-14', fill: null, required: false, from_list: null },
    ];
    const db = {
      from: (table: string) => {
        let patch: Record<string, unknown> | null = null;
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          update: (p: Record<string, unknown>) => ((patch = p), q),
          maybeSingle: () => Promise.resolve({ data: { ...state }, error: null }),
          then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
            if (table === 'field_definitions') return Promise.resolve({ data: defs, error: null }).then(resolve, reject);
            if (patch) {
              patches.push(patch);
              Object.assign(state, patch);
            }
            return Promise.resolve({ data: [{ id: 'actor-wren', campaign_id: 'c', owner_type: 'user', owner_user_id: 'user-a', approval: 'approved', status: 'active' }], error: null }).then(resolve, reject);
          },
        };
        return q;
      },
    } as unknown as Db;
    const wren: CharacterRef = { id: 'actor-wren', campaignId: 'c', ownerType: 'user', ownerUserId: 'user-a', approval: 'approved', archived: false };
    const player = { id: 'user-a', roles: { c: 'player' } } as const;
    const gm = { id: 'user-gm', roles: { c: 'gm' } } as const;
    const field = { key: 'mv', value: '35', mark: true };
    expect((await editCharacter.run(db, player, { character: wren, changes: { field } })).ok).toBe(true);
    expect(patches.at(-1)!.edited_fields).toEqual(['mv']);
    expect(state.fields).toEqual({ mv: '35' });
    // The GM's full edit (the scores) sends every field back, the speed unchanged: no mark is written or taken away.
    state.edited_fields = [];
    expect((await editCharacter.run(db, gm, { character: wren, changes: { fields: { mv: '45', motto: 'Lights first' } } })).ok).toBe(true);
    expect('edited_fields' in patches.at(-1)!).toBe(false);
    expect(state.edited_fields).toEqual([]);
  });

  it('Undo of a speed edit clears the mark it set, and keeps a mark that was there before', async () => {
    // Purpose: Undo puts the old value back as it was: a filled speed restored by Undo is filled again (unmarked), and
    // a hand-written one restored is still hand-written; a field that is not a speed never gets a mark.
    const { speedEditMarks } = (await import('./movement.ts')) as unknown as { speedEditMarks: (fill: string | null, wasMarked: boolean) => { save?: boolean; undo?: boolean } };
    const state: Record<string, unknown> = { fields: { mv: '45' }, edited_fields: [] };
    const defs = [{ id: 'f1', campaign_id: 'c', key: 'mv', label: 'Movement', type: 'text', choices: null, field_group: null, sort_order: 1, show_on_card: false, hidden: false, created_at: '2026-11-14', fill: 'movement.speed', required: false, from_list: null }];
    const db = {
      from: (table: string) => {
        let patch: Record<string, unknown> | null = null;
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          update: (p: Record<string, unknown>) => ((patch = p), q),
          maybeSingle: () => Promise.resolve({ data: { ...state }, error: null }),
          then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
            if (table === 'field_definitions') return Promise.resolve({ data: defs, error: null }).then(resolve, reject);
            if (patch) Object.assign(state, patch);
            return Promise.resolve({ data: [{ id: 'actor-wren', campaign_id: 'c', owner_type: 'user', owner_user_id: 'user-a', approval: 'approved', status: 'active' }], error: null }).then(resolve, reject);
          },
        };
        return q;
      },
    } as unknown as Db;
    const wren: CharacterRef = { id: 'actor-wren', campaignId: 'c', ownerType: 'user', ownerUserId: 'user-a', approval: 'approved', archived: false };
    const player = { id: 'user-a', roles: { c: 'player' } } as const;
    const edit = async (value: string, mark: boolean | undefined) => {
      const field = { key: 'mv', value, ...(mark === undefined ? {} : { mark }) };
      expect((await editCharacter.run(db, player, { character: wren, changes: { field } })).ok).toBe(true);
    };
    // A filled 45, typed over by hand, then undone: filled again.
    const fresh = speedEditMarks('movement.speed', false);
    await edit('35', fresh.save);
    expect(state.edited_fields).toEqual(['mv']);
    await edit('45', fresh.undo);
    expect(state.edited_fields).toEqual([]);
    // A hand-written 35, typed over with 30, then undone: still hand-written.
    await edit('35', true);
    const again = speedEditMarks('movement.speed', true);
    await edit('30', again.save);
    await edit('35', again.undo);
    expect(state.edited_fields).toEqual(['mv']);
    expect(state.fields).toEqual({ mv: '35' });
    // Not a speed: no mark either way.
    expect(speedEditMarks(null, false)).toEqual({});
    expect(speedEditMarks('abilities.MUS', false)).toEqual({});
  });

  it("a speed typed at creation or in the draft editor is marked; one the fill gave and the player left is stored unmarked; an emptied one loses its mark", async () => {
    // Purpose: creation records a speed the player typed (guided or freeform) and never marks one the fill gave, so a
    // filled speed always follows the rules in force; other fields' marks are left as they are.
    const { speedMarks } = (await import('./movement.ts')) as unknown as {
      speedMarks: (fields: readonly { key: string; fill: string | null }[], edited: readonly string[], values: Readonly<Record<string, unknown>>, given: Readonly<Record<string, unknown>>) => string[];
    };
    const defs = [
      { key: 'mv', fill: 'movement.speed' },
      { key: 'fight', fill: 'movement.combat' },
      { key: 'motto', fill: null },
    ];
    expect(speedMarks(defs, [], { mv: '45' }, { mv: '45' })).toEqual([]);
    expect(speedMarks(defs, [], { mv: '35' }, { mv: '45' })).toEqual(['mv']);
    expect(speedMarks(defs, [], { mv: '35', fight: '12' }, {})).toEqual(['mv', 'fight']);
    expect(speedMarks(defs, ['motto', 'mv'], { mv: '', motto: 'Lights first' }, { mv: '45' })).toEqual(['motto']);
    expect(speedMarks(defs, ['mv'], { mv: '35' }, { mv: '35' })).toEqual(['mv']);
    expect(speedMarks(defs, ['motto'], { motto: 'Lights first' }, {})).toEqual(['motto']);
  });
});

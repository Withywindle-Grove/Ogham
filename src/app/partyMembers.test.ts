// Who is in the party, as the modifiers keyed to the party read them (ex-2, ga-3). Invented names.
import { describe, expect, it } from 'vitest';
import { partyReach } from '../modules/expedition/partyModifiers.ts';
import { partyMemberOf } from './partyMembers.ts';

describe('who is in the party, from the setting rules', () => {
  it("a character's class name and the skills their class names come from the setting's class entry", () => {
    const setting = { all: [{ kind: 'class', packEntryId: 'reed-witch', name: 'Reed Witch', data: { name: 'Reed Witch', skills: { names: { wade: 'Wade', 'read-reeds': '' } } } }] } as never;
    const wrenAsMember = partyMemberOf(setting, { id: 'wren', name: 'Wren', classRef: 'reed-witch' });
    expect(wrenAsMember).toEqual({ id: 'wren', name: 'Wren', classId: 'reed-witch', className: 'Reed Witch', skills: new Map([['wade', 'Wade'], ['read-reeds', 'read-reeds']]) });
    expect(partyReach({ ifPartyHas: { skill: 'wade' }, who: null, ifClass: null, onlyOnTerrain: [] }, [wrenAsMember], null)).toEqual({ scope: 'party', label: 'Wade in the party' });
    expect(partyMemberOf(setting, { id: 'tam', name: 'Tam' })).toMatchObject({ classId: null, className: null });
  });
});

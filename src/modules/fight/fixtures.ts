// Invented fixtures for the fight engine's tests (hard rule 2): no real game's names, rules or numbers.
import type { NewFoe, NewPartyMember, StartInput } from './engine.ts';
import type { FightRules, FightStatusEntry } from './types.ts';

export const SIDE_RULES: FightRules = {
  mode: 'side',
  rerollEachRound: false,
  ties: 'party',
  order: 'high',
  individualTies: null,
  roundSeconds: 6,
  dyingPerRound: null,
  deadAt: null,
};

export const INDIVIDUAL_RULES: FightRules = { ...SIDE_RULES, mode: 'individual' };

export const WREN: NewPartyMember = { id: 'wren', actorId: 'actor-wren', name: 'Wren', kind: 'character', hp: { current: 9, max: 12 } };
export const BRAM: NewPartyMember = { id: 'bram', actorId: 'actor-bram', name: 'Bram', kind: 'character', hp: { current: 14, max: 14 } };
export const TOBBLE: NewPartyMember = { id: 'tobble', actorId: 'actor-tobble', name: 'Tobble', kind: 'hireling', hp: { current: 5, max: 5 } };

export function lurker(n: number, extra: Partial<NewFoe> = {}): NewFoe {
  return { id: `lurker-${n}`, actorId: 'stat-bog-lurker', name: 'Bog lurker', groupId: 'bog-lurker', hp: { current: 7, max: 7 }, ...extra };
}

export function warden(n: number, extra: Partial<NewFoe> = {}): NewFoe {
  return { id: `warden-${n}`, actorId: 'stat-lantern-warden', name: 'Lantern warden', groupId: 'lantern-warden', hp: { current: 11, max: 11 }, ...extra };
}

export function status(id: string, extra: Partial<FightStatusEntry> = {}): FightStatusEntry {
  return { id, name: id, roundsLeft: null, healPerRound: null, secret: false, ...extra };
}

export function skirmish(rules: FightRules = SIDE_RULES, extra: Partial<StartInput> = {}): StartInput {
  return { id: 'fight-1', partyGroupId: 'group-1', rules, party: [WREN, BRAM], foes: [lurker(1), lurker(2)], ...extra };
}

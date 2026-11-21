// Who is in a group, as the modifiers keyed to the party read them (ruled 2026-11-03, ex-2, ga-3): each character's
// class (the pack's id and name) and the skills their class names. Pure.
import type { PartyMember } from '../modules/expedition/partyModifiers.ts';
import type { CampaignSetting } from './campaignSetting.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** One character as a party member: their class from the setting rules, and the skills (code → name) it names. */
export function partyMemberOf(setting: Pick<CampaignSetting, 'all'> | null, who: { id: string; name: string; classRef?: string | null }): PartyMember {
  const entry = who.classRef ? setting?.all.find((e) => e.kind === 'class' && e.packEntryId === who.classRef) : undefined;
  const data = isRecord(entry?.data) ? entry.data : {};
  const skills = isRecord(data.skills) ? data.skills : {};
  const names = isRecord(skills.names) ? skills.names : {};
  return {
    id: who.id,
    name: who.name,
    classId: who.classRef ?? null,
    className: entry?.name ?? (typeof data.name === 'string' ? data.name : null),
    skills: new Map(Object.entries(names).map(([code, name]) => [code, typeof name === 'string' && name.trim() ? name : code])),
  };
}

export const partyMembersOf = (setting: Pick<CampaignSetting, 'all'> | null, people: readonly { id: string; name: string; classRef?: string | null }[]): PartyMember[] =>
  people.map((p) => partyMemberOf(setting, p));

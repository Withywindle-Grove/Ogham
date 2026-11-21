// Arrange this screen (docs/05-features.md; M4 step 6, ruled 2026-10-23): each character's Player screen
// sections, shown or hidden and in order, the same on every device. The owner or the GM arranges it; it goes in
// the detailed log only. Sections arrive with their milestones; a section the layout doesn't mention yet is
// shown, after the ones it does.
// No screen uses it in R1: Arrange this screen is removed (Player screen redesign, ruled 2026-10-26). The command
// and its table stay, so the log's past arrangements still read and undo, and a later release can bring it back.
import { defineCommand, failed, fromWrite, isGm, isMember, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';

export interface SectionSetting {
  section: string;
  shown: boolean;
}

/** A Player screen section a character can use, with its name and a note for the Arrange sheet. */
export interface ScreenSection {
  section: string;
  label: string;
  note?: string;
}

/** The sections in order, each shown or not: the saved layout first, then any it doesn't mention yet (shown). */
export function arranged(available: ScreenSection[], saved: SectionSetting[]): (ScreenSection & { shown: boolean })[] {
  const known = new Map(available.map((s) => [s.section, s]));
  const fromSaved = saved.flatMap((s) => (known.has(s.section) ? [{ ...known.get(s.section)!, shown: s.shown }] : []));
  const rest = available.filter((s) => !saved.some((x) => x.section === s.section)).map((s) => ({ ...s, shown: true }));
  return [...fromSaved, ...rest];
}

export async function loadScreenLayout(db: Db, characterId: string): Promise<SectionSetting[] | null> {
  const found = await db.from('character_layouts').select('sections').eq('actor_id', characterId).maybeSingle();
  if (found.error) return null;
  const sections = found.data?.sections;
  return Array.isArray(sections)
    ? sections.flatMap((s) =>
        s && typeof s === 'object' && !Array.isArray(s) && typeof (s as { section?: unknown }).section === 'string'
          ? [{ section: String((s as { section: string }).section), shown: (s as { shown?: unknown }).shown !== false }]
          : [],
      )
    : [];
}

export const arrangeScreen = defineCommand({
  name: 'character.arrange',
  log: 'verbose',
  target: (input: { character: { id: string; campaignId: string; ownerUserId: string | null }; sections: SectionSetting[] }) => input.character,
  allowed: (user, character) => isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id),
  run: async (db, _user, input): Promise<CommandResult<SectionSetting[]>> => {
    if (input.sections.some((s) => !s.section)) return failed('Every section needs a name.');
    const saved = fromWrite(
      await db
        .from('character_layouts')
        .upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, sections: input.sections as unknown as Json })
        .select('actor_id'),
    );
    return saved.ok ? ok(input.sections) : saved;
  },
});

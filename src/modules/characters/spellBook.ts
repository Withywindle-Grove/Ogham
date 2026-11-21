// The spell book (M5b step 0c, slice 1; cr-13, cr-25; docs/04 PC extras): the character's known spells as a list of
// spell ids, written by First spells at creation. A list only: prepare, cast and Lost when hit stay in M7.
// Who sets it: the GM always; the owner while the character isn't approved, or while "spells" is still on its To
// finish list (Decide later on First spells, finished after approval). The database holds the same rule
// (supabase/migrations/20261102200000_m5b_0c_creation_data.sql, guard_spell_book).
import { defineCommand, failed, fromWrite, isGm, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { gmRuling, isOwner, toCharacterRef, type CharacterRef } from './commands.ts';

/** The most spells a book holds, and the longest id (the database's limits). */
export const SPELL_BOOK_MAX = 200;
const ID_MAX = 80;

/** The character, with the steps its creation record still lists to finish (toFinishOf, creationGuide.ts). */
export interface SpellBookCharacter extends CharacterRef {
  toFinish?: readonly string[];
}

/** Whether the owner may still write the book: not approved yet, or First spells left for later. */
export const ownerMayWriteSpellBook = (character: SpellBookCharacter) => character.approval !== 'approved' || (character.toFinish ?? []).includes('spells');

/** The ids cleaned: trimmed, each once, in the order given; null with a reason when one is too long or there are too many. */
export function cleanSpellBook(spellIds: readonly string[]): { ok: true; ids: string[] } | { ok: false; message: string } {
  const ids = [...new Set(spellIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.some((id) => id.length > ID_MAX)) return { ok: false, message: "That spell's id is too long." };
  if (ids.length > SPELL_BOOK_MAX) return { ok: false, message: `A spell book holds at most ${SPELL_BOOK_MAX} spells.` };
  return { ok: true, ids };
}

/** Set the spell book (creation.spellBook.set): the whole list, as First spells leaves it. */
export const setSpellBook = defineCommand({
  name: 'creation.spellBook.set',
  log: 'simple',
  target: (input: { character: SpellBookCharacter; spellIds: readonly string[] }) => input.character,
  allowed: (user, character: SpellBookCharacter) => !character.archived && (isGm(user, character.campaignId) || (isOwner(user, character) && ownerMayWriteSpellBook(character))),
  fiat: gmRuling,
  run: async (db, _user, input): Promise<CommandResult<CharacterRef>> => {
    const cleaned = cleanSpellBook(input.spellIds);
    if (!cleaned.ok) return failed<CharacterRef>(cleaned.message);
    const result = fromWrite(
      await db.from('actors').update({ spell_book: cleaned.ids as unknown as Json }).eq('id', input.character.id).select('id, campaign_id, owner_type, owner_user_id, approval, status'),
    );
    return result.ok ? { ok: true, value: toCharacterRef(result.value) } : result;
  },
});

/** The book as the database holds it, as a list of ids (anything else reads as empty). */
export const spellBookOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);

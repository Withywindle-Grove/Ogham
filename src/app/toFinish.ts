// The To finish list on a character's creation record (04 PC extras: toFinish; 05; M5b step 0): Decide later adds a
// step, finishing it takes it off. The record is read fresh first, so what the shopping saved meanwhile is kept.
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { loadCreationRecord } from '../core/characterSheet.ts';
import { editCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { toFinishOf, withToFinish } from '../modules/characters/creationGuide.ts';
import { registry } from './services.ts';

/**
 * Adds (later) or takes off (done) one step; resolves to the record saved, or a plain-words problem. `also` changes the
 * record in the same save (the Languages step's special approvals, cs-6); only before approval (after it the record is
 * the GM's).
 */
export async function saveToFinish(
  db: Db,
  user: CurrentUser,
  character: CharacterRef,
  step: string,
  later: boolean,
  also?: (record: Record<string, unknown>) => Record<string, unknown>,
): Promise<{ ok: true; creation: Record<string, unknown> } | { ok: false; message: string }> {
  const found = await loadCreationRecord(db, character.id);
  if (!found) return { ok: false, message: "Couldn't save that. Check your connection and try again." };
  const base = withToFinish(found.creation, step, later);
  const creation = also && character.approval !== 'approved' ? also(base) : base;
  // Done, it was never put off and nothing else changed: nothing to save (no empty edit in the log).
  if (!later && !toFinishOf(found.creation).includes(step) && JSON.stringify(creation) === JSON.stringify(base)) return { ok: true, creation };
  const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { creation } });
  return saved.ok ? { ok: true, creation } : { ok: false, message: saved.message };
}

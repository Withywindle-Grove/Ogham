// The rest prompt's read (dec-8 piece D): the characters who went, with what the setting needs to work out their
// slots and powers, and their spells and spent uses (character_play). The app's NightRest.tsx works out the rest.
import type { Db } from '../../core/supabase.ts';
import { toCharacterRef, type CharacterRef } from './commands.ts';
import { readPlay, type CharacterPlay } from './playState.ts';

/** One character as read for the rest prompt. */
export interface RestActor {
  ref: CharacterRef;
  name: string;
  level: number;
  classRef: string | null;
  raceRef: string | null;
  fields: unknown;
  creation: unknown;
  play: CharacterPlay;
}

/** The characters in the order given (those no longer readable left out); null if unreadable. */
export async function loadRestActors(db: Db, ids: readonly string[]): Promise<RestActor[] | null> {
  if (ids.length === 0) return [];
  const [actors, plays] = await Promise.all([
    db.from('actors').select('id, campaign_id, owner_type, owner_user_id, approval, status, name, level, classes, race_ref, fields, creation').in('id', [...ids]),
    db.from('character_play').select('actor_id, prepared, uses_spent, ac_override, form_id, chosen, spells_cast, rested_once').in('actor_id', [...ids]),
  ]);
  if (actors.error || plays.error) return null;
  const rows = (actors.data ?? []) as Record<string, unknown>[];
  const playRows = (plays.data ?? []) as Record<string, unknown>[];
  return ids.flatMap((id) => {
    const r = rows.find((row) => row.id === id);
    if (!r) return [];
    const first = Array.isArray(r.classes) ? (r.classes[0] as { classRef?: unknown } | undefined) : undefined;
    return [
      {
        ref: toCharacterRef(r as Parameters<typeof toCharacterRef>[0]),
        name: String(r.name ?? ''),
        level: typeof r.level === 'number' ? r.level : 1,
        classRef: typeof first?.classRef === 'string' ? first.classRef : null,
        raceRef: typeof r.race_ref === 'string' ? r.race_ref : null,
        fields: r.fields,
        creation: r.creation,
        play: readPlay(playRows.find((p) => p.actor_id === id) ?? null),
      },
    ];
  });
}

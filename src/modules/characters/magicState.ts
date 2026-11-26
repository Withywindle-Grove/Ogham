// A character's magic as state (December step 8, piece A; docs/plans/dec-8-magic-first-cut.md; mp-1, mp-2, mp-4,
// mp-6, mm-1). Three things kept apart, all in character_play:
//   * ready today: `prepared` (what the Player screen lists; the rest makes the chosen set ready, piece D);
//   * chosen for the next rest: `chosen` (mp-2), null when nothing new is chosen (the next rest brings back today's);
//   * cast today: `spells_cast`, a count per spell and level, never more than the times it is ready (mm-1's dots).
// Each command checks can(), writes an event and is undone by its opposite: choose again with the list before, uncast
// after a cast, the GM's set again with all three before. Casting goes through the database (cast_spell) so two
// devices can't both spend the last casting; the GM's set goes through set_spells, which refuses anyone else.
import { defineCommand, failed, fromError, fromWrite, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { preparedProblem, readPlay, type CharacterPlay, type PreparedSpell } from './playState.ts';

type Target = { id: string; campaignId: string; ownerUserId: string | null };

/** The owner (a member of the campaign) or the GM: as character_play's own rule. */
const mayChange = (user: CurrentUser, character: Target) =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

/** The key a spell's castings are counted under: "<level>:<spell id>" (the database builds the same). */
export const castKey = (level: number, spell: string) => `${level}:${spell}`;

/** The highest spell level and the longest spell id the database takes (cast_spell checks the same). */
export const SPELL_LEVEL_LIMIT = 99;
export const SPELL_ID_LIMIT = 200;

/** One ready spell as the Magic tab shows it (mm-1): one row a spell and level, a dot a casting when it is ready more than once. */
export interface ReadySpell {
  spell: string;
  level: number;
  /** How many times it is ready at this level. */
  times: number;
  /** How many of those are cast (never more than `times`). */
  cast: number;
}

/**
 * Today's ready spells, one row a spell and level, in the order first prepared (level by level, lowest first), each
 * with its castings spent. A count left over from a list that has since shrunk reads as all of them spent.
 */
export function readySpells(play: Pick<CharacterPlay, 'prepared' | 'spellsCast'>): ReadySpell[] {
  const rows = new Map<string, ReadySpell>();
  for (const p of play.prepared) {
    const key = castKey(p.level, p.spell);
    const row = rows.get(key);
    if (row) row.times += 1;
    else rows.set(key, { spell: p.spell, level: p.level, times: 1, cast: 0 });
  }
  for (const [key, row] of rows) row.cast = Math.min(row.times, play.spellsCast[key] ?? 0);
  return [...rows.values()].sort((a, b) => a.level - b.level);
}

/** What the next rest makes ready: the chosen set, or today's ready set when nothing new is chosen (mm-5). */
export function nextReady(play: Pick<CharacterPlay, 'prepared' | 'chosen'>): PreparedSpell[] {
  return play.chosen ?? play.prepared;
}

/**
 * Whether the character's first spells are open (fsr-1, fsr-7): never rested (nor set by the GM by hand) and nothing
 * cast today. While open, a choice in Prepare is ready at once. Never stored: a cast closes them and its Undo opens
 * them again with no write of its own. The one place the rule is written.
 */
export function firstSpellsOpen(play: Pick<CharacterPlay, 'restedOnce' | 'spellsCast'>): boolean {
  return !play.restedOnce && !Object.values(play.spellsCast).some((n) => n > 0);
}

/** The spells after a rest that brings magic back (piece D): the chosen set ready, nothing chosen anew, no casts. */
export function afterRest(play: Pick<CharacterPlay, 'prepared' | 'chosen'>): Pick<CharacterPlay, 'prepared' | 'chosen' | 'spellsCast'> {
  return { prepared: [...nextReady(play)], chosen: null, spellsCast: {} };
}

/** Casts kept only for spells still ready, and never more than the times each is ready (after the GM changes the ready set). */
export function trimCasts(spellsCast: Record<string, number>, ready: PreparedSpell[]): Record<string, number> {
  const times = new Map<string, number>();
  for (const p of ready) times.set(castKey(p.level, p.spell), (times.get(castKey(p.level, p.spell)) ?? 0) + 1);
  return Object.fromEntries(Object.entries(spellsCast).flatMap(([key, n]) => {
    const most = Math.min(n, times.get(key) ?? 0);
    return most > 0 ? [[key, most]] : [];
  }));
}

/** Why a spell list can't be stored, or null when it can: every entry a spell id and a whole-number level. */
function listProblem(list: PreparedSpell[]): string | null {
  const bad = list.find((p) => !p.spell.trim() || p.spell.length > SPELL_ID_LIMIT || !Number.isInteger(p.level) || p.level < 0 || p.level > SPELL_LEVEL_LIMIT);
  return bad ? 'One of those spells is missing its name or level.' : null;
}

/**
 * Choose the spells for the next rest (mp-1, mp-2; the simple log). Open at any time, for the owner and the GM; it
 * never touches what is ready today, except while the first spells are open (fsr-1): then a list given becomes what
 * is ready, at once, and nothing is left chosen. `chosen` null clears a choice (the next rest brings back today's);
 * Undo is this command again with the list before. A list that doesn't fit the slots is refused (Prepare's "Level 1
 * is full"), open or not.
 */
export const chooseSpells = defineCommand({
  name: 'character.chooseSpells',
  log: 'simple',
  target: (input: { character: Target; chosen: PreparedSpell[] | null; slots: number[] }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<PreparedSpell[] | null>> => {
    if (input.chosen) {
      const problem = listProblem(input.chosen) ?? preparedProblem(input.chosen, input.slots);
      if (problem) return failed(problem);
    }
    // Read first: open or not decides where the list goes (a missing row reads as open).
    const found = await db.from('character_play').select('spells_cast, rested_once').eq('actor_id', input.character.id).maybeSingle();
    if (found.error) return fromError(found.error);
    const atOnce = input.chosen !== null && firstSpellsOpen(readPlay(found.data));
    const change = atOnce ? { prepared: input.chosen as unknown as Json, chosen: null } : { chosen: input.chosen as unknown as Json };
    const saved = fromWrite(
      await db
        .from('character_play')
        .upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, ...change })
        .select('actor_id'),
    );
    return saved.ok ? ok(input.chosen) : saved;
  },
});

/**
 * Same as yesterday ("Pick", mm-4; the simple log): today's ready spells, as stored, become the choice for the next
 * rest, in one tap. Gives back the list chosen and the choice before it, for the toast's Undo (chooseSpells with it).
 */
export const sameAsYesterday = defineCommand({
  name: 'character.sameAsYesterday',
  log: 'simple',
  target: (input: { character: Target }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<{ chosen: PreparedSpell[]; before: PreparedSpell[] | null }>> => {
    const found = await db.from('character_play').select('prepared, chosen').eq('actor_id', input.character.id).maybeSingle();
    if (found.error) return fromError(found.error);
    const play = readPlay(found.data);
    const saved = fromWrite(
      await db
        .from('character_play')
        .upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, chosen: play.prepared as unknown as Json })
        .select('actor_id'),
    );
    return saved.ok ? ok({ chosen: play.prepared, before: play.chosen }) : saved;
  },
});

type CastInput = { character: Target; spell: string; level: number; /** The spell's name, for a refusal's words. */ name?: string };

/** The database's refusal in the spell's own name ("Every casting of Mire lamp is spent."). */
function castResult(result: { data: unknown; error: { code?: string; message: string } | null }, name: string | undefined): CommandResult<Record<string, number>> {
  if (result.error) {
    const refused = fromError<Record<string, number>>(result.error);
    return !refused.ok && refused.reason === 'failed' && name ? { ...refused, message: refused.message.replace('that spell', name).replace('That spell', name) } : refused;
  }
  return ok(readPlay({ spells_cast: result.data }).spellsCast);
}

/**
 * Cast a ready spell (mp-6: one tap, never asks who or where; the simple log, so Undo from the log works, mp-8): one
 * casting of it is spent. The database does the counting with the row locked: of two devices casting the last
 * casting at once, one succeeds and the other is refused with a reason. Gives back today's casts.
 */
export const castSpell = defineCommand({
  name: 'character.castSpell',
  log: 'simple',
  target: (input: CastInput) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<Record<string, number>>> =>
    castResult(await db.rpc('cast_spell', { actor: input.character.id, spell: input.spell, spell_level: input.level, change: 1 }), input.name),
});

/** Undo a cast (the toast's Undo; the simple log): one casting of that spell comes back. */
export const uncastSpell = defineCommand({
  name: 'character.uncastSpell',
  log: 'simple',
  target: (input: CastInput) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<Record<string, number>>> =>
    castResult(await db.rpc('cast_spell', { actor: input.character.id, spell: input.spell, spell_level: input.level, change: -1 }), input.name),
});

/** The three things the GM's set changes; what it leaves out stays as it is. */
export interface SpellsSet {
  ready?: PreparedSpell[];
  /** Null clears the choice. */
  chosen?: PreparedSpell[] | null;
  spellsCast?: Record<string, number>;
}

/**
 * The GM fills or changes anyone's spells at any time (mp-4; GM only; the simple log): what is ready, what is chosen,
 * what is cast. A new ready set with no casts given keeps the casts of the spells still ready (trimmed in the database). Gives
 * back all three as they were, so Undo is this command again with them.
 */
export const setSpells = defineCommand({
  name: 'character.setSpells',
  log: 'simple',
  target: (input: { character: Target } & SpellsSet) => input.character,
  allowed: (user, character) => isGm(user, character.campaignId),
  run: async (db, _user, input): Promise<CommandResult<Required<SpellsSet>>> => {
    for (const list of [input.ready, input.chosen]) {
      const problem = list ? listProblem(list) : null;
      if (problem) return failed(problem);
    }
    if (input.spellsCast && Object.values(input.spellsCast).some((n) => !Number.isInteger(n) || n < 0)) return failed('A count of casts must be a whole number, 0 or more.');
    const found = await db.from('character_play').select('prepared, chosen, spells_cast').eq('actor_id', input.character.id).maybeSingle();
    if (found.error) return fromError(found.error);
    const was = readPlay(found.data);
    const ready = input.ready ?? was.prepared;
    const chosen = input.chosen === undefined ? was.chosen : input.chosen;
    // No casts given: the database keeps today's, trimmed to the new ready set against the locked row, so a cast made
    // on another device since this read isn't lost.
    const spellsCast = input.spellsCast ? trimCasts(input.spellsCast, ready) : null;
    const { error } = await db.rpc('set_spells', { actor: input.character.id, new_ready: ready as unknown as Json, new_chosen: chosen as unknown as Json, new_cast: spellsCast });
    if (error) return fromError(error);
    return ok({ ready: was.prepared, chosen: was.chosen, spellsCast: was.spellsCast });
  },
});

/** The commands of piece A, for the module's registry. */
export const MAGIC_STATE_COMMANDS = [chooseSpells, sameAsYesterday, castSpell, uncastSpell, setSpells] as const;


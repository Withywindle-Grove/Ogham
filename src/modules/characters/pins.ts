// Pin a spell of the character's own to At hand, or any ability or trait of it to the Player tab's right column's list
// (December step 13, row C8; Francis's yes pin-2, 2026-11-15: "A player may pin a spell or a trait of their own
// character to At hand; it adds a record and removes nothing."; widened by euf-2 to euf-4, 2026-11-19, row P2 of
// plans/test-feedback-2026-11-19: every ability and trait, with uses or without, kept in the player's own order).
// Pins live in `character_play.pins`, beside the rest of the character's play state: the owner of an approved
// character or the GM changes them, every member who can read the character reads them (as with prepared spells).
// Unpinning is an update of the list, never a delete of a row, so Undo is this command again the other way.
import { defineCommand, failed, fromError, fromWrite, isGm, isMember, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { PIN_KEY_LIMIT, PIN_LIMIT, PIN_LIMIT_WORDS, readPins, type Pin, type PinKind } from './playState.ts';

type Target = { id: string; campaignId: string; ownerUserId: string | null };
const mayChange = (user: { id: string } & Parameters<typeof isGm>[0], character: Target) =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

/**
 * Pin a spell, an ability or a trait, or unpin it (`pinned` false; the simple log). An ability and a trait are kind
 * `trait`, keyed by name, with uses or without (euf-2). Pinning the same thing twice, or unpinning what isn't pinned,
 * changes nothing and gives the list back as it was. An empty key and a kind other than spell or trait are refused, and
 * so is a 25th pin, with the ruled words (pg28-5). Gives back the pins after the change. `at` puts a pin at that place in
 * the list (a toast's Undo of an unpin); without it a pin goes last. Given for one already pinned, `at` moves it there
 * and changes nothing else (euf-4, the player's own order: Move up, Move down, hold to move); the list's own order is
 * the order shown. A move is the same command, so it is in the simple log too (no new command, no migration).
 */
export const pinToAtHand = defineCommand({
  name: 'character.pin',
  log: 'simple',
  target: (input: { character: Target; kind: PinKind; key: string; pinned: boolean; at?: number }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<Pin[]>> => {
    const kind: unknown = input.kind;
    if (kind !== 'spell' && kind !== 'trait') return failed('Only a spell, an ability or a trait can be pinned.');
    const key = typeof input.key === 'string' ? input.key.trim() : '';
    if (!key) return failed('Say which one to pin.');
    if (key.length > PIN_KEY_LIMIT) return failed('That name is too long to pin.');
    const found = await db.from('character_play').select('pins').eq('actor_id', input.character.id).maybeSingle();
    if (found.error) return fromError(found.error);
    const was = readPins(found.data?.pins);
    const pinned = input.pinned === true;
    const index = was.findIndex((p) => p.kind === kind && p.key === key);
    const here = index >= 0;
    const placed = Number.isInteger(input.at) && (input.at as number) >= 0;
    // A move: one already pinned, given a place it isn't at (the list without it, then it put back there).
    const moving = pinned && here && placed && Math.min(input.at as number, was.length - 1) !== index;
    if (pinned === here && !moving) return ok(was);
    if (pinned && !here && was.length >= PIN_LIMIT) return failed(PIN_LIMIT_WORDS);
    const others = was.filter((_, i) => i !== index);
    const at = placed ? Math.min(input.at as number, others.length) : others.length;
    const next: Pin[] = pinned ? [...others.slice(0, at), { kind, key }, ...others.slice(at)] : others;
    const saved = fromWrite(
      await db.from('character_play').upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, pins: next as unknown as Json }).select('actor_id'),
    );
    return saved.ok ? ok(next) : saved;
  },
});

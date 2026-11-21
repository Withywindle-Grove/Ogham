// Pin a spell or a trait of the character's own to At hand (December step 13, row C8; Francis's yes pin-2, 2026-11-15:
// "A player may pin a spell or a trait of their own character to At hand; it adds a record and removes nothing.").
// Pins live in `character_play.pins`, beside the rest of the character's play state: the owner of an approved
// character or the GM changes them, every member who can read the character reads them (as with prepared spells).
// Unpinning is an update of the list, never a delete of a row, so Undo is this command again the other way.
import { defineCommand, failed, fromError, fromWrite, isGm, isMember, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { PIN_KEY_LIMIT, PIN_LIMIT, readPins, type Pin, type PinKind } from './playState.ts';

type Target = { id: string; campaignId: string; ownerUserId: string | null };
const mayChange = (user: { id: string } & Parameters<typeof isGm>[0], character: Target) =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

/**
 * Pin a spell or a trait to At hand, or unpin it (`pinned` false; the simple log). Pinning the same thing twice, or
 * unpinning what isn't pinned, changes nothing and gives the list back as it was. An empty key and a kind other than
 * spell or trait are refused, and so is a 25th pin. Gives back the pins after the change. `at` puts a pin back where it
 * was in the list (a toast's Undo of an unpin); without it a pin goes last.
 */
export const pinToAtHand = defineCommand({
  name: 'character.pin',
  log: 'simple',
  target: (input: { character: Target; kind: PinKind; key: string; pinned: boolean; at?: number }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<Pin[]>> => {
    const kind: unknown = input.kind;
    if (kind !== 'spell' && kind !== 'trait') return failed('Only a spell or a trait can be pinned here.');
    const key = typeof input.key === 'string' ? input.key.trim() : '';
    if (!key) return failed('Say which one to pin.');
    if (key.length > PIN_KEY_LIMIT) return failed('That name is too long to pin.');
    const found = await db.from('character_play').select('pins').eq('actor_id', input.character.id).maybeSingle();
    if (found.error) return fromError(found.error);
    const was = readPins(found.data?.pins);
    const pinned = input.pinned === true;
    const here = was.some((p) => p.kind === kind && p.key === key);
    if (pinned === here) return ok(was);
    if (pinned && was.length >= PIN_LIMIT) return failed(`At hand keeps up to ${PIN_LIMIT} pins; unpin one first.`);
    const at = Number.isInteger(input.at) && (input.at as number) >= 0 ? Math.min(input.at as number, was.length) : was.length;
    const next: Pin[] = pinned ? [...was.slice(0, at), { kind, key }, ...was.slice(at)] : was.filter((p) => !(p.kind === kind && p.key === key));
    const saved = fromWrite(
      await db.from('character_play').upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, pins: next as unknown as Json }).select('actor_id'),
    );
    return saved.ok ? ok(next) : saved;
  },
});

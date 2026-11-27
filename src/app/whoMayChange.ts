// The blocked Sheet's line when a viewer can't change something on a character (its hit points, its portrait).
import { isGm, RETIRED, type CurrentUser } from '../core/commands.ts';
import { isOwner, type CharacterRef } from '../modules/characters/commands.ts';
import { possessive } from '../core/nameWords.ts';

/** "Only Wren's player and the GM can change Wren's hit points." (or why it can't change at all just now). */
export function whoMayChange(user: CurrentUser, character: CharacterRef & { name: string }, what: string): string {
  if ((user.retired ?? []).includes(character.campaignId)) return RETIRED;
  if (!isGm(user, character.campaignId) && !isOwner(user, character)) return `Only ${possessive(character.name)} player and the GM can change ${what}.`;
  return `${character.name} isn't in play, so ${what} can't change now. Ask your GM.`;
}

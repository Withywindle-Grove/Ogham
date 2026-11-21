// The log's words for a move between linked places (Move on, place.moveOn; December step 4, piece c), ruled by the
// lead as words, 2026-11-11. They live here and nowhere else, after the pattern fm-1 sets for travel
// (`TRAVEL_PLACE_WORDS` in src/core/travelWords.ts, pull request #628, not on main yet): when that merges, these can
// sit beside it. A place's name reaches a player's device only once the place has been shown to their group
// (public.party_moves gives null until then), and the words then name no place. The way taken is the GM's alone.

const turnsWords = (turns: number) => `${turns} ${turns === 1 ? 'turn' : 'turns'}`;
const tail = (turns: number | null) => (turns === null ? '' : `: ${turnsWords(turns)}`);

export const MOVE_ON_WORDS = {
  /** After the GM's name: "moved the party to The Moth Gallery: Rowing, 3 turns" (no way named: "…: 3 turns"). */
  gmMoved: (place: string | null, way: string | null, turns: number | null, passed: string) =>
    `moved the party to ${place || 'a place'}: ${way ? `${way}, ` : ''}${turns === null ? passed : turnsWords(turns)}`,
  /** A player's line: "The party moved to The Gallery: 3 turns." or, the place not shown to them, "The party moved on: 3 turns." */
  playerMoved: (place: string | null, turns: number | null) => (place ? `The party moved to ${place}${tail(turns)}.` : `The party moved on${tail(turns)}.`),
  /** After the GM's name: "undid the move to The Moth Gallery: the party is back at The Reed Stair". */
  gmUndone: (to: string | null, from: string | null) => `undid the move to ${to || 'a place'}: the party is back at ${from || 'somewhere unnamed'}`,
  /** A player's line: "The party is back at The Stair." or, that place not shown to them, "The party went back." */
  playerUndone: (from: string | null) => (from ? `The party is back at ${from}.` : 'The party went back.'),
};

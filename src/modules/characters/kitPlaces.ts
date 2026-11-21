// Where a starting kit's items land (ruled 2026-10-26): by the same rules as Add item, with no pack field. Armour
// the class can wear is worn; a weapon or shield goes in hand while hands are free; containers come first and
// everything else goes into the first one (the backpack), or is carried when the kit and pack have none. Anything
// the class can't use goes into the backpack instead, and the card says why. Pure: the class check is passed in.

export type KitPlace = 'worn' | 'hand' | 'carried' | 'container';

/** One kit line to place: its item data (slot, hands, container) and how many. */
export interface KitPiece<T> {
  item: T;
  name: string;
  qty: number;
  data: Record<string, unknown>;
}

export interface PlacedPiece<T> extends KitPiece<T> {
  place: KitPlace;
  /** Why it isn't worn or held when it would have been ("Lantern Wardens can't wear plate"). */
  why?: string;
}

const isObject = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isKitContainer = (data: Record<string, unknown>) => isObject(data.container);
const slotOf = (data: Record<string, unknown>) => (typeof data.slot === 'string' ? data.slot : '');
const handsOf = (data: Record<string, unknown>) => (data.hands === 2 ? 2 : 1);

/**
 * Places each piece. `check` says why the character can't put one on (given what's already on), or null when it
 * can; `worn` is what the character already wears or holds (slots and hands used).
 */
export function placeKit<T>(
  pieces: readonly KitPiece<T>[],
  check: (piece: KitPiece<T>, on: readonly KitPiece<T>[]) => string | null,
  already: { armour: boolean; hands: number; container: boolean } = { armour: false, hands: 0, container: false },
): PlacedPiece<T>[] {
  const containers = pieces.filter((p) => isKitContainer(p.data));
  const rest = pieces.filter((p) => !isKitContainer(p.data));
  const hasContainer = already.container || containers.length > 0;
  const stowed = hasContainer ? ('container' as const) : ('carried' as const);
  const on: KitPiece<T>[] = [];
  let armour = already.armour;
  let hands = already.hands;
  const placed: PlacedPiece<T>[] = containers.map((p) => ({ ...p, place: 'carried' }));
  for (const piece of rest) {
    const slot = slotOf(piece.data);
    // Armour one at a time; `worn` items (mb-5: gloves, rings) any number, taking no hand.
    const wearable = (slot === 'armour' && !armour) || slot === 'worn';
    const holdable = (slot === 'hand' || slot === 'shield') && piece.qty === 1 && hands + handsOf(piece.data) <= 2;
    if (!wearable && !holdable) {
      placed.push({ ...piece, place: stowed });
      continue;
    }
    const why = check(piece, on);
    if (why) {
      placed.push({ ...piece, place: stowed, why });
      continue;
    }
    on.push(piece);
    if (slot === 'armour') armour = true;
    else if (!wearable) hands += handsOf(piece.data);
    placed.push({ ...piece, place: wearable ? 'worn' : 'hand' });
  }
  return placed;
}

/** The places as Show all groups them, in order, each with its pieces; empty groups left out. */
export function kitGroups<T>(placed: readonly PlacedPiece<T>[], backpack: string | null): { name: string; pieces: PlacedPiece<T>[] }[] {
  const groups = [
    { name: 'Worn and held', pieces: placed.filter((p) => p.place === 'worn' || p.place === 'hand') },
    { name: 'Carried', pieces: placed.filter((p) => p.place === 'carried') },
    { name: `In the ${(backpack ?? 'backpack').toLowerCase()}`, pieces: placed.filter((p) => p.place === 'container') },
  ];
  return groups.filter((g) => g.pieces.length > 0);
}

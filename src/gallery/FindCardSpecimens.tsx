// The find card in the component gallery (K18b of plan dec-6-the-whole-pack-tab; page 45, approved 2026-11-26, over
// page 08's PK2, PK2b and PK3, approved 2026-11-14): one thing, four, five, fourteen (messy), coin alone, coin at its cap,
// said once, the offline box, a find onto a stack, the GM's Undo (one of two, both, a long name) and a line that carried
// its own giver holding its room. Each card is made by K18a's `findCard` from entries, at a fixed time. Invented words.
import type { ReactElement, ReactNode } from 'react';
import { FindCard } from '../app/FindCard.tsx';
import type { FindCardWords } from '../modules/characters/findCard.ts';
import type { CoinFind, FindEntry, ThingFind } from '../modules/characters/findsSeen.ts';

const NOW = '2026-12-06T20:00:00.000Z';
const JUST = '2026-12-06T19:58:00.000Z';
const TODAY = '2026-12-06T15:00:00.000Z';
const DAY3 = '2026-12-04T11:00:00.000Z';
const LONG_GIVER = 'Fenna of the Long Causeway below the Old Lantern'; // words: names
const LONG_THING = 'The Old Lantern of the Drowned and of the Nine Tides'; // words: names
const COINS = ['crowns', 'herons', 'bits'];
const words: FindCardWords = {
  names: new Map([
    ['tam', 'Tam'], // words: names
    ['fenna', LONG_GIVER],
  ]),
  coinWords: (coins) =>
    COINS.filter((k) => (coins[k] ?? 0) > 0)
      .map((k) => `${coins[k]!.toLocaleString('en-GB')} ${k}`)
      .join(', '),
  when: (at) => (at.startsWith('2026-12-06') ? 'today' : 'day 3'),
  now: NOW,
};
const GM = { kind: 'gm' } as const;
const TAM = { kind: 'character', characterId: 'tam' } as const;
const FENNA = { kind: 'character', characterId: 'fenna' } as const;
const BACK = { byGm: true, at: NOW };
let seq = 0;
const thing = (name: string, o: Partial<ThingFind> = {}): ThingFind => ({
  kind: 'thing', lineId: `g${++seq}`, name, arrived: 1, now: null, who: GM, at: JUST, takenBack: null, ...o,
});
const coin = (coins: Record<string, number>, o: Partial<CoinFind> = {}): CoinFind => ({
  kind: 'coin', purseId: 'wren-purse', coins, who: GM, at: JUST, takenBack: null, ...o,
});
const back = (e: ThingFind): ThingFind => ({ ...e, lineId: null, takenBack: BACK });
const nothing = () => {};
const card = (entries: FindEntry[], offlineBox = false) => <FindCard entries={entries} words={words} onGotIt={nothing} onMore={nothing} offlineBox={offlineBox} />;

// Newest first, as K20a gives them.
const RING = thing('Bronze ring');
const OPALS = thing('Moon opals', { arrived: 2, at: '2026-12-06T19:57:00.000Z' });
const KEY_FROM_TAM = thing('Silver key', { who: TAM, at: DAY3 });
const fourteen: FindEntry[] = [
  coin({ herons: 999_999_999 }, { at: TODAY }),
  thing('Silver key', { who: FENNA }),
  thing(LONG_THING, { arrived: 999, at: TODAY }),
  ...Array.from({ length: 11 }, (_, i) => thing(`Boat hook ${i + 1}`, { at: TODAY })),
];

export function FindCardSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="One thing (FD1, p45-14): “Got it” beside its line">{card([RING])}</Specimen>
      <Specimen name="One thing, taken back (FD11b B, fix 2): its giver and time under the head">
        {card([back(RING)])}
      </Specimen>
      <Specimen name="Four, each with its own giver (FD3b B, p45-5): all listed, the plain head">
        {card([RING, OPALS, thing('Hooded lantern', { at: '2026-12-06T19:56:00.000Z' }), KEY_FROM_TAM])}
      </Specimen>
      <Specimen name="Five (FD3b C): the head counts, three lines and “and 2 more”">
        {card([RING, OPALS, thing('Boat hooks', { arrived: 4 }), thing('Hooded lantern'), thing('Lamp oil', { arrived: 3 })])}
      </Specimen>
      <Specimen name="Fourteen, messy (FD3b D): coin at its cap, a long giver, a long name ×999; nothing cut">{card(fourteen)}</Specimen>
      <Specimen name="Coin alone (FD4b A): “New in your coin”">{card([coin({ herons: 240 })])}</Specimen>
      <Specimen name="Coin at its cap, two coins on one line (FD4b B): it wraps beside “Got it”">
        {card([coin({ crowns: 3, herons: 999_999_999 })])}
      </Specimen>
      <Specimen name="A hoard, said once (FD5c A, p45-7): one giver and time under the head; coin first">
        {card([coin({ herons: 240 }), thing('Moon opals', { arrived: 2 }), thing('Boat hooks', { arrived: 4 }), thing('Hooded lantern')])}
      </Specimen>
      <Specimen name="Coin and things, givers differ (FD5c B): coin first, “In your coin.” after its own giver">
        {card([coin({ herons: 240 }), thing('Moon opals', { arrived: 2 }), KEY_FROM_TAM])}
      </Specimen>
      <Specimen name="An oddly printed coin, as the player reads it (FD5c C): the setting’s words, no note">
        {card([coin({ herons: 200 }), thing('Brass spyglass')])}
      </Specimen>
      <Specimen name="Coin alone, taken back (F8): no “the”; its giver and time under the head">
        {card([coin({ herons: 240 }, { takenBack: BACK })])}
      </Specimen>
      <Specimen name="Offline, after a tap on “Got it” (FD9, p45-12): the box under the card">{card([RING], true)}</Specimen>
      <Specimen name="Onto a stack (FD3c A, p45-22): what arrived in bold, the new count plain">
        {card([thing('River pearls', { arrived: 2, now: 8 })])}
      </Specimen>
      <Specimen name="Onto a stack, messy (FD3c C): a long name, ×999 onto 999">
        {card([thing(LONG_THING, { arrived: 999, now: 1998, who: FENNA })])}
      </Specimen>
      <Specimen name="Two finds, before the GM’s Undo (FD11 A)">{card([RING, OPALS])}</Specimen>
      <Specimen name="One taken back of two (FD11 B, p45-25): its line quiet in its place; the card’s height holds">
        {card([back(RING), OPALS])}
      </Specimen>
      <Specimen name="Both taken back (FD11 C, F8): the card stays until “Got it”">{card([back(RING), back(OPALS)])}</Specimen>
      <Specimen name="A long name taken back (FD11 E): the quiet line wraps, nothing cut">
        {card([back(thing(LONG_THING, { arrived: 999, at: TODAY })), thing('Moon opals', { arrived: 2, at: TODAY })])}
      </Specimen>
      <Specimen name="Two givers, before the GM’s Undo: each line says its own">{card([RING, KEY_FROM_TAM])}</Specimen>
      <Specimen name="Two givers, the ring taken back: its quiet line keeps the room its giver’s line took">
        {card([back(RING), KEY_FROM_TAM])}
      </Specimen>
    </>
  );
}

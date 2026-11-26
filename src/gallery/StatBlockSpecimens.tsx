// The stat block (December 5c; mockup docs/design/mockups/december/06-stat-block, frames 1 to 6): one part, drawn once,
// for the detail row's pop-up and the Rules browser; the detail rows and their one pop-up (sf-6a; page 44, EN1, EN3);
// messy data; a pack with no layout. Invented creatures and numbers only; the phone width is the gallery's own 375 px run. Frame 2 (the Rules
// browser) is the same part inside the browser's list and search, whose field styles the gallery doesn't load: it is the
// layout screen gm-rules-browser instead.
import type { ReactElement, ReactNode } from 'react';
import { BookDetailPopUp, BookDetailRow, type BookDetail } from '../app/BookDetail.tsx';
import { CreatureRows, creatureDetail, type StatBlockRef } from '../app/EncounterWaiting.tsx';
import { StatBlock } from '../app/StatBlock.tsx';
import { layOutStatBlock, type StatBlockLayout } from '../modules/library/statBlockLayout.ts';

const FEN: StatBlockLayout = {
  descriptor: ['Size', 'Wits', 'Alignment'],
  groups: [
    [['Level', 'Armour', 'hp', 'Saves'], ['Attacks'], ['Speed', 'Morale', 'Experience']],
    [['Met'], ['Behaviour'], ['Speech'], ['Possessions', 'Hoard']],
  ],
  hide: [],
};

const lurker = {
  id: 'bog-lurker',
  name: 'Bog lurker',
  description: 'A grey shape under the duckweed. Drags its prey under and holds it there.',
  hp: '2d8',
  hpAverage: 9,
  fields: {
    Size: 'Medium beast',
    Wits: 'animal wits',
    Alignment: 'unaligned',
    Level: '2',
    Armour: '7',
    Saves: 'D12 W13 S14 B15 Sp16',
    Attacks: 'Bite (+1, 1d6) and drag under',
    Speed: '60 swimming',
    Morale: '8',
    Experience: '35',
    Met: '2d4 (2 in 6 in its pool)',
    Behaviour: 'Patient, territorial, never leaves the water',
    Speech: 'None',
    Possessions: 'None',
    Hoard: 'What its prey carried',
  },
  abilities: [
    { name: 'Ambush from the water', note: 'A lurker lying still under weed is not seen unless someone searches the water. It surprises on 4 in 6.' },
    { name: 'Drag under', note: 'A bitten character is held. Each round held under, a save or the character begins to drown.' },
    { name: 'Dark sight', note: 'Sees normally without light.' },
  ],
  source: 'p. 31',
};

const hag = {
  name: 'Reed hag',
  description: 'Old, patient, and hungry.',
  hp: '5d8',
  hpAverage: 22,
  fields: { Size: 'Medium fey', Wits: 'cunning', Alignment: 'Mire', Level: '5', Armour: '5', Saves: 'D10 W11 S12 B13 Sp12', Attacks: '2 claws (+4, 1d4) or spell', Speed: '40', Morale: '9', Experience: '300', Met: '1' },
};

const titan = {
  name: 'Mire titan',
  hp: '9d8',
  hpAverage: 40,
  fields: {
    Size: 'Large beast',
    Wits: 'cunning',
    Alignment: 'unaligned',
    Level: '9',
    Armour: '2',
    Saves: 'D8 W9 S10 B10 Sp11',
    Attacks: '2 claws (+8, 1d8), bite (+8, 2d6 and poison), tail lash (+6, 1d10, reach 15), or a hurled stone (+6, 3d6, range 90) once every third round',
    Speed: '50, climbing 30',
    Morale: '10',
    Experience: '2,300',
    Met: '1d3 (999 in the deep fen)',
  },
  abilities: [{ name: 'Poison', note: 'A save or 0 hit points in 1d6 turns.' }],
};

const ref = (data: Record<string, unknown> & { name: string; description?: string }, layout: StatBlockLayout | null, count: string | null = null): StatBlockRef & { count: string | null } => ({
  name: data.name,
  description: data.description ?? null,
  count,
  full: { shown: layOutStatBlock(data, layout), source: 'From your setting: Fen Rules, p. 31' },
});

const ferryman = { name: 'Ferryman', fields: { Level: '1', Armour: '9', Attacks: 'Boat hook (+0, 1d6)', Speed: '40', Morale: '7' } };
const ONE_GROUP: StatBlockLayout = { descriptor: ['Kind'], groups: [[['Level', 'Armour', 'hp', 'Attacks', 'Speed', 'Morale']]], hide: [] };

/** A named character (EN3 B): their own words, then the block they use. */
const harl: BookDetail = {
  name: 'Old Harl', // words: names
  kind: 'a ferryman',
  shown: layOutStatBlock(
    {
      name: 'Old Harl', // words: names
      description: 'Works the ferry at the jetty and knows who tied up this week. He will not cross after dark.',
      fields: { Kind: 'A ferryman, wary' },
      abilities: [{ name: 'Wants', note: 'his fare, and no trouble with the wardens.' }],
    },
    ONE_GROUP,
  ),
  source: 'From your adventure: Saltwick Island, p. 13',
  uses: { name: 'Ferryman', shown: layOutStatBlock({ ...ferryman, hp: '1d6', hpAverage: 3 }, ONE_GROUP) },
};

/** An item (EN3 C): how many, then its rule. */
const oil: BookDetail = {
  name: 'Lamp oil',
  count: '8',
  rule: 'One flask fills a lantern once. Thrown and lit, it burns where it lands.',
  shown: layOutStatBlock(
    {
      name: 'Lamp oil',
      description: 'A clay flask, stoppered with wax.',
      abilities: [
        { name: 'In a lantern', note: 'one flask fills a lantern once.' },
        { name: 'Thrown', note: 'lit and thrown, it burns where it lands.' },
      ],
    },
    null,
  ),
  source: 'From your setting: Fen Rules, p. 12',
};

/** Messy (EN3 D): a very long name, and no stat block in the packs. */
const warden: BookDetail = {
  name: 'The Old Ferrywarden of the Nine Drowned Tides and the Long Sedge Causeway', // words: names
  kind: 'a warden, old',
  shown: layOutStatBlock({ name: 'Warden', description: 'Keeps the customs shed and its ledgers.', fields: { Kind: 'A warden, old' } }, ONE_GROUP),
  source: 'From your adventure: Saltwick Island',
  uses: null,
};

export function StatBlockSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="1. A detail row's pop-up, a creature (EN3 A): the name as the head with the X on its line, no title line; how many, the description, the descriptor in small capitals, the figures in the pack's groups with a rule between, the abilities, the source">
        <BookDetailPopUp detail={creatureDetail(ref(lurker, FEN, '2'))} onClose={() => undefined} preview />
      </Specimen>
      <Specimen name="3. The encounter's creatures as detail rows (EN1 B): the whole row the tap, between dotted rules, the name with its count, its stat line, the arrow; one not in the packs says so">
        <CreatureRows blocks={[ref(lurker, FEN, '2'), ref(hag, FEN, '1'), { missing: 'fen-rules:salt-hag', count: '1' }]} />
      </Specimen>
      <Specimen name="3. Detail rows (EN1 D; DT1): a named character with their kind and the line they use; an item's rule; the short row; no stat block in the packs; a very long name; a count of 999">
        <BookDetailRow detail={harl} />
        <BookDetailRow detail={oil} />
        <BookDetailRow detail={harl} short="Same stat line as the Ferryman." />
        <BookDetailRow detail={warden} />
        <BookDetailRow detail={creatureDetail(ref(titan, FEN, '999'))} />
      </Specimen>
      <Specimen name="3. The pop-up, a named character (EN3 B): their kind, their words, then the block they use under its name">
        <BookDetailPopUp detail={harl} onClose={() => undefined} preview />
      </Specimen>
      <Specimen name="3. The pop-up, an item (EN3 C): how many, then its rule">
        <BookDetailPopUp detail={oil} onClose={() => undefined} preview />
      </Specimen>
      <Specimen name="3. The pop-up, messy (EN3 D): a very long name wraps under the X's line; no stat block in the packs">
        <BookDetailPopUp detail={warden} onClose={() => undefined} preview />
      </Specimen>
      <Specimen name="4. Messy: three figures only (one short line, nothing drawn empty)">
        <StatBlock shown={layOutStatBlock({ name: 'Reed wisp', fields: { Armour: '9', 'Hit points': '1', Speed: '10' } }, { descriptor: [], groups: [[['Armour', 'Hit points', 'Speed']]], hide: [] })} source={null} />
      </Specimen>
      <Specimen name="4. Messy: no abilities (the block ends after its groups)">
        <StatBlock shown={layOutStatBlock(hag, FEN)} source={null} />
      </Specimen>
      <Specimen name="4. Messy: a very long attacks line wraps; 999 and 2,300; a d3 has no glyph">
        <StatBlock shown={layOutStatBlock(titan, FEN)} source={null} />
      </Specimen>
      <Specimen name="6. A pack that declares no layout: one compact group in the pack's own order, no descriptor, no rule">
        <StatBlock shown={layOutStatBlock(lurker, null)} source={null} />
      </Specimen>
      <Specimen name="6. A pack with no layout in a detail row: the stat line is the first six figures">
        <CreatureRows blocks={[ref(lurker, null, '2d4')]} />
      </Specimen>
    </>
  );
}

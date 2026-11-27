// The book's tapped table (dec-10 E; pictures creation/final 20-E1, 20-E2, 20-E3) in the component gallery: a kindred's
// knacks with one picked, a class's rolled spells with one already the character's, and a list of languages taking two,
// with a closed row in its place and one needing the GM's leave; then a row found by "Go to number" (sf-5, N2) and the
// buttons that open "Roll…"'s real pop-up (page 44, EN2, EN7 D to F): from "Change…", a tall table, a d100 table and
// loading. Invented words only. New pictures: CI draws them and they go to Design.
import { useState, type ReactElement, type ReactNode } from 'react';
import { TableRollPopUp } from '../app/EncounterTables.tsx';
import { readTable } from '../modules/expedition/tables.ts';
import { BookTapTable, BookType, type BookTapRow } from '../ui/creation.tsx';
import { RollRow, dieOf } from '../ui/dice.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const KNACKS = [
  ['1', 'Bird friend', 'Talks with birds'],
  ['2', 'Lock singer', 'Sings locks open'],
  ['3', 'Root friend', 'Questions roots'],
  ['4', 'Moth sight', 'Sees by one candle as by day'],
  ['5', 'Rain sense', 'Knows the weather a day ahead'],
  ['6', 'Still heart', 'Is not heard when standing still'],
] as const;

const WHISPERS = [
  ['1', 'Eel skin', 'Slip ropes, nets and narrow gaps'],
  ['2', 'Still water', 'Calm a pool or a reach of river'],
  ['3', "Heron's patience of the long wait at the drowned causeway", 'Stand unseen while you do not move'],
  ['4', 'Marsh light', 'Already yours: roll again'],
] as const;

const HARBOUR = readTable('harbour', 'Encounters in the harbour', {
  die: 'd20',
  rows: [
    { min: 1, max: 8, result: 'Nothing stirs.' },
    { min: 9, max: 10, result: 'Gulls mob the boat. Anyone standing must sit or be knocked down.' },
    { min: 11, max: 12, result: 'A seal follows the boat, curious, and will not be driven off.' },
    { min: 13, max: 14, result: 'A bell rings twice under the water, somewhere near the wreck.' },
    { min: 15, max: 16, result: 'Two bog lurkers rise from the weed and reach for the oars.' },
    { min: 17, max: 18, result: 'Old Harl poles his ferry out of the mist, and asks who is paying.' },
    { min: 19, max: 19, result: 'A drowned sailor drifts by, face down, a purse still at his belt.' },
    { min: 20, max: 20, result: 'The Tidewife surfaces beside the boat and looks at each of the party in turn.' },
  ],
})!;
const OPEN_WATER = readTable('open-water', 'Encounters on the open water', {
  die: 'd20',
  rows: Array.from({ length: 20 }, (_, i) => ({ min: i + 1, max: i + 1, result: i < 3 ? 'Nothing stirs.' : HARBOUR.rows[(i % 7) + 1]!.result! })),
})!;
const DEEP = readTable('deep', 'What the deep sends', {
  die: 'd100',
  rows: Array.from({ length: 34 }, (_, i) => ({ min: i * 3 + 1, max: Math.min(i * 3 + 3, 100), result: HARBOUR.rows[i % 8]!.result! })),
})!;
const POP_TABLES = new Map([HARBOUR, OPEN_WATER, DEEP].map((t) => [t.id, t]));

/** "Roll…"'s pop-up, opened for real by its button (sf-5): from "Change…", a tall table, a d100 table, loading. */
function RollPopUps() {
  const [open, setOpen] = useState<'change' | 'tall' | 'deep' | 'loading' | null>(null);
  const close = () => setOpen(null);
  const ways = [
    ['change', 'Change… (15–16 picked)'],
    ['tall', 'Roll… a tall table'],
    ['deep', 'Roll… a d100 table'],
    ['loading', 'Roll… while it loads'],
  ] as const;
  return (
    <>
      <div className="gallery__row">
        {ways.map(([id, label]) => (
          <button key={id} type="button" className="button-secondary" onClick={() => setOpen(id)}>
            {label}
          </button>
        ))}
      </div>
      {open && (
        <TableRollPopUp
          title="Encounters in the harbour"
          table={open === 'change' ? HARBOUR : open === 'tall' ? OPEN_WATER : open === 'deep' ? DEEP : null}
          tables={POP_TABLES}
          describe={() => null}
          picked={open === 'change' ? 4 : null}
          onRow={close}
          onClose={close}
        />
      )}
    </>
  );
}

export function TappedTableSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  const [knack, setKnack] = useState('2');
  const [whisper, setWhisper] = useState('2');
  const [tongues, setTongues] = useState<string[]>(['2–3']);
  const noop = () => undefined;
  const knackRows: BookTapRow[] = KNACKS.map(([range, name, line]) => ({ key: range, range, name, line, picked: knack === range, onPick: () => setKnack(knack === range ? '' : range) }));
  const whisperRows: BookTapRow[] = WHISPERS.map(([range, name, line]) => ({ key: range, range, name, line, picked: whisper === range, onPick: () => (range === '4' ? undefined : setWhisper(range)), onOpen: noop }));
  const tongue = (range: string) => ({ picked: tongues.includes(range), onPick: () => setTongues(tongues.includes(range) ? tongues.filter((t) => t !== range) : [...tongues, range]) });
  const tongueRows: BookTapRow[] = [
    { key: '1', range: '1', name: 'Heron-tongue', line: 'The courtly tongue of the heron lords', onOpen: noop, ...tongue('1') },
    { key: '2', range: '2–3', name: 'Causeway cant', line: 'The common speech of the folk', onOpen: noop, ...tongue('2–3') },
    { key: '4', range: '4', name: 'Old marsh', warn: 'Not open to Stone kin', picked: false, onPick: noop },
    { key: '5', range: '5', name: 'Croak', line: 'The croak-speech of the toad folk', warn: "Needs the GM's special approval", onOpen: noop, ...tongue('5') },
    { key: '6', range: '6', name: 'Purr', line: 'The purring speech of the cat-folk', onOpen: noop, ...tongue('6') },
  ];
  return (
    <>
      <BookType>
        <Specimen name="A kindred's roll (20-E1): the Roll row, the table's name on its bar, the die over its column, one row picked">
          <RollRow die={dieOf('d6')}>Roll d6, then tap the row.</RollRow>
          <BookTapTable title="Stone kin knacks" die="d6" column="Knack" label="Stone kin knacks" rows={knackRows} />
        </Specimen>
        <Specimen name="A class's rolled spells (20-E2): each row's ⓘ beside it, a long name, a row already yours">
          <RollRow die={dieOf('d4')}>Roll d4, then tap the row.</RollRow>
          <BookTapTable title="First whispers" die="d4" column="Spell" label="First whispers" rows={whisperRows} />
        </Specimen>
        <Specimen name="Languages taking two (20-E3): no table name in the pack, so no bar; a closed row in its place; one needing the GM's leave">
          <RollRow die={dieOf('d6')}>Roll d6, or tap any row.</RollRow>
          <BookTapTable die="d6" column="Language" label="Pick 2 more" rows={tongueRows} multiple />
        </Specimen>
        <Specimen name={'A row found by "Go to number" (sf-5, N2): a rule at its leading edge and its range in bold, no wash; the row picked has the wash and its tick'}>
          <BookTapTable
            die="d100"
            column="Encounter"
            label="What the deep sends"
            rows={DEEP.rows.slice(21, 25).map((row, i) => ({ key: String(i), range: `${row.min}–${row.max}`, name: row.result!, picked: i === 2, found: i === 0, onPick: noop }))}
          />
        </Specimen>
      </BookType>
      {/* Outside the book's type, as on the Scene, so the pop-up opens with the Scene's own scope. */}
      <Specimen name={'"Roll…"\'s pop-up (sf-5; page 44, EN2, EN7 D to F): tap a button to open it as it opens on the Scene'}>
        <RollPopUps />
      </Specimen>
    </>
  );
}

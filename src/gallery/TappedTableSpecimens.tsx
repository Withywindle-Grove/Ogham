// The book's tapped table (dec-10 E; pictures creation/final 20-E1, 20-E2, 20-E3) in the component gallery: a kindred's
// knacks with one picked, a class's rolled spells with one already the character's, and a list of languages taking two,
// with a closed row in its place and one needing the GM's leave. Invented words only. New pictures: CI draws them and
// they go to Design.
import { useState, type ReactElement, type ReactNode } from 'react';
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
    </BookType>
  );
}

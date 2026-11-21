// A long describing table in its sheet (m5b-long-tables; mockup creation/final/13, B with C's field; ruled
// 2026-11-09): the typed roll, the range bar, two columns on a tablet and one on a phone (the gallery draws both
// widths); the filtered state (37 lands on 37–40) and the no-match state (140). The button opens the real sheet, so
// the layout spec can scroll it. Since cts-2 and cts-8 (2026-11-19, mockup creation/final 24, TS5 to TS8) a short
// table is the same sheet: a short describing table with the player's own words, the words marked, a short trinket
// table and a roll at a level. Invented table text only.
import { useState, type ReactElement, type ReactNode } from 'react';
import { OneTableSheet } from '../app/KindredTables.tsx';
import { SheetScope } from '../ui/Dialog.tsx';
import { tableOf } from '../modules/characters/kindredTables.ts';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const WORDS = [
  'A thin gold chain with nothing on it',
  'A woven prayer rug no bigger than a hand',
  'A mouthful of sulphur sweets in a paper twist',
  'A steel tongue-scraper engraved with a motto',
  'A scrap of a banner bearing half a heron',
  'A hollow silver egg that is warm to hold',
  'A lead soldier with its face worn off',
  'A key to a door in a town that burned',
  'A jar of river mud from a holy ford',
  'A comb of black horn missing three teeth',
  'A moth pinned to a card, wings still bright',
  'A pebble that is always slightly damp',
];

/** Short words, so a row keeps to one line on a phone. */
const SHORT = ['A thin gold chain', 'A hollow silver egg', 'Sulphur sweets', 'Half a heron banner', 'A lead soldier', 'A burnt town’s key', 'A jar of river mud', 'A horn comb', 'A pinned moth', 'A damp pebble'];

/**
 * A d100 in 50 rows of two (1–2 … 99–100): long enough for the bar (50 rows or more; #571's final round: 1–50, 51–100),
 * ranged so the typed roll lands inside a row (37 on 37–38).
 */
const TWOS = tableOf({
  packEntryId: 'gallery-reed-trinkets',
  name: 'Reed trinkets',
  data: { die: 'd100', rows: Array.from({ length: 50 }, (_, i) => ({ min: i * 2 + 1, max: i * 2 + 2, result: SHORT[i % SHORT.length]! })) },
})!;

/** A d30 of 15 rows of two, as a kindred's trinket table: the box (it has a die), no bar, one column. */
const SHORT_TABLE = tableOf({
  packEntryId: 'gallery-stone-trinkets',
  name: 'Stone trinkets',
  data: { die: 'd30', rows: Array.from({ length: 15 }, (_, i) => ({ min: i * 2 + 1, max: i * 2 + 2, result: SHORT[i % SHORT.length]! })) },
})!;

/** A d200 of 200 rows, one each: the real sheet the button opens, long enough to scroll, its bar of 8 bands too wide for a phone. */
const LONGEST = tableOf({
  packEntryId: 'gallery-marsh-finds',
  name: 'Marsh finds',
  data: { die: 'd200', rows: Array.from({ length: 200 }, (_, i) => ({ min: i + 1, max: i + 1, result: WORDS[i % WORDS.length]! })) },
})!;

const none = () => {};

/** Six rows of a kindred's manner, one long (TS5): a short describing table in the one format, with the player's own words. */
const MANNER = tableOf({
  packEntryId: 'gallery-stone-manner',
  name: 'Stone kin manner',
  data: {
    die: 'd6',
    columns: ['Manner'],
    rows: ['Speaks only when sure', 'Laughs before the joke lands', 'Counts things under their breath', 'Hums while thinking', 'Polite to animals, short with people', 'Answers every question with another, and waits, however long it takes, for someone to fill the silence'].map((result, i) => ({ min: i + 1, max: i + 1, result })),
  },
})!;

/** A trinket table of ten rows (cts-8): short, and still marked, then Take it. */
const TEN_TRINKETS = tableOf({
  packEntryId: 'gallery-pond-ten',
  name: 'Pond trinkets',
  data: { die: 'd10', rows: SHORT.map((result, i) => ({ min: i + 1, max: i + 1, result })) },
})!;

/** A kindred's roll at a level (cts-8): four rows, no words of the player's own. */
const MOSS = tableOf({
  packEntryId: 'gallery-stone-moss',
  name: 'Stone kin moss',
  data: { die: 'd4', rows: ['Moss behind the ears', 'Lichen along the knuckles', 'A fern in the beard', 'Nothing grows yet'].map((result, i) => ({ min: i + 1, max: i + 1, result })) },
})!;

/** A d4 of four rows: a short sheet, for the layout check's turn of an iPad (only with `?sheet=1`). */
const TINY = tableOf({
  packEntryId: 'gallery-pond-trinkets',
  name: 'Pond trinkets',
  data: { die: 'd4', rows: Array.from({ length: 4 }, (_, i) => ({ min: i + 1, max: i + 1, result: SHORT[i]! })) },
})!;

/**
 * With `?sheet=1` the button opens it as creation does, a Sheet (beside its button on a tablet), so the layout check
 * can tap rows in it as on an iPad (fix-sheet-replacing-on-ipad). The gallery's pictures never use it.
 */
const asSheet = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sheet');

function OpenSheet() {
  const [open, setOpen] = useState<'long' | 'short' | 'manner' | false>(false);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  return (
    <>
      <button type="button" className="button-secondary" onClick={() => setOpen('long')}>
        Open the long table
      </button>
      {/* The 6-row describing table in its real sheet (cts-2): the layout check sets it beside the long one. */}
      <button type="button" className="button-secondary" onClick={() => setOpen('manner')}>
        Open the six-row table
      </button>
      {asSheet && (
        // Fixed low on the screen whichever way up, so the check can turn the screen with its sheet open.
        <button type="button" className="button-secondary" style={{ position: 'fixed', bottom: 120, left: 32, zIndex: 1 }} onClick={() => setOpen('short')}>
          Open the short table
        </button>
      )}
      <SheetScope.Provider value={asSheet}>
        {open === 'manner' && <OneTableSheet table={MANNER} title="Manner" picked={undefined} onPick={none} onClose={() => setOpen(false)} own />}
        {(open === 'long' || open === 'short') && <OneTableSheet table={open === 'long' ? LONGEST : TINY} picked={picked} onPick={(words) => setPicked(words ?? undefined)} onClose={() => setOpen(false)} />}
      </SheetScope.Provider>
    </>
  );
}

export function CreationLongTablesSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Long table (Table sheet, long variant): the strip of What you rolled with Show over the range bar, one line each; every row with no folds; two columns on a tablet, one on a phone; the picked row marked">
        <OneTableSheet table={TWOS} title="Trinket" picked={SHORT[1]} onPick={none} onClose={none} preview />
      </Specimen>
      <Specimen name="Long table, filtered: 37 shown, the one row it falls in (37–38), Show every row under it">
        <OneTableSheet table={TWOS} title="Trinket" picked={undefined} onPick={none} onClose={none} preview startRolled="37" />
      </Specimen>
      <Specimen name="A short table with a die (15 rows): the box, no bar, one column; 140 shown, the line under the strip, every row still there">
        <OneTableSheet table={SHORT_TABLE} title="Trinket" picked={undefined} onPick={none} onClose={none} preview startRolled="140" />
      </Specimen>
      <Specimen name="One format at any length (cts-2, frames TS5 and TS6): a short describing table of 6 rows opened again by Change, row 4 taken and marked, Or type your own empty, Take it and Clear">
        <OneTableSheet table={MANNER} title="Manner" picked="Hums while thinking" onPick={none} onClose={none} own preview />
      </Specimen>
      <Specimen name="The player's own words as the answer (cts-4, frame TS6): the box marked, the edge, bold and its tick; no row marked">
        <OneTableSheet table={MANNER} title="Manner" picked="Speaks low, and slower when lying" onPick={none} onClose={none} own preview />
      </Specimen>
      <Specimen name="A trinket table of 10 rows (cts-8): the same format, nothing marked yet, Take it plain">
        <OneTableSheet table={TEN_TRINKETS} title="Trinket" picked={undefined} onPick={none} onClose={none} preview />
      </Specimen>
      <Specimen name="A kindred's roll at a level of 4 rows (cts-8): the same format, row 2 taken and marked">
        <OneTableSheet table={MOSS} title="Moss" picked="Lichen along the knuckles" onPick={none} onClose={none} preview />
      </Specimen>
      <Specimen name="The long table in its real sheet (the strip stays at the top as it scrolls; on a phone the bar scrolls sideways)">
        <OpenSheet />
      </Specimen>
    </>
  );
}

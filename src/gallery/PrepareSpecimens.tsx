// Prepare in the component gallery (dec-8 piece C; mockup magic/06-prepare-and-rest, the Prepare frames, approved
// 2026-11-10): the screen drawn in the page (`PrepareSheet` with `preview`), from the frame's own invented spells, and
// the List row's **Stepper row** variant (`control`) on its own. The frames: a book caster (Same as yesterday, two
// levels, the frame's long name wrapping beside its stepper, the foot), and a prayer caster (chosen first, the rest
// folded under the + square); then messy data: a count of 9 with 0 beside it, a level with nothing to choose (it says
// "Nothing to choose at level 2."), and an empty book (its note alone: no level line, no slot counted at the foot).
// The fold's square, the level's line and the empty book are Francis's three fixes of 2026-11-18.
// Last, the first spells open (FS1; page 46, 46A and 46B, approved 2026-11-26): Prepare one of 2 chosen with the long
// spell and a slot empty, and the Magic tab's Prepare row and empty row in that state.
import type { ReactElement, ReactNode } from 'react';
import { CHOOSE_AT_ONCE, readyAtOnceLine } from '../app/MagicTab.tsx';
import { PrepareSheet } from '../app/PrepareScreen.tsx';
import { prepareView } from '../modules/characters/magicView.ts';
import { Icon } from '../ui/icons.tsx';
import { ListRow, RowList, Stepper } from '../ui/parts.tsx';

const LONG = 'The long lantern of the drowned abbey that burns beneath the black water';
const SPELLS = new Map([
  ['lamp', ['Mire lamp', '6 turns, 30 ft']],
  ['dart', ['Thorn dart', 'Instant, 60 ft']],
  ['whisper', ['Reed whisper', '1 turn, 1 mile']],
  ['long', [LONG, '1 night, 50 ft']],
  ['hands', ['Mending hands', 'Touch']],
  ['ward', ['Candle ward', '1 turn, 10 ft']],
  ['still', ['Still water', '']],
  ['reeds', ['Bless the reeds', '']],
  ['dead', ['Quiet the dead', '']],
]);
const ALDER = 'Brother Alder'; // words: names
const HOLLOWELL = 'Mistress Hollowell Ashgrove-Fenwick of the Seven Lantern Warden Lodges'; // words: names
const nameOf = (spell: string) => SPELLS.get(spell)?.[0] ?? spell;
const lineOf = (spell: string) => SPELLS.get(spell)?.[1] ?? '';
const levelTitle = (level: number) => `Level ${level}`;
const nothing = () => {};
const at = (spell: string, level: number) => ({ spell, level });

// Frame 1: Wren, a book caster; Mire lamp ×2 and Reed whisper ready, nothing chosen anew (so the steppers show today's).
const BOOK = prepareView(
  { prepared: [at('lamp', 1), at('lamp', 1), at('whisper', 2)], chosen: [at('lamp', 1), at('lamp', 1)] },
  [2, 1],
  new Map([
    [1, ['lamp', 'dart']],
    [2, ['long', 'whisper']],
  ]),
);
// Frame 3: Brother Alder, who prays: the whole list, chosen first, the rest folded.
const PRAYER = prepareView({ prepared: [], chosen: [at('hands', 1), at('hands', 1), at('ward', 1)] }, [3], new Map([[1, ['ward', 'hands', 'still', 'reeds', 'dead']]]), undefined, { wholeList: true });
// Messy: nine slots at level 1, all on one spell (9, and 0 beside it); an empty level 2.
const MESSY = prepareView({ prepared: [], chosen: Array.from({ length: 9 }, () => at('lamp', 1)) }, [9, 2], new Map([[1, ['lamp', 'long']], [2, []]]));
const EMPTY = prepareView({ prepared: [], chosen: null }, [1], new Map([[1, []]]));
// Page 46, 46B: the first spells open, one of 2 chosen (ready at once), the long spell beside it, a slot empty.
const OPEN = prepareView({ prepared: [at('lamp', 1)], chosen: null }, [2], new Map([[1, ['lamp', 'dart', 'long']]]));

const sheet = (who: string, view: ReturnType<typeof prepareView>, emptyBook = false, firstSpellsOpen = false) => (
  <PrepareSheet who={who} view={view} nameOf={nameOf} lineOf={lineOf} levelTitle={levelTitle} emptyBook={emptyBook} firstSpellsOpen={firstSpellsOpen} onMore={nothing} onFewer={nothing} onPick={nothing} onOpen={nothing} onClose={nothing} preview />
);

export function PrepareSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="List row, Stepper row variant (control): the words open the row's sheet, − N + at the right; a long name wraps beside it; 0 and 9">
        <RowList>
          <ListRow title="Mire lamp" sub="6 turns, 30 ft" onOpen={nothing} control={<Stepper label="Mire lamp" value={2} min={0} max={2} onChange={nothing} />} />
          <ListRow title={LONG} sub="1 night, 50 ft" onOpen={nothing} control={<Stepper label={LONG} value={0} min={0} max={1} onChange={nothing} />} />
          <ListRow title="Thorn dart" onOpen={nothing} control={<Stepper label="Thorn dart" value={9} min={0} max={9} onChange={nothing} />} />
        </RowList>
      </Specimen>
      <Specimen name="Prepare, a book caster (frame 06): the first line, Same as yesterday with Pick, a stepper a spell by level, the long name wrapping, the foot">
        {sheet('Wren', BOOK)}
      </Specimen>
      <Specimen name="Prepare, a caster who prays (frame 06): chosen first, the rest folded under 3 more at level 1">
        {sheet(ALDER, PRAYER)}
      </Specimen>
      <Specimen name="Prepare, messy data: 9 a day all on one spell, 0 beside it, a level with nothing to choose; an empty spell book">
        {sheet(HOLLOWELL, MESSY)}
        {sheet('Wren', EMPTY, true)}
      </Specimen>
      <Specimen name="Prepare, the first spells open (page 46, 46B): the first line, one of 2 chosen and ready at once, the long name wrapping, the foot with a slot still empty; no Same as yesterday">
        {sheet('Wren', OPEN, false, true)}
      </Specimen>
      <Specimen name="The Magic tab's rows, the first spells open (page 46, 46A): Prepare, Ready at once. 2 slots empty; Nothing ready with its line">
        <RowList>
          <ListRow lead={<Icon name="spell-book" size={20} />} title="Prepare" sub={readyAtOnceLine(2)} onOpen={nothing} />
        </RowList>
        <RowList>
          <ListRow title="Nothing ready" sub={CHOOSE_AT_ONCE} />
        </RowList>
      </Specimen>
    </>
  );
}

// The GM's rest prompt in the component gallery (dec-8 piece D; mockup magic/06-prepare-and-rest, the rest prompt,
// approved 2026-11-10): "A night's rest" as End expedition's Full rest opens it, drawn in the page. The mockup's three
// characters, with invented names: a caster, a second caster (a tap here switches it off, as the GM would), and a
// character with a once-a-rest power; then messy data: a long name and a caster who also has two powers.
import type { ReactElement, ReactNode } from 'react';
import { NightRestSheet } from '../app/NightRest.tsx';
import type { RestRow } from '../modules/characters/magicView.ts';

const caster = (id: string, usesBack: RestRow['usesBack'] = []): RestRow => ({ characterId: id, caster: true, becomeReady: [], castsCleared: {}, usesBack });
const MOCKUP: RestRow[] = [caster('wren'), caster('alder'), { characterId: 'pike', caster: false, becomeReady: [], castsCleared: {}, usesBack: [{ name: 'Bird friend', uses: 1, spent: 1 }] }];
const MESSY: RestRow[] = [
  caster('long', [
    { name: 'Lantern ward', uses: 2, spent: 2 },
    { name: 'Reed step of the drowned causeway', uses: 1, spent: 0 },
  ]),
  caster('wren'),
];
const NAMES = new Map([
  ['wren', 'Wren'],
  ['alder', 'Brother Alder'], // words: names
  ['pike', 'Pike'],
  ['long', 'Mistress Hollowell Ashgrove-Fenwick of the Seven Lantern Warden Lodges'], // words: names
]);
const nothing = () => {};

export function NightRestSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="A night's rest (the GM's rest prompt): a switch a character (ds-1c), all on at the start; a tap switches one off">
        <NightRestSheet rows={MOCKUP} names={NAMES} onApply={nothing} onClose={nothing} preview />
      </Specimen>
      <Specimen name="A night's rest, messy data: a long name, and a caster with two once-a-rest powers">
        <NightRestSheet rows={MESSY} names={NAMES} onApply={nothing} onClose={nothing} preview />
      </Specimen>
    </>
  );
}

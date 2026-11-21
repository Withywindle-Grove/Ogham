// Same-named entries show their source in the component gallery (sn-1; plan dec-1-creation 1d, ⚑ 1): two classes
// called the same from two packs on creation's Class step ("From <pack>" as the row's last line), a row with no namesake beside
// them, unchanged, and the sheet's one-line form, a long name wrapping before "(from <pack>)" at 375 px. Invented names only.
import type { ReactElement, ReactNode } from 'react';
import { BookType, CreationStep, PickRow } from '../ui/creation.tsx';
import { NameFrom } from '../ui/parts.tsx';
import '../app/CharacterSheet.css';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const LONG = 'Lantern warden of the drowned abbey';

export function SameNameSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Class step with namesakes (sn-1): each same-named class shows From its pack as its row's last line, under the description; Reed witch has no namesake and is unchanged">
        <BookType>
        <CreationStep title="Class" counter={{ at: 3, of: null }} why="Pick the trade your character follows." help={null} onBack={() => {}} hint="Pick one" onNext={() => {}}>
          <PickRow name="Lantern warden" from="Fen rules" blurb="Fights in the front; no spells" source="Fen rules, p. 12" picked={false} onPick={() => {}} onOpen={() => {}} />
          <PickRow name="Lantern warden" from="Mire zine" blurb="A warden of the deep mire, with other rules" source="Mire zine, p. 3" picked onPick={() => {}} onOpen={() => {}} />
          <PickRow name={LONG} from="Mire zine, second printing" blurb="Keeps the abbey's lamps lit" source="Mire zine, p. 9" picked={false} onPick={() => {}} onOpen={() => {}} />
          <PickRow name={LONG} from="Fen rules" blurb="Keeps the abbey's lamps lit, the old way" source="Fen rules, p. 40" picked={false} onPick={() => {}} onOpen={() => {}} />
          <PickRow name="Reed witch" blurb="Spells from the marsh; frail" source="Fen rules, p. 14" picked={false} onPick={() => {}} onOpen={() => {}} />
        </CreationStep>
        </BookType>
      </Specimen>
      <Specimen name="The sheet's identity line with namesakes (sn-1): the class's and the kindred's pack in brackets after each; a long name wraps before the bracket">
        <p className="sheet__identity">
          <span>
            {LONG} 2<NameFrom from="Mire zine, second printing" />
          </span>
          , <span>
            Marsh folk
            <NameFrom from="Fen rules" />
          </span>
        </p>
      </Specimen>
    </>
  );
}

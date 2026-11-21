// A trait list rolled more than once (pf-16) in the component gallery: the real step, three picks of three on a list
// without `distinct`, one entry taken twice and one once. Its Pick reads Picked ✓✓ (the takes mark, the lead's rulings of
// 2026-11-13: one tick a take, the shape of Weapon skills' Specialised ✓✓, heard as "picked twice", no count in words
// on the row), beside Picked ✓ and a row not picked; the entry has a long name, so its button wraps under it, at the
// right; the foot line names each entry once with its ticks ("… ✓✓, Frog in frost picked").
// Invented names only. A new picture: CI draws it and it goes to Design.
import type { ReactElement, ReactNode } from 'react';
import { TraitListStep } from '../app/TraitListStep.tsx';
import { traitListsOf } from '../modules/characters/traitLists.ts';
import { CreationLeave } from '../ui/creation.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => {};
const OMENS = traitListsOf([
  {
    kind: 'traitList',
    packEntryId: 'ex-birth-omens',
    name: 'Birth omens',
    data: {
      die: 'd6',
      rolls: 3,
      entries: [
        { id: 'heron', name: 'Heron at dawn over the drowned causeway', min: 1, max: 2, blurb: 'Patient, and seldom surprised' },
        { id: 'frog', name: 'Frog in frost', min: 3, max: 4, blurb: 'Wakes slowly, lasts long' },
        { id: 'eel', name: 'Eel in the lantern light', min: 5, max: 6, blurb: 'Slips away from trouble' },
      ],
    },
  },
])[0]!;

export function TraitListSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <Specimen name="A list rolled three times, one entry taken twice and one once (pf-16; the takes mark, 2026-11-13): Picked ✓✓ and Picked ✓, one tick a take, no count on the name; a long name wraps the button under it; the foot line names each entry once">
      <CreationLeave onLeave={none}>
        <TraitListStep
          list={OMENS}
          chosen={[{ entryId: 'heron' }, { entryId: 'heron' }, { entryId: 'frog' }]}
          why="Roll three times on the omens of your birth; the same omen may come twice."
          roll="Roll d6 three times, then tap what each shows"
          help={null}
          counter={{ at: 6, of: 9 }}
          onSave={() => Promise.resolve(true)}
          onLater={none}
          onBack={none}
        />
      </CreationLeave>
    </Specimen>
  );
}

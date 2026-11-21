// The GM's tabs with something to act on (plan m5b-sheet-revised PR 2, steps 9–11; mockup gm/01-rail-attention, A2)
// for the gallery: Players lit while another tab is open, lit while open itself, unlit with nothing waiting, the still
// glow that reduced motion gives, and the phone's bar lit with its badge. The breathe is drawn at rest in the pictures.
import type { ReactNode } from 'react';
import { gmPhoneTabs, gmTabs, NOTHING_WAITING, type GmWaiting } from '../app/navTabs.ts';
import { SectionNav } from '../ui/SectionNav.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactNode;

const none = () => undefined;
const ONE: GmWaiting = { toApprove: 1, toAnswer: 0, toPick: 0 };
const MANY: GmWaiting = { toApprove: 2, toAnswer: 1, toPick: 1 };

export function GmAttentionSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Lit: Scene open, one character waiting on Players (its icon in the glow, breathing)">
        <div className="gallery__tabbar">
          <SectionNav label="GM sections, Players lit" tabs={gmTabs(ONE)} current="scene" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Lit and open: Players selected keeps its glow while its list isn't empty">
        <div className="gallery__tabbar">
          <SectionNav label="GM sections, Players lit and open" tabs={gmTabs(MANY)} current="players" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Unlit: nothing waits, so no glow and no count">
        <div className="gallery__tabbar">
          <SectionNav label="GM sections, nothing waiting" tabs={gmTabs(NOTHING_WAITING)} current="players" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="Reduced motion: the same glow, held still">
        <div className="gallery__tabbar motion-still">
          <SectionNav label="GM sections, still glow" tabs={gmTabs(ONE)} current="scene" onSelect={none} />
        </div>
      </Specimen>
      <Specimen name="The GM's phone bar: Players lit with its badge">
        <div className="gallery__tabbar">
          <SectionNav label="GM tab bar, Players lit" tabs={gmPhoneTabs(MANY)} current="scene" onSelect={none} />
        </div>
      </Specimen>
    </>
  );
}

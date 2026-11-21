// The stacked button (stk-1, st-6, stk-2; the shape of the shop's Buy) in the component gallery: the secondary and the
// primary variant, each with a short word at the least width (88 px) and a long one on one line, widening the button.
// The icons are the Studio's, from the app's icon table. Invented words only. New pictures: CI draws them and they go
// to Design.
import type { ReactElement, ReactNode } from 'react';
import { StackedButton } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => undefined;

export function StackedButtonSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Secondary: a short word, a long word on one line, and the shop's Buy">
        <div className="gallery__row">
          <StackedButton icon="check-mark" label="Done" onClick={none} />
          <StackedButton icon="run" label="Ask for escape rolls" onClick={none} />
          <StackedButton icon="two-coins" label="Buy" onClick={none} />
        </div>
      </Specimen>
      <Specimen name="Primary (the screen's one accent button): a short word, a long word on one line">
        <div className="gallery__row">
          <StackedButton icon="play-button" label="Start" variant="primary" onClick={none} />
          <StackedButton icon="exit-door" label="Leave the dungeon" variant="primary" onClick={none} />
        </div>
      </Specimen>
    </>
  );
}

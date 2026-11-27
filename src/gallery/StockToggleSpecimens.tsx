// The three-position stock toggle (tn-4; page 19 frame TW8f, ap-13; town row TC9, carried from W9a) in the component gallery: the three
// states side by side, each with its thing's name as the stock table's row gives it, and one to tap. Invented things.
// New pictures for Design (no baseline yet).
import { useState, type ReactElement, type ReactNode } from 'react';
import { StockToggle, type StockToggleState } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => undefined;

function Row({ thing, children }: { thing: string; children: ReactNode }) {
  return (
    <div className="stock-toggle-specimen">
      <span>{thing}</span>
      {children}
    </div>
  );
}

export function StockToggleSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  const [state, setState] = useState<StockToggleState>('undecided');
  return (
    <>
      <Specimen name='The stock toggle (TW8f): "?" until flipped, not in stock (the cross), in stock (the tick, the wash)'>
        <Row thing="Lamp oil">
          <StockToggle thing="Lamp oil" state="undecided" onChange={none} />
        </Row>
        <Row thing="Bog-iron coat">
          <StockToggle thing="Bog-iron coat" state="out" onChange={none} />
        </Row>
        <Row thing="Reed spear">
          <StockToggle thing="Reed spear" state="in" onChange={none} />
        </Row>
      </Specimen>
      <Specimen name="To tap: the right half sets in, the left half sets out">
        <Row thing="Waxed coat">
          <StockToggle thing="Waxed coat" state={state} onChange={setState} />
        </Row>
      </Specimen>
    </>
  );
}

// The stock row (cs-21, picture creation/final 21-F5) in the component gallery: a thing for sale, one the class can't
// use (the sign and the pack's reason), and the messy row (a very long name, 999 silver, no weight). Invented words
// only. New pictures: CI draws them and they go to Design.
import type { ReactElement, ReactNode } from 'react';
import { StockRow } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => undefined;

export function StockRowSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <Specimen name="Stock rows (cs-21): the name as the tap to its entry, what it is and its weight with the price, the two-coins Buy; one the class can't use; a long name, 999 silver, no weight">
      <ul className="pack__rows">
        <StockRow name="Waxed coat" line="Keeps the wet out and some blows. 150 coins' weight" price="10 silver" onOpen={none} onBuy={none} />
        <StockRow name="Bog-iron coat" line="Heavy, rusty and very hard to cut. 400 coins' weight" price="40 silver" warn="A Reed Witch can't use it. Heavy iron drowns the whisper." onOpen={none} onBuy={none} />
        <StockRow name="A very long name for a thing the market sometimes has, when the barges are in" line="Nobody knows" price="999 silver" onOpen={none} onBuy={none} />
      </ul>
    </Specimen>
  );
}

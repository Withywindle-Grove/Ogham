// The standard parts of the December mockups (plan dec-7 piece 1; rulings ds-1, ds-1a, ds-1b, ds-2, ds-3, 2026-11-12)
// in the component gallery: the toggle in a row with its name, off and on (frame B: the Selected wash, its edge and a
// soft glow; a cross or a tick on the knob, no state words); the bare eye, shown and hidden; and a line of words with the
// die glyph before each named die or chance, and a line naming no die (no glyph). Invented words only. New pictures:
// CI draws them and they go to Design.
import { useState, type ReactElement, type ReactNode } from 'react';
import { DiceWords } from '../ui/dice.tsx';
import { EyeToggle, Switch } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

export function StandardPartsSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  const [spear, setSpear] = useState(false);
  const [knife, setKnife] = useState(true);
  const [long, setLong] = useState(true);
  const [map, setMap] = useState(true);
  const [note, setNote] = useState(false);
  return (
    <>
      <Specimen name="Toggle: the name at the left, the track at the right, off then on (no On or Off words)">
        <Switch label="Reed spear" on={spear} onChange={setSpear} />
        <Switch label="Knife" on={knife} onChange={setKnife} />
        <Switch label="The ferryman's lantern on the long pole, lit at the drowned bell's landing" on={long} onChange={setLong} />
      </Specimen>
      <Specimen name="Eye: shown to the players (open), hidden from them (closed, with lashes)">
        <div className="gallery__row">
          <EyeToggle label="Map shown to the players" shown={map} onChange={setMap} />
          <EyeToggle label="Note shown to the players" shown={note} onChange={setNote} />
        </div>
      </Specimen>
      <Specimen name="Dice in words: the glyph before each named die, the words as written">
        <p className="reading">
          <DiceWords>Roll a d6: the door opens on a 1 or a 2.</DiceWords>
        </p>
        <p className="reading">
          <DiceWords>The harbour's check: 2 in 6, every second turn.</DiceWords>
        </p>
        <p className="reading">
          <DiceWords>Lost oars: 3d6 days, or d100 on the drift table; a d4, d8, d10, d12 and d20 besides.</DiceWords>
        </p>
        <p className="reading">
          <DiceWords>The tide turns at dusk; no roll is needed.</DiceWords>
        </p>
        <button type="button" className="button-primary">
          <DiceWords>Swim, d20</DiceWords>
        </button>
      </Specimen>
    </>
  );
}

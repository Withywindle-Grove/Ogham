// The full sheet on creation's standard, slice D (plan m5b-players-screens-standard; mockup
// players/01-player-pack-sheet-standard) for the gallery: the Score tiles (six in two rows of three, a long short name,
// 0 and 999, a score not filled in), the fold rows (folded with a summary, a long summary cut with "…", open with −),
// Movement as a row with a chevron (beside the Player screen), the Level row with its bar, a score's breakdown sheet
// under its full name, and the foot (up to date; offline). Invented names only. No pictures yet: CI draws them and
// they go to Design.
import type { ReactNode } from 'react';
import { BreakdownSheet } from '../ui/BreakdownSheet.tsx';
import { ListRow, RowList, ScoreRow, WarningLine } from '../ui/parts.tsx';
import { SheetSection } from '../app/SheetSection.tsx';
import '../app/CharacterSheet.css';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactNode;

const none = () => undefined;
const SCORES = [
  { key: 'MUS', name: 'Muscle', value: '13', modifier: '+1' },
  { key: 'NIM', name: 'Nimbleness', value: '9', modifier: '+0' },
  { key: 'GRT', name: 'Grit', value: '12', modifier: '+0' },
  { key: 'WIT', name: 'Wit', value: '13', modifier: '+1' },
  { key: 'LORE', name: 'Lore', value: '8', modifier: '−1' },
  { key: 'CHARM', name: 'Charm', value: '11', modifier: '+0' },
];

/** The sheet's foot as the full sheet draws it (CharacterSheet), with its status line. */
function Foot({ status }: { status: ReactNode }) {
  return (
    <div className="sheet__foot">
      <p className="sheet__foot-status" role="status">
        {status}
      </p>
      <div className="sheet__foot-actions">
        <button type="button" className="button-secondary">
          Back
        </button>
        <button type="button" className="button-secondary">
          Edit
        </button>
      </div>
    </div>
  );
}

export function FullSheetSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Score tiles: six in two rows of three, the full name, the score, the modifier under">
        <div className="gallery__col">
          <ScoreRow scores={SCORES} onOpen={none} />
        </div>
      </Specimen>
      <Specimen name="Score tiles, messy: a long name wraps between words (never …, never inside a word), two columns when a word won't fit three across, one height per row; 0 and 999, a score with no modifier, a score not filled in">
        <div className="gallery__col">
          <ScoreRow
            scores={[
              { key: 'a', name: 'Stubbornheartedness of the drowned bells', value: '999', modifier: '+12', modifierSaid: '+12 melee' },
              { key: 'b', name: 'Nimbleness', value: '0', modifier: '−4' },
              { key: 'c', name: 'Grit', value: '—' },
            ]}
            onOpen={none}
          />
        </div>
      </Specimen>
      <Specimen name="Fold rows: folded with a summary, a long summary cut with …, open with −">
        <div className="gallery__col gallery__col--full">
          <SheetSection label="Movement" foldWide summary="Speed 40, 120 a turn, running 120">
            <p className="sheet__text">Speed 40</p>
          </SheetSection>
          <SheetSection label="Traits" foldWide summary="7: Moon sight, Iron-shy, Lantern ward, Steady flame, Small, Second wind, Oath of light">
            <p className="sheet__text">Moon sight</p>
          </SheetSection>
          <SheetSection label="Languages" foldWide summary="Fen common, Heron-tongue">
            <p className="sheet__text">Fen common, Heron-tongue</p>
          </SheetSection>
        </div>
      </Specimen>
      <Specimen name="Beside the Player screen: the Level row with its bar; Movement as a row with a chevron">
        <div className="gallery__col">
          <section className="sheet__section sheet__block" aria-label="Level">
            <RowList>
              <ListRow title="Level 2" sub="2,800 of 5,000 experience" onOpen={none} />
            </RowList>
            <span className="advancement__bar" aria-hidden="true">
              <span className="advancement__fill" style={{ inlineSize: '56%' }} />
            </span>
          </section>
          <RowList>
            <ListRow title="Movement" sub="Speed 40, 120 a turn" onOpen={none} />
            <ListRow title="Languages" sub="Fen common, Heron-tongue" onOpen={none} />
          </RowList>
        </div>
      </Specimen>
      <Specimen name="A score's breakdown sheet: the full name and the score in the head (the Figure head), Modifiers (each effect once, one that gives nothing still listed), the setting's words on the score, the source">
        <BreakdownSheet preview title="Muscle" figure="13" figureHead modifiers={['Melee: +1.', 'AC: −1.', 'Open doors: 2-in-6.', 'Carrying: no change.']} rule={['Lifting, hitting and holding a line.']} source="Fen sample" onClose={none} />
      </Specimen>
      <Specimen name="The foot: up to date, with Back and Edit (plain); offline">
        <div className="gallery__col">
          <Foot status="Up to date" />
          <Foot status={<WarningLine>Offline. Saved on this device</WarningLine>} />
        </div>
      </Specimen>
    </>
  );
}

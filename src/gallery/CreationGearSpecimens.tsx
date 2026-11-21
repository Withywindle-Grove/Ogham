// The creation rework's Gear step parts in the component gallery (cw-11, mockups creation/12 §3 and 13 §3; plan
// m5b-creation-rework slice C): Starting coin (its Roll row and the average stepper), a kit with rolls (its line, then picked with what it gave,
// Change the rolls and Take it off, and a thing the class can't use), the Roll sequence (a roll made twice with a row
// Already rolled; a choice ending in Done) and Yours already folded. Invented names only.
import { useState, type ReactElement, type ReactNode } from 'react';
import { AverageStepper, DetailRow, EntryPanel, FoldedGroup, PickGroup, PickRow, PickTableFold, RolledPicks, RollSequence, useAverageField, type BookTapRow } from '../ui/creation.tsx';
import { RollRow } from '../ui/dice.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

function Coin() {
  // As the Gear step draws it (StartingGear): the pack's dice in a Roll row, then the average stepper, untouched.
  const coin = useAverageField({ average: 100, step: 10 });
  return (
    // Under its own sub-heading, the Roll row only the act (cs-22, 21-F1); the sum under the stepper (21-F2).
    <PickGroup title="Starting coin">
      <div className="gear-coin-block">
        <RollRow die={6}>Roll 3d6 × 10, then enter it.</RollRow>
        <div className="gear-coin">
          <AverageStepper id="gallery-coin" label="Starting coin" text={coin.text} touched={coin.touched} untouchedLine="Average, 14 silver spent: 86 silver left" caption={`${coin.text} rolled, 14 silver spent: ${Number(coin.text) - 14} silver left`} onChange={coin.onChange} onStep={coin.onStep} wide />
          <span className="gear-coin__unit">silver</span>
        </div>
      </div>
    </PickGroup>
  );
}

const none = () => {};


/** A kit roll's name as a pack gives it (invented). */
const TOOLS_ROLL = 'Tools';
export function CreationGearSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Gear (cw-11; Design on #555): Starting coin's Roll row and average stepper, To choose with a kit's line and its rolls, Yours already folded">
        <Coin />
        <PickGroup title="To choose">
          <PickRow name="Dredger's kit" blurb="Given, not bought: roll for a coat and two tools. 3 rolls, 1 to choose" fit={[{ text: 'Free' }]} source="Fen sample, p. 33" picked={false} onPick={none} onOpen={none} />
          <button type="button" className="button-secondary gear-shop">
            Browse the shop
          </button>
        </PickGroup>
        <PickGroup title="Yours already">
          <FoldedGroup label="Given to every character" note="6 items: Reed rope, Storm lantern, Dry rations ×2…">
            <PickRow name="Reed rope" picked onPick={none} />
          </FoldedGroup>
        </PickGroup>
      </Specimen>
      <Specimen name="A kit taken from its rolls: what it gave, a thing the class can't use (the sign, carried), Change the rolls and Take it off">
        <div className="gear-kit">
          <PickRow
            name="Dredger's kit"
            blurb="Reed rope, Waxed coat, Bog sling, Reed spear, Eel hooks"
            fit={[{ text: 'Free' }, { text: "Waxed coat: a Reed Witch can't wear it; carried", warn: true }]}
            source="Fen sample, p. 33"
            picked
            onPick={none}
            onOpen={none}
          />
          <div className="gear-kit__actions">
            <button type="button" className="button-secondary button-secondary--small">
              Change the rolls
            </button>
            <button type="button" className="button-secondary button-secondary--small">
              Take it off
            </button>
          </div>
        </div>
      </Specimen>
      <Specimen name="Detail row, one row (2026-11-06): the trinket before the pick (Roll), then only what was picked (Change)">
        <DetailRow picked label="Trinket" note="Stone kin" value="" roll="Roll d30" onOpen={none} />
        <DetailRow picked label="Trinket" note="Stone kin" value="A pebble that is always warm, and hums when the fen floods, rolled 11" roll="Roll d30" onOpen={none} />
      </Specimen>
      <Specimen name="Detail row with its die (retest 4 S1): a kindred's or class's table before it's rolled, the die's glyph beside Roll d8">
        <DetailRow label="Bog folk looks" value="" roll="Roll d8" onOpen={none} />
      </Specimen>
      <Specimen name="Roll sequence (Dialog variant, cw-11; retest 2; dec-10 F-a, 21-F3): a roll made twice is one step with two taps, the book's table (the roll's name on its bar, the die over Result, ranges in words), a taken row of a distinct roll marked Already rolled in plain words (no sign: it's information)">
        <RollSequence
          label="Dredger's kit"
          line="Roll 2 of 3"
          roll={{ die: 'd4', words: 'Roll d4 twice, then tap each result.' }}
          // The roll's name is the pack's own (capitalised there), so it goes in as a value.
          table={{ title: TOOLS_ROLL, column: 'Result' }}
          rows={[
            { key: '0', text: 'Eel knife', range: '1–2', picked: false, onPick: none },
            { key: '1', text: 'Bog sling', range: '3', picked: true, taken: 'Already rolled', onPick: none },
            { key: '2', text: 'Reed spear', range: '4', picked: true, taken: 'Already rolled', onPick: none },
          ]}
          status="Bog sling, Reed spear"
          last={false}
          onBack={none}
          onNext={none}
          onClose={none}
          preview
        />
      </Specimen>
      <Specimen name="Roll sequence, a row rolled twice (R3-8, retest 4 T3; phone test 2026-11-09): ✓✓ at the right, no count in words, and the − square beside it; on a tablet the sheet takes the screen's width (T4)">
        <RollSequence
          label="Dredger's kit"
          line="Roll 2 of 3"
          roll={{ die: 'd4', words: 'Roll d4 twice, then tap each result.' }}
          table={{ title: TOOLS_ROLL, column: 'Result' }}
          rows={[
            { key: '0', text: 'Eel knife', range: '1–2', picked: true, times: 2, onPutBack: none, onPick: none },
            { key: '1', text: 'Bog sling', range: '3', picked: false, onPick: none },
            { key: '2', text: 'Reed spear, a long one with a barbed head for the deep channels', range: '4', picked: false, onPick: none },
          ]}
          status="Eel knife, Eel knife"
          last={false}
          onBack={none}
          onNext={none}
          onClose={none}
          preview
        />
      </Specimen>
      <Specimen name="Roll sequence, the last step a choice: pick rows, Done">
        <RollSequence
          label="Dredger's kit"
          line="3 of 3: choose one"
          rows={[
            { key: '0', text: 'Reed whistle', picked: false, onPick: none },
            { key: '1', text: 'Eel hooks', picked: true, onPick: none },
          ]}
          status="Eel hooks"
          choice
          last
          onBack={none}
          onNext={none}
          onClose={none}
          preview
        />
      </Specimen>
      <Specimen name="A taken kit's entry (retest 2): Rolled at the table, each roll with its Roll row, its result and its own Change; a choice without a die; a long result wraps">
        <EntryPanel
          name="Dredger's kit"
          meta="p. 33"
          headings={[
            { label: 'About', text: 'Given, not bought: roll for a coat and two tools.' },
            { label: 'Cost', text: 'Free' },
          ]}
          extra={
            <RolledPicks
              label="Rolled at the table"
              picks={[
                { key: '0', name: 'Armour', die: 'd6', title: 'Armour: d6', result: 'Waxed coat', onChange: none },
                { key: '1', name: TOOLS_ROLL, die: 'd4', title: `${TOOLS_ROLL}: d4, twice`, result: 'Bog sling, a reed spear with a heron-bone point and a long eel line', onChange: none },
                { key: '2', name: 'Reed whistle or Eel hooks', title: 'You choose: Reed whistle or Eel hooks', result: 'Eel hooks', onChange: none },
              ]}
            />
          }
          picked
          onPick={none}
          onClose={none}
          asSheet={false}
        />
      </Specimen>
      <Specimen name="The pack's pick-up-to-N table on Gear (dec-10 F-a; cs-15, the lead's ruling (a)): one folded row with what is taken; inside, the rows as the book's table, two marked (one twice, with −), and Take these at the fold's end">
        <PickFold />
      </Specimen>
    </>
  );
}

/** As the Gear step draws a pick table (StartingGear): the fold open, rows marked and nothing taken yet. */
function PickFold() {
  const [marks, setMarks] = useState<number[]>([0, 2, 2]);
  const ROWS = ['Reed rope', 'Storm lantern', 'Eel hooks', 'Dry rations ×2'];
  const rows: BookTapRow[] = ROWS.map((name, r) => {
    const times = marks.filter((m) => m === r).length;
    return {
      key: String(r),
      range: String(r + 1),
      name,
      line: ['1 silver, 50 coins', '2 silver, 30 coins', '1 copper, 0 coins', '1 silver, 20 coins'][r]!,
      picked: times > 0,
      times,
      onPick: () => (marks.length >= 3 ? undefined : setMarks([...marks, r])),
      onPutBack: () => setMarks(marks.filter((_, n) => n !== marks.lastIndexOf(r))),
    };
  });
  return (
    <PickTableFold label="Odds and ends: pick up to 3" note="0 of 3 picked. 4 to choose from" open die="d4" title="Odds and ends" rows={rows} multiple takeAccent onTake={() => undefined} />
  );
}

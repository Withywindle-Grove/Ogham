// The creation rework's Gear step parts in the component gallery (cw-11, mockups creation/12 §3 and 13 §3; plan
// m5b-creation-rework slice C): Starting coin (its Roll row and the average stepper), a kit with rolls (its line, then picked with what it gave,
// Change the rolls and Take it off, and a thing the class can't use), the Roll sequence (a roll made twice with a row
// Already rolled; a choice ending in Done) and Yours already folded. Invented names only.
import { useState, type ReactElement, type ReactNode } from 'react';
import { AverageStepper, DetailRow, EntryPanel, FoldedGroup, PickGroup, PickRow, PickTableSheet, RolledPicks, RollSequence, useAverageField, type BookTapRow, type LongTable } from '../ui/creation.tsx';
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
      <Specimen name="The pack's pick-up-to-N table on Gear, closed (cts-3, frame TS1): one row like the trinket's, Open before anything is taken, Change after with what was taken by name, a long list kept to two lines">
        <PickRows />
      </Specimen>
      <Specimen name="The pick table's sheet (Table sheet, Pick table variant; cts-1, frames TS2 and TS3): the roll line, What you rolled, the book's table with rows marked (one twice, with −), and the foot with what is marked and Take these">
        <PickSheet preview />
      </Specimen>
      <Specimen name="The pick table's sheet, nothing marked (frame TS3): Take these plain, still a tap">
        <PickSheet preview start={[]} />
      </Specimen>
      <PickSheetOpener />
    </>
  );
}

/** The pick table's rows as Gear shows them once the sheet is closed (StartingGear; frame TS1): three states. */
function PickRows() {
  return (
    <PickGroup title="To choose (pick 1)">
      <DetailRow label="Travelling odds: pick up to 4" note="0 of 4 picked. 20 to choose from" action="Open" twoLines onOpen={none} />
      <DetailRow label="Travelling odds: pick up to 4" note="2 of 4 picked: Reed rope, Storm matches" action="Change" twoLines onOpen={none} />
      <DetailRow label="Travelling odds: pick up to 4" note={`4 of 4 picked: ${ODDS[16]}, Eel hooks ×2, Tallow candles ×3, Bone needles ×6`} action="Change" twoLines onOpen={none} />
    </PickGroup>
  );
}

/** The invented 20-row table of the mockup's frames (TS2): a row with its price and weight, one very long. */
const ODDS = ['Reed rope', 'Storm matches', 'Eel hooks', 'Waxed twine', 'Bog chalk', 'Heron whistle', 'Marsh salt, a pouch', 'Fish-glue pot', 'Net floats ×4', 'Peat bricks ×2', 'Rush mat', 'Tallow candles ×3', 'Tin cup', 'Oilskin sack', 'Bone needles ×6', 'Sedge hat', "A ferryman's best tarred rope, the long coil that reaches both banks of the Weir", 'Frog bell', 'Dry rations ×2', 'Punt pole'];
const ODDS_LINES = ['1 silver, 100 coins’ weight', '2 copper, 0 coins’ weight', '1 copper, 1 coin’s weight', '3 copper, 5 coins’ weight', '1 copper, 2 coins’ weight', '5 copper, 1 coin’s weight', '2 copper, 10 coins’ weight', '4 copper, 10 coins’ weight', '2 copper, 8 coins’ weight', '1 copper, 40 coins’ weight', '3 copper, 50 coins’ weight', '3 copper, 6 coins’ weight', '2 copper, 5 coins’ weight', '1 silver, 20 coins’ weight', '2 copper, 0 coins’ weight', '4 copper, 10 coins’ weight', '999 silver, 300 coins’ weight', '6 copper, 3 coins’ weight', '2 silver, 40 coins’ weight', '2 silver, 80 coins’ weight'];

/**
 * As the Gear step draws a pick table's sheet (StartingGear): rows marked, nothing taken yet. `preview` draws it in
 * place (the gallery's picture, the first six rows); otherwise the real sheet with all twenty, for the layout check.
 */
function PickSheet({ preview = false, start = [0, 2, 2, 11], onClose = none }: { preview?: boolean; start?: number[]; onClose?: () => void }) {
  const [marks, setMarks] = useState<number[]>(start);
  const [said, setSaid] = useState('');
  const shown = preview ? ODDS.slice(0, 6) : ODDS;
  const rows: BookTapRow[] = shown.map((name, r) => {
    const times = marks.filter((m) => m === r).length;
    return {
      key: String(r),
      range: String(r + 1),
      name,
      line: ODDS_LINES[r]!,
      picked: times > 0,
      times,
      onPick: () => (marks.length >= 4 ? setSaid('4 of 4 marked: take one off to mark another.') : setMarks([...marks, r])),
      onPutBack: () => setMarks(marks.filter((_, n) => n !== marks.lastIndexOf(r))),
    };
  });
  const names = [...new Set(marks)].map((r) => {
    const times = marks.filter((m) => m === r).length;
    return times > 1 ? `${ODDS[r]} ×${times}` : ODDS[r];
  });
  const long: LongTable = {
    ranges: [{ heading: 'rows', rows: rows.map((row) => ({ key: row.key, text: row.name, picked: row.picked, onPick: row.onPick })) }],
    bar: false,
    columns: false,
    typed: () => ({ key: null, line: '' }),
  };
  return (
    <>
      <PickTableSheet
        label="Travelling odds: pick up to 4"
        die="d20"
        title="Travelling odds"
        rows={rows}
        long={long}
        multiple
        foot={names.length > 0 ? `${marks.length} of 4 marked: ${names.join(', ')}` : '0 of 4 marked'}
        marked={marks.length > 0}
        onTake={() => (marks.length === 0 ? setSaid('Mark a row first.') : onClose())}
        onClose={onClose}
        preview={preview}
      />
      {said && !preview && <p role="status">{said}</p>}
    </>
  );
}

/** The pick table's real sheet, opened from the gallery's button (the layout check: the foot in view, the tablet's width). */
function PickSheetOpener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="button-secondary" onClick={() => setOpen(true)}>
        Open the pick table
      </button>
      {open && <PickSheet onClose={() => setOpen(false)} />}
    </>
  );
}

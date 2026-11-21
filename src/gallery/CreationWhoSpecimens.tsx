// The creation rework's Who they are and Details (cw-11, cw-12; mockup creation/12; plan m5b-creation-rework slice B)
// in the component gallery: Roll for a name (R3-1) under the Name field (the kindred's table, another pack's), hit points as a typed
// stepper beside its rule, the liege as pick rows (one picked, a long house name), "Derived values" folded,
// and the Details step with age, height and weight as steppers from the usual and every describing table shown, none
// folded (Francis, 2026-11-18: twelve tables, two with long names; and a kindred with one) (the typed
// box for a kindred with no usual is unchanged: the app's sign-in styles it, which the gallery doesn't load). Invented names and numbers only.
import { useState, type ReactElement, type ReactNode } from 'react';
import { DetailsStep, NameRoll, NameTableSheet } from '../app/KindredTables.tsx';
import { physicalOf, tableOf, type CreationTable } from '../modules/characters/kindredTables.ts';
import { hpAskLine, hpAverageLine, hpWorkedLine, type HpRoll } from '../modules/characters/whoTheyAre.ts';
import { AVERAGE_LINE, ApprovalFold, AverageStepper, CreationLeave, DerivedFields, EntryPanel, PickGroup, PickRow } from '../ui/creation.tsx';
import { dieOf, RollRow } from '../ui/dice.tsx';
import { HelpMeChoose } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const table = (id: string, name: string, die: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}): CreationTable =>
  tableOf({ packEntryId: id, name, data: { die, rows, ...extra } })!;

const NAMES = table('stone-names', 'Stone kin names', 'd20', [{ min: 1, max: 20, cells: ['Oswin', 'Adder-'] }], { columns: ['First names', 'Family names'] });
const OFFERED = { ...table('surnames', 'Surnames from the old marsh registers of the drowned abbey', 'd100', [{ min: 1, max: 100, result: 'Reedwhistle' }]), from: 'Table Generator' }; // words: names
const DETAILS = ['Face', 'Manner', 'Voice', 'Hands', 'Smell', 'Habit', 'Fear', 'Hope', 'Scar', 'Walk', 'The way they carry themselves when nobody on the causeway is watching', 'Keepsake from the drowned abbey of the nine bells'].map((n, i) =>
  ({ ...table(`d-${i}`, n, 'd12', [{ min: 1, max: 12, result: `${n} worth noting` }]), ...(i > 0 ? { from: 'Table Generator' } : {}) }), // words: names
);
/** A kindred's roll at a level (the growth): its own Roll row, "Roll d4, then mark your row." (cts-5 c, cts-8). */
const MOSS = table('stone-moss', 'Stone kin moss', 'd4', [{ min: 1, max: 4, result: 'Lichen along the knuckles' }]);
const STONE = { data: { age: '3d6 × 10 years', height: '4 ft + 1d6 in', usual: { age: { base: 0, dice: '3d6', times: 10, unit: 'years' }, height: { base: 48, dice: '1d6', unit: 'in' }, weight: { base: 150, dice: '3d10', unit: 'lb' } } } };
const HOUSES = [
  { name: 'House Marrow', alignment: 'Reed', roll: '1–4 on the d8' }, // words: names
  { name: 'House Saltreach', alignment: 'Mire', roll: '5–7 on the d8' }, // words: names
  { name: 'House Lanternfall-under-the-Weir of the Nine Drowned Bells', alignment: 'Lantern', roll: '8 on the d8' }, // words: names
];
const PICKED = HOUSES[1]!.name;

/**
 * Hit points as on Who they are (final drafts C): the Roll row with the class's die, the average stepper holding the
 * die roll, and the sum in words; untouched, the average's line and what it gives.
 */
function HpField({ id, rule, start, heading = true }: { id: string; rule: HpRoll; start?: string; heading?: boolean }) {
  const average = 2;
  const [hp, setHp] = useState(start ?? '');
  const touched = start !== undefined;
  const text = touched ? hp : String(average);
  const stepper = (
    <AverageStepper
          id={id}
          label="Hit points"
          text={text}
          touched={touched}
          caption={hpWorkedLine(text, rule)}
          untouchedLine={[AVERAGE_LINE, hpAverageLine(average, rule)].filter(Boolean).join('. ')}
          onChange={setHp}
          onStep={(by) => setHp(String((Number(text) || average) + by))}
        />
  );
  // Under its heading on Who they are, the stepper has no label of its own; alone (no heading), the label beside it.
  if (!heading)
    return (
      <div className="hp-roll">
        <label className="label" htmlFor={id}>
          Hit points
        </label>
        {stepper}
      </div>
    );
  return (
    <PickGroup title="Hit points">
      <RollRow die={dieOf(rule.dice)}>{hpAskLine(rule)}</RollRow>
      <div className="hp-roll">{stepper}</div>
    </PickGroup>
  );
}

const GRIT = (value: number, score: number): HpRoll => ({ dice: '1d4', modifier: { value, ability: 'Grit', score }, minimum: null });

// A name table with two parts and a d100 one, opened beside the step (a tablet's second column; a sheet on a phone).
const PARTS = table('stone-parts', 'Stone kin names', 'd20', Array.from({ length: 20 }, (_, n) => ({ min: n + 1, max: n + 1, cells: [`Alder${n + 1}`, `Brack${n + 1}`] })), { columns: ['First names', 'Family names'], rollPrompt: 'Roll d20 twice: a first name, then a family name.' }); // words: names
const LONG = { ...table('surnames-100', 'Surnames', 'd100', Array.from({ length: 25 }, (_, n) => ({ min: n * 4 + 1, max: n * 4 + 4, result: `Reedwhistle the ${n + 1}th` }))), from: 'Table Generator' }; // words: names

export function CreationWhoSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Roll for a name (R3-1): one plain button with the table's die under the Name field; another pack's table and a d100 the same">
        <NameRoll table={NAMES} name="" onName={() => {}} />
        <NameRoll table={OFFERED} name="" onName={() => {}} />
      </Specimen>
      <Specimen name="Hit points (final drafts C): the Roll row with the class's die; untouched at the average with what it gives; rolled 3 with +1; rolled 1 with −2, never below 1; 999">
        <HpField id="hp-average" rule={GRIT(1, 13)} />
        <HpField id="hp-rolled" rule={GRIT(1, 13)} start="3" />
        <HpField id="hp-floor" rule={GRIT(-2, 5)} start="1" />
        <HpField id="hp-big" rule={{ dice: '3d8', modifier: { value: 1, ability: 'Grit', score: 13 }, minimum: null }} start="999" heading={false} />
      </Specimen>
      <Specimen name="A name table opened (R3-1, R3-2): the pack's roll prompt first, one tab per part, the rows as the tap; a first name marked, what's still to roll, Use this name. A d100 of 25 rows with What you rolled and the range bar, no folds (m5b-long-tables)">
        <div className="gallery__row">
          <NameTableSheet table={PARTS} tapped={['Alder3']} onTap={() => {}} onUse={() => {}} onClose={() => {}} asSheet={false} />
          <NameTableSheet table={LONG} tapped={[]} onTap={() => {}} onUse={() => {}} onClose={() => {}} asSheet={false} />
        </div>
      </Specimen>
      <Specimen name="A closed class's entry (final drafts C, ⚑3): the sign and why, the rule in words, Ask the GM to allow it">
        <EntryPanel
          name="Marsh Chaplain" // words: names
          meta="River Rules, p. 40" // words: names
          lead="Keeps the old rites at the water's edge."
          headings={[
            { label: 'Prime', text: 'Grit' },
            { label: 'Hit die', text: 'd6' },
          ]}
          closed={{ why: 'Not open to stone kin', note: 'Stone kin’s list of classes leaves out Marsh Chaplain (River Rules, p. 12). Your GM can allow it as a special approval: ask, and it’s picked and marked for them to approve.', onAsk: () => {} }}
          onClose={() => {}}
          asSheet={false}
        />
      </Specimen>
      <Specimen name="The liege as pick rows (cw-5; Design on #555): the Roll row saying what it sets, the pack's line under it, then the house's name, its alignment and roll under it; one picked; a long name">
        <PickGroup title="Liege">
          <RollRow die={8}>Roll d8 for the house your knight serves, then tap the row; it sets your alignment.</RollRow>
          <p className="creation-group__line">The noble house your knight serves: roll or choose.</p>
          {HOUSES.map((h) => (
            <PickRow key={h.name} name={h.name} blurb={`${h.alignment}, ${h.roll}`} picked={h.name === PICKED} onPick={() => {}} onOpen={() => {}} />
          ))}
        </PickGroup>
      </Specimen>
      <Specimen name="Help me choose, open (#526, P5): one plain paragraph, the full width, ending with 'or ask your GM'">
        <HelpMeChoose
          defaultOpen
          help="Your leaning is how your character tends to act when it matters. Pick the one that sounds like the person you want to play; it can change in play. If you're unsure, Reed is a gentle start, or ask your GM."
        />
      </Specimen>
      <Specimen name="Closed alignment rows (#526, cw-8; retest 2): the open ones first, then the approval fold, opened here: full contrast, the sign and why, no Pick">
        <PickGroup title="Leaning" meta="pick one">
          <PickRow name="Lantern" blurb="Keeps faith with the light." picked={false} onPick={() => {}} onOpen={() => {}} />
          <PickRow name="Reed" blurb="Bends, and stands again." picked onPick={() => {}} onOpen={() => {}} />
          <ApprovalFold count={1} holdsPick>
            <PickRow name="Mire" blurb="Takes what the water gives." fit={[{ text: 'Not open to marsh chaplain', warn: true }]} closed picked={false} onPick={() => {}} onOpen={() => {}} />
          </ApprovalFold>
        </PickGroup>
      </Specimen>
      <Specimen name="Derived values (cw-11, P16; final drafts C): folded, nine figures the rules work out; one figure, more to come; open, each figure with its source in words">
        <DerivedFields rows={['Armour', 'Saves', 'Speed', 'Attack', 'Title', 'Literacy', 'Hark', 'Spell ward', 'Movement'].map((label, i) => ({ key: label, label, value: String(10 + i) }))} onExplain={() => {}} />
        <DerivedFields rows={[{ key: 'river', label: 'River', value: '12' }, { key: 'lit', label: 'Literacy', value: '' }]} onExplain={() => {}} />
        <DerivedFields
          open
          rows={[
            { key: 'ac', label: 'Armour', value: '12', note: 'quilted cloth and Nimbleness 7' },
            { key: 'attack', label: 'Attack', value: '+0' },
            { key: 'speed', label: 'Speed', value: '40' },
          ]}
          onExplain={() => {}}
        />
      </Specimen>
      <Specimen name="Details (cw-11; Francis, 2026-11-18): age, height and weight from the kindred's usual; every describing table shown in the pack's order, none folded: twelve, two filled, two with long names">
        <CreationLeave onLeave={() => {}}>
          <DetailsStep
            tables={{ names: null, trinket: null, details: DETAILS, growth: null }}
            kindred="Stone kin"
            physical={physicalOf(STONE)}
            details={{ tables: { 'd-1': 'Hums while thinking', 'd-10': 'Shoulders back, chin up, and one hand always resting on the eel knife' } }}
            title="Details"
            why="None of this changes the rules. Skip it if you like."
            help={null}
            counter={{ at: 8, of: 9 }}
            onBack={() => {}}
            onSave={() => {}}
          />
        </CreationLeave>
      </Specimen>
      <Specimen name="Details, a kindred with one describing table (Francis, 2026-11-18): its one row, nothing folded; and a roll at level 1 (cts-5 c, cts-8: its line ends “then mark your row”)">
        <CreationLeave onLeave={() => {}}>
          <DetailsStep
            tables={{ names: null, trinket: null, details: DETAILS.slice(0, 1), growth: MOSS }}
            kindred="Stone kin"
            physical={[]}
            details={{ tables: {} }}
            title="Details"
            why="None of this changes the rules. Skip it if you like."
            help={null}
            counter={{ at: 8, of: 9 }}
            onBack={() => {}}
            onSave={() => {}}
          />
        </CreationLeave>
      </Specimen>
    </>
  );
}

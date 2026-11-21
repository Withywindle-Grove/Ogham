// Creation's final drafts in the component gallery (plan m5b-creation-final-drafts, slice A; mockups
// creation/final/01–08): the pieces every step is built from. No approved pictures yet: Design approves them.
// Invented names only.
import { useState, type ReactElement, type ReactNode } from 'react';
import { AdjustTile, AverageStepper, BookTable, EntryPanel, ScoreTile, ScoreTiles, useAverageField } from '../ui/creation.tsx';
import { DieGlyph, RollRow, type DieSize } from '../ui/dice.tsx';
import { GuidedInstruction, Note, WarningLine } from '../ui/parts.tsx';
import { classLevelTable } from '../modules/characters/startingXp.ts';
import { readTraitNote } from '../modules/library/ruleText.ts';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const DICE: readonly DieSize[] = [4, 6, 8, 10, 12, 20, 100];

function Average({ id, label, average, step, touched, text, caption, wide }: { id: string; label: string; average: number; step?: number; touched?: boolean; text?: string; caption: string; wide?: boolean }) {
  const field = useAverageField({ average, step, touched, text });
  return <AverageStepper id={id} label={label} text={field.text} touched={field.touched} caption={caption} onChange={field.onChange} onStep={field.onStep} wide={wide} />;
}

/** A score tile on Scores (slice B): untouched it shows the average's line; any step or typing touches it. */
function Score({ name, start, touched: was = false, words }: { name: string; start: string; touched?: boolean; words: string }) {
  const [value, setValue] = useState(start);
  const [touched, setTouched] = useState(was);
  const set = (text: string) => {
    setTouched(true);
    setValue(text);
  };
  return <ScoreTile id={`final-b-${name}`} label={name} long={name} value={value} onChange={set} onStep={(by) => set(String((Number.parseInt(value, 10) || 0) + by))} words={words} average={!touched} onExplain={() => {}} />;
}

// The class's level table (dec-10 C, cs-16), drawn by the real part from invented figures: titles stop at level 9.
const WARDEN = {
  progression: Array.from({ length: 14 }, (_, n) => ({ level: n + 1, hitDice: n < 9 ? `${n + 1}d8` : `9d8 + ${(n - 8) * 3}` })),
  levelTitles: ['Lamp-bearer', 'Wick-trimmer', 'Warden', 'Causeway Keeper', 'Lantern Sergeant', 'Flood Warden', 'Lantern Captain', 'Keeper of the Long Causeway', 'Lantern Lord'], // words: names
};
const WARDEN_XP = { levels: [1500, 3500, 7000, 13000, 25000, 50000, 95000, 180000, 280000, 380000, 480000, 580000, 999999].map((xp, n) => ({ level: n + 2, xp })) };
const none = () => {};
/** An Adjust tile's control, named for a screen reader as the step names it ("Raise Might by 1"). */
const control = (verb: 'Raise' | 'Lower', name: string, label: string) => ({ label, aria: `${verb} ${name} by ${label.slice(1)}`, onTap: none });

export function CreationFinalSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Die glyphs (A3): d4, d6, d8, d10, d12, d20 and d100 as two d10s, each its colour, at 24 and 32 px">
        <div className="gallery__row">
          {DICE.map((die) => (
            <span key={die} className="gallery__die">
              <DieGlyph die={die} />
              <DieGlyph die={die} size={32} />
              <span>d{die}</span>
            </span>
          ))}
        </div>
      </Specimen>
      <Specimen name="Roll row (A2): the die and the instruction in bold; a long one wraps beside the glyph; one with no die the app draws">
        <RollRow die={6}>Roll 3d6 at the table for each score, then enter what you rolled.</RollRow>
        <RollRow die={100}>Roll d100 for the keepsake your character carries from the drowned abbey of the long-gone marsh wardens, then tap the row.</RollRow>
        <RollRow die={null}>Roll for each at the table, or type them.</RollRow>
      </Specimen>
      <Specimen name="Average stepper (A5): untouched at the average with its line; touched, full weight and the caption; the coin's 100 stepping by 10; 0 and 999">
        <div className="gallery__row">
          <Average id="avg-might" label="Might" average={10} caption="+1 to hit and damage up close" />
          <Average id="avg-grit" label="Grit" average={10} touched text="13" caption="+1 hit point a level" />
          <Average id="avg-coin" label="Starting coin" average={100} step={10} caption="Rolled" wide />
          <Average id="avg-zero" label="Lore" average={10} touched text="0" caption="" />
          <Average id="avg-big" label="Age" average={21} touched text="999" caption="years" wide />
        </div>
      </Specimen>
      <Specimen name="Scores (B, final draft 1): untouched tiles at the average with the line; three touched; a long name, 0 and 999">
        <GuidedInstruction>Six numbers say what your character is naturally good at.</GuidedInstruction>
        <RollRow die={6}>Roll 3d6 at the table for each score, then enter what you rolled.</RollRow>
        <ScoreTiles>
          <Score name="Might" start="13" touched words="+1 to hit and damage up close" />
          <Score name="Nimbleness of the long-gone marsh wardens" start="10" touched words="" />
          <Score name="Grit" start="10" words="" />
          <Score name="Wits" start="0" touched words="−3 to languages" />
          <Score name="Lore" start="999" touched words="" />
          <Score name="Charm" start="10" words="" />
        </ScoreTiles>
      </Specimen>
      <Specimen name="Adjust scores (B, final draft 1): the lead; the prime tagged with + only; others with − only; at the floor no −; under it the sign; a traded tile says what it was (Design on #555)">
        <GuidedInstruction>
          <b>Your prime is Might</b>, the Lantern Warden’s main score. Lower another score by 2 to raise your prime by 1. Nothing may go under 9.
        </GuidedInstruction>
        <ScoreTiles adjust>
          <AdjustTile label="Might" long="Might" value={13} prime words="+5% experience now, +10% at 16" raise={control('Raise', 'Might', '+1')} onExplain={none} />
          <AdjustTile label="Wits" long="Wits" value={12} was={14} prime={false} words="+0 now, −1 at 8" lower={control('Lower', 'Wits', '−2')} onExplain={none} />
          <AdjustTile label="Charm" long="Charm" value={9} prime={false} words="+0 now. At the floor: can't go lower" onExplain={none} />
          <AdjustTile label="Nimbleness of the long-gone marsh wardens" long="Nimbleness of the long-gone marsh wardens" value={7} prime={false} words={<WarningLine>Already under 9: can't be lowered</WarningLine>} onExplain={none} />
        </ScoreTiles>
      </Specimen>
      <Specimen name="Adjust scores (B), two primes: the pack's line in the lead; both primes with +; neither says which sets the experience (the pack's line does); 999">
        <GuidedInstruction>
          <b>Your primes are Might and Wits</b>, the Marsh Chaplain’s main scores. Each prime counts toward experience by this class’s own steps. Lower another score by 2 to raise a prime by 1. Nothing may go under 9.
        </GuidedInstruction>
        <ScoreTiles adjust>
          <AdjustTile label="Might" long="Might" value={14} was={13} prime words="+5% experience now, +10% at 16" raise={control('Raise', 'Might', '+1')} onExplain={none} />
          <AdjustTile label="Wits" long="Wits" value={11} prime words="+0% experience now, +5% at 13" raise={control('Raise', 'Wits', '+1')} onExplain={none} />
          <AdjustTile label="Lore of the drowned abbey" long="Lore of the drowned abbey" value={999} prime={false} words="+3 now, +2 at 998" lower={control('Lower', 'Lore of the drowned abbey', '−2')} onExplain={none} />
        </ScoreTiles>
      </Specimen>
      <Specimen name="Warning sign (A4): on a closed row's line, a needs-approval line, an over-limit note">
        <WarningLine>Not open to stone kin</WarningLine>
        <WarningLine>Needs the GM's special approval</WarningLine>
        <Note tone="warning">30 silver over: take something off, or raise your coin</Note>
      </Specimen>
      <Specimen name="An entry in the book format (dec-10 S3, cs-4; pictures 16-A2, 18-C3): the name as the heading, labelled lines gathered before the lists, sub-headings over lists with bold lead-ins, the source last, Pick at the right; a long value wraps">
        <EntryPanel
          name="Lantern Warden" // words: names
          meta="River Rules, p. 31" // words: names
          lead="Keeps the marsh lamps and holds the front."
          headings={[
            { label: 'Requirement', text: 'Needs Grit 9, you have 13 ✓' },
            { label: 'Prime requisite', text: 'Might, +5% experience with your scores' },
            { label: 'Advantages', bullets: [{ name: 'Steady flame', effect: 'Relights a dying light once a day.' }, { name: 'Lamp-wise', effect: 'Knows how long any light has left.' }] },
            { label: 'Disadvantages', bullets: [{ name: 'Oath of light', effect: 'May never douse a light on purpose.' }] },
            { label: 'Languages', text: 'Old Lantern' }, // words: names
            { label: 'Level cap by kindred', text: 'Stone kin 12, Marsh folk 8, Keeper of the Nine Drowned Bells below the Old Lantern 6' },
          ]}
          extra={(() => { const t = classLevelTable(WARDEN, WARDEN_XP)!; return <BookTable title="Lantern Warden by level" head={t.head} rows={t.rows} wordsColumn={t.head.indexOf('Title')} />; })()} // words: names
          onPick={() => {}}
          onClose={() => {}}
          asSheet={false}
        />
      </Specimen>
      <Specimen name="A patron's entry in the book format (C3): its title as the small-capitals line, its garb and marks a ladder of labelled lines">
        <EntryPanel
          name="The Lantern Keeper" // words: names
          tagline="Light in the dark water"
          source="River Rules, p. 52" // words: names
          lead="The Lantern Keeper walks the dark water with a light for anyone lost on it."
          headings={[
            { label: 'Who follows', text: 'Marsh Chaplains; Reed or Lantern in alignment' },
            { label: 'Holy garb', bullets: [{ name: 'At creation', effect: 'A grey hood' }, { name: 'From level-2 spells', effect: 'A heron-feather stole' }], lines: true },
            { label: 'Prayer', text: 'Keep the lamp lit' },
          ]}
          picked
          onPick={() => {}}
          onClose={() => {}}
          asSheet={false}
        />
      </Specimen>
      <Specimen name="A trait whose note is in blocks (tfb-5, row C9; page M2, frames M2a and M2b): each block on its own line, a bold lead-in starting its paragraph, a list; an empty block left out; a long name; Got it at the foot">
        <EntryPanel
          name="Oath to the Company of the Seven Cairns and its Lantern Wardens" // words: names
          meta="River Rules, p. 18" // words: names
          lead={
            readTraitNote({
              blocks: [
                { p: 'A warden sworn to the Company answers its muster, wherever they are.' },
                { lead: 'The muster', text: 'When the horn is blown three times, the sworn make for the nearest cairn by the shortest road.' },
                { p: '' },
                { list: ['They leave no sworn companion behind.', 'They carry no banner but the Company’s.', 'They take no pay from its enemies.'] },
                { lead: 'Oath-broken', text: 'One who breaks the oath loses hearth-right until the Company takes them back.' },
              ],
            }).blocks!
          }
          headings={[
            { label: 'From', text: 'Your class, Lantern Warden' }, // words: names
            { label: 'When', text: 'At level 3' },
          ]}
          onClose={() => {}}
          backLabel="Got it"
          asSheet
          preview
        />
      </Specimen>
      <Specimen name="A class read from a kindred's chip (C3): its way back at the top, a quiet link; no Pick; the sheet drawn in place">
        <EntryPanel
          name="Reed Witch" // words: names
          meta="River Rules, p. 34" // words: names
          lead="Whispers her spells out of the reeds."
          headings={[{ label: 'Hit die', text: 'd4' }]}
          backTo="Stone kin" // words: names
          onClose={() => {}}
          asSheet
          preview
        />
      </Specimen>
      <Specimen name="A table in the book's style (ds-8): the filled title bar, the head row over its rule, the rows banded; 0 and 999,999">
        <BookTable
          title="Lantern wardens by level"
          head={['Level', 'Title', 'Experience', 'Hit dice']}
          rows={[
            ['1', 'Lamp-bearer', '0', '1d8'],
            ['2', 'Wick-trimmer', '1,500', '2d8'],
            ['3', 'Keeper of the Long Causeway', '3,500', '3d8'], // words: names
            ['14', '', '999,999', '9d8 + 15'],
          ]}
          wordsColumn={1}
        />
      </Specimen>
    </>
  );
}

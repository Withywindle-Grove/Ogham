// The creation rework's shared parts in the component gallery (cw-11, mockup creation/12; plan m5b-creation-rework
// slice A1): the creation step shell inside creation (Leave at the top, no ‹, Help me choose as a small button with ⓘ,
// Back and Next in the foot), New campaign's shell as it stays (‹ Back), the typed stepper (blank, a two-digit score,
// 999 in the wide box) and the plus / minus fold (folded, open, a long label). Invented names only.
import { useState, type ReactElement, type ReactNode } from 'react';
import { ApprovalFold, BookType, CreationLeave, CreationStep, FoldedGroup, OtherRow, PickRow, ScoreTile, ScoreTiles } from '../ui/creation.tsx';
import { TypedStepper } from '../ui/parts.tsx';
import { ExpertiseStep, expertiseSetup } from '../app/ExpertiseStep.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

function Score({ id, name, start, words }: { id: string; name: string; start: string; words: string }) {
  const [value, setValue] = useState(start);
  return <ScoreTile id={id} label={name} long={name} value={value} onChange={setValue} onStep={(by) => setValue(String((Number.parseInt(value, 10) || 0) + by))} words={words} onExplain={() => {}} />;
}

function Stepped({ start, label, wide }: { start: string; label: string; wide?: boolean }) {
  const [value, setValue] = useState(start);
  const step = (by: 1 | -1) => setValue(String(Math.max(0, (Number.parseInt(value, 10) || 0) + by)));
  return <TypedStepper label={label} value={value} onChange={setValue} onStep={step} placeholder="type" wide={wide} />;
}

// Invented pack names, as a pack would give them.
const WARDEN = 'Warden';
const WITCH = 'Witch';
const CHAPLAIN = 'Chaplain';
const FAMILIES = 'Adderbald';
const MIGHT = 'Muscle';
const WIT = 'Wit';
const GRIT = 'Grit';
const LONG_SCORE = 'Steadfastness of the drowned abbey';
const HELP = 'Your class is your character’s trade as an adventurer. It decides how you fight and what you can learn. If you’re unsure, ask your GM.';

export function CreationShellSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Creation step shell in creation (final drafts A1): the app bar (← Back, the title centred, ⋯ with Leave), the counter under it, Help me choose full width, Back and Next in the foot">
        <CreationLeave onLeave={() => {}}>
          <CreationStep title="Class" counter={{ at: 3, of: null }} why="Pick the trade your character follows." help={HELP} onBack={() => {}} hint="Witch picked" onNext={() => {}}>
            <PickRow name={WARDEN} blurb="Fights in the front; no spells" picked={false} onPick={() => {}} onOpen={() => {}} />
            <PickRow name={WITCH} blurb="Spells from the marsh; frail" picked onPick={() => {}} onOpen={() => {}} />
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name="Creation step shell, the first step: the foot's Back reads Leave">
        <CreationLeave onLeave={() => {}}>
          <CreationStep title="Scores" counter={{ at: 1, of: null }} why="Roll three dice for each, at the table, and enter what you rolled." help={HELP} onBack={() => {}} hint="All 6 entered" onNext={() => {}}>
            <p className="auth__meta">The scores go here.</p>
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name="Creation step shell outside creation (New campaign): ‹ Back stays until its own mockup">
        <CreationStep title="Name your campaign" counter={{ at: 1, of: 3 }} why="A name your players will know it by." help={null} onBack={() => {}} hint="Name missing" onNext={() => {}}>
          <p className="auth__meta">The name goes here.</p>
        </CreationStep>
      </Specimen>
      <Specimen name="Typed stepper (cw-11): blank, a two-digit score, 999 in the wide box">
        <BookType>
        <div className="gallery__row">
          <Stepped start="" label="Muscle" />
          <Stepped start="13" label="Nimbleness" />
          <Stepped start="999" label="Starting coin" wide />
        </div>
        </BookType>
      </Specimen>
      <Specimen name="The fold in creation (cs-9): the chevron, the approval fold folded (retest 2), open, a long label; Other… keeps its + square (+ means add)">
        <BookType>
        <ApprovalFold count={2}>
          <PickRow name={CHAPLAIN} fit={[{ text: 'Not open to stone kin', warn: true }]} picked={false} closed onPick={() => {}} onOpen={() => {}} />
        </ApprovalFold>
        <FoldedGroup label="Family names" note="Stone kin, d20" open>
          <p className="auth__meta">{FAMILIES}</p>
        </FoldedGroup>
        <FoldedGroup label="Derived values for a lantern warden of the drowned abbey: 9" note="armour, saves, speed, and more as you pick gear">
          <p className="auth__meta">Armour 7</p>
        </FoldedGroup>
        <OtherRow label="A language the list doesn't have" blurb="Type one in" onAdd={() => {}} onEmpty={() => {}} />
        </BookType>
      </Specimen>
      <Specimen name="Scores (cw-11, A2): the full name with ⓘ; one row each on a phone, three tiles across wider; 0, 999 and a long name">
        <BookType>
        <ScoreTiles>
          <Score id="g-might" name={MIGHT} start="13" words="+1 melee" />
          <Score id="g-wit" name={WIT} start="9" words="" />
          <Score id="g-long" name={LONG_SCORE} start="0" words="" />
          <Score id="g-big" name={GRIT} start="999" words="−2 hit points a level, reads slowly, no extra languages" />
        </ScoreTiles>
        </BookType>
      </Specimen>
      <Specimen name="A pick row closed (cw-8, cw-11): the sign and why, no Pick; a row with an entry marked ⓘ">
        <BookType>
        <PickRow name={CHAPLAIN} fit={[{ text: 'Not open to stone kin', warn: true }]} picked={false} closed onPick={() => {}} onOpen={() => {}} />
        </BookType>
      </Specimen>
      <Specimen name="Rows picked more than once (pf-16, as #671 has it): a short name keeps Picked ✓✓ beside it; a long one lets it drop under the name, at the right">
        <BookType>
          <PickRow name="Heron" blurb="Long legs and patience." picked pickedLabel="Picked ✓✓" pickedSpoken="picked twice" onPick={() => {}} onOpen={() => {}} />
          <PickRow name="Keeper of the Nine Drowned Bells below the Old Lantern" blurb="Rings the drowned to their rest." picked pickedLabel="Picked ✓✓" pickedSpoken="picked twice" onPick={() => {}} onOpen={() => {}} />
        </BookType>
      </Specimen>
      <Specimen name="The foot when Next can't go on (mockup creation/13): the sign and the words in the warning colour">
        <CreationLeave onLeave={() => {}}>
          <CreationStep title="Class" counter={{ at: 3, of: null }} why="Pick the trade your character follows." help={null} onBack={() => {}} hint="Pick a class first." stop onNext={() => {}}>
            <p className="auth__meta">The classes go here.</p>
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name="The Expertise step (G-208, mockup december/29 X1): 2 of 3 spent, a card with points on the wash, a long skill name, the figure stepper; the foot's line, then Decide later, Back and Next on one line (ex-4, ex-9)">
        <BookType>
          <CreationLeave onLeave={() => {}}>
            <ExpertiseStep
              setup={EXPERTISE}
              level={1}
              saved={{}}
              chosen={{ SS: 1, WL: 1 }}
              who={{ gm: false, approved: false }}
              title="Expertise"
              why="Each point makes one skill better."
              help={HELP}
              counter={{ at: 10, of: 13 }}
              onSave={async () => true}
              onLater={() => {}}
              onBack={() => {}}
            />
          </CreationLeave>
        </BookType>
      </Specimen>
    </>
  );
}

// An invented class's skills under expertise points (G-208): every skill starts at 1-in-6, at best 4-in-6.
const EXPERTISE = expertiseSetup({
  skills: {
    die: 'd6',
    names: { SW: 'Scale walls', SS: 'Spot snares', WL: 'Work locks', RC: 'Read the drowned cyphers of the Weir-kings' },
    points: { atStart: 3, perLevel: 1, base: 1, best: 4, name: 'Expertise' },
  },
})!;

// The creation rework's review in the component gallery (cw-11, mockup creation/12; proposal mockup creation/13; plan
// m5b-creation-rework slice D): the review's cards with a small worded Change, gear as lines with the given gear
// folded, the starting coin in words, magic by source, Derived values folded; the foot's line with the sign (what stops
// Send, a send that failed); messy data (a long name, a 40-character item, a thing the class can't wear, 0 coin left). Invented names and numbers only.
import type { ReactElement, ReactNode } from 'react';
import { CreationLeave, CreationStep, PickRow, PrimeXpTable, ReviewSections, type ReviewPart } from '../ui/creation.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const noop = () => {};

// Invented pack words, as a pack would give them.
const KIT = "Warden's kit";
const SPEAR = 'Ring coat, Reed spear, Marsh knife, Storm lantern, Lamp oil ×3';
const KEEPSAKE = 'A bag of sticky sweets that never get smaller';
// The pack's step titles and score names, and invented character names.
const KINDRED_CLASS = 'Kindred and class'; // words: names
const SCORES = 'Might 13, Nimbleness 9, Grit 12, Wits 7, Lore 15, Charm 10'; // words: names
const OSWIN = 'Oswin Adderbald'; // words: names
const LONG_NAME = 'Bartholomew Fenwick-Adderbald of the Lower Reeds'; // words: names
const KINDRED_LINE = 'Kindred: Stone kin'; // words: names
const CLASS_LINE = 'Class: Reed Witch, level 1'; // words: names
// 40 characters, as a pack could name a thing.
const FORTY = 'Lantern of the Drowned Abbey, half-empty'; // words: names

const REVIEW: ReviewPart[] = [
  // Two lines, each with its own Change (Design 2026-11-06).
  {
    id: 'class',
    title: KINDRED_CLASS,
    lines: [
      { text: KINDRED_LINE, onChange: noop, changeLabel: 'Change Kindred' }, // words: names
      { text: CLASS_LINE, onChange: noop, changeLabel: 'Change Class' }, // words: names
    ],
  },
  { id: 'scores', title: 'Scores', lines: [{ text: SCORES }], onChange: noop },
  { id: 'derived', title: 'Derived values', note: '6 figures', folded: true, lines: [{ text: '', tiles: { items: [{ key: 'ac', label: 'Armour', value: '7' }, { key: 'mv', label: 'Movement', value: '120' }, { key: 'at', label: 'Attack', value: '19' }] } }] },
  {
    id: 'gear',
    title: 'Gear',
    lines: [
      { text: KIT, sub: SPEAR },
      { text: 'Keepsake', sub: KEEPSAKE },
      { text: 'Given', fold: { note: '6 items', items: ['Torch ×4', 'Dry rations', 'Waterskin'] } },
      { text: '12 items, Unencumbered' },
      { text: 'Starting coin', sub: '100 rolled, +10 sp from Pedlar, 60 sp spent: 50 sp left' },
    ],
    onChange: noop,
  },
  {
    id: 'spells',
    title: 'Magic',
    lines: [
      { text: 'Marsh light', sub: 'From your kindred' },
      { text: 'Reed whisper', sub: 'From your class' },
    ],
    onChange: noop,
  },
];

const MESSY: ReviewPart[] = [
  {
    id: 'gear',
    title: 'Gear',
    lines: [
      {
        text: "The Drowned Abbey's lantern-warden expedition kit, the heavy one",
        sub: `Ring coat, Reed spear, ${FORTY}, Marsh knife, Lamp oil ×3, Eel line, Reed basket, Tinderbox`,
        warn: ["Ring coat: a Reed Witch can't wear it; carried"],
      },
      { text: '10 items, Over the limit' },
      { text: 'Starting coin', sub: '999, the average (not rolled), 999 sp spent: 0 sp left' },
    ],
    onChange: noop,
  },
];

export function CreationReviewSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Creation review (cw-11): cards with a small Change, gear as lines, the coin in words, magic by source, the rules folded">
        <CreationLeave onLeave={noop}>
          <CreationStep
            title={OSWIN}
            counter={{ at: 9, of: 9, note: 'Review' }}
            why=""
            help={null}
            onBack={noop}
            hint="Goes to the GM for approval"
            nextLabel="Send to the GM"
            onNext={noop}
            footQuiet={
              <>
                <button type="button" className="button-secondary">
                  Start over
                </button>
                <button type="button" className="button-secondary">
                  Save and leave
                </button>
              </>
            }
          >
            <ReviewSections parts={REVIEW} />
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name="Creation review, messy: a long name, a 40-character item, a thing the class can't wear, 0 coin left, and the foot's line with the sign">
        <CreationLeave onLeave={noop}>
          <CreationStep
            title={LONG_NAME}
            counter={{ at: 9, of: 9, note: 'Review' }}
            why=""
            help={null}
            onBack={noop}
            hint="Languages: Pick 1 more."
            stop
            nextLabel="Send to the GM"
            onNext={noop}
            footQuiet={
              <>
                <button type="button" className="button-secondary">
                  Start over
                </button>
                <button type="button" className="button-secondary">
                  Save and leave
                </button>
              </>
            }
          >
            <ReviewSections parts={MESSY} />
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name="Derived values as tiles (R3-6, mockup creation/final/12): the Score tile, three across, four past 1000 px; a word figure smaller; the saves their own group; messy: a long name, 0, 999, a long word">
        <ReviewSections
          onBreakdown={noop}
          parts={[
            {
              id: 'derived-open',
              title: 'Derived values',
              lines: [
                {
                  text: '',
                  tiles: {
                    items: [
                      { key: 'ac', label: 'Armour', value: '10', caption: 'unarmoured, Nimbleness +0', breakdown: { title: 'Armour', lines: [] } },
                      { key: 'at', label: 'Attack', value: '+0', breakdown: { title: 'Attack', lines: [] } },
                      { key: 'sp', label: 'Speed', value: '999', caption: '2,997 a turn', breakdown: { title: 'Speed', lines: [] } },
                      { key: 'ti', label: 'Title', value: 'Medium', breakdown: { title: 'Title', lines: [] } },
                      { key: 'li', label: 'Literacy', value: 'Veteran of the Nine Drowned Bells', breakdown: { title: 'Literacy', lines: [] } }, // words: names
                      { key: 'zero', label: 'Armour of the long cold of the drowned abbey', value: '0', caption: 'no armour, Nimbleness −3', breakdown: { title: 'Armour', lines: [] } },
                    ],
                  },
                },
                {
                  text: '',
                  tiles: {
                    label: 'Saves',
                    saves: true,
                    items: ['Mire', 'Ash', 'Bell', 'Reed', 'Lantern'].map((n, i) => ({ key: n, label: n, value: String(12 + i), breakdown: { title: n, lines: [] } })), // words: names
                  },
                },
              ],
            },
          ]}
        />
      </Specimen>
      <Specimen name="The prime experience table (R3-7, mockup creation/final/11): in creation the book's table (dec-10 B, 17-B4): the pack's rows banded, the character's band in bold, “you” said, not shown">
        <PrimeXpTable
          prime="Wits"
          bands={[
            { range: '3–5', xp: '−20 %', you: false },
            { range: '6–8', xp: '−10 %', you: false },
            { range: '9–12', xp: '+0 %', you: true },
            { range: '13–15', xp: '+5 %', you: false },
            { range: '16–18', xp: '+10 %', you: false },
          ]}
        />
      </Specimen>
      <Specimen name="A pick-up-to-N row picked twice (R3-8): Picked ×2 with the − square; once, Picked ✓ with −; not picked, Pick">
        <PickRow name="2–4: Bog eel ×2" picked times={2} onPick={noop} onPutBack={noop} />
        <PickRow name="1: Reed rope" picked times={1} onPick={noop} onPutBack={noop} />
        <PickRow name="5: Reed basket" picked={false} onPick={noop} onPutBack={noop} />
      </Specimen>
      <Specimen name="Creation review, a send that failed: the foot's line with the sign (Send to the GM tries again)">
        <CreationLeave onLeave={noop}>
          <CreationStep title={OSWIN} counter={{ at: 9, of: 9, note: 'Review' }} why="" help={null} onBack={noop} hint="Couldn't send it to your GM. Nothing is lost." stop nextLabel="Send to the GM" onNext={noop}>
            <ReviewSections parts={REVIEW.slice(0, 1)} />
          </CreationStep>
        </CreationLeave>
      </Specimen>
    </>
  );
}

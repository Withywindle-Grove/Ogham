// The patron (December 1a, the #636 rework of 2026-11-12) in the component gallery: the Patron step as it opens (mockup
// creation/final/14-01: its own step after Class, the sentence under the count, the patrons' Pick rows, the ones needing
// the GM's approval folded, "No patron yet"), and the full sheet's Patron section (Francis, 2026-11-12: the name beside
// the heading, the book's whole ladder with bold lead-ins, each tier reached or to come; a long name and a long garb
// line). Then a class's alignment limit crossed with a patron's followers (fix-patron-class-alignment; the Conductor,
// 2026-11-12): a closed patron's row and its entry (a hard limit), a soft one's row in the open fold, and the soft
// reason as the GM's approval card shows it; a long class name, the words from the build's own functions. The entry
// and the GM's reason as cp-1 fixed them (2026-11-13): one ▲ line in the row's words with the why plain under it, no
// heading of its own, closed by its ✕; the soft reason's full stop; and a closed patron kept from before, Picked ✓ with
// its ▲ line and the line that holds it. Invented names only. New pictures: CI draws them and they go to Design.
import type { ReactElement, ReactNode } from 'react';
import { offeredPatronApproval, patronClosedEntry, patronClosedPickLine, patronEntry, patronNotOpen, patronsFor, readPatron, patronLadder, patronRowLine, type PatronEntry, type PatronFitTo } from '../modules/characters/patrons.ts';
import { SPECIAL_NOTE } from '../modules/characters/creationSteps.ts';
import { ApprovalFold, BookType, CreationLeave, CreationStep, EntryPanel, PickRow } from '../ui/creation.tsx';
import { GmException } from '../app/GmException.tsx';
import { PatronLadderView } from '../app/SheetParts.tsx';
import { SheetSection } from '../app/SheetSection.tsx';
import '../app/CharacterSheet.css';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => {};
const KEEPER = readPatron({
  packEntryId: 'ex-patron-keeper',
  name: 'The lantern keeper',
  data: { blurb: 'Light in the dark water.', followers: { classes: ['marsh-chaplain'], alignments: ['Reed', 'Lantern'] } },
});
const HERON = readPatron({ packEntryId: 'ex-patron-heron', name: 'Old heron', data: { blurb: 'Patience, and the long wait', followers: { classes: ['marsh-chaplain'] } } });
const BELLS = readPatron({
  packEntryId: 'ex-patron-bells',
  name: 'The Keeper of the Nine Drowned Bells below the Old Lantern',
  data: {
    followers: { classes: ['marsh-chaplain'], alignments: ['Reed'] },
    holySymbol: 'A cracked bell on a cord of green reed.',
    holyGarb: [
      { atSpellLevel: 0, text: 'A grey hood', itemIds: [] },
      { atSpellLevel: 1, text: 'A heron-feather stole worn over the left shoulder, never the right', itemIds: [] },
      { atSpellLevel: 3, text: 'A belt of nine small bells', itemIds: [] },
    ],
    prayer: 'Keep the lamp lit.',
    strictures: 'Never leave a flame to die untended.',
    spells: { swap: [{ level: 1, replaces: 'ex-mend', with: 'ex-glow' }] },
    marks: [
      { atSpellLevel: 1, text: 'Your eyes catch the lamplight.' },
      { atSpellLevel: 3, text: 'You hear bells under still water.' },
    ],
  },
});
const SPELLS: Record<string, string> = { 'ex-mend': 'Mend cup', 'ex-glow': 'Guiding glow' };

// A class with a long name, its followers crossed with each limit (fix-patron-class-alignment): the closed and the soft patron.
const CHAPLAIN = { id: 'ex-drowned-bell-chaplain', name: 'Marsh Chaplain of the Drowned Bell' }; // words: names
const CHAPLAIN_WORD = CHAPLAIN.name.toLowerCase();
const ALIGNMENTS = ['Lantern', 'Reed', 'Mire'];
const HARD: PatronFitTo = { limit: { names: ['Lantern', 'Reed'], soft: false }, alignments: ALIGNMENTS };
const SOFT: PatronFitTo = { limit: { names: ['Lantern', 'Reed'], soft: true }, alignments: ALIGNMENTS };
const MIRE_MOTHER: PatronEntry = {
  packEntryId: 'ex-patron-mire-mother',
  name: 'The Mire Mother', // words: names
  data: { blurb: 'What the bog takes, it keeps.', followers: { classes: [CHAPLAIN.id], alignments: ['Mire'] }, holySymbol: 'A knot of black reed.' },
};
const SUNK_LAMP: PatronEntry = { packEntryId: 'ex-patron-sunk-lamp', name: 'The Sunk Lamp', data: { blurb: 'A light seen only from under the water.', followers: { classes: [CHAPLAIN.id], alignments: ['Mire'] } } }; // words: names
const CLOSED = patronsFor([MIRE_MOTHER], CHAPLAIN.id, [], HARD)[0]!;
const SOFTENED = patronsFor([SUNK_LAMP], CHAPLAIN.id, [], SOFT)[0]!;
const CLOSED_ENTRY = patronEntry(CLOSED.patron, { spell: (id) => SPELLS[id], klass: (id) => (id === CHAPLAIN.id ? CHAPLAIN.name : undefined) }, 'Fen Rules'); // words: names
const SOFT_REASON = offeredPatronApproval(SOFTENED, SOFT, CHAPLAIN_WORD);

export function PatronSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Patron step as it opens (mockup creation/final/14-01): its own step after Class, the sentence under the count, Pick rows with ⓘ, the GM's approval folded, No patron yet">
        <CreationLeave onLeave={none}>
          <CreationStep title="Patron" counter={{ at: 4, of: 10 }} why="Your patron sets or narrows your alignment." help={null} onBack={none} decideLater={{ onPick: none }} hint="No patron yet" onNext={none}>
            <div role="group" aria-label="Patrons">
              <PickRow name={KEEPER.name} blurb={patronRowLine(KEEPER)} picked={false} onPick={none} onOpen={none} />
              <PickRow name={HERON.name} blurb={patronRowLine(HERON)} picked={false} onPick={none} onOpen={none} />
              <ApprovalFold count={1} more>
                <PickRow name="The mire mother" blurb="What the bog takes, it keeps." picked={false} onPick={none} onOpen={none} />
              </ApprovalFold>
            </div>
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name="Full sheet, the Patron section (Francis, 2026-11-12): the name beside the heading, plain with a small ⓘ that opens the entry; the book's ladder, the garb and the marks one line per tier, reached or to come">
        <SheetSection label="Patron" labelAction={{ text: BELLS.name, label: `Patron ${BELLS.name}: open its entry`, onTap: none }}>
          <PatronLadderView ladder={patronLadder(BELLS, 1, 'marsh-chaplain', { spell: (id) => SPELLS[id] })} />
        </SheetSection>
      </Specimen>
      <Specimen name={`A closed patron's row (fix-patron-class-alignment): the class's hard alignment limit and the followers share no name (fit: ${CLOSED.fit}); the sign and "Not open to <class>", no Pick; a long class name`}>
        <BookType>
        <div role="group" aria-label="Patrons">
          <PickRow name={CLOSED.label} blurb={patronRowLine(CLOSED.patron)} fit={[{ text: patronNotOpen(CHAPLAIN_WORD), warn: true }]} closed picked={false} onPick={none} onOpen={none} />
        </div>
        </BookType>
      </Specimen>
      <Specimen name="The closed patron's entry opened (cp-1): one warning line in the row's words, the why plain under it, no heading of its own, no Pick, closed by its ✕ only (on the step it opens as a sheet; drawn here beside the list)">
        <BookType>
        <EntryPanel
          name={CLOSED.label}
          meta={CLOSED_ENTRY.meta || undefined}
          lead={CLOSED_ENTRY.lead || undefined}
          description={CLOSED_ENTRY.description}
          headings={CLOSED_ENTRY.headings}
          closed={patronClosedEntry(CLOSED.patron, HARD.limit, CHAPLAIN_WORD)}
          onClose={none}
          asSheet={false}
        />
        </BookType>
      </Specimen>
      <Specimen name="A closed patron kept from before (picked before the class's limit closed it; nit 1 of #665): Picked ✓ to take it off, its warning line, and the foot's warning line that holds Next and Send">
        <CreationLeave onLeave={none}>
          <CreationStep title="Patron" counter={{ at: 4, of: 10 }} why="Your patron sets or narrows your alignment." help={null} onBack={none} hint={patronClosedPickLine(CHAPLAIN_WORD, CLOSED.label, true)} stop onNext={none}>
            <div role="group" aria-label="Patrons">
              <PickRow name={CLOSED.label} blurb={patronRowLine(CLOSED.patron)} fit={[{ text: patronNotOpen(CHAPLAIN_WORD), warn: true }]} picked onPick={none} onOpen={none} />
              <PickRow name={KEEPER.name} blurb={patronRowLine(KEEPER)} picked={false} onPick={none} onOpen={none} />
            </div>
          </CreationStep>
        </CreationLeave>
      </Specimen>
      <Specimen name={`A soft patron's row (fit: ${SOFTENED.fit}): in the GM's-approval fold, shown open, marked "Needs the GM's special approval", Pick kept`}>
        <BookType>
        <div role="group" aria-label="Patrons">
          <ApprovalFold count={1} more holdsPick>
            <PickRow name={SOFTENED.label} blurb={patronRowLine(SOFTENED.patron)} fit={[{ text: SPECIAL_NOTE, warn: true }]} picked={false} onPick={none} onOpen={none} />
          </ApprovalFold>
        </div>
        </BookType>
      </Specimen>
      <Specimen name="The soft patron's reason on the GM's approval card, in the card's frame: the followers' alignments and the class's usual ones, with Allow it">
        {/* Inside the card's own frame (the GM screen's `.gm` and `.gm__approval`), as the GM sees it; the card's heading and the review under it left out.
            `gm--sub`: the whole width on a tablet, as the card is in the Players section (not the 280 px side column). */}
        <div className="gm gm--sub">
          <div className="gm__approval">{SOFT_REASON && <GmException exception={SOFT_REASON} settled={false} onAllow={none} />}</div>
        </div>
      </Specimen>
    </>
  );
}

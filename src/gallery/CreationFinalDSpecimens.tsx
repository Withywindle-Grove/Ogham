// Creation's final drafts D and F in the component gallery (plan m5b-creation-final-drafts, slices D and F; mockups
// creation/final/04–08): the parts and states those steps draw. No approved pictures yet: Design approves them.
// Invented names only.
import type { ReactElement, ReactNode } from 'react';
import { ApprovalFold, CreationLoading, languageFoldLabel, PickRow, ReviewSections } from '../ui/creation.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { RollRow } from '../ui/dice.tsx';
import { WarningLine } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => {};

export function CreationFinalDSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Given rows (D): what the kindred or class gives, marked Given with no button; a long name">
        <PickRow name="Marsh light" blurb="A floating glow that follows you" picked given onPick={none} onOpen={none} />
        <PickRow name="The whispering tongue of the drowned abbey's last lantern wardens" blurb="From Stone kin" picked given onPick={none} onOpen={none} />
      </Specimen>
      <Specimen name="Languages (D; Design on #555): the die's Roll row, the open rows numbered in their lines, then one fold (opened here) holding a left-out number with why and a row needing approval, the sign on its own line">
        <RollRow die={6}>Roll d6, or choose.</RollRow>
        <PickRow name="Heron-tongue" blurb="1. The courtly tongue of the heron lords" picked={false} onPick={none} onOpen={none} />
        <ApprovalFold count={2} label={languageFoldLabel(2, true, 1, 1)} holdsPick>
          <PickRow name="Old marsh" fit={[{ text: '4.' }, { text: 'Not open to Stone kin', warn: true }]} picked={false} closed onPick={none} />
          <PickRow name="Croak" blurb="The croak-speech of the toad folk" fit={[{ text: "Needs the GM's special approval", warn: true }]} picked onPick={none} onOpen={none} />
        </ApprovalFold>
      </Specimen>
      <Specimen name="Gear past a limit (D, final draft 8): the sign and the limit under the coin, 999; the footer's kit count past creation.kits.pick">
        <RollRow die={6}>Roll 3d6 × 10 for starting coin at the table, then enter it.</RollRow>
        <p className="gear-coin__warn">
          <WarningLine>3d6 × 10 can&apos;t give 190. The most is 180</WarningLine>
        </p>
        <p className="gear-coin__warn">
          <WarningLine>3d6 × 10 can&apos;t give 999. The most is 180</WarningLine>
        </p>
        <p className="creation-step__hint creation-step__hint--stop">
          <WarningLine>2 kits, 1 allowed</WarningLine>
        </p>
      </Specimen>
      <Specimen name="The review's exceptions card (D): the sign over each exception and the pack's reason">
        <ReviewSections
          parts={[
            {
              id: 'exceptions',
              title: "2 things need the GM's special approval",
              warn: true,
              lines: [
                { text: 'Croak', sub: 'Usually learnt only by toad kinds' },
                { text: 'Starting coin 190', sub: '3d6 × 10 gives 30 to 180' },
              ],
            },
          ]}
        />
      </Specimen>
      <Specimen name="Start over (D): the one confirm in creation, as a sheet">
        <Dialog label="Start over?" onClose={none} preview>
          <p className="reading">Everything you chose for Oswin Adderbald goes, and creation begins again at step 1. Nothing has been sent to your GM yet.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary">
              Start over
            </button>
            <button type="button" className="button-secondary">
              Keep going
            </button>
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="Loading (F): after 300 ms, the line, then skeleton rows (drawn here without the wait)">
        <CreationLoading line="Loading your setting's rules…" delay={0} />
      </Specimen>
      <Specimen name="A failed send (F): the sheet with its two ways out">
        <Dialog label="Not sent" onClose={none} preview>
          <p className="reading">
            <WarningLine>Your GM didn’t get it</WarningLine>
          </p>
          <p className="reading">The connection dropped while sending. Everything you chose is still here. Try again when you’re back online, or save and leave and send later from your sheet.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary">
              Try again
            </button>
            <button type="button" className="button-secondary">
              Save and leave
            </button>
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="Continue where you left off (F): what was kept, where and when">
        <Dialog label="Continue where you left off?" onClose={none} preview>
          <p className="reading">You left a character on this device on Thursday: Scores, Stone kin, Reed Witch.</p>
          <p className="auth__meta">Kept on this device only.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary">
              Continue
            </button>
            <button type="button" className="button-secondary">
              Start again
            </button>
          </div>
        </Dialog>
      </Specimen>
    </>
  );
}

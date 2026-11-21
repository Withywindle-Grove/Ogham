// A sheet's or pop-up's foot (ft-1, 2026-11-14, "buttons are right justified"; drawn in the approved Pack frames PK3,
// PK5, PK10b and the shop's TW4a): a lone accent sits at the right at its own width, never stretched and never at the
// left; two or more sit side by side, the group at the right, in code order (no drawing settles these, so the accent
// first); when they don't fit one row (a phone) they stack, each at the right, in the same order. Four feet: a
// word-only accent alone, two buttons, three buttons (one row on a tablet, stacked at 375 px), and a stacked accent
// alone. Then three for the stacked button's width (stk-2): Done and Add together at 88 px each, a long word on one
// line widening its button, and three together at the widest one's width (a row on a tablet, one column at 375 px,
// measured by tests/layout/stackedWidth.spec.ts). Invented words only. New pictures: CI draws them and they go to Design.
import type { ReactElement, ReactNode } from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { StackedButton, StackedGroup } from '../ui/parts.tsx';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

const none = () => undefined;

export function SheetFootSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="One accent alone: at the right, at its own width">
        <Dialog label="Storm lantern" onClose={none} preview>
          <p>Four herons, bought at the reed market.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary">
              Add to Wren’s pack
            </button>
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="Two buttons: side by side at the right, in code order (here the accent first)">
        <Dialog label="Lanterns need oil" onClose={none} preview noClose>
          <p>Lanterns burn down and need a flask to refill.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary">
              Save
            </button>
            <button type="button" className="button-secondary button-secondary--small">
              Cancel
            </button>
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="Three buttons: one row at the right on a tablet; stacked at the right on a phone, in the same order">
        <Dialog label="Storm lantern, 4 herons" onClose={none} preview noClose>
          <p>The reed market has one left.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary">
              Buy it
            </button>
            <button type="button" className="button-secondary button-secondary--small">
              Leave it
            </button>
            <button type="button" className="button-secondary button-secondary--small">
              Ask the price
            </button>
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="A stacked accent alone: at the right, at its own width">
        <Dialog label="New in your pack" onClose={none} preview>
          <p>Moon opals ×2, from your GM, just now.</p>
          <div className="dialog__actions">
            <StackedButton icon="check-mark" label="Got it" variant="primary" onClick={none} />
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="Done and Add, stacked buttons together: each at its least width, 88 px (stk-2)">
        <Dialog label="Moon opals" onClose={none} preview>
          <p>Two, from the reed market.</p>
          <div className="dialog__actions">
            <StackedGroup>
              <StackedButton icon="check-mark" label="Done" variant="primary" onClick={none} />
              <StackedButton icon="two-coins" label="Add" onClick={none} />
            </StackedGroup>
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="A long word: on one line, the button as wide as it needs (stk-2)">
        <Dialog label="Signs of the bog lurker" onClose={none} preview>
          <p>Each of you rolls once.</p>
          <div className="dialog__actions">
            <StackedButton icon="run" label="Roll them all at the table" variant="primary" onClick={none} />
          </div>
        </Dialog>
      </Specimen>
      <Specimen name="Three together at one width, the widest's: a row on a tablet; stacked at the right on a phone, still one width (stk-2)">
        <Dialog label="Storm lantern, 4 herons" onClose={none} preview>
          <p>The reed market has one left.</p>
          <div className="dialog__actions">
            <StackedGroup>
              <StackedButton icon="two-coins" label="Buy" variant="primary" onClick={none} />
              <StackedButton icon="exit-door" label="Leave it" onClick={none} />
              <StackedButton icon="hourglass" label="Ask the price" onClick={none} />
            </StackedGroup>
          </div>
        </Dialog>
      </Specimen>
    </>
  );
}

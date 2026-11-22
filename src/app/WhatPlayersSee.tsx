// "What players see" (K22c; ruling k22-1, k22-3, picks 1 to 3; page 33, frames K22b, K22c, K22i 2, approved
// 2026-11-21): the GM's form for an unidentified item's "Appears as" and "What you notice", each starting from the line's
// words, either may be emptied, a quiet line under each saying what an empty one gives. Save runs inventory.editLook at
// once with its toast and Undo; Save with nothing changed closes and says nothing. Opened from inside the item's sheet:
// its own form, the Sheet, centred on a tablet and from the foot on a phone (K22b, K22i).
import { useId, useState, type FormEvent } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { editItemLook, type InventoryLine, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { shownName } from '../modules/inventory/packView.ts';
import { CentredPopUpScope, Dialog, SheetScope } from '../ui/Dialog.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import type { Run } from './packHelpers.ts';
import { registry } from './services.ts';
import './RevealPopup.css';

/** A field that grows to its words, so nothing is cut (K22c, 3). */
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  // Its borders too: the height set is the whole box.
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
};

export function WhatPlayersSee({
  line,
  carrier,
  singular,
  db,
  user,
  campaign,
  run,
  busy,
  onClose,
}: {
  line: InventoryLine;
  carrier: NamedCarrier;
  /** The item's category's singular name, what an empty "Appears as" reads as ("Ring"). */
  singular: string;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  run: Run;
  busy: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [appearsAs, setAppearsAs] = useState(line.appearsAs ?? '');
  const [noticed, setNoticed] = useState(line.noticed ?? '');
  const toast = useToast();

  function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (appearsAs.trim() === (line.appearsAs ?? '').trim() && noticed.trim() === (line.noticed ?? '').trim()) return onClose();
    const words = `Changed what players see of the ${shownName(line.name)}.`;
    void run(() => runCommand(registry, db, user, editItemLook, { line: { id: line.id, carrier, version: line.version }, appearsAs, noticed })).then((done) => {
      if (!done) return;
      onClose();
      toast({
        text: words,
        onUndo: () =>
          void run(async () => {
            const eventId = await latestChange(db, campaign.id, 'inventory.editLook', user.id);
            if (!eventId) return { ok: false as const, message: 'There was nothing to undo.' };
            return runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
          }),
      });
    });
  }

  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label="What players see" onClose={onClose}>
          <form className="what-players-see" onSubmit={save}>
            <div className="field">
              <label className="label" htmlFor={`${id}-appears`}>
                Appears as
              </label>
              <textarea
                id={`${id}-appears`}
                ref={grow}
                className="field__input field__textarea what-players-see__field"
                rows={1}
                maxLength={200}
                value={appearsAs}
                onChange={(event) => {
                  setAppearsAs(event.target.value.replace(/\n/g, ' '));
                  grow(event.target);
                }}
                onKeyDown={(event) => {
                  // One line: Enter saves, as in a plain field.
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <p className="auth__meta">Left empty, it reads as “{singular}”.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor={`${id}-noticed`}>
                What you notice
              </label>
              <textarea
                id={`${id}-noticed`}
                ref={grow}
                className="field__input field__textarea what-players-see__field"
                rows={3}
                maxLength={2000}
                value={noticed}
                onChange={(event) => {
                  setNoticed(event.target.value);
                  grow(event.target);
                }}
              />
              <p className="auth__meta">Left empty, players see no such line.</p>
            </div>
            <div className="dialog__actions">
              <button type="submit" className="button-primary" aria-busy={busy}>
                Save
              </button>
            </div>
          </form>
        </Dialog>
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}

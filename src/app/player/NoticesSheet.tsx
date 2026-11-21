import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../../ui/Dialog.tsx';
import { Icon } from '../../ui/icons.tsx';
import { WarningSign } from '../../ui/parts.tsx';

/**
 * One notice in the Player tab's notices box (row C1, tfn-2; page M1, frames M1d and M1e): its bold line after its sign,
 * the words under it, and its own button or rows under those. `act`: it asks for an act (the weather roll, a light to
 * light), so it comes first. The hosted sheet's own notices (`SheetNotice`, CharacterSheet.tsx) have the same shape.
 */
export type Notice = {
  key: string;
  title: ReactNode;
  /** "warning" for "No light" (⚠, as drawn); the rest carry ⓘ. */
  sign?: 'warning' | 'info';
  body?: ReactNode;
  action?: ReactNode;
  act?: boolean;
};

/**
 * The notices' sheet (frames M1d, M1e): the book's red heading "Notices" and its ✕; one notice at a time, with "1 of 3"
 * over it and Back and Next at the foot's right (ft-1) when there are several; "Nothing new." when there is none. A
 * notice's own button sits under its words. When the last notice is dealt with, the sheet closes by itself.
 */
export function NoticesSheet({ notices, onClose }: { notices: readonly Notice[]; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const count = notices.length;
  const shown = Math.min(at, Math.max(0, count - 1));
  // The sheet opened on something and the last one went (lit, entered, taken back, put away): it has done its work.
  const had = useRef(count > 0);
  useEffect(() => {
    if (count > 0) had.current = true;
    else if (had.current) onClose();
  }, [count, onClose]);
  const notice = notices[shown];
  return (
    <Dialog label="Notices" bookHeading onClose={onClose}>
      {!notice ? (
        <p className="notices__none">Nothing new.</p>
      ) : (
        <>
          {count > 1 && (
            <p className="notices__at" aria-live="polite">
              {shown + 1} of {count}
            </p>
          )}
          <div key={notice.key} className="notice">
            <p className="notice__title">
              <span className="notice__sign">{notice.sign === 'warning' ? <WarningSign size={20} /> : <Icon name="info" size={20} />}</span>
              <span>{notice.title}</span>
            </p>
            {notice.body !== undefined && (typeof notice.body === 'string' ? <p className="notice__body">{notice.body}</p> : <div className="notice__body">{notice.body}</div>)}
            {notice.action && <div className="notice__action">{notice.action}</div>}
          </div>
          {count > 1 && (
            <div className="dialog__actions notices__foot">
              {shown > 0 && (
                <button type="button" className="button-secondary" onClick={() => setAt(shown - 1)}>
                  Back
                </button>
              )}
              {shown < count - 1 && (
                <button type="button" className="button-secondary" onClick={() => setAt(shown + 1)}>
                  Next
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

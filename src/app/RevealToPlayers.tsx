// "Reveal to players" (sf-4; page 44, EN6, approved 2026-11-26; finding 1, "Preview, then send"): "Reveal…" on the
// encounter's card opens the words the players will see, in a box the GM may change or cut; one quiet line says what
// goes; "Show players" is the pop-up's one accent. Nothing is sent until it is tapped, and then only the words in the
// box (A1's check.showWords keeps them and nothing of the check). With nothing written it stays a button and says why
// (EN6 E). A sheet from the foot on a phone, centred on a tablet (sf-28), as the roll's pop-up is.
import { useId, useState } from 'react';
import { CentredPopUpScope, Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { WarningLine } from '../ui/parts.tsx';
import './RevealToPlayers.css';

/** The most the database keeps of a reveal's words (`show_check_words`, sf-7a): the box takes no more. */
export const REVEAL_WORDS_MAX = 2000;

/** A send that fails (N5; page 44, EN7 C): nothing reached a player, and the way to try again. */
export const REVEAL_FAILED = "Couldn't show the players. Nothing was sent. Tap Reveal… to try again.";

/** "Show players" while another change is still saving: nothing was sent, and the GM's words wait for the next try. */
export const REVEAL_BUSY = 'Another change was still saving. Tap Reveal… to try again.';

/** The box's height in lines: three at least, growing with the words (EN6 D: a row of forty words grows the box). */
export const revealRows = (words: string): number => Math.max(3, Math.min(12, Math.ceil(words.length / 40) + 1));

export function RevealToPlayers({ start, onShow, onClose }: { start: string; onShow: (words: string) => void; onClose: () => void }) {
  const id = useId();
  const [words, setWords] = useState(start);
  const [empty, setEmpty] = useState(false);
  const show = () => {
    const said = words.trim();
    if (!said) {
      setEmpty(true);
      return;
    }
    onShow(said);
  };
  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label="Reveal to players" over="An encounter" onClose={onClose}>
          <div className="reveal-words">
            <label className="reveal-words__label" htmlFor={id}>
              What players will see
            </label>
            <textarea
              id={id}
              className="field__input field__textarea reveal-words__box"
              rows={revealRows(words)}
              maxLength={REVEAL_WORDS_MAX}
              value={words}
              aria-describedby={`${id}-goes`}
              onChange={(e) => {
                setWords(e.target.value);
                if (e.target.value.trim()) setEmpty(false);
              }}
            />
            {empty && (
              <p className="reveal-words__why" role="alert">
                <WarningLine>Write what the players will see.</WarningLine>
              </p>
            )}
            <p id={`${id}-goes`} className="reveal-words__goes">
              Players get these words and nothing else.
            </p>
          </div>
          <div className="dialog__actions">
            <button type="button" className="button-primary reveal-words__show" onClick={show}>
              <Icon name="eye" size={20} />
              <span>Show players</span>
            </button>
          </div>
        </Dialog>
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}

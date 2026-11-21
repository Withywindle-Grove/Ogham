// The caller's banner (mc-76; S12; page 04 frames C3, C5 and C8, approved 2026-11-12): at the head of the marching
// order's card, the banner's mark between two flourishes, then "Caller" in small capitals and the character's name. The
// whole banner is one button. A press opens the party's characters as bare circles under it (no hirelings: a caller is
// a person), the caller now marked by a second ring in ink and the name in bold, and "No caller" as an empty dashed
// circle last; a press on one changes it at once (the caller of `onChoose` gives the Undo toast) and closes the
// circles; ✕ closes them with nothing changed. The caller is kept in the campaign's settings (the lead, 2026-11-14).
import type { Db } from '../core/supabase.ts';
import { Icon } from '../ui/icons.tsx';
import { CloseButton } from '../ui/parts.tsx';
import { Portrait } from './Portrait.tsx';
import './CallerBanner.css';

export interface CallerChoice {
  id: string;
  name: string;
  initials: string;
  portraitAssetId: string | null;
}

export function CallerBanner({
  db,
  campaignId,
  people,
  caller,
  open,
  onPress,
  onClose,
  onChoose,
}: {
  db: Db;
  campaignId: string;
  /** The party's characters who may be the caller (no hirelings). */
  people: readonly CallerChoice[];
  /** The caller now (a character's id), or null for none. */
  caller: string | null;
  /** The circles are showing. */
  open: boolean;
  /** A press on the banner: opens the circles, or says why not. */
  onPress: () => void;
  onClose: () => void;
  onChoose: (id: string | null) => void;
}) {
  const name = people.find((p) => p.id === caller)?.name ?? 'No caller';
  return (
    <div className="caller">
      <button type="button" className="caller__banner" aria-label={`Caller: ${name}. Change the caller`} aria-expanded={open} onClick={onPress}>
        <span className="caller__mark" aria-hidden="true">
          <span className="caller__flourish" />
          <Icon name="knight-banner" size={52} />
          <span className="caller__flourish caller__flourish--right" />
        </span>
        <span className="caller__who" aria-hidden="true">
          <span className="caller__word">Caller</span> <b className="caller__name">{name}</b>
        </span>
      </button>
      {open && (
        <div className="caller__choose" role="group" aria-label="Choose the caller">
          <CloseButton onClose={onClose} className="caller__close" />
          <div className="caller__circles">
            {people.map((p) => (
              <button key={p.id} type="button" className={`caller__pick${p.id === caller ? ' caller__pick--now' : ''}`} aria-label={p.id === caller ? `${p.name}, the caller now` : p.name} onClick={() => onChoose(p.id)}>
                <span className="caller__disc" aria-hidden="true">
                  <Portrait db={db} campaignId={campaignId} assetId={p.portraitAssetId} name={p.name} initials={p.initials} size="medium" />
                </span>
                <span className="caller__pick-name" aria-hidden="true">
                  {p.name}
                </span>
              </button>
            ))}
            <button type="button" className={`caller__pick caller__pick--none${caller === null ? ' caller__pick--now' : ''}`} aria-label={caller === null ? 'No caller, the caller now' : 'No caller'} onClick={() => onChoose(null)}>
              <span className="caller__disc" aria-hidden="true">
                <span className="caller__empty" />
              </span>
              <span className="caller__pick-name" aria-hidden="true">
                No caller
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

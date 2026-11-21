// One exception on the GM's approval card (final drafts D, mockup creation/final/07): the sign and "Needs your special
// approval", the pick's name with the reason the creation record keeps, then Allow it and Take it off (a language
// only) or, once allowed, the line saying so. Drawn by `ApprovalRow` (GmCampaign.tsx) and the gallery's patron section.
import { WarningLine } from '../ui/parts.tsx';
import './GmCampaign.css';

export interface GmExceptionProps {
  exception: { name: string; requirement: string };
  /** Allow it was tapped: it goes with the GM's approval. */
  settled: boolean;
  onAllow: () => void;
  /** Take it off (a language only, for now); without it, the line pointing at Send back. */
  takeOff?: { busy: boolean; onTap: () => void };
  /** A weapon skill that is a specialisation: "<weapon>, to specialise in" (Design, 2026-11-10, #618's ⚑ 2). */
  specialising?: boolean;
  /** What allowing it costs, as the setting says it (a weapon outside the class, as-8): "If you allow it: <cost>." */
  cost?: string;
}

export function GmException({ exception: e, settled, onAllow, takeOff, specialising = false, cost = '' }: GmExceptionProps) {
  const named = `${e.name}${specialising ? ', to specialise in' : ''}`;
  return (
    <div className="gm__block gm__exception" role="group" aria-label={`Needs your special approval: ${e.name}`}>
      <p className="gm__row-name">
        <WarningLine>Needs your special approval</WarningLine>
      </p>
      <p className="gm__meta">{e.requirement ? `${named}: ${e.requirement}` : named}</p>
      {cost && <p className="gm__meta">If you allow it: {cost}.</p>}
      {settled ? (
        <p className="gm__meta" role="status">
          Allowed: it goes with your approval.
        </p>
      ) : (
        <div className="gm__actions">
          <button type="button" className="button-secondary" onClick={onAllow}>
            Allow it
          </button>
          {takeOff ? (
            <button type="button" className="button-secondary" onClick={takeOff.onTap}>
              {takeOff.busy ? 'Taking it off…' : 'Take it off'}
            </button>
          ) : (
            <span className="gm__meta">To change it, send it back with a note.</span>
          )}
        </div>
      )}
    </div>
  );
}

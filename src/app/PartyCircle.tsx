// The party circle (S12 of the whole-Scene plan; mc-1 to mc-3, mc-5, mc-6, mo-1; pictures R1 and page 16 T10): one
// character in the marching order. The portrait, or initials (two letters where they clash, mc-5); a lit light's ring
// draining round it in the lit-light glow, its halo still (mc-6), and a flame on its badge; the name; the hit points
// and their bar under it when the viewer may see them (mo-1, "Show each other's HP"); the light in words, or "No light"
// for a group in the dark; the statuses, each a symbol with its word (mc-2), the word dropping in a narrow circle on a
// phone (mc-3). The whole circle is one button that opens the character overview. No "You" tag (ds-12).
import type { Db } from '../core/supabase.ts';
import { hpSegments } from '../modules/characters/play.ts';
import { ringArc } from '../modules/expedition/statusLook.ts';
import { StatusIcon } from '../ui/icons.tsx';
import { HpBar } from '../ui/parts.tsx';
import { StatusRingMark } from '../ui/StatusRing.tsx';
import { Portrait } from './Portrait.tsx';
import type { RingView } from './statusRings.ts';
import './PartyCircle.css';

export interface CircleLight {
  name: string;
  /** The share left, 0 to 1 (1: a light that never runs out). */
  fraction: number;
  /** "Torch, 4 turns". */
  line: string;
  /** Near its end: the ring in the warning colour. */
  low: boolean;
}

/** The light's ring, drawn in a 100-unit box with a 5-unit stroke (the Status ring's maths, `ringArc`). */
const RING_BOX = 100;
const RING_STROKE = 5;

export function PartyCircle({
  db,
  campaignId,
  name,
  initials,
  portraitAssetId,
  light,
  dark,
  hp,
  statuses,
  label,
  onOpen,
}: {
  db: Db;
  campaignId: string;
  name: string;
  initials: string;
  portraitAssetId: string | null;
  light: CircleLight | null;
  /** The group is in darkness and this character carries no light: "No light" under the name. */
  dark: boolean;
  /** Null when this viewer may not see them, or the character has no maximum; `current` null: not set ("—"). */
  hp: { current: number | null; max: number } | null;
  statuses: readonly RingView[];
  /** What a screen reader hears for the whole circle. */
  label: string;
  onOpen: () => void;
}) {
  const bar = hp ? hpSegments(hp.current, hp.max) : null;
  const fills = bar?.fills ?? [];
  // Past 20 segments the rule gives one continuous bar (one fill a whole most): drawn whole, not as one pip.
  const wholeBar = !!bar && !!hp && fills.length === 1 && bar.per === hp.max && hp.max > 1;
  const arc = light ? ringArc(light.fraction, RING_BOX, RING_STROKE) : null;
  return (
    <button type="button" className={`party-circle${light ? ' party-circle--lit' : ''}${light?.low ? ' party-circle--low' : ''}`} onClick={onOpen} aria-label={label}>
      <span className="party-circle__mark" aria-hidden="true">
        {light && <span className="party-circle__halo" />}
        <span className="party-circle__disc">
          <Portrait db={db} campaignId={campaignId} assetId={portraitAssetId} name={name} initials={initials} size="large" />
        </span>
        {arc && (
          <svg className="party-circle__ring" viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}>
            <circle className="party-circle__track" cx={RING_BOX / 2} cy={RING_BOX / 2} r={arc.radius} strokeWidth={RING_STROKE} />
            <circle className="party-circle__arc" cx={RING_BOX / 2} cy={RING_BOX / 2} r={arc.radius} strokeWidth={RING_STROKE} strokeDasharray={arc.dash} />
          </svg>
        )}
        {light && (
          <span className="party-circle__badge">
            <StatusIcon name="flame" size={16} />
          </span>
        )}
      </span>
      <span className="party-circle__name" aria-hidden="true">
        {name.split(' ').map((word, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <span className="party-circle__word">{word}</span>
          </span>
        ))}
      </span>
      {hp && (
        <span className="party-circle__hp" aria-hidden="true">
          <span>
            {/* Not set: "—", as the HP box shows it. */}
            <b className="party-circle__hp-now">{hp.current ?? '—'}</b> of {hp.max}
          </span>
          <HpBar fills={fills} small whole={wholeBar} />
        </span>
      )}
      {light ? (
        <span className="party-circle__line" aria-hidden="true">
          {light.line}
        </span>
      ) : dark ? (
        // A dark group's circles read "◑ No light", symbol and words (SC-g6-2).
        <span className="party-circle__line" aria-hidden="true">
          ◑ No light
        </span>
      ) : null}
      {statuses.length > 0 && (
        <span className="party-circle__statuses" aria-hidden="true">
          {statuses.map((s, i) => {
            // The count stays when the word drops (mc-3): "Exhausted ×2" is the word and "×2".
            const [, word = s.name, count] = /^(.*?)( ×\d+)?$/.exec(s.name) ?? [];
            return (
              <span key={i} className="party-circle__status">
                {/* The Status ring's mark, variant bare: its symbol in its tone, or its letter in ink. */}
                <StatusRingMark name={word} icon={s.icon} tone={s.tone} fraction={null} bare />
                <span className="party-circle__status-word">{word}</span>
                {count && <span className="party-circle__count">{count.trim()}</span>}
              </span>
            );
          })}
        </span>
      )}
    </button>
  );
}

// The Status ring (06 Components, new 2026-11-08; plan m5b-creation-retest-3 F; rulings R3-6; mockups
// players/02-status-rings and players/03-status-symbols). A 52 px ring whose arc is the time left over the full span,
// in its tone's colour token (light: glow; harm: danger; boon: info; neutral: ink), the status's symbol in the middle
// in the same colour (its first letter when the pack names no symbol of the set), the name (two lines at most, then …)
// and the time left in words under it: a 72 × 88 px tile, the tap that opens its sheet. No end: a dashed track and no
// arc. In the sheet the same ring at 84 px with a 7 px stroke. Never colour alone: the symbol and the words go with it.
// The light's ring (lt-2, page 35): the ring as a tap over its verb (`StatusRingTap`), and still when not burning.
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { StatusIcon } from './icons.tsx';
import { RING_SIZES, ringArc, ringLetter, symbolNameOf, TONE_TOKEN, toneOf } from '../modules/expedition/statusLook.ts';
import './StatusRing.css';

export interface RingLook {
  /** The status's name as shown (its level's name for one with levels). */
  name: string;
  /** The condition's `icon`: one of the 25 symbols; anything else shows the first letter. */
  icon?: string | null;
  /** The condition's `tone`: light, harm, boon or neutral (the default). */
  tone?: string | null;
  /** The arc's share, 0 to 1 (`ringFraction`); null for no arc (no end, or a time this viewer doesn't get). */
  fraction: number | null;
  /** No end: the track dashed, no arc. */
  endless?: boolean;
}

/** The status symbols' stroke, in the 24-unit drawing (icons.tsx). */
const SYMBOL_STROKE = 2;

/**
 * Fits a symbol's drawing to its box (ruled 2026-11-08: the symbol centred, about half the ring's diameter): the
 * symbols are drawn on a 24-unit grid and some sit small or off-centre in it (the flame), so the box's viewBox is set
 * to a square around the drawing itself, stroke included, with the stroke scaled to stay the width it is at 24.
 * A browser without getBBox (the test DOM) keeps the drawing's own grid.
 */
export function fitSymbol(svg: SVGSVGElement | null | undefined) {
  if (!svg || typeof svg.getBBox !== 'function') return;
  const box = svg.getBBox();
  const widest = Math.max(box.width, box.height);
  if (!(widest > 0)) return;
  // The stroke runs half outside the drawing on each side, and scales with the side: side = widest + stroke × side / 24.
  const side = widest / (1 - SYMBOL_STROKE / 24);
  const x = box.x + box.width / 2 - side / 2;
  const y = box.y + box.height / 2 - side / 2;
  svg.setAttribute('viewBox', `${x} ${y} ${side} ${side}`);
  svg.setAttribute('stroke-width', String((SYMBOL_STROKE * side) / 24));
}

/** The bare variant's symbol box (S12: under a party circle's name, beside the status's word). */
const BARE_SYMBOL = 18;

/**
 * The ring alone (with its symbol): the tile's, or the sheet's big one. Decorative: the words beside it say it all.
 * Variant **bare** (S12, the party circle): the symbol alone in its tone, no ring, fitted the same way; with no symbol
 * named, its letter in ink (text, so never in a tone under 4.5:1).
 */
export function StatusRingMark({
  name,
  icon,
  tone,
  fraction,
  endless = false,
  big = false,
  bare = false,
  still = null,
}: RingLook & { big?: boolean; bare?: boolean; still?: RingStill | null }) {
  const { size, stroke, symbol } = big ? RING_SIZES.big : RING_SIZES.tile;
  const symbolBox = useRef<HTMLSpanElement>(null);
  const symbolName = symbolNameOf(icon);
  useLayoutEffect(() => fitSymbol(symbolBox.current?.querySelector('svg')), [symbolName, symbol, bare, still]);
  // A still light (lt-4, lt-5): the track alone, no arc and never dashed, the symbol in the muted colour.
  const shown = endless || still ? null : fraction;
  const arc = ringArc(shown ?? 0, size, stroke);
  const toned = toneOf(tone);
  const style = { '--ring-tone': `var(${still ? '--muted' : TONE_TOKEN[toned]})` } as CSSProperties;
  const centre = size / 2;
  if (bare) {
    return (
      <span className="status-ring__mark status-ring__mark--bare" style={style} data-tone={toned} aria-hidden="true">
        <span className="status-ring__symbol" ref={symbolBox}>
          {symbolName ? <StatusIcon name={symbolName} size={BARE_SYMBOL} /> : <span className="status-ring__letter status-ring__letter--bare">{ringLetter(name)}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className={big ? 'status-ring__mark status-ring__mark--big' : 'status-ring__mark'} style={style} data-tone={toned} aria-hidden="true">
      <svg className="status-ring__svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size} focusable="false">
        <circle
          className={endless && !still ? 'status-ring__track status-ring__track--endless' : 'status-ring__track'}
          cx={centre}
          cy={centre}
          r={arc.radius}
          strokeWidth={stroke}
        />
        {shown !== null && shown > 0 && <circle className="status-ring__arc" cx={centre} cy={centre} r={arc.radius} strokeWidth={stroke} strokeDasharray={arc.dash} />}
      </svg>
      <span className="status-ring__symbol" ref={symbolBox}>
        {still === 'out' ? (
          <StruckFlame size={symbol} />
        ) : symbolName ? (
          <StatusIcon name={symbolName} size={symbol} />
        ) : (
          <span className={big ? 'status-ring__letter status-ring__letter--big' : 'status-ring__letter'}>{ringLetter(name)}</span>
        )}
      </span>
    </span>
  );
}

/**
 * A light's ring when it isn't burning (lt-4, lt-5; page 35): `unlit`, the track alone and the symbol muted; `out`
 * (burnt out), the flame struck through, muted. Neither is a status, so the struck flame is not one of the symbols.
 */
export type RingStill = 'unlit' | 'out';

/** The flame struck through (page 35, scene.js's `flameout`): the status flame's drawing and one stroke across it. */
function StruckFlame({ size }: { size: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {/* The same path as the status symbol `flame` (icons.tsx). */}
      <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.2-3.3C9.5 9 10.5 10 11 10.5 11 8 11 5.5 12 3z" />
      <path d="M4 21L20 3" />
    </svg>
  );
}

/**
 * Variant **ring as a tap** (lt-2; page 35): the 52 px ring over its verb ("Put out", "Light", "Light…"), one button
 * with no edge, 72 by 76 px, the verb in the stacked button's word style, the rows' press flash. The verb is what tells
 * it from the head's rings, which open details. `label` is what a screen reader hears ("Put out Storm lantern").
 */
export function StatusRingTap({
  verb,
  label,
  onTap,
  opensPick = false,
  ...look
}: RingLook & { verb: string; label: string; onTap: () => void; opensPick?: boolean; still?: RingStill | null }) {
  return (
    <button type="button" className="status-ring-tap" aria-label={label} aria-haspopup={opensPick ? 'dialog' : undefined} onClick={onTap}>
      <StatusRingMark {...look} />
      <span className="status-ring-tap__verb" aria-hidden="true">
        {verb}
      </span>
    </button>
  );
}

/**
 * A status as its tile: the ring, the name, the time left in words; the whole tile is the tap. `label` is what a
 * screen reader hears ("Blessed, 3 turns left. Details").
 */
export function StatusRing({ words, label, onOpen, layout = 'tile', ...look }: RingLook & { words: string; label: string; onOpen: () => void; layout?: RingLayout }) {
  const name = (
    <span className="status-ring__name" aria-hidden="true">
      {look.name}
    </span>
  );
  const time = words && (
    <span className="status-ring__words" aria-hidden="true">
      {words}
    </span>
  );
  return (
    <button type="button" className={layout === 'tile' ? 'status-ring' : `status-ring status-ring--${layout}`} aria-label={label} onClick={onOpen}>
      <StatusRingMark {...look} />
      {layout === 'tile' && (
        <>
          {name}
          {time}
        </>
      )}
      {layout === 'beside' && (
        <span className="status-ring__beside">
          {name}
          {time}
        </span>
      )}
    </button>
  );
}

/**
 * How a ring is laid out: `tile` (the 72 × 88 px tile, the words under the ring); `beside` (the Player screen's head
 * with one or two statuses, dec-13 C2, frame P2: the name and the time left in words at the ring's right); `bare` (the
 * head with three or more, frame P1: the ring alone, its name and time in its label and on the tap).
 */
export type RingLayout = 'tile' | 'beside' | 'bare';

/** The head's "+N" (dec-13 C2, frame P1): the statuses not in view, one tap away. */
export function StatusRingMore({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button type="button" className="status-ring-more" aria-label={`${count} more: see every status`} onClick={onOpen}>
      {`+${count}`}
    </button>
  );
}

/** The Statuses row: the tiles, wrapping 12 px apart. */
export function StatusRingRow({ children, label = 'Statuses' }: { children: ReactNode; label?: string }) {
  return (
    <div className="status-ring-row" role="group" aria-label={label}>
      {children}
    </div>
  );
}

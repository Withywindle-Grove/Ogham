// How a status looks as a Status ring (plan m5b-creation-retest-3 F; rulings R3-6; mockups players/02-status-rings and
// players/03-status-symbols, approved 2026-11-08). Pure, and plain enough for the pack checker to import too
// (scripts/pack-descriptions.mjs): the symbol names a condition's `icon` may give, the tones its new `tone` may give
// and the colour token each tone draws in, and the arc's maths. The symbols' drawings are in src/ui/icons.tsx (StatusIcon).

/** The approved status symbols (players/03, 25 of them), a condition's `icon` (07 conditions). */
export const STATUS_SYMBOLS = [
  'flame',
  'star',
  'ghost',
  'shield',
  'arrow-forward',
  'arrow-back',
  'bolt',
  'eye-slash',
  'eye-half',
  'sun-slash',
  'lock',
  'chain',
  'bed',
  'moon',
  'stone',
  'spiral',
  'hand',
  'drop',
  'blot',
  'feather',
  'bread',
  'cup',
  'snowflake',
  'skull',
  'crack',
] as const;

export type StatusSymbolName = (typeof STATUS_SYMBOLS)[number];

/** A condition's `tone` (07 conditions, new 2026-11-08): the ring's colour. */
export const STATUS_TONES = ['light', 'harm', 'boon', 'neutral'] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

/** Each tone's colour token (R3-6): light the lit-light glow, harm danger, boon info, neutral ink. */
export const TONE_TOKEN: Record<StatusTone, string> = {
  light: '--light-glow',
  harm: '--danger',
  boon: '--info',
  neutral: '--ink',
};

/** A condition's `tone`, read leniently: one of the four, else neutral (ink). */
export function toneOf(value: unknown): StatusTone {
  return typeof value === 'string' && (STATUS_TONES as readonly string[]).includes(value) ? (value as StatusTone) : 'neutral';
}

/** A condition's `icon` as a status symbol, or null when it names none of the set (the ring shows the first letter). */
export function symbolNameOf(value: unknown): StatusSymbolName | null {
  return typeof value === 'string' && (STATUS_SYMBOLS as readonly string[]).includes(value) ? (value as StatusSymbolName) : null;
}

/** The letter in a ring with no symbol: the first letter of the name, upper case ("•" for a blank name). */
export function ringLetter(name: string): string {
  return (name.trim().charAt(0) || '•').toUpperCase();
}

/**
 * The arc's share of the ring: the time left over the full span, from 0 (run out: an empty ring) to 1; over the span
 * (extended past its start) a full ring. Null when there is nothing to measure (no end, or a time this viewer doesn't
 * get): the ring has no arc.
 */
export function ringFraction(left: number | null | undefined, span: number | null | undefined): number | null {
  if (left === null || left === undefined || !Number.isFinite(left)) return null;
  if (span === null || span === undefined || !Number.isFinite(span) || span <= 0) return null;
  return Math.max(0, Math.min(1, left / span));
}

/** The ring's circle at a size and stroke: its radius, its length, and the dash that draws the arc. */
export function ringArc(fraction: number, size: number, stroke: number): { radius: number; length: number; dash: string } {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const drawn = Math.max(0, Math.min(1, fraction)) * length;
  return { radius, length, dash: `${drawn.toFixed(2)} ${length.toFixed(2)}` };
}

/** The two sizes (R3-6, 10): the tile's 52 px ring with a 5 px stroke, and the sheet's 84 px ring with a 7 px stroke; the symbol's box is half the ring's diameter (ruled 2026-11-08). */
export const RING_SIZES = { tile: { size: 52, stroke: 5, symbol: 26 }, big: { size: 84, stroke: 7, symbol: 42 } } as const;

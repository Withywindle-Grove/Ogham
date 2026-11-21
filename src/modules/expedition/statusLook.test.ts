// How a status looks as a Status ring (plan m5b-creation-retest-3 F; rulings R3-6). Purposes:
//   The arc is the time left over the full span: 4 of 6 is two thirds, 0 is an empty ring, past the span a full ring,
//   and nothing to measure (no span, no time) is no arc at all.
//   The arc's dash is that share of the circle's length at the ring's size and stroke (52/5 and 84/7).
//   Each tone draws in its colour token: light → the glow, harm → danger, boon → info, neutral → ink; anything else
//   (or none) is neutral.
//   A condition's icon names one of the 25 approved symbols; any other name is no symbol, and the ring shows the
//   first letter of the name instead.
import { describe, expect, it } from 'vitest';
import { RING_SIZES, ringArc, ringFraction, ringLetter, STATUS_SYMBOLS, STATUS_TONES, symbolNameOf, TONE_TOKEN, toneOf } from './statusLook.ts';

describe('the arc', () => {
  it('is the time left over the full span: 4 of 6 is two thirds', () => {
    expect(ringFraction(4, 6)).toBeCloseTo(2 / 3);
    expect(ringFraction(2400, 3600)).toBeCloseTo(2 / 3);
  });

  it('is empty at 0 left, and full (never more) past the span', () => {
    expect(ringFraction(0, 6)).toBe(0);
    expect(ringFraction(999, 6)).toBe(1);
    expect(ringFraction(999, 999)).toBe(1);
  });

  it('has nothing to measure without a span or a time left', () => {
    expect(ringFraction(null, 6)).toBeNull();
    expect(ringFraction(3, null)).toBeNull();
    expect(ringFraction(3, 0)).toBeNull();
  });

  it("draws that share of the circle's length at the tile's and the sheet's sizes", () => {
    const tile = ringArc(2 / 3, RING_SIZES.tile.size, RING_SIZES.tile.stroke);
    expect(tile.radius).toBe(23.5);
    const [drawn, length] = tile.dash.split(' ').map(Number);
    expect(drawn! / length!).toBeCloseTo(2 / 3, 3);
    expect(length).toBeCloseTo(2 * Math.PI * 23.5, 1);
    expect(ringArc(1, RING_SIZES.big.size, RING_SIZES.big.stroke).radius).toBe(38.5);
    expect(ringArc(0, 52, 5).dash.startsWith('0.00 ')).toBe(true);
  });
});

describe('tones', () => {
  it('map to their colour tokens: light the glow, harm danger, boon info, neutral ink', () => {
    expect(TONE_TOKEN).toEqual({ light: '--light-glow', harm: '--danger', boon: '--info', neutral: '--ink' });
    expect([...STATUS_TONES]).toEqual(['light', 'harm', 'boon', 'neutral']);
  });

  it('read anything else, or none, as neutral (ink)', () => {
    expect(toneOf('harm')).toBe('harm');
    for (const odd of [undefined, null, '', 'spooky', 'Harm', 3]) expect(toneOf(odd)).toBe('neutral');
  });
});

describe('symbols', () => {
  it('are the approved 25, each named once', () => {
    expect(STATUS_SYMBOLS).toHaveLength(25);
    expect(new Set(STATUS_SYMBOLS).size).toBe(25);
    expect(symbolNameOf('drop')).toBe('drop');
    expect(symbolNameOf('arrow-forward')).toBe('arrow-forward');
  });

  it('fall back to the first letter of the name when the icon names none of them', () => {
    expect(symbolNameOf('no-such-symbol')).toBeNull();
    expect(symbolNameOf(null)).toBeNull();
    expect(ringLetter('muddy boots')).toBe('M');
    expect(ringLetter('  ')).toBe('•');
  });
});

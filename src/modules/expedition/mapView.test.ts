// The map's view arithmetic (December step 7, pieces 5 and 8, the arithmetic only): fit, opened on the party (mc-37),
// zoom about a point and pan (mc-43), back to the party or to Fit, and a tap told from a drag (dp-1). Sizes are made up.
import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  TAP_MAX_DISTANCE,
  TAP_MAX_MS,
  ZOOM_STEP,
  clampView,
  fitView,
  isFitted,
  KEY_PAN_SHARE,
  mapKeyAction,
  maxScale,
  minScale,
  pan,
  partyView,
  touchKind,
  wheelFactor,
  zoomAbout,
  zoomIn,
  zoomOut,
  zoomPercent,
  type View,
} from './mapView.ts';

const close = (a: View, b: View) => {
  expect(a.scale).toBeCloseTo(b.scale, 9);
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};
/** Where a picture point lands in the frame. */
const onScreen = (v: View, p: { x: number; y: number }) => ({ x: v.x + p.x * v.scale, y: v.y + p.y * v.scale });

describe('Fit', () => {
  // Purpose: a wide picture in a tall frame fits its width and is centred top to bottom, whole and uncropped.
  it('fits a wide picture to a tall frame’s width, centred vertically', () => {
    const v = fitView({ width: 2000, height: 1000 }, { width: 400, height: 800 });
    close(v, { scale: 0.2, x: 0, y: 300 });
  });

  // Purpose: a tall picture in a wide frame fits its height and is centred left to right.
  it('fits a tall picture to a wide frame’s height, centred horizontally', () => {
    const v = fitView({ width: 1000, height: 2000 }, { width: 800, height: 400 });
    close(v, { scale: 0.2, x: 300, y: 0 });
  });

  // Purpose: a picture smaller than the frame is shown at its own size, centred, unless the caller asks to enlarge it.
  it('never enlarges a small picture unless asked', () => {
    close(fitView({ width: 200, height: 100 }, { width: 800, height: 400 }), { scale: 1, x: 300, y: 150 });
    close(fitView({ width: 200, height: 100 }, { width: 800, height: 400 }, { enlarge: true }), { scale: 4, x: 0, y: 0 });
  });

  // Purpose: zero or negative sizes never divide by zero: the view is plain and finite.
  it('gives a plain, finite view for zero sizes', () => {
    for (const [picture, frame] of [
      [{ width: 0, height: 0 }, { width: 400, height: 300 }],
      [{ width: 400, height: 300 }, { width: 0, height: 0 }],
      [{ width: 0, height: 100 }, { width: 0, height: 100 }],
    ] as const) {
      const v = fitView(picture, frame);
      expect(v).toEqual({ scale: 1, x: 0, y: 0 });
      expect(Number.isFinite(minScale(picture, frame)) && Number.isFinite(maxScale(picture, frame))).toBe(true);
      for (const w of [zoomIn(v, picture, frame), pan(v, 50, 50, picture, frame), partyView(picture, frame, { x: 10, y: 10 }, 1)]) {
        expect(Number.isFinite(w.scale) && Number.isFinite(w.x) && Number.isFinite(w.y)).toBe(true);
      }
    }
  });
});

describe('Opened on the party (mc-37)', () => {
  const picture = { width: 2000, height: 1500 };
  const frame = { width: 400, height: 300 };

  // Purpose: with the party in the middle, the point sits at the frame's centre.
  it('centres on the party in the middle', () => {
    const v = partyView(picture, frame, { x: 1000, y: 750 }, 1);
    expect(v.scale).toBe(1);
    expect(onScreen(v, { x: 1000, y: 750 })).toEqual({ x: 200, y: 150 });
  });

  // Purpose: with the party at a corner, the view is clamped so the frame shows no space beyond the picture's edge.
  it('clamps at a corner so nothing beyond the picture shows', () => {
    close(partyView(picture, frame, { x: 0, y: 0 }, 1), { scale: 1, x: 0, y: 0 });
    close(partyView(picture, frame, { x: 2000, y: 1500 }, 1), { scale: 1, x: 400 - 2000, y: 300 - 1500 });
  });

  // Purpose: on an axis where the picture is smaller than the frame, it is centred on that axis.
  it('centres an axis where the picture is smaller than the frame', () => {
    const v = partyView({ width: 2000, height: 100 }, frame, { x: 1000, y: 0 }, 1);
    expect(v.y).toBe(100);
    expect(v.x).toBe(200 - 1000);
  });

  // Purpose: with no party point known, the view is Fit.
  it('is Fit with no party point', () => {
    close(partyView(picture, frame, null, 1), fitView(picture, frame));
    close(partyView(picture, frame, undefined, 1), fitView(picture, frame));
  });

  // Purpose: the starting zoom is kept within the smallest (Fit) and the largest.
  it('keeps the starting zoom between Fit and the largest', () => {
    expect(partyView(picture, frame, { x: 1000, y: 750 }, 0.01).scale).toBe(minScale(picture, frame));
    expect(partyView(picture, frame, { x: 1000, y: 750 }, 99).scale).toBe(MAX_ZOOM);
  });
});

describe('Zoom and pan (mc-43)', () => {
  const picture = { width: 2000, height: 1500 };
  const frame = { width: 400, height: 300 };
  const middle = { x: 200, y: 150 };

  // Purpose: zooming in then out about the frame's middle returns to the same view.
  it('zoom in then out returns to the same view', () => {
    const start = partyView(picture, frame, { x: 1000, y: 750 }, 0.5);
    close(zoomOut(zoomIn(start, picture, frame, middle), picture, frame, middle), start);
    expect(zoomIn(start, picture, frame, middle).scale).toBeCloseTo(0.5 * ZOOM_STEP, 9);
  });

  // Purpose: the picture point under a pinch's midpoint stays under it.
  it('keeps the point under a pinch where it was', () => {
    const start = partyView(picture, frame, { x: 1000, y: 750 }, 0.5);
    const pinch = { x: 120, y: 90 };
    const under = { x: (pinch.x - start.x) / start.scale, y: (pinch.y - start.y) / start.scale };
    const after = zoomAbout(start, 1.3, pinch, picture, frame);
    expect(onScreen(after, under).x).toBeCloseTo(pinch.x, 9);
    expect(onScreen(after, under).y).toBeCloseTo(pinch.y, 9);
  });

  // Purpose: zoom never goes below Fit nor above the largest.
  it('never zooms below Fit nor above the largest', () => {
    let v = fitView(picture, frame);
    for (let i = 0; i < 20; i++) v = zoomOut(v, picture, frame, middle);
    expect(v.scale).toBe(minScale(picture, frame));
    close(v, fitView(picture, frame));
    for (let i = 0; i < 20; i++) v = zoomIn(v, picture, frame, middle);
    expect(v.scale).toBe(MAX_ZOOM);
    expect(maxScale(picture, frame)).toBe(MAX_ZOOM);
  });

  // Purpose: the largest zoom is never below Fit (a small picture enlarged to fit can still be zoomed no smaller).
  it('lifts the largest zoom to Fit when Fit is larger', () => {
    const small = { width: 20, height: 15 };
    expect(maxScale(small, frame, { enlarge: true })).toBe(minScale(small, frame, { enlarge: true }));
  });

  // Purpose: a pan cannot take the picture's edge inside the frame.
  it('pans no further than the picture’s edge', () => {
    const v = partyView(picture, frame, { x: 1000, y: 750 }, 1);
    close(pan(v, 99999, 99999, picture, frame), { scale: 1, x: 0, y: 0 });
    close(pan(v, -99999, -99999, picture, frame), { scale: 1, x: 400 - 2000, y: 300 - 1500 });
    const moved = pan(v, 30, -20, picture, frame);
    expect(moved.x - v.x).toBe(30);
    expect(moved.y - v.y).toBe(-20);
  });

  // Purpose: at Fit a pan moves nothing, the whole picture being in view.
  it('pans nothing at Fit', () => {
    const v = fitView(picture, frame);
    close(pan(v, 80, 80, picture, frame), v);
  });

  // Purpose: clamping a view already inside the picture changes nothing.
  it('leaves a view inside the picture as it is', () => {
    const v = { scale: 1, x: -500, y: -400 };
    expect(clampView(v, picture, frame)).toEqual(v);
  });
});

describe('Back to the party, and Fit', () => {
  // Purpose: after zooming and panning, the two buttons return to the party's view and to Fit.
  it('returns to the party’s view and to Fit', () => {
    const picture = { width: 2000, height: 1500 };
    const frame = { width: 400, height: 300 };
    const party = partyView(picture, frame, { x: 600, y: 500 }, 1);
    const wandered = pan(zoomIn(party, picture, frame, { x: 10, y: 10 }), -300, 200, picture, frame);
    expect(wandered).not.toEqual(party);
    close(partyView(picture, frame, { x: 600, y: 500 }, 1), party);
    close(fitView(picture, frame), { scale: 0.2, x: 0, y: 0 });
  });
});

describe('A tap told from a drag (dp-1)', () => {
  const at = (x: number, y: number, t: number) => ({ x, y, t });

  // Purpose: 9 px in 0.3 s is a tap; 11 px is a drag; 5 px held 0.7 s is a drag.
  it('reads 9 px in 0.3 s as a tap, 11 px or 0.7 s as a drag', () => {
    expect(touchKind(at(100, 100, 0), at(109, 100, 300))).toBe('tap');
    expect(touchKind(at(100, 100, 0), at(111, 100, 300))).toBe('drag');
    expect(touchKind(at(100, 100, 0), at(103, 104, 700))).toBe('drag');
  });

  // Purpose: the limits are the named constants: exactly at them is still a tap.
  it('counts a touch exactly at the limits as a tap', () => {
    expect(TAP_MAX_DISTANCE).toBe(10);
    expect(TAP_MAX_MS).toBe(500);
    expect(touchKind(at(0, 0, 0), at(6, 8, 500))).toBe('tap');
  });
});

describe('The pop-up’s figure, its Fit mark, its keys and its wheel (dec-7 piece 5a; mc-43, mc-43a, M3 to M5)', () => {
  const picture = { width: 2000, height: 1500 };
  const frame = { width: 400, height: 300 };

  // Purpose: the figure is the picture's own size, so a 2,000 px map fitted into 400 px reads 20%, and twice its size 200%.
  it('reads the zoom as a whole percentage of the picture’s own size', () => {
    expect(zoomPercent(fitView(picture, frame))).toBe('20%');
    expect(zoomPercent({ scale: 2, x: 0, y: 0 })).toBe('200%');
    expect(zoomPercent({ scale: 0.704, x: 0, y: 0 })).toBe('70%');
  });

  // Purpose: Fit is marked as the current view only at Fit's zoom; one magnifier step in, it is not; zoomed back out, it is again.
  it('knows when the view is Fit’s', () => {
    const fitted = fitView(picture, frame);
    expect(isFitted(fitted, picture, frame)).toBe(true);
    const closer = zoomIn(fitted, picture, frame);
    expect(isFitted(closer, picture, frame)).toBe(false);
    expect(isFitted(zoomOut(closer, picture, frame), picture, frame)).toBe(true);
  });

  // Purpose: + and = zoom in, − and _ zoom out, 0 is Fit; an arrow shows more of the map its way, a tenth of the frame.
  it('reads the map’s keys', () => {
    expect(mapKeyAction('+', frame)).toEqual({ kind: 'in' });
    expect(mapKeyAction('=', frame)).toEqual({ kind: 'in' });
    expect(mapKeyAction('-', frame)).toEqual({ kind: 'out' });
    expect(mapKeyAction('_', frame)).toEqual({ kind: 'out' });
    expect(mapKeyAction('0', frame)).toEqual({ kind: 'fit' });
    expect(KEY_PAN_SHARE).toBe(0.1);
    expect(mapKeyAction('ArrowRight', frame)).toEqual({ kind: 'pan', dx: -40, dy: 0 });
    expect(mapKeyAction('ArrowLeft', frame)).toEqual({ kind: 'pan', dx: 40, dy: 0 });
    expect(mapKeyAction('ArrowDown', frame)).toEqual({ kind: 'pan', dx: 0, dy: -30 });
    expect(mapKeyAction('ArrowUp', frame)).toEqual({ kind: 'pan', dx: 0, dy: 30 });
  });

  // Purpose: other keys, and the browser's own zoom (Ctrl or ⌘ with + or −), are left to the browser.
  it('leaves other keys and the browser’s zoom alone', () => {
    expect(mapKeyAction('a', frame)).toBeNull();
    expect(mapKeyAction('Enter', frame)).toBeNull();
    expect(mapKeyAction('+', frame, { ctrl: true })).toBeNull();
    expect(mapKeyAction('-', frame, { meta: true })).toBeNull();
    expect(mapKeyAction('0', frame, { alt: true })).toBeNull();
  });

  // Purpose: the wheel turned away zooms in, towards you zooms out, a notch about a tenth; a broken delta does nothing.
  it('turns a wheel’s notch into a gentle zoom', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1.1);
    expect(wheelFactor(-100)).toBeLessThan(1.11);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(Number.NaN)).toBe(1);
  });
});

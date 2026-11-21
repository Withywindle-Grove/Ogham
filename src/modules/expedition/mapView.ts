// The map's view arithmetic (December step 7, pieces 5 and 8, the arithmetic only; docs/plans/dec-7-linked-spots-screens.md):
// the map pop-up opens fitted, then zooms about a point and pans, with Fit to return (mc-43); the players' frame opens on
// where the party is, moved by drag and pinch, with a way back to them (mc-37); a touch is a tap or a drag (dp-1).
// Pure: every size is a plain number given in, nothing reads the screen, and no view is ever stored here.
//
// A view places the picture in the frame: a picture point (px, py), in the picture's own pixels, shows at
// (x + px × scale, y + py × scale) in the frame. A pack's map keys are fractions of the picture (pf-8,
// `images[].keys[].x/y`); the caller multiplies them by the picture's width and height before passing a point in.

export interface Size {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface View {
  /** Frame pixels per picture pixel. */
  scale: number;
  /** Where the picture's top-left corner sits in the frame. */
  x: number;
  y: number;
}
export interface FitOptions {
  /** Let Fit enlarge a picture smaller than the frame (by default it shows at its own size, centred). */
  enlarge?: boolean;
}

/** One magnifier tap zooms by this factor: three taps take a fitted map to over three times its size, each a clear step. */
export const ZOOM_STEP = 1.5;
/** The largest zoom, in frame pixels per picture pixel: twice the picture's own pixels, past which a map only blurs. */
export const MAX_ZOOM = 2;
/** A touch that lifts within this many pixels of where it started (dp-1, "about 10 px")… */
export const TAP_MAX_DISTANCE = 10;
/** …and within this many milliseconds (dp-1, "half a second") is a tap; anything further or longer is a drag. */
export const TAP_MAX_MS = 500;

const PLAIN: View = { scale: 1, x: 0, y: 0 };
const usable = (s: Size) => Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0;
const between = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high);

/** The smallest zoom: the one that shows the whole picture (Fit). 1 when a size is zero. */
export function minScale(picture: Size, frame: Size, options: FitOptions = {}): number {
  if (!usable(picture) || !usable(frame)) return 1;
  const whole = Math.min(frame.width / picture.width, frame.height / picture.height);
  return options.enlarge ? whole : Math.min(whole, 1);
}

/** The largest zoom: MAX_ZOOM, or Fit when Fit is already larger (a small picture enlarged to fit). */
export function maxScale(picture: Size, frame: Size, options: FitOptions = {}): number {
  return Math.max(MAX_ZOOM, minScale(picture, frame, options));
}

/** One axis: within the picture's edges where it's larger than the frame, centred where it's smaller. */
function clampAxis(offset: number, shown: number, frame: number): number {
  return shown >= frame ? between(offset, frame - shown, 0) : (frame - shown) / 2;
}

/** The view moved so the frame never shows beyond the picture's edge (centred on an axis where the picture is smaller). */
export function clampView(view: View, picture: Size, frame: Size): View {
  if (!usable(picture) || !usable(frame)) return PLAIN;
  return {
    scale: view.scale,
    x: clampAxis(view.x, picture.width * view.scale, frame.width),
    y: clampAxis(view.y, picture.height * view.scale, frame.height),
  };
}

/** Fit: the whole picture, centred, never cropped; never enlarged unless asked. */
export function fitView(picture: Size, frame: Size, options: FitOptions = {}): View {
  if (!usable(picture) || !usable(frame)) return PLAIN;
  return clampView({ scale: minScale(picture, frame, options), x: 0, y: 0 }, picture, frame);
}

/**
 * Opened on the party (mc-37), and where "back to where they are" returns: the party's point (in picture pixels) at
 * the frame's centre, at the starting zoom kept between Fit and the largest, then clamped. With no point, Fit.
 */
export function partyView(picture: Size, frame: Size, party: Point | null | undefined, zoom: number, options: FitOptions = {}): View {
  if (!usable(picture) || !usable(frame)) return PLAIN;
  if (!party || !Number.isFinite(party.x) || !Number.isFinite(party.y)) return fitView(picture, frame, options);
  const scale = between(Number.isFinite(zoom) ? zoom : 1, minScale(picture, frame, options), maxScale(picture, frame, options));
  return clampView({ scale, x: frame.width / 2 - party.x * scale, y: frame.height / 2 - party.y * scale }, picture, frame);
}

/**
 * Zoom by a factor about a point in the frame (a pinch's midpoint, or the frame's middle for the magnifiers): the
 * picture point under it stays under it, the zoom kept between Fit and the largest, then clamped.
 */
export function zoomAbout(view: View, factor: number, about: Point, picture: Size, frame: Size, options: FitOptions = {}): View {
  if (!usable(picture) || !usable(frame) || !(view.scale > 0)) return fitView(picture, frame, options);
  const scale = between(view.scale * (Number.isFinite(factor) && factor > 0 ? factor : 1), minScale(picture, frame, options), maxScale(picture, frame, options));
  const under = { x: (about.x - view.x) / view.scale, y: (about.y - view.y) / view.scale };
  return clampView({ scale, x: about.x - under.x * scale, y: about.y - under.y * scale }, picture, frame);
}

/** The plus magnifier: one ZOOM_STEP in, about the frame's middle unless a point is given. */
export function zoomIn(view: View, picture: Size, frame: Size, about?: Point, options: FitOptions = {}): View {
  return zoomAbout(view, ZOOM_STEP, about ?? { x: frame.width / 2, y: frame.height / 2 }, picture, frame, options);
}

/** The minus magnifier: one ZOOM_STEP out, about the frame's middle unless a point is given. */
export function zoomOut(view: View, picture: Size, frame: Size, about?: Point, options: FitOptions = {}): View {
  return zoomAbout(view, 1 / ZOOM_STEP, about ?? { x: frame.width / 2, y: frame.height / 2 }, picture, frame, options);
}

/** A drag's distance moves the picture with the finger, clamped. */
export function pan(view: View, dx: number, dy: number, picture: Size, frame: Size): View {
  return clampView({ scale: view.scale, x: view.x + (Number.isFinite(dx) ? dx : 0), y: view.y + (Number.isFinite(dy) ? dy : 0) }, picture, frame);
}

/** A touch's place and time, in frame pixels and milliseconds. */
export interface TouchMark {
  x: number;
  y: number;
  t: number;
}

/** A tap told from a drag (dp-1): within TAP_MAX_DISTANCE and TAP_MAX_MS of its start, a tap; else a drag. */
export function touchKind(start: TouchMark, end: TouchMark): 'tap' | 'drag' {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const held = end.t - start.t;
  return distance <= TAP_MAX_DISTANCE && held <= TAP_MAX_MS ? 'tap' : 'drag';
}

/** The figure beside the magnifiers (M4): the picture's own size is 100%, one picture pixel to one screen pixel. */
export function zoomPercent(view: View): string {
  return `${Math.round((Number.isFinite(view.scale) ? view.scale : 1) * 100)}%`;
}

/** Whether a view is Fit's (Fit then shows as the current view, M3): at Fit's zoom, within a hair. */
export function isFitted(view: View, picture: Size, frame: Size, options: FitOptions = {}): boolean {
  return view.scale <= minScale(picture, frame, options) * (1 + 1e-6);
}

/** One arrow key moves the picture this share of the frame's width or height. */
export const KEY_PAN_SHARE = 0.1;

export type MapKeyAction = { kind: 'in' } | { kind: 'out' } | { kind: 'fit' } | { kind: 'pan'; dx: number; dy: number };

/**
 * A key in the map pop-up (M5, a PC with a mouse): + (or =) zooms in, − (or _) zooms out, 0 is Fit, and an arrow
 * shows more of the map that way (the picture moves the other way, a tenth of the frame). Anything else, or a key held
 * with Ctrl, ⌘ or Alt (the browser's own zoom), is not the map's: null.
 */
export function mapKeyAction(key: string, frame: Size, modifiers: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}): MapKeyAction | null {
  if (modifiers.ctrl || modifiers.meta || modifiers.alt) return null;
  const stepX = Math.round((Number.isFinite(frame.width) ? frame.width : 0) * KEY_PAN_SHARE);
  const stepY = Math.round((Number.isFinite(frame.height) ? frame.height : 0) * KEY_PAN_SHARE);
  switch (key) {
    case '+':
    case '=':
      return { kind: 'in' };
    case '-':
    case '_':
    case '−':
      return { kind: 'out' };
    case '0':
      return { kind: 'fit' };
    case 'ArrowLeft':
      return { kind: 'pan', dx: stepX, dy: 0 };
    case 'ArrowRight':
      return { kind: 'pan', dx: -stepX, dy: 0 };
    case 'ArrowUp':
      return { kind: 'pan', dx: 0, dy: stepY };
    case 'ArrowDown':
      return { kind: 'pan', dx: 0, dy: -stepY };
    default:
      return null;
  }
}

/** The mouse wheel's zoom for one wheel event (M5): about a tenth a notch, in when the wheel turns away from you. */
export function wheelFactor(deltaY: number): number {
  return Number.isFinite(deltaY) ? Math.exp(-deltaY * 0.001) : 1;
}

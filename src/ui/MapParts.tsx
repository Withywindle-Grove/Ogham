// The map card and the map pop-up (December dec-7 piece 5a; plan docs/plans/dec-7-linked-spots-screens.md, row 5;
// rulings mc-31, mc-32, mc-43, mc-43a, mc-44, mc-44a; mockup december/01, frames 2 to 6, M1 to M6, 14 and 14c).
// Pure parts: they take a picture's address and show it, and know nothing of packs, places or who may see what.
//
// The picture is the pack's own, exactly as printed (mc-32): never drawn over, tinted, restyled or cropped. It is
// moved and scaled as a whole by the view arithmetic in mapView.ts (fit, zoom about a point, drag, Fit to return).
//
// The card (mc-44, mc-44a): the picture alone, no heading or caption; under it one row, the map's title at the left
// where the caller gives one and the tools at the right (zoom out, zoom in, then the caller's: the GM's eye or the
// players' locate). Its edge changes tone under the pointer and when pressed; a tap on the picture opens it whole, a
// drag moves it (a tap is a touch that lifts within about 10 px and half a second, dp-1).
//
// The pop-up (mc-43, mc-43a): opens fitted; zoom and drag; Fit to return, marked when fitted; the figure at the left
// of the two magnifiers; the mouse wheel zooms about the pointer, + and − zoom, the arrows move, 0 is Fit. While the
// picture is on its way, a still block; when it fails, one plain sentence and Try again. No tools under either.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampView,
  fitView,
  isFitted,
  mapKeyAction,
  pan,
  touchKind,
  wheelFactor,
  zoomAbout,
  zoomIn,
  zoomOut,
  zoomPercent,
  TAP_MAX_DISTANCE,
  type FitOptions,
  type Point,
  type Size,
  type View,
} from '../modules/expedition/mapView.ts';
import { Dialog } from './Dialog.tsx';
import { WarningLine } from './parts.tsx';
import './MapParts.css';

const NO_SIZE: Size = { width: 0, height: 0 };

/** Where the picture is: its address, or null while the caller is still fetching it; `failed` when that fetch failed. */
export interface MapSource {
  src: string | null;
  /** The picture's words for a screen reader ("The Drowned Harbour, the pack's map"). */
  alt: string;
  failed?: boolean;
}

type Load = 'loading' | 'ready' | 'failed';

/**
 * One map's view: the picture's and the frame's sizes as they're measured, and the view (Fit's until zoomed; Fit
 * again when zoomed back out to it). Fit follows the frame when it changes size; a zoomed view is kept and clamped.
 */
function useMapView(options: FitOptions) {
  const [picture, setPicture] = useState<Size>(NO_SIZE);
  const [frame, setFrame] = useState<Size>(NO_SIZE);
  // null: fitted. Otherwise the view as last zoomed or moved.
  const [zoomed, setZoomed] = useState<View | null>(null);
  const enlarge = options.enlarge ?? false;
  const fit = fitView(picture, frame, { enlarge });
  const view = zoomed ? clampView(zoomed, picture, frame) : fit;
  const fitted = zoomed === null || isFitted(view, picture, frame, { enlarge });
  const keep = useCallback(
    (next: View) => setZoomed(isFitted(next, picture, frame, { enlarge }) ? null : next),
    [picture, frame, enlarge],
  );
  return {
    picture,
    setPicture,
    frame,
    setFrame,
    view,
    fitted,
    toFit: () => setZoomed(null),
    zoomIn: (about?: Point) => keep(zoomIn(view, picture, frame, about, { enlarge })),
    zoomOut: (about?: Point) => keep(zoomOut(view, picture, frame, about, { enlarge })),
    zoomBy: (factor: number, about: Point, from: View = view) => keep(zoomAbout(from, factor, about, picture, frame, { enlarge })),
    /** A view zoomed from another, without keeping it (a pinch then moves it with its middle). */
    zoomed: (from: View, factor: number, about: Point) => zoomAbout(from, factor, about, picture, frame, { enlarge }),
    moveBy: (dx: number, dy: number, from: View = view) => keep(pan(from, dx, dy, picture, frame)),
  };
}
type MapViewState = ReturnType<typeof useMapView>;

/** The two magnifiers (mc-43): zoom out, then zoom in, square 44 px buttons with their icons. */
function Magnifiers({ map }: { map: MapViewState }) {
  return (
    <>
      <button type="button" className="button-secondary map-tool" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <MagnifierIcon plus={false} />
      </button>
      <button type="button" className="button-secondary map-tool" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <MagnifierIcon plus />
      </button>
    </>
  );
}

/** A magnifying glass with a minus or a plus in its lens (the mockup's MAG): decorative, the button says what it does. */
function MagnifierIcon({ plus }: { plus: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5l4.5 4.5" />
      <path d={plus ? 'M8 10.5h5M10.5 8v5' : 'M8 10.5h5'} />
    </svg>
  );
}

/**
 * The picture in its frame: measured, placed by the view, moved by a drag or a pinch. On the card it is a button (a
 * tap, or Enter, opens it whole); in the pop-up it is the picture alone, and the wheel zooms about the pointer.
 */
function MapPicture({
  source,
  map,
  load,
  setLoad,
  onOpen,
  wheel = false,
  attempt,
}: {
  source: MapSource;
  map: MapViewState;
  load: Load;
  setLoad: (load: Load) => void;
  /** The card's: a tap opens the map whole. Without it the frame is the picture alone (the pop-up). */
  onOpen?: () => void;
  wheel?: boolean;
  attempt: number;
}) {
  const frameRef = useRef<HTMLElement | null>(null);
  const { setFrame, setPicture } = map;
  // The frame's size, now and whenever it changes.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    watch?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [setFrame, load]);

  // The touches on the frame: where each started and is now; whether this one has become a drag.
  const touches = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: Point & { t: number }; dragged: boolean; from: View; pinch: { distance: number; mid: Point } | null } | null>(null);
  const [pressed, setPressed] = useState(false);
  // The latest view and sizes, for the handlers that outlive a render (a drag's moves, the wheel, the keys).
  const latest = useRef(map);
  useLayoutEffect(() => {
    latest.current = map;
  });

  const local = (event: { clientX: number; clientY: number }): Point => {
    const box = frameRef.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (load !== 'ready' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const at = local(event);
    touches.current.set(event.pointerId, at);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (touches.current.size === 1) {
      gesture.current = { start: { ...at, t: event.timeStamp }, dragged: false, from: latest.current.view, pinch: null };
      setPressed(true);
    } else if (touches.current.size === 2 && gesture.current) {
      // Two fingers are always a pinch (14c): never a tap.
      const [a, b] = [...touches.current.values()] as [Point, Point];
      gesture.current = { ...gesture.current, dragged: true, from: latest.current.view, pinch: { distance: Math.hypot(b.x - a.x, b.y - a.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } };
      setPressed(false);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || !touches.current.has(event.pointerId)) return;
    const at = local(event);
    touches.current.set(event.pointerId, at);
    if (g.pinch && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()] as [Point, Point];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const factor = g.pinch.distance > 0 ? distance / g.pinch.distance : 1;
      // Zoomed about where the pinch began, then moved with its middle.
      const m = latest.current;
      const scaled = m.zoomed(g.from, factor, g.pinch.mid);
      m.moveBy(mid.x - g.pinch.mid.x, mid.y - g.pinch.mid.y, scaled);
      return;
    }
    const dx = at.x - g.start.x;
    const dy = at.y - g.start.y;
    // The pressed look ends the moment a touch starts to travel (14c); until then it may still be a tap.
    if (!g.dragged && Math.hypot(dx, dy) <= TAP_MAX_DISTANCE) return;
    if (!g.dragged) {
      g.dragged = true;
      setPressed(false);
    }
    latest.current.moveBy(dx, dy, g.from);
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    touches.current.delete(event.pointerId);
    if (!g) return;
    if (touches.current.size > 0) {
      // A pinch lost a finger: the other carries on as a drag from here.
      const [rest] = [...touches.current.values()] as [Point];
      gesture.current = { start: { ...rest, t: g.start.t }, dragged: true, from: latest.current.view, pinch: null };
      return;
    }
    const at = local(event);
    // Held too long, or travelled: a drag, not a tap (dp-1). The click that follows is not an open.
    if (!g.dragged && touchKind(g.start, { ...at, t: event.timeStamp }) === 'drag') g.dragged = true;
    setPressed(false);
    if (event.type === 'pointercancel') gesture.current = null;
  };

  // The card opens on a click: a tap, a mouse click or Enter. A click that ends a drag is not an open.
  const onClick = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.dragged) return;
    onOpen?.();
  };

  // The wheel zooms about the pointer (the pop-up only; on the card the wheel scrolls the page). Not passive, so the
  // page itself doesn't scroll under it.
  useEffect(() => {
    const el = frameRef.current;
    if (!wheel || !el || load !== 'ready') return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      latest.current.zoomBy(wheelFactor(event.deltaY), local(event));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheel, load]);

  const { view, picture } = map;
  const placed: CSSProperties = picture.width > 0 ? { width: picture.width, height: picture.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } : {};
  const card = !!onOpen;
  // The card keeps the picture's own shape (held to its tallest by the stylesheet); 4 by 3 until it's known.
  const shape: CSSProperties | undefined = card ? { aspectRatio: picture.width > 0 ? `${picture.width} / ${picture.height}` : '4 / 3' } : undefined;

  const body =
    source.failed || load === 'failed' ? null : source.src === null ? null : (
      <img
        key={attempt}
        className="map-picture__img"
        src={source.src}
        alt={card ? '' : source.alt}
        draggable={false}
        style={placed}
        data-ready={load === 'ready' ? '' : undefined}
        onLoad={(event) => {
          const img = event.currentTarget;
          setPicture({ width: img.naturalWidth, height: img.naturalHeight });
          setLoad('ready');
        }}
        onError={() => setLoad('failed')}
      />
    );

  const common = {
    className: `map-picture${card ? ' map-picture--card' : ''}${map.fitted ? ' map-picture--fitted' : ''}`,
    style: shape,
    'data-pressed': pressed ? '' : undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
  if (card)
    return (
      <button
        type="button"
        {...common}
        ref={(el) => {
          frameRef.current = el;
        }}
        aria-label={`${source.alt}: show the map whole`}
        onClick={onClick}
      >
        {body}
      </button>
    );
  return (
    <div
      {...common}
      ref={(el) => {
        frameRef.current = el;
      }}
    >
      {body}
    </div>
  );
}

/** The loading and failed frames (mockup december/01, frames 5 and 6), in place of the picture. */
function MapWait({ load, onRetry, failedNote }: { load: 'loading' | 'failed'; onRetry: () => void; failedNote: string }) {
  if (load === 'loading')
    return (
      <div className="map-wait" role="status" aria-busy="true">
        <span className="map-wait__block" aria-hidden="true" />
        <span className="map-wait__words">The picture is on its way.</span>
      </div>
    );
  return (
    <div className="map-wait" role="alert">
      <p className="map-wait__line">
        <WarningLine>The map’s picture didn’t load.</WarningLine>
      </p>
      <button type="button" className="button-secondary" onClick={onRetry}>
        Try again
      </button>
      <p className="map-wait__words">{failedNote}</p>
    </div>
  );
}

/** The picture's load: loading until the picture has come (or the caller has none yet), ready, or failed. */
function useLoad(source: MapSource, onRetry?: () => void) {
  const [load, setLoad] = useState<Load>('loading');
  const [attempt, setAttempt] = useState(0);
  // A new address starts loading again (set while drawing, so the old address's state never shows for the new one).
  const [loadedFor, setLoadedFor] = useState(source.src);
  if (loadedFor !== source.src) {
    setLoadedFor(source.src);
    setLoad('loading');
  }
  const shown: Load = source.failed ? 'failed' : source.src === null ? 'loading' : load;
  const retry = () => {
    setLoad('loading');
    setAttempt((n) => n + 1);
    onRetry?.();
  };
  return { load, shown, setLoad, attempt, retry };
}

const FAILED_NOTE = 'Everything else about the place still works: the locations are in the list.';

/**
 * The map card (mc-44, mc-44a; mockup december/01 frames 14 and 14c): the picture alone, fitted to the card's width
 * (held to its tallest, 420 px, and centred when it's tall and narrow, M2); under it the title at the left where it
 * adds something and the tools at the right: zoom out, zoom in, then `tools` (the GM's eye, the players' locate). A tap
 * on the picture calls `onOpen` (the page opens `MapPopup`). No tools under it until the picture has come (dp-3).
 */
export function MapCard({
  source,
  title,
  tools,
  onOpen,
  onRetry,
  label = 'The map',
}: {
  source: MapSource;
  /** The map's title (mc-44a, dp-8): where it differs from the heading it sits under; left out, the tools alone. */
  title?: string;
  /** After the magnifiers: the GM's eye or the players' locate. */
  tools?: ReactNode;
  onOpen: () => void;
  onRetry?: () => void;
  /** The card's name for a screen reader. */
  label?: string;
}) {
  const map = useMapView({ enlarge: true });
  const { shown, setLoad, attempt, retry } = useLoad(source, onRetry);
  return (
    <section className="map-card" aria-label={label}>
      {shown === 'ready' || shown === 'loading' ? (
        <div className="map-card__frame-wrap" data-loading={shown === 'loading' ? '' : undefined}>
          <MapPicture source={source} map={map} load={shown} setLoad={setLoad} onOpen={onOpen} attempt={attempt} />
          {shown === 'loading' && <MapWait load="loading" onRetry={retry} failedNote={FAILED_NOTE} />}
        </div>
      ) : (
        <div className="map-card__failed">
          <MapWait load="failed" onRetry={retry} failedNote={FAILED_NOTE} />
        </div>
      )}
      {shown === 'ready' && <MapTools title={title} tools={<><Magnifiers map={map} />{tools}</>} />}
    </section>
  );
}

/** A title's first two words, with the ellipsis a cut title would end on; the whole title when it has two or fewer. */
export function firstTwoWords(title: string): string {
  const words = title.trim().split(/\s+/);
  return words.length <= 2 ? title.trim() : `${words.slice(0, 2).join(' ')}…`;
}

/**
 * The card's row under the picture: the title at the left, the tools at the right. Where the title doesn't fit beside
 * the tools in full, or cut no shorter than its first two words, it takes a line of its own above them, whole and
 * wrapping between words, the tools staying right on their row (the lead, 2026-11-15; the spirit of ap-16's head).
 * Two hidden copies, the whole title and its first two words, are measured apart from the row, so the choice can't
 * flip the row back and forth.
 */
function MapTools({ title, tools }: { title?: string; tools: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const buttons = useRef<HTMLSpanElement>(null);
  const whole = useRef<HTMLSpanElement>(null);
  const two = useRef<HTMLSpanElement>(null);
  const [above, setAbove] = useState(false);
  useLayoutEffect(() => {
    const el = row.current;
    if (!title || !el) return;
    const measure = () => {
      if (!row.current || !buttons.current || !whole.current || !two.current) return;
      const gap = parseFloat(getComputedStyle(row.current).columnGap) || 0;
      const room = row.current.clientWidth - buttons.current.offsetWidth - gap;
      // A box that hasn't been laid out yet (width 0) keeps the title beside the tools.
      if (row.current.clientWidth === 0) return;
      const fits = whole.current.offsetWidth <= room || two.current.offsetWidth <= room;
      setAbove(!fits);
    };
    measure();
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    watch?.observe(el);
    void document.fonts?.ready.then(measure);
    return () => watch?.disconnect();
  }, [title]);
  const size = title && title.length > 22 ? ' map-tools__title--long' : '';
  return (
    <div ref={row} className={`map-tools${above ? ' map-tools--title-above' : ''}`}>
      {title && <span className={`map-tools__title${size}`}>{title}</span>}
      {title && (
        <span className="map-tools__measure" aria-hidden="true">
          <span ref={whole} className={`map-tools__title${size}`}>{title}</span>
          <span ref={two} className={`map-tools__title${size}`}>{firstTwoWords(title)}</span>
        </span>
      )}
      <span ref={buttons} className="map-tools__buttons">
        {tools}
      </span>
    </div>
  );
}

/**
 * The map pop-up (mc-43, mc-43a; mockup december/01 frames 2 to 6 and M3 to M6): the picture whole in the Picture
 * variant of the pop-up, fitted first; `place` over the title "The map"; `headTools` beside the ✕ (the GM's eye); in
 * the foot `say` at the left, then the figure, zoom out, zoom in and Fit. The wheel and the keys work while it's open.
 * `preview` shows it in place (the gallery).
 */
export function MapPopup({
  source,
  place,
  headTools,
  say,
  onClose,
  onRetry,
  failedNote = FAILED_NOTE,
  preview = false,
}: {
  source: MapSource;
  /** Whose map: the place's name, over the title. */
  place: string;
  headTools?: ReactNode;
  /** A quiet line at the foot's left (the eye's warning that the key is shared too). */
  say?: string;
  onClose: () => void;
  onRetry?: () => void;
  failedNote?: string;
  preview?: boolean;
}) {
  const map = useMapView({});
  const { shown, setLoad, attempt, retry } = useLoad(source, onRetry);
  // The latest view and sizes, for the handlers that outlive a render (a drag's moves, the wheel, the keys).
  const latest = useRef(map);
  useLayoutEffect(() => {
    latest.current = map;
  });

  // The keys (M5): + and − zoom about the middle, the arrows move, 0 is Fit. Not while a field has the keys.
  useEffect(() => {
    if (preview || shown !== 'ready') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const m = latest.current;
      const action = mapKeyAction(event.key, m.frame, { ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey });
      if (!action) return;
      event.preventDefault();
      if (action.kind === 'in') m.zoomIn();
      else if (action.kind === 'out') m.zoomOut();
      else if (action.kind === 'fit') m.toFit();
      else m.moveBy(action.dx, action.dy);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, shown]);

  return (
    <Dialog label="The map" over={place} picture preview={preview} onClose={onClose} headAction={headTools}>
      <div className="map-popup__body">
        {shown === 'failed' ? (
          <MapWait load="failed" onRetry={retry} failedNote={failedNote} />
        ) : (
          <>
            <MapPicture source={source} map={map} load={shown} setLoad={setLoad} wheel attempt={attempt} />
            {shown === 'loading' && <MapWait load="loading" onRetry={retry} failedNote={failedNote} />}
          </>
        )}
      </div>
      {shown === 'ready' && (
        <div className="map-popup__foot">
          <span className="map-popup__say">{say}</span>
          <div className="map-popup__zoom" role="group" aria-label="Zoom">
            <span className="map-popup__percent" aria-live="polite">
              {zoomPercent(map.view)}
            </span>
            <Magnifiers map={map} />
            <button type="button" className="button-secondary button-secondary--small" aria-pressed={map.fitted} onClick={map.toFit}>
              Fit
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/**
 * The map wanted (dec-7 5m-2; mockup december/11, frames 2c and 4d): where the map will stand, one row as small as
 * "+ Picture": the map's title as the pack gives it, the file's name the pack asks for under it (so the GM finds the
 * right file), and "+ Map". While the file is sent the button gives way to one line. Pure: the caller picks the file.
 */
export function MapWanted({
  title,
  file,
  sending,
  onAdd,
  addLabel = '+ Map',
  sendingWords = 'Uploading the map…',
}: {
  title: string;
  file: string;
  sending: boolean;
  onAdd: () => void;
  /** "+ Map from the pack" when the pack brought the picture (B14 audit 6, Francis 2026-11-24). */
  addLabel?: string;
  /** "Fetching the pack's map…" while the pack's picture is tied with no tap (B14 audit 2, Francis 2026-11-24). */
  sendingWords?: string;
}) {
  return (
    <div className="map-wanted">
      <span>
        <b className="map-wanted__title">{title}</b>
        <small className="map-wanted__file">{file}</small>
      </span>
      {sending ? (
        <p className="map-wanted__sending" role="status">
          {sendingWords}
        </p>
      ) : (
        <button type="button" className="button-secondary button-secondary--small" onClick={onAdd}>
          {addLabel}
        </button>
      )}
    </div>
  );
}

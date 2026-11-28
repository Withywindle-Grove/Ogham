// "Waiting for you": the one working panel for whatever needs the GM (row S8 of docs/plans/dec-9-the-whole-scene.md;
// rulings st-1 and wy-1; page 16, frames T2, T6b, T8b), built once and used on Scene, on Players and on the GM's place
// page. This file is the panel's shared state: the provider, the sources that feed it, and who holds the accent. The
// panel that draws it is `WaitingPanel` (WaitingForYou.tsx); the order, the open item, the rows, "N more" and the count
// come from the model (src/modules/expedition/waitingModel.ts).
//
// Items registered by source (S8a): each source (the time strip's encounter cards; the list's players' items; later
// the reminder card, the rest, the hit, the weather and the end of an expedition, S8b) registers what it has waiting,
// with the words and answers it already shows, and draws each item's whole card into a container of the provider's
// (a portal). The panel puts the open item's container into its card and draws the others as one-line rows; moving a
// container, as a node, never remounts its card, so an open choice (Which watch?) and the focus survive the panel coming
// and going and the item closing and opening again (the #785 reviews). Where no panel shows (a town, which keeps today's
// screen until 5t), a source draws all its cards where it stands, as before.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { openAfterAnswer, waitingItems, waitingView, type WaitingAction, type WaitingItem, type WaitingKind, type WaitingMark, type WaitingSources, type WaitingView } from '../modules/expedition/waitingModel.ts';

/** One thing a source has waiting: the model's input, its kind, its whole card, and what its answers do. */
export interface WaitingSourceItem {
  /** Unique across everything waiting ("encounter:<id>", "request:<id>"…). */
  id: string;
  kind: WaitingKind;
  title: string;
  words?: string;
  /** Its own mark in place of its kind's (a buy request's bag). */
  mark?: WaitingMark;
  /** Its answers; the first is the row's one button and, when it is open, the page's accent. */
  actions: readonly WaitingAction[];
  /** The whole card, drawn when the item is open (the source's own card, with its own buttons). */
  card: ReactNode;
  /** One of its answers tapped on its row. */
  onAction?: (actionId: string) => void;
}

type Registered = Omit<WaitingSourceItem, 'card' | 'onAction'>;

interface Shared {
  /** Everything waiting, in the panel's order. */
  items: WaitingItem[];
  view: WaitingView;
  open: (id: string) => void;
  /** Opens a row by a tap: as `open`, and its card takes the focus once drawn. */
  openRow: (id: string) => void;
  takeFocus: (id: string, container: HTMLElement) => void;
  act:(itemId: string, actionId: string) => void;
  register: (key: string, items: Registered[], onAction: Map<string, (actionId: string) => void>) => void;
  unregister: (key: string) => void;
  containerOf: (id: string) => HTMLElement | null;
  /** The panel showing for this provider (one at a time: a split party's second place page draws none). */
  host: string | null;
  /** A place page, and so a panel, is coming (the Scene is still loading it): the strip keeps cards out meanwhile. */
  expected: boolean;
  setExpected: (expected: boolean) => void;
  claimHost: (token: string) => void;
  releaseHost: (token: string) => void;
  /** The place page is showing (it offers Move on, the accent while nothing else claims it). */
  accentHeld: boolean;
  setAccentHeld: (held: boolean) => void;
  /** No session runs (none yet, or paused; nothing folds since st-2): the band's Start or Resume session is the accent. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

const WaitingContext = createContext<Shared | null>(null);

/**
 * Who holds the screen's one accent on Scene (one accent a screen; page 11, page 12 W1; the #785 review; st-2 on
 * page 16): Start or Resume session while no session runs; else the first action of "Waiting for you"; else Move on
 * on the place page; else Start expedition in town (`between`; downtime has no accent, T5); else none. Next turn is
 * never the accent (page 16, T1, T2).
 */
export type AccentOwner = 'session' | 'waiting' | 'move' | 'expedition' | 'none';

export function accentOwner({ running, waiting, page, between = false }: { running: boolean; waiting: boolean; page: boolean; between?: boolean }): AccentOwner {
  if (!running) return 'session';
  if (waiting) return 'waiting';
  if (page) return 'move';
  return between ? 'expedition' : 'none';
}

/**
 * Moves a card's container into `parent`, keeping focus where it was: a browser drops the focus of a node that moves,
 * so a GM's tap inside a card (Which watch?) would lose its place (the #785 re-review).
 */
function moveCards(container: HTMLElement, parent: HTMLElement): void {
  if (container.parentElement === parent && parent.lastElementChild === container) {
    // Not moved: a focus noted as an old host went is stale now (#857's review).
    refocus.delete(container);
    return;
  }
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  // A focus noted as its old host went is given back only if it was lost (nothing else took it since).
  const lost = !active || active === document.body;
  const inside = active instanceof HTMLElement && container.contains(active) ? active : lost ? (refocus.get(container) ?? null) : null;
  refocus.delete(container);
  parent.appendChild(container);
  if (inside && container.contains(inside) && document.activeElement !== inside) inside.focus({ preventScroll: true });
}

/**
 * The focus inside a container whose host is going (the strip's host as the panel comes, the panel's card as it goes):
 * the host's node leaves the page before the next host takes the container, so the focus is noted here and given back
 * when it does.
 */
const refocus = new WeakMap<HTMLElement, HTMLElement>();

function noteFocus(containers: (HTMLElement | null)[]): void {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  if (!(active instanceof HTMLElement)) return;
  for (const c of containers) if (c?.contains(active)) refocus.set(c, active);
}

/** What a source registered, as the model takes it. */
function sourcesOf(registered: ReadonlyMap<string, Registered[]>): WaitingSources {
  const all = [...registered.values()].flat();
  const of = (kind: WaitingKind) => all.filter((i) => i.kind === kind).map(({ id, title, words, actions, mark }) => ({ id, title, ...(words !== undefined ? { words } : {}), ...(mark !== undefined ? { mark } : {}), actions }));
  return {
    expeditionEnd: of('expeditionEnd'),
    encounters: of('encounter'),
    rests: of('rest'),
    weather: of('weather'),
    reminders: of('reminder'),
    effects: of('decision').map((i) => ({ ...i, decide: true })),
    playerItems: of('playerItem'),
    ways: of('way'),
  };
}

export function SceneWaitingProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<ReadonlyMap<string, Registered[]>>(() => new Map());
  const handlers = useRef(new Map<string, Map<string, (actionId: string) => void>>());
  const containers = useRef(new Map<string, HTMLElement>());
  const [openId, setOpenId] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const [accentHeld, setAccentHeld] = useState(false);
  const [paused, setPausedNow] = useState(false);
  const [expected, setExpectedNow] = useState(false);
  const setExpected = useCallback((e: boolean) => setExpectedNow((was) => (was === e ? was : e)), []);

  const items = useMemo(() => waitingItems(sourcesOf(registered)), [registered]);
  // wy-1: the open one answered (gone from the list), the next opens; another answered, the open one stays. Before
  // the paint, so the first never shows open for a moment in between.
  const before = useRef<WaitingItem[]>([]);
  useLayoutEffect(() => {
    const was = before.current;
    before.current = items;
    if (openId === null || items.some((i) => i.id === openId)) return;
    setOpenId(was.some((i) => i.id === openId) ? openAfterAnswer(was, openId, openId) : null);
  }, [items, openId]);
  const view = useMemo(() => waitingView(items, openId), [items, openId]);
  // A container goes with its item (#857's review): no card is drawn into it once its source stops registering it.
  // Only an id that was registered and has left: a new source draws into its container before it registers.
  const registeredBefore = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    for (const id of registeredBefore.current) if (!ids.has(id)) containers.current.delete(id);
    registeredBefore.current = ids;
  }, [items]);
  // A row opened by a tap: its card takes the focus once it is drawn, so a keyboard user keeps their place.
  const focusOpened = useRef<string | null>(null);
  const openRow = useCallback((id: string) => {
    focusOpened.current = id;
    setOpenId(id);
  }, []);

  const register = useCallback((key: string, list: Registered[], onAction: Map<string, (actionId: string) => void>) => {
    handlers.current.set(key, onAction);
    setRegistered((was) => {
      if (sameItems(was.get(key), list)) return was;
      const next = new Map(was);
      next.set(key, list);
      return next;
    });
  }, []);
  const unregister = useCallback((key: string) => {
    handlers.current.delete(key);
    setRegistered((was) => {
      if (!was.has(key)) return was;
      const next = new Map(was);
      next.delete(key);
      return next;
    });
  }, []);
  const act = useCallback((itemId: string, actionId: string) => {
    for (const map of handlers.current.values()) {
      const handle = map.get(itemId);
      if (handle) return handle(actionId);
    }
  }, []);
  const containerOf = useCallback((id: string) => {
    if (typeof document === 'undefined') return null;
    let el = containers.current.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'waiting-card__cards';
      containers.current.set(id, el);
    }
    return el;
  }, []);
  const claimHost = useCallback((token: string) => setHost((was) => was ?? token), []);
  const releaseHost = useCallback((token: string) => setHost((was) => (was === token ? null : was)), []);
  const setPaused = useCallback((p: boolean) => setPausedNow((was) => (was === p ? was : p)), []);
  /** The opened card's first control (or its heading) takes the focus, once, after a row was opened by a tap. */
  const takeFocus = useCallback((id: string, container: HTMLElement) => {
    if (focusOpened.current !== id) return;
    focusOpened.current = null;
    // Never a text field (A4, no keyboard on open): a button, a link or the card's heading.
    const target = container.querySelector<HTMLElement>('button, a[href], h2, h3');
    if (!target) return;
    if (!target.matches('button, a[href]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, []);

  const shared = useMemo(
    () => ({ items, view, open: setOpenId, openRow, takeFocus, act, register, unregister, containerOf, host, expected, setExpected, claimHost, releaseHost, accentHeld, setAccentHeld, paused, setPaused }),
    [items, view, openRow, takeFocus, act, register, unregister, containerOf, host, expected, setExpected, claimHost, releaseHost, accentHeld, paused, setPaused],
  );
  return <WaitingContext.Provider value={shared}>{children}</WaitingContext.Provider>;
}

function sameItems(a: Registered[] | undefined, b: Registered[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i]!;
    return x.id === y.id && x.kind === y.kind && x.title === y.title && x.words === y.words && x.mark === y.mark && JSON.stringify(x.actions) === JSON.stringify(y.actions);
  });
}

/** Where a source draws its cards while no panel shows: a host that takes their containers, in order. */
function StripHost({ ids, containerOf }: { ids: string[]; containerOf: (id: string) => HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const id of ids) {
      const c = containerOf(id);
      if (c) moveCards(c, el);
    }
    return () => noteFocus(ids.map(containerOf));
  });
  return <div ref={ref} className="waiting-card__slot" />;
}

/**
 * A source's side: registers what it has waiting under its `key` and draws each item's card into its container (in
 * the panel when it is open there; where the source stands when no panel shows). Without a provider (a player's
 * screen, a test) the cards are drawn in place.
 */
export function useWaitingSource(key: string, items: readonly WaitingSourceItem[]): ReactNode {
  const shared = useContext(WaitingContext);
  const register = shared?.register;
  const unregister = shared?.unregister;
  const list: Registered[] = items.map(({ id, kind, title, words, actions, mark }) => ({ id, kind, title, ...(words !== undefined ? { words } : {}), ...(mark !== undefined ? { mark } : {}), actions }));
  const handlers = new Map(items.flatMap((i) => (i.onAction ? [[i.id, i.onAction] as const] : [])));
  useEffect(() => {
    register?.(key, list, handlers);
  });
  useEffect(() => {
    if (!unregister) return;
    return () => unregister(key);
  }, [unregister, key]);
  if (!shared) return <>{items.map((i) => <WaitingFragment key={i.id}>{i.card}</WaitingFragment>)}</>;
  return (
    <>
      {items.map((i) => {
        const container = shared.containerOf(i.id);
        return container ? createPortal(i.card, container, i.id) : null;
      })}
      {!shared.host && !shared.expected && <StripHost ids={items.map((i) => i.id)} containerOf={shared.containerOf} />}
    </>
  );
}

function WaitingFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** useWaitingSource as a part, so a source can place it inside its own markup. */
export function WaitingSource({ sourceKey, items }: { sourceKey: string; items: readonly WaitingSourceItem[] }) {
  return <>{useWaitingSource(sourceKey, items)}</>;
}

/** The panel's side: everything it draws, and whether it is the one panel drawing (a split party's second page is not). */
export function useWaitingPanel(): (Shared & { hosting: boolean }) | null {
  const shared = useContext(WaitingContext);
  const [token] = useState(() => Math.random().toString(36).slice(2));
  const claim = shared?.claimHost;
  const release = shared?.releaseHost;
  const host = shared?.host;
  // Claimed before the paint, so a source's cards never show in the strip first (#857's review); and again whenever no
  // panel holds it, so a split party's second page takes over when the first goes (into town, say).
  useLayoutEffect(() => {
    if (claim && host === null) claim(token);
  }, [claim, host, token]);
  useLayoutEffect(() => {
    if (!release) return;
    return () => release(token);
  }, [release, token]);
  if (!shared) return null;
  return { ...shared, hosting: shared.host === token };
}

/**
 * The Scene's side (PartyGroups): a place page is coming, or showing, so the panel will hold what waits. While it is
 * still loading, the strip keeps its cards out instead of drawing them for a moment (the fault found in S8a's pictures:
 * since 5b they flashed in the strip while the place page loaded).
 */
export function useExpectPanel(expected: boolean): void {
  const set = useContext(WaitingContext)?.setExpected;
  useLayoutEffect(() => {
    if (!set) return;
    set(expected);
    return () => set(false);
  }, [set, expected]);
}

/**
 * The strip's side: whether "Waiting for you" holds what waits (a panel shows, or one is coming). False without a
 * provider, and in a town, where the strip draws today's boxes.
 */
export function useWaitingPanelOn(): boolean {
  const shared = useContext(WaitingContext);
  return !!shared && (shared.host !== null || shared.expected);
}

/** The panel's drawing side: what waits, the view, opening and answering (null without a provider). */
export function useWaitingState(): Pick<Shared, 'items' | 'view' | 'open' | 'openRow' | 'act'> | null {
  return useContext(WaitingContext);
}

/** Whether a provider is above (the panel makes its own where none is: the Players tab). */
export function useHasWaitingProvider(): boolean {
  return useContext(WaitingContext) !== null;
}

/** The panel's side: puts an item's container into the open card. */
export function CardHost({ id }: { id: string }) {
  const shared = useContext(WaitingContext);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = shared?.containerOf(id) ?? null;
    if (container && ref.current) {
      moveCards(container, ref.current);
      shared?.takeFocus(id, container);
    }
    return () => noteFocus([container]);
  });
  return <div ref={ref} className="waiting-card__slot" />;
}

/**
 * Which item holds the page's accent (the open item, when it has an answer: view.accent); null when none does;
 * undefined without a provider (the caller keeps its own rule).
 */
export function useWaitingAccentItem(): string | null | undefined {
  const shared = useContext(WaitingContext);
  return shared ? (shared.view.accent?.itemId ?? null) : undefined;
}

/** The page's side: it is showing (its Move on may hold the accent); when it goes, the strip has the accent back. */
export function useHoldAccent(): void {
  const set = useContext(WaitingContext)?.setAccentHeld;
  useEffect(() => {
    if (!set) return;
    set(true);
    return () => set(false);
  }, [set]);
}

/** The strip's side: whether the place page is showing. */
export function useAccentHeld(): boolean {
  return useContext(WaitingContext)?.accentHeld ?? false;
}

/** The strip's side: it says whether no session runs (Start or Resume session the accent, st-2). */
export function useStripPaused(paused: boolean): void {
  const set = useContext(WaitingContext)?.setPaused;
  useEffect(() => {
    if (!set) return;
    set(paused);
    return () => set(false);
  }, [set, paused]);
}

/** The page's side: whether no session runs (Move on goes plain then, st-2). */
export function useStripIsPaused(): boolean {
  return useContext(WaitingContext)?.paused ?? false;
}

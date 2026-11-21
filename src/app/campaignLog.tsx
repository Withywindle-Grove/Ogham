// The log from the top row (ruled 2026-10-23; full screen ruled 2026-10-24): every campaign screen's top row has
// a Log button beside ⋯, for the GM and players. The log opens full screen on every device, over the screen; it
// follows the finger and closes on a swipe down from near the top (or Close, or Escape). The screen behind stays
// as it was. The whole log is there, Verbose included; who sees what doesn't change (the database decides).
// CampaignLog wraps a campaign's screens: the TopRow finds it and shows the button. Live updates (2026-10-24):
// any new log entry this person may see, from any device, bumps `version` (once per burst), so the screens
// behind reload their data in place (useLogVersion); a change to the campaign's setting rules also forgets the
// kept copy of them.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import { watchLog, watchRows } from '../core/events.ts';
import type { Db } from '../core/supabase.ts';
import { Icon } from '../ui/icons.tsx';
import { CloseButton } from '../ui/parts.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { LogView } from './LogView.tsx';
import './campaignLog.css';

// Log entries about these tables change the campaign's setting rules (the kept copy is forgotten; the next read checks
// the device store's stamps and downloads only what moved, perf fix 2b). known_items: an item revealed changes what a
// player's lists hold (chosen in docs/plans/perf-pack-cache.md).
const RULES_TABLES = new Set(['library_entries', 'library_entry_secrets', 'campaign_packs', 'campaign_pack_secrets', 'packs', 'known_items']);
// Rows players follow directly, as well as the log (supabase/migrations/…_m5_places_messages.sql).
// group_place_signals ticks when what a group's players can see of its place changes (they can't read hidden rows).
// messages (M5b g4): a disappearing message makes no log line of the player's, so the ✉ count and the card follow the row.
const LIVE_ROWS = ['group_place_signals', 'places', 'message_recipients', 'messages'] as const;
// How long to wait after a log entry before reloading, so one action's several entries reload once (ms).
const SETTLE = 400;

type CampaignLogValue = { db: Db; user: CurrentUser; campaignId: string; version: number; changed: () => void };

const Context = createContext<CampaignLogValue | null>(null);

export function CampaignLog({ db, user, campaignId, children }: { db: Db; user: CurrentUser; campaignId: string; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  // Changes made on other devices (and this one) show without reloading the page.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVersion((v) => v + 1), SETTLE);
    };
    const listen = () => {
      const stopLog = watchLog(db, campaignId, (event) => {
        if (event?.targetTable && RULES_TABLES.has(event.targetTable)) forgetCampaignSetting(campaignId);
        bump();
      });
      // What reaches players without a log line of theirs (M5 step 11): a place shown or hidden, a burnt message.
      const stopRows = watchRows(db, campaignId, LIVE_ROWS, bump);
      return () => {
        stopLog();
        stopRows();
      };
    };
    let stop = listen();
    // A phone or tablet pauses the live connection while the screen is locked or another app is in front, and
    // changes made meanwhile never arrive (A12, M4b gate 2026-10-25). Coming back (visible, focused, online):
    // listen afresh and reload what's on screen.
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      stop();
      stop = listen();
      forgetCampaignSetting(campaignId);
      setVersion((v) => v + 1);
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    window.addEventListener('online', back);
    return () => {
      stop();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
      window.removeEventListener('online', back);
    };
  }, [db, campaignId]);
  const value = useMemo(() => ({ db, user, campaignId, version, changed }), [db, user, campaignId, version, changed]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Goes up by one after something changed (a new log entry from any device, or an undo), so a screen can reload its data. */
export function useLogVersion(): number {
  return useContext(Context)?.version ?? 0;
}

/** Who is signed in, inside a campaign's screens (null outside them): what the kept setting rules are keyed by. */
export function useLogUserId(): string | null {
  return useContext(Context)?.user.id ?? null;
}

/**
 * Tells the campaign's screens that something changed on this device that brings no log line of this person's (a
 * player's forced march: its line is the GM's), so they reload as after a new entry.
 */
export function useLogChanged(): () => void {
  return useContext(Context)?.changed ?? noop;
}
const noop = () => undefined;

/** The top row's Log button, inside a campaign only. */
export function LogButton() {
  const log = useContext(Context);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!log) return null;
  return (
    <>
      <button ref={button} type="button" className="log-button" aria-label="Log" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="open-book" />
      </button>
      {open && (
        <LogSheet
          onClose={() => {
            setOpen(false);
            // Back to the Log button without scrolling, so the screen keeps its place.
            button.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

/** The whole log, full screen: from the top row's Log, and from the Log tab in a phone's tab bar (slice E). */
export function LogSheet({ onClose }: { onClose: () => void }) {
  const log = useContext(Context);
  if (!log) return null;
  return (
    <LogPanel onClose={onClose}>
      <LogView db={log.db} user={log.user} campaignId={log.campaignId} onChanged={log.changed} />
    </LogPanel>
  );
}

// How far a drag down must go before the log closes (px); a shorter one springs back.
const DRAG = 80;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Full screen on every device; it follows a finger dragged down from its top, and a long enough drag, Escape or Close
 * closes it. `label` names it for screen readers (the log; Messages, M5b g4, opens in the same panel; the GM reference
 * screen, M5b g5, is its Reference variant).
 */
export function LogPanel({ onClose, children, label = 'Log' }: { onClose: () => void; children: ReactNode; label?: string }) {
  const [dragged, setDragged] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The latest onClose, so a re-render (an undo) doesn't run the opening effect again and move focus.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Once, on opening: focus moves into the panel, Tab stays inside it, Escape closes it, and the page behind
  // doesn't scroll under a finger.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      else if (event.key === 'Tab' && panel.current) {
        const stops = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
        if (stops.length === 0) return;
        const first = stops[0]!;
        const last = stops[stops.length - 1]!;
        const at = document.activeElement;
        if (event.shiftKey && (at === first || at === panel.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && at === last) {
          event.preventDefault();
          first.focus();
        } else if (!panel.current.contains(at)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  // The top strip (the handle and Close row) takes the drag; the log below scrolls as usual.
  const down = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    start.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (start.current !== null) setDragged(Math.max(0, event.clientY - start.current));
  };
  const end = () => {
    start.current = null;
    setDragging(false);
    setDragged(0);
  };
  const up = (event: PointerEvent) => {
    if (start.current === null) return;
    const by = event.clientY - start.current;
    end();
    if (by > DRAG) onClose();
  };

  return (
    <div className="log-panel__backdrop" onClick={onClose}>
      <div
        ref={panel}
        className={dragging ? 'log-panel log-panel--dragging' : 'log-panel'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={dragged > 0 ? { transform: `translateY(${dragged}px)` } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="log-panel__top" data-testid="log-sheet-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={end}>
          <span className="log-panel__handle" aria-hidden="true" />
          <CloseButton className="log-panel__close" onClose={onClose} />
        </div>
        <div className="log-panel__body">{children}</div>
      </div>
    </div>
  );
}

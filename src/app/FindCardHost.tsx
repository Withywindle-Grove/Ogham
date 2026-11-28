// The find card's hosts off the Pack tab (K18c and K18d of docs/specs/scene-pack.md, pieces E and G; page 45, approved
// 2026-11-26; page 51, approved 2026-11-28): "Got it" as both write it, and the card on every other tab of the Player
// screen, which keeps the reader's scroll position as it arrives (p45-19).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { markFindsSeen } from '../modules/characters/findsSeen.ts';
import { useToast } from '../ui/ToastHost.tsx';
import { useOnline } from '../ui/creation.tsx';
import { useLogChanged } from './campaignLog.tsx';
import { FindCard } from './FindCard.tsx';
import { FINDS_NOT_MARKED, type PackFinds, type PlayerFinds } from './packFinds.ts';
import { registry } from './services.ts';

/**
 * "Got it" off the Pack: the mark once, with no toast and no Undo, then `onMarked` (the host empties its card) and the
 * log's reload, so the count, the Pack's tags and the other cards follow. Offline it writes nothing and asks for FD9's
 * box, which goes once she is back online (FD9b C); a refusal keeps the card under the error toast (p45-24).
 */
export function useFindsGotIt(db: Db, user: CurrentUser, onMarked: () => void): { gotIt: (finds: PackFinds) => void; offlineBox: boolean } {
  const logChanged = useLogChanged();
  const show = useToast();
  const online = useOnline();
  const [boxAsked, setBoxAsked] = useState(false);
  const [wasOnline, setWasOnline] = useState(online);
  if (online !== wasOnline) {
    setWasOnline(online);
    if (online) setBoxAsked(false);
  }
  // One mark a tap: a second tap while the first is on its way writes nothing more.
  const marking = useRef(false);
  async function mark(finds: PackFinds) {
    if (!online) return setBoxAsked(true);
    if (marking.current) return;
    marking.current = true;
    const done = await runCommand(registry, db, user, markFindsSeen, { character: finds.character });
    marking.current = false;
    if (!done.ok) return show({ text: FINDS_NOT_MARKED, error: true });
    onMarked();
    logChanged();
  }
  return { gotIt: (finds) => void mark(finds), offlineBox: boxAsked && !online };
}

/** Whether the page, or a box that scrolls around `el`, has been scrolled down from its very top. */
function scrolledDown(el: Element): boolean {
  for (let box = el.parentElement; box; box = box.parentElement) if (box.scrollTop > 0) return true;
  return (document.scrollingElement?.scrollTop ?? 0) > 0;
}

/** The nearest box around `el` that has been scrolled (a column that scrolls by itself), or the page. */
function scrollerOf(el: Element): Element | null {
  for (let box = el.parentElement; box; box = box.parentElement) if (box.scrollTop > 0) return box;
  return document.scrollingElement;
}

/**
 * The find card on every tab but the Scene and the Pack (K18c; FD1b, FD1c B, 51-1 A, 51-2 A): the Player screen's one
 * read (`usePackFinds`) drawn as K18b's card, in its own status region kept on the page while nothing is new, so it
 * arrives behind any open pop-up or sheet, with no toast (p45-13). Its host places it: first in the right column on a
 * tablet, above the tab's own content in one column. When it arrives, grows or goes, the tab's content under it stays
 * where the reader had it (p45-19), unless she is at the very top, where it pushes the page down as on the Pack (FD10b). Null where the screen reads nothing (another player, the GM's view).
 */
export function useTabFindCard({
  db,
  user,
  finds,
  onSeen,
  onOpenPack,
}: {
  db: Db;
  user: CurrentUser;
  finds: PlayerFinds | null;
  /** Empties the card at once after "Got it" (`usePackFinds`' second value). */
  onSeen: () => void;
  /** "and N more" (p45-16): the Pack at its new rows. */
  onOpenPack: () => void;
}): ReactNode {
  const { gotIt, offlineBox } = useFindsGotIt(db, user, onSeen);
  const box = useRef<HTMLDivElement | null>(null);
  // The row after the card (the tab's own content) and where it stood, noted after each draw and each scroll; when the
  // card changes, that row is put back where it was. The browser's own anchoring (where it has it) may have done it
  // already; this moves only what is left, as the Pack's hold does (`anchorIn`).
  const anchor = useRef<{ el: Element; top: number } | null>(null);
  const note = useCallback(() => {
    const el = box.current?.nextElementSibling;
    anchor.current = el ? { el, top: el.getBoundingClientRect().top } : null;
  }, []);
  useLayoutEffect(() => {
    const was = anchor.current;
    if (was?.el.isConnected && was.el === box.current?.nextElementSibling && scrolledDown(was.el)) {
      const moved = was.el.getBoundingClientRect().top - was.top;
      const scroller = scrollerOf(was.el);
      if (moved !== 0 && scroller) scroller.scrollTop += moved;
    }
    note();
  });
  useEffect(() => {
    window.addEventListener('scroll', note, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', note, { capture: true });
  }, [note]);
  if (!finds) return null;
  return (
    <div className="find-card-host" ref={box}>
      <FindCard
        entries={finds.entries}
        words={{ names: finds.names, coinWords: finds.coinWords, when: finds.when, now: new Date().toISOString() }}
        onGotIt={() => gotIt(finds)}
        onMore={onOpenPack}
        offlineBox={offlineBox}
      />
    </div>
  );
}

// The players' prompt slot (B18; docs/06 "Dungeon on Scene: the players' table view"): one slot between the time band
// and the marching order, space reserved, holding the prompts as cards, **newest on top** (SC-g6-4, ruled B by
// Francis 2026-11-03). Each prompt is one keyed child. A child shows a prompt when it renders an element; a prompt
// that is replaced by a new one of its kind (a new request, a new message, a rest called after a due one) names
// itself with `data-prompt-id` on its root, so the slot sees the change. The slot notes when each prompt arrived on
// this device and puts the newest first. What is already there when the screen opens (its first second, while the
// pieces load) keeps the given order (rest, request, message, No light, weather). While the player's focus is inside
// the slot (typing an escape roll, say), nothing moves until it leaves.
import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** How long after the slot opens a prompt counts as already there (the screen's pieces load in their own time). */
const SETTLE_MS = 1000;

/** What a slot item shows now: the ids its prompts name, "shown" for one that names none, or null when empty. */
function identityOf(item: Element): string | null {
  const named = [...item.querySelectorAll('[data-prompt-id]')].map((e) => e.getAttribute('data-prompt-id') ?? '');
  if (named.length > 0) return named.join(' ');
  return item.firstElementChild ? 'shown' : null;
}

/** The keys in the order to show: newest arrival first, then the rest in the given order. */
export function slotOrder(keys: readonly string[], arrived: ReadonlyMap<string, number>): string[] {
  return keys
    .map((key, index) => ({ key, index, at: arrived.get(key) ?? 0 }))
    .sort((a, b) => b.at - a.at || a.index - b.index)
    .map((k) => k.key);
}

export function PromptSlot({ children, after = null, settleMs = SETTLE_MS }: { children: ReactNode; /** Drawn last, always (p7-9). */ after?: ReactNode; settleMs?: number }) {
  const items = Children.toArray(children).filter(isValidElement);
  const keys = items.map((item) => String(item.key));
  const box = useRef<HTMLDivElement>(null);
  // When the slot first looked (its opening), for the settle time.
  const opened = useRef<number | null>(null);
  // Per item: what it showed last, and when that arrived (0: already there).
  const seen = useRef(new Map<string, string | null>());
  const [arrived, setArrived] = useState<ReadonlyMap<string, number>>(new Map());
  const waiting = useRef(false);

  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const look = () => {
      if (root.contains(document.activeElement) && document.activeElement !== root) {
        waiting.current = true;
        return;
      }
      waiting.current = false;
      const now = Date.now();
      opened.current ??= now;
      let changed = false;
      const next = new Map(arrived);
      for (const item of root.querySelectorAll(':scope > [data-slot-key]')) {
        const key = item.getAttribute('data-slot-key')!;
        const was = seen.current.get(key) ?? null;
        const is = identityOf(item);
        if (is === was) continue;
        seen.current.set(key, is);
        if (is === null) continue;
        const at = now - opened.current < settleMs ? 0 : now;
        if ((next.get(key) ?? 0) !== at) {
          next.set(key, at);
          changed = true;
        }
      }
      if (changed) setArrived(next);
    };
    look();
    // Looking again changes nothing unless a prompt came or changed (the slot's own reordering finds nothing new).
    const watcher = new MutationObserver(look);
    watcher.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-prompt-id'] });
    const left = () => {
      if (waiting.current) setTimeout(look, 0);
    };
    root.addEventListener('focusout', left);
    return () => {
      watcher.disconnect();
      root.removeEventListener('focusout', left);
    };
  }, [arrived, settleMs]);

  // A prompt that went is forgotten, so it comes back on top if it returns.
  useEffect(() => {
    for (const key of [...seen.current.keys()]) if (!keys.includes(key)) seen.current.delete(key);
  });

  const order = slotOrder(keys, arrived);
  const byKey = new Map(items.map((item) => [String(item.key), item]));
  return (
    <div className="prompt-slot" ref={box}>
      {order.map((key) => (
        <div key={key} className="prompt-slot__item" data-slot-key={key}>
          {byKey.get(key)}
        </div>
      ))}
      {after && <div className="prompt-slot__item prompt-slot__item--last">{after}</div>}
    </div>
  );
}

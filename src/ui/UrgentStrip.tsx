// The Urgent strip (docs/05-features.md): one line per urgent item at the top of the Player screen, shown
// even when its section is hidden, until it's dealt with. Its items come from the sources in core/urgent.ts.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { urgentItems, type UrgentItem } from '../core/urgent.ts';
import './UrgentStrip.css';

export function UrgentStrip({
  characterId,
  campaignId,
  hiddenSections,
  children,
}: {
  characterId: string;
  campaignId: string;
  /** Sections the player hid (Arrange); urgent items show regardless. */
  hiddenSections: string[];
  /** The screen's own live items (the weather roll, M5b), each an `urgent__item`; they render nothing when not due. */
  children?: ReactNode;
}) {
  const [items, setItems] = useState<(UrgentItem & { sourceId: string })[]>([]);
  const load = useCallback(() => urgentItems({ characterId, campaignId }), [characterId, campaignId]);

  useEffect(() => {
    let current = true;
    void load().then((found) => current && setItems(found));
    return () => {
      current = false;
    };
  }, [load]);

  if (items.length === 0 && !children) return null;
  return (
    <div className="urgent" role="status" aria-label="Urgent" data-hidden-sections={hiddenSections.join(' ')}>
      {children}
      {items.map((item) => (
        <p key={`${item.sourceId}:${item.key}`} className="urgent__item">
          <span>{item.text}</span>
          {item.action && (
            <button
              type="button"
              className="button-secondary button-secondary--small"
              onClick={async () => {
                await item.action!.run();
                setItems(await load());
              }}
            >
              {item.action.label}
            </button>
          )}
        </p>
      ))}
    </div>
  );
}

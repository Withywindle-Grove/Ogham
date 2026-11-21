import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tabLabel, type Magic, type MagicRow } from '../modules/characters/magic.ts';
import { EntryList } from './creation.tsx';
import { ButtonRow, UsePips } from './parts.tsx';
import './MagicBlock.css';

/** How many rows a tab shows before it folds (the mockup's note: "long lists fold after 8"). */
export const MAGIC_FOLD = 8;
/** How many rows the tabs may take at full size before they use the small size. */
const TAB_ROWS = 2;

/**
 * The full sheet's Magic section (sr-4; mockup sheet/01 "4 · Magic · A"), inside the sheet's own section and heading:
 * the spells a day as pips per level (the trait chips' use pips, never a second pip component), then a tab per kind
 * of magic the character has ("Spell book: 4", "Prepared: 1", "Glamours: 2") as a button row, its spells one row
 * each, each opening its entry; tabs that would take more than two rows use the small size. A tab longer than eight
 * folds, "N more" (a small button) opening it in place. Reading only: Cast and Prepare stay in M7.
 */
export function MagicBlock({ magic, onOpen }: { magic: Magic; onOpen: (row: MagicRow) => void }) {
  const [tabId, setTabId] = useState(magic.tabs[0]?.id ?? '');
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const tab = magic.tabs.find((t) => t.id === tabId) ?? magic.tabs[0];
  const open = !!tab && (unfolded.has(tab.id) || tab.rows.length <= MAGIC_FOLD);
  const rows = tab ? (open ? tab.rows : tab.rows.slice(0, MAGIC_FOLD)) : [];
  // The tabs at full size, unless that takes more than two rows: then the small secondary size (Design, on #482).
  // Measured before paint at full size; the choice holds for this width and these tabs, so a change of either tries
  // full size again.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [smallAt, setSmallAt] = useState<string | null>(null);
  const fitKey = `${width}|${magic.tabs.map(tabLabel).join('|')}`;
  const smallTabs = smallAt === fitKey;
  useEffect(() => {
    const el = tabsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (smallTabs || !tabsRef.current) return;
    const tops = new Set([...tabsRef.current.querySelectorAll('button')].map((b) => b.offsetTop));
    if (tops.size > TAB_ROWS) setSmallAt(fitKey);
  }, [fitKey, smallTabs]);
  return (
    <div className="magic">
      {magic.perDay.length > 0 && (
        <div className="magic__per-day">
          <span className="magic__per-day-label" aria-hidden="true">
            Spells a day
          </span>
          {/* A screen reader hears the list "Spells a day", then each level as "Level 1, 3 a day" (the pips are hidden). */}
          <ul className="magic__levels" aria-label="Spells a day">
            {magic.perDay.map((p) => (
              <li key={p.level} className="magic__level">
                {p.title}
                <UsePips uses={p.count} spent={0} />
                <span className="visually-hidden">, {p.count} a day</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {magic.tabs.length > 1 ? (
        <div ref={tabsRef}>
          <ButtonRow label="Kinds of magic" options={magic.tabs.map((t) => ({ value: t.id, label: tabLabel(t) }))} value={tab?.id ?? null} onChange={setTabId} small={smallTabs} />
        </div>
      ) : (
        tab && <h3 className="magic__tab-title">{tabLabel(tab)}</h3>
      )}
      {tab &&
        (tab.rows.length === 0 ? (
          <p className="magic__empty">{tab.empty}</p>
        ) : (
          <EntryList
            label={tab.title}
            rows={rows.map((r) => ({
              key: r.key,
              name: r.times > 1 ? `${r.name} ×${r.times}` : r.name,
              facts: r.facts,
              ...(r.given ? { tag: 'given' } : {}),
              onOpen: () => onOpen(r),
            }))}
          />
        ))}
      {tab && !open && (
        <button type="button" className="button-secondary button-secondary--small magic__fold" onClick={() => setUnfolded((u) => new Set([...u, tab.id]))}>
          {`${tab.rows.length - MAGIC_FOLD} more`}
        </button>
      )}
    </div>
  );
}

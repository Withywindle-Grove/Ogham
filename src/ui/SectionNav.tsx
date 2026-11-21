// A role's sections, the same everywhere (ruled 2026-10-23): the same sections, in the same order, with the same
// icons on phone and tablet. A phone shows them as bottom tabs, a tablet in portrait as tabs at the top, a
// tablet in landscape as the left column (the screen's grid places it there). Only the look changes with the
// width, so the CSS does it all. A tab can carry a quiet count (the GM's "Waiting for you").
import { Icon, type IconName } from './icons.tsx';
import './SectionNav.css';

export type NavTab<T extends string> = {
  id: T;
  name: string;
  icon: IconName;
  count?: number;
  /** The count's words for screen readers ("waiting for you"). */
  countLabel?: string;
  /** A word shown after the count (the GM's Players: "3 waiting", ruled 2026-10-26). */
  countWord?: string;
  /**
   * What waits on this tab, as a figure in a small mark at the icon's corner (the phone's tab bar, final drafts A11,
   * slice E; mockup creation/17): left out at 0, "99+" past 99; screen readers hear it with `badgeLabel`.
   */
  badge?: number;
  badgeLabel?: string;
  /**
   * Something on this tab waits for the person to act, in words ("1 to approve"; plan m5b-sheet-revised PR 2, mockup
   * gm/01-rail-attention A2). While it isn't empty the icon glows (a slow breathe; a still glow under reduced motion)
   * and the tab's name says it: "Players: 1 to approve". It goes out when the tab's list empties, never on a visit: the
   * owner works it out from what waits, whichever tab is open.
   */
  waits?: string;
};

/** A tab's name for screen readers when it carries a count or a badge (or is folded to its icon). */
function tabLabel<T extends string>(tab: NavTab<T>, collapsed: boolean): string | undefined {
  if (tab.waits) {
    // A tablet's lit tab shows its count in words ("Players, 3 waiting"): its name for screen readers starts with those
    // visible words (WCAG 2.5.3, label in name; the #568 look-back). A phone's tab shows only a badge: "Players: …".
    const shown = tab.count && tab.countWord ? `${tab.name}, ${tab.count} ${tab.countWord}` : tab.name;
    return `${shown}: ${tab.waits}`;
  }
  const parts = [tab.name];
  if (tab.count) parts.push(`${tab.count} ${tab.countLabel ?? ''}`.trim());
  if (tab.badge) parts.push(`${tab.badge} ${tab.badgeLabel ?? ''}`.trim());
  return parts.length > 1 ? parts.join(', ') : collapsed ? tab.name : undefined;
}

/**
 * `collapsed` (M5 gate B15): on a landscape tablet the left column can fold to its icons. The fold is the owner's: its
 * `DividerHandle` on the column's edge (lr-4, 2026-11-02, replacing B15's chevron row) and `useNavCollapsed`, which
 * remembers it per device. Elsewhere the fold doesn't show.
 */
export function SectionNav<T extends string>({
  label,
  tabs,
  current,
  onSelect,
  collapsed = false,
}: {
  label: string;
  tabs: NavTab<T>[];
  current: T;
  onSelect: (id: T) => void;
  collapsed?: boolean;
}) {
  return (
    <nav className={collapsed ? 'section-nav section-nav--collapsed' : 'section-nav'} aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.waits ? 'section-nav__tab section-nav__tab--lit' : 'section-nav__tab'}
          aria-current={current === tab.id ? 'page' : undefined}
          aria-label={tabLabel(tab, collapsed)}
          onClick={() => onSelect(tab.id)}
        >
          <span className="section-nav__icon">
            <Icon name={tab.icon} />
            {tab.badge ? (
              <span className="section-nav__badge" aria-hidden="true">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            ) : null}
          </span>
          <span className="section-nav__name">
            {tab.name}
            {tab.count ? <span className="section-nav__count">, {tab.countWord ? `${tab.count} ${tab.countWord}` : tab.count}</span> : null}
          </span>
        </button>
      ))}
    </nav>
  );
}

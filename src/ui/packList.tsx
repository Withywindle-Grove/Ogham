import type { ReactNode } from 'react';
import { Chip } from './parts.tsx';
import './packList.css';

// The parts of a list of packs (06 Components: Rules library list, Pack row; ruling lr-1 … lr-3, 2026-11-02),
// shared by the Rules library and the campaign set-up's Setting rules step (lr-5, with the ✓ in the leading slot).

/**
 * One pack in four lines: its name · its own description and what it needs · what it holds · who uses it, with its
 * version and date. `lead` is an optional slot before the text (the set-up step's ✓); `actions` sit at the right on
 * a tablet and wrap under the text on a phone; `children` show under the row (the delete confirm).
 */
export function PackRow({
  name,
  description,
  needs,
  holds,
  usedBy,
  version,
  updated,
  lead,
  onOpen,
  actions,
  children,
}: {
  name: string;
  /** The pack's own one-line description; dropped on a phone (Browse shows it). */
  description?: string;
  /** "Needs: Fen Rules, Advanced." — shown on every width. */
  needs?: string;
  /** "20 classes · 8 kindreds · 62 spells". */
  holds: string;
  /** The first campaign using it and how many more; null when none does. */
  usedBy: { first: string; more: number } | null;
  version?: string;
  /** "2 Nov". */
  updated: string;
  lead?: ReactNode;
  /** The row's text as one button (set-up step 2: it opens the pack's Browse with Pick at the foot, lr-5). */
  onOpen?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const Text = onOpen ? 'button' : 'div';
  return (
    <li className={`pack-row${onOpen ? ' pack-row--opens' : ''}`}>
      <div className="pack-row__main">
        {lead && <div className="pack-row__lead">{lead}</div>}
        <Text className="pack-row__text" {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}>
          <span className="pack-row__name">{name}</span>
          {(description || needs) && (
            <span className="pack-row__desc">
              {description && <span className="pack-row__blurb">{description}</span>}
              {description && needs && ' '}
              {needs && <span className="pack-row__needs">{needs}</span>}
            </span>
          )}
          <span className="pack-row__holds">{holds || 'Nothing in it yet'}</span>
          <span className="pack-row__use">
            {usedBy ? (
              <>
                Used by <strong>{usedBy.first}</strong>
                {usedBy.more > 0 && ` and ${usedBy.more} more`}
              </>
            ) : (
              'Not used by a campaign'
            )}
            {version && `, version ${version}`}, updated {updated}
          </span>
        </Text>
        {actions && <div className="pack-row__actions">{actions}</div>}
      </div>
      {children}
    </li>
  );
}

/** The kind filter (lr-1): All and one chip per kind present, each with its count. Hidden with one kind or none. */
export function KindChips<K extends string>({
  kinds,
  total,
  selected,
  onSelect,
}: {
  kinds: readonly { kind: K; title: string; count: number }[];
  total: number;
  selected: K | 'all';
  onSelect: (kind: K | 'all') => void;
}) {
  if (kinds.length < 2) return null;
  return (
    <div className="kind-chips" role="group" aria-label="Show">
      <Chip pressed={selected === 'all'} onClick={() => onSelect('all')}>
        All: {total}
      </Chip>
      {kinds.map((kind) => (
        <Chip key={kind.kind} pressed={selected === kind.kind} onClick={() => onSelect(kind.kind)}>
          {kind.title}: {kind.count}
        </Chip>
      ))}
    </div>
  );
}

/** One kind's packs under its heading, "Setting rules · 2"; `note` adds how the kind is picked (set-up, lr-5). */
export function KindGroup({ title, count, note, children }: { title: string; count: number; note?: string; children: ReactNode }) {
  return (
    <section className="kind-group" aria-label={title}>
      <h2 className="kind-group__title">
        {title}
        <span className="kind-group__count">
          : {count}
          {note && `, ${note}`}
        </span>
      </h2>
      <ul className="kind-group__list">{children}</ul>
    </section>
  );
}

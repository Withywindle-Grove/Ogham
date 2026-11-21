// An item's full entry at creation (R3-10, 2026-11-08: "the pack's full text"), opened from a weapon skill's row or a
// shop row: the pack's description (and notes), then its qualities, damage and use, cost and weight as kv lines (the
// Pack tab's item sheet's `Lines kv`, #552), then the source, then Pick at the foot (the EntryPanel's). Nothing of the
// app's own words beyond the labels; a part the pack doesn't give is left out.
import type { ReactNode } from 'react';
import type { Line } from '../modules/library/describe.ts';
import type { DamageRule } from '../modules/characters/weaponDamage.ts';
import { weaponLine } from '../modules/characters/weaponSkills.ts';
import { EntryPanel } from '../ui/creation.tsx';
import { priceText } from './AddItem.tsx';
import { Lines } from './RulesBrowser.tsx';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const words = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

interface ItemLike {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

/**
 * The entry's parts in the ruled order (R3-10): description paragraphs (the pack's `description`, else its `blurb`,
 * then `notes`), the kv lines (Qualities, Damage and use, Cost, Weight) and the source.
 */
export function itemEntryParts(item: ItemLike, { damageRule = null, cost }: { damageRule?: DamageRule | null; cost?: string } = {}): { paragraphs: string[]; lines: Line[]; source: string } {
  const d = item.data;
  const weapon = isRecord(d.weapon) ? d.weapon : null;
  const paragraphs = [text(d.description) || text(d.blurb), text(d.notes)].filter(Boolean);
  // The tags and hands are in Damage and use (weaponLine); qualities are the pack's own list.
  const qualities = [...words(d.qualities), ...(weapon ? words(weapon.qualities) : [])];
  const use = weapon ? weaponLine(item, damageRule) : '';
  const price = cost ?? priceText(d.value);
  const weightCoin = typeof d.weightCoin === 'number' ? d.weightCoin : null;
  const slots = typeof d.slots === 'number' ? d.slots : null;
  const weight = [weightCoin !== null ? `${weightCoin} coins` : '', slots !== null ? `${slots} ${slots === 1 ? 'slot' : 'slots'}` : ''].filter(Boolean).join(', ');
  const lines: Line[] = [
    ...(qualities.length > 0 ? [{ label: 'Qualities', value: [...new Set(qualities)].join(', ') }] : []),
    ...(use ? [{ label: 'Damage and use', value: use }] : []),
    ...(price ? [{ label: 'Cost', value: price }] : []),
    ...(weight ? [{ label: 'Weight', value: weight }] : []),
  ];
  return { paragraphs, lines, source: text(d.source) };
}

/** The item's entry as a sheet (or beside the list), Pick at its foot (the EntryPanel's); `extra` after the source. */
export function ItemEntry({
  item,
  damageRule,
  cost,
  picked,
  pickedLabel,
  onPick,
  onClose,
  asSheet = true,
  extra,
}: {
  item: ItemLike;
  damageRule?: DamageRule | null;
  /** The price as the step shows it (the shop's), else the pack's `value`. */
  cost?: string;
  picked?: boolean;
  pickedLabel?: string;
  onPick?: () => void;
  onClose: () => void;
  asSheet?: boolean;
  extra?: ReactNode;
}) {
  const parts = itemEntryParts(item, { damageRule, cost });
  return (
    <EntryPanel
      name={item.name}
      description={parts.paragraphs}
      headings={[]}
      extra={
        <>
          {parts.lines.length > 0 && <Lines lines={parts.lines} kv />}
          {parts.source && <p className="auth__meta item-entry__source">{parts.source}</p>}
          {extra}
        </>
      }
      picked={picked}
      pickedLabel={pickedLabel}
      onPick={onPick}
      onClose={onClose}
      asSheet={asSheet}
    />
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { urgentItems, type UrgentItem } from '../../core/urgent.ts';
import { Icon } from '../../ui/icons.tsx';
import type { NoLightView } from '../Darkness.tsx';
import { useWeatherNotice, type HeldRoll } from '../WeatherCard.tsx';
import { NoticesSheet, type Notice } from './NoticesSheet.tsx';
import './PlayerNotices.css';

/** The box's words (page M1, frame M1c, (A)): the count in words, never a badge; past 99, "99+ notices". */
export function noticesWords(count: number): string {
  if (count === 0) return 'No notices';
  if (count === 1) return '1 notice';
  return count > 99 ? '99+ notices' : `${count} notices`;
}

/**
 * The order in the sheet (frame M1e): what asks for an act first, then the rest in the order given (the screen's, then
 * the sheet's oldest first, then the app's other sources). Stable: notices of one kind keep their order.
 */
export function orderNotices(notices: readonly Notice[]): Notice[] {
  return [...notices.filter((n) => n.act), ...notices.filter((n) => !n.act)];
}

/** "No light" as a notice (frame M1d): its one-tap light the sheet's one accent; with nothing to light, the words alone. */
export function noLightNotice(view: NoLightView): Notice {
  const { option, words } = view;
  return option && words
    ? {
        key: 'no-light',
        sign: 'warning',
        act: true,
        title: 'No light',
        action: (
          <button type="button" className="button-primary" onClick={view.lightIt}>
            {words}
          </button>
        ),
      }
    : { key: 'no-light', sign: 'warning', title: 'No light', body: 'Nothing to light in your pack.' };
}

/** The app's other urgent sources (core/urgent.ts: a status ending, "Ready to level", once built), as notices. */
function useUrgentNotices(characterId: string, campaignId: string): Notice[] {
  const [items, setItems] = useState<(UrgentItem & { sourceId: string })[]>([]);
  const load = useCallback(() => urgentItems({ characterId, campaignId }), [characterId, campaignId]);
  useEffect(() => {
    let current = true;
    void load().then((found) => current && setItems(found));
    return () => {
      current = false;
    };
  }, [load]);
  return items.map((item) => ({
    key: `urgent-${item.sourceId}:${item.key}`,
    title: item.text,
    ...(item.action
      ? {
          action: (
            <button
              type="button"
              className="button-secondary"
              onClick={async () => {
                await item.action!.run();
                setItems(await load());
              }}
            >
              {item.action.label}
            </button>
          ),
        }
      : {}),
  }));
}

/**
 * What the box keeps above itself (in `PlayerSheetParts`): turning a tablet moves the box's place, which draws the box
 * afresh, so an open sheet and a half-typed weather roll are held where the move doesn't reach.
 */
export type NoticesHeld = {
  open: boolean;
  setOpen: (open: boolean) => void;
  roll: HeldRoll | null;
  setRoll: (roll: HeldRoll) => void;
};

/**
 * The Player tab's notices box (row C1, tfn-1, tfn-2; page M1, frames M1a to M1e, approved 2026-11-19): the herald's
 * trumpet and the count in words. With nothing it stays in place, quiet; with something the trumpet sits on a glowing
 * patch, the edge turns heavy and the words bold, so the glow is never the only sign; the glow is still. A tap opens
 * the notices one at a time (`NoticesSheet`); with none the sheet says "Nothing new." (never a dead button). `low`: the
 * phone's shorter box under the head's line (frame M1c). `held`: the open sheet and the typed roll, kept above (without
 * it, kept here).
 */
export function PlayerNotices({
  db,
  user,
  notices,
  sheetNotices,
  characterId,
  campaignId,
  low = false,
  held,
}: {
  db: Db;
  user: CurrentUser;
  /** The screen's own ("No light"). */
  notices: readonly Notice[];
  /** The hosted sheet's: its changes, oldest first, then "To finish". */
  sheetNotices: readonly Notice[];
  characterId: string;
  campaignId: string;
  low?: boolean;
  held?: NoticesHeld;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = held ? held.open : ownOpen;
  const setOpen = held ? held.setOpen : setOwnOpen;
  const close = useCallback(() => setOpen(false), [setOpen]);
  // The weather is read here, so only while the Player tab shows (as the urgent strip did).
  const weather = useWeatherNotice(db, user, campaignId, held && { roll: held.roll, onRoll: held.setRoll });
  const urgent = useUrgentNotices(characterId, campaignId);
  const all = orderNotices([...notices, ...(weather ? [weather] : []), ...sheetNotices, ...urgent]);
  const count = all.length;
  return (
    <>
      <button
        type="button"
        className={`notices-box${count > 0 ? ' notices-box--lit' : ''}${low ? ' notices-box--low' : ''}`}
        aria-label={count === 0 ? 'No notices, nothing new' : `${noticesWords(count)}, open them`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="notices-box__patch" aria-hidden="true">
          <Icon name="trumpet-flag" size={low ? 24 : 28} />
        </span>
        <span className="notices-box__words">{noticesWords(count)}</span>
      </button>
      {open && <NoticesSheet notices={all} onClose={close} />}
    </>
  );
}

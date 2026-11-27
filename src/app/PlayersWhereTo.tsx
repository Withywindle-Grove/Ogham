// A player's "Where to?" on the Scene (plan dec-9-the-players-scene, row P2; rulings mc-28, mc-28a, mc-28b, mc-36,
// mc-36a, p2p-30, d5-1, d5-2). Mockups (approved by Francis): page 18 of the December mockups, PL1 (the rows in the
// place's card), PL2 (before anything is shown), PL4c (a tap on a way), PL5 (the phone) and PL9 (a failed read),
// 2026-11-14 (ap-10); set 1's `01-08`, `01-08p`, `01-08n`, 2026-11-12. The "End expedition" row has no frame (d5-2):
// WY1d's row and PL4c's pop-up, approved from pictures of the real screen.
//
// Reads the players' ways (`campaign_ways_on` through `loadWaysOn`), which sends nothing a player may not have: no
// hidden way, no unshown far end's name, no obstacle, no pack id, and no way at all before something of the place the
// group is at has been shown to it (mc-28b). A tap on a way's button proposes nothing for first play (pw-1): its
// pop-up says the GM moves the party. Nothing here writes.
import { useEffect, useState } from 'react';
import type { Db } from '../core/supabase.ts';
import { loadWaysOn, type WayOn } from '../modules/library/waysOn.ts';
import { playersDestinationsOf, WHERE_TO_WORDS, wayTapWords, type PlayersDestination, type PlayersWay } from '../modules/expedition/playersWays.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { AreaRows, DestinationRow, TravelPopUp, WayLine, WhereTo } from '../ui/MoveOnParts.tsx';
import { SkeletonRows } from '../ui/parts.tsx';
import { EndExpeditionRow, RefreshFailedRow, WhereToLine } from '../ui/WhereToParts.tsx';
import { useLogVersion } from './campaignLog.tsx';

/** The players' ways as last read well, and how the newest read went. */
export interface WaysRead {
  /** The last list read well; null until one has been. */
  ways: readonly WayOn[] | null;
  /** The newest read failed (the list above, if any, is an older one). */
  failed: boolean;
  /** Read again (PL9's Try again). */
  retry: () => void;
}

/**
 * The reader's ways on, read when the Scene opens and again whenever the log moves (a piece shown, a move made), so the
 * list follows the GM. A failed read keeps the last good list (PL9: nothing is emptied and nothing is guessed). Reads
 * nothing when `enabled` is false (the GM, who has Move on).
 */
export function usePlayersWaysOn(db: Db, campaignId: string, enabled: boolean): WaysRead {
  const logVersion = useLogVersion();
  const [version, setVersion] = useState(0);
  const [read, setRead] = useState<{ ways: readonly WayOn[] | null; failed: boolean }>({ ways: null, failed: false });
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void loadWaysOn(db, campaignId).then((ways) => {
      if (!current) return;
      setRead((was) => (ways ? { ways, failed: false } : { ways: was.ways, failed: true }));
    });
    return () => {
      current = false;
    };
  }, [db, campaignId, enabled, logVersion, version]);
  return { ...read, retry: () => setVersion((v) => v + 1) };
}

/** PL2: before anything of the place is shown, the heading and one line, and no ways (mc-28b). */
export function WhereToNoneYet() {
  return (
    <WhereTo empty={false}>
      <WhereToLine>{WHERE_TO_WORDS.noneYet}</WhereToLine>
    </WhereTo>
  );
}

type Open = { destination: PlayersDestination; way: PlayersWay } | 'end' | null;

/**
 * A group's Where to? in its place's card, once something of the place is shown (PL1): a row a destination, its ways as
 * stacked buttons (the picture for the way's `by`, its word, its time); every row with its map number, in number order;
 * a far end not yet explored reads "N. Unexplored" or "Unexplored", its way under it; a tap on a way opens its travel
 * pop-up (`TravelPopUp`; page 44, PU1 B, sf-15); where the ways lead into more
 * than one Area, each Area's name, or "Elsewhere", over its rows (sf-9; page 44, WT1 B and C, PS1, PS3 C). At a Location marked a way out (`wayOut`), "End expedition" is the last row (d5-2). With no way to show
 * and no such row, nothing at all: "Where to?" is left out (d5-1). While the first read is out, still bars under the
 * heading; a failed read keeps the last list, with a row that says so and Try again (PL9). `step` is the mode's count
 * now ("turn 14"), remembered with each good list for that row's words.
 */
export function PlayersWhereTo({ read, group, step, wayOut = false }: { read: WaysRead; group: number; step: string | null; wayOut?: boolean }) {
  const [open, setOpen] = useState<Open>(null);
  // The step a good list was read at (PL9: "These are as they were at turn 13."): kept with that list.
  const [readAt, setReadAt] = useState<{ ways: readonly WayOn[] | null; step: string | null }>({ ways: null, step: null });
  if (read.ways !== readAt.ways) setReadAt({ ways: read.ways, step });

  if (read.ways === null) {
    return (
      <WhereTo empty={false}>
        {read.failed ? <RefreshFailedRow words={WHERE_TO_WORDS.failed} onRetry={read.retry} /> : <SkeletonRows rows={2} label="Loading the ways" />}
      </WhereTo>
    );
  }
  const destinations = playersDestinationsOf(read.ways, group);
  if (destinations.length === 0 && !wayOut && !read.failed) return null;
  const tapped = open && open !== 'end' ? wayTapWords(open.destination, open.way) : null;
  return (
    <>
      <WhereTo empty={false}>
        {read.failed && <RefreshFailedRow words={WHERE_TO_WORDS.stale(readAt.step)} onRetry={read.retry} />}
        <AreaRows rows={destinations} level={4}>
          {(d) => (
            <DestinationRow
              key={d.id}
              number={d.number}
              name={d.name}
              sub={d.wayLine ? <WayLine>{d.wayLine}</WayLine> : undefined}
              ways={d.ways}
              onWay={(key) => {
                const way = d.ways.find((w) => w.key === key);
                if (way) setOpen({ destination: d, way });
              }}
            />
          )}
        </AreaRows>
        {wayOut && <EndExpeditionRow onOpen={() => setOpen('end')} />}
      </WhereTo>
      {tapped && <TravelPopUp title={tapped.title} time={tapped.time} words={tapped.words} onClose={() => setOpen(null)} />}
      {open === 'end' && (
        <Dialog label={WHERE_TO_WORDS.endTitle} onClose={() => setOpen(null)}>
          <p>{WHERE_TO_WORDS.gmEnds}</p>
        </Dialog>
      )}
    </>
  );
}

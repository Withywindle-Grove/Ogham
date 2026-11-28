// "Spend N" from a purchase's toast (K7, PK10b; TC13 piece C, sb5-5; docs/specs/town-ask-buy.md, "Piece C"): the
// purse's Spend sheet, the amount and What for filled in. The toast outlives the tab that raised it (Buy it on the
// Scene, Add item on the Pack), so the player's screen hosts the sheet above its tabs (PlayerScreen): Spend opens it
// wherever the player is when they tap it. A screen drawn outside a host (the GM's own pack) draws the sheet itself.
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { Denomination } from '../modules/inventory/coinWords.ts';
import type { NamedCarrier } from '../modules/inventory/inventory.ts';
import type { Coins } from '../modules/inventory/purse.ts';
import { PurseSheet } from './PurseSheet.tsx';

/** What the Spend sheet opens with: whose purse, who else coin can go to, the coins, and the spend typed in. */
export interface SpendRequest {
  carrier: NamedCarrier;
  recipients: readonly NamedCarrier[];
  denominations: readonly Denomination[];
  coins: Coins;
  spend: { coins: Coins; whatFor: string };
  /** The GM's sheet (K15), where the GM opened the purse. */
  gm?: boolean;
  /** Coin moved: the caller reads its purse again (a no-op once its tab has gone; the log's version reads it too). */
  onChanged?: () => void;
}

type OpenSpend = (request: SpendRequest) => void;

const SpendSheetContext = createContext<OpenSpend | null>(null);

/** The host's side: `open` goes to the tabs (`SpendSheetHost`), and the host draws `sheet` above them. */
export function useSpendSheetState(db: Db, user: CurrentUser): { open: OpenSpend; sheet: ReactNode } {
  // `n` gives each opening a fresh sheet, so a second Spend starts from its own amount.
  const [open, setOpen] = useState<{ request: SpendRequest; n: number } | null>(null);
  const request = open?.request;
  const sheet = request && (
    <PurseSheet
      key={open.n}
      db={db}
      user={user}
      carrier={request.carrier}
      recipients={request.recipients}
      denominations={request.denominations}
      coins={request.coins}
      gm={request.gm ?? false}
      spend={request.spend}
      onClose={() => setOpen(null)}
      onChanged={() => request.onChanged?.()}
    />
  );
  return { open: (next) => setOpen((was) => ({ request: next, n: (was?.n ?? 0) + 1 })), sheet };
}

export const SpendSheetHost = SpendSheetContext.Provider;

/** A toast's Spend: the host's sheet above the tabs; outside a host, this caller's own `sheet`, which it draws. */
export function useSpendSheet(db: Db, user: CurrentUser): { open: OpenSpend; sheet: ReactNode } {
  const hosted = useContext(SpendSheetContext);
  const own = useSpendSheetState(db, user);
  return hosted ? { open: hosted, sheet: null } : own;
}

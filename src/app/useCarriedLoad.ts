// A character's load as travel reads it (bq-5, sr-1): what they carry (approved lines, not the ones kept apart: animals,
// vehicles) in the campaign's encumbrance mode, for the full sheet's Movement and its Pack load (sr-9). In armour
// mode the GM's Carrying treasure switch counts (eq-3), as on the Pack tab, so the sheet's speed is travel's. Null
// while it loads; "error" when it can't be read (Movement then keeps the character's own speed, silently).
import { useEffect, useState } from 'react';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import type { Db } from '../core/supabase.ts';
import { carriedLoad, toLoadLine, wornArmour, type CarriedLoad, type EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import { loadInventory, loadInventorySettings, type InventoryLine } from '../modules/inventory/inventory.ts';
import { isSeparate } from '../modules/inventory/packView.ts';
import { loadTreasureSwitch, type TreasureSwitch } from '../modules/inventory/treasureSwitch.ts';

export interface Carried {
  load: CarriedLoad;
  /** The character's approved lines that count (none kept apart), for the Pack load's groups. */
  lines: InventoryLine[];
  mode: EncumbranceMode;
  /** The GM's Carrying treasure switch (eq-3): null follows the pack. */
  treasureSwitch: TreasureSwitch;
}

export function useCarriedLoad(db: Db, campaignId: string, actorId: string, rules: EncumbranceRules | null, refresh: unknown = 0): Carried | null | 'error' {
  const [carried, setCarried] = useState<Carried | null | 'error'>(null);
  useEffect(() => {
    if (!campaignId || !rules) return;
    let live = true;
    Promise.all([loadInventory(db, campaignId), loadInventorySettings(db, campaignId), loadTreasureSwitch(db, actorId)]).then(
      ([inventory, settings, treasureSwitch]) => {
        if (!live) return;
        if (!inventory || !settings) {
          setCarried('error');
          return;
        }
        const counting = inventory.lines.filter((l) => l.actorId === actorId && l.approval === 'approved' && !isSeparate(l, rules));
        const loadLines = counting.map(toLoadLine);
        setCarried({
          load: carriedLoad(loadLines, rules, settings.mode, { armour: wornArmour(loadLines, rules), carryingTreasure: treasureSwitch }),
          lines: counting,
          mode: settings.mode,
          treasureSwitch,
        });
      },
      () => {
        if (live) setCarried('error');
      },
    );
    return () => {
      live = false;
    };
  }, [db, campaignId, actorId, rules, refresh]);
  return carried;
}

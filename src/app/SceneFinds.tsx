// The find card on the Scene (K18d of docs/plans/dec-6-the-whole-pack-tab.md; page 45's FD1c C, approved 2026-11-26;
// p45-3 and p45-23): what another person put in the player's character's pack or purse, in the prompt slot and nowhere
// else on that tab, at every width. It takes the calls' one place (CallsInPromptSlot's `find`), so it comes after the
// rest and light prompts and before a call card, one of the two at a time. It is K18b's `FindCard`, given K20a's
// entries (`readPackFinds`, `packFindsOf`), drawn with `live={false}` inside the slot's one live region.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { markFindsSeen } from '../modules/characters/findsSeen.ts';
import { coinLine, denominationsOf } from '../modules/inventory/coinWords.ts';
import { loadCarriers, loadInventory } from '../modules/inventory/inventory.ts';
import { useToast } from '../ui/ToastHost.tsx';
import { useOnline } from '../ui/creation.tsx';
import { useLogChanged, useLogVersion } from './campaignLog.tsx';
import { loadCampaignSetting } from './campaignSetting.ts';
import { FindCard } from './FindCard.tsx';
import { FINDS_NOT_MARKED, packFindsOf, readPackFinds, type PackFinds } from './packFinds.ts';
import { registry } from './services.ts';

interface SceneFinds {
  finds: PackFinds;
  names: ReadonlyMap<string, string>;
  coinWords: (coins: Record<string, number>) => string;
}

/** Everything the Scene's card needs, read together; null for anyone but the character's own player, or on a failed read. */
async function loadSceneFinds(db: Db, user: CurrentUser, campaignId: string, characterId: string): Promise<SceneFinds | null> {
  const [read, inventory, carriers, setting] = await Promise.all([readPackFinds(db, user, campaignId, characterId), loadInventory(db, campaignId), loadCarriers(db, campaignId), loadCampaignSetting(db, user.id, campaignId)]);
  if (!read || !inventory || !carriers || !setting) return null;
  const denominations = denominationsOf(setting.rulesSets);
  return {
    finds: packFindsOf(read, inventory.lines, setting.rulesSets),
    names: new Map(carriers.flatMap((c) => (c.actorId ? [[c.actorId, c.name] as const] : []))),
    coinWords: (coins) => coinLine(denominations, coins),
  };
}

/**
 * The Scene's find card for `characterId` (the player's active character; null draws none), or null when nothing is new.
 * "Got it" writes the mark once, with no toast; the Pack's tags and the count follow through the log's reload
 * (`useLogChanged`). Offline it writes nothing and shows FD9's box; a refusal keeps the card under the error toast.
 */
export function useSceneFinds({ db, user, campaignId, characterId, onOpenPack }: { db: Db; user: CurrentUser; campaignId: string; characterId: string | null; /** "and N more": the Pack at the new rows, when the host can open it. */ onOpenPack?: () => void }): ReactNode {
  const logVersion = useLogVersion();
  const logChanged = useLogChanged();
  const show = useToast();
  const online = useOnline();
  const [loaded, setLoaded] = useState<SceneFinds | null>(null);
  const load = useCallback(async () => (characterId ? loadSceneFinds(db, user, campaignId, characterId).catch(() => null) : null), [db, user, campaignId, characterId]);
  useEffect(() => {
    let current = true;
    void load().then((found) => current && setLoaded(found));
    return () => {
      current = false;
    };
  }, [load, logVersion]);
  // FD9: the box shows after a tap offline, and goes once she is back online (FD9b C), as on the Pack.
  const [boxAsked, setBoxAsked] = useState(false);
  const [wasOnline, setWasOnline] = useState(online);
  if (online !== wasOnline) {
    setWasOnline(online);
    if (online) setBoxAsked(false);
  }
  const marking = useRef(false);
  if (!loaded || loaded.finds.entries.length === 0) return null;
  const { finds } = loaded;
  async function gotIt() {
    if (!online) return setBoxAsked(true);
    if (marking.current) return;
    marking.current = true;
    const done = await runCommand(registry, db, user, markFindsSeen, { character: finds.character });
    marking.current = false;
    if (!done.ok) return show({ text: FINDS_NOT_MARKED, error: true });
    setLoaded((was) => was && { ...was, finds: { ...was.finds, entries: [] } });
    logChanged();
  }
  return (
    <FindCard
      entries={finds.entries}
      words={{ names: loaded.names, coinWords: loaded.coinWords, when: finds.when, now: new Date().toISOString() }}
      onGotIt={() => void gotIt()}
      onMore={() => onOpenPack?.()}
      offlineBox={boxAsked && !online}
      live={false}
    />
  );
}
